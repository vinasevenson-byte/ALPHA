import { describe, expect, it } from "vitest";
import {
  addMonthsIso,
  advancePeriodicityIso,
  sanitizeCsvCell,
} from "./planning";
import {
  calculateFinancialHealthIndex,
  qualityStatus,
} from "./intelligence";

describe("NOVA Pacotes 10 & 11 — Recorrências, Calendário Exato, Segurança CSV e Saúde P04", () => {
  it("P10: addMonthsIso respeita último dia do mês em anos comuns e bissextos", () => {
    expect(addMonthsIso("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonthsIso("2028-01-31", 1)).toBe("2028-02-29");
    expect(addMonthsIso("2026-11-15", 3)).toBe("2027-02-15");
    expect(addMonthsIso("2026-03-31", 1)).toBe("2026-04-30");
  });

  it("P10: advancePeriodicityIso avança ciclos WEEKLY, MONTHLY e YEARLY com precisão", () => {
    expect(advancePeriodicityIso("2026-11-10", "WEEKLY")).toBe("2026-11-17");
    expect(advancePeriodicityIso("2026-01-31", "MONTHLY")).toBe("2026-02-28");
    expect(advancePeriodicityIso("2028-02-29", "YEARLY")).toBe("2029-02-28");
  });

  it("P0/P11: sanitizeCsvCell neutraliza Formula Injection (=, +, -, @, tab, CR) e escapa aspas", () => {
    expect(sanitizeCsvCell("=CMD|' /C calc'!A0")).toBe("'=CMD|' /C calc'!A0");
    expect(sanitizeCsvCell("+SUM(A1:A5)")).toBe("'+SUM(A1:A5)");
    expect(sanitizeCsvCell("-100+cmd")).toBe("'-100+cmd");
    expect(sanitizeCsvCell("@SUM(1+1)")).toBe("'@SUM(1+1)");
    expect(sanitizeCsvCell("\t=1+1")).toBe("'\t=1+1");
    expect(sanitizeCsvCell('Fornecedor "Alpha", Ltda')).toBe(
      '"Fornecedor ""Alpha"", Ltda"'
    );
    expect(sanitizeCsvCell("1250.50")).toBe("1250.50");
    expect(sanitizeCsvCell("-250.75")).toBe("-250.75");
    expect(sanitizeCsvCell(-250.75)).toBe("-250.75");
  });

  it("P0/P04: calculateFinancialHealthIndex retorna Estado Zero honesto quando hasSufficientData = false", () => {
    const res = calculateFinancialHealthIndex({
      hasSufficientData: false,
      asOf: "2026-11-10",
      eligibleBalanceCents: 0,
      minForecastBalanceCents: 0,
      safetyBufferCents: 0,
      overdueInstallmentsCount: 0,
      totalInstallmentsCount: 0,
      exceededBudgetsCount: 0,
      totalBudgetsCount: 0,
      allocatedReservesCents: 0,
      topExpenseCategorySharePct: 0,
    });

    expect(res.totalScore).toBeNull();
    expect(res.band).toBe("INSUFFICIENT_DATA");
    expect(res.dimensions).toEqual([]);
    expect(res.summary.length).toBeGreaterThan(10);
  });

  it("P0/P04: calculateFinancialHealthIndex entrega 5 dimensões ponderadas (100%) e band alinhado à UI", () => {
    const res = calculateFinancialHealthIndex({
      hasSufficientData: true,
      asOf: "2026-11-10",
      eligibleBalanceCents: 800000,
      minForecastBalanceCents: 500000,
      safetyBufferCents: 200000,
      overdueInstallmentsCount: 0,
      totalInstallmentsCount: 4,
      exceededBudgetsCount: 0,
      totalBudgetsCount: 2,
      allocatedReservesCents: 300000,
      topExpenseCategorySharePct: 35,
    });

    expect(res.totalScore).not.toBeNull();
    expect(res.band).toBe("EXCELLENT");
    expect(res.dimensions).toHaveLength(5);
    const totalWeight = res.dimensions.reduce((s, d) => s + d.weightPct, 0);
    expect(totalWeight).toBe(100);
  });

  it("P0/P04: qualityStatus classifica COMPLETE, INSUFFICIENT_DATA, PARTIAL e STALE com razões explícitas", () => {
    const complete = qualityStatus({
      missingAccounts: 0,
      unreconciledTransactions: 0,
      staleMarketPrices: 0,
    });
    expect(complete.status).toBe("COMPLETE");
    expect(complete.reasons).toEqual([]);

    const noAccounts = qualityStatus({
      missingAccounts: 1,
      unreconciledTransactions: 2,
      staleMarketPrices: 0,
    });
    expect(noAccounts.status).toBe("INSUFFICIENT_DATA");
    expect(noAccounts.reasons).toHaveLength(2);

    const partial = qualityStatus({
      missingAccounts: 0,
      unreconciledTransactions: 3,
      staleMarketPrices: 0,
    });
    expect(partial.status).toBe("PARTIAL");

    const stale = qualityStatus({
      missingAccounts: 0,
      unreconciledTransactions: 0,
      staleMarketPrices: 1,
    });
    expect(stale.status).toBe("STALE");
  });
});
