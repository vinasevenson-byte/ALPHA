import { describe, expect, it } from "vitest";
import {
  buildForecast,
  calculateReserveCapacity,
  allocationBalance,
  remainingInstallment,
  monthlyContribution,
  computeAccountBalanceCents,
  computeConsolidatedTotals,
  splitInstallmentsExact,
  centsToDecimalString,
  decimalStringToCents,
} from "./planning";

describe("NOVA P01 & P02 — Invariantes Financeiras e Planejamento", () => {
  it("P01: Uma conta recém-criada sem saldo inicial aparece em R$ 0,00 (0 centavos)", () => {
    expect(computeAccountBalanceCents(0, [])).toBe(0);
    expect(centsToDecimalString(0)).toBe("0.00");
  });

  it("P01: Receita liquidada de R$ 1.000 e despesa liquidada de R$ 250 resultam em saldo R$ 750; pendentes não alteram saldo atual", () => {
    const balance = computeAccountBalanceCents(0, [
      { kind: "INCOME", status: "SETTLED", amountCents: 100000 },
      { kind: "EXPENSE", status: "SETTLED", amountCents: 25000 },
      { kind: "EXPENSE", status: "PENDING", amountCents: 10000 },
    ]);
    expect(balance).toBe(75000);
  });

  it("P01: Transferências internas preservam o saldo consolidado e não contam como receita ou despesa", () => {
    const accA = computeAccountBalanceCents(100000, [
      { kind: "TRANSFER_OUT", status: "SETTLED", amountCents: 30000 },
    ]);
    const accB = computeAccountBalanceCents(0, [
      { kind: "TRANSFER_IN", status: "SETTLED", amountCents: 30000 },
    ]);
    expect(accA + accB).toBe(100000);

    const totals = computeConsolidatedTotals([
      { kind: "INCOME", status: "SETTLED", amountCents: 100000 },
      { kind: "TRANSFER_OUT", status: "SETTLED", amountCents: 30000 },
      { kind: "TRANSFER_IN", status: "SETTLED", amountCents: 30000 },
    ]);
    expect(totals.settledIncomeCents).toBe(100000);
    expect(totals.settledExpenseCents).toBe(0);
  });

  it("P02: prevê apenas abertos futuros; entradas e saídas fornecidas sem duplicação", () => {
    const rows = buildForecast(100000n, [
      { date: "2026-11-03", inbound: 30000n, outbound: 10000n },
      { date: "2026-11-02", inbound: 0n, outbound: 20000n },
    ]);
    expect(rows.map((x) => x.ending)).toEqual([80000n, 100000n]);
  });

  it("P02: não propõe reserva quando menor saldo fica abaixo da margem", () => {
    expect(
      calculateReserveCapacity({
        eligibleBalance: 100000n,
        minForecastBalance: 15000n,
        safetyBuffer: 20000n,
        alreadyAllocated: 0n,
        overdueNotInForecast: 0n,
      })
    ).toBe(0n);
  });

  it("P02: evita descontar compromissos vencidos duas vezes (S=10.000, Pmin=7.000, B=2.000, R=1.000 -> R$ 4.000,00)", () => {
    expect(
      calculateReserveCapacity({
        eligibleBalance: 1000000n,
        minForecastBalance: 700000n,
        safetyBuffer: 200000n,
        alreadyAllocated: 100000n,
        overdueNotInForecast: 0n,
      })
    ).toBe(400000n);
  });

  it("P02: alocações entre cofres são neutras no agregado", () => {
    expect(
      allocationBalance([
        { kind: "ALLOCATE", amount: 10000n },
        { kind: "TRANSFER_OUT", amount: 3000n },
        { kind: "TRANSFER_IN", amount: 3000n },
      ])
    ).toBe(10000n);
  });

  it("P02: não permite baixa maior que o saldo da parcela", () => {
    expect(() => remainingInstallment(10000n, [7000n, 4000n])).toThrow(
      "OVER_SETTLEMENT"
    );
    expect(remainingInstallment(10000n, [7000n])).toBe(3000n);
  });

  it("P02: arredonda o aporte mensal para cima em centavos", () => {
    expect(monthlyContribution(10001n, 0n, 3)).toBe(3334n);
  });

  it("P02: distribui centavos de parcelamento com soma exata (ex: R$ 100,00 em 3x = 33,34 + 33,33 + 33,33)", () => {
    const parts = splitInstallmentsExact(10000, 3);
    expect(parts).toEqual([3334, 3333, 3333]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(10000);
  });

  it("P01/P02: converte strings decimais da API sem perda de precisão (0.01, 0.03, 999999999.99)", () => {
    expect(decimalStringToCents("0.01")).toBe(1);
    expect(decimalStringToCents("0.03")).toBe(3);
    expect(decimalStringToCents("999999999.99")).toBe(99999999999);
    expect(centsToDecimalString(99999999999n)).toBe("999999999.99");
  });
});
