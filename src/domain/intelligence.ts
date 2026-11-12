/**
 * NOVA — Pacote 04: Motor de Inteligência Financeira, Qualidade de Dados e Assistente Somente Leitura
 * Valores financeiros utilizam inteiros seguros em centavos (MoneyCents).
 */

export type MoneyCents = number;

export interface FutureCashflow {
  date: string;
  amountCents: MoneyCents;
  status: "PENDING" | "SETTLED" | "CANCELED";
  kind: "INCOME" | "EXPENSE";
  id: string;
}

export interface ProjectionResult {
  asOf: string;
  minimumCents: number;
  closingCents: number;
  points: ReadonlyArray<{ date: string; balanceCents: number }>;
}

const assertAmount = (n: number) => {
  if (!Number.isSafeInteger(n) || n < 0) {
    throw new Error("Amount must be nonnegative safe integer cents");
  }
};

const assertSigned = (n: number) => {
  if (!Number.isSafeInteger(n)) {
    throw new Error("Unsafe cents");
  }
};

const isoDate = (d: string) => {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(d) ||
    Number.isNaN(Date.parse(d + "T00:00:00Z")) ||
    new Date(d + "T00:00:00Z").toISOString().slice(0, 10) !== d
  ) {
    throw new Error("Invalid ISO date");
  }
  return d;
};

/**
 * Projection takes settled opening balance and only PENDING future items to avoid double counting.
 */
export function projectCash(
  openingCents: number,
  asOf: string,
  through: string,
  events: readonly FutureCashflow[]
): ProjectionResult {
  assertSigned(openingCents);
  isoDate(asOf);
  isoDate(through);
  if (through < asOf) throw new Error("Inverted period");

  const seen = new Set<string>();
  const buckets = new Map<string, number>();

  for (const e of events) {
    assertAmount(e.amountCents);
    isoDate(e.date);
    if (seen.has(e.id)) throw new Error("Duplicate cashflow id");
    seen.add(e.id);
    if (e.status !== "PENDING" || e.date < asOf || e.date > through) continue;
    const signed = e.kind === "INCOME" ? e.amountCents : -e.amountCents;
    buckets.set(e.date, (buckets.get(e.date) ?? 0) + signed);
  }

  let running = openingCents;
  let minimum = openingCents;
  const points: { date: string; balanceCents: number }[] = [];

  for (const date of [...buckets.keys()].sort()) {
    running += buckets.get(date)!;
    assertSigned(running);
    minimum = Math.min(minimum, running);
    points.push({ date, balanceCents: running });
  }

  return { asOf, minimumCents: minimum, closingCents: running, points };
}

export type ReserveResult =
  | { status: "AVAILABLE"; capacityCents: number; reason: string }
  | { status: "UNAVAILABLE"; capacityCents: null; reason: string };

export function reserveCapacity(input: {
  projection: ProjectionResult | null;
  protectedMinimumCents: number;
  allocatedReserveCents: number;
  uncertaintyBufferCents: number;
  complete: boolean;
  reconciled: boolean;
}): ReserveResult {
  for (const v of [
    input.protectedMinimumCents,
    input.allocatedReserveCents,
    input.uncertaintyBufferCents,
  ]) {
    assertAmount(v);
  }
  if (!input.complete || !input.reconciled || !input.projection) {
    return {
      status: "UNAVAILABLE",
      capacityCents: null,
      reason: "Dados insuficientes ou não conciliados",
    };
  }
  return {
    status: "AVAILABLE",
    capacityCents: Math.max(
      0,
      input.projection.minimumCents -
        input.protectedMinimumCents -
        input.allocatedReserveCents -
        input.uncertaintyBufferCents
    ),
    reason:
      "Menor saldo projetado, menos mínimo protegido, alocações e incerteza",
  };
}

export function savingsRate(
  realizedIncomeCents: number,
  realizedExpenseCents: number
): number | null {
  assertAmount(realizedIncomeCents);
  assertAmount(realizedExpenseCents);
  return realizedIncomeCents === 0
    ? null
    : (realizedIncomeCents - realizedExpenseCents) / realizedIncomeCents;
}

export type Evidence = {
  metric: string;
  label?: string;
  asOf: string;
  source: string;
  status: "VERIFIED" | "ESTIMATED" | "STALE" | "UNAVAILABLE";
  value: string;
};

