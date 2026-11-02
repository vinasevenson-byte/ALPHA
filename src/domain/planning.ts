/**
 * NOVA — Pacote 01 & Pacote 02
 * Motor de Domínio Puro (Invariantes Financeiras, Projeção de Fluxo de Caixa,
 * Obrigações/Parcelas e Capacidade Conservadora de Reserva).
 * Zero uso de float para cálculo financeiro; aritmética inteira em centavos (BigInt / Int).
 */

export type MoneyCents = bigint;

export type ForecastEntry = {
  date: string;
  inbound: MoneyCents;
  outbound: MoneyCents;
};

export type ForecastPoint = {
  date: string;
  starting: MoneyCents;
  inbound: MoneyCents;
  outbound: MoneyCents;
  ending: MoneyCents;
};

/**
 * Constrói a série diária ordenada de fluxo de caixa projetado.
 */
export function buildForecast(
  opening: MoneyCents,
  entries: ForecastEntry[]
): ForecastPoint[] {
  let balance = opening;
  return [...entries]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((row) => {
      if (row.inbound < 0n || row.outbound < 0n) {
        throw new Error("NEGATIVE_FORECAST_AMOUNT");
      }
      const point: ForecastPoint = {
        date: row.date,
        starting: balance,
        inbound: row.inbound,
        outbound: row.outbound,
        ending: balance + row.inbound - row.outbound,
      };
      balance = point.ending;
      return point;
    });
}

export type CapacityInput = {
  eligibleBalance: MoneyCents;
  minForecastBalance: MoneyCents;
  safetyBuffer: MoneyCents;
  alreadyAllocated: MoneyCents;
  overdueNotInForecast: MoneyCents;
};

/**
 * Cálculo conservador da capacidade adicional estimada para reservar (headroom):
 * headroom = max(0, min(S, Pmin) - B - R - U)
 * Exemplo canônico P02: S=10.000, Pmin=7.000, B=2.000, R=1.000, U=0 => 4.000
 */
export function calculateReserveCapacity(x: CapacityInput): MoneyCents {
  if (
    x.safetyBuffer < 0n ||
    x.alreadyAllocated < 0n ||
    x.overdueNotInForecast < 0n
  ) {
    throw new Error("NEGATIVE_INPUT");
  }
  const minimum =
    x.eligibleBalance < x.minForecastBalance
      ? x.eligibleBalance
      : x.minForecastBalance;
  const remaining =
    minimum - x.safetyBuffer - x.alreadyAllocated - x.overdueNotInForecast;
  return remaining > 0n ? remaining : 0n;
}

/**
 * Calcula o saldo virtual alocado em um cofre ou no conjunto de cofres.
 */
export function allocationBalance(
  movements: {
    kind: "ALLOCATE" | "RELEASE" | "TRANSFER_IN" | "TRANSFER_OUT";
    amount: MoneyCents;
  }[]
): MoneyCents {
  return movements.reduce((sum, m) => {
    if (m.amount <= 0n) throw new Error("NON_POSITIVE_ALLOCATION");
    return (
      sum +
      (m.kind === "ALLOCATE" || m.kind === "TRANSFER_IN" ? m.amount : -m.amount)
    );
  }, 0n);
}

/**
 * Calcula o saldo em aberto (outstanding) de uma parcela, impedindo baixa acima do devido.
 */
export function remainingInstallment(
  amount: MoneyCents,
  settlements: MoneyCents[]
): MoneyCents {
  if (amount <= 0n || settlements.some((x) => x <= 0n)) {
    throw new Error("INVALID_SETTLEMENT");
  }
  const paid = settlements.reduce((a, b) => a + b, 0n);
  if (paid > amount) throw new Error("OVER_SETTLEMENT");
  return amount - paid;
}

/**
 * Calcula a contribuição mensal necessária para atingir uma meta no prazo restante,
 * arredondando para cima em centavos sem assumir rentabilidade hipotética.
 */
export function monthlyContribution(
  target: MoneyCents,
  allocated: MoneyCents,
  remainingMonths: number
): MoneyCents {
  if (!Number.isInteger(remainingMonths) || remainingMonths <= 0) {
    throw new Error("INVALID_MONTHS");
  }
  const missing = target - allocated;
  if (missing <= 0n) return 0n;
  return (missing + BigInt(remainingMonths) - 1n) / BigInt(remainingMonths);
}

