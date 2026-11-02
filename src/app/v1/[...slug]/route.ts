import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceFullState } from "@/lib/nova-service";
import { centsToDecimalString, formatBRL } from "@/domain/planning";
import { answerReadonlyAssistant } from "@/domain/intelligence";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await context.params;
  const requestId = `req_${Date.now().toString(36)}`;
  const { searchParams } = new URL(req.url);

  try {
    // Ex: /v1/workspaces/:workspaceId/...
    if (slug[0] === "workspaces" && slug[1]) {
      const workspaceId = slug[1];
      const horizonDays = Number(searchParams.get("horizonDays") ?? 180);
      const state = await getWorkspaceFullState({ workspaceId, horizonDays });

      const subRoute = slug.slice(2).join("/");

      if (subRoute === "intelligence/summary") {
        return NextResponse.json(
          {
            asOf: new Date().toISOString(),
            quality: state.p04Intelligence.quality.eligibleForAutomatedSuggestions
              ? "VERIFIED"
              : state.accounts.length === 0
              ? "UNAVAILABLE"
              : "ESTIMATED",
            reserveCapacityCents:
              state.accounts.length === 0 ? null : state.kpis.headroomCents,
            minimumProjectedCents:
              state.accounts.length === 0
                ? null
                : state.kpis.minForecastBalanceCents,
            healthIndex: state.p04Intelligence.healthIndex,
            explanations: state.reserveCapacityReport.explanations,
          },
          { headers: { "X-Request-Id": requestId } }
        );
      }

      if (subRoute === "insights") {
        return NextResponse.json(
          { items: state.financialInsights, total: state.financialInsights.length },
          { headers: { "X-Request-Id": requestId } }
        );
      }

      if (subRoute === "connections") {
        return NextResponse.json(
          { items: state.financialConnections },
          { headers: { "X-Request-Id": requestId } }
        );
      }

      if (subRoute === "alerts" || subRoute === "insights/alerts") {
        return NextResponse.json(
          { items: state.alerts },
          { headers: { "X-Request-Id": requestId } }
        );
      }

      if (subRoute === "planning/reserve-capacity") {
        return NextResponse.json(state.reserveCapacityReport, {
          headers: { "X-Request-Id": requestId },
        });
      }

      if (subRoute === "planning/overview" || subRoute === "dashboard") {
        return NextResponse.json(
          {
            asOf: new Date().toISOString(),
            calculationVersion: "4.0.0",
            availableBalance: state.kpis.eligibleBalanceDecimal,
            minForecastBalance: centsToDecimalString(
              state.kpis.minForecastBalanceCents
            ),
            settledIncome: centsToDecimalString(state.kpis.settledIncomeCents),
            settledExpense: centsToDecimalString(state.kpis.settledExpenseCents),
            projectedEndBalance: centsToDecimalString(
              state.kpis.projectedEndBalanceCents
            ),
            alreadyAllocated: centsToDecimalString(
              state.kpis.totalAllocatedReservesCents
            ),
            freeCash: centsToDecimalString(state.kpis.freeCashCents),
            headroom: centsToDecimalString(state.kpis.headroomCents),
            confidence: state.reserveCapacityReport.confidence,
            warnings: state.alerts.map((a) => a.title),
          },
          { headers: { "X-Request-Id": requestId } }
        );
      }

      if (subRoute === "obligations") {
        const direction = searchParams.get("direction");
        const items = direction
          ? state.installments.filter((i) => i.direction === direction)
          : state.installments;
        return NextResponse.json(
          { items, total: items.length },
          { headers: { "X-Request-Id": requestId } }
        );
      }

      if (subRoute === "reserves") {
        return NextResponse.json(
          { items: state.reserves },
          { headers: { "X-Request-Id": requestId } }
        );
      }

      return NextResponse.json(state, {
        headers: { "X-Request-Id": requestId },
      });
    }

    return NextResponse.json(
      {
        service: "NOVA Financial API v1 (Pacotes 01 + 02 + 03 + 04)",
        version: "4.0.0",
        status: "healthy",
        requestId,
      },
      { headers: { "X-Request-Id": requestId } }
    );
  } catch (err) {
    return NextResponse.json(
      {
        code: "INTERNAL_ERROR",
        message: err instanceof Error ? err.message : "Erro inesperado",
        details: {},
        requestId,
      },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await context.params;
  const requestId = `req_${Date.now().toString(36)}`;

  try {
    if (slug[0] === "workspaces" && slug[1]) {
      const workspaceId = slug[1];
      const subRoute = slug.slice(2).join("/");

      if (subRoute === "assistant/query") {
        const body = await req.json();
        const question = String(body.question || "");
        const state = await getWorkspaceFullState({ workspaceId });

        const isZeroState =
          state.accounts.length === 0 &&
          state.transactions.length === 0 &&
          state.installments.length === 0 &&
          state.investmentPositions.length === 0;

        const response = answerReadonlyAssistant(question, {
          asOf: state.p04Intelligence.asOf,
          workspaceName: state.activeWorkspace.name,
          workspaceType: state.activeWorkspace.type as "PERSONAL" | "BUSINESS",
          eligibleBalanceFormatted: formatBRL(state.kpis.eligibleBalanceCents),
          settledIncomeFormatted: formatBRL(state.kpis.settledIncomeCents),
          settledExpenseFormatted: formatBRL(state.kpis.settledExpenseCents),
          minForecastFormatted: formatBRL(state.kpis.minForecastBalanceCents),
          projectedEndFormatted: formatBRL(state.kpis.projectedEndBalanceCents),
          headroomFormatted: formatBRL(state.kpis.headroomCents),
          safetyBufferFormatted: formatBRL(state.kpis.safetyBufferCents),
          openPayablesFormatted: formatBRL(state.kpis.openPayablesCents),
          openPayablesCount: state.installments.filter(
            (i) =>
              i.direction === "PAYABLE" &&
              i.derivedStatus !== "PAID" &&
              i.derivedStatus !== "CANCELED"
          ).length,
          portfolioGrossFormatted: formatBRL(state.kpis.portfolioGrossCents),
          isZeroState,
          qualityEligible:
            state.p04Intelligence.quality.eligibleForAutomatedSuggestions,
        });

        return NextResponse.json(response, {
          headers: { "X-Request-Id": requestId },
        });
      }
    }

    return NextResponse.json(
      { code: "NOT_FOUND", message: "Rota não encontrada", requestId },
      { status: 404 }
    );
  } catch (err) {
    return NextResponse.json(
      {
        code: "INTERNAL_ERROR",
        message: err instanceof Error ? err.message : "Erro inesperado",
        requestId,
      },
      { status: 500 }
    );
  }
}
