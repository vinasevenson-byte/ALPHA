"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  LayoutDashboard,
  Wallet,
  ArrowLeftRight,
  CalendarClock,
  Receipt,
  LineChart,
  Compass,
  Shield,
  Sparkles,
  FileBarChart2,
  Settings,
  Building2,
  User,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Search,
  Bell,
  ChevronDown,
  ChevronRight,
  Lock,
  Download,
  RotateCcw,
  Beaker,
  Calendar,
  Target,
  Sliders,
  Flag,
  Layers,
  Ban,
  ArrowUpRight,
  ArrowDownRight,
  Info,
} from "lucide-react";
import {
  centsToDecimalString,
  formatBRL,
  formatDateBR,
} from "@/domain/planning";
import { NovaInvestmentsP03View } from "@/components/NovaInvestmentsP03View";

export type NovaRouteKey =
  | "visao-geral"
  | "contas"
  | "movimentacoes"
  | "planejamento"
  | "planejamento/orcamentos"
  | "planejamento/calendario"
  | "planejamento/cenarios"
  | "planejamento/metas"
  | "contas-a-pagar"
  | "contas-a-receber"
  | "fluxo-de-caixa"
  | "reservas"
  | "investimentos"
  | "inteligencia/alertas"
  | "inteligencia/diagnostico"
  | "relatorios"
  | "configuracoes";

interface WorkspaceItem {
  id: string;
  type: "PERSONAL" | "BUSINESS";
  name: string;
  baseCurrency: string;
  timezone: string;
  safetyBufferCents: number;
  version: number;
}

interface AccountItem {
  id: string;
  name: string;
  type: string;
  institution?: string | null;
  openingBalanceCents: number;
  openingBalanceDate: string;
  currentBalanceCents: number;
  currentBalanceDecimal: string;
  status: string;
  canDelete: boolean;
  settledCount: number;
}

interface TransactionItem {
  id: string;
  accountId: string;
  account?: { name: string };
  categoryId?: string | null;
  costCenter?: string | null;
  kind:
    | "INCOME"
    | "EXPENSE"
    | "TRANSFER_IN"
    | "TRANSFER_OUT"
    | "OPENING_BALANCE"
    | "ADJUSTMENT";
  status: "PENDING" | "SETTLED" | "CANCELED";
  amountCents: number;
  occurredOn: string;
  dueOn?: string | null;
  settledOn?: string | null;
  description: string;
  cancelReason?: string | null;
  transferGroupId?: string | null;
  idempotencyKey: string;
}

interface InstallmentItem {
  id: string;
  obligationId: string;
  obligationTitle: string;
  direction: "PAYABLE" | "RECEIVABLE";
  categoryName: string;
  counterparty: string;
  costCenter: string;
  confidence: string;
  number: number;
  totalInstallments: number;
  dueOn: string;
  amountCents: number;
  amountPaidCents: number;
  outstandingCents: number;
  derivedStatus: "OPEN" | "PARTIAL" | "PAID" | "OVERDUE" | "CANCELED";
  settlements: Array<{
    id: string;
    amountCents: number;
    settledOn: string;
    transactionId: string;
  }>;
}

interface ReserveItem {
  id: string;
  name: string;
  kind: string;
  status: string;
  targetAmountCents?: number | null;
  targetOn?: string | null;
  priority: number;
  allocatedCents: number;
  allocatedDecimal: string;
  progressPct: number;
}

interface ReserveMovementItem {
  id: string;
  reserveId: string;
  kind: "ALLOCATE" | "RELEASE" | "TRANSFER_IN" | "TRANSFER_OUT";
  amountCents: number;
  reason?: string | null;
  createdAt: string;
}

interface GoalItem {
  id: string;
  reserveId?: string | null;
  linkedReserveName: string;
  name: string;
  targetAmountCents: number;
  targetOn?: string | null;
  priority: number;
  status: string;
  allocatedCents: number;
  progressPct: number;
  remainingMonths: number;
  requiredMonthlyCents: number;
}

interface BudgetItem {
  id: string;
  categoryName: string;
  costCenter?: string | null;
  period: string;
  limitCents: number;
  realizedCents: number;
  committedOpenCents: number;
  totalProjectedCents: number;
  remainingBudgetCents: number;
  usagePct: number;
}

interface ScenarioItem {
  id: string;
  name: string;
  kind: "BASE" | "CONSERVATIVE" | "OPTIMISTIC";
  contingencyBufferPct: number;
  hypotheticalInflowCents: number;
  hypotheticalOutflowCents: number;
  notes?: string | null;
}

interface AlertItem {
  id: string;
  type: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  title: string;
  message: string;
  occurrenceOn: string;
  state: string;
}

interface AuditEventItem {
  id: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  requestId: string;
  metadataJson: string;
  timestamp: string;
}

interface NovaStatePayload {
  workspaces: WorkspaceItem[];
  activeWorkspace: WorkspaceItem;
  memberships: Array<{
    id: string;
    role: "OWNER" | "ADMIN" | "EDITOR" | "VIEWER";
    user: { name: string; email: string };
  }>;
  accounts: AccountItem[];
  categories: Array<{ id: string; type: string; name: string; isEssential: boolean }>;
  transactions: TransactionItem[];
  installments: InstallmentItem[];
  reserves: ReserveItem[];
  reserveMovements: ReserveMovementItem[];
  goals: GoalItem[];
  budgets: BudgetItem[];
  scenarios: ScenarioItem[];
  alerts: AlertItem[];
  auditEvents: AuditEventItem[];
  kpis: {
    eligibleBalanceCents: number;
    settledIncomeCents: number;
    settledExpenseCents: number;
    projectedEndBalanceCents: number;
    minForecastBalanceCents: number;
    safetyBufferCents: number;
    totalAllocatedReservesCents: number;
    freeCashCents: number;
    headroomCents: number;
    openPayablesCents: number;
    openReceivablesCents: number;
  };
  reserveCapacityReport: {
    eligibleBalance: string;
    minForecastBalance: string;
    safetyBuffer: string;
    alreadyAllocated: string;
    overdueUncounted: string;
    headroom: string;
    headroomCents: number;
    confidence: "HIGH" | "MEDIUM" | "LOW" | "INSUFFICIENT_DATA";
    explanations: string[];
    asOf: string;
    calculationVersion: string;
  };
  forecastSeries: Array<{
    date: string;
    startingCents: number;
    inboundCents: number;
    outboundCents: number;
    endingCents: number;
    isCritical: boolean;
    isNegative: boolean;
  }>;
}

interface Props {
  initialWorkspaceId?: string;
  initialRoute?: NovaRouteKey;
}

