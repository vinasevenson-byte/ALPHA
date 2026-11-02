"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  Calculator,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
  Activity,
  PieChart,
  Link2,
  Bot,
} from "lucide-react";
import {
  centsToDecimalString,
  formatBRL,
  formatDateBR,
} from "@/domain/planning";
import {
  NovaInvestmentsP03View,
  PositionRow,
  computePortfolioSummary,
} from "@/components/NovaInvestmentsP03View";
import {
  NovaIntelligenceP04View,
  P04HealthIndexPayload,
  P04QualityPayload,
  FinancialInsightItem,
  FinancialConnectionItem,
  ImportBatchItem,
  ImportedTransactionItem,
  ConsentAuditItem,
  P04IntelSubTab,
  P04IntegrationSubTab,
} from "@/components/NovaIntelligenceP04View";

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
  | "simulacoes"
  | "inteligencia"
  | "inteligencia/alertas"
  | "inteligencia/assistente"
  | "inteligencia/saude-dados"
  | "inteligencia/diagnostico"
  | "integracoes"
  | "integracoes/conexoes"
  | "integracoes/importacoes"
  | "integracoes/conciliacao"
  | "integracoes/consentimentos"
  | "relatorios"
  | "auditoria"
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
  investmentPositions?: Array<{
    id: string;
    symbol: string;
    name: string;
    kind: PositionRow["kind"];
    institution: string;
    indexer: string;
    rateLabel: string;
    costBasisCents: number;
    currentGrossCents: number;
    daysHeld: number;
    redemptionAvailableAt: string;
    maturityDate: string;
    fgcEligible: boolean;
    quoteStatus: "VALID" | "STALE";
  }>;
  financialConnections?: FinancialConnectionItem[];
  importBatches?: ImportBatchItem[];
  importedTransactions?: ImportedTransactionItem[];
  financialInsights?: FinancialInsightItem[];
  consentAudits?: ConsentAuditItem[];
  p04Intelligence?: {
    healthIndex: P04HealthIndexPayload | null;
    quality: P04QualityPayload;
    savingsRatePct: number | null;
    featureFlags: {
      openFinanceEnabled: boolean;
      aiAssistantEnabled: boolean;
      externalMarketDataEnabled: boolean;
    };
  };
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
  const [horizonDays, setHorizonDays] = useState<number>(180);
  const [scenarioKind, setScenarioKind] = useState<
    "BASE" | "CONSERVATIVE" | "OPTIMISTIC"
  >("BASE");
  const [searchQuery, setSearchQuery] = useState("");

  // Layout Responsivo e Menu Lateral Compacto/Expansível
  const [sidebarCompact, setSidebarCompact] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [gestaoExpanded, setGestaoExpanded] = useState(true);
  const [compromissosExpanded, setCompromissosExpanded] = useState(false);
  const [planningExpanded, setPlanningExpanded] = useState(false);
  const [reservasExpanded, setReservasExpanded] = useState(false);
  const [intelExpanded, setIntelExpanded] = useState(false);
  const [integracoesExpanded, setIntegracoesExpanded] = useState(false);

  // Integração Automática com a Carteira de Investimentos (Pacote 03)
  const [investmentPositions, setInvestmentPositions] = useState<PositionRow[]>(
    []
  );

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
        if (Array.isArray(json.investmentPositions)) {
          setInvestmentPositions(
            json.investmentPositions.map(
              (pos: {
                id: string;
                symbol: string;
                name: string;
                kind: PositionRow["kind"];
                institution: string;
                indexer: string;
                rateLabel: string;
                costBasisCents: number;
                currentGrossCents: number;
                daysHeld: number;
                redemptionAvailableAt: string;
                maturityDate: string;
                fgcEligible: boolean;
                quoteStatus: "VALID" | "STALE";
              }) => ({
                id: pos.id,
                symbol: pos.symbol,
                name: pos.name,
                kind: pos.kind,
                institution: pos.institution,
                indexer: pos.indexer,
                rateLabel: pos.rateLabel,
                costBasisReais: pos.costBasisCents / 100,
                currentGrossReais: pos.currentGrossCents / 100,
                daysHeld: pos.daysHeld,
                redemptionAvailableAt: pos.redemptionAvailableAt,
                maturityDate: pos.maturityDate,
                fgcEligible: pos.fgcEligible,
                quoteStatus: pos.quoteStatus,
              })
            )
          );
        }
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
    setMobileMenuOpen(false);
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

  const activeWorkspaceType = state?.activeWorkspace.type ?? "PERSONAL";
  const p03Summary = useMemo(
    () => computePortfolioSummary(investmentPositions, activeWorkspaceType),
    [investmentPositions, activeWorkspaceType]
  );

  if (loading && !state) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F5F6FA] text-[#1E1B39]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#EFEFFD] border-t-[#6C5CE7]" />
          <p className="text-sm font-semibold text-[#1E1B39]">
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
    transactions,
    installments,
    reserves,
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
    installments.length === 0 &&
    investmentPositions.length === 0;

  // Cálculo integrado do Patrimônio Líquido e Saúde Financeira (P01 + P02 + P03)
  const netWorthCents =
    kpis.eligibleBalanceCents +
    p03Summary.totalEstimatedNetCents +
    kpis.openReceivablesCents -
    kpis.openPayablesCents;

  const healthScore = (() => {
    if (isZeroState) return null;
    if (state.p04Intelligence?.healthIndex) {
      return state.p04Intelligence.healthIndex.totalScore;
    }
    let score = 60;
    if (kpis.minForecastBalanceCents >= 0) score += 15;
    if (kpis.minForecastBalanceCents >= kpis.safetyBufferCents) score += 10;
    if (kpis.totalAllocatedReservesCents > 0) score += 8;
    if (p03Summary.totalGrossCents > 0) score += 7;
    if (alerts.some((a) => a.severity === "CRITICAL")) score -= 25;
    return Math.max(10, Math.min(100, score));
  })();

  const topPillar: "FINANCEIRO" | "PLANEJAMENTO" | "INVESTIMENTOS" =
    activeRoute === "investimentos" || activeRoute === "simulacoes"
      ? "INVESTIMENTOS"
      : activeRoute.startsWith("planejamento") ||
        activeRoute === "fluxo-de-caixa" ||
        activeRoute === "reservas" ||
        activeRoute.startsWith("inteligencia")
      ? "PLANEJAMENTO"
      : "FINANCEIRO";

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

  // Total para barra de Distribuição do Patrimônio
  const totalDistributionAbs =
    Math.max(0, kpis.eligibleBalanceCents) +
    Math.max(0, kpis.totalAllocatedReservesCents) +
    Math.max(0, p03Summary.totalEstimatedNetCents) +
    Math.max(0, kpis.openPayablesCents);

  // Renderizador do Menu Lateral (usado no Desktop e no Drawer Mobile)
  const renderSidebarNav = (isCompactMode: boolean) => (
    <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4 text-xs">
      {/* 1. Visão Geral */}
      <button
        onClick={() => navigateRoute("visao-geral")}
        title="Visão Geral"
        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 font-semibold transition ${
          activeRoute === "visao-geral"
            ? "bg-[#6C5CE7] text-white shadow-sm"
            : "text-slate-600 hover:bg-[#EFEFFD]/70 hover:text-[#6C5CE7]"
        }`}
      >
        <LayoutDashboard className="h-4 w-4 shrink-0" />
        {!isCompactMode && <span>Visão Geral</span>}
      </button>

      {/* 2. Gestão Financeira */}
      <div>
        <button
          onClick={() => {
            if (isCompactMode) {
              navigateRoute("contas");
            } else {
              setGestaoExpanded(!gestaoExpanded);
              navigateRoute("contas");
            }
          }}
          title="Gestão Financeira"
          className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 font-semibold transition ${
            activeRoute === "contas" || activeRoute === "movimentacoes"
              ? "bg-[#EFEFFD] text-[#6C5CE7]"
              : "text-slate-600 hover:bg-[#EFEFFD]/60 hover:text-[#6C5CE7]"
          }`}
        >
          <span className="flex items-center gap-3">
            <Wallet className="h-4 w-4 shrink-0" />
            {!isCompactMode && <span>Gestão Financeira</span>}
          </span>
          {!isCompactMode &&
            (gestaoExpanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            ))}
        </button>
        {!isCompactMode && gestaoExpanded && (
          <div className="ml-4 mt-1 space-y-1 border-l border-slate-200 pl-3">
            <button
              onClick={() => navigateRoute("contas")}
              className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[11px] font-medium transition ${
                activeRoute === "contas"
                  ? "bg-[#6C5CE7] font-bold text-white"
                  : "text-slate-600 hover:bg-[#EFEFFD]/60 hover:text-[#6C5CE7]"
              }`}
            >
              <span>Minhas Contas</span>
              <span className="rounded-full bg-black/10 px-1.5 py-0.2 text-[10px] tabular-nums">
                {accounts.length}
              </span>
            </button>
            <button
              onClick={() => navigateRoute("movimentacoes")}
              className={`block w-full rounded-lg px-2.5 py-1.5 text-left text-[11px] font-medium transition ${
                activeRoute === "movimentacoes"
                  ? "bg-[#6C5CE7] font-bold text-white"
                  : "text-slate-600 hover:bg-[#EFEFFD]/60 hover:text-[#6C5CE7]"
              }`}
            >
              Receitas, Despesas e Transf.
            </button>
          </div>
        )}
      </div>

      {/* 3. Contas a Pagar e Receber */}
      <div>
        <button
          onClick={() => {
            if (isCompactMode) {
              navigateRoute("contas-a-pagar");
            } else {
              setCompromissosExpanded(!compromissosExpanded);
              navigateRoute("contas-a-pagar");
            }
          }}
          title="Contas a Pagar e Receber"
          className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 font-semibold transition ${
            activeRoute === "contas-a-pagar" ||
            activeRoute === "contas-a-receber"
              ? "bg-[#EFEFFD] text-[#6C5CE7]"
              : "text-slate-600 hover:bg-[#EFEFFD]/60 hover:text-[#6C5CE7]"
          }`}
        >
          <span className="flex items-center gap-3">
            <CalendarClock className="h-4 w-4 shrink-0" />
            {!isCompactMode && <span>Contas a Pagar e Receber</span>}
          </span>
          {!isCompactMode &&
            (compromissosExpanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            ))}
        </button>
        {!isCompactMode && compromissosExpanded && (
          <div className="ml-4 mt-1 space-y-1 border-l border-slate-200 pl-3">
            <button
              onClick={() => navigateRoute("contas-a-pagar")}
              className={`block w-full rounded-lg px-2.5 py-1.5 text-left text-[11px] font-medium ${
                activeRoute === "contas-a-pagar"
                  ? "bg-[#6C5CE7] font-bold text-white"
                  : "text-slate-600 hover:bg-[#EFEFFD]/60 hover:text-[#6C5CE7]"
              }`}
            >
              Contas a Pagar
            </button>
            <button
              onClick={() => navigateRoute("contas-a-receber")}
              className={`block w-full rounded-lg px-2.5 py-1.5 text-left text-[11px] font-medium ${
                activeRoute === "contas-a-receber"
                  ? "bg-[#6C5CE7] font-bold text-white"
                  : "text-slate-600 hover:bg-[#EFEFFD]/60 hover:text-[#6C5CE7]"
              }`}
            >
              Contas a Receber
            </button>
          </div>
        )}
      </div>

      {/* 4. Fluxo de Caixa */}
      <button
        onClick={() => navigateRoute("fluxo-de-caixa")}
        title="Fluxo de Caixa"
        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 font-semibold transition ${
          activeRoute === "fluxo-de-caixa"
            ? "bg-[#6C5CE7] text-white shadow-sm"
            : "text-slate-600 hover:bg-[#EFEFFD]/70 hover:text-[#6C5CE7]"
        }`}
      >
        <LineChart className="h-4 w-4 shrink-0" />
        {!isCompactMode && <span>Fluxo de Caixa</span>}
      </button>

      {/* 5. Planejamento */}
      <div>
        <button
          onClick={() => {
            if (isCompactMode) {
              navigateRoute("planejamento");
            } else {
              setPlanningExpanded(!planningExpanded);
              navigateRoute("planejamento");
            }
          }}
          title="Planejamento"
          className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 font-semibold transition ${
            activeRoute.startsWith("planejamento") &&
            activeRoute !== "planejamento/metas"
              ? "bg-[#EFEFFD] text-[#6C5CE7]"
              : "text-slate-600 hover:bg-[#EFEFFD]/60 hover:text-[#6C5CE7]"
          }`}
        >
          <span className="flex items-center gap-3">
            <Compass className="h-4 w-4 shrink-0" />
            {!isCompactMode && <span>Planejamento</span>}
          </span>
          {!isCompactMode &&
            (planningExpanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            ))}
        </button>
        {!isCompactMode && planningExpanded && (
          <div className="ml-4 mt-1 space-y-1 border-l border-slate-200 pl-3">
            {[
              {
                key: "planejamento" as NovaRouteKey,
                label: "Visão de Planejamento",
              },
              {
                key: "planejamento/orcamentos" as NovaRouteKey,
                label: "Orçamento e Limites",
              },
              {
                key: "planejamento/calendario" as NovaRouteKey,
                label: "Calendário Financeiro",
              },
              {
                key: "planejamento/cenarios" as NovaRouteKey,
                label: "Cenários de Caixa",
              },
            ].map((sub) => (
              <button
                key={sub.key}
                onClick={() => navigateRoute(sub.key)}
                className={`block w-full rounded-lg px-2.5 py-1.5 text-left text-[11px] font-medium transition ${
                  activeRoute === sub.key
                    ? "bg-[#6C5CE7] font-bold text-white"
                    : "text-slate-600 hover:bg-[#EFEFFD]/60 hover:text-[#6C5CE7]"
                }`}
              >
                {sub.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 6. Reservas e Metas */}
      <div>
        <button
          onClick={() => {
            if (isCompactMode) {
              navigateRoute("reservas");
            } else {
              setReservasExpanded(!reservasExpanded);
              navigateRoute("reservas");
            }
          }}
          title="Reservas e Metas"
          className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 font-semibold transition ${
            activeRoute === "reservas" || activeRoute === "planejamento/metas"
              ? "bg-[#6C5CE7] text-white shadow-sm"
              : "text-slate-600 hover:bg-[#EFEFFD]/60 hover:text-[#6C5CE7]"
          }`}
        >
          <span className="flex items-center gap-3">
            <Shield className="h-4 w-4 shrink-0" />
            {!isCompactMode && <span>Reservas e Metas</span>}
          </span>
          {!isCompactMode &&
            (reservasExpanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            ))}
        </button>
        {!isCompactMode && reservasExpanded && (
          <div className="ml-4 mt-1 space-y-1 border-l border-slate-200 pl-3">
            <button
              onClick={() => navigateRoute("reservas")}
              className={`block w-full rounded-lg px-2.5 py-1.5 text-left text-[11px] font-medium ${
                activeRoute === "reservas"
                  ? "bg-[#EFEFFD] font-bold text-[#6C5CE7]"
                  : "text-slate-600 hover:bg-[#EFEFFD]/60 hover:text-[#6C5CE7]"
              }`}
            >
              Cofres e Capacidade (P02)
            </button>
            <button
              onClick={() => navigateRoute("planejamento/metas")}
              className={`block w-full rounded-lg px-2.5 py-1.5 text-left text-[11px] font-medium ${
                activeRoute === "planejamento/metas"
                  ? "bg-[#EFEFFD] font-bold text-[#6C5CE7]"
                  : "text-slate-600 hover:bg-[#EFEFFD]/60 hover:text-[#6C5CE7]"
              }`}
            >
              Metas Financeiras
            </button>
          </div>
        )}
      </div>

      {/* 7. Investimentos */}
      <button
        onClick={() => navigateRoute("investimentos")}
        title="Investimentos"
        className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 font-semibold transition ${
          activeRoute === "investimentos"
            ? "bg-[#6C5CE7] text-white shadow-sm"
            : "text-slate-600 hover:bg-[#EFEFFD]/70 hover:text-[#6C5CE7]"
        }`}
      >
        <span className="flex items-center gap-3">
          <Layers className="h-4 w-4 shrink-0" />
          {!isCompactMode && <span>Investimentos</span>}
        </span>
        {!isCompactMode && (
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
              activeRoute === "investimentos"
                ? "bg-white/20 text-white"
                : "bg-[#EFEFFD] text-[#6C5CE7]"
            }`}
          >
            P03
          </span>
        )}
      </button>

      {/* 8. Simulações */}
      <button
        onClick={() => navigateRoute("simulacoes")}
        title="Simulações"
        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 font-semibold transition ${
          activeRoute === "simulacoes"
            ? "bg-[#6C5CE7] text-white shadow-sm"
            : "text-slate-600 hover:bg-[#EFEFFD]/70 hover:text-[#6C5CE7]"
        }`}
      >
        <Calculator className="h-4 w-4 shrink-0" />
        {!isCompactMode && <span>Simulações</span>}
      </button>

      {/* 9. Inteligência Financeira (Pacote 04) */}
      <div>
        <button
          onClick={() => {
            if (isCompactMode) {
              navigateRoute("inteligencia");
            } else {
              setIntelExpanded(!intelExpanded);
              navigateRoute("inteligencia");
            }
          }}
          title="Inteligência Financeira"
          className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 font-semibold transition ${
            activeRoute.startsWith("inteligencia")
              ? "bg-[#6C5CE7] text-white shadow-sm"
              : "text-slate-600 hover:bg-[#EFEFFD]/60 hover:text-[#6C5CE7]"
          }`}
        >
          <span className="flex items-center gap-3">
            <Sparkles className="h-4 w-4 shrink-0" />
            {!isCompactMode && <span>Inteligência Financeira</span>}
          </span>
          {!isCompactMode &&
            (intelExpanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            ))}
        </button>
        {!isCompactMode && intelExpanded && (
          <div className="ml-4 mt-1 space-y-1 border-l border-slate-200 pl-3">
            <button
              onClick={() => navigateRoute("inteligencia")}
              className={`block w-full rounded-lg px-2.5 py-1.5 text-left text-[11px] font-medium ${
                activeRoute === "inteligencia" ||
                activeRoute === "inteligencia/diagnostico"
                  ? "bg-[#EFEFFD] font-bold text-[#6C5CE7]"
                  : "text-slate-600 hover:bg-[#EFEFFD]/60 hover:text-[#6C5CE7]"
              }`}
            >
              Saúde Financeira &amp; Insights
            </button>
            <button
              onClick={() => navigateRoute("inteligencia/alertas")}
              className={`block w-full rounded-lg px-2.5 py-1.5 text-left text-[11px] font-medium ${
                activeRoute === "inteligencia/alertas"
                  ? "bg-[#EFEFFD] font-bold text-[#6C5CE7]"
                  : "text-slate-600 hover:bg-[#EFEFFD]/60 hover:text-[#6C5CE7]"
              }`}
            >
              Central de Alertas ({alerts.length})
            </button>
            <button
              onClick={() => navigateRoute("inteligencia/assistente")}
              className={`block w-full rounded-lg px-2.5 py-1.5 text-left text-[11px] font-medium ${
                activeRoute === "inteligencia/assistente"
                  ? "bg-[#EFEFFD] font-bold text-[#6C5CE7]"
                  : "text-slate-600 hover:bg-[#EFEFFD]/60 hover:text-[#6C5CE7]"
              }`}
            >
              Assistente IA Contextual
            </button>
            <button
              onClick={() => navigateRoute("inteligencia/saude-dados")}
              className={`block w-full rounded-lg px-2.5 py-1.5 text-left text-[11px] font-medium ${
                activeRoute === "inteligencia/saude-dados"
                  ? "bg-[#EFEFFD] font-bold text-[#6C5CE7]"
                  : "text-slate-600 hover:bg-[#EFEFFD]/60 hover:text-[#6C5CE7]"
              }`}
            >
              Qualidade dos Dados
            </button>
          </div>
        )}
      </div>

      {/* 10. Integrações Bancárias & Conciliação (Pacote 04) */}
      <div>
        <button
          onClick={() => {
            if (isCompactMode) {
              navigateRoute("integracoes");
            } else {
              setIntegracoesExpanded(!integracoesExpanded);
              navigateRoute("integracoes");
            }
          }}
          title="Integrações & Open Finance"
          className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 font-semibold transition ${
            activeRoute.startsWith("integracoes")
              ? "bg-[#6C5CE7] text-white shadow-sm"
              : "text-slate-600 hover:bg-[#EFEFFD]/60 hover:text-[#6C5CE7]"
          }`}
        >
          <span className="flex items-center gap-3">
            <Link2 className="h-4 w-4 shrink-0" />
            {!isCompactMode && <span>Integrações (P04)</span>}
          </span>
          {!isCompactMode &&
            (integracoesExpanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            ))}
        </button>
        {!isCompactMode && integracoesExpanded && (
          <div className="ml-4 mt-1 space-y-1 border-l border-slate-200 pl-3">
            <button
              onClick={() => navigateRoute("integracoes/conexoes")}
              className={`block w-full rounded-lg px-2.5 py-1.5 text-left text-[11px] font-medium ${
                activeRoute === "integracoes" ||
                activeRoute === "integracoes/conexoes"
                  ? "bg-[#EFEFFD] font-bold text-[#6C5CE7]"
                  : "text-slate-600 hover:bg-[#EFEFFD]/60 hover:text-[#6C5CE7]"
              }`}
            >
              Conexões Open Finance
            </button>
            <button
              onClick={() => navigateRoute("integracoes/importacoes")}
              className={`block w-full rounded-lg px-2.5 py-1.5 text-left text-[11px] font-medium ${
                activeRoute === "integracoes/importacoes"
                  ? "bg-[#EFEFFD] font-bold text-[#6C5CE7]"
                  : "text-slate-600 hover:bg-[#EFEFFD]/60 hover:text-[#6C5CE7]"
              }`}
            >
              Importar Extrato CSV/OFX
            </button>
            <button
              onClick={() => navigateRoute("integracoes/conciliacao")}
              className={`block w-full rounded-lg px-2.5 py-1.5 text-left text-[11px] font-medium ${
                activeRoute === "integracoes/conciliacao"
                  ? "bg-[#EFEFFD] font-bold text-[#6C5CE7]"
                  : "text-slate-600 hover:bg-[#EFEFFD]/60 hover:text-[#6C5CE7]"
              }`}
            >
              Fila de Conciliação
            </button>
            <button
              onClick={() => navigateRoute("integracoes/consentimentos")}
              className={`block w-full rounded-lg px-2.5 py-1.5 text-left text-[11px] font-medium ${
                activeRoute === "integracoes/consentimentos"
                  ? "bg-[#EFEFFD] font-bold text-[#6C5CE7]"
                  : "text-slate-600 hover:bg-[#EFEFFD]/60 hover:text-[#6C5CE7]"
              }`}
            >
              Consentimentos LGPD
            </button>
          </div>
        )}
      </div>

      {/* 11. Relatórios */}
      <button
        onClick={() => navigateRoute("relatorios")}
        title="Relatórios"
        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 font-semibold transition ${
          activeRoute === "relatorios"
            ? "bg-[#6C5CE7] text-white shadow-sm"
            : "text-slate-600 hover:bg-[#EFEFFD]/70 hover:text-[#6C5CE7]"
        }`}
      >
        <FileBarChart2 className="h-4 w-4 shrink-0" />
        {!isCompactMode && <span>Relatórios</span>}
      </button>

      {/* 12. Administração & Auditoria */}
      <button
        onClick={() => navigateRoute("configuracoes")}
        title="Administração"
        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 font-semibold transition ${
          activeRoute === "configuracoes" || activeRoute === "auditoria"
            ? "bg-[#6C5CE7] text-white shadow-sm"
            : "text-slate-600 hover:bg-[#EFEFFD]/70 hover:text-[#6C5CE7]"
        }`}
      >
        <Settings className="h-4 w-4 shrink-0" />
        {!isCompactMode && <span>Administração &amp; Auditoria</span>}
      </button>
    </nav>
  );

  return (
    <div className="flex min-h-screen bg-[#F5F6FA] pb-16 text-[#1E1B39] lg:pb-0">
      {/* =====================================================================
          SIDEBAR OFICIAL NOVA — PADRÃO GLOBAL PREDICTIONS (VISUAL CLARO + ROXO)
         ===================================================================== */}
      <aside
        className={`hidden shrink-0 flex-col border-r border-slate-200/80 bg-white transition-all duration-200 lg:flex ${
          sidebarCompact ? "w-20" : "w-64"
        }`}
      >
        {/* Identidade da Marca NOVA */}
        <div className="flex items-center justify-between border-b border-slate-100 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#6C5CE7] to-[#5849BE] font-black text-white shadow-sm">
              N
            </div>
            {!sidebarCompact && (
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-base font-extrabold tracking-tight text-[#1E1B39]">
                    NOVA
                  </span>
                  <span className="rounded-full bg-[#EFEFFD] px-2 py-0.5 text-[10px] font-bold text-[#6C5CE7]">
                    v4.0
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Portfolio &amp; Intelligence
                </p>
              </div>
            )}
          </div>
          <button
            onClick={() => setSidebarCompact(!sidebarCompact)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-[#F5F6FA] hover:text-[#6C5CE7]"
            title={sidebarCompact ? "Expandir menu" : "Recolher menu"}
          >
            {sidebarCompact ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Taxonomia Oficial dos 11 Menus */}
        {renderSidebarNav(sidebarCompact)}

        {/* Rodapé da Sidebar */}
        {!sidebarCompact && (
          <div className="border-t border-slate-100 p-4 text-[11px] text-slate-500">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[#1E1B39]">Perfil RBAC:</span>
              <span className="rounded-md bg-[#EFEFFD] px-2 py-0.5 font-mono text-[10px] font-bold text-[#6C5CE7]">
                {currentRole}
              </span>
            </div>
            <p className="mt-1 text-[10px] text-slate-400">
              {activeWorkspace.baseCurrency} • {activeWorkspace.timezone}
            </p>
          </div>
        )}
      </aside>

      {/* Drawer Mobile */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-[#1E1B39]/40 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative z-10 flex w-72 flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 p-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#6C5CE7] font-black text-white">
                  N
                </div>
                <span className="text-base font-extrabold text-[#1E1B39]">
                  NOVA
                </span>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg p-1.5 text-slate-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {renderSidebarNav(false)}
          </div>
        </div>
      )}

      {/* =====================================================================
          CONTEÚDO PRINCIPAL (FUNDO CINZA SUAVE #F5F6FA + CARTÕES BRANCOS)
         ===================================================================== */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar Oficial NOVA com Alternância Financeiro | Planejamento | Investimentos */}
        <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
          <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3">
            {/* Esquerda: Menu Mobile + Alternância Superior (Financeiro, Planejamento, Investimentos) + Seletor PF/PJ */}
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="rounded-xl border border-slate-200 bg-[#F5F6FA] p-2 text-[#1E1B39] lg:hidden"
                aria-label="Abrir menu"
              >
                <Menu className="h-4 w-4" />
              </button>

              {/* Navegação Superior Oficial: Alternância entre Financeiro, Planejamento e Investimentos */}
              <div className="inline-flex rounded-xl bg-[#F5F6FA] p-1 ring-1 ring-slate-200/80">
                {[
                  {
                    id: "FINANCEIRO",
                    label: "Financeiro",
                    target: "visao-geral" as NovaRouteKey,
                  },
                  {
                    id: "PLANEJAMENTO",
                    label: "Planejamento",
                    target: "planejamento" as NovaRouteKey,
                  },
                  {
                    id: "INVESTIMENTOS",
                    label: "Investimentos",
                    target: "investimentos" as NovaRouteKey,
                  },
                ].map((tab) => {
                  const active = topPillar === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => navigateRoute(tab.target)}
                      className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
                        active
                          ? "bg-[#6C5CE7] text-white shadow-xs"
                          : "text-slate-600 hover:text-[#6C5CE7]"
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Seletor Pessoal vs Empresarial */}
              <div className="inline-flex rounded-xl bg-[#F5F6FA] p-1 ring-1 ring-slate-200/80">
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
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                        active
                          ? "bg-white text-[#6C5CE7] shadow-xs"
                          : "text-slate-500 hover:text-[#1E1B39]"
                      }`}
                    >
                      {ws.type === "BUSINESS" ? (
                        <Building2 className="h-3.5 w-3.5 text-[#6C5CE7]" />
                      ) : (
                        <User className="h-3.5 w-3.5 text-[#6C5CE7]" />
                      )}
                      <span>
                        {ws.type === "BUSINESS" ? "Empresarial" : "Pessoal"}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Seletor de Horizonte (Incluindo Próximos 6 meses = 180d) */}
              <div className="hidden items-center gap-1 rounded-xl bg-[#F5F6FA] p-1 text-xs ring-1 ring-slate-200/80 xl:inline-flex">
                {[
                  { days: 30, label: "30 dias" },
                  { days: 90, label: "90 dias" },
                  { days: 180, label: "6 meses" },
                  { days: 365, label: "12 meses" },
                ].map((h) => (
                  <button
                    key={h.days}
                    onClick={() => setHorizonDays(h.days)}
                    className={`rounded-lg px-2.5 py-1 font-semibold transition ${
                      horizonDays === h.days
                        ? "bg-white text-[#6C5CE7] shadow-xs"
                        : "text-slate-500 hover:text-[#1E1B39]"
                    }`}
                  >
                    {h.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Direita: Pesquisa, Homologação P01+P02+P03, Alertas e Ações */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative hidden md:block">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Pesquisar na NOVA..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-44 rounded-xl border border-slate-200/80 bg-[#F5F6FA] py-1.5 pl-8 pr-3 text-xs text-[#1E1B39] focus:border-[#6C5CE7] focus:bg-white focus:outline-none"
                />
              </div>

              {/* Botão de Homologação Integrada (P01 + P02 + P03 + P04) ou Zerar */}
              {isZeroState ? (
                <button
                  onClick={async () => {
                    await executeAction(
                      { action: "LOAD_P02_FIXTURE" },
                      "Ambiente de homologação carregado (P01 Financeiro + P02 Planejamento + P03 Investimentos + P04 Inteligência & Open Finance)."
                    );
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#6C5CE7]/25 bg-[#EFEFFD] px-3 py-1.5 text-xs font-bold text-[#6C5CE7] transition hover:bg-[#6C5CE7]/15"
                  title="Carrega dados de teste integrados dos Pacotes 01, 02, 03 e 04 no banco de dados"
                >
                  <Beaker className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Carregar Dados de Teste</span>
                </button>
              ) : (
                <button
                  onClick={async () => {
                    await executeAction(
                      { action: "RESET_TO_ZERO" },
                      "Workspace retornado ao estado inicial zerado (R$ 0,00)."
                    );
                    setInvestmentPositions([]);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  title="Voltar ao estado inicial sem dados cadastrados (R$ 0,00 / —)"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Zerar (R$ 0,00)</span>
                </button>
              )}

              <button
                onClick={() => navigateRoute("inteligencia/alertas")}
                className="relative rounded-xl border border-slate-200/80 bg-[#F5F6FA] p-2 text-[#1E1B39] hover:border-[#6C5CE7]/40"
                title="Recomendações e Alertas"
              >
                <Bell className="h-4 w-4" />
                {alerts.length > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#6C5CE7] text-[10px] font-extrabold text-white">
                    {alerts.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => {
                  if (accounts.length === 0) {
                    setShowAccountModal(true);
                  } else {
                    setShowTxModal(true);
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#6C5CE7] px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition hover:bg-[#5849BE]"
              >
                <Plus className="h-3.5 w-3.5" />
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
        <div className="mx-auto w-full max-w-[1440px] px-4 pt-4 sm:px-6">
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
              className="mb-4 flex items-center justify-between rounded-xl border border-violet-200 bg-[#EFEFFD] px-4 py-3 text-xs font-medium text-[#1E1B39]"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#6C5CE7]" />
                <span>{bannerSuccess}</span>
              </div>
              <button
                onClick={() => setBannerSuccess(null)}
                className="font-bold text-[#6C5CE7]"
              >
                ✕
              </button>
            </div>
          )}
        </div>

        {/* Área Principal Max-Width 1440px */}
        <main className="mx-auto w-full max-w-[1440px] flex-1 space-y-6 px-4 py-4 sm:px-6">
          {/* =================================================================
              TELA 1: VISÃO GERAL — ESTRUTURA OFICIAL NOVA (GLOBAL PREDICTIONS)
             ================================================================= */}
          {activeRoute === "visao-geral" && (
            <div className="space-y-6">
              {/* Cabeçalho do Dashboard Principal */}
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-[#EFEFFD] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#6C5CE7]">
                      NOVA • Visão Geral Consolidada
                    </span>
                    <span className="text-xs text-slate-500">
                      {isPJ ? "Ambiente Empresarial (PJ)" : "Ambiente Pessoal (PF)"}
                    </span>
                  </div>
                  <h1 className="mt-1 text-2xl font-extrabold text-[#1E1B39]">
                    {activeWorkspace.name}
                  </h1>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <button
                    onClick={() => setShowObligationModal(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 font-semibold text-[#1E1B39] hover:border-[#6C5CE7]"
                  >
                    <Plus className="h-3.5 w-3.5 text-[#6C5CE7]" />
                    <span>Novo Compromisso</span>
                  </button>
                  <select
                    value={scenarioKind}
                    onChange={(e) =>
                      setScenarioKind(
                        e.target.value as "BASE" | "CONSERVATIVE" | "OPTIMISTIC"
                      )
                    }
                    className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 font-semibold text-[#1E1B39]"
                  >
                    <option value="BASE">Cenário Base (Confirmado)</option>
                    <option value="CONSERVATIVE">Conservador (+Buffer)</option>
                    <option value="OPTIMISTIC">Otimista</option>
                  </select>
                </div>
              </div>

              {/* =============================================================
                  SEÇÃO 3 DO MODELO OFICIAL: 3 CARTÕES DE INDICADORES PRINCIPAIS
                  1. Saúde Financeira ("—" | Índice calculado)
                  2. Patrimônio Líquido ("R$ 0,00" | Consolidado)
                  3. Projeção Financeira ("—" | Próximos 6 meses)
                 ============================================================= */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {/* Cartão 1: Saúde Financeira */}
                <div
                  onClick={() => navigateRoute("inteligencia/diagnostico")}
                  className="cursor-pointer rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs transition hover:border-[#6C5CE7]/50 hover:shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Saúde Financeira
                    </span>
                    <span className="rounded-xl bg-[#EFEFFD] p-2 text-[#6C5CE7]">
                      <Activity className="h-4 w-4" />
                    </span>
                  </div>
                  <div className="mt-3 font-mono text-3xl font-black tabular-nums text-[#1E1B39]">
                    {healthScore === null ? "—" : `${healthScore}/100`}
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-xs text-slate-500">
                    <span>Índice calculado</span>
                    {healthScore !== null && (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">
                        {healthScore >= 80
                          ? "Excelente"
                          : healthScore >= 60
                          ? "Estável"
                          : "Atenção"}
                      </span>
                    )}
                  </div>
                </div>

                {/* Cartão 2: Patrimônio Líquido */}
                <div
                  onClick={() => navigateRoute("contas")}
                  className="cursor-pointer rounded-2xl border border-[#6C5CE7]/25 bg-gradient-to-br from-[#6C5CE7] to-[#5849BE] p-6 text-white shadow-sm transition hover:shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-violet-100">
                      Patrimônio Líquido
                    </span>
                    <span className="rounded-xl bg-white/15 p-2 text-white">
                      <Wallet className="h-4 w-4" />
                    </span>
                  </div>
                  <div className="mt-3 font-mono text-3xl font-black tabular-nums text-white">
                    {formatBRL(netWorthCents)}
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-xs text-violet-100">
                    <span>Consolidado</span>
                    <span>
                      Caixa: {formatBRL(kpis.eligibleBalanceCents)} • Inv:{" "}
                      {formatBRL(p03Summary.totalEstimatedNetCents)}
                    </span>
                  </div>
                </div>

                {/* Cartão 3: Projeção Financeira */}
                <div
                  onClick={() => navigateRoute("fluxo-de-caixa")}
                  className="cursor-pointer rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs transition hover:border-[#6C5CE7]/50 hover:shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Projeção Financeira
                    </span>
                    <span className="rounded-xl bg-[#EFEFFD] p-2 text-[#6C5CE7]">
                      <LineChart className="h-4 w-4" />
                    </span>
                  </div>
                  <div className="mt-3 font-mono text-3xl font-black tabular-nums text-[#1E1B39]">
                    {isZeroState
                      ? "—"
                      : formatBRL(kpis.projectedEndBalanceCents)}
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-xs text-slate-500">
                    <span>Próximos 6 meses</span>
                    {!isZeroState && (
                      <span className="font-mono text-[11px] font-semibold text-[#6C5CE7]">
                        Pmin: {formatBRL(kpis.minForecastBalanceCents)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* =============================================================
                  CENTRO DO DASHBOARD: EVOLUÇÃO FINANCEIRA + RECOMENDAÇÕES
                 ============================================================= */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                {/* Gráfico Central: Evolução Financeira (Fluxo de Caixa e Evolução Patrimonial) */}
                <div className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs lg:col-span-8">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
                    <div>
                      <h2 className="text-base font-extrabold text-[#1E1B39]">
                        Evolução Financeira
                      </h2>
                      <p className="text-xs text-slate-500">
                        Fluxo de caixa projetado, entradas, saídas e evolução
                        patrimonial consolidada
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => navigateRoute("fluxo-de-caixa")}
                        className="rounded-xl bg-[#EFEFFD] px-3 py-1.5 text-xs font-bold text-[#6C5CE7] hover:bg-[#6C5CE7] hover:text-white"
                      >
                        Ver Fluxo Completo →
                      </button>
                    </div>
                  </div>

                  {isZeroState ? (
                    <div className="flex flex-col items-center justify-center py-14 text-center">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EFEFFD] text-[#6C5CE7]">
                        <LineChart className="h-7 w-7" />
                      </div>
                      <h3 className="mt-3 text-sm font-extrabold text-[#1E1B39]">
                        Aguardando dados financeiros
                      </h3>
                      <p className="mt-1 max-w-md text-xs text-slate-500">
                        Nenhuma métrica fictícia é exibida. Cadastre sua
                        primeira conta bancária ou carregue o cenário de
                        homologação para visualizar a evolução patrimonial.
                      </p>
                      <div className="mt-5 flex flex-wrap justify-center gap-2.5">
                        <button
                          onClick={() => setShowAccountModal(true)}
                          className="rounded-xl bg-[#6C5CE7] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#5849BE]"
                        >
                          Cadastrar Primeira Conta
                        </button>
                        <button
                          onClick={async () => {
                            await executeAction(
                              { action: "LOAD_P02_FIXTURE" },
                              "Ambiente de homologação carregado (P01 + P02 + P03 + P04)."
                            );
                          }}
                          className="rounded-xl border border-slate-200 bg-[#F5F6FA] px-4 py-2 text-xs font-semibold text-[#1E1B39] hover:border-[#6C5CE7]"
                        >
                          Carregar Cenário Homologado (P01+P02+P03+P04)
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-5 space-y-4">
                      {/* Barra Visual de Evolução Temporal estilo Global Predictions */}
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <div className="rounded-xl bg-[#F5F6FA] p-3">
                          <span className="text-[11px] text-slate-500">
                            Saldo em Contas (S)
                          </span>
                          <div className="mt-0.5 font-mono text-sm font-extrabold text-[#1E1B39]">
                            {formatBRL(kpis.eligibleBalanceCents)}
                          </div>
                        </div>
                        <div className="rounded-xl bg-[#F5F6FA] p-3">
                          <span className="text-[11px] text-slate-500">
                            {isPJ ? "Recebimentos" : "Receitas Realizadas"}
                          </span>
                          <div className="mt-0.5 font-mono text-sm font-extrabold text-emerald-600">
                            +{formatBRL(kpis.settledIncomeCents)}
                          </div>
                        </div>
                        <div className="rounded-xl bg-[#F5F6FA] p-3">
                          <span className="text-[11px] text-slate-500">
                            Despesas Realizadas
                          </span>
                          <div className="mt-0.5 font-mono text-sm font-extrabold text-rose-600">
                            -{formatBRL(kpis.settledExpenseCents)}
                          </div>
                        </div>
                        <div className="rounded-xl bg-[#EFEFFD] p-3">
                          <span className="text-[11px] font-bold text-[#6C5CE7]">
                            Capacidade de Reserva
                          </span>
                          <div className="mt-0.5 font-mono text-sm font-black text-[#6C5CE7]">
                            {formatBRL(kpis.headroomCents)}
                          </div>
                        </div>
                      </div>

                      {/* Série Visual de Pontos Relevantes do Fluxo de Caixa */}
                      <div className="space-y-2">
                        {forecastSeries
                          .filter(
                            (pt, idx) =>
                              idx === 0 ||
                              pt.inboundCents > 0 ||
                              pt.outboundCents > 0 ||
                              idx === forecastSeries.length - 1
                          )
                          .slice(0, 7)
                          .map((pt, i) => {
                            const maxRef = Math.max(
                              1,
                              kpis.eligibleBalanceCents,
                              pt.endingCents
                            );
                            const barPct = Math.max(
                              8,
                              Math.min(
                                100,
                                Math.round((pt.endingCents / maxRef) * 100)
                              )
                            );
                            return (
                              <div
                                key={pt.date}
                                className="rounded-xl bg-[#F5F6FA] p-3 text-xs"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2.5">
                                    <span className="font-mono font-bold text-[#1E1B39]">
                                      {i === 0
                                        ? `Hoje (${formatDateBR(pt.date)})`
                                        : formatDateBR(pt.date)}
                                    </span>
                                    {pt.inboundCents > 0 && (
                                      <span className="rounded-md bg-emerald-100 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-800">
                                        +{formatBRL(pt.inboundCents)}
                                      </span>
                                    )}
                                    {pt.outboundCents > 0 && (
                                      <span className="rounded-md bg-rose-100 px-2 py-0.5 font-mono text-[10px] font-bold text-rose-800">
                                        -{formatBRL(pt.outboundCents)}
                                      </span>
                                    )}
                                  </div>
                                  <span className="font-mono font-extrabold tabular-nums text-[#6C5CE7]">
                                    {formatBRL(pt.endingCents)}
                                  </span>
                                </div>
                                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                                  <div
                                    style={{ width: `${barPct}%` }}
                                    className="h-full rounded-full bg-[#6C5CE7]"
                                  />
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Painel Direito: Recomendações (Alertas de caixa, Oportunidades de reserva, Análise de investimentos) */}
                <div className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs lg:col-span-4">
                  <div>
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                      <div className="flex items-center gap-2">
                        <span className="rounded-xl bg-[#EFEFFD] p-2 text-[#6C5CE7]">
                          <Sparkles className="h-4 w-4" />
                        </span>
                        <div>
                          <h2 className="text-base font-extrabold text-[#1E1B39]">
                            Recomendações
                          </h2>
                          <p className="text-[11px] text-slate-500">
                            Inteligência financeira e oportunidades
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 space-y-3">
                      {/* Bloco 1: Alertas de caixa */}
                      <div
                        onClick={() => navigateRoute("inteligencia/alertas")}
                        className="cursor-pointer rounded-xl border border-slate-200/80 bg-[#F5F6FA] p-4 transition hover:border-[#6C5CE7] hover:bg-white"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-extrabold text-[#1E1B39]">
                            Alertas de caixa
                          </span>
                          <span className="rounded-full bg-[#EFEFFD] px-2 py-0.5 text-[10px] font-bold text-[#6C5CE7]">
                            {alerts.length} ativo(s)
                          </span>
                        </div>
                        <p className="mt-1.5 text-xs text-slate-600">
                          {isZeroState
                            ? "Sem alertas de liquidez. Cadastre compromissos para monitorar vencimentos."
                            : alerts.length > 0
                            ? alerts[0].message
                            : `Fluxo positivo no horizonte. Menor saldo projetado: ${formatBRL(
                                kpis.minForecastBalanceCents
                              )}.`}
                        </p>
                      </div>

                      {/* Bloco 2: Oportunidades de reserva */}
                      <div
                        onClick={() => navigateRoute("reservas")}
                        className="cursor-pointer rounded-xl border border-slate-200/80 bg-[#F5F6FA] p-4 transition hover:border-[#6C5CE7] hover:bg-white"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-extrabold text-[#1E1B39]">
                            Oportunidades de reserva
                          </span>
                          <span className="font-mono text-xs font-bold text-[#6C5CE7]">
                            {formatBRL(kpis.headroomCents)}
                          </span>
                        </div>
                        <p className="mt-1.5 text-xs text-slate-600">
                          {isZeroState
                            ? "Aguardando lançamentos para calcular sua margem segura de reserva (P02)."
                            : `Você pode alocar até ${formatBRL(
                                kpis.headroomCents
                              )} em cofres preservando sua margem de segurança de ${formatBRL(
                                kpis.safetyBufferCents
                              )}.`}
                        </p>
                      </div>

                      {/* Bloco 3: Análise de investimentos */}
                      <div
                        onClick={() => navigateRoute("investimentos")}
                        className="cursor-pointer rounded-xl border border-slate-200/80 bg-[#F5F6FA] p-4 transition hover:border-[#6C5CE7] hover:bg-white"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-extrabold text-[#1E1B39]">
                            Análise de investimentos
                          </span>
                          <span className="rounded-full bg-[#EFEFFD] px-2 py-0.5 text-[10px] font-bold text-[#6C5CE7]">
                            Comparador P03
                          </span>
                        </div>
                        <p className="mt-1.5 text-xs text-slate-600">
                          {investmentPositions.length === 0
                            ? "Compare CDB, LCI/LCA e Tesouro Selic líquidos de IR ou registre sua carteira."
                            : `Carteira ativa de ${formatBRL(
                                p03Summary.totalGrossCents
                              )} com retorno bruto de +${
                                p03Summary.returnPct
                              }%.`}
                        </p>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => navigateRoute("simulacoes")}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#6C5CE7] py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-[#5849BE]"
                  >
                    <Calculator className="h-4 w-4" />
                    <span>Abrir Simulador Patrimonial</span>
                  </button>
                </div>
              </div>

              {/* =============================================================
                  DISTRIBUIÇÃO DO PATRIMÔNIO (CONTAS, RESERVAS, INVESTIMENTOS E OBRIGAÇÕES)
                 ============================================================= */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-2.5">
                    <span className="rounded-xl bg-[#EFEFFD] p-2 text-[#6C5CE7]">
                      <PieChart className="h-4 w-4" />
                    </span>
                    <div>
                      <h2 className="text-base font-extrabold text-[#1E1B39]">
                        Distribuição do Patrimônio
                      </h2>
                      <p className="text-xs text-slate-500">
                        Contas bancárias, reservas, investimentos e obrigações
                      </p>
                    </div>
                  </div>

                  <span className="text-xs font-semibold text-slate-500">
                    Composição integrada em tempo real (P01 + P02 + P03)
                  </span>
                </div>

                {/* Barra de Proporção Visual */}
                <div className="mt-4 flex h-3 w-full overflow-hidden rounded-full bg-[#F5F6FA]">
                  {totalDistributionAbs === 0 ? (
                    <div className="h-full w-full bg-slate-200" />
                  ) : (
                    <>
                      <div
                        style={{
                          width: `${
                            (Math.max(0, kpis.eligibleBalanceCents) /
                              totalDistributionAbs) *
                            100
                          }%`,
                        }}
                        className="h-full bg-[#6C5CE7]"
                        title="Contas Bancárias"
                      />
                      <div
                        style={{
                          width: `${
                            (Math.max(0, kpis.totalAllocatedReservesCents) /
                              totalDistributionAbs) *
                            100
                          }%`,
                        }}
                        className="h-full bg-[#A29BFE]"
                        title="Reservas"
                      />
                      <div
                        style={{
                          width: `${
                            (Math.max(0, p03Summary.totalEstimatedNetCents) /
                              totalDistributionAbs) *
                            100
                          }%`,
                        }}
                        className="h-full bg-emerald-500"
                        title="Investimentos"
                      />
                      <div
                        style={{
                          width: `${
                            (Math.max(0, kpis.openPayablesCents) /
                              totalDistributionAbs) *
                            100
                          }%`,
                        }}
                        className="h-full bg-amber-500"
                        title="Obrigações"
                      />
                    </>
                  )}
                </div>

                {/* 4 Blocos Clicáveis da Distribuição */}
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div
                    onClick={() => navigateRoute("contas")}
                    className="cursor-pointer rounded-xl border border-slate-200/80 bg-[#F5F6FA] p-4 transition hover:border-[#6C5CE7] hover:bg-white"
                  >
                    <div className="flex items-center gap-2 text-xs font-bold text-[#1E1B39]">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#6C5CE7]" />
                      <span>Contas bancárias</span>
                    </div>
                    <div className="mt-2 font-mono text-xl font-extrabold tabular-nums text-[#1E1B39]">
                      {formatBRL(kpis.eligibleBalanceCents)}
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {accounts.length} conta(s) cadastrada(s)
                    </p>
                  </div>

                  <div
                    onClick={() => navigateRoute("reservas")}
                    className="cursor-pointer rounded-xl border border-slate-200/80 bg-[#F5F6FA] p-4 transition hover:border-[#6C5CE7] hover:bg-white"
                  >
                    <div className="flex items-center gap-2 text-xs font-bold text-[#1E1B39]">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#A29BFE]" />
                      <span>Reservas</span>
                    </div>
                    <div className="mt-2 font-mono text-xl font-extrabold tabular-nums text-[#1E1B39]">
                      {formatBRL(kpis.totalAllocatedReservesCents)}
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {reserves.length} cofre(s) • Capacidade:{" "}
                      {formatBRL(kpis.headroomCents)}
                    </p>
                  </div>

                  <div
                    onClick={() => navigateRoute("investimentos")}
                    className="cursor-pointer rounded-xl border border-slate-200/80 bg-[#F5F6FA] p-4 transition hover:border-[#6C5CE7] hover:bg-white"
                  >
                    <div className="flex items-center gap-2 text-xs font-bold text-[#1E1B39]">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                      <span>Investimentos</span>
                    </div>
                    <div className="mt-2 font-mono text-xl font-extrabold tabular-nums text-[#1E1B39]">
                      {formatBRL(p03Summary.totalEstimatedNetCents)}
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {investmentPositions.length} posição(ões) ativa(s)
                    </p>
                  </div>

                  <div
                    onClick={() => navigateRoute("contas-a-pagar")}
                    className="cursor-pointer rounded-xl border border-slate-200/80 bg-[#F5F6FA] p-4 transition hover:border-[#6C5CE7] hover:bg-white"
                  >
                    <div className="flex items-center gap-2 text-xs font-bold text-[#1E1B39]">
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                      <span>Obrigações</span>
                    </div>
                    <div className="mt-2 font-mono text-xl font-extrabold tabular-nums text-[#1E1B39]">
                      {formatBRL(kpis.openPayablesCents)}
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">
                      A receber previsto: {formatBRL(kpis.openReceivablesCents)}
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
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
                <div>
                  <h2 className="text-lg font-extrabold text-[#1E1B39]">
                    Contas e Carteiras ({activeWorkspace.name})
                  </h2>
                  <p className="text-xs text-slate-500">
                    Invariante P01: Saldo atual = saldo inicial + receitas
                    liquidadas − despesas liquidadas ± transferências liquidadas.
                  </p>
                </div>
                <button
                  onClick={() => setShowAccountModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#6C5CE7] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#5849BE]"
                >
                  <Plus className="h-4 w-4" />
                  Nova Conta
                </button>
              </div>

              {accounts.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
                  <Wallet className="mx-auto h-8 w-8 text-[#6C5CE7]" />
                  <h3 className="mt-2 text-sm font-bold text-[#1E1B39]">
                    Cadastre sua primeira conta
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Uma conta recém-criada sem saldo inicial começa exatamente em
                    R$ 0,00.
                  </p>
                  <button
                    onClick={() => setShowAccountModal(true)}
                    className="mt-4 rounded-xl bg-[#6C5CE7] px-4 py-2 text-xs font-bold text-white"
                  >
                    Criar Conta Agora
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  {accounts.map((acc) => (
                    <div
                      key={acc.id}
                      className={`rounded-2xl border bg-white p-5 shadow-xs ${
                        acc.status === "ARCHIVED"
                          ? "border-slate-200 opacity-60"
                          : "border-slate-200/80"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="rounded-full bg-[#EFEFFD] px-2.5 py-0.5 text-[10px] font-bold uppercase text-[#6C5CE7]">
                          {acc.type} • {acc.status}
                        </span>
                        <span className="text-xs text-slate-400">
                          {acc.institution || "Sem instituição"}
                        </span>
                      </div>
                      <h3 className="mt-3 text-base font-extrabold text-[#1E1B39]">
                        {acc.name}
                      </h3>
                      <div className="mt-3 font-mono text-2xl font-black tabular-nums text-[#1E1B39]">
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
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
                <div>
                  <h2 className="text-lg font-extrabold text-[#1E1B39]">
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
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[#6C5CE7] bg-white px-3.5 py-2 text-xs font-bold text-[#6C5CE7] disabled:opacity-40"
                  >
                    <ArrowLeftRight className="h-3.5 w-3.5" />
                    Transferência entre Contas
                  </button>
                  <button
                    onClick={() => setShowTxModal(true)}
                    disabled={accounts.length === 0}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#6C5CE7] px-4 py-2 text-xs font-bold text-white disabled:opacity-40"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Registrar Receita / Despesa
                  </button>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-200/80 bg-[#F5F6FA] text-[11px] font-bold uppercase text-slate-500">
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
                              tx.status === "CANCELED"
                                ? "opacity-50 line-through"
                                : ""
                            }
                          >
                            <td className="px-4 py-3 font-mono text-[11px]">
                              {formatDateBR(tx.occurredOn)}
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-bold text-[#1E1B39]">
                                {tx.description}
                              </div>
                              {tx.costCenter && (
                                <span className="text-[10px] text-slate-500">
                                  Centro: {tx.costCenter}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <span className="rounded-lg bg-[#EFEFFD] px-2 py-0.5 font-mono text-[10px] font-bold text-[#6C5CE7]">
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
                                    className="rounded-lg bg-[#6C5CE7] px-2.5 py-1 text-[10px] font-bold text-white"
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
            </div>
          )}

          {/* =================================================================
              TELAS B e C (P02): CONTAS A PAGAR E CONTAS A RECEBER
             ================================================================= */}
          {(activeRoute === "contas-a-pagar" ||
            activeRoute === "contas-a-receber") && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
                <div>
                  <h2 className="text-lg font-extrabold text-[#1E1B39]">
                    {activeRoute === "contas-a-pagar"
                      ? "Contas a Pagar — Obrigações, Parcelas e Baixas (P02)"
                      : "Contas a Receber — Previsões, Clientes e Recebíveis (P02)"}
                  </h2>
                  <p className="text-xs text-slate-500">
                    Suporta 1 a N parcelas com divisão exata de centavos e baixa
                    parcial ou integral vinculada atomicamente ao Ledger P01.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      navigateRoute(
                        activeRoute === "contas-a-pagar"
                          ? "contas-a-receber"
                          : "contas-a-pagar"
                      )
                    }
                    className="rounded-xl border border-slate-200 bg-[#F5F6FA] px-3.5 py-2 text-xs font-bold text-[#1E1B39]"
                  >
                    Alternar para{" "}
                    {activeRoute === "contas-a-pagar"
                      ? "Contas a Receber"
                      : "Contas a Pagar"}
                  </button>
                  <button
                    onClick={() => {
                      setObDirection(
                        activeRoute === "contas-a-receber"
                          ? "RECEIVABLE"
                          : "PAYABLE"
                      );
                      setShowObligationModal(true);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#6C5CE7] px-4 py-2 text-xs font-bold text-white"
                  >
                    <Plus className="h-4 w-4" />
                    {activeRoute === "contas-a-receber"
                      ? "Novo Recebível"
                      : "Nova Conta a Pagar"}
                  </button>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-200/80 bg-[#F5F6FA] text-[11px] font-bold uppercase text-slate-500">
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
                              <div className="font-bold text-[#1E1B39]">
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
                                    ? "bg-[#EFEFFD] text-[#6C5CE7]"
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
                            <td className="px-4 py-3 text-right font-mono font-bold tabular-nums text-[#1E1B39]">
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
                                  className="rounded-lg bg-[#6C5CE7] px-3 py-1 text-[11px] font-bold text-white hover:bg-[#5849BE]"
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
            </div>
          )}

          {/* =================================================================
              TELAS DE PLANEJAMENTO E FLUXO DE CAIXA (P02)
             ================================================================= */}
          {(activeRoute.startsWith("planejamento") ||
            activeRoute === "fluxo-de-caixa") && (
            <div className="space-y-6">
              {/* Sub-navegação de Planejamento */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
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
                            ? "bg-[#6C5CE7] text-white"
                            : "bg-[#F5F6FA] text-slate-600 hover:bg-[#EFEFFD] hover:text-[#6C5CE7]"
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
                    className="w-28 rounded-lg border border-slate-200 bg-[#F5F6FA] px-2.5 py-1 font-mono text-xs font-bold text-[#1E1B39]"
                  />
                  <button
                    type="submit"
                    className="rounded-lg bg-[#6C5CE7] px-3 py-1 font-bold text-white"
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
                    className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs"
                  >
                    <div>
                      <label className="block text-xs font-bold text-slate-600">
                        Categoria
                      </label>
                      <input
                        type="text"
                        value={budgetCat}
                        onChange={(e) => setBudgetCat(e.target.value)}
                        className="mt-1 rounded-xl border border-slate-200 bg-[#F5F6FA] px-3 py-1.5 text-xs"
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
                        className="mt-1 rounded-xl border border-slate-200 bg-[#F5F6FA] px-3 py-1.5 font-mono text-xs"
                      />
                    </div>
                    <button
                      type="submit"
                      className="rounded-xl bg-[#6C5CE7] px-4 py-2 text-xs font-bold text-white"
                    >
                      Definir Orçamento
                    </button>
                  </form>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {budgets.map((b) => (
                      <div
                        key={b.id}
                        className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-extrabold text-[#1E1B39]">
                            {b.categoryName} ({b.period})
                          </span>
                          <span className="rounded-full bg-[#EFEFFD] px-2.5 py-0.5 font-mono text-xs font-bold text-[#6C5CE7]">
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
                                ? "bg-amber-500"
                                : "bg-[#6C5CE7]"
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
                      className={`cursor-pointer rounded-2xl border bg-white p-5 shadow-xs ${
                        scenarioKind === sc.kind
                          ? "border-2 border-[#6C5CE7]"
                          : "border-slate-200/80"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="rounded-full bg-[#EFEFFD] px-2.5 py-0.5 text-[10px] font-bold uppercase text-[#6C5CE7]">
                          {sc.kind}
                        </span>
                        {scenarioKind === sc.kind && (
                          <span className="text-xs font-bold text-[#6C5CE7]">
                            ● Ativo na Projeção
                          </span>
                        )}
                      </div>
                      <h3 className="mt-2 text-base font-extrabold text-[#1E1B39]">
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
                    className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs sm:grid-cols-5"
                  >
                    <input
                      type="text"
                      required
                      placeholder="Nome da Meta"
                      value={goalName}
                      onChange={(e) => setGoalName(e.target.value)}
                      className="rounded-xl border border-slate-200 bg-[#F5F6FA] px-3 py-2 text-xs"
                    />
                    <input
                      type="text"
                      placeholder="Valor Alvo (Ex: 15000.00)"
                      value={goalTargetDecimal}
                      onChange={(e) => setGoalTargetDecimal(e.target.value)}
                      className="rounded-xl border border-slate-200 bg-[#F5F6FA] px-3 py-2 font-mono text-xs"
                    />
                    <input
                      type="date"
                      value={goalTargetOn}
                      onChange={(e) => setGoalTargetOn(e.target.value)}
                      className="rounded-xl border border-slate-200 bg-[#F5F6FA] px-3 py-2 text-xs"
                    />
                    <select
                      value={goalReserveId}
                      onChange={(e) => setGoalReserveId(e.target.value)}
                      className="rounded-xl border border-slate-200 bg-[#F5F6FA] px-3 py-2 text-xs"
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
                      className="rounded-xl bg-[#6C5CE7] px-4 py-2 text-xs font-bold text-white"
                    >
                      Criar Meta
                    </button>
                  </form>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {goals.map((g) => (
                      <div
                        key={g.id}
                        className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs"
                      >
                        <div className="flex justify-between">
                          <h4 className="font-extrabold text-[#1E1B39]">
                            {g.name}
                          </h4>
                          <span className="font-mono text-xs font-bold text-[#6C5CE7]">
                            {g.progressPct}%
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">
                          Cofre vinculado: {g.linkedReserveName} • Alvo:{" "}
                          {formatBRL(g.targetAmountCents)}
                        </p>
                        <div className="mt-3 rounded-xl bg-[#F5F6FA] p-3 text-xs">
                          Contribuição mensal necessária ({g.remainingMonths}{" "}
                          meses restantes, sem assumir rentabilidade):{" "}
                          <strong className="font-mono text-[#6C5CE7]">
                            {formatBRL(g.requiredMonthlyCents)}/mês
                          </strong>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Série Diária de Fluxo de Caixa / Calendário Financeiro */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
                <h3 className="text-sm font-bold text-[#1E1B39]">
                  Série Diária do Fluxo de Caixa e Calendário ({horizonDays}{" "}
                  dias • Cenário {scenarioKind})
                </h3>
                <div className="mt-4 max-h-96 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-200/80 bg-[#F5F6FA] text-[11px] font-bold uppercase text-slate-500">
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
                          <td className="px-3 py-2 text-right font-bold tabular-nums text-[#6C5CE7]">
                            {formatBRL(pt.endingCents)}
                          </td>
                          <td className="px-3 py-2 font-sans">
                            {pt.isNegative ? (
                              <span className="rounded bg-rose-200 px-2 py-0.5 text-[10px] font-bold text-rose-900">
                                Saldo Negativo
                              </span>
                            ) : pt.isCritical ? (
                              <span className="rounded bg-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-900">
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
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
                <div>
                  <h2 className="text-lg font-extrabold text-[#1E1B39]">
                    Reservas e Cofres Virtuais de Planejamento (P02)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Valores reservados são alocações virtuais para planejamento —
                    não saem da conta bancária nem geram receita ou despesa
                    fictícia.
                  </p>
                </div>
                <button
                  onClick={() => setShowReserveModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#6C5CE7] px-4 py-2 text-xs font-bold text-white"
                >
                  <Plus className="h-4 w-4" />
                  Criar Cofre
                </button>
              </div>

              {/* Resumo de Cobertura */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
                  <span className="text-xs text-slate-500">
                    Saldo Bancário Elegível (S)
                  </span>
                  <div className="mt-1 font-mono text-2xl font-extrabold text-[#1E1B39]">
                    {formatBRL(kpis.eligibleBalanceCents)}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
                  <span className="text-xs text-slate-500">
                    Total Alocado em Cofres (R)
                  </span>
                  <div className="mt-1 font-mono text-2xl font-extrabold text-[#6C5CE7]">
                    {formatBRL(kpis.totalAllocatedReservesCents)}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
                  <span className="text-xs text-slate-500">
                    Saldo Livre Não Alocado (S − R)
                  </span>
                  <div
                    className={`mt-1 font-mono text-2xl font-extrabold ${
                      kpis.freeCashCents < 0 ? "text-rose-600" : "text-[#1E1B39]"
                    }`}
                  >
                    {formatBRL(kpis.freeCashCents)}
                  </div>
                </div>
                <div className="rounded-2xl bg-gradient-to-br from-[#6C5CE7] to-[#5849BE] p-4 text-white">
                  <span className="text-xs font-bold text-violet-100">
                    Capacidade Adicional Segura (Headroom)
                  </span>
                  <div className="mt-1 font-mono text-2xl font-black text-white">
                    {formatBRL(kpis.headroomCents)}
                  </div>
                </div>
              </div>

              {/* Lista de Cofres */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {reserves.map((res) => (
                  <div
                    key={res.id}
                    className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="rounded-full bg-[#EFEFFD] px-2.5 py-0.5 text-[10px] font-bold uppercase text-[#6C5CE7]">
                          {res.kind}
                        </span>
                        <span className="font-mono text-xs font-bold text-[#6C5CE7]">
                          {res.progressPct}%
                        </span>
                      </div>
                      <h3 className="mt-2 text-base font-extrabold text-[#1E1B39]">
                        {res.name}
                      </h3>
                      <div className="mt-3 font-mono text-2xl font-black text-[#1E1B39]">
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
                          className="h-full bg-[#6C5CE7]"
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
                        className="flex-1 rounded-xl bg-[#6C5CE7] py-1.5 text-xs font-bold text-white"
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
                        className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700"
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
                          className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700"
                        >
                          Transferir
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Explicação Auditável do Motor de Capacidade */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5">
                <h4 className="text-sm font-bold text-[#1E1B39]">
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
              PACOTE 04: INTELIGÊNCIA FINANCEIRA, ASSISTENTE IA & INTEGRAÇÕES
             ================================================================= */}
          {(activeRoute.startsWith("inteligencia") ||
            activeRoute.startsWith("integracoes")) && (
            <NovaIntelligenceP04View
              workspaceId={activeWorkspace.id}
              workspaceName={activeWorkspace.name}
              workspaceType={activeWorkspace.type}
              sectionMode={
                activeRoute.startsWith("integracoes")
                  ? "integracoes"
                  : "inteligencia"
              }
              initialIntelTab={
                (activeRoute === "inteligencia/alertas"
                  ? "alertas"
                  : activeRoute === "inteligencia/assistente"
                  ? "assistente"
                  : activeRoute === "inteligencia/saude-dados"
                  ? "saude-dados"
                  : "visao") as P04IntelSubTab
              }
              initialIntegrationTab={
                (activeRoute === "integracoes/importacoes"
                  ? "importacoes"
                  : activeRoute === "integracoes/conciliacao"
                  ? "conciliacao"
                  : activeRoute === "integracoes/consentimentos"
                  ? "consentimentos"
                  : "conexoes") as P04IntegrationSubTab
              }
              accounts={accounts}
              healthIndex={state.p04Intelligence?.healthIndex ?? null}
              quality={
                state.p04Intelligence?.quality ?? {
                  status: "INSUFFICIENT_DATA",
                  reasons: ["NO_ACCOUNTS"],
                }
              }
              savingsRatePct={state.p04Intelligence?.savingsRatePct ?? null}
              featureFlags={
                state.p04Intelligence?.featureFlags ?? {
                  openFinanceEnabled: false,
                  aiAssistantEnabled: true,
                  externalMarketDataEnabled: true,
                }
              }
              insights={state.financialInsights ?? []}
              alerts={alerts}
              connections={state.financialConnections ?? []}
              importBatches={state.importBatches ?? []}
              importedTransactions={state.importedTransactions ?? []}
              consentAudits={state.consentAudits ?? []}
              onExecuteAction={executeAction}
              onNavigateRoute={(r) => navigateRoute(r as NovaRouteKey)}
            />
          )}

          {/* =================================================================
              TELA L: RELATÓRIOS E EXPORTAÇÃO CSV
             ================================================================= */}
          {activeRoute === "relatorios" && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
                <div>
                  <h2 className="text-lg font-extrabold text-[#1E1B39]">
                    Relatórios Consolidados ({activeWorkspace.name})
                  </h2>
                  <p className="text-xs text-slate-500">
                    Receitas x despesas realizadas, compromissos por vencimento
                    e alocações de reservas e investimentos
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
                    const blob = new Blob([headers], {
                      type: "text/csv;charset=utf-8;",
                    });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `relatorio-nova-${activeWorkspace.id}.csv`;
                    a.click();
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#6C5CE7] px-4 py-2 text-xs font-bold text-white"
                >
                  Exportar CSV Auditável
                </button>
              </div>
            </div>
          )}

          {/* =================================================================
              TELA M: ADMINISTRAÇÃO E PERMISSÕES RBAC
             ================================================================= */}
          {(activeRoute === "configuracoes" || activeRoute === "auditoria") && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
                <h2 className="text-lg font-extrabold text-[#1E1B39]">
                  Administração, Perfis RBAC e Auditoria
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Alterne o papel ativo para testar bloqueios de autorização
                  (ex.: VIEWER recebe HTTP 403 WORKSPACE_FORBIDDEN em mutações).
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  {(["OWNER", "ADMIN", "EDITOR", "VIEWER"] as const).map(
                    (role) => (
                      <button
                        key={role}
                        onClick={() =>
                          executeAction(
                            { action: "SWITCH_ROLE", role },
                            `Papel RBAC alterado para ${role}.`
                          )
                        }
                        className={`rounded-xl px-4 py-2 text-xs font-bold ${
                          currentRole === role
                            ? "bg-[#6C5CE7] text-white"
                            : "bg-[#F5F6FA] text-slate-700"
                        }`}
                      >
                        {role}
                      </button>
                    )
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
                <h3 className="text-base font-extrabold text-[#1E1B39]">
                  Eventos de Auditoria ({auditEvents.length})
                </h3>
                <div className="mt-3 max-h-80 space-y-2 overflow-y-auto text-xs">
                  {auditEvents.map((ev) => (
                    <div
                      key={ev.id}
                      className="rounded-xl bg-[#F5F6FA] p-3 font-mono text-[11px]"
                    >
                      <div className="flex justify-between font-bold text-[#6C5CE7]">
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
              PACOTE 03: CENTRAL DE INVESTIMENTOS E SIMULAÇÕES
             ================================================================= */}
          {(activeRoute === "investimentos" || activeRoute === "simulacoes") && (
            <NovaInvestmentsP03View
              workspaceType={activeWorkspace.type}
              workspaceName={activeWorkspace.name}
              activeSubTab={
                activeRoute === "simulacoes" ? "simulador" : "visao-geral"
              }
              positions={investmentPositions}
              onPositionsChange={setInvestmentPositions}
              onPersistAction={executeAction}
              workspaceHeadroomCents={kpis.headroomCents}
              workspaceReservesCents={kpis.totalAllocatedReservesCents}
              workspaceEligibleBalanceCents={kpis.eligibleBalanceCents}
              onNavigateWorkspaceRoute={(r) =>
                navigateRoute(r as NovaRouteKey)
              }
            />
          )}
        </main>
      </div>

      {/* =====================================================================
          BARRA DE NAVEGAÇÃO INFERIOR MOBILE (VERSÃO CELULAR ADAPTADA)
         ===================================================================== */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-slate-200 bg-white px-2 py-2 lg:hidden">
        {[
          {
            key: "visao-geral" as NovaRouteKey,
            label: "Início",
            icon: LayoutDashboard,
          },
          {
            key: "contas" as NovaRouteKey,
            label: "Financeiro",
            icon: Wallet,
          },
          {
            key: "planejamento" as NovaRouteKey,
            label: "Planejar",
            icon: Compass,
          },
          {
            key: "investimentos" as NovaRouteKey,
            label: "Investir",
            icon: Layers,
          },
          {
            key: "simulacoes" as NovaRouteKey,
            label: "Simular",
            icon: Calculator,
          },
        ].map((item) => {
          const Icon = item.icon;
          const active = activeRoute === item.key;
          return (
            <button
              key={item.key}
              onClick={() => navigateRoute(item.key)}
              className={`flex flex-col items-center gap-0.5 rounded-xl px-3 py-1 text-[10px] font-bold ${
                active ? "text-[#6C5CE7]" : "text-slate-500"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* =====================================================================
          MODAIS DE OPERAÇÃO (CONTA, LANÇAMENTO, TRANSFERÊNCIA, OBRIGAÇÃO, BAIXA, COFRE)
         ===================================================================== */}
      {showAccountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1E1B39]/50 p-4 backdrop-blur-xs">
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
            <h3 className="text-base font-extrabold text-[#1E1B39]">
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
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-[#F5F6FA] px-3 py-2"
                />
              </div>
              <div>
                <label className="font-bold">Tipo</label>
                <select
                  value={accType}
                  onChange={(e) => setAccType(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-[#F5F6FA] px-3 py-2"
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
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-[#F5F6FA] px-3 py-2 font-mono"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAccountModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-xl bg-[#6C5CE7] px-4 py-2 text-xs font-bold text-white"
              >
                Salvar Conta
              </button>
            </div>
          </form>
        </div>
      )}

      {showTxModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1E1B39]/50 p-4 backdrop-blur-xs">
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
            <h3 className="text-base font-extrabold text-[#1E1B39]">
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
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-[#F5F6FA] px-3 py-2"
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
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-[#F5F6FA] px-3 py-2"
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
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-[#F5F6FA] px-3 py-2"
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
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-[#F5F6FA] px-3 py-2"
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
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-[#F5F6FA] px-3 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold">Data</label>
                  <input
                    type="date"
                    value={txDate}
                    onChange={(e) => setTxDate(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-[#F5F6FA] px-3 py-2"
                  />
                </div>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowTxModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-xl bg-[#6C5CE7] px-4 py-2 text-xs font-bold text-white"
              >
                Confirmar
              </button>
            </div>
          </form>
        </div>
      )}

      {showTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1E1B39]/50 p-4 backdrop-blur-xs">
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
            <h3 className="text-base font-extrabold text-[#1E1B39]">
              Transferência entre Contas Próprias
            </h3>
            <div className="mt-4 space-y-3 text-xs">
              <div>
                <label className="font-bold">Conta de Origem (Saída)</label>
                <select
                  value={tfSourceId}
                  onChange={(e) => setTfSourceId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-[#F5F6FA] px-3 py-2"
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
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-[#F5F6FA] px-3 py-2"
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
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-[#F5F6FA] px-3 py-2 font-mono"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowTransferModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-xl bg-[#6C5CE7] px-4 py-2 text-xs font-bold text-white"
              >
                Transferir
              </button>
            </div>
          </form>
        </div>
      )}

      {showObligationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1E1B39]/50 p-4 backdrop-blur-xs">
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
            <h3 className="text-base font-extrabold text-[#1E1B39]">
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
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-[#F5F6FA] px-3 py-2"
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
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-[#F5F6FA] px-3 py-2"
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
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-[#F5F6FA] px-3 py-2 font-mono"
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
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-[#F5F6FA] px-3 py-2 font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="font-bold">1º Vencimento</label>
                <input
                  type="date"
                  value={obFirstDue}
                  onChange={(e) => setObFirstDue(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-[#F5F6FA] px-3 py-2"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowObligationModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-xl bg-[#6C5CE7] px-4 py-2 text-xs font-bold text-white"
              >
                Gerar Parcelas
              </button>
            </div>
          </form>
        </div>
      )}

      {settlementTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1E1B39]/50 p-4 backdrop-blur-xs">
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
            <h3 className="text-base font-extrabold text-[#1E1B39]">
              Registrar Baixa de Parcela
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
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-[#F5F6FA] px-3 py-2"
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
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-[#F5F6FA] px-3 py-2 font-mono"
                />
              </div>
              <div>
                <label className="font-bold">Data Efetiva</label>
                <input
                  type="date"
                  value={settleDate}
                  onChange={(e) => setSettleDate(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-[#F5F6FA] px-3 py-2"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSettlementTarget(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-xl bg-[#6C5CE7] px-4 py-2 text-xs font-bold text-white"
              >
                Confirmar Baixa
              </button>
            </div>
          </form>
        </div>
      )}

      {showReserveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1E1B39]/50 p-4 backdrop-blur-xs">
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
            <h3 className="text-base font-extrabold text-[#1E1B39]">
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
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-[#F5F6FA] px-3 py-2"
                />
              </div>
              <div>
                <label className="font-bold">Finalidade</label>
                <select
                  value={resKind}
                  onChange={(e) => setResKind(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-[#F5F6FA] px-3 py-2"
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
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-[#F5F6FA] px-3 py-2 font-mono"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowReserveModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-xl bg-[#6C5CE7] px-4 py-2 text-xs font-bold text-white"
              >
                Criar Cofre
              </button>
            </div>
          </form>
        </div>
      )}

      {reserveActionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1E1B39]/50 p-4 backdrop-blur-xs">
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
            <h3 className="text-base font-extrabold text-[#1E1B39]">
              {reserveActionModal.mode === "ALLOCATE"
                ? `Alocar em: ${reserveActionModal.reserve.name}`
                : reserveActionModal.mode === "RELEASE"
                ? `Liberar de: ${reserveActionModal.reserve.name}`
                : `Transferir de: ${reserveActionModal.reserve.name}`}
            </h3>
            <div className="mt-2 flex items-start gap-2 rounded-xl bg-[#EFEFFD] p-3 text-[11px] text-[#1E1B39]">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#6C5CE7]" />
              <span>
                Operação de planejamento virtual. Não realiza transferência
                bancária nem altera o saldo contábil das contas P01. Capacidade
                segura sugerida:{" "}
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
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-[#F5F6FA] px-3 py-2"
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
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-[#F5F6FA] px-3 py-2 font-mono"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReserveActionModal(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-xl bg-[#6C5CE7] px-4 py-2 text-xs font-bold text-white"
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
