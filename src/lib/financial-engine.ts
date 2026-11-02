import Decimal from "decimal.js";

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export interface MacroRates {
  selicAnnualPct: number; // ex: 11.25
  cdiAnnualPct: number;   // ex: 11.15
  ipcaAnnualPct: number;  // ex: 4.50
  trAnnualPct: number;    // ex: 0.80
}

export const DEFAULT_MACRO_RATES: MacroRates = {
  selicAnnualPct: 11.25,
  cdiAnnualPct: 11.15,
  ipcaAnnualPct: 4.5,
  trAnnualPct: 0.8,
};

export function formatBRLFromCents(cents: number): string {
  const value = new Decimal(cents).dividedBy(100).toNumber();
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatBRLFromDecimal(val: Decimal | number): string {
  const num = val instanceof Decimal ? val.toNumber() : val;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

export function formatPct(val: number, decimals = 2): string {
  return `${val.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}%`;
}

export interface ReserveCapacityInput {
  availableBalanceCents: number;
  predictedBillsCents: number;
  predictedIncomesCents: number;
  safetyMarginCents: number;
  essentialMonthlyExpensesCents: number;
  workspaceType: "PF" | "PJ";
}

export interface ReserveCapacityResult {
  availableBalanceCents: number;
  predictedBillsCents: number;
  predictedIncomesCents: number;
  safetyMarginCents: number;
  recommendedSafetyMarginCents: number;
  reservePotentialCents: number;
  projectedEndCycleBalanceCents: number;
  commitmentsPct: number;
  safetyPct: number;
  reservePct: number;
   uncoveredDeficitCents: number;
  status: "HEALTHY" | "TIGHT" | "DEFICIT";
  headline: string;
  recommendationText: string;
  allocationSuggestion: {
    immediateReserveCents: number;
    mediumLongTermCents: number;
    rationale: string;
  };
}

/**
 * Motor de Inteligência Financeira:
 * Calcula com precisão decimal a capacidade segura de reserva e investimento.
 */
export function calculateReserveCapacity(
  input: ReserveCapacityInput
): ReserveCapacityResult {
  const available = new Decimal(Math.max(0, input.availableBalanceCents));
  const bills = new Decimal(Math.max(0, input.predictedBillsCents));
  const safety = new Decimal(Math.max(0, input.safetyMarginCents));
  const incomes = new Decimal(Math.max(0, input.predictedIncomesCents));

  // Potencial imediato sobre o saldo disponível (fórmula canônica da especificação)
  const rawPotential = available.minus(bills).minus(safety);
  const reservePotential = Decimal.max(0, rawPotential);
  const deficit = rawPotential.isNegative() ? rawPotential.abs() : new Decimal(0);

  // Projeção considerando receitas futuras confirmadas no ciclo
  const projectedEndCycle = available.plus(incomes).minus(bills);

  // Margem recomendada (mínimo entre o configurado e 30% das despesas essenciais mensais)
  const essentialSuggested = new Decimal(input.essentialMonthlyExpensesCents)
    .times(input.workspaceType === "PJ" ? 0.5 : 0.35)
    .toDecimalPlaces(0);
  const recommendedSafetyMarginCents = Decimal.max(
    safety,
    essentialSuggested
  ).toNumber();

  let commitmentsPct = 0;
  let safetyPct = 0;
  let reservePct = 0;

  if (available.greaterThan(0)) {
    const cappedBills = Decimal.min(available, bills);
    const remainingAfterBills = Decimal.max(0, available.minus(cappedBills));
    const cappedSafety = Decimal.min(remainingAfterBills, safety);
    const remainingForReserve = Decimal.max(
      0,
      remainingAfterBills.minus(cappedSafety)
    );

    commitmentsPct = cappedBills
      .dividedBy(available)
      .times(100)
      .toDecimalPlaces(2)
      .toNumber();
    safetyPct = cappedSafety
      .dividedBy(available)
      .times(100)
      .toDecimalPlaces(2)
      .toNumber();
    reservePct = remainingForReserve
      .dividedBy(available)
      .times(100)
      .toDecimalPlaces(2)
      .toNumber();
  }

  let status: "HEALTHY" | "TIGHT" | "DEFICIT" = "HEALTHY";
  let headline = "";
  let recommendationText = "";

  const potentialCents = reservePotential.toNumber();

  if (potentialCents > 0) {
    status = "HEALTHY";
    headline = `Há potencial de ${formatBRLFromCents(
      potentialCents
    )} para destinar a uma reserva, desde que não existam outras obrigações e que a projeção de caixa confirme a disponibilidade.`;
    recommendationText =
      input.workspaceType === "PJ"
        ? `Seu caixa operacional cobre 100% das contas previstas (${formatBRLFromCents(
            input.predictedBillsCents
          )}) e preserva o colchão de segurança operacional (${formatBRLFromCents(
            input.safetyMarginCents
          )}). O excedente de ${formatBRLFromCents(
            potentialCents
          )} pode ser remunerado em liquidez diária (D+0) sem comprometer o capital de giro.`
        : `Seu saldo atual quita todas as obrigações previstas (${formatBRLFromCents(
            input.predictedBillsCents
          )}) e mantém intacta sua margem de segurança (${formatBRLFromCents(
            input.safetyMarginCents
          )}). Recomendamos transferir ${formatBRLFromCents(
            potentialCents
          )} imediatamente para seus Cofres ou Investimentos.`;
  } else if (available.greaterThanOrEqualTo(bills)) {
    status = "TIGHT";
    headline = `Saldo suficiente para pagar as contas previstas (${formatBRLFromCents(
      input.predictedBillsCents
    )}), mas a margem de segurança está parcialmente comprometida em ${formatBRLFromCents(
      deficit.toNumber()
    )}.`;
    recommendationText =
      "Evite novas alocações em ativos sem liquidez neste momento. Priorize recompor sua margem de segurança com os próximos recebimentos.";
  } else {
    status = "DEFICIT";
    headline = `Atenção: As contas previstas superam o saldo disponível imediato em ${formatBRLFromCents(
      bills.minus(available).toNumber()
    )}.`;
    recommendationText =
      input.predictedIncomesCents > 0
        ? `Existem ${formatBRLFromCents(
            input.predictedIncomesCents
          )} em recebimentos previstos. Acompanhe o Calendário Financeiro Preditivo para evitar descasamento de datas.`
        : `Recomendamos acionar parte da Reserva de Liquidez Diária ou renegociar vencimentos para evitar encargos por atraso.`;
  }

  // Sugestão de divisão entre Proteger (Liquidez) e Multiplicar (Médio/Longo Prazo)
  const immediateReserveCents = new Decimal(potentialCents)
    .times(input.workspaceType === "PJ" ? 0.7 : 0.6)
    .toDecimalPlaces(0)
    .toNumber();
  const mediumLongTermCents = Math.max(0, potentialCents - immediateReserveCents);

  return {
    availableBalanceCents: input.availableBalanceCents,
    predictedBillsCents: input.predictedBillsCents,
    predictedIncomesCents: input.predictedIncomesCents,
    safetyMarginCents: input.safetyMarginCents,
    recommendedSafetyMarginCents,
    reservePotentialCents: potentialCents,
    projectedEndCycleBalanceCents: projectedEndCycle.toNumber(),
    commitmentsPct,
    safetyPct,
    reservePct,
    uncoveredDeficitCents: deficit.toNumber(),
    status,
    headline,
    recommendationText,
    allocationSuggestion: {
      immediateReserveCents,
      mediumLongTermCents,
      rationale:
        input.workspaceType === "PJ"
          ? "70% em Caixa Remunerado D+0 (Reserva Operacional/Impostos) e 30% em aplicação corporativa com FGC."
          : "60% para Reserva de Emergência/Objetivos Próximos (Liquidez D+0) e 40% para Multiplicação de Patrimônio.",
    },
  };
}

export interface SimulatorInput {
  initialAmountReais: number;
  monthlyDepositReais: number;
  years: number;
  annualRatePct: number;
}

export interface SimulatorYearPoint {
  year: number;
  month: number;
  totalContributedReais: number;
  grossEarningsReais: number;
  accumulatedBalanceReais: number;
}

export interface SimulatorResult {
  initialAmountReais: number;
  monthlyDepositReais: number;
  years: number;
  months: number;
  annualRatePct: number;
  monthlyEquivalentRatePct: number;
  accumulatedBalanceReais: number;
  totalContributedReais: number;
  grossEarningsReais: number;
  estimatedIrTaxReais: number;
  netEstimatedBalanceReais: number;
  yearlyEvolution: SimulatorYearPoint[];
}

/**
 * Simulador de Reserva Inteligente:
 * Juros compostos com aportes ao fim de cada mês, usando taxa mensal equivalente:
 * i_m = (1 + i_a)^(1/12) - 1
 *
 * Exemplo de validação exata da especificação:
 * Valor inicial: R$ 1.000,00 | Depósito mensal: R$ 300,00 | Prazo: 5 anos | Taxa: 9% a.a.
 * Total de aportes = R$ 19.000,00
 * Patrimônio acumulado estimado = R$ 23.958,48
 * Rendimento bruto estimado = R$ 4.958,48
 */
export function simulateSmartReserve(input: SimulatorInput): SimulatorResult {
  const initial = new Decimal(Math.max(0, input.initialAmountReais));
  const monthly = new Decimal(Math.max(0, input.monthlyDepositReais));
  const years = Math.max(1, Math.min(40, Math.round(input.years)));
  const months = years * 12;
  const annualRate = new Decimal(Math.max(0, input.annualRatePct)).dividedBy(100);

  // Taxa equivalente mensal: (1 + r_anual)^(1/12) - 1
  const onePlusAnnual = new Decimal(1).plus(annualRate);
  const monthlyRate = Decimal.pow(onePlusAnnual, new Decimal(1).dividedBy(12)).minus(1);

  let balance = initial;
  let contributed = initial;
  const yearlyEvolution: SimulatorYearPoint[] = [];

  for (let m = 1; m <= months; m++) {
    // Rendimento sobre o saldo no mês + aporte ao fim do mês
    balance = balance.times(new Decimal(1).plus(monthlyRate)).plus(monthly);
    contributed = contributed.plus(monthly);

    if (m % 12 === 0 || m === months) {
      const accRounded = balance.toDecimalPlaces(2).toNumber();
      const contribRounded = contributed.toDecimalPlaces(2).toNumber();
      const grossRounded = balance.minus(contributed).toDecimalPlaces(2).toNumber();
      yearlyEvolution.push({
        year: Math.ceil(m / 12),
        month: m,
        totalContributedReais: contribRounded,
        grossEarningsReais: grossRounded,
        accumulatedBalanceReais: accRounded,
      });
    }
  }

  const accumulatedBalanceReais = balance.toDecimalPlaces(2, Decimal.ROUND_DOWN).toNumber();
  const totalContributedReais = contributed.toDecimalPlaces(2).toNumber();
  const grossEarningsReais = new Decimal(accumulatedBalanceReais)
    .minus(totalContributedReais)
    .toDecimalPlaces(2)
    .toNumber();

  // Alíquota regressiva de IR da Renda Fixa conforme prazo
  const days = months * 30;
  let irRate = 0.15;
  if (days <= 180) irRate = 0.225;
  else if (days <= 360) irRate = 0.2;
  else if (days <= 720) irRate = 0.175;

  const estimatedIrTaxReais = new Decimal(grossEarningsReais)
    .times(irRate)
    .toDecimalPlaces(2)
    .toNumber();
  const netEstimatedBalanceReais = new Decimal(accumulatedBalanceReais)
    .minus(estimatedIrTaxReais)
    .toDecimalPlaces(2)
    .toNumber();

  return {
    initialAmountReais: initial.toNumber(),
    monthlyDepositReais: monthly.toNumber(),
    years,
    months,
    annualRatePct: input.annualRatePct,
    monthlyEquivalentRatePct: monthlyRate.times(100).toDecimalPlaces(4).toNumber(),
    accumulatedBalanceReais,
    totalContributedReais,
    grossEarningsReais,
    estimatedIrTaxReais,
    netEstimatedBalanceReais,
    yearlyEvolution,
  };
}

export type InvestmentObjective =
  | "EMERGENCY_LIQUIDITY"
  | "MAX_NET_YIELD"
  | "BALANCED_MEDIUM_TERM"
  | "LONG_TERM_REAL_GAIN"
  | "CORPORATE_CASH";

export interface MarketProductCatalogItem {
  id: string;
  name: string;
  issuer: string;
  category:
    | "Tesouro Selic"
    | "CDB"
    | "LCI e LCA"
    | "Tesouro IPCA+"
    | "Tesouro Prefixado"
    | "Fundos"
    | "ETFs e ações";
  indexer: "SELIC" | "CDI" | "IPCA" | "PRE" | "RENDA_VARIAVEL";
  rateDisplay: string;
  grossAnnualPct: number;
  liquidity: "Imediata (D+0)" | "Diária (D+1)" | "Carência 9 meses" | "No vencimento" | "D+2 (Bolsa)";
  minHorizonMonths: number;
  maturityLabel: string;
  fgcCovered: boolean;
  taxExemptPF: boolean;
  adminFeeAnnualPct: number;
  earlyRedemptionRisk: "Baixíssimo" | "Moderado (Marcação a Mercado)" | "Impossível antes do prazo" | "Alto (Volatilidade)";
  riskScore: 1 | 2 | 3 | 4 | 5;
  sourceLabel: string;
  potentialUse: string;
}

export const MARKET_PRODUCTS_CATALOG: MarketProductCatalogItem[] = [
  {
    id: "mkt-tesouro-selic-2029",
    name: "Tesouro Selic 2029",
    issuer: "Tesouro Nacional (Governo Federal)",
    category: "Tesouro Selic",
    indexer: "SELIC",
    rateDisplay: "Selic + 0,06% a.a.",
    grossAnnualPct: 11.31,
    liquidity: "Diária (D+1)",
    minHorizonMonths: 1,
    maturityLabel: "01/03/2029",
    fgcCovered: false, // Garantia Soberana do Tesouro Nacional
    taxExemptPF: false,
    adminFeeAnnualPct: 0.2, // Taxa B3 acima de R$ 10 mil na guarda (isento até R$ 10 mil no Tesouro Selic)
    earlyRedemptionRisk: "Baixíssimo",
    riskScore: 1,
    sourceLabel: "Tesouro Direto / ANBIMA",
    potentialUse: "Reserva de emergência e caixa de segurança",
  },
  {
    id: "mkt-cdb-diario-102",
    name: "CDB Liquidez Diária 102% CDI",
    issuer: "Banco Itaú / Bradesco / Santander S.A.",
    category: "CDB",
    indexer: "CDI",
    rateDisplay: "102% do CDI",
    grossAnnualPct: 11.37,
    liquidity: "Imediata (D+0)",
    minHorizonMonths: 1,
    maturityLabel: "Liquidez Diária (Venc. 3 anos)",
    fgcCovered: true,
    taxExemptPF: false,
    adminFeeAnnualPct: 0,
    earlyRedemptionRisk: "Baixíssimo",
    riskScore: 1,
    sourceLabel: "Painel Renda Fixa / B3",
    potentialUse: "Reserva de emergência, capital de giro PJ ou objetivos próximos",
  },
  {
    id: "mkt-lci-94-cdi",
    name: "LCI Habitação 94% do CDI",
    issuer: "Caixa / Banco ABC Brasil",
    category: "LCI e LCA",
    indexer: "CDI",
    rateDisplay: "94% do CDI (Isento de IR PF)",
    grossAnnualPct: 10.48,
    liquidity: "Carência 9 meses",
    minHorizonMonths: 9,
    maturityLabel: "Após 270 dias (Liquidez D+0 pós-carência)",
    fgcCovered: true,
    taxExemptPF: true,
    adminFeeAnnualPct: 0,
    earlyRedemptionRisk: "Impossível antes do prazo",
    riskScore: 2,
    sourceLabel: "B3 Balcão / Emissores Bancários",
    potentialUse: "Objetivos com prazo definido acima de 9 meses (isento de IR para PF)",
  },
  {
    id: "mkt-cdb-fechado-116",
    name: "CDB Pós-Fixado 116% do CDI (24 meses)",
    issuer: "Banco Daycoval / BTG Pactual",
    category: "CDB",
    indexer: "CDI",
    rateDisplay: "116% do CDI",
    grossAnnualPct: 12.93,
    liquidity: "No vencimento",
    minHorizonMonths: 24,
    maturityLabel: "24 meses (Trancado até vencimento)",
    fgcCovered: true,
    taxExemptPF: false,
    adminFeeAnnualPct: 0,
    earlyRedemptionRisk: "Impossível antes do prazo",
    riskScore: 2,
    sourceLabel: "B3 Balcão / Distribuidoras",
    potentialUse: "Multiplicação de capital com prazo travado e proteção do FGC",
  },
  {
    id: "mkt-tesouro-ipca-2035",
    name: "Tesouro IPCA+ 2035",
    issuer: "Tesouro Nacional",
    category: "Tesouro IPCA+",
    indexer: "IPCA",
    rateDisplay: "IPCA + 6,45% a.a.",
    grossAnnualPct: 11.24, // (1.045 * 1.0645 - 1)
    liquidity: "Diária (D+1)",
    minHorizonMonths: 36,
    maturityLabel: "15/05/2035",
    fgcCovered: false,
    taxExemptPF: false,
    adminFeeAnnualPct: 0.2,
    earlyRedemptionRisk: "Moderado (Marcação a Mercado)",
    riskScore: 3,
    sourceLabel: "Tesouro Direto",
    potentialUse: "Aposentadoria, proteção contra inflação e objetivos de longo prazo",
  },
  {
    id: "mkt-tesouro-pre-2028",
    name: "Tesouro Prefixado 2028",
    issuer: "Tesouro Nacional",
    category: "Tesouro Prefixado",
    indexer: "PRE",
    rateDisplay: "12,65% a.a. fixo",
    grossAnnualPct: 12.65,
    liquidity: "Diária (D+1)",
    minHorizonMonths: 24,
    maturityLabel: "01/01/2028",
    fgcCovered: false,
    taxExemptPF: false,
    adminFeeAnnualPct: 0.2,
    earlyRedemptionRisk: "Moderado (Marcação a Mercado)",
    riskScore: 3,
    sourceLabel: "Tesouro Direto",
    potentialUse: "Planejamento com data exata e trava de taxa nominal",
  },
  {
    id: "mkt-fundo-di-soberano",
    name: "Fundo Tesouro Selic Simples (Taxa Zero)",
    issuer: "Gestora Institucional ANBIMA",
    category: "Fundos",
    indexer: "SELIC",
    rateDisplay: "99,5% Selic",
    grossAnnualPct: 11.19,
    liquidity: "Imediata (D+0)",
    minHorizonMonths: 1,
    maturityLabel: "Sem vencimento (Come-cotas semestral)",
    fgcCovered: false, // Patrimônio segregado em títulos públicos federais
    taxExemptPF: false,
    adminFeeAnnualPct: 0.05,
    earlyRedemptionRisk: "Baixíssimo",
    riskScore: 1,
    sourceLabel: "CVM / ANBIMA Dados",
    potentialUse: "Gestão de caixa empresarial (PJ) e liquidez operacional",
  },
  {
    id: "mkt-etf-ivvb11",
    name: "ETF IVVB11 / BOVA11 (Renda Variável)",
    issuer: "BlackRock / B3",
    category: "ETFs e ações",
    indexer: "RENDA_VARIAVEL",
    rateDisplay: "Retorno Histórico ~13,8% a.a. (Alta Volatilidade)",
    grossAnnualPct: 13.8,
    liquidity: "D+2 (Bolsa)",
    minHorizonMonths: 60,
    maturityLabel: "Indeterminado (Renda Variável)",
    fgcCovered: false,
    taxExemptPF: false,
    adminFeeAnnualPct: 0.23,
    earlyRedemptionRisk: "Alto (Volatilidade)",
    riskScore: 5,
    sourceLabel: "B3 À Vista",
    potentialUse: "Diversificação estrutural de longo prazo com tolerância a oscilações",
  },
];

export interface EvaluatedProductResult {
  product: MarketProductCatalogItem;
  netAnnualPct: number;
  realNetGainAboveIpcaPct: number;
  cdiEquivalentPct: number;
  estimatedNetValueReais: number;
  estimatedNetProfitReais: number;
  estimatedTaxReais: number;
  compatible: boolean;
  incompatibilityReason?: string;
  suitabilityBadge: string;
  fgcWarning?: string;
}

/**
 * Avalia cada produto de mercado considerando objetivo, prazo em meses, valor a aplicar e tipo de pessoa (PF/PJ).
 */
export function evaluateMarketProducts(params: {
  objective: InvestmentObjective;
  horizonMonths: number;
  amountReais: number;
  workspaceType: "PF" | "PJ";
  macro?: MacroRates;
}): EvaluatedProductResult[] {
  const macro = params.macro ?? DEFAULT_MACRO_RATES;
  const days = params.horizonMonths * 30;

  let irRate = 0.15;
  if (days <= 180) irRate = 0.225;
  else if (days <= 360) irRate = 0.2;
  else if (days <= 720) irRate = 0.175;

  const evaluated = MARKET_PRODUCTS_CATALOG.map((product) => {
    const effectiveGrossAnnualPct = Math.max(
      0,
      product.grossAnnualPct - product.adminFeeAnnualPct
    );

    // LCI/LCA é isenta para PF, mas tributada para PJ
    const isExempt = product.taxExemptPF && params.workspaceType === "PF";
    const appliedTaxRate = isExempt ? 0 : irRate;

    const yearsFraction = new Decimal(params.horizonMonths).dividedBy(12);
    const grossMultiplier = Decimal.pow(
      new Decimal(1).plus(new Decimal(effectiveGrossAnnualPct).dividedBy(100)),
      yearsFraction
    );

    const amountDec = new Decimal(Math.max(100, params.amountReais));
    const grossFinal = amountDec.times(grossMultiplier);
    const grossProfit = grossFinal.minus(amountDec);
    const estimatedTax = grossProfit.times(appliedTaxRate);
    const netFinal = grossFinal.minus(estimatedTax);
    const netProfit = netFinal.minus(amountDec);

    // Taxa líquida anualizada equivalente
    const netAnnualPct = new Decimal(effectiveGrossAnnualPct)
      .times(1 - appliedTaxRate)
      .toDecimalPlaces(2)
      .toNumber();

    // Ganho real líquido acima do IPCA: ((1 + net) / (1 + ipca)) - 1
    const realNetGainAboveIpcaPct = new Decimal(1)
      .plus(new Decimal(netAnnualPct).dividedBy(100))
      .dividedBy(new Decimal(1).plus(new Decimal(macro.ipcaAnnualPct).dividedBy(100)))
      .minus(1)
      .times(100)
      .toDecimalPlaces(2)
      .toNumber();

    // Equivalência ao CDI bruto (quanto um CDB precisaria pagar para empatar no líquido)
    const cdiEquivalentPct = isExempt
      ? new Decimal(netAnnualPct)
          .dividedBy(1 - irRate)
          .dividedBy(macro.cdiAnnualPct)
          .times(100)
          .toDecimalPlaces(1)
          .toNumber()
      : new Decimal(effectiveGrossAnnualPct)
          .dividedBy(macro.cdiAnnualPct)
          .times(100)
          .toDecimalPlaces(1)
          .toNumber();

    // Regra de compatibilidade com o objetivo e prazo
    let compatible = true;
    let incompatibilityReason: string | undefined;
    let suitabilityBadge = "Equilíbrio Risco/Retorno";

    if (params.horizonMonths < product.minHorizonMonths) {
      compatible = false;
      incompatibilityReason = `Prazo mínimo recomendado ou carência (${product.minHorizonMonths} meses) é superior ao seu horizonte de ${params.horizonMonths} meses.`;
    }

    if (params.objective === "EMERGENCY_LIQUIDITY" || params.objective === "CORPORATE_CASH") {
      if (
        product.liquidity !== "Imediata (D+0)" &&
        product.liquidity !== "Diária (D+1)"
      ) {
        compatible = false;
        incompatibilityReason = `Sem liquidez diária (${product.liquidity}). Reserva de segurança ou caixa operacional exige resgate imediato sem bloqueio.`;
      } else if (product.earlyRedemptionRisk !== "Baixíssimo") {
        compatible = false;
        incompatibilityReason = `Possui risco de oscilação em resgate antecipado (${product.earlyRedemptionRisk}). Inadequado para reserva de emergência.`;
      } else {
        suitabilityBadge = "Ideal para Liquidez e Emergência";
      }
    } else if (params.objective === "MAX_NET_YIELD") {
      if (product.riskScore >= 5 && params.horizonMonths < 36) {
        compatible = false;
        incompatibilityReason =
          "Alta volatilidade de renda variável incompatível com busca de rentabilidade previsível neste prazo.";
      } else if (compatible) {
        suitabilityBadge = "Alta Rentabilidade Líquida";
      }
    } else if (params.objective === "LONG_TERM_REAL_GAIN") {
      if (product.category === "Tesouro IPCA+" || product.category === "ETFs e ações") {
        suitabilityBadge = "Proteção Real & Multiplicação";
      }
    }

    let fgcWarning: string | undefined;
    if (product.fgcCovered && params.amountReais > 250000) {
      fgcWarning =
        "Atenção: O valor simulado ultrapassa o teto de R$ 250.000,00 do FGC por instituição/CPF-CNPJ. Recomendamos pulverizar entre emissores.";
    }

    return {
      product,
      netAnnualPct,
      realNetGainAboveIpcaPct,
      cdiEquivalentPct,
      estimatedNetValueReais: netFinal.toDecimalPlaces(2).toNumber(),
      estimatedNetProfitReais: netProfit.toDecimalPlaces(2).toNumber(),
      estimatedTaxReais: estimatedTax.toDecimalPlaces(2).toNumber(),
      compatible,
      incompatibilityReason,
      suitabilityBadge,
      fgcWarning,
    };
  });

  // Ordena compatíveis primeiro, depois conforme objetivo
  return evaluated.sort((a, b) => {
    if (a.compatible !== b.compatible) {
      return a.compatible ? -1 : 1;
    }
    if (
      params.objective === "EMERGENCY_LIQUIDITY" ||
      params.objective === "CORPORATE_CASH"
    ) {
      if (a.product.riskScore !== b.product.riskScore) {
        return a.product.riskScore - b.product.riskScore;
      }
      return b.netAnnualPct - a.netAnnualPct;
    }
    return b.netAnnualPct - a.netAnnualPct;
  });
}
