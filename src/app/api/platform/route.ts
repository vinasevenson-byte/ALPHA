import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  addMonthsIso,
  advancePeriodicityIso,
  getWorkspaceFullState,
  NovaDomainError,
  todayIso,
} from "@/lib/nova-service";
import {
  requireSession,
  requireWorkspace,
  requireSameOrigin,
  AuthError,
} from "@/lib/nova-auth";
import {
  centsToDecimalString,
  decimalStringToCents,
  remainingInstallment,
  splitInstallmentsExact,
} from "@/domain/planning";
import { taxableFixedIncomeRedemption } from "@/domain/investments";

function makeRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}

function toJsonSafe<T>(obj: T): T {
  return JSON.parse(
    JSON.stringify(obj, (_key, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  );
}

async function assertAccountInWorkspace(
  db: { account: typeof prisma.account },
  workspaceId: string,
  accountId: string
) {
  if (!accountId) {
    throw new NovaDomainError(
      "VALIDATION_ERROR",
      "Conta financeira obrigatória.",
      422
    );
  }
  const acc = await db.account.findFirst({
    where: { id: accountId, workspaceId },
  });
  if (!acc) {
    throw new NovaDomainError(
      "NOT_FOUND",
      "Conta financeira não encontrada neste workspace.",
      404
    );
  }
  return acc;
}

interface ParsedImportRow {
  externalId: string;
  postedOn: string;
  amountCents: number;
  direction: "CREDIT" | "DEBIT" | "SELF_TRANSFER";
  description: string;
}

function parseOfxTransactions(rawText: string, fallbackDate: string): ParsedImportRow[] {
  const blocks = rawText.split(/<STMTTRN>/i).slice(1);
  const rows: ParsedImportRow[] = [];

  const extractTag = (chunk: string, tag: string): string => {
    const regex = new RegExp(`<${tag}>([^<\\r\\n]+)`, "i");
    const m = chunk.match(regex);
    return m ? m[1].trim() : "";
  };

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i].split(/<\/STMTTRN>/i)[0] || blocks[i];
    const dtRaw = extractTag(block, "DTPOSTED");
    const postedOn =
      dtRaw.length >= 8 && /^\d{8}/.test(dtRaw)
        ? `${dtRaw.slice(0, 4)}-${dtRaw.slice(4, 6)}-${dtRaw.slice(6, 8)}`
        : fallbackDate;
    const amtRaw = extractTag(block, "TRNAMT").replace(",", ".");
    const parsedNum = Number(amtRaw);
    if (!Number.isFinite(parsedNum) || parsedNum === 0) continue;

    const amountCents = Math.abs(Math.round(parsedNum * 100));
    const trnType = extractTag(block, "TRNTYPE").toUpperCase();
    const memo =
      extractTag(block, "MEMO") ||
      extractTag(block, "NAME") ||
      `Lançamento OFX #${i + 1}`;
    const fitId =
      extractTag(block, "FITID") ||
      `ofx_${postedOn}_${amountCents}_${i + 1}`;

    const lowerDesc = memo.toLowerCase();
    const isSelf =
      lowerDesc.includes("mesma titularidade") ||
      lowerDesc.includes("entre contas proprias") ||
      lowerDesc.includes("transferencia propria");

    const direction: ParsedImportRow["direction"] = isSelf
      ? "SELF_TRANSFER"
      : parsedNum > 0 || trnType === "CREDIT" || trnType === "DEP"
      ? "CREDIT"
      : "DEBIT";

    rows.push({
      externalId: fitId,
      postedOn,
      amountCents,
      direction,
      description: memo,
    });
  }

  return rows;
}

