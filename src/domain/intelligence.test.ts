import { describe, it, expect } from "vitest";
import {
  projectCash,
  reserveCapacity,
  savingsRate,
  detectCashRisk,
  qualityStatus,
  calculateFinancialHealthIndex,
  answerReadonlyAssistant,
} from "./intelligence";
import { externalDedupeKey } from "./connector-contract";

describe("NOVA P4 core intelligence & integrations", () => {
  it("projects only pending, not settled twice", () => {
    const p = projectCash(100000, "2026-11-01", "2026-11-30", [
      {
        id: "a",
        date: "2026-11-10",
        amountCents: 30000,
        kind: "EXPENSE",
        status: "PENDING",
      },
      {
        id: "b",
        date: "2026-11-12",
        amountCents: 90000,
        kind: "INCOME",
        status: "SETTLED",
      },
    ]);
    expect(p.minimumCents).toBe(70000);
    expect(p.closingCents).toBe(70000);
  });

  it("rejects duplicate events", () =>
    expect(() =>
      projectCash(100, "2026-11-01", "2026-11-30", [
        {
          id: "x",
          date: "2026-11-10",
          amountCents: 10,
          kind: "EXPENSE",
          status: "PENDING",
        },
        {
          id: "x",
          date: "2026-11-11",
          amountCents: 10,
          kind: "EXPENSE",
          status: "PENDING",
        },
      ])
    ).toThrow("Duplicate"));

  it("returns unavailable if not reconciled", () =>
    expect(
      reserveCapacity({
        projection: null,
        protectedMinimumCents: 0,
        allocatedReserveCents: 0,
        uncertaintyBufferCents: 0,
        complete: false,
        reconciled: false,
      }).status
    ).toBe("UNAVAILABLE"));

  it("never produces negative reserve capacity", () => {
    const p = projectCash(3000, "2026-11-01", "2026-11-30", []);
    expect(
      reserveCapacity({
        projection: p,
        protectedMinimumCents: 2000,
        allocatedReserveCents: 2000,
        uncertaintyBufferCents: 500,
        complete: true,
        reconciled: true,
      })
    ).toMatchObject({ capacityCents: 0 });
  });

  it("notices negative future balances", () => {
    const p = projectCash(1000, "2026-11-01", "2026-11-30", [
      {
        id: "c",
        date: "2026-11-15",
        amountCents: 4000,
        kind: "EXPENSE",
        status: "PENDING",
      },
    ]);
    expect(detectCashRisk(p, "ledger")).toHaveLength(1);
  });

  it("does not fabricate savings rate", () =>
    expect(savingsRate(0, 100)).toBeNull());

  it("gates suggestions on integrity", () =>
    expect(
      qualityStatus({
        missingAccounts: 0,
        unreconciledTransactions: 1,
        staleMarketPrices: 0,
      }).eligibleForAutomatedSuggestions
    ).toBe(false));

  it("rejects invalid dates", () =>
    expect(() => projectCash(0, "2026-02-30", "2026-03-31", [])).toThrow(
      "Invalid"
    ));

  it("scopes external dedupe key to workspace + provider + account + externalId", () => {
    const key = externalDedupeKey("ws-1", "itau-of", "acc-01", "tx-99");
    expect(key).toBe('["ws-1","itau-of","acc-01","tx-99"]');
    expect(() => externalDedupeKey("ws-1", "", "acc-01", "tx-99")).toThrow(
      "Required key part missing"
    );
  });

  it("returns null health score when data is insufficient and weighted score when sufficient", () => {
    const emptyHealth = calculateFinancialHealthIndex({
      hasSufficientData: false,
      asOf: "2026-11-02",
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
    expect(emptyHealth.totalScore).toBeNull();

    const populatedHealth = calculateFinancialHealthIndex({
      hasSufficientData: true,
      asOf: "2026-11-02",
      eligibleBalanceCents: 1000000,
      minForecastBalanceCents: 700000,
      safetyBufferCents: 200000,
      overdueInstallmentsCount: 0,
      totalInstallmentsCount: 2,
      exceededBudgetsCount: 0,
      totalBudgetsCount: 2,
      allocatedReservesCents: 200000,
      topExpenseCategorySharePct: 40,
    });
    expect(populatedHealth.totalScore).toBeGreaterThanOrEqual(85);
    expect(populatedHealth.status).toBe("EXCELLENT");
  });

  it("enforces read-only guardrail in assistant when asked to execute payments", () => {
    const ans = answerReadonlyAssistant("Pague agora o boleto de R$ 500", {
      asOf: "2026-11-02",
      workspaceName: "Finanças Pessoais",
      workspaceType: "PERSONAL",
      eligibleBalanceFormatted: "R$ 10.000,00",
      settledIncomeFormatted: "R$ 10.000,00",
      settledExpenseFormatted: "R$ 2.000,00",
      minForecastFormatted: "R$ 7.000,00",
      projectedEndFormatted: "R$ 7.000,00",
      headroomFormatted: "R$ 4.000,00",
      safetyBufferFormatted: "R$ 2.000,00",
      openPayablesFormatted: "R$ 3.000,00",
      openPayablesCount: 1,
      portfolioGrossFormatted: "R$ 41.090,00",
      isZeroState: false,
      qualityEligible: true,
    });
    expect(ans.blockedAction).toBe(true);
  });
});