/**
 * Invariante P01 #2 e #4:
 * Saldo atual da conta = saldo inicial + receitas liquidadas - despesas liquidadas
 * + transferências recebidas liquidadas - transferências enviadas liquidadas + ajustes auditados.
 * Lançamentos PENDING ou CANCELED não alteram o saldo atual.
 */
export function computeAccountBalanceCents(
  openingBalanceCents: number,
  transactions: Array<{
    kind: string;
    status: string;
    amountCents: number;
    signedAdjustDir?: number;
  }>
): number {
  let balance = BigInt(openingBalanceCents);

  for (const tx of transactions) {
    if (tx.amountCents <= 0) {
      throw new Error("NON_POSITIVE_TRANSACTION_AMOUNT");
    }
    if (tx.status !== "SETTLED") continue;

    const amt = BigInt(tx.amountCents);
    if (tx.kind === "INCOME" || tx.kind === "TRANSFER_IN" || tx.kind === "OPENING_BALANCE") {
      balance += amt;
    } else if (tx.kind === "EXPENSE" || tx.kind === "TRANSFER_OUT") {
      balance -= amt;
    } else if (tx.kind === "ADJUSTMENT") {
      balance += (tx.signedAdjustDir ?? 1) >= 0 ? amt : -amt;
    }
  }

  return Number(balance);
}

/**
 * Invariante P01 #3:
 * Transferências internas (TRANSFER_IN / TRANSFER_OUT) não compõem receita nem despesa consolidadas.
 */
export function computeConsolidatedTotals(
  transactions: Array<{
    kind: string;
    status: string;
    amountCents: number;
  }>
): {
  settledIncomeCents: number;
  settledExpenseCents: number;
  pendingIncomeCents: number;
  pendingExpenseCents: number;
} {
  let settledIncome = 0n;
  let settledExpense = 0n;
  let pendingIncome = 0n;
  let pendingExpense = 0n;

  for (const tx of transactions) {
    const amt = BigInt(tx.amountCents);
    if (tx.status === "SETTLED") {
      if (tx.kind === "INCOME") settledIncome += amt;
      else if (tx.kind === "EXPENSE") settledExpense += amt;
    } else if (tx.status === "PENDING") {
      if (tx.kind === "INCOME") pendingIncome += amt;
      else if (tx.kind === "EXPENSE") pendingExpense += amt;
    }
  }

  return {
    settledIncomeCents: Number(settledIncome),
    settledExpenseCents: Number(settledExpense),
    pendingIncomeCents: Number(pendingIncome),
    pendingExpenseCents: Number(pendingExpense),
  };
}

/**
 * Divide um valor total em centavos em N parcelas exatas sem perda de centavos.
 */
export function splitInstallmentsExact(
  totalCents: number,
  installmentCount: number
): number[] {
  if (totalCents <= 0 || installmentCount < 1) {
    throw new Error("INVALID_INSTALLMENT_SPLIT");
  }
  const base = Math.floor(totalCents / installmentCount);
  const remainder = totalCents % installmentCount;
  return Array.from({ length: installmentCount }, (_, idx) =>
    idx < remainder ? base + 1 : base
  );
}

export function centsToDecimalString(cents: number | bigint): string {
  const b = typeof cents === "bigint" ? cents : BigInt(Math.round(cents));
  const negative = b < 0n;
  const abs = negative ? -b : b;
  const intPart = abs / 100n;
  const fracPart = (abs % 100n).toString().padStart(2, "0");
  return `${negative ? "-" : ""}${intPart.toString()}.${fracPart}`;
}

export function decimalStringToCents(input: string | number): number {
  if (typeof input === "number") {
    return Math.round(input * 100);
  }
  const normalized = input.trim().replace(",", ".");
  if (!/^-?\d+(\.\d{1,4})?$/.test(normalized)) {
    throw new Error("INVALID_DECIMAL_MONEY");
  }
  const [intStr, fracStr = ""] = normalized.split(".");
  const negative = intStr.startsWith("-");
  const cleanInt = negative ? intStr.slice(1) : intStr;
  const paddedFrac = (fracStr + "00").slice(0, 2);
  const cents = Number(cleanInt) * 100 + Number(paddedFrac);
  return negative ? -cents : cents;
}

export function formatBRL(cents: number | bigint): string {
  const num = Number(cents) / 100;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

export function formatDateBR(isoDate?: string | null): string {
  if (!isoDate) return "—";
  const clean = isoDate.slice(0, 10);
  const parts = clean.split("-");
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}
