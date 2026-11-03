/**
 * NOVA — Pacote 06 (v6.0.0)
 * Consolidação Operacional, Segurança (scrypt + sessões + idempotência) e Domínio BigInt
 */
import crypto from "node:crypto";

export interface P06AccountInput {
  id?: string;
  name?: string;
  openingCents: bigint | number | string;
}

export interface P06TransactionInput {
  id?: string;
  accountId?: string;
  kind: "INCOME" | "EXPENSE" | "TRANSFER_IN" | "TRANSFER_OUT" | string;
  status: "PENDING" | "SETTLED" | string;
  signedCents: bigint | number | string;
  date?: string | Date;
  dueDate: string | Date;
  description?: string;
}

export interface P06ReserveInput {
  id?: string;
  name?: string;
  amountCents: bigint | number | string;
}

export function parseMoney(value: unknown): bigint {
  const s = String(value);
  if (!/^(?:0|[1-9]\d{0,12})(?:\.\d{1,2})?$/.test(s)) {
    throw new Error("Valor monetário inválido");
  }
  const [reais, centavos = ""] = s.split(".");
  const n = BigInt(reais) * 100n + BigInt((centavos + "00").slice(0, 2));
  if (n <= 0n) {
    throw new Error("Valor deve ser positivo");
  }
  return n;
}

export function asMoney(c: bigint | number | string): string {
  const v = BigInt(c);
  const neg = v < 0n ? "-" : "";
  const a = v < 0n ? -v : v;
  return (
    neg +
    (a / 100n).toString() +
    "." +
    (a % 100n).toString().padStart(2, "0")
  );
}

export function compute(
  accounts: P06AccountInput[],
  transactions: P06TransactionInput[],
  reserves: P06ReserveInput[] = [],
  reconciled = false
): {
  summary: { balance: string; income: string; expense: string };
  projection: {
    minimum: string;
    closing: string;
    points: Array<{ date: string; balance: string }>;
  };
  capacity: string | null;
} {
  const balance =
    accounts.reduce((x, a) => x + BigInt(a.openingCents), 0n) +
    transactions
      .filter((t) => t.status === "SETTLED")
      .reduce((x, t) => x + BigInt(t.signedCents), 0n);

  const income = transactions
    .filter((t) => t.status === "SETTLED" && t.kind === "INCOME")
    .reduce((x, t) => x + BigInt(t.signedCents), 0n);

  const expense = transactions
    .filter((t) => t.status === "SETTLED" && t.kind === "EXPENSE")
    .reduce((x, t) => x - BigInt(t.signedCents), 0n);

  let current = balance;
  let min = balance;
  const toIsoDate = (d: string | Date) =>
    d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10);

  const pending = transactions
    .filter((t) => t.status === "PENDING")
    .sort((a, b) => toIsoDate(a.dueDate).localeCompare(toIsoDate(b.dueDate)));

  const points = pending.map((t) => {
    current += BigInt(t.signedCents);
    if (current < min) min = current;
    return { date: toIsoDate(t.dueDate), balance: asMoney(current) };
  });

  const allocated = reserves.reduce((x, r) => x + BigInt(r.amountCents), 0n);
  const capacity = min - allocated;

  return {
    summary: {
      balance: asMoney(balance),
      income: asMoney(income),
      expense: asMoney(expense),
    },
    projection: {
      minimum: asMoney(min),
      closing: asMoney(current),
      points,
    },
    capacity: reconciled ? asMoney(capacity > 0n ? capacity : 0n) : null,
  };
}

export function validateISODate(s: unknown): Date {
  if (
    typeof s !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(s) ||
    Number.isNaN(Date.parse(s)) ||
    new Date(s + "T00:00:00Z").toISOString().slice(0, 10) !== s
  ) {
    throw new Error("Data inválida");
  }
  return new Date(s + "T00:00:00Z");
}

export function safeString(x: unknown, max = 180): string {
  if (typeof x !== "string" || !x.trim() || x.length > max) {
    throw new Error("Texto inválido");
  }
  return x.trim();
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function makePassword(
  password: string,
  salt = crypto.randomBytes(16).toString("hex")
): string {
  return `${salt}:${crypto.scryptSync(password, salt, 64).toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  if (!stored || !stored.includes(":")) return false;
  const [salt, expected] = stored.split(":");
  if (!salt || !expected) return false;
  const actual = makePassword(password, salt).split(":")[1];
  return (
    actual.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected))
  );
}