export function NovaPlatformApp({
  initialWorkspaceId = "ws-nova-pf",
  initialRoute = "visao-geral",
}: Props) {
  const [state, setState] = useState<NovaStatePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [workspaceId, setWorkspaceId] = useState(initialWorkspaceId);
  const [activeRoute, setActiveRoute] = useState<NovaRouteKey>(initialRoute);
  const [horizonDays, setHorizonDays] = useState<number>(30);
  const [scenarioKind, setScenarioKind] = useState<
    "BASE" | "CONSERVATIVE" | "OPTIMISTIC"
  >("BASE");
  const [searchQuery, setSearchQuery] = useState("");
  const [planningExpanded, setPlanningExpanded] = useState(true);
  const [intelExpanded, setIntelExpanded] = useState(true);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [bannerSuccess, setBannerSuccess] = useState<string | null>(null);

  // Modais
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showTxModal, setShowTxModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showObligationModal, setShowObligationModal] = useState(false);
  const [settlementTarget, setSettlementTarget] =
    useState<InstallmentItem | null>(null);
  const [showReserveModal, setShowReserveModal] = useState(false);
  const [reserveActionModal, setReserveActionModal] = useState<{
    reserve: ReserveItem;
    mode: "ALLOCATE" | "RELEASE" | "TRANSFER";
  } | null>(null);

  // Form states — Conta
  const [accName, setAccName] = useState("");
  const [accType, setAccType] = useState("CHECKING");
  const [accInst, setAccInst] = useState("");
  const [accOpeningDecimal, setAccOpeningDecimal] = useState("0.00");

  // Form states — Movimentação P01
  const [txAccountId, setTxAccountId] = useState("");
  const [txKind, setTxKind] = useState<"INCOME" | "EXPENSE">("INCOME");
  const [txStatus, setTxStatus] = useState<"SETTLED" | "PENDING">("SETTLED");
  const [txDescription, setTxDescription] = useState("");
  const [txAmountDecimal, setTxAmountDecimal] = useState("1000.00");
  const [txDate, setTxDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [txCostCenter, setTxCostCenter] = useState("");

  // Form states — Transferência Interna Atômica P01
  const [tfSourceId, setTfSourceId] = useState("");
  const [tfDestId, setTfDestId] = useState("");
  const [tfAmountDecimal, setTfAmountDecimal] = useState("250.00");
  const [tfDesc, setTfDesc] = useState("Transferência entre contas próprias");

  // Form states — Obrigação Parcelada P02 (Contas a Pagar / Receber)
  const [obDirection, setObDirection] = useState<"PAYABLE" | "RECEIVABLE">(
    "PAYABLE"
  );
  const [obTitle, setObTitle] = useState("");
  const [obCategory, setObCategory] = useState("Moradia");
  const [obCounterparty, setObCounterparty] = useState("");
  const [obCostCenter, setObCostCenter] = useState("");
  const [obTotalDecimal, setObTotalDecimal] = useState("300.00");
  const [obCount, setObCount] = useState(1);
  const [obFirstDue, setObFirstDue] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );

  // Form states — Baixa Parcial/Integral P02
  const [settleAccountId, setSettleAccountId] = useState("");
  const [settleAmountDecimal, setSettleAmountDecimal] = useState("0.00");
  const [settleDate, setSettleDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [settleNote, setSettleNote] = useState("");

  // Form states — Cofre de Reserva P02
  const [resName, setResName] = useState("");
  const [resKind, setResKind] = useState("EMERGENCY");
  const [resTargetDecimal, setResTargetDecimal] = useState("5000.00");
  const [resTargetOn, setResTargetOn] = useState("2027-06-01");

  // Form states — Alocar / Liberar / Transferir Reserva Virtual
  const [resMoveAmountDecimal, setResMoveAmountDecimal] = useState("500.00");
  const [resMoveDestId, setResMoveDestId] = useState("");
  const [resMoveReason, setResMoveReason] = useState("");

  // Form states — Orçamento, Meta e Margem de Segurança
  const [budgetCat, setBudgetCat] = useState("Moradia");
  const [budgetLimitDecimal, setBudgetLimitDecimal] = useState("2000.00");
  const [goalName, setGoalName] = useState("");
  const [goalTargetDecimal, setGoalTargetDecimal] = useState("10000.00");
  const [goalTargetOn, setGoalTargetOn] = useState("2027-12-01");
  const [goalReserveId, setGoalReserveId] = useState("");
  const [bufferInputDecimal, setBufferInputDecimal] = useState("0.00");

  const loadData = useCallback(
    async (
      targetWs = workspaceId,
      targetHorizon = horizonDays,
      targetScenario = scenarioKind
    ) => {
      try {
        const res = await fetch(
          `/api/platform?workspaceId=${targetWs}&horizonDays=${targetHorizon}&scenario=${targetScenario}`,
          { cache: "no-store" }
        );
        const json = await res.json();
        if (!res.ok) {
          setBannerError(json.message || "Falha ao carregar dados.");
          return;
        }
        setState(json);
        setBufferInputDecimal(
          centsToDecimalString(json.activeWorkspace.safetyBufferCents)
        );
        if (json.accounts?.length > 0) {
          setTxAccountId((prev) => prev || json.accounts[0].id);
          setSettleAccountId((prev) => prev || json.accounts[0].id);
          setTfSourceId((prev) => prev || json.accounts[0].id);
          if (json.accounts.length > 1) {
            setTfDestId((prev) => prev || json.accounts[1].id);
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    },
    [workspaceId, horizonDays, scenarioKind]
  );

  useEffect(() => {
    loadData(workspaceId, horizonDays, scenarioKind);
  }, [workspaceId, horizonDays, scenarioKind, loadData]);

  const navigateRoute = (route: NovaRouteKey, newWsId?: string) => {
    const ws = newWsId ?? workspaceId;
    setActiveRoute(route);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `/app/${ws}/${route}`);
    }
  };

  const executeAction = async (
    payload: Record<string, unknown>,
    successMsg?: string
  ): Promise<boolean> => {
    setBannerError(null);
    setBannerSuccess(null);
    try {
      const res = await fetch("/api/platform", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": `idem_${Date.now()}_${Math.random()
            .toString(36)
            .slice(2, 8)}`,
        },
        body: JSON.stringify({
          workspaceId: state?.activeWorkspace.id ?? workspaceId,
          ...payload,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setBannerError(`[${json.code || res.status}] ${json.message}`);
        return false;
      }
      if (successMsg) setBannerSuccess(successMsg);
      await loadData(
        state?.activeWorkspace.id ?? workspaceId,
        horizonDays,
        scenarioKind
      );
      return true;
    } catch {
      setBannerError("Erro de comunicação com a API NOVA.");
      return false;
    }
  };

  if (loading && !state) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F4F7FA] text-[#142D43]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#142D43] border-t-[#69E2C0]" />
          <p className="text-sm font-semibold text-[#142D43]">
            Carregando NOVA — Inteligência Financeira...
          </p>
        </div>
      </div>
    );
  }

  if (!state) return null;

  const {
    workspaces,
    activeWorkspace,
    memberships,
    accounts,
    categories,
    transactions,
    installments,
    reserves,
    reserveMovements,
    goals,
    budgets,
    scenarios,
    alerts,
    auditEvents,
    kpis,
    reserveCapacityReport,
    forecastSeries,
  } = state;

  const isPJ = activeWorkspace.type === "BUSINESS";
  const currentRole = memberships[0]?.role ?? "OWNER";
  const isZeroState =
    accounts.length === 0 &&
    transactions.length === 0 &&
    installments.length === 0;

  const filteredTransactions = transactions.filter((t) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.description.toLowerCase().includes(q) ||
      (t.costCenter || "").toLowerCase().includes(q)
    );
  });

  const payableInstallments = installments.filter(
    (i) => i.direction === "PAYABLE"
  );
  const receivableInstallments = installments.filter(
    (i) => i.direction === "RECEIVABLE"
  );

  return (
    <div className="flex min-h-screen bg-[#F4F7FA] text-[#142D43]">
      {/* =====================================================================
          SIDEBAR OFICIAL NOVA (#142D43 Azul Profundo + #69E2C0 Verde Menta)
         ===================================================================== */}
      <aside className="hidden w-72 shrink-0 flex-col bg-[#142D43] text-white lg:flex">
        {/* Identidade da Marca NOVA */}
        <div className="border-b border-white/10 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#69E2C0] font-black text-[#142D43] shadow-md">
                N
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-extrabold tracking-tight text-white">
                    NOVA
                  </span>
                  <span className="rounded-full bg-[#69E2C0]/20 px-2 py-0.5 text-[10px] font-bold text-[#69E2C0]">
                    P01 + P02
                  </span>
                </div>
                <p className="text-[11px] text-slate-300">
                  Inteligência Financeira
                </p>
              </div>
            </div>
          </div>
          <p className="mt-2.5 text-[11px] italic text-slate-300">
            &ldquo;Seu dinheiro organizado. Seu futuro planejado.&rdquo;
          </p>
        </div>

        {/* Taxonomia de Navegação P01 + P02 */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4 text-xs">
          <button
            onClick={() => navigateRoute("visao-geral")}
            className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 font-semibold transition ${
              activeRoute === "visao-geral"
                ? "bg-[#69E2C0] text-[#142D43] shadow-sm"
                : "text-slate-200 hover:bg-white/10"
            }`}
          >
            <LayoutDashboard className="h-4 w-4" />
            <span>Visão Geral</span>
          </button>

          <button
            onClick={() => navigateRoute("contas")}
            className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 font-semibold transition ${
              activeRoute === "contas"
                ? "bg-[#69E2C0] text-[#142D43]"
                : "text-slate-200 hover:bg-white/10"
            }`}
          >
            <span className="flex items-center gap-3">
              <Wallet className="h-4 w-4" />
              <span>Contas e Carteiras</span>
            </span>
            <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] tabular-nums">
              {accounts.length}
            </span>
          </button>

          <button
            onClick={() => navigateRoute("movimentacoes")}
            className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 font-semibold transition ${
              activeRoute === "movimentacoes"
                ? "bg-[#69E2C0] text-[#142D43]"
                : "text-slate-200 hover:bg-white/10"
            }`}
          >
            <ArrowLeftRight className="h-4 w-4" />
            <span>Movimentações</span>
          </button>

          {/* Menu Expansível: Planejamento (P02) */}
          <div className="pt-1">
            <button
              onClick={() => {
                setPlanningExpanded(!planningExpanded);
                navigateRoute("planejamento");
              }}
              className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 font-semibold transition ${
                activeRoute.startsWith("planejamento")
                  ? "bg-white/15 text-[#69E2C0]"
                  : "text-slate-200 hover:bg-white/10"
              }`}
            >
              <span className="flex items-center gap-3">
                <Compass className="h-4 w-4" />
                <span>Planejamento</span>
              </span>
              {planningExpanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </button>

            {planningExpanded && (
              <div className="ml-4 mt-1 space-y-1 border-l border-white/15 pl-3">
                {[
                  {
                    key: "planejamento" as NovaRouteKey,
                    label: "Visão de Planejamento",
                  },
                  {
                    key: "planejamento/orcamentos" as NovaRouteKey,
                    label: "Orçamento e Categorias",
                  },
                  {
                    key: "planejamento/calendario" as NovaRouteKey,
                    label: "Calendário Financeiro",
                  },
                  {
                    key: "planejamento/cenarios" as NovaRouteKey,
                    label: "Cenários de Fluxo de Caixa",
                  },
                  {
                    key: "planejamento/metas" as NovaRouteKey,
                    label: "Metas Financeiras",
                  },
                ].map((sub) => (
                  <button
                    key={sub.key}
                    onClick={() => navigateRoute(sub.key)}
                    className={`block w-full rounded-lg px-3 py-1.5 text-left text-[11px] font-medium transition ${
                      activeRoute === sub.key
                        ? "bg-[#69E2C0] font-bold text-[#142D43]"
                        : "text-slate-300 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    {sub.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => navigateRoute("contas-a-pagar")}
            className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 font-semibold transition ${
              activeRoute === "contas-a-pagar"
                ? "bg-[#69E2C0] text-[#142D43]"
                : "text-slate-200 hover:bg-white/10"
            }`}
          >
            <span className="flex items-center gap-3">
              <CalendarClock className="h-4 w-4" />
              <span>Contas a Pagar</span>
            </span>
            {payableInstallments.filter(
              (i) => i.derivedStatus !== "PAID" && i.derivedStatus !== "CANCELED"
            ).length > 0 && (
              <span className="rounded-full bg-[#F2B766] px-2 py-0.5 text-[10px] font-bold text-[#142D43] tabular-nums">
                {
                  payableInstallments.filter(
                    (i) =>
                      i.derivedStatus !== "PAID" &&
                      i.derivedStatus !== "CANCELED"
                  ).length
                }
              </span>
            )}
          </button>

          <button
            onClick={() => navigateRoute("contas-a-receber")}
            className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 font-semibold transition ${
              activeRoute === "contas-a-receber"
                ? "bg-[#69E2C0] text-[#142D43]"
                : "text-slate-200 hover:bg-white/10"
            }`}
          >
            <span className="flex items-center gap-3">
              <Receipt className="h-4 w-4" />
              <span>Contas a Receber</span>
            </span>
          </button>

          <button
            onClick={() => navigateRoute("fluxo-de-caixa")}
            className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 font-semibold transition ${
              activeRoute === "fluxo-de-caixa"
                ? "bg-[#69E2C0] text-[#142D43]"
                : "text-slate-200 hover:bg-white/10"
            }`}
          >
            <LineChart className="h-4 w-4" />
            <span>Fluxo de Caixa</span>
          </button>

          <button
            onClick={() => navigateRoute("reservas")}
            className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 font-semibold transition ${
              activeRoute === "reservas"
                ? "bg-[#69E2C0] text-[#142D43]"
                : "text-slate-200 hover:bg-white/10"
            }`}
          >
            <span className="flex items-center gap-3">
              <Shield className="h-4 w-4" />
              <span>Reservas e Cofres</span>
            </span>
            <span className="rounded-full bg-[#69E2C0]/20 px-2 py-0.5 text-[10px] font-bold text-[#69E2C0]">
              P02
            </span>
          </button>

          {/* Menu Expansível: Inteligência Financeira (P02) */}
          <div className="pt-1">
            <button
              onClick={() => {
                setIntelExpanded(!intelExpanded);
                navigateRoute("inteligencia/alertas");
              }}
              className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 font-semibold transition ${
                activeRoute.startsWith("inteligencia")
                  ? "bg-white/15 text-[#69E2C0]"
                  : "text-slate-200 hover:bg-white/10"
              }`}
            >
              <span className="flex items-center gap-3">
                <Sparkles className="h-4 w-4" />
                <span>Inteligência Financeira</span>
              </span>
              {intelExpanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </button>
            {intelExpanded && (
              <div className="ml-4 mt-1 space-y-1 border-l border-white/15 pl-3">
                <button
                  onClick={() => navigateRoute("inteligencia/alertas")}
                  className={`block w-full rounded-lg px-3 py-1.5 text-left text-[11px] font-medium ${
                    activeRoute === "inteligencia/alertas"
                      ? "bg-[#69E2C0] font-bold text-[#142D43]"
                      : "text-slate-300 hover:bg-white/10"
                  }`}
                >
                  Central de Alertas ({alerts.length})
                </button>
                <button
                  onClick={() => navigateRoute("inteligencia/diagnostico")}
                  className={`block w-full rounded-lg px-3 py-1.5 text-left text-[11px] font-medium ${
                    activeRoute === "inteligencia/diagnostico"
                      ? "bg-[#69E2C0] font-bold text-[#142D43]"
                      : "text-slate-300 hover:bg-white/10"
                  }`}
                >
                  Diagnóstico do Mês
                </button>
              </div>
            )}
          </div>

          <button
            onClick={() => navigateRoute("relatorios")}
            className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 font-semibold transition ${
              activeRoute === "relatorios"
                ? "bg-[#69E2C0] text-[#142D43]"
                : "text-slate-200 hover:bg-white/10"
            }`}
          >
            <FileBarChart2 className="h-4 w-4" />
            <span>Relatórios</span>
          </button>

          <button
            onClick={() => navigateRoute("configuracoes")}
            className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 font-semibold transition ${
              activeRoute === "configuracoes"
                ? "bg-[#69E2C0] text-[#142D43]"
                : "text-slate-200 hover:bg-white/10"
            }`}
          >
            <Settings className="h-4 w-4" />
            <span>Administração e Permissões</span>
          </button>

          <button
            onClick={() => navigateRoute("investimentos")}
            className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 font-semibold transition ${
              activeRoute === "investimentos"
                ? "bg-[#69E2C0] text-[#142D43]"
                : "text-slate-200 hover:bg-white/10"
            }`}
          >
            <span className="flex items-center gap-3">
              <Layers className="h-4 w-4" />
              <span>Investimentos & Rentabilidade</span>
            </span>
            <span className="rounded-full bg-[#69E2C0]/20 px-2 py-0.5 text-[10px] font-bold text-[#69E2C0]">
              P03
            </span>
          </button>
        </nav>

        {/* Rodapé da Sidebar */}
        <div className="border-t border-white/10 p-4 text-[11px] text-slate-300">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-white">Papel RBAC Ativo:</span>
            <span className="rounded bg-[#69E2C0]/20 px-2 py-0.5 font-mono text-[10px] font-bold text-[#69E2C0]">
              {currentRole}
            </span>
          </div>
          <p className="mt-1 text-[10px] text-slate-400">
            Moeda: {activeWorkspace.baseCurrency} • Fuso:{" "}
            {activeWorkspace.timezone}
          </p>
        </div>
      </aside>

      {/* =====================================================================
          CONTEÚDO PRINCIPAL (FUNDO CLARO #F4F7FA, CARTÕES GRANDES E LIMPOS)
         ===================================================================== */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar Oficial NOVA */}
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-6 py-3.5 backdrop-blur">
          <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4">
            {/* Seletor Pessoal vs Empresarial */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex rounded-xl bg-[#F4F7FA] p-1 ring-1 ring-slate-200">
                {workspaces.map((ws) => {
                  const active = ws.id === activeWorkspace.id;
                  return (
                    <button
                      key={ws.id}
                      onClick={() => {
                        setWorkspaceId(ws.id);
                        setTxAccountId("");
                        setSettleAccountId("");
                        navigateRoute(activeRoute, ws.id);
                      }}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
                        active
                          ? "bg-[#142D43] text-white shadow-sm"
                          : "text-slate-600 hover:text-[#142D43]"
                      }`}
                    >
                      {ws.type === "BUSINESS" ? (
                        <Building2 className="h-3.5 w-3.5 text-[#69E2C0]" />
                      ) : (
                        <User className="h-3.5 w-3.5 text-[#69E2C0]" />
                      )}
                      <span>
                        {ws.type === "BUSINESS" ? "Empresarial" : "Pessoal"}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Seletor de Horizonte / Período */}
              <div className="inline-flex items-center gap-1 rounded-xl bg-[#F4F7FA] p-1 text-xs ring-1 ring-slate-200">
                {[
                  { days: 7, label: "7 dias" },
                  { days: 30, label: "Este mês (30d)" },
                  { days: 90, label: "90 dias" },
                  { days: 365, label: "365 dias" },
                ].map((h) => (
                  <button
                    key={h.days}
                    onClick={() => setHorizonDays(h.days)}
                    className={`rounded-lg px-2.5 py-1 font-semibold transition ${
                      horizonDays === h.days
                        ? "bg-white text-[#142D43] shadow-sm"
                        : "text-slate-500 hover:text-[#142D43]"
                    }`}
                  >
                    {h.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Pesquisa Global, Homologação P02, Notificações e Ações */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative hidden sm:block">
                <Search className=" absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Pesquisar lançamentos..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-48 rounded-xl border border-slate-200 bg-[#F4F7FA] py-1.5 pl-8 pr-3 text-xs text-[#142D43] focus:border-[#142D43] focus:bg-white focus:outline-none"
                />
              </div>

              {/* Botões para alternar rapidamente entre Estado Zero (R$ 0,00) e Fixture de Teste P02 */}
              {isZeroState ? (
                <button
                  onClick={() =>
                    executeAction(
                      { action: "LOAD_P02_FIXTURE" },
                      "Fixture de homologação P01+P02 carregada (Saldo R$ 10.000,00 / Reserva R$ 4.000,00)."
                    )
                  }
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#142D43]/20 bg-[#69E2C0]/25 px-3 py-1.5 text-xs font-bold text-[#142D43] hover:bg-[#69E2C0]/40"
                  title="Preenche contas, lançamentos e obrigações de teste do Pacote 02"
                >
                  <Beaker className="h-3.5 w-3.5" />
                  <span>Carregar Dados de Teste (P02)</span>
                </button>
              ) : (
                <button
                  onClick={() =>
                    executeAction(
                      { action: "RESET_TO_ZERO" },
                      "Workspace retornado ao estado inicial zerado (R$ 0,00)."
                    )
                  }
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                  title="Voltar para R$ 0,00 (Aguardando lançamentos)"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Zerar (R$ 0,00)</span>
                </button>
              )}

              <button
                onClick={() => navigateRoute("inteligencia/alertas")}
                className="relative rounded-xl border border-slate-200 bg-[#F4F7FA] p-2 text-[#142D43] hover:bg-slate-200/70"
                title="Central de Alertas"
              >
                <Bell className="h-4 w-4" />
                {alerts.length > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#F2B766] text-[10px] font-extrabold text-[#142D43]">
                    {alerts.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setShowObligationModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#142D43] bg-white px-3 py-1.5 text-xs font-bold text-[#142D43] hover:bg-slate-50"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Novo Compromisso</span>
              </button>

              <button
                onClick={() => {
                  if (accounts.length === 0) {
                    setShowAccountModal(true);
                  } else {
                    setShowTxModal(true);
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#142D43] px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-[#142D43]/90"
              >
                <Plus className="h-3.5 w-3.5 text-[#69E2C0]" />
                <span>
                  {accounts.length === 0
                    ? "Cadastrar 1ª Conta"
                    : "Novo Lançamento"}
                </span>
              </button>
            </div>
          </div>
        </header>

        {/* Alertas de Feedback da Operação */}
        <div className="mx-auto w-full max-w-[1440px] px-6 pt-4">
          {bannerError && (
            <div
              role="alert"
              className="mb-4 flex items-center justify-between rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-900"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-600" />
                <span>{bannerError}</span>
              </div>
              <button
                onClick={() => setBannerError(null)}
                className="font-bold text-rose-700"
              >
                ✕
              </button>
            </div>
          )}
          {bannerSuccess && (
            <div
              role="status"
              className="mb-4 flex items-center justify-between rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-950"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>{bannerSuccess}</span>
              </div>
              <button
                onClick={() => setBannerSuccess(null)}
                className="font-bold text-emerald-800"
              >
                ✕
              </button>
            </div>
          )}
        </div>

        {/* Área Principal Max-Width 1440px */}
        <main className="mx-auto w-full max-w-[1440px] flex-1 space-y-6 px-6 py-4">
          {/* =================================================================
              TELA 1: VISÃO GERAL (DASHBOARD INICIAL EM R$ 0,00 OU CALCULADO)
             ================================================================= */}
          {activeRoute === "visao-geral" && (
            <div className="space-y-6">
              {/* Título do Painel */}
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Painel Financeiro •{" "}
                    {isPJ ? "Ambiente Empresarial (PJ)" : "Ambiente Pessoal (PF)"}
                  </span>
                  <h1 className="text-2xl font-extrabold text-[#142D43]">
                    {activeWorkspace.name}
                  </h1>
                  <p className="text-xs text-slate-500">
                    Visão consolidada das suas finanças • Dados calculados na API
                    a partir do livro razão persistido
                  </p>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>Cenário de projeção:</span>
                  <select
                    value={scenarioKind}
                    onChange={(e) =>
                      setScenarioKind(
                        e.target.value as "BASE" | "CONSERVATIVE" | "OPTIMISTIC"
                      )
                    }
                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 font-semibold text-[#142D43]"
                  >
                    <option value="BASE">Base (Confirmado)</option>
                    <option value="CONSERVATIVE">Conservador (+Buffer)</option>
                    <option value="OPTIMISTIC">Otimista</option>
                  </select>
                </div>
              </div>

              {/* 4 Cartões Principais do Desenho Oficial NOVA (Clicáveis com Drill-down) */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div
                  onClick={() => navigateRoute("contas")}
                  className="cursor-pointer rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm transition hover:border-[#142D43]/40 hover:shadow-md"
                >
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                    <span>Saldo em contas</span>
                    <Wallet className="h-4 w-4 text-[#142D43]" />
                  </div>
                  <div className="mt-3 font-mono text-3xl font-extrabold tabular-nums text-[#142D43]">
                    {formatBRL(kpis.eligibleBalanceCents)}
                  </div>
                  <p className="mt-1.5 text-xs text-slate-500">
                    {accounts.length === 0
                      ? "Aguardando lançamentos"
                      : `${accounts.filter((a) => a.status === "ACTIVE").length} conta(s) ativa(s) conciliada(s)`}
                  </p>
                </div>

                <div
                  onClick={() => navigateRoute("movimentacoes")}
                  className="cursor-pointer rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm transition hover:border-[#142D43]/40 hover:shadow-md"
                >
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                    <span>{isPJ ? "Meus recebimentos" : "Minhas receitas"}</span>
                    <ArrowUpRight className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div className="mt-3 font-mono text-3xl font-extrabold tabular-nums text-emerald-700">
                    {formatBRL(kpis.settledIncomeCents)}
                  </div>
                  <p className="mt-1.5 text-xs text-slate-500">
                    {kpis.settledIncomeCents === 0 &&
                    kpis.openReceivablesCents === 0
                      ? "Aguardando lançamentos"
                      : `Previsto a receber: ${formatBRL(
                          kpis.openReceivablesCents
                        )}`}
                  </p>
                </div>

                <div
                  onClick={() => navigateRoute("movimentacoes")}
                  className="cursor-pointer rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm transition hover:border-[#142D43]/40 hover:shadow-md"
                >
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                    <span>Despesas</span>
                    <ArrowDownRight className="h-4 w-4 text-amber-600" />
                  </div>
                  <div className="mt-3 font-mono text-3xl font-extrabold tabular-nums text-[#142D43]">
                    {formatBRL(kpis.settledExpenseCents)}
                  </div>
                  <p className="mt-1.5 text-xs text-slate-500">
                    {kpis.settledExpenseCents === 0 &&
                    kpis.openPayablesCents === 0
                      ? "Aguardando lançamentos"
                      : `A pagar em aberto: ${formatBRL(kpis.openPayablesCents)}`}
                  </p>
                </div>

                <div
                  onClick={() => navigateRoute("fluxo-de-caixa")}
                  className="cursor-pointer rounded-2xl border border-[#142D43]/15 bg-[#142D43] p-5 text-white shadow-sm transition hover:shadow-md"
                >
                  <div className="flex items-center justify-between text-xs font-semibold text-[#69E2C0]">
                    <span>Saldo projetado ({horizonDays}d)</span>
                    <LineChart className="h-4 w-4 text-[#69E2C0]" />
                  </div>
                  <div className="mt-3 font-mono text-3xl font-extrabold tabular-nums text-white">
                    {formatBRL(kpis.projectedEndBalanceCents)}
                  </div>
                  <p className="mt-1.5 text-xs text-slate-300">
                    {isZeroState
                      ? "Aguardando lançamentos"
                      : `Menor saldo no horizonte: ${formatBRL(
                          kpis.minForecastBalanceCents
                        )}`}
                  </p>
                </div>
              </div>

              {/* Funcionalidade Central P02: Motor "Quanto posso reservar?" */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#142D43] text-[#69E2C0]">
                      <Shield className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-[#69E2C0]/25 px-2.5 py-0.5 text-[10px] font-bold uppercase text-[#142D43]">
                          Motor de Capacidade Financeira (P02)
                        </span>
                        <span className="text-xs text-slate-500">
                          Confiança: {reserveCapacityReport.confidence}
                        </span>
                      </div>
                      <h2 className="mt-0.5 text-base font-extrabold text-[#142D43]">
                        Quanto posso reservar com segurança?
                      </h2>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => navigateRoute("reservas")}
                      className="rounded-xl bg-[#142D43] px-4 py-2 text-xs font-bold text-white hover:bg-[#142D43]/90"
                    >
                      Gerenciar Cofres e Alocações
                    </button>
                  </div>
                </div>

                {/* 5 Indicadores da Equação Canônica P02: S, Pmin, B, R -> Headroom */}
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <div className="rounded-xl bg-[#F4F7FA] p-3.5">
                    <span className="text-[11px] font-semibold text-slate-500">
                      1. Saldo atual (S)
                    </span>
                    <div className="mt-1 font-mono text-xl font-extrabold tabular-nums text-[#142D43]">
                      {formatBRL(kpis.eligibleBalanceCents)}
                    </div>
                  </div>

                  <div className="rounded-xl bg-[#F4F7FA] p-3.5">
                    <span className="text-[11px] font-semibold text-slate-500">
                      2. Menor saldo projetado (Pmin)
                    </span>
                    <div className="mt-1 font-mono text-xl font-extrabold tabular-nums text-[#142D43]">
                      {formatBRL(kpis.minForecastBalanceCents)}
                    </div>
                  </div>

                  <div className="rounded-xl bg-[#F4F7FA] p-3.5">
                    <span className="text-[11px] font-semibold text-slate-500">
                      3. Margem de segurança (B)
                    </span>
                    <div className="mt-1 font-mono text-xl font-extrabold tabular-nums text-amber-700">
                      {formatBRL(kpis.safetyBufferCents)}
                    </div>
                  </div>

                  <div className="rounded-xl bg-[#F4F7FA] p-3.5">
                    <span className="text-[11px] font-semibold text-slate-500">
                      4. Reservas existentes (R)
                    </span>
                    <div className="mt-1 font-mono text-xl font-extrabold tabular-nums text-teal-700">
                      {formatBRL(kpis.totalAllocatedReservesCents)}
                    </div>
                  </div>

                  <div className="rounded-xl border-2 border-[#69E2C0] bg-[#142D43] p-3.5 text-white">
                    <span className="text-[11px] font-bold text-[#69E2C0]">
                      Capacidade adicional p/ reservar
                    </span>
                    <div className="mt-1 font-mono text-2xl font-black tabular-nums text-[#69E2C0]">
                      {formatBRL(kpis.headroomCents)}
                    </div>
                  </div>
                </div>

                <p className="mt-3 text-xs text-slate-600">
                  O cálculo considera a menor posição de caixa projetada (
                  <code>min(S, Pmin)</code>), desconta a margem de segurança (
                  <code>B</code>) e as reservas virtuais já alocadas (
                  <code>R</code>), evitando contar compromissos duas vezes.
                </p>
              </div>

              {/* Fluxo de Caixa + Próximas Contas + Reservas + Inteligência NOVA */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                {/* Fluxo de Caixa Diário */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-7">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="text-sm font-bold text-[#142D43]">
                        Fluxo de caixa ({horizonDays} dias)
                      </h3>
                      <p className="text-xs text-slate-500">
                        Receitas e despesas realizadas vs previstas
                      </p>
                    </div>
                    <button
                      onClick={() => navigateRoute("fluxo-de-caixa")}
                      className="text-xs font-bold text-[#142D43] hover:underline"
                    >
                      Abrir projeção completa →
                    </button>
                  </div>

                  {isZeroState ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <LineChart className="h-8 w-8 text-slate-300" />
                      <p className="mt-2 text-sm font-bold text-[#142D43]">
                        Aguardando lançamentos
                      </p>
                      <p className="mt-1 max-w-md text-xs text-slate-500">
                        Cadastre sua primeira conta bancária e registre suas
                        receitas, despesas ou compromissos para visualizar a curva
                        diária de saldo.
                      </p>
                      <div className="mt-4 flex gap-2">
                        <button
                          onClick={() => setShowAccountModal(true)}
                          className="rounded-xl bg-[#142D43] px-4 py-2 text-xs font-bold text-white"
                        >
                          Cadastrar Primeira Conta
                        </button>
                        <button
                          onClick={() =>
                            executeAction({ action: "LOAD_P02_FIXTURE" })
                          }
                          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-[#142D43]"
                        >
                          Testar com Cenário P02
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 space-y-2">
                      {forecastSeries
                        .filter(
                          (pt, idx) =>
                            idx === 0 ||
                            pt.inboundCents > 0 ||
                            pt.outboundCents > 0 ||
                            idx === forecastSeries.length - 1
                        )
                        .slice(0, 8)
                        .map((pt, i) => (
                          <div
                            key={pt.date}
                            className="flex items-center justify-between rounded-xl bg-[#F4F7FA] px-3.5 py-2.5 text-xs"
                          >
                            <div className="flex items-center gap-3">
                              <span className="font-mono font-bold text-[#142D43]">
                                {i === 0
                                  ? `Hoje (${formatDateBR(pt.date)})`
                                  : formatDateBR(pt.date)}
                              </span>
                              {pt.inboundCents > 0 && (
                                <span className="rounded bg-emerald-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-emerald-800">
                                  +{formatBRL(pt.inboundCents)}
                                </span>
                              )}
                              {pt.outboundCents > 0 && (
                                <span className="rounded bg-amber-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-amber-900">
                                  -{formatBRL(pt.outboundCents)}
                                </span>
                              )}
                            </div>
                            <div className="font-mono font-bold tabular-nums text-[#142D43]">
                              Saldo: {formatBRL(pt.endingCents)}
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                {/* Coluna Direita: Próximas Contas, Reservas e Inteligência NOVA */}
                <div className="space-y-4 lg:col-span-5">
                  {/* Próximas Contas */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-[#142D43]">
                        Próximas contas
                      </h3>
                      <button
                        onClick={() => navigateRoute("contas-a-pagar")}
                        className="text-xs font-semibold text-[#142D43] hover:underline"
                      >
                        Ver compromissos
                      </button>
                    </div>
                    {installments.filter(
                      (i) =>
                        i.derivedStatus !== "PAID" &&
                        i.derivedStatus !== "CANCELED"
                    ).length === 0 ? (
                      <p className="mt-3 text-xs text-slate-500">
                        Nenhum compromisso cadastrado
                      </p>
                    ) : (
                      <div className="mt-3 space-y-2">
                        {installments
                          .filter(
                            (i) =>
                              i.derivedStatus !== "PAID" &&
                              i.derivedStatus !== "CANCELED"
                          )
                          .slice(0, 4)
                          .map((inst) => (
                            <div
                              key={inst.id}
                              className="flex items-center justify-between rounded-xl bg-[#F4F7FA] px-3 py-2 text-xs"
                            >
                              <div>
                                <div className="font-bold text-[#142D43]">
                                  {inst.obligationTitle} ({inst.number}/
                                  {inst.totalInstallments})
                                </div>
                                <div className="text-[11px] text-slate-500">
                                  Venc: {formatDateBR(inst.dueOn)}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold tabular-nums text-[#142D43]">
                                  {formatBRL(inst.outstandingCents)}
                                </span>
                                <button
                                  onClick={() => {
                                    setSettlementTarget(inst);
                                    setSettleAmountDecimal(
                                      centsToDecimalString(inst.outstandingCents)
                                    );
                                  }}
                                  className="rounded-lg bg-[#142D43] px-2.5 py-1 text-[10px] font-bold text-white"
                                >
                                  Baixar
                                </button>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>

                  {/* Reservas */}
                  <div
                    onClick={() => navigateRoute("reservas")}
                    className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-[#142D43]/40"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-[#142D43]">
                        Reservas
                      </span>
                      <Shield className="h-4 w-4 text-[#142D43]" />
                    </div>
                    <div className="mt-2 font-mono text-2xl font-extrabold tabular-nums text-[#142D43]">
                      {formatBRL(kpis.totalAllocatedReservesCents)}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {reserves.length === 0
                        ? "Metas ainda não cadastradas"
                        : `${reserves.length} cofre(s) ativo(s) • Livre não alocado: ${formatBRL(
                            kpis.freeCashCents
                          )}`}
                    </p>
                  </div>

                  {/* Inteligência NOVA */}
                  <div className="rounded-2xl border border-[#69E2C0]/60 bg-[#142D43] p-5 text-white shadow-sm">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#69E2C0]">
                      <Sparkles className="h-4 w-4" />
                      <span>Inteligência NOVA</span>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-slate-200">
                      {isZeroState
                        ? "Cadastre suas contas, receitas e despesas. A NOVA utilizará esses dados para calcular seu saldo futuro e identificar possibilidades de economia e reserva."
                        : `Seu saldo livre pós-reservas é de ${formatBRL(
                            kpis.freeCashCents
                          )}. Considerando os compromissos futuros e sua margem de segurança de ${formatBRL(
                            kpis.safetyBufferCents
                          )}, você pode alocar até ${formatBRL(
                            kpis.headroomCents
                          )} adicionalmente em cofres.`}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =================================================================
              TELA 2: CONTAS E CARTEIRAS (P01)
             ================================================================= */}
          {activeRoute === "contas" && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5">
                <div>
                  <h2 className="text-lg font-extrabold text-[#142D43]">
                    Contas e Carteiras ({activeWorkspace.name})
                  </h2>
                  <p className="text-xs text-slate-500">
                    Invariante P01: Saldo atual = saldo inicial + receitas
                    liquidadas − despesas liquidadas ± transferências liquidadas.
                    Contas com movimentos liquidados são arquivadas, nunca
                    excluídas fisicamente.
                  </p>
                </div>
                <button
                  onClick={() => setShowAccountModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#142D43] px-4 py-2 text-xs font-bold text-white"
                >
                  <Plus className="h-4 w-4 text-[#69E2C0]" />
                  Nova Conta
                </button>
              </div>

              {accounts.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
                  <Wallet className="mx-auto h-8 w-8 text-slate-400" />
                  <h3 className="mt-2 text-sm font-bold text-[#142D43]">
                    Cadastre sua primeira conta
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Uma conta recém-criada sem saldo inicial começa exatamente em
                    R$ 0,00.
                  </p>
                  <button
                    onClick={() => setShowAccountModal(true)}
                    className="mt-4 rounded-xl bg-[#142D43] px-4 py-2 text-xs font-bold text-white"
                  >
                    Criar Conta Agora
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  {accounts.map((acc) => (
                    <div
                      key={acc.id}
                      className={`rounded-2xl border bg-white p-5 shadow-sm ${
                        acc.status === "ARCHIVED"
                          ? "border-slate-200 opacity-60"
                          : "border-slate-200"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="rounded-full bg-[#F4F7FA] px-2.5 py-0.5 text-[10px] font-bold uppercase text-[#142D43]">
                          {acc.type} • {acc.status}
                        </span>
                        <span className="text-xs text-slate-400">
                          {acc.institution || "Sem instituição"}
                        </span>
                      </div>
                      <h3 className="mt-3 text-base font-extrabold text-[#142D43]">
                        {acc.name}
                      </h3>
                      <div className="mt-3 font-mono text-2xl font-black tabular-nums text-[#142D43]">
                        {formatBRL(acc.currentBalanceCents)}
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500">
                        Saldo inicial: {formatBRL(acc.openingBalanceCents)} em{" "}
                        {formatDateBR(acc.openingBalanceDate)}
                      </p>
                      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                        <span className="text-slate-500">
                          {acc.settledCount} movimento(s) liquidado(s)
                        </span>
                        {acc.status === "ACTIVE" && (
                          <button
                            onClick={() =>
                              executeAction(
                                {
                                  action: "DELETE_OR_ARCHIVE_ACCOUNT",
                                  accountId: acc.id,
                                },
                                acc.canDelete
                                  ? "Conta excluída."
                                  : "Conta arquivada preservando histórico liquidado."
                              )
                            }
                            className="font-semibold text-rose-700 hover:underline"
                          >
                            {acc.canDelete ? "Excluir" : "Arquivar"}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* =================================================================
              TELA 3: MOVIMENTAÇÕES E TRANSFERÊNCIAS ATÔMICAS (P01)
             ================================================================= */}
          {activeRoute === "movimentacoes" && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5">
                <div>
                  <h2 className="text-lg font-extrabold text-[#142D43]">
                    Movimentações e Transferências Internas
                  </h2>
                  <p className="text-xs text-slate-500">
                    Transferências geram duas pernas atômicas (TRANSFER_OUT e
                    TRANSFER_IN) sem inflar receitas ou despesas consolidadas.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setShowTransferModal(true)}
                    disabled={accounts.length < 2}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[#142D43] bg-white px-3.5 py-2 text-xs font-bold text-[#142D43] disabled:opacity-40"
                  >
                    <ArrowLeftRight className="h-3.5 w-3.5" />
                    Transferência entre Contas
                  </button>
                  <button
                    onClick={() => setShowTxModal(true)}
                    disabled={accounts.length === 0}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#142D43] px-4 py-2 text-xs font-bold text-white disabled:opacity-40"
                  >
                    <Plus className="h-3.5 w-3.5 text-[#69E2C0]" />
                    Registrar Receita / Despesa
                  </button>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-[#F4F7FA] text-[11px] font-bold uppercase text-slate-600">
                    <tr>
                      <th className="px-4 py-3">Data</th>
                      <th className="px-4 py-3">Descrição</th>
                      <th className="px-4 py-3">Tipo</th>
                      <th className="px-4 py-3">Conta</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Valor (BRL)</th>
                      <th className="px-4 py-3 text-right">Ações Auditáveis</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredTransactions.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-4 py-8 text-center text-slate-500"
                        >
                          Nenhuma movimentação registrada neste workspace.
                        </td>
                      </tr>
                    ) : (
                      filteredTransactions.map((tx) => (
                        <tr
                          key={tx.id}
                          className={
                            tx.status === "CANCELED" ? "opacity-50 line-through" : ""
                          }
                        >
                          <td className="px-4 py-3 font-mono text-[11px]">
                            {formatDateBR(tx.occurredOn)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-bold text-[#142D43]">
                              {tx.description}
                            </div>
                            {tx.costCenter && (
                              <span className="text-[10px] text-slate-500">
                                Centro: {tx.costCenter}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className="rounded bg-[#F4F7FA] px-2 py-0.5 font-mono text-[10px] font-bold text-[#142D43]">
                              {tx.kind}
                            </span>
                          </td>
                          <td className="px-4 py-3">{tx.account?.name}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                                tx.status === "SETTLED"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : tx.status === "PENDING"
                                  ? "bg-amber-100 text-amber-900"
                                  : "bg-slate-200 text-slate-600"
                              }`}
                            >
                              {tx.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold tabular-nums">
                            {tx.kind === "INCOME" || tx.kind === "TRANSFER_IN"
                              ? "+"
                              : "-"}
                            {formatBRL(tx.amountCents)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="inline-flex gap-2">
                              {tx.status === "PENDING" && (
                                <button
                                  onClick={() =>
                                    executeAction(
                                      {
                                        action: "SETTLE_TRANSACTION",
                                        transactionId: tx.id,
                                      },
                                      "Lançamento liquidado com sucesso."
                                    )
                                  }
                                  className="rounded-lg bg-[#142D43] px-2.5 py-1 text-[10px] font-bold text-white"
                                >
                                  Liquidar
                                </button>
                              )}
                              {tx.status !== "CANCELED" && (
                                <button
                                  onClick={() =>
                                    executeAction(
                                      {
                                        action: "CANCEL_TRANSACTION",
                                        transactionId: tx.id,
                                        reason:
                                          "Estorno/cancelamento contábil com preservação de histórico",
                                      },
                                      "Lançamento cancelado (histórico preservado)."
                                    )
                                  }
                                  className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] font-semibold text-rose-800"
                                >
                                  <Ban className="h-3 w-3" />
                                  Estornar
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* =================================================================
              TELAS B e C (P02): CONTAS A PAGAR E CONTAS A RECEBER (PARCELAS E BAIXAS)
             ================================================================= */}
          {(activeRoute === "contas-a-pagar" ||
            activeRoute === "contas-a-receber") && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5">
                <div>
                  <h2 className="text-lg font-extrabold text-[#142D43]">
                    {activeRoute === "contas-a-pagar"
                      ? "Contas a Pagar — Obrigações, Parcelas e Baixas (P02)"
                      : "Contas a Receber — Previsões, Clientes e Recebíveis (P02)"}
                  </h2>
                  <p className="text-xs text-slate-500">
                    Suporta 1 a N parcelas com divisão exata de centavos e baixa
                    parcial ou integral vinculada atomicamente ao Ledger P01.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setObDirection(
                      activeRoute === "contas-a-receber"
                        ? "RECEIVABLE"
                        : "PAYABLE"
                    );
                    setShowObligationModal(true);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#142D43] px-4 py-2 text-xs font-bold text-white"
                >
                  <Plus className="h-4 w-4 text-[#69E2C0]" />
                  {activeRoute === "contas-a-receber"
                    ? "Novo Recebível / Parcelamento"
                    : "Nova Conta a Pagar / Parcelamento"}
                </button>
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-[#F4F7FA] text-[11px] font-bold uppercase text-slate-600">
                    <tr>
                      <th className="px-4 py-3">Vencimento</th>
                      <th className="px-4 py-3">Obrigação / Contraparte</th>
                      <th className="px-4 py-3">Parcela</th>
                      <th className="px-4 py-3">Categoria</th>
                      <th className="px-4 py-3">Status Derivado</th>
                      <th className="px-4 py-3 text-right">Valor Original</th>
                      <th className="px-4 py-3 text-right">Saldo em Aberto</th>
                      <th className="px-4 py-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(activeRoute === "contas-a-pagar"
                      ? payableInstallments
                      : receivableInstallments
                    ).length === 0 ? (
                      <tr>
                        <td
                          colSpan={8}
                          className="px-4 py-8 text-center text-slate-500"
                        >
                          Nenhum compromisso registrado nesta visão.
                        </td>
                      </tr>
                    ) : (
                      (activeRoute === "contas-a-pagar"
                        ? payableInstallments
                        : receivableInstallments
                      ).map((inst) => (
                        <tr key={inst.id}>
                          <td className="px-4 py-3 font-mono text-[11px] font-bold">
                            {formatDateBR(inst.dueOn)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-bold text-[#142D43]">
                              {inst.obligationTitle}
                            </div>
                            {inst.counterparty && (
                              <div className="text-[11px] text-slate-500">
                                {inst.counterparty}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono">
                            {inst.number}/{inst.totalInstallments}
                          </td>
                          <td className="px-4 py-3">{inst.categoryName}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                                inst.derivedStatus === "PAID"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : inst.derivedStatus === "PARTIAL"
                                  ? "bg-sky-100 text-sky-900"
                                  : inst.derivedStatus === "OVERDUE"
                                  ? "bg-rose-100 text-rose-800"
                                  : "bg-amber-100 text-amber-900"
                              }`}
                            >
                              {inst.derivedStatus}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-600">
                            {formatBRL(inst.amountCents)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold tabular-nums text-[#142D43]">
                            {formatBRL(inst.outstandingCents)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {inst.outstandingCents > 0 && (
                              <button
                                onClick={() => {
                                  setSettlementTarget(inst);
                                  setSettleAmountDecimal(
                                    centsToDecimalString(inst.outstandingCents)
                                  );
                                }}
                                className="rounded-lg bg-[#142D43] px-3 py-1 text-[11px] font-bold text-white hover:bg-[#142D43]/90"
                              >
                                Registrar Baixa
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* =================================================================
              TELAS DE PLANEJAMENTO (P02): VISÃO GERAL, ORÇAMENTOS, CALENDÁRIO, CENÁRIOS, METAS
             ================================================================= */}
          {(activeRoute.startsWith("planejamento") ||
            activeRoute === "fluxo-de-caixa") && (
            <div className="space-y-6">
              {/* Sub-navegação de Planejamento */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap gap-1.5">
                  {[
                    {
                      key: "planejamento" as NovaRouteKey,
                      label: "Visão Consolidada",
                      icon: Compass,
                    },
                    {
                      key: "planejamento/orcamentos" as NovaRouteKey,
                      label: "Orçamento Inteligente",
                      icon: Target,
                    },
                    {
                      key: "planejamento/calendario" as NovaRouteKey,
                      label: "Calendário Diário",
                      icon: Calendar,
                    },
                    {
                      key: "planejamento/cenarios" as NovaRouteKey,
                      label: "Cenários (Base/Cons/Otim)",
                      icon: Sliders,
                    },
                    {
                      key: "planejamento/metas" as NovaRouteKey,
                      label: "Metas Financeiras",
                      icon: Flag,
                    },
                  ].map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.key}
                        onClick={() => navigateRoute(tab.key)}
                        className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                          activeRoute === tab.key
                            ? "bg-[#142D43] text-white"
                            : "bg-[#F4F7FA] text-slate-600 hover:text-[#142D43]"
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                {/* Configurador Rápido da Margem de Segurança (B) */}
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    await executeAction(
                      {
                        action: "UPDATE_SAFETY_BUFFER",
                        safetyBufferDecimal: bufferInputDecimal,
                      },
                      "Margem de segurança atualizada."
                    );
                  }}
                  className="flex items-center gap-2 text-xs"
                >
                  <span className="font-semibold text-slate-600">
                    Margem de Segurança (B): R$
                  </span>
                  <input
                    type="text"
                    value={bufferInputDecimal}
                    onChange={(e) => setBufferInputDecimal(e.target.value)}
                    className="w-28 rounded-lg border border-slate-300 px-2.5 py-1 font-mono text-xs font-bold text-[#142D43]"
                  />
                  <button
                    type="submit"
                    className="rounded-lg bg-[#142D43] px-3 py-1 font-bold text-white"
                  >
                    Salvar
                  </button>
                </form>
              </div>

              {/* Subtela: Orçamento Inteligente */}
              {activeRoute === "planejamento/orcamentos" && (
                <div className="space-y-4">
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      await executeAction(
                        {
                          action: "CREATE_BUDGET",
                          categoryName: budgetCat,
                          limitDecimal: budgetLimitDecimal,
                        },
                        "Teto de orçamento salvo."
                      );
                    }}
                    className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-5"
                  >
                    <div>
                      <label className="block text-xs font-bold text-slate-600">
                        Categoria
                      </label>
                      <input
                        type="text"
                        value={budgetCat}
                        onChange={(e) => setBudgetCat(e.target.value)}
                        className="mt-1 rounded-xl border border-slate-300 px-3 py-1.5 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600">
                        Limite Mensal (R$)
                      </label>
                      <input
                        type="text"
                        value={budgetLimitDecimal}
                        onChange={(e) => setBudgetLimitDecimal(e.target.value)}
                        className="mt-1 rounded-xl border border-slate-300 px-3 py-1.5 font-mono text-xs"
                      />
                    </div>
                    <button
                      type="submit"
                      className="rounded-xl bg-[#142D43] px-4 py-2 text-xs font-bold text-white"
                    >
                      Definir Orçamento
                    </button>
                  </form>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {budgets.map((b) => (
                      <div
                        key={b.id}
                        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-extrabold text-[#142D43]">
                            {b.categoryName} ({b.period})
                          </span>
                          <span className="rounded-full bg-[#F4F7FA] px-2.5 py-0.5 font-mono text-xs font-bold text-[#142D43]">
                            {b.usagePct}% do teto
                          </span>
                        </div>
                        <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-slate-600">
                          <div>
                            Realizado:{" "}
                            <strong className="font-mono">
                              {formatBRL(b.realizedCents)}
                            </strong>
                          </div>
                          <div>
                            Comprometido:{" "}
                            <strong className="font-mono">
                              {formatBRL(b.committedOpenCents)}
                            </strong>
                          </div>
                          <div>
                            Teto:{" "}
                            <strong className="font-mono">
                              {formatBRL(b.limitCents)}
                            </strong>
                          </div>
                        </div>
                        <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                          <div
                            style={{ width: `${Math.min(100, b.usagePct)}%` }}
                            className={`h-full ${
                              b.usagePct >= 100
                                ? "bg-rose-600"
                                : b.usagePct >= 70
                                ? "bg-[#F2B766]"
                                : "bg-[#69E2C0]"
                            }`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Subtela: Cenários */}
              {activeRoute === "planejamento/cenarios" && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  {scenarios.map((sc) => (
                    <div
                      key={sc.id}
                      onClick={() => setScenarioKind(sc.kind)}
                      className={`cursor-pointer rounded-2xl border bg-white p-5 shadow-sm ${
                        scenarioKind === sc.kind
                          ? "border-2 border-[#142D43]"
                          : "border-slate-200"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="rounded-full bg-[#F4F7FA] px-2.5 py-0.5 text-[10px] font-bold uppercase text-[#142D43]">
                          {sc.kind}
                        </span>
                        {scenarioKind === sc.kind && (
                          <span className="text-xs font-bold text-emerald-700">
                            ● Ativo na Projeção
                          </span>
                        )}
                      </div>
                      <h3 className="mt-2 text-base font-extrabold text-[#142D43]">
                        {sc.name}
                      </h3>
                      <p className="mt-1 text-xs text-slate-500">{sc.notes}</p>
                      <div className="mt-3 text-xs text-slate-600">
                        Contingência sobre saídas:{" "}
                        <strong>+{sc.contingencyBufferPct}%</strong>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Subtela: Metas Financeiras */}
              {activeRoute === "planejamento/metas" && (
                <div className="space-y-4">
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!goalName.trim()) return;
                      await executeAction(
                        {
                          action: "CREATE_GOAL",
                          name: goalName,
                          targetAmountDecimal: goalTargetDecimal,
                          targetOn: goalTargetOn,
                          reserveId: goalReserveId || reserves[0]?.id,
                        },
                        "Meta financeira criada."
                      );
                      setGoalName("");
                    }}
                    className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-5"
                  >
                    <input
                      type="text"
                      required
                      placeholder="Nome da Meta"
                      value={goalName}
                      onChange={(e) => setGoalName(e.target.value)}
                      className="rounded-xl border border-slate-300 px-3 py-2 text-xs"
                    />
                    <input
                      type="text"
                      placeholder="Valor Alvo (Ex: 15000.00)"
                      value={goalTargetDecimal}
                      onChange={(e) => setGoalTargetDecimal(e.target.value)}
                      className="rounded-xl border border-slate-300 px-3 py-2 font-mono text-xs"
                    />
                    <input
                      type="date"
                      value={goalTargetOn}
                      onChange={(e) => setGoalTargetOn(e.target.value)}
                      className="rounded-xl border border-slate-300 px-3 py-2 text-xs"
                    />
                    <select
                      value={goalReserveId}
                      onChange={(e) => setGoalReserveId(e.target.value)}
                      className="rounded-xl border border-slate-300 px-3 py-2 text-xs"
                    >
                      <option value="">Vincular a Cofre (Opcional)</option>
                      {reserves.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      className="rounded-xl bg-[#142D43] px-4 py-2 text-xs font-bold text-white"
                    >
                      Criar Meta
                    </button>
                  </form>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {goals.map((g) => (
                      <div
                        key={g.id}
                        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                      >
                        <div className="flex justify-between">
                          <h4 className="font-extrabold text-[#142D43]">
                            {g.name}
                          </h4>
                          <span className="font-mono text-xs font-bold text-emerald-700">
                            {g.progressPct}%
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">
                          Cofre vinculado: {g.linkedReserveName} • Alvo:{" "}
                          {formatBRL(g.targetAmountCents)}
                        </p>
                        <div className="mt-3 rounded-xl bg-[#F4F7FA] p-3 text-xs">
                          Contribuição mensal necessária ({g.remainingMonths}{" "}
                          meses restantes, sem assumir rentabilidade):{" "}
                          <strong className="font-mono text-[#142D43]">
                            {formatBRL(g.requiredMonthlyCents)}/mês
                          </strong>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Série Diária de Fluxo de Caixa / Calendário Financeiro */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-sm font-bold text-[#142D43]">
                  Série Diária do Fluxo de Caixa e Calendário ({horizonDays}{" "}
                  dias • Cenário {scenarioKind})
                </h3>
                <div className="mt-4 max-h-96 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-200 bg-[#F4F7FA] text-[11px] font-bold uppercase text-slate-600">
                      <tr>
                        <th className="px-3 py-2">Data</th>
                        <th className="px-3 py-2 text-right">Saldo Inicial</th>
                        <th className="px-3 py-2 text-right">
                          Entradas Previstas
                        </th>
                        <th className="px-3 py-2 text-right">
                          Saídas Previstas
                        </th>
                        <th className="px-3 py-2 text-right">
                          Saldo Projetado Final
                        </th>
                        <th className="px-3 py-2">Diagnóstico do Dia</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {forecastSeries.map((pt) => (
                        <tr
                          key={pt.date}
                          className={
                            pt.isNegative
                              ? "bg-rose-50"
                              : pt.isCritical
                              ? "bg-amber-50/60"
                              : ""
                          }
                        >
                          <td className="px-3 py-2 font-bold">
                            {formatDateBR(pt.date)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {formatBRL(pt.startingCents)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-emerald-700">
                            +{formatBRL(pt.inboundCents)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-amber-800">
                            -{formatBRL(pt.outboundCents)}
                          </td>
                          <td className="px-3 py-2 text-right font-bold tabular-nums text-[#142D43]">
                            {formatBRL(pt.endingCents)}
                          </td>
                          <td className="px-3 py-2 font-sans">
                            {pt.isNegative ? (
                              <span className="rounded bg-rose-200 px-2 py-0.5 text-[10px] font-bold text-rose-900">
                                Saldo Negativo
                              </span>
                            ) : pt.isCritical ? (
                              <span className="rounded bg-[#F2B766]/40 px-2 py-0.5 text-[10px] font-bold text-[#142D43]">
                                Abaixo da Margem
                              </span>
                            ) : (
                              <span className="text-[11px] text-emerald-700">
                                Normal
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* =================================================================
              TELA G & H (P02): RESERVAS, COFRES VIRTUAIS E MOTOR DE CAPACIDADE
             ================================================================= */}
          {activeRoute === "reservas" && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5">
                <div>
                  <h2 className="text-lg font-extrabold text-[#142D43]">
                    Reservas e Cofres Virtuais de Planejamento (P02)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Importante: valores reservados são alocações virtuais para
                    planejamento — não saem da conta bancária nem geram receita
                    ou despesa fictícia.
                  </p>
                </div>
                <button
                  onClick={() => setShowReserveModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#142D43] px-4 py-2 text-xs font-bold text-white"
                >
                  <Plus className="h-4 w-4 text-[#69E2C0]" />
                  Criar Cofre
                </button>
              </div>

              {/* Resumo de Cobertura */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <span className="text-xs text-slate-500">
                    Saldo Bancário Elegível (S)
                  </span>
                  <div className="mt-1 font-mono text-2xl font-extrabold text-[#142D43]">
                    {formatBRL(kpis.eligibleBalanceCents)}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <span className="text-xs text-slate-500">
                    Total Alocado em Cofres (R)
                  </span>
                  <div className="mt-1 font-mono text-2xl font-extrabold text-teal-700">
                    {formatBRL(kpis.totalAllocatedReservesCents)}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <span className="text-xs text-slate-500">
                    Saldo Livre Não Alocado (S − R)
                  </span>
                  <div
                    className={`mt-1 font-mono text-2xl font-extrabold ${
                      kpis.freeCashCents < 0 ? "text-rose-600" : "text-[#142D43]"
                    }`}
                  >
                    {formatBRL(kpis.freeCashCents)}
                  </div>
                </div>
                <div className="rounded-2xl border-2 border-[#69E2C0] bg-[#142D43] p-4 text-white">
                  <span className="text-xs font-bold text-[#69E2C0]">
                    Capacidade Adicional Segura (Headroom)
                  </span>
                  <div className="mt-1 font-mono text-2xl font-black text-[#69E2C0]">
                    {formatBRL(kpis.headroomCents)}
                  </div>
                </div>
              </div>

              {/* Lista de Cofres */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {reserves.map((res) => (
                  <div
                    key={res.id}
                    className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="rounded-full bg-[#F4F7FA] px-2.5 py-0.5 text-[10px] font-bold uppercase text-[#142D43]">
                          {res.kind}
                        </span>
                        <span className="font-mono text-xs font-bold text-teal-700">
                          {res.progressPct}%
                        </span>
                      </div>
                      <h3 className="mt-2 text-base font-extrabold text-[#142D43]">
                        {res.name}
                      </h3>
                      <div className="mt-3 font-mono text-2xl font-black text-[#142D43]">
                        {formatBRL(res.allocatedCents)}
                      </div>
                      {res.targetAmountCents && (
                        <p className="text-xs text-slate-500">
                          Alvo: {formatBRL(res.targetAmountCents)} • Data:{" "}
                          {formatDateBR(res.targetOn)}
                        </p>
                      )}
                      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                        <div
                          style={{ width: `${res.progressPct}%` }}
                          className="h-full bg-[#69E2C0]"
                        />
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                      <button
                        onClick={() => {
                          setReserveActionModal({
                            reserve: res,
                            mode: "ALLOCATE",
                          });
                          setResMoveAmountDecimal(
                            kpis.headroomCents > 0
                              ? centsToDecimalString(kpis.headroomCents)
                              : "500.00"
                          );
                        }}
                        className="flex-1 rounded-xl bg-[#142D43] py-1.5 text-xs font-bold text-white"
                      >
                        Alocar (Virtual)
                      </button>
                      <button
                        onClick={() => {
                          setReserveActionModal({
                            reserve: res,
                            mode: "RELEASE",
                          });
                          setResMoveAmountDecimal("100.00");
                        }}
                        className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"
                      >
                        Liberar
                      </button>
                      {reserves.length > 1 && (
                        <button
                          onClick={() => {
                            const other = reserves.find((r) => r.id !== res.id);
                            setResMoveDestId(other?.id || "");
                            setReserveActionModal({
                              reserve: res,
                              mode: "TRANSFER",
                            });
                          }}
                          className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"
                        >
                          Transferir
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Explicação Auditável do Motor de Capacidade */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <h4 className="text-sm font-bold text-[#142D43]">
                  Explicação Item a Item do Cálculo Conservador de Reserva
                </h4>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-600">
                  {reserveCapacityReport.explanations.map((exp, idx) => (
                    <li key={idx}>{exp}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* =================================================================
              TELAS J & K (P02): INTELIGÊNCIA FINANCEIRA (ALERTAS E DIAGNÓSTICO)
             ================================================================= */}
          {activeRoute.startsWith("inteligencia") && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="text-lg font-extrabold text-[#142D43]">
                  Central de Alertas e Diagnóstico Mensal Explicável (P02)
                </h2>
                <p className="text-xs text-slate-500">
                  Linguagem não alarmista, explicações rastreáveis e zero
                  indicação nominal de produto de investimento no Pacote 02.
                </p>

                <div className="mt-4 space-y-3">
                  {alerts.length === 0 ? (
                    <div className="rounded-xl bg-[#F4F7FA] p-6 text-center text-xs text-slate-500">
                      Nenhum alerta crítico ou pendente no horizonte atual.
                    </div>
                  ) : (
                    alerts.map((al) => (
                      <div
                        key={al.id}
                        className={`rounded-xl border p-4 ${
                          al.severity === "CRITICAL"
                            ? "border-rose-300 bg-rose-50"
                            : "border-amber-300 bg-amber-50"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10px] font-bold uppercase">
                            {al.type} • {al.severity}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            {formatDateBR(al.occurrenceOn)}
                          </span>
                        </div>
                        <h4 className="mt-1 text-sm font-bold text-[#142D43]">
                          {al.title}
                        </h4>
                        <p className="mt-0.5 text-xs text-slate-700">
                          {al.message}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* =================================================================
              TELA L: RELATÓRIOS E EXPORTAÇÃO CSV
             ================================================================= */}
          {activeRoute === "relatorios" && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5">
                <div>
                  <h2 className="text-lg font-extrabold text-[#142D43]">
                    Relatórios Consolidados ({activeWorkspace.name})
                  </h2>
                  <p className="text-xs text-slate-500">
                    Receitas x despesas realizadas, compromissos por vencimento
                    e alocações de reservas
                  </p>
                </div>
                <button
                  onClick={() => {
                    const headers =
                      "Data,Descricao,Tipo,Status,Valor_BRL\n" +
                      transactions
                        .map(
                          (t) =>
                            `${t.occurredOn},"${t.description}",${t.kind},${
                              t.status
                            },${centsToDecimalString(t.amountCents)}`
                        )
                        .join("\n");
                    const blob = new Blob([headers], { type: "text/csv" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `nova-relatorio-${activeWorkspace.id}.csv`;
                    a.click();
                  }}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#142D43] px-4 py-2 text-xs font-bold text-white"
                >
                  <Download className="h-4 w-4 text-[#69E2C0]" />
                  Exportar CSV Auditável
                </button>
              </div>
            </div>
          )}

          {/* =================================================================
              ADMINISTRAÇÃO, PAPÉIS RBAC E AUDITORIA
             ================================================================= */}
          {activeRoute === "configuracoes" && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <h3 className="text-base font-extrabold text-[#142D43]">
                  Controle de Acesso por Papel (RBAC no Servidor)
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Alterne o papel ativo abaixo para testar a trava de segurança
                  na API: o perfil <code>VIEWER</code> pode consultar dados, mas
                  recebe <code>403 WORKSPACE_FORBIDDEN</code> ao tentar gravar.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(["OWNER", "ADMIN", "EDITOR", "VIEWER"] as const).map(
                    (role) => (
                      <button
                        key={role}
                        onClick={() =>
                          executeAction(
                            { action: "CHANGE_MEMBER_ROLE", role },
                            `Papel alterado para ${role}.`
                          )
                        }
                        className={`rounded-xl px-4 py-2 text-xs font-bold ${
                          currentRole === role
                            ? "bg-[#142D43] text-[#69E2C0]"
                            : "bg-[#F4F7FA] text-slate-700"
                        }`}
                      >
                        {role}
                      </button>
                    )
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <h3 className="text-base font-extrabold text-[#142D43]">
                  Eventos de Auditoria ({auditEvents.length})
                </h3>
                <div className="mt-3 max-h-80 space-y-2 overflow-y-auto text-xs">
                  {auditEvents.map((ev) => (
                    <div
                      key={ev.id}
                      className="rounded-xl bg-[#F4F7FA] p-3 font-mono text-[11px]"
                    >
                      <div className="flex justify-between font-bold text-[#142D43]">
                        <span>{ev.action}</span>
                        <span>{ev.requestId}</span>
                      </div>
                      <div className="mt-1 text-slate-600">
                        {ev.entityType} ({ev.entityId}) • {ev.metadataJson}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* =================================================================
              PACOTE 03: INVESTIMENTOS, RENTABILIDADE E SIMULADOR PATRIMONIAL
             ================================================================= */}
          {activeRoute === "investimentos" && (
            <NovaInvestmentsP03View
              workspaceType={activeWorkspace.type}
              workspaceName={activeWorkspace.name}
            />
          )}
        </main>
      </div>

      {/* =====================================================================
          MODAIS DE OPERAÇÃO (CONTA, LANÇAMENTO, TRANSFERÊNCIA, OBRIGAÇÃO, BAIXA, COFRE)
         ===================================================================== */}
      {showAccountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#142D43]/60 p-4 backdrop-blur-sm">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await executeAction(
                {
                  action: "CREATE_ACCOUNT",
                  name: accName,
                  type: accType,
                  institution: accInst,
                  openingBalanceDecimal: accOpeningDecimal,
                },
                "Conta criada com sucesso."
              );
              if (ok) {
                setAccName("");
                setAccOpeningDecimal("0.00");
                setShowAccountModal(false);
              }
            }}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
          >
            <h3 className="text-base font-extrabold text-[#142D43]">
              Cadastrar Conta ou Carteira
            </h3>
            <div className="mt-4 space-y-3 text-xs">
              <div>
                <label className="font-bold">Nome da Conta</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Conta Principal Itaú"
                  value={accName}
                  onChange={(e) => setAccName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="font-bold">Tipo</label>
                <select
                  value={accType}
                  onChange={(e) => setAccType(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                >
                  <option value="CHECKING">Conta Corrente (CHECKING)</option>
                  <option value="SAVINGS">Poupança / Reserva (SAVINGS)</option>
                  <option value="CASH">Caixa Físico (CASH)</option>
                </select>
              </div>
              <div>
                <label className="font-bold">
                  Saldo Inicial (R$ — padrão 0.00)
                </label>
                <input
                  type="text"
                  value={accOpeningDecimal}
                  onChange={(e) => setAccOpeningDecimal(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 font-mono"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAccountModal(false)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-xl bg-[#142D43] px-4 py-2 text-xs font-bold text-white"
              >
                Salvar Conta
              </button>
            </div>
          </form>
        </div>
      )}

      {showTxModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#142D43]/60 p-4 backdrop-blur-sm">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await executeAction(
                {
                  action: "CREATE_TRANSACTION",
                  accountId: txAccountId || accounts[0]?.id,
                  kind: txKind,
                  status: txStatus,
                  description: txDescription,
                  amountDecimal: txAmountDecimal,
                  occurredOn: txDate,
                  dueOn: txDate,
                  costCenter: txCostCenter,
                },
                "Lançamento registrado."
              );
              if (ok) {
                setTxDescription("");
                setShowTxModal(false);
              }
            }}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
          >
            <h3 className="text-base font-extrabold text-[#142D43]">
              Registrar Movimentação (P01)
            </h3>
            <div className="mt-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold">Tipo</label>
                  <select
                    value={txKind}
                    onChange={(e) =>
                      setTxKind(e.target.value as "INCOME" | "EXPENSE")
                    }
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                  >
                    <option value="INCOME">
                      {isPJ ? "Recebimento (INCOME)" : "Receita (INCOME)"}
                    </option>
                    <option value="EXPENSE">Despesa (EXPENSE)</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold">Status</label>
                  <select
                    value={txStatus}
                    onChange={(e) =>
                      setTxStatus(e.target.value as "SETTLED" | "PENDING")
                    }
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                  >
                    <option value="SETTLED">Liquidado (Altera Saldo)</option>
                    <option value="PENDING">Pendente (Apenas Projeção)</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="font-bold">Conta</label>
                <select
                  value={txAccountId}
                  onChange={(e) => setTxAccountId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="font-bold">Descrição</label>
                <input
                  type="text"
                  required
                  value={txDescription}
                  onChange={(e) => setTxDescription(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold">Valor Positivo (R$)</label>
                  <input
                    type="text"
                    required
                    value={txAmountDecimal}
                    onChange={(e) => setTxAmountDecimal(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold">Data</label>
                  <input
                    type="date"
                    value={txDate}
                    onChange={(e) => setTxDate(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowTxModal(false)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-xl bg-[#142D43] px-4 py-2 text-xs font-bold text-white"
              >
                Confirmar
              </button>
            </div>
          </form>
        </div>
      )}

      {showTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#142D43]/60 p-4 backdrop-blur-sm">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await executeAction(
                {
                  action: "CREATE_TRANSFER",
                  sourceAccountId: tfSourceId,
                  destinationAccountId: tfDestId,
                  amountDecimal: tfAmountDecimal,
                  description: tfDesc,
                },
                "Transferência atômica realizada (saldo consolidado preservado)."
              );
              if (ok) setShowTransferModal(false);
            }}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
          >
            <h3 className="text-base font-extrabold text-[#142D43]">
              Transferência entre Contas Próprias
            </h3>
            <div className="mt-4 space-y-3 text-xs">
              <div>
                <label className="font-bold">Conta de Origem (Saída)</label>
                <select
                  value={tfSourceId}
                  onChange={(e) => setTfSourceId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({formatBRL(a.currentBalanceCents)})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="font-bold">Conta de Destino (Entrada)</label>
                <select
                  value={tfDestId}
                  onChange={(e) => setTfDestId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({formatBRL(a.currentBalanceCents)})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="font-bold">Valor (R$)</label>
                <input
                  type="text"
                  value={tfAmountDecimal}
                  onChange={(e) => setTfAmountDecimal(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 font-mono"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowTransferModal(false)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-xl bg-[#142D43] px-4 py-2 text-xs font-bold text-white"
              >
                Transferir
              </button>
            </div>
          </form>
        </div>
      )}

      {showObligationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#142D43]/60 p-4 backdrop-blur-sm">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await executeAction(
                {
                  action: "CREATE_OBLIGATION",
                  direction: obDirection,
                  title: obTitle,
                  categoryName: obCategory,
                  counterparty: obCounterparty,
                  costCenter: obCostCenter,
                  totalAmountDecimal: obTotalDecimal,
                  installmentsCount: obCount,
                  firstDueOn: obFirstDue,
                },
                "Compromisso parcelado criado com sucesso."
              );
              if (ok) {
                setObTitle("");
                setShowObligationModal(false);
              }
            }}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
          >
            <h3 className="text-base font-extrabold text-[#142D43]">
              Novo Compromisso / Obrigação (P02)
            </h3>
            <div className="mt-4 space-y-3 text-xs">
              <div>
                <label className="font-bold">Direção</label>
                <select
                  value={obDirection}
                  onChange={(e) =>
                    setObDirection(e.target.value as "PAYABLE" | "RECEIVABLE")
                  }
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                >
                  <option value="PAYABLE">Conta a Pagar (PAYABLE)</option>
                  <option value="RECEIVABLE">
                    Conta a Receber (RECEIVABLE)
                  </option>
                </select>
              </div>
              <div>
                <label className="font-bold">Descrição / Título</label>
                <input
                  type="text"
                  required
                  value={obTitle}
                  onChange={(e) => setObTitle(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold">Valor Total (R$)</label>
                  <input
                    type="text"
                    required
                    value={obTotalDecimal}
                    onChange={(e) => setObTotalDecimal(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold">Nº de Parcelas</label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={obCount}
                    onChange={(e) => setObCount(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="font-bold">1º Vencimento</label>
                <input
                  type="date"
                  value={obFirstDue}
                  onChange={(e) => setObFirstDue(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowObligationModal(false)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-xl bg-[#142D43] px-4 py-2 text-xs font-bold text-white"
              >
                Gerar Parcelas
              </button>
            </div>
          </form>
        </div>
      )}

      {settlementTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#142D43]/60 p-4 backdrop-blur-sm">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await executeAction(
                {
                  action: "RECORD_SETTLEMENT",
                  installmentId: settlementTarget.id,
                  accountId: settleAccountId || accounts[0]?.id,
                  amountDecimal: settleAmountDecimal,
                  settledOn: settleDate,
                  note: settleNote,
                },
                "Baixa contábil registrada e vinculada ao Ledger P01."
              );
              if (ok) setSettlementTarget(null);
            }}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
          >
            <h3 className="text-base font-extrabold text-[#142D43]">
              Registrar Baixa de Parcela (Pagamento/Recebimento Externo)
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              {settlementTarget.obligationTitle} • Saldo aberto:{" "}
              <strong>{formatBRL(settlementTarget.outstandingCents)}</strong>
            </p>
            <div className="mt-4 space-y-3 text-xs">
              <div>
                <label className="font-bold">Conta de Liquidação</label>
                <select
                  value={settleAccountId}
                  onChange={(e) => setSettleAccountId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({formatBRL(a.currentBalanceCents)})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="font-bold">
                  Valor Pago/Recebido (R$ — parcial ou total)
                </label>
                <input
                  type="text"
                  required
                  value={settleAmountDecimal}
                  onChange={(e) => setSettleAmountDecimal(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 font-mono"
                />
              </div>
              <div>
                <label className="font-bold">Data Efetiva</label>
                <input
                  type="date"
                  value={settleDate}
                  onChange={(e) => setSettleDate(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSettlementTarget(null)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-xl bg-[#142D43] px-4 py-2 text-xs font-bold text-white"
              >
                Confirmar Baixa
              </button>
            </div>
          </form>
        </div>
      )}

      {showReserveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#142D43]/60 p-4 backdrop-blur-sm">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await executeAction(
                {
                  action: "CREATE_RESERVE",
                  name: resName,
                  kind: resKind,
                  targetAmountDecimal: resTargetDecimal,
                  targetOn: resTargetOn,
                },
                "Cofre virtual criado."
              );
              if (ok) {
                setResName("");
                setShowReserveModal(false);
              }
            }}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
          >
            <h3 className="text-base font-extrabold text-[#142D43]">
              Criar Cofre de Reserva Virtual (P02)
            </h3>
            <div className="mt-4 space-y-3 text-xs">
              <div>
                <label className="font-bold">Nome do Cofre</label>
                <input
                  type="text"
                  required
                  value={resName}
                  onChange={(e) => setResName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="font-bold">Finalidade</label>
                <select
                  value={resKind}
                  onChange={(e) => setResKind(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                >
                  <option value="EMERGENCY">Emergência (EMERGENCY)</option>
                  <option value="WORKING_CAPITAL">
                    Capital de Giro (WORKING_CAPITAL)
                  </option>
                  <option value="TAX">Tributos / Impostos (TAX)</option>
                  <option value="TRAVEL">Viagem / Objetivo (TRAVEL)</option>
                </select>
              </div>
              <div>
                <label className="font-bold">Meta (R$)</label>
                <input
                  type="text"
                  value={resTargetDecimal}
                  onChange={(e) => setResTargetDecimal(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 font-mono"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowReserveModal(false)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-xl bg-[#142D43] px-4 py-2 text-xs font-bold text-white"
              >
                Criar Cofre
              </button>
            </div>
          </form>
        </div>
      )}

      {reserveActionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#142D43]/60 p-4 backdrop-blur-sm">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (reserveActionModal.mode === "TRANSFER") {
                const ok = await executeAction(
                  {
                    action: "TRANSFER_RESERVE",
                    sourceReserveId: reserveActionModal.reserve.id,
                    destinationReserveId: resMoveDestId,
                    amountDecimal: resMoveAmountDecimal,
                  },
                  "Transferência virtual entre cofres realizada."
                );
                if (ok) setReserveActionModal(null);
              } else {
                const ok = await executeAction(
                  {
                    action: "ALLOCATE_OR_RELEASE_RESERVE",
                    reserveId: reserveActionModal.reserve.id,
                    movementKind: reserveActionModal.mode,
                    amountDecimal: resMoveAmountDecimal,
                    reason: resMoveReason,
                  },
                  reserveActionModal.mode === "ALLOCATE"
                    ? "Alocação virtual confirmada (sem movimentação bancária)."
                    : "Valor liberado do cofre."
                );
                if (ok) setReserveActionModal(null);
              }
            }}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
          >
            <h3 className="text-base font-extrabold text-[#142D43]">
              {reserveActionModal.mode === "ALLOCATE"
                ? `Alocar em: ${reserveActionModal.reserve.name}`
                : reserveActionModal.mode === "RELEASE"
                ? `Liberar de: ${reserveActionModal.reserve.name}`
                : `Transferir de: ${reserveActionModal.reserve.name}`}
            </h3>
            <div className="mt-2 flex items-start gap-2 rounded-xl bg-[#F4F7FA] p-3 text-[11px] text-slate-600">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#142D43]" />
              <span>
                Esta é uma operação de planejamento virtual. Não realiza
                transferência bancária nem altera o saldo contábil das contas
                P01. Capacidade segura sugerida (headroom):{" "}
                <strong>{formatBRL(kpis.headroomCents)}</strong>.
              </span>
            </div>
            <div className="mt-4 space-y-3 text-xs">
              {reserveActionModal.mode === "TRANSFER" && (
                <div>
                  <label className="font-bold">Cofre de Destino</label>
                  <select
                    value={resMoveDestId}
                    onChange={(e) => setResMoveDestId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                  >
                    {reserves
                      .filter((r) => r.id !== reserveActionModal.reserve.id)
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                  </select>
                </div>
              )}
              <div>
                <label className="font-bold">Valor (R$)</label>
                <input
                  type="text"
                  required
                  value={resMoveAmountDecimal}
                  onChange={(e) => setResMoveAmountDecimal(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 font-mono"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReserveActionModal(null)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-xl bg-[#142D43] px-4 py-2 text-xs font-bold text-white"
              >
                Confirmar Operação Virtual
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
