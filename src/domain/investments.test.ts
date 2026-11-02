import { describe, it, expect } from "vitest";
import {
  brazilPfFixedIncomeTax,
  taxableFixedIncomeRedemption,
  futureValue,
  assessQuote,
  projectLiquidity,
} from "./investments";

describe("NOVA P03 — Faixas Renda Fixa PF, Simulador Patrimonial, Cotações e Liquidez", () => {
  it("testa as quatro fronteiras da tabela regressiva IR PF (22.5%, 20%, 17.5%, 15%)", () => {
    expect(
      [180, 181, 360, 361, 720, 721].map((d) => brazilPfFixedIncomeTax(d).rate)
    ).toEqual([0.225, 0.2, 0.2, 0.175, 0.175, 0.15]);
  });

  it("não tributa prejuízo e exige IOF antes de 30 dias", () => {
    expect(
      taxableFixedIncomeRedemption({
        principal: 1000,
        grossRedemption: 950,
        days: 365,
      }).incomeTax
    ).toBe(0);
    expect(() =>
      taxableFixedIncomeRedemption({
        principal: 1000,
        grossRedemption: 1100,
        days: 10,
      })
    ).toThrow("IOF");
  });

  it("desconta tributos somente de ganho positivo", () => {
    const a = taxableFixedIncomeRedemption({
      principal: 1000,
      grossRedemption: 1100,
      days: 365,
    });
    expect(a.incomeTax).toBeCloseTo(17.5);
    expect(a.netRedemption).toBeCloseTo(1082.5);
  });

  it("valida o exemplo canônico do Simulador Patrimonial P03 (R$ 5.000 inicial + R$ 500/mês por 10 anos a 9% a.a. = R$ 106.696,15)", () => {
    const sim = futureValue({
      principal: 5000,
      monthly: 500,
      years: 10,
      annualRate: 0.09,
    });
    expect(sim.contributions).toBe(65000);
    expect(Number(sim.amount.toFixed(2))).toBe(106696.15);
    expect(Number(sim.earnings.toFixed(2))).toBe(41696.15);
  });

  it("indica cotação defasada (STALE) e separa liquidez disponível vs bloqueada", () => {
    expect(
      assessQuote({ price: 1, asOfMs: 100, nowMs: 1000, maxAgeMs: 100 })
    ).toBe("STALE");
    expect(
      projectLiquidity(
        [
          { amount: 100, redemptionAvailableAt: "2026-01-01" },
          { amount: 200, redemptionAvailableAt: "2027-01-01" },
        ],
        "2026-11-01"
      )
    ).toEqual({ available: 100, locked: 200 });
  });
});