export type Insight = {
  code: string;
  priority: "HIGH" | "MEDIUM";
  title: string;
  explanation: string;
  evidence: Evidence[];
};

export function detectCashRisk(
  projection: ProjectionResult | null,
  source: string
): Insight[] {
  if (!projection || projection.minimumCents >= 0) return [];
  return [
    {
      code: "NEGATIVE_PROJECTED_CASH",
      priority: "HIGH",
      title: "Risco de saldo negativo",
      explanation:
        "A projeção de compromissos conhecidos indica saldo negativo no horizonte analisado. Revise os lançamentos e vencimentos.",
      evidence: [
        {
          metric: "minimumProjectedCashCents",
          label: "Menor saldo projetado (centavos)",
          asOf: projection.asOf,
          source,
          status: "ESTIMATED",
          value: String(projection.minimumCents),
        },
      ],
    },
  ];
}

export function qualityStatus(inputs: {
  missingAccounts: number;
  unreconciledTransactions: number;
  staleMarketPrices: number;
}): {
  eligibleForAutomatedSuggestions: boolean;
  issues: typeof inputs;
  status: "COMPLETE" | "PARTIAL" | "INSUFFICIENT_DATA" | "STALE";
  reasons: string[];
} {
  for (const x of Object.values(inputs)) assertAmount(x);
  const reasons: string[] = [];
  let status: "COMPLETE" | "PARTIAL" | "INSUFFICIENT_DATA" | "STALE" =
    "COMPLETE";

  if (inputs.missingAccounts > 0) {
    status = "INSUFFICIENT_DATA";
    reasons.push("Nenhuma conta financeira ativa cadastrada");
  }
  if (inputs.unreconciledTransactions > 0) {
    if (status === "COMPLETE") status = "PARTIAL";
    reasons.push(
      `${inputs.unreconciledTransactions} item(ns) externo(s) aguardando conciliação`
    );
  }
  if (inputs.staleMarketPrices > 0) {
    if (status === "COMPLETE") status = "STALE";
    reasons.push(
      `${inputs.staleMarketPrices} posição(ões) com cotação defasada`
    );
  }

  return {
    eligibleForAutomatedSuggestions: Object.values(inputs).every(
      (x) => x === 0
    ),
    issues: inputs,
    status,
    reasons,
  };
}

/**
 * Índice de Saúde Financeira Transparente (P04 — docs/04-REGRAS-FINANCEIRAS-E-IA.md):
 * Notas ponderadas:
 * - Liquidez: 30%
 * - Pontualidade: 25%
 * - Orçamento: 20%
 * - Reserva: 15%
 * - Concentração: 10%
 * Sem dados suficientes (hasSufficientData === false), retorna null.
 */
export interface HealthScoreDimension {
  key: "LIQUIDITY" | "PUNCTUALITY" | "BUDGET" | "RESERVE" | "CONCENTRATION";
  label: string;
  weightPct: number;
  score: number;
  weightedPoints: number;
  status: "GOOD" | "WARNING" | "CRITICAL";
  rationale: string;
}

export interface HealthScoreBreakdown {
  totalScore: number | null;
  status: "EXCELLENT" | "GOOD" | "ATTENTION" | "INSUFFICIENT_DATA";
  band:
    | "CRITICAL"
    | "ATTENTION"
    | "STABLE"
    | "HEALTHY"
    | "EXCELLENT"
    | "INSUFFICIENT_DATA";
  summary: string;
  version: string;
  components: {
    liquidityScore: number; // 0..100 (peso 30%)
    punctualityScore: number; // 0..100 (peso 25%)
    budgetScore: number; // 0..100 (peso 20%)
    reserveScore: number; // 0..100 (peso 15%)
    concentrationScore: number; // 0..100 (peso 10%)
  } | null;
  dimensions: HealthScoreDimension[];
  evidence: Evidence[];
}

