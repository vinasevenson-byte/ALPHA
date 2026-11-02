import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceFullState } from "@/lib/nova-service";
import { centsToDecimalString } from "@/domain/planning";

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
      const horizonDays = Number(searchParams.get("horizonDays") ?? 90);
      const state = await getWorkspaceFullState({ workspaceId, horizonDays });

      const subRoute = slug.slice(2).join("/");

      if (subRoute === "planning/reserve-capacity") {
        return NextResponse.json(state.reserveCapacityReport, {
          headers: { "X-Request-Id": requestId },
        });
      }

      if (subRoute === "planning/overview" || subRoute === "dashboard") {
        return NextResponse.json(
          {
            asOf: new Date().toISOString(),
            calculationVersion: "2.0.0",
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

      if (subRoute === "insights/alerts") {
        return NextResponse.json(
          { items: state.alerts },
          { headers: { "X-Request-Id": requestId } }
        );
      }

      return NextResponse.json(state, {
        headers: { "X-Request-Id": requestId },
      });
    }

    return NextResponse.json(
      {
        service: "NOVA Financial API v1 (Pacote 01 + Pacote 02)",
        version: "2.0.0",
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
