import { prisma } from "./prisma";
import {
  addMonthsIso,
  advancePeriodicityIso,
  allocationBalance,
  buildForecast,
  calculateReserveCapacity,
  centsToDecimalString,
  computeAccountBalanceCents,
  computeConsolidatedTotals,
  ForecastEntry,
  monthlyContribution,
  remainingInstallment,
  sanitizeCsvCell,
  splitInstallmentsExact,
} from "@/domain/planning";
import {
  calculateFinancialHealthIndex,
  detectCashRisk,
  projectCash,
  qualityStatus,
  savingsRate,
} from "@/domain/intelligence";
import {
  projectLiquidity,
  taxableFixedIncomeRedemption,
} from "@/domain/investments";
import {
  summary as canonicalSummary,
  projection as canonicalProjection,
  capacity as canonicalCapacity,
} from "@/domain/canonical-core";
import { compute as computeP06 } from "@/domain/pacote06";

export { addMonthsIso, advancePeriodicityIso, sanitizeCsvCell };

export interface ApiErrorShape {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  requestId: string;
  status: number;
}

export class NovaDomainError extends Error {
  code: string;
  status: number;
  details?: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    status = 400,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function todayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDaysIso(baseIso: string, days: number): string {
  const [y, m, d] = baseIso.split("-").map(Number);
  const dt = new Date(y, m - 1, d + days, 12, 0, 0);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function diffDaysAbs(isoA: string, isoB: string): number {
  const a = Date.parse(`${isoA.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${isoB.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 9999;
  return Math.round(Math.abs(a - b) / 86_400_000);
}

/**
 * Valida acesso RBAC ao workspace.
 */
export async function authorizeWorkspaceAccess(
  workspaceId: string,
  userId: string,
  requiredLevel: "VIEW" | "EDIT" | "ADMIN" = "VIEW"
) {
  const membership = await prisma.membership.findUnique({
    where: {
      workspaceId_userId: { workspaceId, userId },
    },
  });

  if (!membership || membership.status !== "ACTIVE") {
    throw new NovaDomainError(
      "WORKSPACE_FORBIDDEN",
      "Acesso negado a este workspace.",
      403
    );
  }

  if (requiredLevel === "EDIT" && membership.role === "VIEWER") {
    throw new NovaDomainError(
      "WORKSPACE_FORBIDDEN",
      "Perfil VIEWER possui permissão somente de leitura e não pode criar ou alterar registros.",
      403
    );
  }

  if (
    requiredLevel === "ADMIN" &&
    membership.role !== "OWNER" &&
    membership.role !== "ADMIN"
  ) {
    throw new NovaDomainError(
      "WORKSPACE_FORBIDDEN",
      "Operação restrita a administradores (OWNER/ADMIN) do workspace.",
      403
    );
  }

  return membership;
}

/**
 * Calcula todos os indicadores consolidados (P01–P11), saldos por conta,
 * fluxo de caixa projetado (incluindo recorrências ativas), capacidade conservadora de reserva,
 * carteira de investimentos, índice de saúde financeira ponderado, qualidade dos dados,
 * conexões/importações com auto-match e demonstrativo gerencial PF/PJ.
 */
export async function getWorkspaceFullState(params: {
  workspaceId?: string;
  userId?: string;
  horizonDays?: number;
  scenarioKind?: "BASE" | "CONSERVATIVE" | "OPTIMISTIC";
}) {
  const workspaces = await prisma.workspace.findMany({
    where: params.userId
      ? {
          memberships: {
            some: { userId: params.userId, status: "ACTIVE" },
          },
        }
      : params.workspaceId
      ? { id: params.workspaceId }
      : undefined,
    orderBy: { type: "desc" }, // PERSONAL then BUSINESS
  });

  const activeWorkspace =
    workspaces.find((w) => w.id === params.workspaceId) ?? workspaces[0];

  if (!activeWorkspace) {
    throw new NovaDomainError("NOT_FOUND", "Workspace não encontrado.", 404);
  }

  const wsId = activeWorkspace.id;
  const horizonDays = params.horizonDays ?? 180;
  const scenarioKind = params.scenarioKind ?? "BASE";

  // Garante que o catálogo básico de conexões P04 exista para este workspace
  const existingConnCount = await prisma.financialConnection.count({
    where: { workspaceId: wsId },
  });
  if (existingConnCount === 0) {
    await prisma.financialConnection.createMany({
      data: [
        {
          workspaceId: wsId,
          providerCode: "ITAU_OPENFINANCE_BR",
          institutionName: "Itaú Unibanco (Open Finance Read-Only)",
          status: "DISCONNECTED",
        },
        {
          workspaceId: wsId,
          providerCode: "NUBANK_OPENFINANCE_BR",
          institutionName: "Nu Pagamentos / Nubank (Open Finance Read-Only)",
          status: "DISCONNECTED",
        },
        {
          workspaceId: wsId,
          providerCode: "BTG_OPENFINANCE_BR",
          institutionName: "BTG Pactual Empresas & Investimentos",
          status: "DISCONNECTED",
        },
      ],
    });
  }

  const novaSessionCounter = (
    prisma as unknown as {
      novaSession?: { count: (args: unknown) => Promise<number> };
    }
  ).novaSession;

  const [
    memberships,
    accounts,
    categories,
    counterparties,
    transactions,
    recurrences,
    budgets,
    obligations,
    reserves,
    reserveMovements,
    goals,
    scenarios,
    storedAlerts,
    auditEvents,
    investmentPositions,
    financialConnections,
    importBatches,
    importedTransactions,
    storedInsights,
    consentAudits,
    p06ReservesRaw,
    p06InvestmentsRaw,
    p06AuditCount,
    idempotencyKeyCount,
    activeSessionCount,
  ] = await Promise.all([
    prisma.membership.findMany({
      where: { workspaceId: wsId },
      include: { user: true },
    }),
    prisma.account.findMany({
      where: { workspaceId: wsId },
      orderBy: { createdAt: "asc" },
    }),
    prisma.category.findMany({
      where: { workspaceId: wsId, archivedAt: null },
      orderBy: { name: "asc" },
    }),
    prisma.counterparty.findMany({
      where: { workspaceId: wsId },
      orderBy: { name: "asc" },
    }),
    prisma.transaction.findMany({
      where: { workspaceId: wsId },
      include: { account: true },
      orderBy: [{ occurredOn: "desc" }, { createdAt: "desc" }],
    }),
    prisma.recurrence.findMany({
      where: { workspaceId: wsId },
      orderBy: { nextDate: "asc" },
    }),
    prisma.budget.findMany({
      where: { workspaceId: wsId },
      orderBy: { categoryName: "asc" },
    }),
    prisma.novaObligation.findMany({
      where: { workspaceId: wsId },
      include: {
        installments: {
          include: { settlements: true },
          orderBy: { number: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.novaReserve.findMany({
      where: { workspaceId: wsId },
      include: { movements: { orderBy: { createdAt: "desc" } } },
      orderBy: { priority: "asc" },
    }),
    prisma.novaReserveMovement.findMany({
      where: { workspaceId: wsId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.novaGoal.findMany({
      where: { workspaceId: wsId },
      orderBy: { priority: "asc" },
    }),
    prisma.novaPlanningScenario.findMany({
      where: { workspaceId: wsId },
    }),
    prisma.novaAlert.findMany({
      where: { workspaceId: wsId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.auditEvent.findMany({
      where: { workspaceId: wsId },
      orderBy: { timestamp: "desc" },
      take: 60,
    }),
    prisma.novaInvestmentPosition.findMany({
      where: { workspaceId: wsId },
      orderBy: { createdAt: "asc" },
    }),
    prisma.financialConnection.findMany({
      where: { workspaceId: wsId },
      orderBy: { createdAt: "asc" },
    }),
    prisma.importBatch.findMany({
      where: { workspaceId: wsId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.importedExternalTransaction.findMany({
      where: { workspaceId: wsId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.financialInsight.findMany({
      where: { workspaceId: wsId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.financialConsentAudit.findMany({
      where: { workspaceId: wsId },
      orderBy: { eventAt: "desc" },
      take: 30,
    }),
    prisma.reserve.findMany({
      where: { workspaceId: wsId },
      orderBy: { createdAt: "asc" },
    }),
    prisma.investment.findMany({
      where: { workspaceId: wsId },
      orderBy: { createdAt: "asc" },
    }),
    prisma.audit.count({ where: { workspaceId: wsId } }),
    prisma.idempotencyKey.count({ where: { workspaceId: wsId } }),
    novaSessionCounter
      ? novaSessionCounter.count({
          where: {
            revokedAt: null,
            expiresAt: { gt: new Date() },
            ...(params.userId ? { userId: params.userId } : {}),
          },
        })
      : prisma.session.count({ where: { expiresAt: { gt: new Date() } } }),
  ]);

  const today = todayIso();
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const counterpartyById = new Map(counterparties.map((cp) => [cp.id, cp]));
  const accountById = new Map(accounts.map((a) => [a.id, a]));

  // Sanitiza memberships (nunca vaza passwordHash para o cliente!)
  const safeMemberships = memberships.map((m) => ({
    id: m.id,
    workspaceId: m.workspaceId,
    userId: m.userId,
    role: m.role,
    status: m.status,
    createdAt: m.createdAt,
    user: m.user
      ? {
          id: m.user.id,
          name: m.user.name,
          email: m.user.email,
          status: m.user.status,
        }
      : undefined,
  }));

  // Normaliza transações para interoperabilidade P01–P05 + P06 (serializando BigInt + categoria/contraparte)
  const normalizedTransactions = transactions.map((t) => {
    const derivedAmountCents =
      t.amountCents > 0 ? t.amountCents : Math.abs(Number(t.signedCents));
    const derivedSignedBig =
      t.signedCents !== 0n
        ? t.signedCents
        : t.kind === "EXPENSE" || t.kind === "TRANSFER_OUT"
        ? -BigInt(derivedAmountCents)
        : BigInt(derivedAmountCents);
    const isoDate =
      t.occurredOn && t.occurredOn !== "2026-01-01"
        ? t.occurredOn
        : t.date instanceof Date
        ? t.date.toISOString().slice(0, 10)
        : today;
    const isoDue =
      t.dueOn ||
      (t.dueDate instanceof Date
        ? t.dueDate.toISOString().slice(0, 10)
        : isoDate);
    const cat = t.categoryId ? categoryById.get(t.categoryId) : undefined;
    const cp = t.counterpartyId
      ? counterpartyById.get(t.counterpartyId)
      : undefined;

    return {
      ...t,
      amountCents: derivedAmountCents,
      signedCents: derivedSignedBig.toString(),
      occurredOn: isoDate,
      dueOn: isoDue,
      categoryName: cat?.name ?? null,
      isEssential: cat ? cat.isEssential : true,
      counterpartyName: cp?.name ?? null,
      account: t.account
        ? {
            ...t.account,
            openingCents: t.account.openingCents.toString(),
          }
        : t.account,
    };
  });

  // 1. Saldos por conta usando Invariante P01 #2
  const computedAccounts = accounts.map((acc) => {
    const accTxs = normalizedTransactions.filter((t) => t.accountId === acc.id);
    const effectiveOpeningCents =
      acc.openingBalanceCents !== 0
        ? acc.openingBalanceCents
        : Number(acc.openingCents);
    const currentBalanceCents = computeAccountBalanceCents(
      effectiveOpeningCents,
      accTxs
    );
    const settledCount = accTxs.filter((t) => t.status === "SETTLED").length;
    return {
      ...acc,
      openingBalanceCents: effectiveOpeningCents,
      openingCents: BigInt(effectiveOpeningCents).toString(),
      currentBalanceCents,
      currentBalanceDecimal: centsToDecimalString(currentBalanceCents),
      canDelete: settledCount === 0,
      settledCount,
    };
  });

  // Saldo consolidado elegível (contas ACTIVE)
  const eligibleBalanceCents = computedAccounts
    .filter((a) => a.status === "ACTIVE")
    .reduce((sum, a) => sum + a.currentBalanceCents, 0);

  // 2. Totais consolidados de Receitas e Despesas (excluindo transferências internas)
  const consolidatedTotals = computeConsolidatedTotals(normalizedTransactions);

  // 3. Processamento das Obrigações e Parcelas P02 (Contas a Pagar e a Receber)
  const enrichedInstallments: Array<{
    id: string;
    obligationId: string;
    obligationTitle: string;
    direction: "PAYABLE" | "RECEIVABLE";
    categoryName: string;
    counterparty: string;
    costCenter: string;
    confidence: string;
    number: number;
    totalInstallments: number;
    dueOn: string;
    amountCents: number;
    amountPaidCents: number;
    outstandingCents: number;
    derivedStatus: "OPEN" | "PARTIAL" | "PAID" | "OVERDUE" | "CANCELED";
    settlements: Array<{
      id: string;
      amountCents: number;
      settledOn: string;
      transactionId: string;
    }>;
  }> = [];

  for (const ob of obligations) {
    const totalCount = ob.installments.length;
    const cpName =
      ob.counterparty ||
      (ob.counterpartyId ? counterpartyById.get(ob.counterpartyId)?.name : "") ||
      "";
    const catName =
      ob.categoryName ||
      (ob.categoryId ? categoryById.get(ob.categoryId)?.name : "") ||
      "Geral";

    for (const inst of ob.installments) {
      const paidCents = inst.settlements.reduce(
        (s, st) => s + st.amountCents,
        0
      );
      const outstandingCents = Math.max(0, inst.amountCents - paidCents);

      let derivedStatus: "OPEN" | "PARTIAL" | "PAID" | "OVERDUE" | "CANCELED" =
        inst.status as "OPEN" | "PARTIAL" | "PAID" | "CANCELED";

      if (ob.status === "CANCELED" || inst.status === "CANCELED") {
        derivedStatus = "CANCELED";
      } else if (outstandingCents === 0) {
        derivedStatus = "PAID";
      } else if (inst.dueOn < today) {
        derivedStatus = "OVERDUE";
      } else if (paidCents > 0) {
        derivedStatus = "PARTIAL";
      } else {
        derivedStatus = "OPEN";
      }

      enrichedInstallments.push({
        id: inst.id,
        obligationId: ob.id,
        obligationTitle: ob.title,
        direction: ob.direction as "PAYABLE" | "RECEIVABLE",
        categoryName: catName,
        counterparty: cpName,
        costCenter: ob.costCenter || "",
        confidence: ob.confidence,
        number: inst.number,
        totalInstallments: totalCount,
        dueOn: inst.dueOn,
        amountCents: inst.amountCents,
        amountPaidCents: paidCents,
        outstandingCents,
        derivedStatus,
        settlements: inst.settlements.map((s) => ({
          id: s.id,
          amountCents: s.amountCents,
          settledOn: s.settledOn,
          transactionId: s.transactionId,
        })),
      });
    }
  }

  enrichedInstallments.sort((a, b) => a.dueOn.localeCompare(b.dueOn));

  const linkedTxIds = new Set(
    obligations
      .flatMap((o) => o.installments)
      .map((i) => i.sourceTransactionId)
      .filter(Boolean)
  );
  const standalonePendingTxs = normalizedTransactions.filter(
    (t) =>
      t.status === "PENDING" &&
      !linkedTxIds.has(t.id) &&
      (t.kind === "INCOME" || t.kind === "EXPENSE")
  );

  // 3B. Motor de Recorrências (Pacote 10): projeta ocorrências ativas no horizonte sem duplicar as já materializadas
  const horizonEndIso = addDaysIso(today, Math.max(horizonDays, 95));
  const materializedIdemKeys = new Set(
    transactions.map((t) => t.idempotencyKey)
  );

  const enrichedRecurrences = recurrences.map((r) => ({
    ...r,
    accountName: accountById.get(r.accountId)?.name || "Conta",
    categoryName:
      (r.categoryId && categoryById.get(r.categoryId)?.name) || "Geral",
  }));

  const projectedRecurrenceOccurrences: Array<{
    id: string;
    recurrenceId: string;
    title: string;
    kind: "INCOME" | "EXPENSE";
    categoryName: string;
    amountCents: number;
    date: string;
  }> = [];

  for (const r of enrichedRecurrences) {
    if (!r.active || r.amountCents <= 0) continue;
    let cursor = r.nextDate;
    let guard = 0;
    while (cursor <= horizonEndIso && guard < 366) {
      guard++;
      if (r.endDate && cursor > r.endDate) break;
      const idemKey = `rec_${r.id}_${cursor}`;
      if (!materializedIdemKeys.has(idemKey)) {
        const effectiveDate = cursor < today ? today : cursor;
        projectedRecurrenceOccurrences.push({
          id: idemKey,
          recurrenceId: r.id,
          title: r.title,
          kind: r.kind === "INCOME" ? "INCOME" : "EXPENSE",
          categoryName: r.categoryName,
          amountCents: r.amountCents,
          date: effectiveDate,
        });
      }
      const next = advancePeriodicityIso(cursor, r.periodicity);
      if (next <= cursor) break;
      cursor = next;
    }
  }

  // 4. Série Diária de Fluxo de Caixa Projetado (buildForecast P02 + Recorrências P10)
  const activeScenario =
    scenarios.find((s) => s.kind === scenarioKind) ?? {
      kind: "BASE",
      contingencyBufferPct: 0,
      hypotheticalInflowCents: 0,
      hypotheticalOutflowCents: 0,
    };

  const dailyEntries: ForecastEntry[] = [];
  for (let i = 0; i <= horizonDays; i++) {
    const dateStr = addDaysIso(today, i);
    let inboundCents = 0n;
    let outboundCents = 0n;

    for (const inst of enrichedInstallments) {
      if (inst.derivedStatus === "PAID" || inst.derivedStatus === "CANCELED") {
        continue;
      }
      const matchesDay =
        inst.dueOn === dateStr || (i === 0 && inst.dueOn < today);
      if (!matchesDay) continue;

      if (inst.direction === "RECEIVABLE") {
        if (
          scenarioKind === "CONSERVATIVE" &&
          (inst.confidence !== "HIGH" || inst.dueOn < today)
        ) {
          continue;
        }
        inboundCents += BigInt(inst.outstandingCents);
      } else {
        let out = BigInt(inst.outstandingCents);
        if (
          scenarioKind === "CONSERVATIVE" &&
          activeScenario.contingencyBufferPct > 0
        ) {
          out =
            (out * BigInt(100 + activeScenario.contingencyBufferPct)) / 100n;
        }
        outboundCents += out;
      }
    }

    for (const ptx of standalonePendingTxs) {
      const targetDate = ptx.dueOn || ptx.occurredOn;
      const matchesDay =
        targetDate === dateStr || (i === 0 && targetDate < today);
      if (!matchesDay) continue;
      if (ptx.kind === "INCOME") inboundCents += BigInt(ptx.amountCents);
      else if (ptx.kind === "EXPENSE") outboundCents += BigInt(ptx.amountCents);
    }

    for (const recOcc of projectedRecurrenceOccurrences) {
      if (recOcc.date !== dateStr) continue;
      if (recOcc.date > addDaysIso(today, horizonDays)) continue;
      if (recOcc.kind === "INCOME") {
        inboundCents += BigInt(recOcc.amountCents);
      } else {
        let out = BigInt(recOcc.amountCents);
        if (
          scenarioKind === "CONSERVATIVE" &&
          activeScenario.contingencyBufferPct > 0
        ) {
          out =
            (out * BigInt(100 + activeScenario.contingencyBufferPct)) / 100n;
        }
        outboundCents += out;
      }
    }

    if (i === Math.min(15, horizonDays)) {
      if (activeScenario.hypotheticalInflowCents > 0) {
        inboundCents += BigInt(activeScenario.hypotheticalInflowCents);
      }
      if (activeScenario.hypotheticalOutflowCents > 0) {
        outboundCents += BigInt(activeScenario.hypotheticalOutflowCents);
      }
    }

    dailyEntries.push({
      date: dateStr,
      inbound: inboundCents,
      outbound: outboundCents,
    });
  }

  const forecastPoints = buildForecast(
    BigInt(eligibleBalanceCents),
    dailyEntries
  );

  const minForecastBalanceBig =
    forecastPoints.length > 0
      ? forecastPoints.reduce(
          (min, p) => (p.ending < min ? p.ending : min),
          forecastPoints[0].ending
        )
      : BigInt(eligibleBalanceCents);

  const minForecastBalanceCents = Number(minForecastBalanceBig);
  const projectedEndBalanceCents =
    forecastPoints.length > 0
      ? Number(forecastPoints[forecastPoints.length - 1].ending)
      : eligibleBalanceCents;

  // 5. Reservas Virtuais (Cofres P02) e Saldo Alocado
  const computedReserves = reserves.map((res) => {
    const resBalanceBig = allocationBalance(
      res.movements.map((m) => ({
        kind: m.kind as "ALLOCATE" | "RELEASE" | "TRANSFER_IN" | "TRANSFER_OUT",
        amount: BigInt(m.amountCents),
      }))
    );
    const allocatedCents = Number(resBalanceBig);
    const progressPct =
      res.targetAmountCents && res.targetAmountCents > 0
        ? Math.min(
            100,
            Math.round((allocatedCents / res.targetAmountCents) * 100)
          )
        : 0;

    return {
      ...res,
      allocatedCents,
      allocatedDecimal: centsToDecimalString(allocatedCents),
      progressPct,
    };
  });

  const totalAllocatedReservesCents = computedReserves.reduce(
    (s, r) => s + r.allocatedCents,
    0
  );

  const freeCashCents = eligibleBalanceCents - totalAllocatedReservesCents;

  // 6. Motor de Capacidade Conservadora de Reserva (P02: calculateReserveCapacity)
  const headroomBig = calculateReserveCapacity({
    eligibleBalance: BigInt(Math.max(0, eligibleBalanceCents)),
    minForecastBalance: minForecastBalanceBig,
    safetyBuffer: BigInt(Math.max(0, activeWorkspace.safetyBufferCents)),
    alreadyAllocated: BigInt(Math.max(0, totalAllocatedReservesCents)),
    overdueNotInForecast: 0n,
  });
  const headroomCents = Number(headroomBig);

  let confidence: "HIGH" | "MEDIUM" | "LOW" | "INSUFFICIENT_DATA" = "HIGH";
  const explanations: string[] = [];

  if (accounts.length === 0) {
    confidence = "INSUFFICIENT_DATA";
    explanations.push(
      "Nenhuma conta cadastrada no workspace. Cadastre sua primeira conta e lançamentos para habilitar o cálculo."
    );
  } else {
    explanations.push(
      `Saldo elegível consolidado (S): R$ ${centsToDecimalString(
        eligibleBalanceCents
      )}`
    );
    explanations.push(
      `Menor saldo projetado no horizonte de ${horizonDays} dias (Pmin): R$ ${centsToDecimalString(
        minForecastBalanceCents
      )}`
    );
    explanations.push(
      `Margem de segurança configurada (B): R$ ${centsToDecimalString(
        activeWorkspace.safetyBufferCents
      )}`
    );
    explanations.push(
      `Reservas virtuais já alocadas nos cofres (R): R$ ${centsToDecimalString(
        totalAllocatedReservesCents
      )}`
    );
    explanations.push(
      "Compromissos em aberto, recorrências ativas e vencidos descontados uma única vez na projeção diária."
    );
    if (activeWorkspace.safetyBufferCents === 0) {
      confidence = "MEDIUM";
      explanations.push(
        "Margem de segurança ainda está em R$ 0,00. Recomendamos definir um colchão mínimo em Planejamento."
      );
    }
  }

  // 7. Orçamentos (Budgets P01/P02) sem dupla contagem
  const computedBudgets = budgets.map((b) => {
    const realizedCents = normalizedTransactions
      .filter(
        (t) =>
          t.status === "SETTLED" &&
          t.kind === "EXPENSE" &&
          ((b.categoryId && t.categoryId === b.categoryId) ||
            (t.categoryName &&
              t.categoryName.toLowerCase() === b.categoryName.toLowerCase()) ||
            t.description.toLowerCase().includes(b.categoryName.toLowerCase()))
      )
      .reduce((s, t) => s + t.amountCents, 0);

    const committedOpenCents = enrichedInstallments
      .filter(
        (i) =>
          i.direction === "PAYABLE" &&
          i.derivedStatus !== "PAID" &&
          i.derivedStatus !== "CANCELED" &&
          i.categoryName.toLowerCase() === b.categoryName.toLowerCase()
      )
      .reduce((s, i) => s + i.outstandingCents, 0);

    const totalProjectedCents = realizedCents + committedOpenCents;
    const usagePct =
      b.limitCents > 0
        ? Math.round((totalProjectedCents / b.limitCents) * 100)
        : 0;

    return {
      ...b,
      realizedCents,
      committedOpenCents,
      totalProjectedCents,
      remainingBudgetCents: b.limitCents - totalProjectedCents,
      usagePct,
    };
  });

  // 8. Metas Financeiras (Goals P02)
  const computedGoals = goals.map((g) => {
    const linkedReserve = computedReserves.find((r) => r.id === g.reserveId);
    const allocatedCents = linkedReserve ? linkedReserve.allocatedCents : 0;
    const progressPct =
      g.targetAmountCents > 0
        ? Math.min(100, Math.round((allocatedCents / g.targetAmountCents) * 100))
        : 0;

    let remainingMonths = 6;
    if (g.targetOn) {
      const [ty, tm] = g.targetOn.split("-").map(Number);
      const now = new Date();
      remainingMonths = Math.max(
        1,
        (ty - now.getFullYear()) * 12 + (tm - (now.getMonth() + 1))
      );
    }

    const requiredMonthlyCents = Number(
      monthlyContribution(
        BigInt(g.targetAmountCents),
        BigInt(allocatedCents),
        remainingMonths
      )
    );

    return {
      ...g,
      allocatedCents,
      progressPct,
      remainingMonths,
      requiredMonthlyCents,
      linkedReserveName: linkedReserve?.name || "Sem cofre vinculado",
    };
  });

  // 9. Carteira de Investimentos Persistida (Pacote 03)
  let totalPortfolioCostCents = 0;
  let totalPortfolioGrossCents = 0;
  let totalPortfolioNetCents = 0;

  for (const pos of investmentPositions) {
    totalPortfolioCostCents += pos.costBasisCents;
    totalPortfolioGrossCents += pos.currentGrossCents;
    const isExemptPF =
      (pos.kind === "LCI" || pos.kind === "LCA") &&
      activeWorkspace.type === "PERSONAL";
    if (isExemptPF) {
      totalPortfolioNetCents += pos.currentGrossCents;
    } else {
      const red = taxableFixedIncomeRedemption({
        principal: pos.costBasisCents / 100,
        grossRedemption: pos.currentGrossCents / 100,
        days: Math.max(30, pos.daysHeld),
      });
      totalPortfolioNetCents += Math.round(red.netRedemption * 100);
    }
  }

  const liqP03 = projectLiquidity(
    investmentPositions.map((p) => ({
      amount: p.currentGrossCents / 100,
      redemptionAvailableAt: p.redemptionAvailableAt,
    })),
    today
  );

  // 9B. Concentração Real por Categoria de Despesa (substitui valor fixo 42%)
  const expenseCategoryMap = new Map<
    string,
    {
      categoryName: string;
      isEssential: boolean;
      realizedCents: number;
      projectedCents: number;
    }
  >();

  for (const tx of normalizedTransactions) {
    if (tx.kind !== "EXPENSE" || tx.status === "CANCELED") continue;
    const label = tx.categoryName || "Despesas Gerais";
    const cur = expenseCategoryMap.get(label) ?? {
      categoryName: label,
      isEssential: tx.isEssential,
      realizedCents: 0,
      projectedCents: 0,
    };
    if (tx.status === "SETTLED") cur.realizedCents += tx.amountCents;
    else if (tx.status === "PENDING") cur.projectedCents += tx.amountCents;
    expenseCategoryMap.set(label, cur);
  }

  for (const inst of enrichedInstallments) {
    if (
      inst.direction !== "PAYABLE" ||
      inst.derivedStatus === "PAID" ||
      inst.derivedStatus === "CANCELED"
    ) {
      continue;
    }
    const label = inst.categoryName || "Geral";
    const matchedCat = categories.find(
      (c) => c.name.toLowerCase() === label.toLowerCase()
    );
    const cur = expenseCategoryMap.get(label) ?? {
      categoryName: label,
      isEssential: matchedCat ? matchedCat.isEssential : true,
      realizedCents: 0,
      projectedCents: 0,
    };
    cur.projectedCents += inst.outstandingCents;
    expenseCategoryMap.set(label, cur);
  }

  const totalMonitoredExpenseCents = [...expenseCategoryMap.values()].reduce(
    (s, item) => s + item.realizedCents + item.projectedCents,
    0
  );
  const maxCategoryExpenseCents = [...expenseCategoryMap.values()].reduce(
    (max, item) => Math.max(max, item.realizedCents + item.projectedCents),
    0
  );
  const topExpenseCategorySharePct =
    totalMonitoredExpenseCents > 0
      ? Math.round((maxCategoryExpenseCents / totalMonitoredExpenseCents) * 100)
      : 0;

  // 10. Motor de Inteligência e Qualidade de Dados (Pacote 04)
  const unreconciledCount = importedTransactions.filter(
    (it) => it.state === "STAGED"
  ).length;
  const staleQuotesCount = investmentPositions.filter(
    (p) => p.quoteStatus === "STALE"
  ).length;
  const p04Quality = qualityStatus({
    missingAccounts: accounts.filter((a) => a.status === "ACTIVE").length === 0 ? 1 : 0,
    unreconciledTransactions: unreconciledCount,
    staleMarketPrices: staleQuotesCount,
  });

  const overdueItems = enrichedInstallments.filter(
    (i) => i.derivedStatus === "OVERDUE"
  );
  const exceededBudgetsCount = computedBudgets.filter(
    (b) => b.usagePct > 100
  ).length;

  const hasSufficientData =
    accounts.length > 0 ||
    transactions.length > 0 ||
    enrichedInstallments.length > 0 ||
    investmentPositions.length > 0;

  const healthIndex = calculateFinancialHealthIndex({
    hasSufficientData,
    asOf: today,
    eligibleBalanceCents,
    minForecastBalanceCents,
    safetyBufferCents: activeWorkspace.safetyBufferCents,
    overdueInstallmentsCount: overdueItems.length,
    totalInstallmentsCount: enrichedInstallments.length,
    exceededBudgetsCount,
    totalBudgetsCount: computedBudgets.length,
    allocatedReservesCents: totalAllocatedReservesCents,
    topExpenseCategorySharePct,
  });

  const savingsRateRatio = savingsRate(
    consolidatedTotals.settledIncomeCents,
    consolidatedTotals.settledExpenseCents
  );

  // Projeção P04 (projectCash) sobre eventos pendentes + recorrências no horizonte
  const p04Events = [
    ...enrichedInstallments
      .filter(
        (i) => i.derivedStatus !== "PAID" && i.derivedStatus !== "CANCELED"
      )
      .map((i) => ({
        id: `inst_${i.id}`,
        date: i.dueOn < today ? today : i.dueOn,
        amountCents: i.outstandingCents,
        status: "PENDING" as const,
        kind:
          i.direction === "RECEIVABLE"
            ? ("INCOME" as const)
            : ("EXPENSE" as const),
      })),
    ...standalonePendingTxs.map((ptx) => ({
      id: `ptx_${ptx.id}`,
      date: (ptx.dueOn || ptx.occurredOn) < today ? today : ptx.dueOn || ptx.occurredOn,
      amountCents: ptx.amountCents,
      status: "PENDING" as const,
      kind:
        ptx.kind === "INCOME" ? ("INCOME" as const) : ("EXPENSE" as const),
    })),
    ...projectedRecurrenceOccurrences
      .filter((r) => r.date <= addDaysIso(today, horizonDays))
      .map((r) => ({
        id: r.id,
        date: r.date,
        amountCents: r.amountCents,
        status: "PENDING" as const,
        kind: r.kind,
      })),
  ];

  const p04Projection = projectCash(
    eligibleBalanceCents,
    today,
    addDaysIso(today, horizonDays),
    p04Events
  );

  const p04RiskInsights = detectCashRisk(
    p04Projection,
    "ledger+installments+recurrences"
  );

  // 10B. Normalização de Conexões, Lotes, Conciliação (com Auto-Match) e Insights P04
  const normalizedConnections = financialConnections.map((c) => ({
    ...c,
    providerId: c.providerCode,
    scopes:
      c.consentScopes || "ACCOUNTS_READ, BALANCES_READ, TRANSACTIONS_READ",
    consentExpiresAt: c.consentExpiresAt
      ? c.consentExpiresAt.toISOString()
      : null,
    lastSyncedAt: c.lastSyncAt ? c.lastSyncAt.toISOString() : null,
  }));

  const normalizedImportBatches = importBatches.map((b) => {
    const batchTxs = importedTransactions.filter(
      (t) => t.importBatchId === b.id
    );
    const batchAudit = auditEvents.find(
      (ae) => ae.entityId === b.id && ae.action === "import.batch_staged"
    );
    let meta: {
      stagedCount?: number;
      duplicateCount?: number;
      errorCount?: number;
    } = {};
    if (batchAudit?.metadataJson) {
      try {
        meta = JSON.parse(batchAudit.metadataJson);
      } catch {
        // ignore
      }
    }
    const importedRows = meta.stagedCount ?? batchTxs.length;
    const duplicateRows = meta.duplicateCount ?? 0;
    const errorRows = meta.errorCount ?? 0;
    return {
      ...b,
      sourceKind: b.sourceType,
      fileHash: b.inputChecksum,
      totalRows: importedRows + duplicateRows + errorRows,
      importedRows,
      duplicateRows,
      errorRows,
      createdAt: b.createdAt.toISOString(),
    };
  });

  const normalizedImportedTransactions = importedTransactions.map((it) => {
    const reconciliationState: "STAGED" | "RECONCILED" | "IGNORED" =
      it.state === "IMPORTED"
        ? "RECONCILED"
        : it.state === "IGNORED"
        ? "IGNORED"
        : "STAGED";

    let suggestedMatch: {
      kind: "TRANSACTION" | "INSTALLMENT";
      id: string;
      title: string;
      dueOn: string;
      amountCents: number;
    } | null = null;

    if (reconciliationState === "STAGED" && it.direction !== "SELF_TRANSFER") {
      const wantIncome = it.direction === "CREDIT";
      const matchTx = standalonePendingTxs.find(
        (ptx) =>
          (wantIncome ? ptx.kind === "INCOME" : ptx.kind === "EXPENSE") &&
          ptx.amountCents === it.amountCents &&
          diffDaysAbs(ptx.dueOn || ptx.occurredOn, it.postedOn) <= 5
      );
      if (matchTx) {
        suggestedMatch = {
          kind: "TRANSACTION",
          id: matchTx.id,
          title: matchTx.description,
          dueOn: matchTx.dueOn || matchTx.occurredOn,
          amountCents: matchTx.amountCents,
        };
      } else {
        const matchInst = enrichedInstallments.find(
          (inst) =>
            inst.derivedStatus !== "PAID" &&
            inst.derivedStatus !== "CANCELED" &&
            (wantIncome
              ? inst.direction === "RECEIVABLE"
              : inst.direction === "PAYABLE") &&
            inst.outstandingCents === it.amountCents &&
            diffDaysAbs(inst.dueOn, it.postedOn) <= 5
        );
        if (matchInst) {
          suggestedMatch = {
            kind: "INSTALLMENT",
            id: matchInst.id,
            title: `${matchInst.obligationTitle} (${matchInst.number}/${matchInst.totalInstallments})`,
            dueOn: matchInst.dueOn,
            amountCents: matchInst.outstandingCents,
          };
        }
      }
    }

    return {
      ...it,
      occurredAt: it.postedOn,
      dedupeKey: it.rawHash,
      reconciliationState,
      reconciledLedgerTxId: it.matchedLedgerEntryId,
      suggestedMatch,
    };
  });

  const normalizedStoredInsights = storedInsights.map((ins) => {
    const mappedSeverity: "CRITICAL" | "WARNING" | "INFO" =
      ins.severity === "CRITICAL" || ins.severity === "HIGH"
        ? "CRITICAL"
        : ins.severity === "WARNING" || ins.severity === "MEDIUM"
        ? "WARNING"
        : "INFO";
    const mappedStatus: "ACTIVE" | "ACKNOWLEDGED" | "DISMISSED" | "RESOLVED" =
      ins.state === "NEW" || ins.state === "ACTIVE"
        ? "ACTIVE"
        : ins.state === "READ" || ins.state === "ACKNOWLEDGED"
        ? "ACKNOWLEDGED"
        : ins.state === "DISMISSED"
        ? "DISMISSED"
        : "RESOLVED";

    let evObj: Record<string, string> = {};
    try {
      const parsed = JSON.parse(ins.evidenceJson);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item && typeof item === "object") {
            const k = String(item.label || item.metric || "evidencia");
            evObj[k] = String(item.value ?? "");
          }
        }
      } else if (parsed && typeof parsed === "object") {
        evObj = parsed as Record<string, string>;
      }
    } catch {
      evObj = {};
    }

    return {
      ...ins,
      severity: mappedSeverity,
      status: mappedStatus,
      summary: ins.explanation,
      explanationJson: JSON.stringify({
        cause: ins.explanation,
        action:
          ins.code.includes("RESERVE")
            ? "Avalie alocar parte da margem livre em um Cofre ou aplicação D+0."
            : "Revise seus lançamentos e vencimentos no horizonte ativo.",
      }),
      evidenceJson: JSON.stringify(evObj),
      originModule: "Intelligence P04",
      ruleVersion: ins.sourceVersion || "4.0.0",
      detectedAt: ins.createdAt.toISOString(),
    };
  });

  const existingInsightCodes = new Set(
    normalizedStoredInsights.map((i) => i.code)
  );
  const dynamicInsights: Array<{
    id: string;
    code: string;
    title: string;
    severity: "INFO" | "WARNING" | "CRITICAL";
    status: "ACTIVE" | "ACKNOWLEDGED" | "DISMISSED" | "RESOLVED";
    state: string;
    explanation: string;
    summary: string;
    explanationJson: string;
    evidenceJson: string;
    originModule: string;
    ruleVersion: string;
    sourceVersion: string;
    detectedAt: string;
  }> = [];

  for (const rIns of p04RiskInsights) {
    if (existingInsightCodes.has(rIns.code)) continue;
    dynamicInsights.push({
      id: `dyn_ins_${rIns.code}`,
      code: rIns.code,
      title: rIns.title,
      severity: rIns.priority === "HIGH" ? "CRITICAL" : "WARNING",
      status: "ACTIVE",
      state: "NEW",
      explanation: rIns.explanation,
      summary: rIns.explanation,
      explanationJson: JSON.stringify({
        cause: rIns.explanation,
        action:
          "Antecipe recebíveis, reprograme saídas ou utilize liquidez imediata para cobrir o vale de caixa.",
      }),
      evidenceJson: JSON.stringify({
        "Menor Saldo Projetado": `R$ ${centsToDecimalString(
          p04Projection.minimumCents
        )}`,
      }),
      originModule: "Forecast P04",
      ruleVersion: "4.0.0",
      sourceVersion: "4.0.0",
      detectedAt: new Date().toISOString(),
    });
  }

  if (
    hasSufficientData &&
    headroomCents > 0 &&
    !existingInsightCodes.has("RESERVE_HEADROOM_AVAILABLE")
  ) {
    const summaryText = `Há margem segura de R$ ${centsToDecimalString(
      headroomCents
    )} para alocar em reservas ou investimentos D+0 preservando sua margem de segurança.`;
    dynamicInsights.push({
      id: "dyn_ins_headroom",
      code: "RESERVE_HEADROOM_AVAILABLE",
      title: "Capacidade Segura de Reserva Identificada",
      severity: "INFO",
      status: "ACTIVE",
      state: "NEW",
      explanation: summaryText,
      summary: summaryText,
      explanationJson: JSON.stringify({
        cause: summaryText,
        action:
          "Acesse Reservas e Cofres ou o Comparador de Investimentos para direcionar o excedente.",
      }),
      evidenceJson: JSON.stringify({
        "Margem Segura": `R$ ${centsToDecimalString(headroomCents)}`,
        "Menor Saldo Projetado": `R$ ${centsToDecimalString(
          minForecastBalanceCents
        )}`,
      }),
      originModule: "ReserveCapacity P02+P04",
      ruleVersion: "4.0.0",
      sourceVersion: "4.0.0",
      detectedAt: new Date().toISOString(),
    });
  }

  const normalizedConsentAudits = consentAudits.map((ca) => ({
    ...ca,
    actorUserId: ca.actorId,
    scopes: ca.scopesJson,
    createdAt: ca.eventAt.toISOString(),
  }));

  // 11. Alertas Dinâmicos + Persistidos (Central de Alertas P02 + P04)
  const dynamicAlerts: Array<{
    id: string;
    type: string;
    severity: "INFO" | "WARNING" | "CRITICAL";
    title: string;
    message: string;
    occurrenceOn: string;
    state: string;
  }> = storedAlerts.map((a) => ({
    id: a.id,
    type: a.type,
    severity: (a.severity as "INFO" | "WARNING" | "CRITICAL") || "INFO",
    title: a.title,
    message: a.message,
    occurrenceOn: a.occurrenceOn,
    state: a.state,
  }));

  if (overdueItems.length > 0) {
    dynamicAlerts.unshift({
      id: "dyn-overdue",
      type: "OVERDUE",
      severity: "CRITICAL",
      title: `${overdueItems.length} compromisso(s) vencido(s) em aberto`,
      message: `Existem parcelas vencidas aguardando baixa ou renegociação (Total: R$ ${centsToDecimalString(
        overdueItems.reduce((s, i) => s + i.outstandingCents, 0)
      )}).`,
      occurrenceOn: today,
      state: "NEW",
    });
  }

  if (freeCashCents < 0) {
    dynamicAlerts.unshift({
      id: "dyn-overallocated",
      type: "RESERVE_OVERALLOCATED",
      severity: "CRITICAL",
      title: "Déficit de cobertura das Reservas Virtuais",
      message: `O saldo bancário elegível (R$ ${centsToDecimalString(
        eligibleBalanceCents
      )}) ficou abaixo do total alocado em cofres (R$ ${centsToDecimalString(
        totalAllocatedReservesCents
      )}). Revise ou libere alocações.`,
      occurrenceOn: today,
      state: "NEW",
    });
  }

  if (minForecastBalanceCents < 0) {
    dynamicAlerts.unshift({
      id: "dyn-shortfall",
      type: "CASH_SHORTFALL",
      severity: "CRITICAL",
      title: "Risco de saldo negativo projetado no horizonte",
      message: `O menor saldo projetado atinge R$ ${centsToDecimalString(
        minForecastBalanceCents
      )} nos próximos ${horizonDays} dias.`,
      occurrenceOn: today,
      state: "NEW",
    });
  }

  if (unreconciledCount > 0) {
    dynamicAlerts.unshift({
      id: "dyn-unreconciled",
      type: "IMPORT_RECONCILIATION_PENDING",
      severity: "WARNING",
      title: `${unreconciledCount} lançamento(s) importado(s) aguardando conciliação`,
      message:
        "Confirme ou ignore os itens no módulo Integrações → Conciliação para liberar sugestões automáticas.",
      occurrenceOn: today,
      state: "NEW",
    });
  }

  const openPayablesCents = enrichedInstallments
    .filter(
      (i) =>
        i.direction === "PAYABLE" &&
        i.derivedStatus !== "PAID" &&
        i.derivedStatus !== "CANCELED"
    )
    .reduce((s, i) => s + i.outstandingCents, 0);

  const openReceivablesCents = enrichedInstallments
    .filter(
      (i) =>
        i.direction === "RECEIVABLE" &&
        i.derivedStatus !== "PAID" &&
        i.derivedStatus !== "CANCELED"
    )
    .reduce((s, i) => s + i.outstandingCents, 0);

  // 12. Demonstrativo Gerencial PF / DRE Simplificado PJ & Calendário Preditivo 21d (Pacote 11)
  const monthPeriods: string[] = [];
  for (let offset = -5; offset <= 3; offset++) {
    monthPeriods.push(addMonthsIso(`${today.slice(0, 7)}-01`, offset).slice(0, 7));
  }

  const monthlySummary = monthPeriods.map((period) => {
    let realizedIncomeCents = 0;
    let realizedExpenseCents = 0;
    let projectedIncomeCents = 0;
    let projectedExpenseCents = 0;

    for (const tx of normalizedTransactions) {
      if (tx.status === "CANCELED") continue;
      if (tx.status === "SETTLED") {
        const refMonth = (tx.settledOn || tx.occurredOn).slice(0, 7);
        if (refMonth !== period) continue;
        if (tx.kind === "INCOME") realizedIncomeCents += tx.amountCents;
        else if (tx.kind === "EXPENSE") realizedExpenseCents += tx.amountCents;
      } else if (tx.status === "PENDING") {
        const refMonth = (tx.dueOn || tx.occurredOn).slice(0, 7);
        if (refMonth !== period) continue;
        if (tx.kind === "INCOME") projectedIncomeCents += tx.amountCents;
        else if (tx.kind === "EXPENSE") projectedExpenseCents += tx.amountCents;
      }
    }

    for (const inst of enrichedInstallments) {
      if (inst.derivedStatus === "PAID" || inst.derivedStatus === "CANCELED") {
        continue;
      }
      if (inst.dueOn.slice(0, 7) !== period) continue;
      if (inst.direction === "RECEIVABLE") {
        projectedIncomeCents += inst.outstandingCents;
      } else {
        projectedExpenseCents += inst.outstandingCents;
      }
    }

    for (const recOcc of projectedRecurrenceOccurrences) {
      if (recOcc.date.slice(0, 7) !== period) continue;
      if (recOcc.kind === "INCOME") projectedIncomeCents += recOcc.amountCents;
      else projectedExpenseCents += recOcc.amountCents;
    }

    return {
      period,
      realizedIncomeCents,
      realizedExpenseCents,
      projectedIncomeCents,
      projectedExpenseCents,
      netRealizedCents: realizedIncomeCents - realizedExpenseCents,
      netProjectedCents:
        realizedIncomeCents +
        projectedIncomeCents -
        (realizedExpenseCents + projectedExpenseCents),
    };
  });

  const categoryBreakdown = [...expenseCategoryMap.values()]
    .map((item) => {
      const totalCents = item.realizedCents + item.projectedCents;
      return {
        ...item,
        totalCents,
        sharePct:
          totalMonitoredExpenseCents > 0
            ? Math.round((totalCents / totalMonitoredExpenseCents) * 100)
            : 0,
      };
    })
    .sort((a, b) => b.totalCents - a.totalCents);

  const counterpartyStatsMap = new Map<
    string,
    {
      name: string;
      document: string | null;
      costCenter: string | null;
      totalExpenseCents: number;
      totalIncomeCents: number;
      txCount: number;
    }
  >();

  for (const cp of counterparties) {
    counterpartyStatsMap.set(cp.name.toLowerCase(), {
      name: cp.name,
      document: cp.document,
      costCenter: cp.costCenter,
      totalExpenseCents: 0,
      totalIncomeCents: 0,
      txCount: 0,
    });
  }

  for (const tx of normalizedTransactions) {
    if (tx.status === "CANCELED" || !tx.counterpartyName) continue;
    const key = tx.counterpartyName.toLowerCase();
    const entry = counterpartyStatsMap.get(key) ?? {
      name: tx.counterpartyName,
      document: null,
      costCenter: tx.costCenter,
      totalExpenseCents: 0,
      totalIncomeCents: 0,
      txCount: 0,
    };
    if (tx.kind === "EXPENSE") entry.totalExpenseCents += tx.amountCents;
    else if (tx.kind === "INCOME") entry.totalIncomeCents += tx.amountCents;
    entry.txCount += 1;
    counterpartyStatsMap.set(key, entry);
  }

  for (const inst of enrichedInstallments) {
    if (inst.derivedStatus === "CANCELED" || !inst.counterparty) continue;
    const key = inst.counterparty.toLowerCase();
    const entry = counterpartyStatsMap.get(key) ?? {
      name: inst.counterparty,
      document: null,
      costCenter: inst.costCenter || null,
      totalExpenseCents: 0,
      totalIncomeCents: 0,
      txCount: 0,
    };
    if (inst.derivedStatus !== "PAID") {
      if (inst.direction === "PAYABLE") {
        entry.totalExpenseCents += inst.outstandingCents;
      } else {
        entry.totalIncomeCents += inst.outstandingCents;
      }
      entry.txCount += 1;
    }
    counterpartyStatsMap.set(key, entry);
  }

  const counterpartyBreakdown = [...counterpartyStatsMap.values()].sort(
    (a, b) =>
      b.totalExpenseCents +
      b.totalIncomeCents -
      (a.totalExpenseCents + a.totalIncomeCents)
  );

  // Calendário Financeiro Preditivo de 21 dias (alimenta AssistantAndCalendarView)
  const calendarDaysCount = 21;
  let runningCalBalance = eligibleBalanceCents;
  const predictiveCalendar21d = Array.from(
    { length: calendarDaysCount },
    (_, idx) => {
      const dateIso = addDaysIso(today, idx);
      const events: Array<{
        id: string;
        title: string;
        description: string;
        kind: "INCOME" | "EXPENSE";
        type: string;
        amountCents: number;
        status: "SETTLED" | "PREDICTED";
      }> = [];

      // Eventos já liquidados exatamente nesta data (informativos; não somam novamente no saldo!)
      for (const tx of normalizedTransactions) {
        if (tx.status === "SETTLED" && tx.occurredOn === dateIso) {
          if (tx.kind === "INCOME" || tx.kind === "EXPENSE") {
            events.push({
              id: tx.id,
              title: tx.description,
              description: `${tx.description} (Realizado)`,
              kind: tx.kind,
              type: tx.kind,
              amountCents: tx.amountCents,
              status: "SETTLED",
            });
          }
        }
      }

      let inflowCents = 0;
      let outflowCents = 0;

      for (const inst of enrichedInstallments) {
        if (
          inst.derivedStatus === "PAID" ||
          inst.derivedStatus === "CANCELED"
        ) {
          continue;
        }
        const matches =
          inst.dueOn === dateIso || (idx === 0 && inst.dueOn < today);
        if (!matches) continue;
        const evKind = inst.direction === "RECEIVABLE" ? "INCOME" : "EXPENSE";
        const label = `${inst.obligationTitle} (${inst.number}/${inst.totalInstallments})`;
        events.push({
          id: inst.id,
          title: label,
          description: label,
          kind: evKind,
          type: evKind,
          amountCents: inst.outstandingCents,
          status: "PREDICTED",
        });
        if (evKind === "INCOME") inflowCents += inst.outstandingCents;
        else outflowCents += inst.outstandingCents;
      }

      for (const ptx of standalonePendingTxs) {
        const target = ptx.dueOn || ptx.occurredOn;
        const matches = target === dateIso || (idx === 0 && target < today);
        if (!matches) continue;
        const evKind = ptx.kind === "INCOME" ? "INCOME" : "EXPENSE";
        events.push({
          id: ptx.id,
          title: ptx.description,
          description: ptx.description,
          kind: evKind,
          type: evKind,
          amountCents: ptx.amountCents,
          status: "PREDICTED",
        });
        if (evKind === "INCOME") inflowCents += ptx.amountCents;
        else outflowCents += ptx.amountCents;
      }

      for (const recOcc of projectedRecurrenceOccurrences) {
        if (recOcc.date !== dateIso) continue;
        const label = `${recOcc.title} (Recorrência)`;
        events.push({
          id: recOcc.id,
          title: label,
          description: label,
          kind: recOcc.kind,
          type: recOcc.kind,
          amountCents: recOcc.amountCents,
          status: "PREDICTED",
        });
        if (recOcc.kind === "INCOME") inflowCents += recOcc.amountCents;
        else outflowCents += recOcc.amountCents;
      }

      runningCalBalance += inflowCents - outflowCents;
      const riskState: "SAFE" | "BELOW_SAFETY" | "NEGATIVE" =
        runningCalBalance < 0
          ? "NEGATIVE"
          : runningCalBalance < activeWorkspace.safetyBufferCents
          ? "BELOW_SAFETY"
          : "SAFE";

      const [, mm, dd] = dateIso.split("-");
      return {
        dateIso,
        dayLabel: `${dd}/${mm}`,
        inflowCents,
        outflowCents,
        projectedBalanceCents: runningCalBalance,
        riskState,
        events,
      };
    }
  );

  // Despesa essencial mensal estimada para alimentar ReserveCapacityInput
  const essentialMonthlyExpensesCents = Math.max(
    categoryBreakdown
      .filter((c) => c.isEssential)
      .reduce((s, c) => s + c.realizedCents, 0),
    Math.round(consolidatedTotals.settledExpenseCents * 0.7)
  );

  // Núcleo Financeiro Canônico P05 + P06 (BigInt exato e conciliação declarada)
  const p05Accounts = computedAccounts.map((a) => ({
    id: a.id,
    workspaceId: a.workspaceId,
    name: a.name,
    openingCents: BigInt(a.openingBalanceCents),
  }));
  const p05Txs = [
    ...normalizedTransactions.map((t) => ({
      id: t.id,
      workspaceId: t.workspaceId,
      accountId: t.accountId,
      kind: t.kind,
      status: t.status,
      signedCents:
        t.kind === "EXPENSE" || t.kind === "TRANSFER_OUT"
          ? -BigInt(t.amountCents)
          : BigInt(t.amountCents),
      date: t.occurredOn,
      dueDate: t.dueOn || t.occurredOn,
      description: t.description,
    })),
    ...enrichedInstallments
      .filter(
        (i) =>
          i.derivedStatus !== "PAID" &&
          i.derivedStatus !== "CANCELED" &&
          p05Accounts.length > 0
      )
      .map((i) => ({
        id: i.id,
        workspaceId: activeWorkspace.id,
        accountId: p05Accounts[0].id,
        kind: i.direction === "PAYABLE" ? "EXPENSE" : "INCOME",
        status: "PENDING",
        signedCents:
          i.direction === "PAYABLE"
            ? -BigInt(i.outstandingCents)
            : BigInt(i.outstandingCents),
        date: i.dueOn,
        dueDate: i.dueOn,
        description: i.obligationTitle,
      })),
  ];

  const p05SummaryResult = canonicalSummary(
    p05Accounts,
    p05Txs,
    activeWorkspace.id
  );
  const p05ProjectionResult = canonicalProjection(
    p05Accounts,
    p05Txs,
    activeWorkspace.id
  );
  const isWorkspaceReconciled = Boolean(
    (activeWorkspace as { reconciled?: boolean }).reconciled
  );
  const p05CapacityResult = canonicalCapacity(
    BigInt(minForecastBalanceCents),
    BigInt(activeWorkspace.safetyBufferCents),
    BigInt(totalAllocatedReservesCents),
    isWorkspaceReconciled
  );

  const p06ReservesCombined = [
    ...p06ReservesRaw.map((r) => ({
      id: r.id,
      name: r.name,
      amountCents: r.amountCents.toString(),
    })),
    ...computedReserves.map((r) => ({
      id: r.id,
      name: r.name,
      amountCents: BigInt(r.allocatedCents).toString(),
    })),
  ];
  const p06Computed = computeP06(
    p05Accounts,
    p05Txs,
    p06ReservesCombined,
    isWorkspaceReconciled
  );

  return {
    workspaces,
    activeWorkspace,
    memberships: safeMemberships,
    accounts: computedAccounts,
    categories,
    counterparties,
    transactions: normalizedTransactions,
    recurrences: enrichedRecurrences,
    budgets: computedBudgets,
    obligations,
    installments: enrichedInstallments,
    reserves: computedReserves,
    reserveMovements,
    goals: computedGoals,
    scenarios,
    alerts: dynamicAlerts,
    auditEvents,
    investmentPositions,
    financialConnections: normalizedConnections,
    importBatches: normalizedImportBatches,
    importedTransactions: normalizedImportedTransactions,
    financialInsights: [...normalizedStoredInsights, ...dynamicInsights],
    consentAudits: normalizedConsentAudits,
    analytics: {
      monthlySummary,
      categoryBreakdown,
      counterpartyBreakdown,
      predictiveCalendar21d,
      essentialMonthlyExpensesCents,
      topExpenseCategorySharePct,
    },
    p05Canonical: {
      version: "5.0.0",
      reconciled: isWorkspaceReconciled,
      summary: p05SummaryResult,
      projection: p05ProjectionResult,
      capacity: p05CapacityResult,
    },
    p06Operational: {
      version: "6.0.0",
      reconciled: isWorkspaceReconciled,
      ...p06Computed,
      reserves: p06ReservesRaw.map((r) => ({
        ...r,
        amountCents: r.amountCents.toString(),
      })),
      investments: p06InvestmentsRaw.map((i) => ({
        ...i,
        amountCents: i.amountCents.toString(),
        asOf: i.asOf.toISOString().slice(0, 10),
      })),
      auditCount: p06AuditCount + auditEvents.length,
      idempotencyKeyCount,
      activeSessionCount,
    },
    kpis: {
      eligibleBalanceCents,
      eligibleBalanceDecimal: centsToDecimalString(eligibleBalanceCents),
      settledIncomeCents: consolidatedTotals.settledIncomeCents,
      settledExpenseCents: consolidatedTotals.settledExpenseCents,
      projectedEndBalanceCents,
      minForecastBalanceCents,
      safetyBufferCents: activeWorkspace.safetyBufferCents,
      totalAllocatedReservesCents,
      freeCashCents,
      headroomCents,
      openPayablesCents:
        openPayablesCents + consolidatedTotals.pendingExpenseCents,
      openReceivablesCents:
        openReceivablesCents + consolidatedTotals.pendingIncomeCents,
      portfolioCostCents: totalPortfolioCostCents,
      portfolioGrossCents: totalPortfolioGrossCents,
      portfolioNetCents: totalPortfolioNetCents,
      portfolioAvailableLiquidityCents: Math.round(liqP03.available * 100),
      portfolioLockedLiquidityCents: Math.round(liqP03.locked * 100),
    },
    p04Intelligence: {
      asOf: today,
      healthIndex,
      quality: p04Quality,
      savingsRatePct:
        savingsRateRatio === null
          ? null
          : Math.round(savingsRateRatio * 1000) / 10,
      riskInsights: p04RiskInsights,
      featureFlags: {
        NOVA_P4_INSIGHTS: true,
        NOVA_P4_IMPORTS: true,
        NOVA_P4_ALERTS: true,
        NOVA_P4_AI_ASSISTANT: true,
        NOVA_P4_OPEN_FINANCE: false,
        openFinanceEnabled: false,
        aiAssistantEnabled: true,
        externalMarketDataEnabled: true,
      },
    },
    reserveCapacityReport: {
      eligibleBalance: centsToDecimalString(eligibleBalanceCents),
      minForecastBalance: centsToDecimalString(minForecastBalanceCents),
      safetyBuffer: centsToDecimalString(activeWorkspace.safetyBufferCents),
      alreadyAllocated: centsToDecimalString(totalAllocatedReservesCents),
      overdueUncounted: "0.00",
      headroom: centsToDecimalString(headroomCents),
      headroomCents,
      confidence,
      explanations,
      asOf: new Date().toISOString(),
      calculationVersion: "4.0.0",
    },
    forecastSeries: forecastPoints.map((p) => ({
      date: p.date,
      startingCents: Number(p.starting),
      inboundCents: Number(p.inbound),
      outboundCents: Number(p.outbound),
      endingCents: Number(p.ending),
      isCritical: Number(p.ending) < activeWorkspace.safetyBufferCents,
      isNegative: Number(p.ending) < 0,
    })),
  };
}