export function calculateFinancialHealthIndex(input: {
  hasSufficientData: boolean;
  asOf: string;
  eligibleBalanceCents: number;
  minForecastBalanceCents: number;
  safetyBufferCents: number;
  overdueInstallmentsCount: number;
  totalInstallmentsCount: number;
  exceededBudgetsCount: number;
  totalBudgetsCount: number;
  allocatedReservesCents: number;
  topExpenseCategorySharePct: number;
}): HealthScoreBreakdown {
  if (!input.hasSufficientData) {
    return {
      totalScore: null,
      status: "INSUFFICIENT_DATA",
      band: "INSUFFICIENT_DATA",
      summary:
        "Sem base suficiente no ambiente (Estado Zero). Cadastre contas ou lançamentos para apurar o índice.",
      version: "p04-health-v1.0",
      components: null,
      dimensions: [],
      evidence: [
        {
          metric: "hasSufficientData",
          label: "Base mínima disponível",
          asOf: input.asOf,
          source: "ledger+planning",
          status: "UNAVAILABLE",
          value: "false",
        },
      ],
    };
  }

  // 1. Liquidez (30%): saldo positivo e acima da margem de segurança
  const liquidityScore =
    input.minForecastBalanceCents < 0
      ? 20
      : input.minForecastBalanceCents >= input.safetyBufferCents
      ? 95
      : 65;

  // 2. Pontualidade (25%): ausência de parcelas vencidas (OVERDUE)
  const punctualityScore =
    input.overdueInstallmentsCount === 0
      ? 100
      : Math.max(
          20,
          100 -
            Math.round(
              (input.overdueInstallmentsCount /
                Math.max(1, input.totalInstallmentsCount)) *
                100
            )
        );

  // 3. Orçamento (20%): aderência aos tetos de orçamento
  const budgetScore =
    input.totalBudgetsCount === 0
      ? 80
      : Math.max(
          25,
          100 -
            Math.round(
              (input.exceededBudgetsCount / input.totalBudgetsCount) * 80
            )
        );

  // 4. Reserva (15%): existência de reserva constituída
  const reserveScore =
    input.allocatedReservesCents > 0 &&
    input.allocatedReservesCents >= input.safetyBufferCents
      ? 95
      : input.allocatedReservesCents > 0
      ? 75
      : 40;

  // 5. Concentração (10%): diversificação de despesas / carteira
  const concentrationScore =
    input.topExpenseCategorySharePct <= 50
      ? 90
      : input.topExpenseCategorySharePct <= 75
      ? 70
      : 45;

  const totalScore = Math.round(
    liquidityScore * 0.3 +
      punctualityScore * 0.25 +
      budgetScore * 0.2 +
      reserveScore * 0.15 +
      concentrationScore * 0.1
  );

  const status =
    totalScore >= 80
      ? "EXCELLENT"
      : totalScore >= 60
      ? "GOOD"
      : "ATTENTION";

  const band: HealthScoreBreakdown["band"] =
    totalScore >= 85
      ? "EXCELLENT"
      : totalScore >= 70
      ? "HEALTHY"
      : totalScore >= 55
      ? "STABLE"
      : totalScore >= 40
      ? "ATTENTION"
      : "CRITICAL";

  const dimStatus = (s: number): "GOOD" | "WARNING" | "CRITICAL" =>
    s >= 75 ? "GOOD" : s >= 50 ? "WARNING" : "CRITICAL";

  const dimensions: HealthScoreDimension[] = [
    {
      key: "LIQUIDITY",
      label: "Liquidez e Fluxo Projetado",
      weightPct: 30,
      score: liquidityScore,
      weightedPoints: Math.round(liquidityScore * 0.3 * 10) / 10,
      status: dimStatus(liquidityScore),
      rationale:
        input.minForecastBalanceCents < 0
          ? "Projeção aponta risco de saldo negativo no horizonte."
          : input.minForecastBalanceCents >= input.safetyBufferCents
          ? "Menor saldo projetado preserva integralmente a margem de segurança."
          : "Saldo positivo, porém abaixo da margem de segurança configurada.",
    },
    {
      key: "PUNCTUALITY",
      label: "Pontualidade de Compromissos",
      weightPct: 25,
      score: punctualityScore,
      weightedPoints: Math.round(punctualityScore * 0.25 * 10) / 10,
      status: dimStatus(punctualityScore),
      rationale:
        input.overdueInstallmentsCount === 0
          ? "Zero parcelas vencidas em aberto."
          : `${input.overdueInstallmentsCount} parcela(s) vencida(s) aguardando regularização.`,
    },
    {
      key: "BUDGET",
      label: "Aderência Orçamentária",
      weightPct: 20,
      score: budgetScore,
      weightedPoints: Math.round(budgetScore * 0.2 * 10) / 10,
      status: dimStatus(budgetScore),
      rationale:
        input.totalBudgetsCount === 0
          ? "Nenhum teto de orçamento cadastrado ainda (nota neutra)."
          : input.exceededBudgetsCount === 0
          ? `Todos os ${input.totalBudgetsCount} orçamentos estão dentro do limite.`
          : `${input.exceededBudgetsCount} de ${input.totalBudgetsCount} orçamento(s) acima do teto.`,
    },
    {
      key: "RESERVE",
      label: "Cobertura de Reservas e Cofres",
      weightPct: 15,
      score: reserveScore,
      weightedPoints: Math.round(reserveScore * 0.15 * 10) / 10,
      status: dimStatus(reserveScore),
      rationale:
        input.allocatedReservesCents === 0
          ? "Nenhuma reserva virtual constituída nos cofres."
          : input.allocatedReservesCents >= input.safetyBufferCents
          ? "Reservas constituídas cobrem ou superam a margem de segurança."
          : "Reserva em formação nos cofres virtuais.",
    },
    {
      key: "CONCENTRATION",
      label: "Diversificação de Saídas",
      weightPct: 10,
      score: concentrationScore,
      weightedPoints: Math.round(concentrationScore * 0.1 * 10) / 10,
      status: dimStatus(concentrationScore),
      rationale: `Maior categoria concentra ${input.topExpenseCategorySharePct}% das despesas monitoradas.`,
    },
  ];

  const summary =
    band === "EXCELLENT" || band === "HEALTHY"
      ? "Estrutura financeira saudável, com liquidez positiva e boa cobertura."
      : band === "STABLE"
      ? "Equilíbrio operacional moderado; revise reservas ou margens."
      : "Atenção prioritária requerida em liquidez, atrasos ou orçamentos.";

  return {
    totalScore,
    status,
    band,
    summary,
    version: "p04-health-v1.0",
    components: {
      liquidityScore,
      punctualityScore,
      budgetScore,
      reserveScore,
      concentrationScore,
    },
    dimensions,
    evidence: [
      {
        metric: "eligibleBalanceCents",
        label: "Saldo Elegível (centavos)",
        asOf: input.asOf,
        source: "ledger-p01",
        status: "VERIFIED",
        value: String(input.eligibleBalanceCents),
      },
      {
        metric: "minForecastBalanceCents",
        label: "Menor Saldo Projetado (centavos)",
        asOf: input.asOf,
        source: "forecast-p02-p04",
        status: "ESTIMATED",
        value: String(input.minForecastBalanceCents),
      },
      {
        metric: "allocatedReservesCents",
        label: "Reservas Alocadas (centavos)",
        asOf: input.asOf,
        source: "reserves-p02",
        status: "VERIFIED",
        value: String(input.allocatedReservesCents),
      },
    ],
  };
}