export async function GET(req: NextRequest) {
  const requestId = makeRequestId();
  try {
    const session = await requireSession(req);
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get("workspaceId") ?? undefined;
    if (!workspaceId) {
      throw new AuthError("VALIDATION_ERROR", 422, "workspaceId é obrigatório.");
    }
    await requireWorkspace(session.userId, workspaceId, "VIEW");
    const horizonDays = Number(searchParams.get("horizonDays") ?? 30);
    const scenarioKind = (searchParams.get("scenario") ?? "BASE") as
      | "BASE"
      | "CONSERVATIVE"
      | "OPTIMISTIC";

    const state = await getWorkspaceFullState({
      workspaceId,
      userId: session.userId,
      horizonDays,
      scenarioKind,
    });

    return NextResponse.json(
      toJsonSafe({ ...state, requestId }),
      { headers: { "X-Request-Id": requestId } }
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { code: err.code, message: err.message, details: {}, requestId },
        { status: err.status }
      );
    }
    if (err instanceof NovaDomainError) {
      return NextResponse.json(
        {
          code: err.code,
          message: err.message,
          details: err.details ?? {},
          requestId,
        },
        { status: err.status }
      );
    }
    console.error("GET /api/platform error:", err);
    return NextResponse.json(
      {
        code: "INTERNAL_ERROR",
        message: "Erro interno ao calcular indicadores do workspace.",
        details: {},
        requestId,
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const requestId = makeRequestId();
  try {
    requireSameOrigin(req);
    const session = await requireSession(req);
    const body = await req.json();
    const { action, workspaceId } = body;
    const idempotencyKey =
      req.headers.get("Idempotency-Key") ||
      body.idempotencyKey ||
      `idem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const actorId = session.userId;
    const today = todayIso();

    if (
      [
        "RESET_TO_ZERO",
        "LOAD_P02_FIXTURE",
        "LOAD_P03_FIXTURE",
        "SWITCH_ROLE",
        "CHANGE_MEMBER_ROLE",
      ].includes(action)
    ) {
      throw new AuthError(
        "ACTION_DISABLED",
        403,
        "Ação de demonstração desativada no Pacote 09."
      );
    }
    if (action === "CREATE_WORKSPACE") {
      throw new AuthError(
        "USE_AUTH_ENDPOINT",
        409,
        "Use /api/auth/create-workspace."
      );
    }
    if (process.env.NOVA_ENABLE_FINANCIAL_WRITES !== "true") {
      throw new AuthError(
        "FINANCIAL_WRITES_DISABLED",
        503,
        "Operações financeiras de escrita estão bloqueadas até a conclusão da homologação."
      );
    }
    if (!workspaceId) {
      throw new AuthError(
        "VALIDATION_ERROR",
        422,
        "workspaceId é obrigatório."
      );
    }

    const adminActions = new Set([
      "SET_WORKSPACE_RECONCILED",
      "INVITE_WORKSPACE_MEMBER",
      "UPDATE_MEMBER_ROLE",
      "REMOVE_WORKSPACE_MEMBER",
    ]);
    const level = adminActions.has(action) ? "ADMIN" : "EDIT";
    await requireWorkspace(actorId, workspaceId, level);

    // =========================================================================
    // GOVERNANÇA MULTI-USUÁRIO RBAC (PACOTE 09 / 10 — RESTRITO A OWNER / ADMIN)
    // =========================================================================
    if (action === "INVITE_WORKSPACE_MEMBER") {
      const emailNorm = String(body.email || "")
        .trim()
        .toLowerCase();
      const role = ["ADMIN", "EDITOR", "VIEWER"].includes(body.role)
        ? String(body.role)
        : "VIEWER";

      if (!emailNorm || !emailNorm.includes("@")) {
        throw new NovaDomainError(
          "VALIDATION_ERROR",
          "Informe um e-mail válido de usuário cadastrado.",
          422
        );
      }

      const targetUser = await prisma.user.findUnique({
        where: { email: emailNorm },
      });
      if (!targetUser) {
        throw new NovaDomainError(
          "USER_NOT_REGISTERED",
          "Nenhum usuário cadastrado com este e-mail. Solicite que a pessoa crie sua conta em /cadastro primeiro.",
          404
        );
      }

      const ws = await prisma.workspace.findUnique({
        where: { id: workspaceId },
      });
      if (ws?.ownerId === targetUser.id) {
        throw new NovaDomainError(
          "VALIDATION_ERROR",
          "Este usuário já é o titular (OWNER) do workspace.",
          409
        );
      }

      const membership = await prisma.membership.upsert({
        where: {
          workspaceId_userId: { workspaceId, userId: targetUser.id },
        },
        update: { role, status: "ACTIVE" },
        create: {
          workspaceId,
          userId: targetUser.id,
          role,
          status: "ACTIVE",
        },
      });

      await prisma.auditEvent.create({
        data: {
          workspaceId,
          actorId,
          action: "membership.granted",
          entityType: "Membership",
          entityId: membership.id,
          requestId,
          metadataJson: JSON.stringify({
            targetEmail: emailNorm,
            role,
          }),
        },
      });

      return NextResponse.json(
        { ok: true, membership, requestId },
        { status: 201 }
      );
    }

    if (action === "UPDATE_MEMBER_ROLE") {
      const { targetUserId, role } = body;
      if (!["ADMIN", "EDITOR", "VIEWER"].includes(role)) {
        throw new NovaDomainError("VALIDATION_ERROR", "Papel RBAC inválido.", 422);
      }
      const ws = await prisma.workspace.findUnique({
        where: { id: workspaceId },
      });
      if (ws?.ownerId === targetUserId || targetUserId === actorId) {
        throw new NovaDomainError(
          "FORBIDDEN_OWNER_CHANGE",
          "Não é permitido alterar o papel do titular (OWNER) ou o próprio papel administrativo.",
          403
        );
      }
      const existingMem = await prisma.membership.findUnique({
        where: {
          workspaceId_userId: { workspaceId, userId: String(targetUserId) },
        },
      });
      if (!existingMem) {
        throw new NovaDomainError("NOT_FOUND", "Membro não encontrado.", 404);
      }
      const updated = await prisma.membership.update({
        where: { id: existingMem.id },
        data: { role },
      });
      await prisma.auditEvent.create({
        data: {
          workspaceId,
          actorId,
          action: "membership.role_updated",
          entityType: "Membership",
          entityId: updated.id,
          requestId,
          metadataJson: JSON.stringify({ targetUserId, role }),
        },
      });
      return NextResponse.json({ ok: true, membership: updated, requestId });
    }

    if (action === "REMOVE_WORKSPACE_MEMBER") {
      const { targetUserId } = body;
      const ws = await prisma.workspace.findUnique({
        where: { id: workspaceId },
      });
      if (ws?.ownerId === targetUserId || targetUserId === actorId) {
        throw new NovaDomainError(
          "FORBIDDEN_OWNER_REMOVE",
          "Não é permitido remover o titular (OWNER) do workspace.",
          403
        );
      }
      await prisma.membership.deleteMany({
        where: { workspaceId, userId: String(targetUserId) },
      });
      await prisma.auditEvent.create({
        data: {
          workspaceId,
          actorId,
          action: "membership.removed",
          entityType: "Membership",
          entityId: String(targetUserId),
          requestId,
          metadataJson: JSON.stringify({ targetUserId }),
        },
      });
      return NextResponse.json({ ok: true, requestId });
    }

    // =========================================================================
    // CONTAS (P01)
    // =========================================================================
    if (action === "CREATE_ACCOUNT") {
      const { name, type, institution, openingBalanceDecimal, openingBalanceDate } =
        body;
      if (!String(name || "").trim()) {
        throw new NovaDomainError(
          "VALIDATION_ERROR",
          "Nome da conta é obrigatório.",
          422
        );
      }
      const openingCents = openingBalanceDecimal
        ? decimalStringToCents(openingBalanceDecimal)
        : 0;

      const acc = await prisma.account.create({
        data: {
          workspaceId,
          name: String(name).trim(),
          type: type || "CHECKING",
          institution: institution || null,
          openingBalanceCents: openingCents,
          openingCents: BigInt(openingCents),
          openingBalanceDate: openingBalanceDate || today,
          status: "ACTIVE",
        },
      });

      await prisma.auditEvent.create({
        data: {
          workspaceId,
          actorId,
          action: "account.created",
          entityType: "Account",
          entityId: acc.id,
          requestId,
          metadataJson: JSON.stringify({
            name: acc.name,
            openingBalance: centsToDecimalString(openingCents),
          }),
        },
      });

      return NextResponse.json(
        toJsonSafe({ ok: true, account: acc, requestId }),
        { status: 201 }
      );
    }

    if (action === "DELETE_OR_ARCHIVE_ACCOUNT") {
      const { accountId } = body;
      await assertAccountInWorkspace(prisma, workspaceId, accountId);

      const settledCount = await prisma.transaction.count({
        where: { workspaceId, accountId, status: "SETTLED" },
      });
      if (settledCount > 0) {
        // Invariante P01: Não excluir conta com movimentos liquidados; arquivar!
        const archived = await prisma.account.update({
          where: { id: accountId },
          data: { status: "ARCHIVED" },
        });
        await prisma.auditEvent.create({
          data: {
            workspaceId,
            actorId,
            action: "account.archived",
            entityType: "Account",
            entityId: accountId,
            requestId,
            metadataJson: JSON.stringify({
              reason:
                "Conta possui lançamentos liquidados; arquivada com preservação histórica.",
            }),
          },
        });
        return NextResponse.json(
          toJsonSafe({
            ok: true,
            archived: true,
            account: archived,
            requestId,
          })
        );
      }

      const anyTxCount = await prisma.transaction.count({
        where: { workspaceId, accountId },
      });
      if (anyTxCount > 0) {
        const archived = await prisma.account.update({
          where: { id: accountId },
          data: { status: "ARCHIVED" },
        });
        return NextResponse.json(
          toJsonSafe({
            ok: true,
            archived: true,
            account: archived,
            requestId,
          })
        );
      }

      await prisma.account.delete({ where: { id: accountId } });
      await prisma.auditEvent.create({
        data: {
          workspaceId,
          actorId,
          action: "account.deleted",
          entityType: "Account",
          entityId: accountId,
          requestId,
          metadataJson: JSON.stringify({ deleted: true }),
        },
      });
      return NextResponse.json({ ok: true, deleted: true, requestId });
    }

    // =========================================================================
    // MOVIMENTAÇÕES E TRANSFERÊNCIAS ATÔMICAS (P01)
    // =========================================================================
    if (action === "CREATE_TRANSACTION") {
      const existingIdem = await prisma.transaction.findUnique({
        where: {
          workspaceId_idempotencyKey: { workspaceId, idempotencyKey },
        },
      });
      if (existingIdem) {
        return NextResponse.json(
          toJsonSafe({
            ok: true,
            idempotentReplay: true,
            transaction: existingIdem,
            requestId,
          })
        );
      }

      const {
        accountId,
        categoryId,
        counterpartyId,
        costCenter,
        kind,
        status,
        amountDecimal,
        occurredOn,
        dueOn,
        description,
        signedAdjustDir,
      } = body;

      await assertAccountInWorkspace(prisma, workspaceId, accountId);

      const amountCents = decimalStringToCents(amountDecimal);
      if (amountCents <= 0) {
        throw new NovaDomainError(
          "VALIDATION_ERROR",
          "O valor do lançamento deve ser estritamente positivo (> 0).",
          422
        );
      }

      const effectiveKind = kind || "EXPENSE";
      const effectiveStatus = status || "SETTLED";
      const effectiveOccurred = occurredOn || today;
      const effectiveDue = dueOn || effectiveOccurred;
      const signedCentsBig =
        effectiveKind === "EXPENSE" || effectiveKind === "TRANSFER_OUT"
          ? -BigInt(amountCents)
          : effectiveKind === "ADJUSTMENT" && (signedAdjustDir ?? 1) < 0
          ? -BigInt(amountCents)
          : BigInt(amountCents);

      const tx = await prisma.transaction.create({
        data: {
          workspaceId,
          accountId,
          categoryId: categoryId || null,
          counterpartyId: counterpartyId || null,
          costCenter: costCenter || null,
          kind: effectiveKind,
          status: effectiveStatus,
          amountCents,
          signedCents: signedCentsBig,
          signedAdjustDir: signedAdjustDir ?? 1,
          date: new Date(`${effectiveOccurred}T00:00:00Z`),
          dueDate: new Date(`${effectiveDue}T00:00:00Z`),
          occurredOn: effectiveOccurred,
          dueOn: effectiveDue,
          settledOn: effectiveStatus === "SETTLED" ? effectiveOccurred : null,
          settledAt: effectiveStatus === "SETTLED" ? new Date() : null,
          description: String(description || "Lançamento").trim(),
          createdBy: actorId,
          idempotencyKey,
        },
      });

      await prisma.auditEvent.create({
        data: {
          workspaceId,
          actorId,
          action: `transaction.${tx.status.toLowerCase()}`,
          entityType: "Transaction",
          entityId: tx.id,
          requestId,
          metadataJson: JSON.stringify({
            kind: tx.kind,
            amount: centsToDecimalString(amountCents),
          }),
        },
      });

      return NextResponse.json(
        toJsonSafe({ ok: true, transaction: tx, requestId }),
        { status: 201 }
      );
    }

    // Invariante P01 #3: Transferência interna em duas pernas atômicas
    if (action === "CREATE_TRANSFER") {
      const {
        sourceAccountId,
        destinationAccountId,
        amountDecimal,
        occurredOn,
        description,
      } = body;

      if (sourceAccountId === destinationAccountId) {
        throw new NovaDomainError(
          "VALIDATION_ERROR",
          "Conta de origem e destino devem ser diferentes.",
          422
        );
      }

      await assertAccountInWorkspace(prisma, workspaceId, sourceAccountId);
      await assertAccountInWorkspace(prisma, workspaceId, destinationAccountId);

      const amountCents = decimalStringToCents(amountDecimal);
      if (amountCents <= 0) {
        throw new NovaDomainError(
          "VALIDATION_ERROR",
          "O valor da transferência deve ser positivo.",
          422
        );
      }

      const transferGroupId = `tfg_${Date.now()}`;
      const dateStr = occurredOn || today;
      const dtObj = new Date(`${dateStr}T00:00:00Z`);

      const [outLeg, inLeg] = await prisma.$transaction([
        prisma.transaction.create({
          data: {
            workspaceId,
            accountId: sourceAccountId,
            kind: "TRANSFER_OUT",
            status: "SETTLED",
            amountCents,
            signedCents: -BigInt(amountCents),
            date: dtObj,
            dueDate: dtObj,
            occurredOn: dateStr,
            settledOn: dateStr,
            settledAt: new Date(),
            description: description || "Transferência entre contas próprias",
            transferGroup: transferGroupId,
            transferGroupId,
            createdBy: actorId,
            idempotencyKey: `${idempotencyKey}_out`,
          },
        }),
        prisma.transaction.create({
          data: {
            workspaceId,
            accountId: destinationAccountId,
            kind: "TRANSFER_IN",
            status: "SETTLED",
            amountCents,
            signedCents: BigInt(amountCents),
            date: dtObj,
            dueDate: dtObj,
            occurredOn: dateStr,
            settledOn: dateStr,
            settledAt: new Date(),
            description: description || "Transferência entre contas próprias",
            transferGroup: transferGroupId,
            transferGroupId,
            createdBy: actorId,
            idempotencyKey: `${idempotencyKey}_in`,
          },
        }),
        prisma.auditEvent.create({
          data: {
            workspaceId,
            actorId,
            action: "transfer.executed",
            entityType: "TransferGroup",
            entityId: transferGroupId,
            requestId,
            metadataJson: JSON.stringify({
              sourceAccountId,
              destinationAccountId,
              amount: centsToDecimalString(amountCents),
            }),
          },
        }),
      ]);

      return NextResponse.json(
        toJsonSafe({ ok: true, transferGroupId, outLeg, inLeg, requestId }),
        { status: 201 }
      );
    }

    if (action === "SETTLE_TRANSACTION") {
      const { transactionId, settledOn } = body;
      const existing = await prisma.transaction.findFirst({
        where: { id: transactionId, workspaceId },
      });
      if (!existing) {
        throw new NovaDomainError(
          "NOT_FOUND",
          "Lançamento não encontrado.",
          404
        );
      }
      if (existing.status === "SETTLED") {
        return NextResponse.json(
          toJsonSafe({
            ok: true,
            idempotentReplay: true,
            transaction: existing,
            requestId,
          })
        );
      }

      const updated = await prisma.transaction.update({
        where: { id: transactionId },
        data: {
          status: "SETTLED",
          settledOn: settledOn || today,
          settledAt: new Date(),
          version: { increment: 1 },
        },
      });

      await prisma.auditEvent.create({
        data: {
          workspaceId,
          actorId,
          action: "transaction.settled",
          entityType: "Transaction",
          entityId: transactionId,
          requestId,
          metadataJson: JSON.stringify({
            amount: centsToDecimalString(existing.amountCents),
          }),
        },
      });

      return NextResponse.json(
        toJsonSafe({ ok: true, transaction: updated, requestId })
      );
    }

    // Invariante P01 #6: Cancelamento preserva histórico com motivo e auditoria (não apaga registro)
    if (action === "CANCEL_TRANSACTION") {
      const { transactionId, reason } = body;
      const existing = await prisma.transaction.findFirst({
        where: { id: transactionId, workspaceId },
      });
      if (!existing) {
        throw new NovaDomainError(
          "NOT_FOUND",
          "Lançamento não encontrado.",
          404
        );
      }

      const canceled = await prisma.transaction.update({
        where: { id: transactionId },
        data: {
          status: "CANCELED",
          cancelReason:
            reason || "Cancelamento/estorno solicitado pelo usuário",
          version: { increment: 1 },
        },
      });

      await prisma.auditEvent.create({
        data: {
          workspaceId,
          actorId,
          action: "transaction.canceled",
          entityType: "Transaction",
          entityId: transactionId,
          requestId,
          metadataJson: JSON.stringify({
            reason: canceled.cancelReason,
            previousStatus: existing.status,
          }),
        },
      });

      return NextResponse.json(
        toJsonSafe({ ok: true, transaction: canceled, requestId })
      );
    }

    // =========================================================================
    // MOTOR DE RECORRÊNCIAS (PACOTE 10)
    // =========================================================================
    if (action === "CREATE_RECURRENCE") {
      const {
        accountId,
        categoryId,
        kind,
        title,
        amountDecimal,
        periodicity,
        nextDate,
        endDate,
      } = body;

      await assertAccountInWorkspace(prisma, workspaceId, accountId);

      const amountCents = decimalStringToCents(amountDecimal);
      if (amountCents <= 0) {
        throw new NovaDomainError(
          "VALIDATION_ERROR",
          "Valor da recorrência deve ser positivo.",
          422
        );
      }

      const rec = await prisma.recurrence.create({
        data: {
          workspaceId,
          accountId,
          categoryId: categoryId || null,
          kind: kind === "INCOME" ? "INCOME" : "EXPENSE",
          title: String(title || "Recorrência").trim(),
          amountCents,
          periodicity: ["WEEKLY", "MONTHLY", "YEARLY"].includes(periodicity)
            ? periodicity
            : "MONTHLY",
          nextDate: nextDate || today,
          endDate: endDate || null,
          active: true,
        },
      });

      await prisma.auditEvent.create({
        data: {
          workspaceId,
          actorId,
          action: "recurrence.created",
          entityType: "Recurrence",
          entityId: rec.id,
          requestId,
          metadataJson: JSON.stringify({
            title: rec.title,
            kind: rec.kind,
            periodicity: rec.periodicity,
            amount: centsToDecimalString(amountCents),
          }),
        },
      });

      return NextResponse.json(
        { ok: true, recurrence: rec, requestId },
        { status: 201 }
      );
    }

    if (action === "TOGGLE_RECURRENCE") {
      const { recurrenceId } = body;
      const existing = await prisma.recurrence.findFirst({
        where: { id: recurrenceId, workspaceId },
      });
      if (!existing) {
        throw new NovaDomainError(
          "NOT_FOUND",
          "Recorrência não encontrada.",
          404
        );
      }
      const updated = await prisma.recurrence.update({
        where: { id: existing.id },
        data: { active: !existing.active },
      });
      await prisma.auditEvent.create({
        data: {
          workspaceId,
          actorId,
          action: updated.active ? "recurrence.resumed" : "recurrence.paused",
          entityType: "Recurrence",
          entityId: existing.id,
          requestId,
          metadataJson: JSON.stringify({ active: updated.active }),
        },
      });
      return NextResponse.json({ ok: true, recurrence: updated, requestId });
    }

    if (action === "DELETE_RECURRENCE") {
      const { recurrenceId } = body;
      const existing = await prisma.recurrence.findFirst({
        where: { id: recurrenceId, workspaceId },
      });
      if (!existing) {
        throw new NovaDomainError(
          "NOT_FOUND",
          "Recorrência não encontrada.",
          404
        );
      }
      await prisma.recurrence.delete({ where: { id: existing.id } });
      await prisma.auditEvent.create({
        data: {
          workspaceId,
          actorId,
          action: "recurrence.deleted",
          entityType: "Recurrence",
          entityId: existing.id,
          requestId,
          metadataJson: JSON.stringify({ title: existing.title }),
        },
      });
      return NextResponse.json({ ok: true, requestId });
    }

    if (action === "MATERIALIZE_RECURRENCE") {
      const { recurrenceId, settleImmediately = true } = body;
      const result = await prisma.$transaction(async (tx) => {
        const rec = await tx.recurrence.findFirst({
          where: { id: recurrenceId, workspaceId },
        });
        if (!rec) {
          throw new NovaDomainError(
            "NOT_FOUND",
            "Recorrência não encontrada.",
            404
          );
        }
        await assertAccountInWorkspace(tx, workspaceId, rec.accountId);

        const occDate = rec.nextDate;
        const recIdemKey = `rec_${rec.id}_${occDate}`;
        const existingTx = await tx.transaction.findUnique({
          where: {
            workspaceId_idempotencyKey: {
              workspaceId,
              idempotencyKey: recIdemKey,
            },
          },
        });

        const txStatus = settleImmediately ? "SETTLED" : "PENDING";
        const signedBig =
          rec.kind === "EXPENSE"
            ? -BigInt(rec.amountCents)
            : BigInt(rec.amountCents);
        const dtObj = new Date(`${occDate}T00:00:00Z`);

        const createdTx =
          existingTx ??
          (await tx.transaction.create({
            data: {
              workspaceId,
              accountId: rec.accountId,
              categoryId: rec.categoryId,
              kind: rec.kind,
              status: txStatus,
              amountCents: rec.amountCents,
              signedCents: signedBig,
              date: dtObj,
              dueDate: dtObj,
              occurredOn: occDate,
              dueOn: occDate,
              settledOn: txStatus === "SETTLED" ? occDate : null,
              settledAt: txStatus === "SETTLED" ? new Date() : null,
              description: `${rec.title} (${occDate})`,
              createdBy: actorId,
              idempotencyKey: recIdemKey,
            },
          }));

        const nextCursor = advancePeriodicityIso(occDate, rec.periodicity);
        const stillActive = rec.endDate ? nextCursor <= rec.endDate : rec.active;

        const updatedRec = await tx.recurrence.update({
          where: { id: rec.id },
          data: {
            nextDate: nextCursor,
            active: stillActive,
          },
        });

        await tx.auditEvent.create({
          data: {
            workspaceId,
            actorId,
            action: "recurrence.materialized",
            entityType: "Recurrence",
            entityId: rec.id,
            requestId,
            metadataJson: JSON.stringify({
              transactionId: createdTx.id,
              occurrenceDate: occDate,
              nextDate: nextCursor,
              status: txStatus,
            }),
          },
        });

        return { transaction: createdTx, recurrence: updatedRec };
      });

      return NextResponse.json(
        toJsonSafe({ ok: true, ...result, requestId }),
        { status: 201 }
      );
    }

    // =========================================================================
    // OBRIGAÇÕES, PARCELAS E BAIXAS PARCIAIS/INTEGRAIS (P02 + P10)
    // =========================================================================
    if (action === "CREATE_OBLIGATION") {
      const {
        direction,
        title,
        categoryId,
        categoryName,
        counterpartyId,
        counterparty,
        costCenter,
        totalAmountDecimal,
        installmentsCount,
        firstDueOn,
        confidence,
      } = body;

      const totalCents = decimalStringToCents(totalAmountDecimal);
      if (totalCents <= 0) {
        throw new NovaDomainError(
          "VALIDATION_ERROR",
          "O valor total do compromisso deve ser positivo.",
          422
        );
      }
      const count = Math.max(1, Math.min(120, Number(installmentsCount || 1)));
      const parts = splitInstallmentsExact(totalCents, count);
      const baseDue = firstDueOn || today;

      const createdObligation = await prisma.$transaction(async (tx) => {
        const ob = await tx.novaObligation.create({
          data: {
            workspaceId,
            direction: direction === "RECEIVABLE" ? "RECEIVABLE" : "PAYABLE",
            title: String(title || "Compromisso").trim(),
            categoryId: categoryId || null,
            categoryName: categoryName || "Geral",
            counterpartyId: counterpartyId || null,
            counterparty: counterparty || null,
            costCenter: costCenter || null,
            status: "ACTIVE",
            confidence: confidence || "HIGH",
          },
        });

        for (let i = 0; i < parts.length; i++) {
          const dueDateStr = addMonthsIso(baseDue, i);
          await tx.novaInstallment.create({
            data: {
              workspaceId,
              obligationId: ob.id,
              number: i + 1,
              dueOn: dueDateStr,
              amountCents: parts[i],
              status: "OPEN",
            },
          });
        }

        await tx.auditEvent.create({
          data: {
            workspaceId,
            actorId,
            action: "obligation.created",
            entityType: "NovaObligation",
            entityId: ob.id,
            requestId,
            metadataJson: JSON.stringify({
              direction: ob.direction,
              totalAmount: centsToDecimalString(totalCents),
              installmentsCount: count,
            }),
          },
        });

        return ob;
      });

      return NextResponse.json(
        { ok: true, obligation: createdObligation, requestId },
        { status: 201 }
      );
    }

    if (action === "CANCEL_OBLIGATION") {
      const { obligationId, reason } = body;
      const existing = await prisma.novaObligation.findFirst({
        where: { id: obligationId, workspaceId },
      });
      if (!existing) {
        throw new NovaDomainError(
          "NOT_FOUND",
          "Compromisso não encontrado.",
          404
        );
      }

      await prisma.$transaction([
        prisma.novaObligation.update({
          where: { id: existing.id },
          data: {
            status: "CANCELED",
            cancelReason: reason || "Compromisso cancelado pelo usuário",
            version: { increment: 1 },
          },
        }),
        prisma.novaInstallment.updateMany({
          where: {
            obligationId: existing.id,
            workspaceId,
            status: { in: ["OPEN", "PARTIAL"] },
          },
          data: { status: "CANCELED" },
        }),
        prisma.auditEvent.create({
          data: {
            workspaceId,
            actorId,
            action: "obligation.canceled",
            entityType: "NovaObligation",
            entityId: existing.id,
            requestId,
            metadataJson: JSON.stringify({
              title: existing.title,
              reason: reason || "Compromisso cancelado pelo usuário",
            }),
          },
        }),
      ]);

      return NextResponse.json({ ok: true, requestId });
    }

    // Baixa parcial ou integral de parcela com vínculo atômico a Transaction P01
    if (action === "RECORD_SETTLEMENT") {
      const { installmentId, accountId, amountDecimal, settledOn, note } = body;

      await assertAccountInWorkspace(prisma, workspaceId, accountId);

      // 1. Verifica idempotência no settlement
      const existingSettlement = await prisma.novaSettlement.findUnique({
        where: {
          workspaceId_idempotencyKey: { workspaceId, idempotencyKey },
        },
      });
      if (existingSettlement) {
        return NextResponse.json({
          ok: true,
          idempotentReplay: true,
          settlementId: existingSettlement.id,
          transactionId: existingSettlement.transactionId,
          requestId,
        });
      }

      const amountCents = decimalStringToCents(amountDecimal);
      if (amountCents <= 0) {
        throw new NovaDomainError(
          "VALIDATION_ERROR",
          "Valor da baixa deve ser positivo.",
          422
        );
      }

      const result = await prisma.$transaction(async (tx) => {
        const inst = await tx.novaInstallment.findFirst({
          where: { id: installmentId, workspaceId },
          include: { obligation: true, settlements: true },
        });
        if (!inst) {
          throw new NovaDomainError(
            "NOT_FOUND",
            "Parcela não encontrada.",
            404
          );
        }

        // Valida que a baixa não excede o saldo em aberto (remainingInstallment lança OVER_SETTLEMENT)
        const existingPaidBig = inst.settlements.map((s) =>
          BigInt(s.amountCents)
        );
        let remainingAfterBig: bigint;
        try {
          remainingAfterBig = remainingInstallment(BigInt(inst.amountCents), [
            ...existingPaidBig,
            BigInt(amountCents),
          ]);
        } catch {
          throw new NovaDomainError(
            "OVER_SETTLEMENT",
            "O valor informado excede o saldo em aberto desta parcela.",
            409,
            {
              installmentAmount: centsToDecimalString(inst.amountCents),
              attemptedSettlement: centsToDecimalString(amountCents),
            }
          );
        }

        const newStatus = remainingAfterBig === 0n ? "PAID" : "PARTIAL";
        const settlementDate = settledOn || today;
        const txKind =
          inst.obligation.direction === "RECEIVABLE" ? "INCOME" : "EXPENSE";
        const signedBig =
          txKind === "EXPENSE" ? -BigInt(amountCents) : BigInt(amountCents);

        // Cria a Transaction liquidada no Ledger P01 (com signedCents e datas P06 íntegros)
        const p01Tx = await tx.transaction.create({
          data: {
            workspaceId,
            accountId,
            categoryId: inst.obligation.categoryId,
            counterpartyId: inst.obligation.counterpartyId,
            kind: txKind,
            status: "SETTLED",
            amountCents,
            signedCents: signedBig,
            date: new Date(`${settlementDate}T00:00:00Z`),
            dueDate: new Date(`${inst.dueOn}T00:00:00Z`),
            occurredOn: settlementDate,
            dueOn: inst.dueOn,
            settledOn: settlementDate,
            settledAt: new Date(),
            description: `Baixa ${inst.obligation.title} (Parcela ${inst.number})`,
            costCenter: inst.obligation.costCenter,
            createdBy: actorId,
            idempotencyKey: `${idempotencyKey}_tx`,
          },
        });

        // Cria o NovaSettlement vinculado ao transactionId P01
        const settlement = await tx.novaSettlement.create({
          data: {
            workspaceId,
            installmentId: inst.id,
            transactionId: p01Tx.id,
            accountId,
            amountCents,
            settledOn: settlementDate,
            note: note || "Pagamento/recebimento registrado",
            idempotencyKey,
          },
        });

        await tx.novaInstallment.update({
          where: { id: inst.id },
          data: { status: newStatus },
        });

        const audit = await tx.auditEvent.create({
          data: {
            workspaceId,
            actorId,
            action:
              newStatus === "PAID"
                ? "obligation.settled"
                : "obligation.settled_partially",
            entityType: "NovaInstallment",
            entityId: inst.id,
            requestId,
            metadataJson: JSON.stringify({
              settlementId: settlement.id,
              transactionId: p01Tx.id,
              amount: centsToDecimalString(amountCents),
              outstanding: centsToDecimalString(remainingAfterBig),
            }),
          },
        });

        return {
          settlementId: settlement.id,
          transactionId: p01Tx.id,
          outstanding: centsToDecimalString(remainingAfterBig),
          installmentStatus: newStatus,
          auditId: audit.id,
        };
      });

      return NextResponse.json(
        { ok: true, ...result, requestId },
        { status: 201 }
      );
    }

    // =========================================================================
    // RESERVAS VIRTUAIS (COFRES P02) E METAS
    // Reserva NÃO gera transação bancária P01; altera apenas allocatedBalance!
    // =========================================================================
    if (action === "CREATE_RESERVE") {
      const { name, kind, targetAmountDecimal, targetOn, priority } = body;
      const targetCents = targetAmountDecimal
        ? decimalStringToCents(targetAmountDecimal)
        : null;

      const reserve = await prisma.novaReserve.create({
        data: {
          workspaceId,
          name: String(name || "Cofre").trim(),
          kind: kind || "GENERAL",
          status: "ACTIVE",
          targetAmountCents: targetCents,
          targetOn: targetOn || null,
          priority: Number(priority || 3),
        },
      });

      await prisma.auditEvent.create({
        data: {
          workspaceId,
          actorId,
          action: "reserve.created",
          entityType: "NovaReserve",
          entityId: reserve.id,
          requestId,
          metadataJson: JSON.stringify({
            name: reserve.name,
            kind: reserve.kind,
            targetAmount: targetCents ? centsToDecimalString(targetCents) : null,
          }),
        },
      });

      return NextResponse.json({ ok: true, reserve, requestId }, { status: 201 });
    }

    if (action === "ALLOCATE_OR_RELEASE_RESERVE") {
      const { reserveId, movementKind, amountDecimal, reason } = body;
      const amountCents = decimalStringToCents(amountDecimal);
      if (amountCents <= 0) {
        throw new NovaDomainError(
          "VALIDATION_ERROR",
          "O valor da movimentação deve ser positivo.",
          422
        );
      }

      const fullState = await getWorkspaceFullState({
        workspaceId,
        userId: actorId,
      });
      const targetReserve = fullState.reserves.find((r) => r.id === reserveId);
      if (!targetReserve) {
        throw new NovaDomainError("NOT_FOUND", "Cofre não encontrado.", 404);
      }

      if (movementKind === "ALLOCATE") {
        if (
          fullState.kpis.totalAllocatedReservesCents + amountCents >
          fullState.kpis.eligibleBalanceCents
        ) {
          throw new NovaDomainError(
            "INSUFFICIENT_FREE_BALANCE",
            "Saldo livre insuficiente para esta alocação virtual. O total alocado nos cofres não pode ultrapassar o saldo bancário elegível.",
            409,
            {
              freeCash: centsToDecimalString(fullState.kpis.freeCashCents),
              requested: centsToDecimalString(amountCents),
            }
          );
        }
      } else if (movementKind === "RELEASE") {
        if (amountCents > targetReserve.allocatedCents) {
          throw new NovaDomainError(
            "VALIDATION_ERROR",
            "Não é possível liberar um valor superior ao saldo alocado neste cofre.",
            409
          );
        }
      }

      const mov = await prisma.novaReserveMovement.create({
        data: {
          workspaceId,
          reserveId,
          kind: movementKind === "RELEASE" ? "RELEASE" : "ALLOCATE",
          amountCents,
          idempotencyKey,
          actorId,
          reason:
            reason ||
            (movementKind === "RELEASE"
              ? "Liberação de reserva virtual"
              : "Alocação virtual de planejamento (sem transferência bancária)"),
        },
      });

      await prisma.auditEvent.create({
        data: {
          workspaceId,
          actorId,
          action:
            movementKind === "RELEASE" ? "reserve.released" : "reserve.allocated",
          entityType: "NovaReserve",
          entityId: reserveId,
          requestId,
          metadataJson: JSON.stringify({
            amount: centsToDecimalString(amountCents),
            note: "Movimento virtual de planejamento; saldo bancário inalterado.",
          }),
        },
      });

      return NextResponse.json(
        { ok: true, movement: mov, requestId },
        { status: 201 }
      );
    }

    // Transferência entre cofres em duas pernas atômicas (ambos validados no mesmo workspace!)
    if (action === "TRANSFER_RESERVE") {
      const { sourceReserveId, destinationReserveId, amountDecimal } = body;
      if (sourceReserveId === destinationReserveId) {
        throw new NovaDomainError(
          "VALIDATION_ERROR",
          "Cofre de origem e destino devem ser distintos.",
          422
        );
      }
      const amountCents = decimalStringToCents(amountDecimal);
      if (amountCents <= 0) {
        throw new NovaDomainError(
          "VALIDATION_ERROR",
          "O valor da transferência entre cofres deve ser positivo.",
          422
        );
      }
      const fullState = await getWorkspaceFullState({
        workspaceId,
        userId: actorId,
      });
      const src = fullState.reserves.find((r) => r.id === sourceReserveId);
      const dst = fullState.reserves.find((r) => r.id === destinationReserveId);
      if (!src || !dst) {
        throw new NovaDomainError(
          "NOT_FOUND",
          "Cofre de origem ou destino não pertence a este workspace.",
          404
        );
      }
      if (src.allocatedCents < amountCents) {
        throw new NovaDomainError(
          "VALIDATION_ERROR",
          "Saldo alocado insuficiente no cofre de origem.",
          409
        );
      }

      const tfGroup = `rtf_${Date.now()}`;
      await prisma.$transaction([
        prisma.novaReserveMovement.create({
          data: {
            workspaceId,
            reserveId: sourceReserveId,
            kind: "TRANSFER_OUT",
            amountCents,
            transferGroupId: tfGroup,
            idempotencyKey: `${idempotencyKey}_out`,
            actorId,
            reason: "Transferência entre cofres (saída)",
          },
        }),
        prisma.novaReserveMovement.create({
          data: {
            workspaceId,
            reserveId: destinationReserveId,
            kind: "TRANSFER_IN",
            amountCents,
            transferGroupId: tfGroup,
            idempotencyKey: `${idempotencyKey}_in`,
            actorId,
            reason: "Transferência entre cofres (entrada)",
          },
        }),
        prisma.auditEvent.create({
          data: {
            workspaceId,
            actorId,
            action: "reserve.transfer_allocated",
            entityType: "NovaReserve",
            entityId: sourceReserveId,
            requestId,
            metadataJson: JSON.stringify({
              sourceReserveId,
              destinationReserveId,
              amount: centsToDecimalString(amountCents),
            }),
          },
        }),
      ]);

      return NextResponse.json({ ok: true, transferGroupId: tfGroup, requestId });
    }

    // =========================================================================
    // ORÇAMENTOS, METAS, CENÁRIOS, CATEGORIAS E CONTRAPARTES (P02 + P10)
    // =========================================================================
    if (action === "CREATE_BUDGET") {
      const { categoryId, categoryName, costCenter, period, limitDecimal } = body;
      const limitCents = decimalStringToCents(limitDecimal);
      if (limitCents <= 0) {
        throw new NovaDomainError(
          "VALIDATION_ERROR",
          "Teto do orçamento deve ser positivo.",
          422
        );
      }
      const budget = await prisma.budget.create({
        data: {
          workspaceId,
          categoryId: categoryId || null,
          categoryName: String(categoryName || "Geral").trim(),
          costCenter: costCenter || null,
          period: period || today.slice(0, 7),
          limitCents,
        },
      });
      await prisma.auditEvent.create({
        data: {
          workspaceId,
          actorId,
          action: "budget.created",
          entityType: "Budget",
          entityId: budget.id,
          requestId,
          metadataJson: JSON.stringify({
            categoryName: budget.categoryName,
            limit: centsToDecimalString(limitCents),
          }),
        },
      });
      return NextResponse.json({ ok: true, budget, requestId }, { status: 201 });
    }

    if (action === "DELETE_BUDGET") {
      const { budgetId } = body;
      const existing = await prisma.budget.findFirst({
        where: { id: budgetId, workspaceId },
      });
      if (!existing) {
        throw new NovaDomainError(
          "NOT_FOUND",
          "Orçamento não encontrado.",
          404
        );
      }
      await prisma.budget.delete({ where: { id: existing.id } });
      await prisma.auditEvent.create({
        data: {
          workspaceId,
          actorId,
          action: "budget.deleted",
          entityType: "Budget",
          entityId: existing.id,
          requestId,
          metadataJson: JSON.stringify({ categoryName: existing.categoryName }),
        },
      });
      return NextResponse.json({ ok: true, requestId });
    }

    if (action === "CREATE_GOAL") {
      const { name, reserveId, targetAmountDecimal, targetOn, priority } = body;
      const targetAmountCents = decimalStringToCents(targetAmountDecimal);
      if (reserveId) {
        const resCheck = await prisma.novaReserve.findFirst({
          where: { id: reserveId, workspaceId },
        });
        if (!resCheck) {
          throw new NovaDomainError(
            "NOT_FOUND",
            "Cofre vinculado não pertence a este workspace.",
            404
          );
        }
      }
      const goal = await prisma.novaGoal.create({
        data: {
          workspaceId,
          reserveId: reserveId || null,
          name: String(name || "Meta Financeira").trim(),
          targetAmountCents,
          targetOn: targetOn || null,
          priority: Number(priority || 2),
          status: "ACTIVE",
        },
      });
      return NextResponse.json({ ok: true, goal, requestId }, { status: 201 });
    }

    if (action === "UPDATE_GOAL_STATUS") {
      const { goalId, status } = body;
      const existing = await prisma.novaGoal.findFirst({
        where: { id: goalId, workspaceId },
      });
      if (!existing) {
        throw new NovaDomainError("NOT_FOUND", "Meta não encontrada.", 404);
      }
      if (status === "DELETE") {
        await prisma.novaGoal.delete({ where: { id: existing.id } });
        return NextResponse.json({ ok: true, deleted: true, requestId });
      }
      const nextStatus = ["ACTIVE", "PAUSED", "ACHIEVED", "ARCHIVED"].includes(
        status
      )
        ? status
        : "ARCHIVED";
      const updated = await prisma.novaGoal.update({
        where: { id: existing.id },
        data: { status: nextStatus, version: { increment: 1 } },
      });
      return NextResponse.json({ ok: true, goal: updated, requestId });
    }

    if (action === "UPDATE_SAFETY_BUFFER") {
      const { safetyBufferDecimal } = body;
      const safetyBufferCents = decimalStringToCents(safetyBufferDecimal);
      const ws = await prisma.workspace.update({
        where: { id: workspaceId },
        data: {
          safetyBufferCents: Math.max(0, safetyBufferCents),
          version: { increment: 1 },
        },
      });
      await prisma.auditEvent.create({
        data: {
          workspaceId,
          actorId,
          action: "workspace.safety_buffer_updated",
          entityType: "Workspace",
          entityId: workspaceId,
          requestId,
          metadataJson: JSON.stringify({
            safetyBuffer: centsToDecimalString(safetyBufferCents),
          }),
        },
      });
      return NextResponse.json({ ok: true, workspace: ws, requestId });
    }

    if (action === "UPDATE_SCENARIO") {
      const {
        scenarioKind,
        contingencyBufferPct,
        hypotheticalInflowDecimal,
        hypotheticalOutflowDecimal,
      } = body;
      const existing = await prisma.novaPlanningScenario.findFirst({
        where: { workspaceId, kind: scenarioKind },
      });
      if (existing) {
        await prisma.novaPlanningScenario.update({
          where: { id: existing.id },
          data: {
            contingencyBufferPct: Number(contingencyBufferPct ?? 0),
            hypotheticalInflowCents: decimalStringToCents(
              hypotheticalInflowDecimal || "0"
            ),
            hypotheticalOutflowCents: decimalStringToCents(
              hypotheticalOutflowDecimal || "0"
            ),
            version: { increment: 1 },
          },
        });
      } else {
        await prisma.novaPlanningScenario.create({
          data: {
            workspaceId,
            name: `Cenário ${scenarioKind || "BASE"}`,
            kind: scenarioKind || "BASE",
            contingencyBufferPct: Number(contingencyBufferPct ?? 0),
            hypotheticalInflowCents: decimalStringToCents(
              hypotheticalInflowDecimal || "0"
            ),
            hypotheticalOutflowCents: decimalStringToCents(
              hypotheticalOutflowDecimal || "0"
            ),
            createdBy: actorId,
          },
        });
      }
      return NextResponse.json({ ok: true, requestId });
    }

    if (action === "CREATE_CATEGORY") {
      const { name, type, isEssential } = body;
      if (!String(name || "").trim()) {
        throw new NovaDomainError(
          "VALIDATION_ERROR",
          "Nome da categoria é obrigatório.",
          422
        );
      }
      const cat = await prisma.category.create({
        data: {
          workspaceId,
          name: String(name).trim(),
          type: type === "INCOME" ? "INCOME" : "EXPENSE",
          isEssential: isEssential !== false,
        },
      });
      return NextResponse.json(
        { ok: true, category: cat, requestId },
        { status: 201 }
      );
    }

    if (action === "ARCHIVE_CATEGORY") {
      const { categoryId } = body;
      const existing = await prisma.category.findFirst({
        where: { id: categoryId, workspaceId },
      });
      if (!existing) {
        throw new NovaDomainError(
          "NOT_FOUND",
          "Categoria não encontrada.",
          404
        );
      }
      await prisma.category.update({
        where: { id: existing.id },
        data: { archivedAt: new Date() },
      });
      return NextResponse.json({ ok: true, requestId });
    }

    if (action === "CREATE_COUNTERPARTY") {
      const { name, type, document, costCenter } = body;
      if (!String(name || "").trim()) {
        throw new NovaDomainError(
          "VALIDATION_ERROR",
          "Nome do cliente/fornecedor é obrigatório.",
          422
        );
      }
      const cp = await prisma.counterparty.create({
        data: {
          workspaceId,
          name: String(name).trim(),
          type: type === "PERSON" ? "PERSON" : "COMPANY",
          document: document ? String(document).trim() : null,
          costCenter: costCenter ? String(costCenter).trim() : null,
        },
      });
      await prisma.auditEvent.create({
        data: {
          workspaceId,
          actorId,
          action: "counterparty.created",
          entityType: "Counterparty",
          entityId: cp.id,
          requestId,
          metadataJson: JSON.stringify({ name: cp.name, type: cp.type }),
        },
      });
      return NextResponse.json(
        { ok: true, counterparty: cp, requestId },
        { status: 201 }
      );
    }

    if (action === "DELETE_COUNTERPARTY") {
      const { counterpartyId } = body;
      const existing = await prisma.counterparty.findFirst({
        where: { id: counterpartyId, workspaceId },
      });
      if (!existing) {
        throw new NovaDomainError(
          "NOT_FOUND",
          "Contraparte não encontrada.",
          404
        );
      }
      await prisma.counterparty.delete({ where: { id: existing.id } });
      return NextResponse.json({ ok: true, requestId });
    }

    // =========================================================================
    // PACOTE 03 + PACOTE 10: POSIÇÕES DE INVESTIMENTO E RESGATE INTEGRADO
    // =========================================================================
    if (action === "CREATE_INVESTMENT_POSITION") {
      const {
        symbol,
        name,
        kind,
        institution,
        indexer,
        rateLabel,
        costBasisCents,
        currentGrossCents,
        costBasisReais,
        currentGrossReais,
        daysHeld,
        redemptionAvailableAt,
        maturityDate,
      } = body;

      const resolvedCostCents =
        costBasisCents !== undefined
          ? Math.max(0, Math.round(Number(costBasisCents)))
          : Math.max(0, Math.round(Number(costBasisReais || 0) * 100));

      const resolvedGrossCents =
        currentGrossCents !== undefined
          ? Math.max(0, Math.round(Number(currentGrossCents)))
          : Math.max(0, Math.round(Number(currentGrossReais || 0) * 100));

      if (resolvedCostCents <= 0 && resolvedGrossCents <= 0) {
        throw new NovaDomainError(
          "VALIDATION_ERROR",
          "Informe um valor de custo ou saldo bruto positivo para a posição.",
          422
        );
      }

      const pos = await prisma.novaInvestmentPosition.create({
        data: {
          workspaceId,
          symbol: symbol || kind || "CDB",
          name: String(name || "Ativo de Renda Fixa").trim(),
          kind: kind || "CDB",
          institution: institution || "Custódia B3 / Banco",
          indexer: indexer || "CDI/SELIC",
          rateLabel: rateLabel || "100% CDI",
          costBasisCents: resolvedCostCents,
          currentGrossCents:
            resolvedGrossCents > 0 ? resolvedGrossCents : resolvedCostCents,
          daysHeld: Number(daysHeld || 365),
          redemptionAvailableAt: redemptionAvailableAt || today,
          maturityDate: maturityDate || addMonthsIso(today, 24),
          fgcEligible: kind === "CDB" || kind === "LCI" || kind === "LCA",
          quoteStatus: "VALID",
        },
      });

      await prisma.auditEvent.create({
        data: {
          workspaceId,
          actorId,
          action: "investment.position_created",
          entityType: "NovaInvestmentPosition",
          entityId: pos.id,
          requestId,
          metadataJson: JSON.stringify({
            name: pos.name,
            kind: pos.kind,
            cost: centsToDecimalString(pos.costBasisCents),
            gross: centsToDecimalString(pos.currentGrossCents),
          }),
        },
      });

      return NextResponse.json(
        { ok: true, position: pos, requestId },
        { status: 201 }
      );
    }

    if (action === "REDEEM_OR_UPDATE_INVESTMENT") {
      const {
        positionId,
        subAction = "UPDATE_QUOTE",
        newGrossDecimal,
        daysHeld,
        targetAccountId,
        redeemGrossDecimal,
      } = body;

      const pos = await prisma.novaInvestmentPosition.findFirst({
        where: { id: positionId, workspaceId },
      });
      if (!pos) {
        throw new NovaDomainError(
          "NOT_FOUND",
          "Posição de investimento não encontrada.",
          404
        );
      }

      if (subAction === "DELETE") {
        await prisma.novaInvestmentPosition.delete({ where: { id: pos.id } });
        await prisma.auditEvent.create({
          data: {
            workspaceId,
            actorId,
            action: "investment.position_deleted",
            entityType: "NovaInvestmentPosition",
            entityId: pos.id,
            requestId,
            metadataJson: JSON.stringify({ name: pos.name }),
          },
        });
        return NextResponse.json({ ok: true, deleted: true, requestId });
      }

      if (subAction === "UPDATE_QUOTE") {
        const nextGrossCents = decimalStringToCents(
          newGrossDecimal ?? centsToDecimalString(pos.currentGrossCents)
        );
        if (nextGrossCents < 0) {
          throw new NovaDomainError(
            "VALIDATION_ERROR",
            "Saldo bruto não pode ser negativo.",
            422
          );
        }
        const updated = await prisma.novaInvestmentPosition.update({
          where: { id: pos.id },
          data: {
            currentGrossCents: nextGrossCents,
            daysHeld:
              daysHeld !== undefined ? Number(daysHeld) : pos.daysHeld,
            quoteStatus: "VALID",
          },
        });
        await prisma.auditEvent.create({
          data: {
            workspaceId,
            actorId,
            action: "investment.quote_updated",
            entityType: "NovaInvestmentPosition",
            entityId: pos.id,
            requestId,
            metadataJson: JSON.stringify({
              previousGross: centsToDecimalString(pos.currentGrossCents),
              newGross: centsToDecimalString(nextGrossCents),
            }),
          },
        });
        return NextResponse.json({ ok: true, position: updated, requestId });
      }

      // subAction === "REDEEM": Resgate total ou parcial creditando conta bancária do workspace
      await assertAccountInWorkspace(prisma, workspaceId, targetAccountId);
      const ws = await prisma.workspace.findUnique({
        where: { id: workspaceId },
      });

      const requestedGrossCents = redeemGrossDecimal
        ? decimalStringToCents(redeemGrossDecimal)
        : pos.currentGrossCents;

      if (
        requestedGrossCents <= 0 ||
        requestedGrossCents > pos.currentGrossCents
      ) {
        throw new NovaDomainError(
          "VALIDATION_ERROR",
          "Valor de resgate inválido ou superior ao saldo bruto da posição.",
          422
        );
      }

      const ratio = requestedGrossCents / Math.max(1, pos.currentGrossCents);
      const proportionalCostCents = Math.round(pos.costBasisCents * ratio);
      const isExemptPF =
        (pos.kind === "LCI" || pos.kind === "LCA") && ws?.type === "PERSONAL";

      const netRedemptionCents = isExemptPF
        ? requestedGrossCents
        : Math.round(
            taxableFixedIncomeRedemption({
              principal: proportionalCostCents / 100,
              grossRedemption: requestedGrossCents / 100,
              days: Math.max(30, pos.daysHeld),
            }).netRedemption * 100
          );

      const principalReturnCents = Math.min(
        netRedemptionCents,
        proportionalCostCents
      );
      const netYieldCents = Math.max(
        0,
        netRedemptionCents - principalReturnCents
      );
      const dtObj = new Date(`${today}T00:00:00Z`);

      await prisma.$transaction(async (tx) => {
        if (principalReturnCents > 0) {
          await tx.transaction.create({
            data: {
              workspaceId,
              accountId: targetAccountId,
              kind: "TRANSFER_IN",
              status: "SETTLED",
              amountCents: principalReturnCents,
              signedCents: BigInt(principalReturnCents),
              date: dtObj,
              dueDate: dtObj,
              occurredOn: today,
              settledOn: today,
              settledAt: new Date(),
              description: `Resgate Principal — ${pos.name}`,
              createdBy: actorId,
              idempotencyKey: `${idempotencyKey}_prin`,
            },
          });
        }

        if (netYieldCents > 0) {
          await tx.transaction.create({
            data: {
              workspaceId,
              accountId: targetAccountId,
              kind: "INCOME",
              status: "SETTLED",
              amountCents: netYieldCents,
              signedCents: BigInt(netYieldCents),
              date: dtObj,
              dueDate: dtObj,
              occurredOn: today,
              settledOn: today,
              settledAt: new Date(),
              description: `Rendimento Líquido Pós-IR — ${pos.name}`,
              createdBy: actorId,
              idempotencyKey: `${idempotencyKey}_yield`,
            },
          });
        }

        const remainingGross = pos.currentGrossCents - requestedGrossCents;
        const remainingCost = Math.max(
          0,
          pos.costBasisCents - proportionalCostCents
        );

        if (remainingGross <= 0) {
          await tx.novaInvestmentPosition.delete({ where: { id: pos.id } });
        } else {
          await tx.novaInvestmentPosition.update({
            where: { id: pos.id },
            data: {
              costBasisCents: remainingCost,
              currentGrossCents: remainingGross,
              quoteStatus: "VALID",
            },
          });
        }

        await tx.auditEvent.create({
          data: {
            workspaceId,
            actorId,
            action: "investment.redeemed",
            entityType: "NovaInvestmentPosition",
            entityId: pos.id,
            requestId,
            metadataJson: JSON.stringify({
              name: pos.name,
              grossRedeemed: centsToDecimalString(requestedGrossCents),
              netCredited: centsToDecimalString(netRedemptionCents),
              targetAccountId,
            }),
          },
        });
      });

      return NextResponse.json({
        ok: true,
        netCreditedCents: netRedemptionCents,
        requestId,
      });
    }

    if (action === "CLEAR_INVESTMENTS") {
      await prisma.novaInvestmentPosition.deleteMany({ where: { workspaceId } });
      await prisma.auditEvent.create({
        data: {
          workspaceId,
          actorId,
          action: "investment.positions_cleared",
          entityType: "Workspace",
          entityId: workspaceId,
          requestId,
          metadataJson: JSON.stringify({
            note: "Carteira P03 zerada para R$ 0,00",
          }),
        },
      });
      return NextResponse.json({ ok: true, requestId });
    }

    // =========================================================================
    // PACOTE 04 + PACOTE 11: CONEXÕES, CONSENTIMENTOS, CSV/OFX E CONCILIAÇÃO
    // =========================================================================
    if (action === "GRANT_CONNECTION_CONSENT") {
      const { connectionId, providerId, institutionName, scopes } = body;
      const consentId = `consent_${Date.now()}`;
      const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
      const scopesArr = Array.isArray(scopes)
        ? scopes
        : ["ACCOUNTS_READ", "BALANCES_READ", "TRANSACTIONS_READ"];

      let targetConn = connectionId
        ? await prisma.financialConnection.findFirst({
            where: { id: String(connectionId), workspaceId },
          })
        : null;

      if (!targetConn && providerId) {
        targetConn = await prisma.financialConnection.findFirst({
          where: { workspaceId, providerCode: String(providerId) },
        });
      }

      if (!targetConn && providerId) {
        targetConn = await prisma.financialConnection.create({
          data: {
            workspaceId,
            providerCode: String(providerId),
            institutionName: String(
              institutionName || providerId || "Open Finance Read-Only"
            ),
            status: "DISCONNECTED",
          },
        });
      }

      if (!targetConn) {
        throw new NovaDomainError(
          "NOT_FOUND",
          "Conexão financeira não encontrada neste workspace.",
          404
        );
      }

      const updated = await prisma.financialConnection.update({
        where: { id: targetConn.id },
        data: {
          status: "ACTIVE",
          consentId,
          consentScopes: scopesArr.join(", "),
          consentExpiresAt: expiresAt,
          lastSyncAt: new Date(),
        },
      });

      await prisma.financialConsentAudit.create({
        data: {
          workspaceId,
          connectionId: updated.id,
          actorId,
          action: "GRANTED",
          scopesJson: scopesArr.join(", "),
          requestId,
        },
      });

      await prisma.auditEvent.create({
        data: {
          workspaceId,
          actorId,
          action: "connection.consent_granted",
          entityType: "FinancialConnection",
          entityId: updated.id,
          requestId,
          metadataJson: JSON.stringify({
            providerCode: updated.providerCode,
            consentId,
            scopes: scopesArr,
          }),
        },
      });

      return NextResponse.json({ ok: true, connection: updated, requestId });
    }

    if (action === "REVOKE_CONNECTION_CONSENT") {
      const { connectionId } = body;
      const existingConn = await prisma.financialConnection.findFirst({
        where: { id: String(connectionId || ""), workspaceId },
      });
      if (!existingConn) {
        throw new NovaDomainError(
          "NOT_FOUND",
          "Conexão financeira não encontrada neste workspace.",
          404
        );
      }

      const updated = await prisma.financialConnection.update({
        where: { id: existingConn.id },
        data: {
          status: "REVOKED",
          consentExpiresAt: new Date(),
        },
      });

      await prisma.financialConsentAudit.create({
        data: {
          workspaceId,
          connectionId: updated.id,
          actorId,
          action: "REVOKED",
          scopesJson: updated.consentScopes || "ACCOUNTS_READ",
          requestId,
        },
      });

      await prisma.auditEvent.create({
        data: {
          workspaceId,
          actorId,
          action: "connection.consent_revoked",
          entityType: "FinancialConnection",
          entityId: updated.id,
          requestId,
          metadataJson: JSON.stringify({
            providerCode: updated.providerCode,
            status: "REVOKED",
          }),
        },
      });

      return NextResponse.json({ ok: true, connection: updated, requestId });
    }

    // Importação Manual CSV/OFX em Staging com Deduplicação SHA-256 por (workspace, provider, account, externalId)
    if (action === "STAGE_CSV_IMPORT") {
      const {
        csvContent,
        rows: inputRows,
        fileName = "extrato-importado.csv",
        providerId = "MANUAL_CSV",
        accountExternalId = "ACC_PRINCIPAL",
      } = body;

      const rawText = String(csvContent || "").trim();
      const parsedRows: ParsedImportRow[] = [];
      let errorCount = 0;

      const isOfx =
        String(fileName).toLowerCase().endsWith(".ofx") ||
        rawText.toUpperCase().includes("<STMTTRN>");

      if (Array.isArray(inputRows) && inputRows.length > 0) {
        for (let idx = 0; idx < inputRows.length; idx++) {
          const r = inputRows[idx] as Record<string, unknown>;
          try {
            const postedOnRaw = String(
              r.occurredAt || r.postedOn || today
            ).slice(0, 10);
            const postedOn = /^\d{4}-\d{2}-\d{2}$/.test(postedOnRaw)
              ? postedOnRaw
              : today;
            const amountCents =
              r.amountCents !== undefined
                ? Math.abs(Math.round(Number(r.amountCents)))
                : Math.abs(
                    decimalStringToCents(String(r.amountDecimal || "0"))
                  );
            if (amountCents <= 0) {
              errorCount++;
              continue;
            }
            const description = String(
              r.description || `Item Importado #${idx + 1}`
            ).trim();
            const rawDir = String(r.direction || "DEBIT").toUpperCase();
            const lowerDesc = description.toLowerCase();
            const isSelfTransfer =
              rawDir === "SELF_TRANSFER" ||
              lowerDesc.includes("mesma titularidade") ||
              lowerDesc.includes("transferencia propria") ||
              lowerDesc.includes("entre contas proprias");
            const direction: ParsedImportRow["direction"] = isSelfTransfer
              ? "SELF_TRANSFER"
              : rawDir === "CREDIT" || rawDir === "INCOME"
              ? "CREDIT"
              : "DEBIT";
            const externalId = String(
              r.externalId ||
                `ext_${postedOn}_${amountCents}_${description.slice(0, 14)}`
            ).trim();

            parsedRows.push({
              externalId,
              postedOn,
              amountCents,
              direction,
              description,
            });
          } catch {
            errorCount++;
          }
        }
      } else if (isOfx && rawText) {
        parsedRows.push(...parseOfxTransactions(rawText, today));
      } else if (rawText) {
        const lines = rawText
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(
            (l) =>
              l.length > 0 &&
              !l.toLowerCase().startsWith("data,") &&
              !l.toLowerCase().startsWith("data;") &&
              !l.toLowerCase().startsWith("date,")
          );

        for (let idx = 0; idx < lines.length; idx++) {
          const delimiter =
            lines[idx].includes(";") && !lines[idx].includes(",") ? ";" : ",";
          const parts = lines[idx].split(delimiter).map((p) => p.trim());
          try {
            let postedOn = today;
            if (/^\d{4}-\d{2}-\d{2}$/.test(parts[0] || "")) {
              postedOn = parts[0];
            } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(parts[0] || "")) {
              const [dd, mm, yyyy] = parts[0].split("/");
              postedOn = `${yyyy}-${mm}-${dd}`;
            }
            const description = parts[1] || `Item Importado #${idx + 1}`;
            const rawAmount = decimalStringToCents(parts[2] || "0");
            if (rawAmount === 0) {
              errorCount++;
              continue;
            }
            const amountCents = Math.abs(rawAmount);
            const rawDir = (
              parts[3] || (rawAmount < 0 ? "DEBIT" : "CREDIT")
            ).toUpperCase();
            const lowerDesc = description.toLowerCase();
            const isSelfTransfer =
              rawDir === "SELF_TRANSFER" ||
              lowerDesc.includes("mesma titularidade") ||
              lowerDesc.includes("transferencia propria") ||
              lowerDesc.includes("entre contas proprias");
            const direction: ParsedImportRow["direction"] = isSelfTransfer
              ? "SELF_TRANSFER"
              : rawDir === "CREDIT" || rawDir === "INCOME"
              ? "CREDIT"
              : "DEBIT";
            const externalId =
              parts[4] ||
              `ext_${postedOn}_${amountCents}_${description.slice(0, 12)}`;

            parsedRows.push({
              externalId,
              postedOn,
              amountCents,
              direction,
              description,
            });
          } catch {
            errorCount++;
          }
        }
      } else {
        throw new NovaDomainError(
          "VALIDATION_ERROR",
          "Forneça um arquivo CSV/OFX ou linhas válidas para importação.",
          422
        );
      }

      const checksumSource =
        rawText || JSON.stringify(parsedRows.map((r) => r.externalId));
      const inputChecksum = createHash("sha256")
        .update(checksumSource)
        .digest("hex");

      const batch = await prisma.importBatch.create({
        data: {
          workspaceId,
          sourceType: isOfx ? "OFX" : "CSV",
          fileName: String(fileName),
          state: "REVIEWING",
          inputChecksum,
          createdBy: actorId,
        },
      });

      let stagedCount = 0;
      let duplicateCount = 0;

      for (const r of parsedRows) {
        const dedupeHash = createHash("sha256")
          .update(
            `${workspaceId}|${providerId}|${accountExternalId}|${r.externalId}`
          )
          .digest("hex");

        const existingExt =
          await prisma.importedExternalTransaction.findUnique({
            where: {
              workspaceId_providerId_accountExternalId_externalId: {
                workspaceId,
                providerId: String(providerId),
                accountExternalId: String(accountExternalId),
                externalId: r.externalId,
              },
            },
          });

        if (existingExt) {
          duplicateCount++;
          continue;
        }

        await prisma.importedExternalTransaction.create({
          data: {
            workspaceId,
            providerId: String(providerId),
            accountExternalId: String(accountExternalId),
            externalId: r.externalId,
            postedOn: r.postedOn,
            amountCents: r.amountCents,
            direction: r.direction,
            description: r.description,
            rawHash: dedupeHash,
            importBatchId: batch.id,
            state: "STAGED",
          },
        });
        stagedCount++;
      }

      await prisma.auditEvent.create({
        data: {
          workspaceId,
          actorId,
          action: "import.batch_staged",
          entityType: "ImportBatch",
          entityId: batch.id,
          requestId,
          metadataJson: JSON.stringify({
            fileName,
            stagedCount,
            duplicateCount,
            errorCount,
          }),
        },
      });

      return NextResponse.json(
        {
          ok: true,
          batchId: batch.id,
          stagedCount,
          duplicateCount,
          errorCount,
          requestId,
        },
        { status: 202 }
      );
    }

    // Conciliação de item importado: Aprovar para o Ledger P01, Vincular a Compromisso Existente ou Ignorar
    if (action === "RECONCILE_IMPORTED_ROW") {
      const rowId = String(body.importedRowId || body.importedTxId || "");
      const { decision, targetAccountId, matchKind, matchId } = body;

      const item = await prisma.importedExternalTransaction.findFirst({
        where: { id: rowId, workspaceId },
      });
      if (!item) {
        throw new NovaDomainError(
          "NOT_FOUND",
          "Item importado não encontrado neste workspace.",
          404
        );
      }

      if (decision === "IGNORE") {
        await prisma.importedExternalTransaction.update({
          where: { id: item.id },
          data: { state: "IGNORED" },
        });
        return NextResponse.json({ ok: true, state: "IGNORED", requestId });
      }

      // Garante que a conta destino pertença estritamente ao workspace atual
      let accId = targetAccountId ? String(targetAccountId) : "";
      if (accId) {
        await assertAccountInWorkspace(prisma, workspaceId, accId);
      } else {
        const firstAcc = await prisma.account.findFirst({
          where: { workspaceId, status: "ACTIVE" },
        });
        if (!firstAcc) {
          const createdAcc = await prisma.account.create({
            data: {
              workspaceId,
              name: "Conta Corrente Conciliada",
              type: "CHECKING",
              openingBalanceCents: 0,
              openingCents: 0n,
              openingBalanceDate: today,
              status: "ACTIVE",
            },
          });
          accId = createdAcc.id;
        } else {
          accId = firstAcc.id;
        }
      }

      // Conciliação inteligente vinculando a lançamento PENDING ou parcela OPEN existente (sem duplicar!)
      if (decision === "MATCH_EXISTING" && matchId) {
        if (matchKind === "TRANSACTION") {
          const existingPending = await prisma.transaction.findFirst({
            where: { id: String(matchId), workspaceId },
          });
          if (!existingPending) {
            throw new NovaDomainError(
              "NOT_FOUND",
              "Lançamento previsto não encontrado.",
              404
            );
          }
          const settledTx = await prisma.transaction.update({
            where: { id: existingPending.id },
            data: {
              status: "SETTLED",
              settledOn: item.postedOn,
              settledAt: new Date(),
              version: { increment: 1 },
            },
          });
          await prisma.importedExternalTransaction.update({
            where: { id: item.id },
            data: {
              state: "IMPORTED",
              matchedLedgerEntryId: settledTx.id,
            },
          });
          return NextResponse.json({
            ok: true,
            state: "IMPORTED",
            ledgerTransactionId: settledTx.id,
            matchedExisting: true,
            requestId,
          });
        }

        if (matchKind === "INSTALLMENT") {
          const matched = await prisma.$transaction(async (tx) => {
            const inst = await tx.novaInstallment.findFirst({
              where: { id: String(matchId), workspaceId },
              include: { obligation: true, settlements: true },
            });
            if (!inst) {
              throw new NovaDomainError(
                "NOT_FOUND",
                "Parcela não encontrada.",
                404
              );
            }
            const txKind =
              inst.obligation.direction === "RECEIVABLE" ? "INCOME" : "EXPENSE";
            const signedBig =
              txKind === "EXPENSE"
                ? -BigInt(item.amountCents)
                : BigInt(item.amountCents);
            const dtObj = new Date(`${item.postedOn}T00:00:00Z`);

            const p01Tx = await tx.transaction.create({
              data: {
                workspaceId,
                accountId: accId,
                categoryId: inst.obligation.categoryId,
                counterpartyId: inst.obligation.counterpartyId,
                kind: txKind,
                status: "SETTLED",
                amountCents: item.amountCents,
                signedCents: signedBig,
                date: dtObj,
                dueDate: new Date(`${inst.dueOn}T00:00:00Z`),
                occurredOn: item.postedOn,
                dueOn: inst.dueOn,
                settledOn: item.postedOn,
                settledAt: new Date(),
                description: `Conciliação ${inst.obligation.title} (${inst.number})`,
                createdBy: actorId,
                idempotencyKey: `imp_match_${item.id}`,
              },
            });

            await tx.novaSettlement.create({
              data: {
                workspaceId,
                installmentId: inst.id,
                transactionId: p01Tx.id,
                accountId: accId,
                amountCents: item.amountCents,
                settledOn: item.postedOn,
                note: `Conciliado via extrato (${item.externalId})`,
                idempotencyKey: `imp_set_${item.id}`,
              },
            });

            const alreadyPaid = inst.settlements.reduce(
              (s, st) => s + st.amountCents,
              0
            );
            const nextStatus =
              alreadyPaid + item.amountCents >= inst.amountCents
                ? "PAID"
                : "PARTIAL";

            await tx.novaInstallment.update({
              where: { id: inst.id },
              data: { status: nextStatus },
            });

            await tx.importedExternalTransaction.update({
              where: { id: item.id },
              data: {
                state: "IMPORTED",
                matchedLedgerEntryId: p01Tx.id,
              },
            });

            return p01Tx.id;
          });

          return NextResponse.json({
            ok: true,
            state: "IMPORTED",
            ledgerTransactionId: matched,
            matchedExisting: true,
            requestId,
          });
        }
      }

      // Regra P04: nunca criar receita ao importar uma transferência própria!
      const kind =
        item.direction === "SELF_TRANSFER"
          ? "TRANSFER_IN"
          : item.direction === "CREDIT"
          ? "INCOME"
          : "EXPENSE";
      const signedBig =
        kind === "EXPENSE" ? -BigInt(item.amountCents) : BigInt(item.amountCents);
      const dtObj = new Date(`${item.postedOn}T00:00:00Z`);

      const ledgerTx = await prisma.transaction.create({
        data: {
          workspaceId,
          accountId: accId,
          kind,
          status: "SETTLED",
          amountCents: item.amountCents,
          signedCents: signedBig,
          date: dtObj,
          dueDate: dtObj,
          occurredOn: item.postedOn,
          dueOn: item.postedOn,
          settledOn: item.postedOn,
          settledAt: new Date(),
          description: item.description,
          createdBy: actorId,
          idempotencyKey: `imp_${item.id}`,
        },
      });

      await prisma.importedExternalTransaction.update({
        where: { id: item.id },
        data: {
          state: "IMPORTED",
          matchedLedgerEntryId: ledgerTx.id,
        },
      });

      await prisma.auditEvent.create({
        data: {
          workspaceId,
          actorId,
          action: "import.row_reconciled",
          entityType: "ImportedExternalTransaction",
          entityId: item.id,
          requestId,
          metadataJson: JSON.stringify({
            ledgerTransactionId: ledgerTx.id,
            kind,
            amount: centsToDecimalString(item.amountCents),
          }),
        },
      });

      return NextResponse.json({
        ok: true,
        state: "IMPORTED",
        ledgerTransactionId: ledgerTx.id,
        requestId,
      });
    }

    if (action === "ACKNOWLEDGE_INSIGHT") {
      const { insightId, newState = "READ", status, code, title, summary } = body;
      const rawTarget = String(status || newState);
      const mappedDbState =
        rawTarget === "ACKNOWLEDGED" || rawTarget === "READ"
          ? "READ"
          : rawTarget === "DISMISSED"
          ? "DISMISSED"
          : rawTarget === "RESOLVED" || rawTarget === "COMPLETED"
          ? "COMPLETED"
          : "READ";

      const updatedCount = await prisma.financialInsight.updateMany({
        where: { id: String(insightId), workspaceId },
        data: { state: mappedDbState },
      });

      // Se era um insight dinâmico ainda não persistido, materializa-o com o novo estado
      if (updatedCount.count === 0 && String(insightId).startsWith("dyn_ins_")) {
        const inferredCode = String(
          code || String(insightId).replace("dyn_ins_", "").toUpperCase()
        );
        await prisma.financialInsight.upsert({
          where: {
            workspaceId_dedupeKey: {
              workspaceId,
              dedupeKey: `dyn_${inferredCode}_${today}`,
            },
          },
          update: { state: mappedDbState },
          create: {
            workspaceId,
            code: inferredCode,
            severity: "MEDIUM",
            state: mappedDbState,
            title: String(title || "Diagnóstico Reconhecido"),
            explanation: String(summary || "Insight avaliado pelo usuário."),
            evidenceJson: "{}",
            dedupeKey: `dyn_${inferredCode}_${today}`,
          },
        });
      }

      return NextResponse.json({ ok: true, requestId });
    }

    if (action === "SET_WORKSPACE_RECONCILED") {
      const { reconciled } = body;
      const ws = await prisma.workspace.update({
        where: { id: workspaceId },
        data: {
          reconciled: Boolean(reconciled),
          version: { increment: 1 },
        },
      });
      await prisma.auditEvent.create({
        data: {
          workspaceId,
          actorId,
          action: "workspace.reconciled_toggled",
          entityType: "Workspace",
          entityId: workspaceId,
          requestId,
          metadataJson: JSON.stringify({ reconciled: ws.reconciled }),
        },
      });
      return NextResponse.json({
        ok: true,
        reconciled: ws.reconciled,
        requestId,
      });
    }

    throw new NovaDomainError(
      "VALIDATION_ERROR",
      `Ação inválida: ${action}`,
      400
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { code: err.code, message: err.message, details: {}, requestId },
        { status: err.status }
      );
    }
    if (err instanceof NovaDomainError) {
      return NextResponse.json(
        {
          code: err.code,
          message: err.message,
          details: err.details ?? {},
          requestId,
        },
        { status: err.status }
      );
    }
    console.error("POST /api/platform error:", err);
    return NextResponse.json(
      {
        code: "INTERNAL_ERROR",
        message: "Erro ao processar comando financeiro.",
        details: {},
        requestId,
      },
      { status: 500 }
    );
  }
}
