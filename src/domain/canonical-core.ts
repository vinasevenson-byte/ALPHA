/**
 * NOVA — Pacote 05 (v5.0.0)
 * Núcleo Financeiro Canônico Compartilhado (BigInt em centavos exatos)
 *
 * Princípios:
 * 1. Centavos inteiros exatos (bigint) no domínio e representação decimal string ("1234.56") na API.
 * 2. Sem duplicar cálculos de saldos, receitas, despesas, projeção ou capacidade de reserva.
 * 3. Isolamento estrito por workspaceId (PF vs PJ).
 * 4. Transferências internas (TRANSFER_IN / TRANSFER_OUT) mantêm o saldo consolidado e jamais inflam receitas/despesas.
 * 5. Capacidade conservadora de reserva depende de conciliação declarada/verificada (reconciled === true).
 */

export interface CanonicalAccount {
  id: string;
  workspaceId: string;
  name?: string;
  openingCents: string | bigint | number;
}

export interface CanonicalTransaction {
  id?: string;
  workspaceId: string;
  accountId: string;
  kind?: "INCOME" | "EXPENSE" | "TRANSFER_IN" | "TRANSFER_OUT" | string;
  status: "SETTLED" | "PENDING" | "CANCELED" | string;
  signedCents: string | bigint | number;
  date?: string;
  dueDate: string;
  description?: string;
}

/**
 * Converte uma string decimal positiva ("1234.56") em centavos BigInt exatos (123456n).
 */
export function cents(value: string): bigint {
  if (
    typeof value !== "string" ||
    !/^(0|[1-9]\d{0,11})(\.\d{1,2})?$/.test(value)
  ) {
    throw new Error("Valor inválido: use formato 1234.56");
  }
  const [intPart, fracPart = ""] = value.split(".");
  return (
    BigInt(intPart) * 100n + BigInt((fracPart + "00").slice(0, 2))
  );
}

/**
 * Formata um valor em centavos (bigint, number ou string inteira) para string decimal canônica ("1234.56" ou "-1234.56").
 */
export function money(n: bigint | number | string): string {
  let val = BigInt(n);
  const neg = val < 0n ? "-" : "";
  if (val < 0n) val = -val;
  return (
    neg +
    (val / 100n).toString() +
    "." +
    (val % 100n).toString().padStart(2, "0")
  );
}

/**
 * Calcula o saldo realizado (apenas transações SETTLED) de uma conta específica.
 */
export function balance(
  account: CanonicalAccount,
  tx: CanonicalTransaction[]
): bigint {
  return tx
    .filter((t) => t.status === "SETTLED" && t.accountId === account.id)
    .reduce((acc, t) => acc + BigInt(t.signedCents), BigInt(account.openingCents));
}

/**
 * Calcula o resumo realizado (saldo consolidado, receitas liquidadas e despesas liquidadas)
 * isolado por workspaceId. Transferências internas não entram em income nem em expense.
 */
export function summary(
  accounts: CanonicalAccount[],
  tx: CanonicalTransaction[],
  workspaceId: string
): {
  balance: string;
  income: string;
  expense: string;
} {
  const ownAccounts = accounts.filter((x) => x.workspaceId === workspaceId);
  const settledItems = tx.filter(
    (x) => x.workspaceId === workspaceId && x.status === "SETTLED"
  );

  const totalBalance = ownAccounts.reduce(
    (sum, acc) => sum + balance(acc, settledItems),
    0n
  );
  const totalIncome = settledItems
    .filter((t) => t.kind === "INCOME")
    .reduce((sum, t) => sum + BigInt(t.signedCents), 0n);
  const totalExpense = -settledItems
    .filter((t) => t.kind === "EXPENSE")
    .reduce((sum, t) => sum + BigInt(t.signedCents), 0n);

  return {
    balance: money(totalBalance),
    income: money(totalIncome),
    expense: money(totalExpense),
  };
}

/**
 * Calcula a projeção de fluxo de caixa a partir do saldo realizado atual somando
 * cronologicamente os compromissos pendentes (status === 'PENDING') do workspace.
 */
export function projection(
  accounts: CanonicalAccount[],
  tx: CanonicalTransaction[],
  workspaceId: string
): {
  minimum: string;
  closing: string;
  points: Array<{ date: string; balance: string }>;
} {
  let current = 0n;
  for (const a of accounts.filter((x) => x.workspaceId === workspaceId)) {
    current += balance(a, tx);
  }

  const pending = tx
    .filter((x) => x.workspaceId === workspaceId && x.status === "PENDING")
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  let minimum = current;
  const points: Array<{ date: string; balance: string }> = [];

  for (const t of pending) {
    current += BigInt(t.signedCents);
    if (current < minimum) minimum = current;
    points.push({ date: t.dueDate, balance: money(current) });
  }

  return {
    minimum: money(minimum),
    closing: money(current),
    points,
  };
}

/**
 * Calcula a capacidade conservadora de reserva em BigInt.
 * Retorna null caso o workspace ainda não esteja conciliado (reconciled === false).
 */
export function capacity(
  minimumCents: string | bigint | number,
  protectedCents: string | bigint | number,
  allocatedCents: string | bigint | number,
  reconciled: boolean
): string | null {
  if (!reconciled) return null;
  const val =
    BigInt(minimumCents) - BigInt(protectedCents) - BigInt(allocatedCents);
  return money(val > 0n ? val : 0n);
}