/**
 * Assistente Contextual Somente Leitura (P04 — docs/01-ESCOPO-E-FUNCIONALIDADES.md):
 * - Nunca executa pagamentos, transferências, aplicações ou resgates.
 * - Nunca fornece recomendação individualizada regulada de compra/venda de valores mobiliários.
 * - Ancorado 100% em números determinísticos do motor com evidências, período, fonte e rota sugerida.
 */
export interface AssistantAnswer {
  question: string;
  answer: string;
  blockedAction: boolean;
  readOnlyGuardrail: boolean;
  limitations: string[];
  period: string;
  asOf: string;
  source: string;
  hypotheses: string[];
  uncertainty: string;
  suggestedRoute: string;
  evidence: Evidence[];
}

export function answerReadonlyAssistant(
  question: string,
  context: {
    asOf: string;
    workspaceName: string;
    workspaceType: "PERSONAL" | "BUSINESS";
    eligibleBalanceFormatted: string;
    settledIncomeFormatted: string;
    settledExpenseFormatted: string;
    minForecastFormatted: string;
    projectedEndFormatted: string;
    headroomFormatted: string;
    safetyBufferFormatted: string;
    openPayablesFormatted: string;
    openPayablesCount: number;
    portfolioGrossFormatted: string;
    isZeroState: boolean;
    qualityEligible: boolean;
  }
): AssistantAnswer {
  const qLower = question.toLowerCase();

  // Guardrail 1: Bloqueio de execução operacional ou recomendação regulada
  if (
    qLower.includes("pague ") ||
    qLower.includes("pagar agora") ||
    qLower.includes("transfira ") ||
    qLower.includes("transferir agora") ||
    qLower.includes("aplique ") ||
    qLower.includes("resgate ") ||
    qLower.includes("qual ação comprar") ||
    qLower.includes("qual ativo comprar")
  ) {
    return {
      question,
      answer:
        "Bloqueio de Governança NOVA (P04): O Assistente opera exclusivamente em modo somente leitura e educacional. Ele não executa pagamentos, transferências, aplicações ou resgates automáticos, nem realiza consultoria individualizada de valores mobiliários. Você pode utilizar os módulos de Movimentações, Compromissos ou o Comparador de Aplicações para avaliar e registrar suas decisões manualmente.",
      blockedAction: true,
      readOnlyGuardrail: true,
      limitations: [
        "Ação operacional bloqueada por política de segurança Read-Only.",
      ],
      period: `Referência ${context.asOf}`,
      asOf: context.asOf,
      source: "Guardrail de Governança P04 (Read-Only Policy)",
      hypotheses: ["Nenhuma mutação foi executada no banco de dados."],
      uncertainty: "Zero efeito colateral sobre o Ledger.",
      suggestedRoute: "movimentacoes",
      evidence: [
        {
          metric: "policyMode",
          label: "Política de Governança",
          asOf: context.asOf,
          source: "p04-guardrail",
          status: "VERIFIED",
          value: "READ_ONLY_ENFORCED",
        },
      ],
    };
  }

  if (context.isZeroState) {
    return {
      question,
      answer: `O ambiente "${context.workspaceName}" encontra-se sem dados financeiros cadastrados (saldo em R$ 0,00). Para que eu possa responder com precisão determinística sobre despesas, reservas ou fluxo de caixa, cadastre sua primeira conta bancária ou importe um extrato CSV/OFX.`,
      blockedAction: false,
      readOnlyGuardrail: true,
      limitations: [
        "Ambiente em estado inicial (R$ 0,00) sem lançamentos persistidos.",
      ],
      period: `Até ${context.asOf}`,
      asOf: context.asOf,
      source: "Ledger P01 + Motor P04",
      hypotheses: ["Sem lançamentos liquidados ou previstos no período."],
      uncertainty: "Dados insuficientes para projeção.",
      suggestedRoute: "contas",
      evidence: [
        {
          metric: "isZeroState",
          label: "Estado Inicial (Zero Dados)",
          asOf: context.asOf,
          source: "ledger-p01",
          status: "UNAVAILABLE",
          value: "Sim (R$ 0,00)",
        },
      ],
    };
  }

  // Pergunta sobre quanto reservar
  if (qLower.includes("reservar") || qLower.includes("reserva") || qLower.includes("guardar")) {
    return {
      question,
      answer: `Com base no motor determinístico (P02/P04), sua capacidade segura adicional de reserva hoje é de ${context.headroomFormatted}. O cálculo considera seu saldo disponível de ${context.eligibleBalanceFormatted}, o menor saldo projetado no horizonte (${context.minForecastFormatted}) e preserva integralmente sua margem de segurança configurada (${context.safetyBufferFormatted}).`,
      blockedAction: false,
      readOnlyGuardrail: true,
      limitations: [
        context.qualityEligible
          ? "Base conciliada; projeção sujeita apenas a novos compromissos futuros."
          : "Existem itens pendentes de conciliação que podem alterar o saldo disponível.",
      ],
      period: `Horizonte ativo a partir de ${context.asOf}`,
      asOf: context.asOf,
      source: "Motor ReserveCapacity (P02 + P04)",
      hypotheses: [
        "Compromissos pendentes serão liquidados nas datas de vencimento previstas.",
        `Margem de segurança mantida em ${context.safetyBufferFormatted}.`,
      ],
      uncertainty: context.qualityEligible
        ? "Baixa (contas conciliadas e sem pendências críticas)."
        : "Moderada (existem itens pendentes de conciliação).",
      suggestedRoute: "reservas",
      evidence: [
        {
          metric: "reserveCapacity",
          label: "Capacidade Segura de Reserva",
          asOf: context.asOf,
          source: "planning-p02-p04",
          status: "ESTIMATED",
          value: context.headroomFormatted,
        },
        {
          metric: "minimumProjectedCash",
          label: "Menor Saldo Projetado",
          asOf: context.asOf,
          source: "forecast-p04",
          status: "ESTIMATED",
          value: context.minForecastFormatted,
        },
      ],
    };
  }

  // Pergunta sobre vencimentos / contas a pagar
  if (qLower.includes("vencem") || qLower.includes("vence") || qLower.includes("pagar") || qLower.includes("compromisso")) {
    return {
      question,
      answer: `Você possui atualmente ${context.openPayablesCount} parcela(s)/compromisso(s) em aberto, totalizando ${context.openPayablesFormatted}. Esses compromissos já estão descontados da sua projeção de caixa para evitar dupla contagem quando forem baixados.`,
      blockedAction: false,
      readOnlyGuardrail: true,
      limitations: [
        "Considera exclusivamente obrigações e parcelas ativas cadastradas no workspace.",
      ],
      period: `Posição em ${context.asOf}`,
      asOf: context.asOf,
      source: "Módulo de Obrigações e Parcelas (P02)",
      hypotheses: ["Apenas parcelas com status OPEN ou PARTIAL entram na fila de pagamento."],
      uncertainty: "Verificado no livro de obrigações.",
      suggestedRoute: "contas-a-pagar",
      evidence: [
        {
          metric: "openPayablesTotal",
          label: "Total a Pagar em Aberto",
          asOf: context.asOf,
          source: "obligations-p02",
          status: "VERIFIED",
          value: context.openPayablesFormatted,
        },
      ],
    };
  }

  // Pergunta sobre gastos / despesas
  if (qLower.includes("gastei") || qLower.includes("despesa") || qLower.includes("gasto")) {
    return {
      question,
      answer: `No período apurado, as despesas liquidadas somam ${context.settledExpenseFormatted} frente a receitas liquidadas de ${context.settledIncomeFormatted}. Transferências entre contas próprias e alocações em cofres virtuais foram isoladas e não inflam suas despesas.`,
      blockedAction: false,
      readOnlyGuardrail: true,
      limitations: [
        "Apuração baseada nos lançamentos com status SETTLED no Ledger P01.",
      ],
      period: `Acumulado até ${context.asOf}`,
      asOf: context.asOf,
      source: "Ledger Contábil P01",
      hypotheses: ["Considera exclusivamente lançamentos com status SETTLED."],
      uncertainty: "Auditado pelo Ledger P01.",
      suggestedRoute: "movimentacoes",
      evidence: [
        {
          metric: "settledExpense",
          label: "Despesas Liquidadas",
          asOf: context.asOf,
          source: "ledger-p01",
          status: "VERIFIED",
          value: context.settledExpenseFormatted,
        },
        {
          metric: "settledIncome",
          label: "Receitas Liquidadas",
          asOf: context.asOf,
          source: "ledger-p01",
          status: "VERIFIED",
          value: context.settledIncomeFormatted,
        },
      ],
    };
  }

  // Resposta padrão sobre fluxo de caixa, projeção e patrimônio
  return {
    question,
    answer: `Resumo determinístico do ambiente "${context.workspaceName}": Saldo disponível em contas de ${context.eligibleBalanceFormatted}, carteira de investimentos em ${context.portfolioGrossFormatted}, saldo projetado ao fim do horizonte de ${context.projectedEndFormatted} (com ponto mínimo em ${context.minForecastFormatted}) e capacidade segura de reserva de ${context.headroomFormatted}.`,
    blockedAction: false,
    readOnlyGuardrail: true,
    limitations: [
      "Projeção determinística condicional aos lançamentos, recorrências e parcelas registradas.",
    ],
    period: `Horizonte ativo a partir de ${context.asOf}`,
    asOf: context.asOf,
    source: "Núcleo Integrado NOVA (P01 + P02 + P03 + P04)",
    hypotheses: [
      "Saldos futuros consideram apenas itens PENDING sem duplicar itens SETTLED.",
    ],
    uncertainty: "Projeção condicional aos vencimentos cadastrados.",
    suggestedRoute: "fluxo-de-caixa",
    evidence: [
      {
        metric: "eligibleBalance",
        label: "Saldo Elegível em Contas",
        asOf: context.asOf,
        source: "ledger-p01",
        status: "VERIFIED",
        value: context.eligibleBalanceFormatted,
      },
      {
        metric: "projectedClosingBalance",
        label: "Saldo Projetado no Fechamento",
        asOf: context.asOf,
        source: "intelligence-p04",
        status: "ESTIMATED",
        value: context.projectedEndFormatted,
      },
    ],
  };
}
