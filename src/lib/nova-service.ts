import { prisma } from "./prisma";
import {
  allocationBalance,
  buildForecast,
  calculateReserveCapacity,
  centsToDecimalString,
  computeAccountBalanceCents,
  computeConsolidatedTotals,
  ForecastEntry,
  monthlyContribution,
  remainingInstallment,
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

/**
 * Garante que o usuário padrão e os dois workspaces (Pessoal PF e Empresarial PJ)
 * existam, começando em ESTADO ZERO (R$ 0,00 - Aguardando lançamentos) conforme P01/P02/P03/P04.
 */
export async function ensureBaseWorkspaces() {
  const existingUsers = await prisma.user.count();
  if (existingUsers > 0) return;

  const user = await prisma.user.create({
    data: {
      id: "usr-nova-owner",
      email: "titular@nova.fin.br",
      passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$nova_hash_protegido",
      name: "Vinícius (Titular)",
      status: "ACTIVE",
    },
  });

  const wsPF = await prisma.workspace.create({
    data: {
      id: "ws-nova-pf",
      type: "PERSONAL",
      name: "Meu Financeiro Pessoal",
      baseCurrency: "BRL",
      timezone: "America/Sao_Paulo",
      safetyBufferCents: 0,
      version: 1,
    },
  });

  const wsPJ = await prisma.workspace.create({
    data: {
      id: "ws-nova-pj",
      type: "BUSINESS",
      name: "NOVA Empresa Ltda",
      baseCurrency: "BRL",
      timezone: "America/Sao_Paulo",
      safetyBufferCents: 0,
      version: 1,
    },
  });

  await prisma.membership.createMany({
    data: [
      {
        workspaceId: wsPF.id,
        userId: user.id,
        role: "OWNER",
        status: "ACTIVE",
      },
      {
        workspaceId: wsPJ.id,
        userId: user.id,
        role: "OWNER",
        status: "ACTIVE",
      },
    ],
  });

  // Categorias base (sem lançamentos nem saldos fictícios)
  await prisma.category.createMany({
    data: [
      { workspaceId: wsPF.id, type: "INCOME", name: "Salário", isEssential: true },
      { workspaceId: wsPF.id, type: "INCOME", name: "Renda Extra", isEssential: false },
      { workspaceId: wsPF.id, type: "EXPENSE", name: "Moradia", isEssential: true },
      { workspaceId: wsPF.id, type: "EXPENSE", name: "Alimentação", isEssential: true },
      { workspaceId: wsPF.id, type: "EXPENSE", name: "Saúde", isEssential: true },
      { workspaceId: wsPF.id, type: "EXPENSE", name: "Transporte", isEssential: true },
      { workspaceId: wsPF.id, type: "EXPENSE", name: "Estilo de Vida", isEssential: false },

      { workspaceId: wsPJ.id, type: "INCOME", name: "Recebimento de Clientes", isEssential: true },
      { workspaceId: wsPJ.id, type: "INCOME", name: "Contratos Recorrentes", isEssential: true },
      { workspaceId: wsPJ.id, type: "EXPENSE", name: "Fornecedores", isEssential: true },
      { workspaceId: wsPJ.id, type: "EXPENSE", name: "Folha e Encargos", isEssential: true },
      { workspaceId: wsPJ.id, type: "EXPENSE", name: "Tributos e Impostos", isEssential: true },
      { workspaceId: wsPJ.id, type: "EXPENSE", name: "Tecnologia e Operação", isEssential: true },
      { workspaceId: wsPJ.id, type: "EXPENSE", name: "Comercial e Marketing", isEssential: false },
    ],
  });

  // Cenários base P02 e Catálogo de Conexões P04 (DISCONNECTED por padrão, sem credenciais)
  for (const ws of [wsPF, wsPJ]) {
    await prisma.novaPlanningScenario.createMany({
      data: [
        {
          workspaceId: ws.id,
          name: "Cenário Base (Realista)",
          kind: "BASE",
          contingencyBufferPct: 0,
          hypotheticalInflowCents: 0,
          hypotheticalOutflowCents: 0,
          notes: "Projeção oficial utilizando compromissos confirmados.",
          createdBy: user.id,
        },
        {
          workspaceId: ws.id,
          name: "Cenário Conservador",
          kind: "CONSERVATIVE",
          contingencyBufferPct: 10,
          hypotheticalInflowCents: 0,
          hypotheticalOutflowCents: 0,
          notes: "Considera apenas recebíveis de alta confiança e adiciona contingência de 10% nas saídas.",
          createdBy: user.id,
        },
        {
          workspaceId: ws.id,
          name: "Cenário Otimista",
          kind: "OPTIMISTIC",
          contingencyBufferPct: 0,
          hypotheticalInflowCents: 0,
          hypotheticalOutflowCents: 0,
          notes: "Inclui recebíveis de confiança média e receitas potenciais.",
          createdBy: user.id,
        },
      ],
    });

    await prisma.financialConnection.createMany({
      data: [
        {
          workspaceId: ws.id,
          providerCode: "ITAU_OPENFINANCE_BR",
          institutionName: "Itaú Unibanco (Open Finance Read-Only)",
          status: "DISCONNECTED",
        },
        {
          workspaceId: ws.id,
          providerCode: "NUBANK_OPENFINANCE_BR",
          institutionName: "Nu Pagamentos / Nubank (Open Finance Read-Only)",
          status: "DISCONNECTED",
        },
        {
          workspaceId: ws.id,
          providerCode: "BTG_OPENFINANCE_BR",
          institutionName: "BTG Pactual Empresas & Investimentos",
          status: "DISCONNECTED",
        },
      ],
    });
  }
}

/**
 * Valida acesso RBAC ao workspace.
 */
export async function authorizeWorkspaceAccess(
  workspaceId: string,
  userId = "usr-nova-owner",
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
 * Calcula todos os indicadores consolidados (P01 + P02 + P03 + P04), saldos por conta,
 * fluxo de caixa projetado, capacidade conservadora de reserva, carteira de investimentos,
 * índice de saúde financeira ponderado, qualidade dos dados e conexões/importações.
 */
export async function getWorkspaceFullState(params: {
  workspaceId?: string;
  horizonDays?: number;
  scenarioKind?: "BASE" | "CONSERVATIVE" | "OPTIMISTIC";
}) {
  await ensureBaseWorkspaces();

  const workspaces = await prisma.workspace.findMany({
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
      where: { workspaceId: wsId },
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
      take: 50,
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
  ]);

  const today = todayIso();

  // 1. Saldos por conta usando Invariante P01 #2
  const computedAccounts = accounts.map((acc) => {
    const accTxs = transactions.filter((t) => t.accountId === acc.id);
    const currentBalanceCents = computeAccountBalanceCents(
      acc.openingBalanceCents,
      accTxs
    );
    const settledCount = accTxs.filter((t) => t.status === "SETTLED").length;
    return {
      ...acc,
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
  const consolidatedTotals = computeConsolidatedTotals(transactions);

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
        categoryName: ob.categoryName || "Geral",
        counterparty: ob.counterparty || "",
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
  const standalonePendingTxs = transactions.filter(
    (t) =>
      t.status === "PENDING" &&
      !linkedTxIds.has(t.id) &&
      (t.kind === "INCOME" || t.kind === "EXPENSE")
  );

  // 4. Série Diária de Fluxo de Caixa Projetado (buildForecast P02)
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
      "Compromissos em aberto e vencidos descontados uma única vez na projeção diária."
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
    const realizedCents = transactions
      .filter(
        (t) =>
          t.status === "SETTLED" &&
          t.kind === "EXPENSE" &&
          (t.categoryId === b.categoryId ||
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

  // 10. Motor de Inteligência e Qualidade de Dados (Pacote 04)
  const unreconciledCount = importedTransactions.filter(
    (it) => it.state === "STAGED"
  ).length;
  const staleQuotesCount = investmentPositions.filter(
    (p) => p.quoteStatus === "STALE"
  ).length;
  const p04Quality = qualityStatus({
    missingAccounts: accounts.length === 0 ? 1 : 0,
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
    topExpenseCategorySharePct: 42,
  });

  const savingsRateRatio = savingsRate(
    consolidatedTotals.settledIncomeCents,
    consolidatedTotals.settledExpenseCents
  );

  // Projeção P04 (projectCash) sobre eventos pendentes
  const p04Events = enrichedInstallments
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
    }));

  const p04Projection = projectCash(
    eligibleBalanceCents,
    today,
    addDaysIso(today, horizonDays),
    p04Events
  );

  const p04RiskInsights = detectCashRisk(p04Projection, "ledger+installments");

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

  // Núcleo Financeiro Canônico P05 (BigInt exato e conciliação declarada)
  const p05Accounts = accounts.map((a) => ({
    id: a.id,
    workspaceId: a.workspaceId,
    name: a.name,
    openingCents: BigInt(a.openingBalanceCents),
  }));
  const p05Txs = [
    ...transactions.map((t) => ({
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

  return {
    workspaces,
    activeWorkspace,
    memberships,
    accounts: computedAccounts,
    categories,
    counterparties,
    transactions,
    recurrences,
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
    financialConnections,
    importBatches,
    importedTransactions,
    financialInsights: storedInsights,
    consentAudits,
    p05Canonical: {
      version: "5.0.0",
      reconciled: isWorkspaceReconciled,
      summary: p05SummaryResult,
      projection: p05ProjectionResult,
      capacity: p05CapacityResult,
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
      openPayablesCents: openPayablesCents + consolidatedTotals.pendingExpenseCents,
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
