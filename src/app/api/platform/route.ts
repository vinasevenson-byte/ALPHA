import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  addDaysIso,
  authorizeWorkspaceAccess,
  ensureBaseWorkspaces,
  getWorkspaceFullState,
  NovaDomainError,
  todayIso,
} from "@/lib/nova-service";
import {
  centsToDecimalString,
  decimalStringToCents,
  remainingInstallment,
  splitInstallmentsExact,
} from "@/domain/planning";

function makeRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}

export async function GET(req: NextRequest) {
  const requestId = makeRequestId();
  try {
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get("workspaceId") ?? undefined;
    const horizonDays = Number(searchParams.get("horizonDays") ?? 30);
    const scenarioKind = (searchParams.get("scenario") ?? "BASE") as
      | "BASE"
      | "CONSERVATIVE"
      | "OPTIMISTIC";

    const state = await getWorkspaceFullState({
      workspaceId,
      horizonDays,
      scenarioKind,
    });

    return NextResponse.json(
      { ...state, requestId },
      { headers: { "X-Request-Id": requestId } }
    );
  } catch (err) {
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
    await ensureBaseWorkspaces();
    const body = await req.json();
    const { action, workspaceId } = body;
    const idempotencyKey =
      req.headers.get("Idempotency-Key") ||
      body.idempotencyKey ||
      `idem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const actorId = "usr-nova-owner";
    const today = todayIso();

    // =========================================================================
    // AÇÃO ESPECIAL 1: ZERAR WORKSPACE (ESTADO INICIAL EM ZERO R$ 0,00 P01/P02/P03/P04)
    // =========================================================================
    if (action === "RESET_TO_ZERO") {
      if (!workspaceId) {
        throw new NovaDomainError("VALIDATION_ERROR", "workspaceId obrigatório", 422);
      }
      await prisma.$transaction([
        prisma.financialInsight.deleteMany({ where: { workspaceId } }),
        prisma.importedExternalTransaction.deleteMany({ where: { workspaceId } }),
        prisma.importBatch.deleteMany({ where: { workspaceId } }),
        prisma.financialConsentAudit.deleteMany({ where: { workspaceId } }),
        prisma.financialConnection.updateMany({
          where: { workspaceId },
          data: {
            status: "DISCONNECTED",
            consentId: null,
            consentExpiresAt: null,
            lastSyncAt: null,
          },
        }),
        prisma.novaInvestmentPosition.deleteMany({ where: { workspaceId } }),
        prisma.novaAlert.deleteMany({ where: { workspaceId } }),
        prisma.novaGoal.deleteMany({ where: { workspaceId } }),
        prisma.novaReserveMovement.deleteMany({ where: { workspaceId } }),
        prisma.novaReserve.deleteMany({ where: { workspaceId } }),
        prisma.novaSettlement.deleteMany({ where: { workspaceId } }),
        prisma.novaInstallment.deleteMany({ where: { workspaceId } }),
        prisma.novaObligation.deleteMany({ where: { workspaceId } }),
        prisma.budget.deleteMany({ where: { workspaceId } }),
        prisma.recurrence.deleteMany({ where: { workspaceId } }),
        prisma.transaction.deleteMany({ where: { workspaceId } }),
        prisma.account.deleteMany({ where: { workspaceId } }),
        prisma.workspace.update({
          where: { id: workspaceId },
          data: { safetyBufferCents: 0, version: { increment: 1 } },
        }),
        prisma.auditEvent.create({
          data: {
            workspaceId,
            actorId,
            action: "workspace.reset_to_zero",
            entityType: "Workspace",
            entityId: workspaceId,
            requestId,
            metadataJson: JSON.stringify({ note: "Retorno ao estado inicial R$ 0,00 (P01–P04)" }),
          },
        }),
      ]);
      return NextResponse.json({ ok: true, requestId });
    }

    // =========================================================================
    // AÇÃO ESPECIAL 2: CARREGAR FIXTURE DE HOMOLOGAÇÃO INTEGRADA P01 + P02 + P03 + P04
    // Reproduz exatamente o cenário canônico:
    // Saldo atual = R$ 10.000,00 | Menor saldo projetado = R$ 7.000,00
    // Margem de segurança = R$ 2.000,00 | Reservas existentes = R$ 1.000,00
    // Capacidade adicional estimada para reservar (headroom) = R$ 4.000,00
    // + Carteira P03 persistida (R$ 41.090,00 brutos) + Insights P04 com evidências
    // =========================================================================
    if (action === "LOAD_P02_FIXTURE") {
      if (!workspaceId) {
        throw new NovaDomainError("VALIDATION_ERROR", "workspaceId obrigatório", 422);
      }
      await prisma.$transaction(async (tx) => {
        await tx.financialInsight.deleteMany({ where: { workspaceId } });
        await tx.importedExternalTransaction.deleteMany({ where: { workspaceId } });
        await tx.importBatch.deleteMany({ where: { workspaceId } });
        await tx.novaInvestmentPosition.deleteMany({ where: { workspaceId } });
        await tx.novaAlert.deleteMany({ where: { workspaceId } });
        await tx.novaGoal.deleteMany({ where: { workspaceId } });
        await tx.novaReserveMovement.deleteMany({ where: { workspaceId } });
        await tx.novaReserve.deleteMany({ where: { workspaceId } });
        await tx.novaSettlement.deleteMany({ where: { workspaceId } });
        await tx.novaInstallment.deleteMany({ where: { workspaceId } });
        await tx.novaObligation.deleteMany({ where: { workspaceId } });
        await tx.budget.deleteMany({ where: { workspaceId } });
        await tx.transaction.deleteMany({ where: { workspaceId } });
        await tx.account.deleteMany({ where: { workspaceId } });

        const ws = await tx.workspace.update({
          where: { id: workspaceId },
          data: {
            safetyBufferCents: 200000, // R$ 2.000,00 de margem de segurança
            version: { increment: 1 },
          },
        });

        const isBiz = ws.type === "BUSINESS";

        const accMain = await tx.account.create({
          data: {
            workspaceId,
            name: isBiz ? "Conta Empresarial Principal" : "Conta Corrente Principal",
            type: "CHECKING",
            institution: "Banco Itaú",
            openingBalanceCents: 200000, // R$ 2.000,00 inicial
            openingBalanceDate: addDaysIso(today, -15),
            status: "ACTIVE",
          },
        });

        const accSecond = await tx.account.create({
          data: {
            workspaceId,
            name: isBiz ? "Conta Movimento Recebíveis" : "Conta Reserva Digital",
            type: "SAVINGS",
            institution: "BTG / Nubank",
            openingBalanceCents: 0,
            openingBalanceDate: addDaysIso(today, -15),
            status: "ACTIVE",
          },
        });

        // Receita liquidada R$ 10.500,00 e Despesa liquidada R$ 2.500,00
        // Saldo atual consolidado = 2.000 + 10.500 - 2.500 = R$ 10.000,00!
        await tx.transaction.create({
          data: {
            workspaceId,
            accountId: accMain.id,
            kind: "INCOME",
            status: "SETTLED",
            amountCents: 1050000,
            occurredOn: addDaysIso(today, -5),
            settledOn: addDaysIso(today, -5),
            description: isBiz
              ? "Recebimento Faturamento Mensal Clientes"
              : "Salário e Recebimentos Realizados",
            createdBy: actorId,
            idempotencyKey: `fix_inc_${Date.now()}`,
          },
        });

        await tx.transaction.create({
          data: {
            workspaceId,
            accountId: accMain.id,
            kind: "EXPENSE",
            status: "SETTLED",
            amountCents: 250000,
            occurredOn: addDaysIso(today, -3),
            settledOn: addDaysIso(today, -3),
            description: isBiz
              ? "Fornecedores e Infraestrutura Cloud"
              : "Moradia e Despesas Essenciais Liquidados",
            createdBy: actorId,
            idempotencyKey: `fix_exp_${Date.now()}`,
          },
        });

        // Transferência interna atômica de R$ 1.500,00 entre contas próprias (preserva consolidado em R$ 10.000,00)
        const tfGroupId = `tf_${Date.now()}`;
        await tx.transaction.createMany({
          data: [
            {
              workspaceId,
              accountId: accMain.id,
              kind: "TRANSFER_OUT",
              status: "SETTLED",
              amountCents: 150000,
              occurredOn: addDaysIso(today, -1),
              settledOn: addDaysIso(today, -1),
              description: "Transferência entre contas próprias",
              transferGroupId: tfGroupId,
              createdBy: actorId,
              idempotencyKey: `${tfGroupId}_out`,
            },
            {
              workspaceId,
              accountId: accSecond.id,
              kind: "TRANSFER_IN",
              status: "SETTLED",
              amountCents: 150000,
              occurredOn: addDaysIso(today, -1),
              settledOn: addDaysIso(today, -1),
              description: "Transferência entre contas próprias",
              transferGroupId: tfGroupId,
              createdBy: actorId,
              idempotencyKey: `${tfGroupId}_in`,
            },
          ],
        });

        // Obrigação a Pagar de R$ 3.000,00 nos próximos dias (reduz o menor saldo projetado de R$ 10.000 para R$ 7.000!)
        const obPay = await tx.novaObligation.create({
          data: {
            workspaceId,
            direction: "PAYABLE",
            title: isBiz
              ? "Tributos Mensais e Folha Complementar"
              : "Compromissos Previstos do Mês (Aluguel + Contas)",
            categoryName: isBiz ? "Tributos e Impostos" : "Moradia",
            counterparty: isBiz ? "Receita / Encargos" : "Administradora",
            costCenter: isBiz ? "Operações" : "Família",
            status: "ACTIVE",
            confidence: "HIGH",
          },
        });

        await tx.novaInstallment.create({
          data: {
            workspaceId,
            obligationId: obPay.id,
            number: 1,
            dueOn: addDaysIso(today, 5),
            amountCents: 300000, // R$ 3.000,00
            status: "OPEN",
          },
        });

        // Recebível futuro após o vale de caixa (+12 dias) de R$ 2.500,00
        const obRec = await tx.novaObligation.create({
          data: {
            workspaceId,
            direction: "RECEIVABLE",
            title: isBiz
              ? "Parcela Contrato Cliente B2B"
              : "Reembolso / Parcela Projeto",
            categoryName: isBiz ? "Recebimento de Clientes" : "Renda Extra",
            counterparty: isBiz ? "Cliente Enterprise S.A." : "Consultoria",
            costCenter: isBiz ? "Comercial" : "Pessoal",
            status: "ACTIVE",
            confidence: "HIGH",
          },
        });

        await tx.novaInstallment.create({
          data: {
            workspaceId,
            obligationId: obRec.id,
            number: 1,
            dueOn: addDaysIso(today, 12),
            amountCents: 250000, // R$ 2.500,00
            status: "OPEN",
          },
        });

        // Cofre de Reserva com R$ 1.000,00 já alocados virtualmente
        const reserve = await tx.novaReserve.create({
          data: {
            workspaceId,
            name: isBiz ? "Reserva de Capital de Giro" : "Reserva de Emergência",
            kind: isBiz ? "WORKING_CAPITAL" : "EMERGENCY",
            status: "ACTIVE",
            targetAmountCents: 1500000, // Meta R$ 15.000,00
            targetOn: addDaysIso(today, 180),
            priority: 1,
          },
        });

        await tx.novaReserveMovement.create({
          data: {
            workspaceId,
            reserveId: reserve.id,
            kind: "ALLOCATE",
            amountCents: 100000, // R$ 1.000,00 já alocados
            idempotencyKey: `fix_res_${Date.now()}`,
            actorId,
            reason: "Alocação inicial de planejamento",
          },
        });

        await tx.novaGoal.create({
          data: {
            workspaceId,
            reserveId: reserve.id,
            name: isBiz
              ? "Atingir 3 meses de Capital de Giro"
              : "Completar Colchão de Emergência",
            targetAmountCents: 1500000,
            targetOn: addDaysIso(today, 180),
            priority: 1,
            status: "ACTIVE",
          },
        });

        await tx.budget.create({
          data: {
            workspaceId,
            categoryName: isBiz ? "Tributos e Impostos" : "Moradia",
            period: today.slice(0, 7),
            limitCents: 450000,
            warnOnly: true,
            thresholdWarnPct: 70,
            thresholdCritPct: 90,
          },
        });

        // Posições de Investimento Persistidas (Pacote 03)
        await tx.novaInvestmentPosition.createMany({
          data: [
            {
              workspaceId,
              symbol: "LFT-2029",
              name: "Tesouro Selic 2029",
              kind: "TESOURO_SELIC",
              institution: "Tesouro Direto",
              indexer: "SELIC",
              rateLabel: "100% Selic + 0,05%",
              costBasisCents: 1500000,
              currentGrossCents: 1668000,
              daysHeld: 400,
              redemptionAvailableAt: "2026-01-01",
              maturityDate: "2029-03-01",
              fgcEligible: false,
              quoteStatus: "VALID",
            },
            {
              workspaceId,
              symbol: "CDB-DI-105",
              name: "CDB Liquidez Diária 105% CDI",
              kind: "CDB",
              institution: "Banco Itaú",
              indexer: "CDI",
              rateLabel: "105% do CDI",
              costBasisCents: 1000000,
              currentGrossCents: 1115000,
              daysHeld: 370,
              redemptionAvailableAt: "2026-01-01",
              maturityDate: "2028-06-01",
              fgcEligible: true,
              quoteStatus: "VALID",
            },
            {
              workspaceId,
              symbol: "LCI-94",
              name: "LCI Habitação 94% CDI (Carência)",
              kind: "LCI",
              institution: "Caixa Econômica",
              indexer: "CDI",
              rateLabel: "94% CDI (Isento IR PF)",
              costBasisCents: 1200000,
              currentGrossCents: 1326000,
              daysHeld: 280,
              redemptionAvailableAt: "2027-04-01",
              maturityDate: "2027-11-01",
              fgcEligible: true,
              quoteStatus: "VALID",
            },
          ],
        });

        // Insights Auditáveis Persistidos (Pacote 04)
        await tx.financialInsight.createMany({
          data: [
            {
              workspaceId,
              code: "RESERVE_HEADROOM_AVAILABLE",
              severity: "HIGH",
              state: "NEW",
              title: "Capacidade Segura de Reserva Disponível (R$ 4.000,00)",
              explanation:
                "Com base no menor saldo projetado de R$ 7.000,00, descontando a margem protegida de R$ 2.000,00 e R$ 1.000,00 já alocados em cofres, você pode alocar até R$ 4.000,00 sem comprometer o fluxo de caixa.",
              evidenceJson: JSON.stringify([
                {
                  metric: "minForecastBalanceCents",
                  asOf: today,
                  source: "forecast-p02-p04",
                  status: "ESTIMATED",
                  value: "700000",
                },
                {
                  metric: "reserveCapacityCents",
                  asOf: today,
                  source: "reserveCapacity-p04",
                  status: "VERIFIED",
                  value: "400000",
                },
              ]),
              dedupeKey: `insight_headroom_${today}`,
            },
            {
              workspaceId,
              code: "PORTFOLIO_LIQUIDITY_CHECK",
              severity: "MEDIUM",
              state: "NEW",
              title: "Equilíbrio entre Liquidez Imediata e Carência (P03 + P04)",
              explanation:
                "67,7% da sua carteira investida possui liquidez D+0/D+1 (Tesouro Selic + CDB DI), enquanto 32,3% está em LCI com carência até 2027.",
              evidenceJson: JSON.stringify([
                {
                  metric: "availableLiquidityCents",
                  asOf: today,
                  source: "investments-p03",
                  status: "VERIFIED",
                  value: "2783000",
                },
              ]),
              dedupeKey: `insight_liquidity_${today}`,
            },
          ],
        });

        await tx.auditEvent.create({
          data: {
            workspaceId,
            actorId,
            action: "fixture.p01_p02_p03_p04_loaded",
            entityType: "Workspace",
            entityId: workspaceId,
            requestId,
            metadataJson: JSON.stringify({
              S: "10000.00",
              Pmin: "7000.00",
              B: "2000.00",
              R: "1000.00",
              headroom: "4000.00",
              portfolioGross: "41090.00",
            }),
          },
        });
      });

      return NextResponse.json({ ok: true, requestId });
    }

    // Criar novo Workspace PF ou PJ (começa em R$ 0,00)
    if (action === "CREATE_WORKSPACE") {
      const { name, type } = body;
      const ws = await prisma.workspace.create({
        data: {
          name: name || "Novo Workspace NOVA",
          type: type === "BUSINESS" ? "BUSINESS" : "PERSONAL",
          baseCurrency: "BRL",
          timezone: "America/Sao_Paulo",
          safetyBufferCents: 0,
        },
      });
      await prisma.membership.create({
        data: {
          workspaceId: ws.id,
          userId: actorId,
          role: "OWNER",
          status: "ACTIVE",
        },
      });
      return NextResponse.json({ ok: true, workspace: ws, requestId }, { status: 201 });
    }

    if (!workspaceId) {
      throw new NovaDomainError(
        "VALIDATION_ERROR",
        "Parâmetro workspaceId é obrigatório.",
        422
      );
    }

    // Alterar papel de membro para testar RBAC (OWNER, ADMIN, EDITOR, VIEWER)
    if (action === "CHANGE_MEMBER_ROLE" || action === "SWITCH_ROLE") {
      const { role } = body;
      await prisma.membership.update({
        where: {
          workspaceId_userId: { workspaceId, userId: actorId },
        },
        data: { role },
      });
      return NextResponse.json({ ok: true, role, requestId });
    }

    // Verifica autorização de escrita no workspace (bloqueia VIEWER com 403 WORKSPACE_FORBIDDEN)
    await authorizeWorkspaceAccess(workspaceId, actorId, "EDIT");

    // =========================================================================
    // CONTAS (P01)
    // =========================================================================
    if (action === "CREATE_ACCOUNT") {
      const { name, type, institution, openingBalanceDecimal, openingBalanceDate } =
        body;
      const openingCents = openingBalanceDecimal
        ? decimalStringToCents(openingBalanceDecimal)
        : 0;

      const acc = await prisma.account.create({
        data: {
          workspaceId,
          name,
          type: type || "CHECKING",
          institution: institution || null,
          openingBalanceCents: openingCents,
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
            name,
            openingBalance: centsToDecimalString(openingCents),
          }),
        },
      });

      return NextResponse.json({ ok: true, account: acc, requestId }, { status: 201 });
    }

    if (action === "DELETE_OR_ARCHIVE_ACCOUNT") {
      const { accountId } = body;
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
              reason: "Conta possui lançamentos liquidados; arquivada com preservação histórica.",
            }),
          },
        });
        return NextResponse.json({
          ok: true,
          archived: true,
          account: archived,
          requestId,
        });
      }
      await prisma.account.delete({ where: { id: accountId } });
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
        return NextResponse.json({
          ok: true,
          idempotentReplay: true,
          transaction: existingIdem,
          requestId,
        });
      }

      const {
        accountId,
        categoryId,
        costCenter,
        kind,
        status,
        amountDecimal,
        occurredOn,
        dueOn,
        description,
        signedAdjustDir,
      } = body;

      const amountCents = decimalStringToCents(amountDecimal);
      if (amountCents <= 0) {
        throw new NovaDomainError(
          "VALIDATION_ERROR",
          "O valor do lançamento deve ser estritamente positivo (> 0).",
          422
        );
      }

      const tx = await prisma.transaction.create({
        data: {
          workspaceId,
          accountId,
          categoryId: categoryId || null,
          costCenter: costCenter || null,
          kind: kind || "EXPENSE",
          status: status || "SETTLED",
          amountCents,
          signedAdjustDir: signedAdjustDir ?? 1,
          occurredOn: occurredOn || today,
          dueOn: dueOn || occurredOn || today,
          settledOn: status === "SETTLED" ? occurredOn || today : null,
          description,
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

      return NextResponse.json({ ok: true, transaction: tx, requestId }, { status: 201 });
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

      const [outLeg, inLeg] = await prisma.$transaction([
        prisma.transaction.create({
          data: {
            workspaceId,
            accountId: sourceAccountId,
            kind: "TRANSFER_OUT",
            status: "SETTLED",
            amountCents,
            occurredOn: dateStr,
            settledOn: dateStr,
            description: description || "Transferência entre contas próprias",
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
            occurredOn: dateStr,
            settledOn: dateStr,
            description: description || "Transferência entre contas próprias",
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
        { ok: true, transferGroupId, outLeg, inLeg, requestId },
        { status: 201 }
      );
    }

    if (action === "SETTLE_TRANSACTION") {
      const { transactionId, settledOn } = body;
      const existing = await prisma.transaction.findFirst({
        where: { id: transactionId, workspaceId },
      });
      if (!existing) {
        throw new NovaDomainError("NOT_FOUND", "Lançamento não encontrado.", 404);
      }
      if (existing.status === "SETTLED") {
        // Idempotente: não duplica saldo
        return NextResponse.json({
          ok: true,
          idempotentReplay: true,
          transaction: existing,
          requestId,
        });
      }

      const updated = await prisma.transaction.update({
        where: { id: transactionId },
        data: {
          status: "SETTLED",
          settledOn: settledOn || today,
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

      return NextResponse.json({ ok: true, transaction: updated, requestId });
    }

    // Invariante P01 #6: Cancelamento preserva histórico com motivo e auditoria (não apaga registro)
    if (action === "CANCEL_TRANSACTION") {
      const { transactionId, reason } = body;
      const existing = await prisma.transaction.findFirst({
        where: { id: transactionId, workspaceId },
      });
      if (!existing) {
        throw new NovaDomainError("NOT_FOUND", "Lançamento não encontrado.", 404);
      }

      const canceled = await prisma.transaction.update({
        where: { id: transactionId },
        data: {
          status: "CANCELED",
          cancelReason: reason || "Cancelamento/estorno solicitado pelo usuário",
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

      return NextResponse.json({ ok: true, transaction: canceled, requestId });
    }

    // =========================================================================
    // OBRIGAÇÕES, PARCELAS E BAIXAS PARCIAIS/INTEGRAIS (P02)
    // =========================================================================
    if (action === "CREATE_OBLIGATION") {
      const {
        direction,
        title,
        categoryName,
        counterparty,
        costCenter,
        totalAmountDecimal,
        installmentsCount,
        firstDueOn,
        confidence,
      } = body;

      const totalCents = decimalStringToCents(totalAmountDecimal);
      const count = Math.max(1, Math.min(120, Number(installmentsCount || 1)));
      const parts = splitInstallmentsExact(totalCents, count);
      const baseDue = firstDueOn || today;

      const createdObligation = await prisma.$transaction(async (tx) => {
        const ob = await tx.novaObligation.create({
          data: {
            workspaceId,
            direction: direction === "RECEIVABLE" ? "RECEIVABLE" : "PAYABLE",
            title,
            categoryName: categoryName || "Geral",
            counterparty: counterparty || null,
            costCenter: costCenter || null,
            status: "ACTIVE",
            confidence: confidence || "HIGH",
          },
        });

        for (let i = 0; i < parts.length; i++) {
          const dueDateStr = addDaysIso(baseDue, i * 30);
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

    // Baixa parcial ou integral de parcela com vínculo atômico a Transaction P01
    if (action === "RECORD_SETTLEMENT") {
      const { installmentId, accountId, amountDecimal, settledOn, note } = body;

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
          throw new NovaDomainError("NOT_FOUND", "Parcela não encontrada.", 404);
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

        // Cria a Transaction liquidada no Ledger P01
        const p01Tx = await tx.transaction.create({
          data: {
            workspaceId,
            accountId,
            kind:
              inst.obligation.direction === "RECEIVABLE" ? "INCOME" : "EXPENSE",
            status: "SETTLED",
            amountCents,
            occurredOn: settlementDate,
            dueOn: inst.dueOn,
            settledOn: settlementDate,
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
            note: note || "Pagamento/recebimento externo registrado",
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

      return NextResponse.json({ ok: true, ...result, requestId }, { status: 201 });
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
          name,
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
            name,
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

      const fullState = await getWorkspaceFullState({ workspaceId });
      const targetReserve = fullState.reserves.find((r) => r.id === reserveId);
      if (!targetReserve) {
        throw new NovaDomainError("NOT_FOUND", "Cofre não encontrado.", 404);
      }

      if (movementKind === "ALLOCATE") {
        // Verifica se total alocado + novo aporte <= saldo elegível positivo
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

      return NextResponse.json({ ok: true, movement: mov, requestId }, { status: 201 });
    }

    // Transferência entre cofres em duas pernas atômicas (total alocado permanece constante)
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
      const fullState = await getWorkspaceFullState({ workspaceId });
      const src = fullState.reserves.find((r) => r.id === sourceReserveId);
      if (!src || src.allocatedCents < amountCents) {
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
    // ORÇAMENTOS, METAS, CENÁRIOS E MARGEM DE SEGURANÇA (P02)
    // =========================================================================
    if (action === "CREATE_BUDGET") {
      const { categoryName, costCenter, period, limitDecimal } = body;
      const limitCents = decimalStringToCents(limitDecimal);
      const budget = await prisma.budget.create({
        data: {
          workspaceId,
          categoryName,
          costCenter: costCenter || null,
          period: period || today.slice(0, 7),
          limitCents,
        },
      });
      return NextResponse.json({ ok: true, budget, requestId }, { status: 201 });
    }

    if (action === "CREATE_GOAL") {
      const { name, reserveId, targetAmountDecimal, targetOn, priority } = body;
      const targetAmountCents = decimalStringToCents(targetAmountDecimal);
      const goal = await prisma.novaGoal.create({
        data: {
          workspaceId,
          reserveId: reserveId || null,
          name,
          targetAmountCents,
          targetOn: targetOn || null,
          priority: Number(priority || 2),
          status: "ACTIVE",
        },
      });
      return NextResponse.json({ ok: true, goal, requestId }, { status: 201 });
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
      }
      return NextResponse.json({ ok: true, requestId });
    }

    if (action === "CREATE_CATEGORY") {
      const { name, type, isEssential } = body;
      const cat = await prisma.category.create({
        data: {
          workspaceId,
          name,
          type: type === "INCOME" ? "INCOME" : "EXPENSE",
          isEssential: isEssential !== false,
        },
      });
      return NextResponse.json({ ok: true, category: cat, requestId }, { status: 201 });
    }

    // =========================================================================
    // PACOTE 03: POSIÇÕES DE INVESTIMENTO PERSISTIDAS NO BANCO
    // =========================================================================
    if (action === "CREATE_INVESTMENT_POSITION") {
      const {
        name,
        kind,
        institution,
        rateLabel,
        costBasisReais,
        currentGrossReais,
        daysHeld,
      } = body;

      const pos = await prisma.novaInvestmentPosition.create({
        data: {
          workspaceId,
          symbol: kind || "CDB",
          name: name || "Ativo de Renda Fixa",
          kind: kind || "CDB",
          institution: institution || "Custódia B3 / Banco",
          indexer: "CDI/SELIC",
          rateLabel: rateLabel || "100% CDI",
          costBasisCents: Math.round(Number(costBasisReais || 0) * 100),
          currentGrossCents: Math.round(Number(currentGrossReais || 0) * 100),
          daysHeld: Number(daysHeld || 365),
          redemptionAvailableAt: "2026-01-01",
          maturityDate: "2028-12-01",
          fgcEligible:
            kind === "CDB" || kind === "LCI" || kind === "LCA",
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
            gross: centsToDecimalString(pos.currentGrossCents),
          }),
        },
      });

      return NextResponse.json({ ok: true, position: pos, requestId }, { status: 201 });
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
          metadataJson: JSON.stringify({ note: "Carteira P03 zerada para R$ 0,00" }),
        },
      });
      return NextResponse.json({ ok: true, requestId });
    }

    if (action === "LOAD_P03_FIXTURE") {
      await prisma.novaInvestmentPosition.deleteMany({ where: { workspaceId } });
      await prisma.novaInvestmentPosition.createMany({
        data: [
          {
            workspaceId,
            symbol: "LFT-2029",
            name: "Tesouro Selic 2029",
            kind: "TESOURO_SELIC",
            institution: "Tesouro Direto",
            indexer: "SELIC",
            rateLabel: "100% Selic + 0,05%",
            costBasisCents: 1500000,
            currentGrossCents: 1668000,
            daysHeld: 400,
            redemptionAvailableAt: "2026-01-01",
            maturityDate: "2029-03-01",
            fgcEligible: false,
            quoteStatus: "VALID",
          },
          {
            workspaceId,
            symbol: "CDB-DI-105",
            name: "CDB Liquidez Diária 105% CDI",
            kind: "CDB",
            institution: "Banco Itaú",
            indexer: "CDI",
            rateLabel: "105% do CDI",
            costBasisCents: 1000000,
            currentGrossCents: 1115000,
            daysHeld: 370,
            redemptionAvailableAt: "2026-01-01",
            maturityDate: "2028-06-01",
            fgcEligible: true,
            quoteStatus: "VALID",
          },
          {
            workspaceId,
            symbol: "LCI-94",
            name: "LCI Habitação 94% CDI (Carência)",
            kind: "LCI",
            institution: "Caixa Econômica",
            indexer: "CDI",
            rateLabel: "94% CDI (Isento IR PF)",
            costBasisCents: 1200000,
            currentGrossCents: 1326000,
            daysHeld: 280,
            redemptionAvailableAt: "2027-04-01",
            maturityDate: "2027-11-01",
            fgcEligible: true,
            quoteStatus: "VALID",
          },
        ],
      });
      return NextResponse.json({ ok: true, requestId });
    }

    // =========================================================================
    // PACOTE 04: CONEXÕES, CONSENTIMENTOS, IMPORTAÇÃO CSV E INSIGHTS AUDITÁVEIS
    // =========================================================================
    if (action === "GRANT_CONNECTION_CONSENT") {
      const { connectionId, scopes } = body;
      const consentId = `consent_${Date.now()}`;
      const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
      const scopesArr = Array.isArray(scopes)
        ? scopes
        : ["ACCOUNTS_READ", "BALANCES_READ", "TRANSACTIONS_READ"];

      const updated = await prisma.financialConnection.update({
        where: { id: connectionId },
        data: {
          status: "ACTIVE",
          consentId,
          consentScopes: JSON.stringify(scopesArr),
          consentExpiresAt: expiresAt,
          lastSyncAt: new Date(),
        },
      });

      await prisma.financialConsentAudit.create({
        data: {
          workspaceId,
          connectionId,
          actorId,
          action: "GRANTED",
          scopesJson: JSON.stringify(scopesArr),
          requestId,
        },
      });

      await prisma.auditEvent.create({
        data: {
          workspaceId,
          actorId,
          action: "connection.consent_granted",
          entityType: "FinancialConnection",
          entityId: connectionId,
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
      const updated = await prisma.financialConnection.update({
        where: { id: connectionId },
        data: {
          status: "REVOKED",
          consentExpiresAt: new Date(),
        },
      });

      await prisma.financialConsentAudit.create({
        data: {
          workspaceId,
          connectionId,
          actorId,
          action: "REVOKED",
          scopesJson: updated.consentScopes || "[]",
          requestId,
        },
      });

      await prisma.auditEvent.create({
        data: {
          workspaceId,
          actorId,
          action: "connection.consent_revoked",
          entityType: "FinancialConnection",
          entityId: connectionId,
          requestId,
          metadataJson: JSON.stringify({
            providerCode: updated.providerCode,
            status: "REVOKED",
          }),
        },
      });

      return NextResponse.json({ ok: true, connection: updated, requestId });
    }

    // Importação Manual CSV/OFX em Staging com Deduplicação por (workspace, provider, account, externalId)
    if (action === "STAGE_CSV_IMPORT") {
      const { csvContent, providerId = "MANUAL_CSV", accountExternalId = "ACC_PRINCIPAL" } = body;
      const rawText = String(csvContent || "").trim();
      if (!rawText) {
        throw new NovaDomainError("VALIDATION_ERROR", "Conteúdo CSV vazio.", 422);
      }

      const batch = await prisma.importBatch.create({
        data: {
          workspaceId,
          sourceType: "CSV",
          fileName: "extrato-importado.csv",
          state: "REVIEWING",
          inputChecksum: `sha256_${rawText.length}_${Date.now()}`,
          createdBy: actorId,
        },
      });

      const lines = rawText
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0 && !l.toLowerCase().startsWith("data,"));

      let stagedCount = 0;
      let duplicateCount = 0;

      for (let idx = 0; idx < lines.length; idx++) {
        // Formato esperado: YYYY-MM-DD,Descricao,ValorDecimal,CREDIT|DEBIT|SELF_TRANSFER,ExternalId
        const parts = lines[idx].split(",").map((p) => p.trim());
        const postedOn = /^\d{4}-\d{2}-\d{2}$/.test(parts[0] || "")
          ? parts[0]
          : today;
        const description = parts[1] || `Item Importado #${idx + 1}`;
        const amountCents = decimalStringToCents(parts[2] || "100.00");
        const rawDir = (parts[3] || "DEBIT").toUpperCase();
        const isSelfTransfer =
          rawDir === "SELF_TRANSFER" ||
          description.toLowerCase().includes("transferencia propria") ||
          description.toLowerCase().includes("entre contas proprias");
        const direction = isSelfTransfer
          ? "SELF_TRANSFER"
          : rawDir === "CREDIT" || rawDir === "INCOME"
          ? "CREDIT"
          : "DEBIT";
        const externalId =
          parts[4] || `ext_${postedOn}_${amountCents}_${description.slice(0, 12)}`;

        const existingExt = await prisma.importedExternalTransaction.findUnique({
          where: {
            workspaceId_providerId_accountExternalId_externalId: {
              workspaceId,
              providerId,
              accountExternalId,
              externalId,
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
            providerId,
            accountExternalId,
            externalId,
            postedOn,
            amountCents,
            direction,
            description,
            rawHash: `${postedOn}|${amountCents}|${direction}|${externalId}`,
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
          metadataJson: JSON.stringify({ stagedCount, duplicateCount }),
        },
      });

      return NextResponse.json(
        { ok: true, batchId: batch.id, stagedCount, duplicateCount, requestId },
        { status: 202 }
      );
    }

    // Conciliação de item importado: Aprovar para o Ledger P01 (sem transformar transferência própria em receita!) ou Ignorar
    if (action === "RECONCILE_IMPORTED_ROW") {
      const { importedRowId, decision, targetAccountId } = body;
      const item = await prisma.importedExternalTransaction.findFirst({
        where: { id: importedRowId, workspaceId },
      });
      if (!item) {
        throw new NovaDomainError("NOT_FOUND", "Item importado não encontrado.", 404);
      }

      if (decision === "IGNORE") {
        await prisma.importedExternalTransaction.update({
          where: { id: item.id },
          data: { state: "IGNORED" },
        });
        return NextResponse.json({ ok: true, state: "IGNORED", requestId });
      }

      // Garante que exista ao menos uma conta no workspace para conciliar
      let accId = targetAccountId;
      if (!accId) {
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
              openingBalanceDate: today,
              status: "ACTIVE",
            },
          });
          accId = createdAcc.id;
        } else {
          accId = firstAcc.id;
        }
      }

      // Regra P04: "Conciliação: identificação de duplicatas e transferências próprias; nunca criar receita ao importar uma transferência."
      const kind =
        item.direction === "SELF_TRANSFER"
          ? "TRANSFER_IN"
          : item.direction === "CREDIT"
          ? "INCOME"
          : "EXPENSE";

      const ledgerTx = await prisma.transaction.create({
        data: {
          workspaceId,
          accountId: accId,
          kind,
          status: "SETTLED",
          amountCents: item.amountCents,
          occurredOn: item.postedOn,
          settledOn: item.postedOn,
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
      const { insightId, newState = "READ" } = body;
      await prisma.financialInsight.updateMany({
        where: { id: insightId, workspaceId },
        data: { state: newState },
      });
      return NextResponse.json({ ok: true, requestId });
    }

    throw new NovaDomainError("VALIDATION_ERROR", `Ação inválida: ${action}`, 400);
  } catch (err) {
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
