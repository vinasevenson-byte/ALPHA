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
  LogOut,
  UserPlus,
  Trash2,
  Repeat,
  Tag,
  Users,
  Printer,
  Download,
  Play,
} from "lucide-react";
import {
  centsToDecimalString,
  formatBRL,
  formatDateBR,
  sanitizeCsvCell,
} from "@/domain/planning";
import { calculateReserveCapacity } from "@/lib/financial-engine";
import { IntelligenceEngineCard } from "@/components/IntelligenceEngineCard";
import { ReserveSimulatorCard } from "@/components/ReserveSimulatorCard";
import { AssistantAndCalendarView } from "@/components/AssistantAndCalendarView";
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
  ownerId?: string | null;
  reconciled?: boolean;
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
  categoryName?: string | null;
  isEssential?: boolean;
  counterpartyId?: string | null;
  counterpartyName?: string | null;
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
    userId: string;
    role: "OWNER" | "ADMIN" | "EDITOR" | "VIEWER";
    status?: string;
    user?: { id?: string; name: string; email: string };
  }>;
  accounts: AccountItem[];
  categories: Array<{ id: string; type: string; name: string; isEssential: boolean }>;
  counterparties?: Array<{
    id: string;
    name: string;
    type: string;
    document?: string | null;
    costCenter?: string | null;
  }>;
  recurrences?: Array<{
    id: string;
    accountId: string;
    accountName?: string;
    categoryId?: string | null;
    categoryName?: string;
    kind: "INCOME" | "EXPENSE";
    title: string;
    amountCents: number;
    periodicity: "WEEKLY" | "MONTHLY" | "YEARLY";
    nextDate: string;
    endDate?: string | null;
    active: boolean;
  }>;
  analytics?: {
    monthlySummary: Array<{
      period: string;
      realizedIncomeCents: number;
      realizedExpenseCents: number;
      projectedIncomeCents: number;
      projectedExpenseCents: number;
      netRealizedCents: number;
      netProjectedCents: number;
    }>;
    categoryBreakdown: Array<{
      categoryName: string;
      isEssential: boolean;
      realizedCents: number;
      projectedCents: number;
      totalCents: number;
      sharePct: number;
    }>;
    counterpartyBreakdown: Array<{
      name: string;
      document: string | null;
      costCenter: string | null;
      totalExpenseCents: number;
      totalIncomeCents: number;
      txCount: number;
    }>;
    predictiveCalendar21d: Array<{
      dateIso: string;
      dayLabel: string;
      inflowCents: number;
      outflowCents: number;
      projectedBalanceCents: number;
      riskState: "SAFE" | "BELOW_SAFETY" | "NEGATIVE";
      events: Array<{
        id: string;
        description: string;
        type: string;
        amountCents: number;
      }>;
    }>;
    essentialMonthlyExpensesCents: number;
    topExpenseCategorySharePct: number;
  };
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
  p05Canonical?: {
    version: string;
    reconciled: boolean;
    summary: { balance: string; income: string; expense: string };
    projection: {
      minimum: string;
      closing: string;
      points: Array<{ date: string; balance: string }>;
    };
    capacity: string | null;
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

  // Layout Responsivo (Celular, Tablet e Desktop)
  const [sidebarCompact, setSidebarCompact] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [showQuickActionSheet, setShowQuickActionSheet] = useState(false);
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
  const [txCategoryId, setTxCategoryId] = useState("");
  const [txCounterpartyId, setTxCounterpartyId] = useState("");

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
  const [obCategoryId, setObCategoryId] = useState("");
  const [obCategory, setObCategory] = useState("Moradia");
  const [obCounterpartyId, setObCounterpartyId] = useState("");
  const [obCounterparty, setObCounterparty] = useState("");
  const [obCostCenter, setObCostCenter] = useState("");
  const [obTotalDecimal, setObTotalDecimal] = useState("300.00");
  const [obCount, setObCount] = useState(1);
  const [obFirstDue, setObFirstDue] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );

  // Form states — Recorrências Automáticas (Pacote 10)
  const [recTitle, setRecTitle] = useState("");
  const [recKind, setRecKind] = useState<"INCOME" | "EXPENSE">("EXPENSE");
  const [recAccountId, setRecAccountId] = useState("");
  const [recCategoryId, setRecCategoryId] = useState("");
  const [recPeriodicity, setRecPeriodicity] = useState<
    "MONTHLY" | "WEEKLY" | "YEARLY"
  >("MONTHLY");
  const [recNextDate, setRecNextDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [recAmountDecimal, setRecAmountDecimal] = useState("350.00");

  // Form states — Categorias & Contrapartes (Pacote 10)
  const [newCatName, setNewCatName] = useState("");
  const [newCatType, setNewCatType] = useState<"EXPENSE" | "INCOME">("EXPENSE");
  const [newCatEssential, setNewCatEssential] = useState(true);
  const [newCpName, setNewCpName] = useState("");
  const [newCpType, setNewCpType] = useState<"COMPANY" | "PERSON">("COMPANY");
  const [newCpDoc, setNewCpDoc] = useState("");
  const [newCpCostCenter, setNewCpCostCenter] = useState("");

  // Form states — Governança Multi-Usuário RBAC & Sessões (Pacote 10)
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"ADMIN" | "EDITOR" | "VIEWER">(
    "EDITOR"
  );
  const [currentUserInfo, setCurrentUserInfo] = useState<{
    id: string;
    name: string;
    email: string;
    currentSessionId?: string;
  } | null>(null);
  const [activeSessions, setActiveSessions] = useState<
    Array<{
      id: string;
      createdAt: string;
      lastSeenAt: string;
      expiresAt: string;
      userAgent?: string | null;
      isCurrent?: boolean;
    }>
  >([]);

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
          setRecAccountId((prev) => prev || json.accounts[0].id);
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

  const loadAuthProfile = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      if (!res.ok) return;
      const json = await res.json();
      if (json.user) setCurrentUserInfo(json.user);
      if (Array.isArray(json.sessions)) setActiveSessions(json.sessions);
    } catch {
      // ignore unauthenticated in preview mode
    }
  }, []);

  useEffect(() => {
    loadData(workspaceId, horizonDays, scenarioKind);
  }, [workspaceId, horizonDays, scenarioKind, loadData]);

  useEffect(() => {
    loadAuthProfile();
  }, [loadAuthProfile, activeRoute]);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
    } finally {
      window.location.href = "/entrar";
    }
  };

  const handleRevokeOtherSessions = async () => {
    setBannerError(null);
    setBannerSuccess(null);
    try {
      const res = await fetch("/api/auth/revoke-other-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const json = await res.json();
      if (!res.ok) {
        setBannerError(json.message || "Falha ao encerrar outras sessões.");
        return;
      }
      setBannerSuccess(
        `Outras sessões encerradas (${json.revokedCount ?? 0} revogada(s)).`
      );
      await loadAuthProfile();
    } catch {
      setBannerError("Erro ao revogar sessões secundárias.");
    }
  };

  const navigateRoute = (route: NovaRouteKey, newWsId?: string) => {
    const ws = newWsId ?? workspaceId;
    setActiveRoute(route);
    setMobileMenuOpen(false);
    setShowQuickActionSheet(false);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `/app/${ws}/${route}`);
      window.scrollTo({ top: 0, behavior: "smooth" });
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

  if (!state) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F5F6FA] p-6 text-[#1E1B39]">
        <div className="w-full max-w-md rounded-2xl border border-[#E5E7EB] bg-white p-8 shadow-sm">
          <div className="mb-3 inline-flex rounded-full bg-[#EFEFFD] px-3 py-1 text-xs font-semibold text-[#6C5CE7]">
            NOVA — Homologação Protegida (v9.0.0)
          </div>
          <h1 className="text-xl font-bold text-[#1E1B39]">
            Autenticação de Sessão ou Banco Necessária
          </h1>
          <p className="mt-2 text-sm text-[#4B5563]">
            {bannerError ||
              "Para visualizar um workspace financeiro, autentique sua sessão ou verifique a conexão DATABASE_URL na Vercel."}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href="/entrar"
              className="rounded-xl bg-[#6C5CE7] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#5B4BC4]"
            >
              Ir para Login (/entrar)
            </a>
            <a
              href="/cadastro"
              className="rounded-xl border border-[#D1D5DB] bg-white px-4 py-2.5 text-sm font-semibold text-[#1E1B39] hover:bg-[#F9FAFB]"
            >
              Criar Conta (/cadastro)
            </a>
          </div>
        </div>
      </div>
    );
  }

  const {
    workspaces,
    activeWorkspace,
    memberships,
    accounts,
    categories = [],
    counterparties = [],
    recurrences = [],
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
  const matchedMember = currentUserInfo
    ? memberships.find((m) => m.userId === currentUserInfo.id)
    : undefined;
  const currentRole = matchedMember?.role ?? memberships[0]?.role ?? "OWNER";
  const canAdminWorkspace = currentRole === "OWNER" || currentRole === "ADMIN";
  const isZeroState =
    accounts.length === 0 &&
    transactions.length === 0 &&
    installments.length === 0 &&
    investmentPositions.length === 0;

  const reserveCapacityEngine = calculateReserveCapacity({
    availableBalanceCents: kpis.eligibleBalanceCents,
    predictedBillsCents: kpis.openPayablesCents,
    predictedIncomesCents: kpis.openReceivablesCents,
    safetyMarginCents: kpis.safetyBufferCents,
    essentialMonthlyExpensesCents:
      state.analytics?.essentialMonthlyExpensesCents ?? 0,
    workspaceType: isPJ ? "PJ" : "PF",
  });

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
    <div className="flex min-h-[100dvh] bg-[#F5F6FA] pb-24 text-[#1E1B39] md:pb-0">
      {/* =====================================================================
          RAIL VERTICAL PARA TABLET RETRATO (768px–1023px | iPad & Android Tablet)
         ===================================================================== */}
      <aside className="sticky top-0 hidden h-[100dvh] w-20 shrink-0 flex-col items-center justify-between border-r border-slate-200/80 bg-white py-3 md:flex lg:hidden">
        <div className="flex w-full flex-col items-center gap-2 px-2">
          <button
            onClick={() => setMobileMenuOpen(true)}
            title="Abrir todos os módulos"
            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#6C5CE7] to-[#5849BE] font-black text-white shadow-sm active:scale-95"
          >
            N
          </button>

          <nav className="no-scrollbar mt-1 flex max-h-[calc(100dvh-140px)] w-full flex-col items-center gap-1 overflow-y-auto">
            {[
              { key: "visao-geral" as NovaRouteKey, label: "Início", icon: LayoutDashboard, match: (r: string) => r === "visao-geral" },
              { key: "contas" as NovaRouteKey, label: "Contas", icon: Wallet, match: (r: string) => r === "contas" },
              { key: "movimentacoes" as NovaRouteKey, label: "Extrato", icon: Receipt, match: (r: string) => r === "movimentacoes" },
              { key: "contas-a-pagar" as NovaRouteKey, label: "Pagar/Rec", icon: CalendarClock, match: (r: string) => r === "contas-a-pagar" || r === "contas-a-receber" },
              { key: "fluxo-de-caixa" as NovaRouteKey, label: "Fluxo", icon: LineChart, match: (r: string) => r === "fluxo-de-caixa" },
              { key: "planejamento" as NovaRouteKey, label: "Planejar", icon: Compass, match: (r: string) => r.startsWith("planejamento") && r !== "planejamento/metas" },
              { key: "reservas" as NovaRouteKey, label: "Reservas", icon: Shield, match: (r: string) => r === "reservas" || r === "planejamento/metas" },
              { key: "investimentos" as NovaRouteKey, label: "Investir", icon: Layers, match: (r: string) => r === "investimentos" || r === "simulacoes" },
              { key: "inteligencia" as NovaRouteKey, label: "IA & Open", icon: Sparkles, match: (r: string) => r.startsWith("inteligencia") || r.startsWith("integracoes") },
              { key: "relatorios" as NovaRouteKey, label: "DRE/Rel", icon: FileBarChart2, match: (r: string) => r === "relatorios" },
              { key: "configuracoes" as NovaRouteKey, label: "Admin", icon: Settings, match: (r: string) => r === "configuracoes" || r === "auditoria" },
            ].map((item) => {
              const Icon = item.icon;
              const active = item.match(activeRoute);
              return (
                <button
                  key={item.key}
                  onClick={() => navigateRoute(item.key)}
                  className={`flex w-full flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] font-bold transition ${
                    active
                      ? "bg-[#6C5CE7] text-white shadow-xs"
                      : "text-slate-500 hover:bg-[#EFEFFD]/70 hover:text-[#6C5CE7]"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <button
          onClick={() => setMobileMenuOpen(true)}
          title="Expandir menu completo"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-[#F5F6FA] text-slate-600 hover:text-[#6C5CE7]"
        >
          <Menu className="h-4 w-4" />
        </button>
      </aside>

      {/* =====================================================================
          SIDEBAR OFICIAL NOVA — TABLET PAISAGEM & DESKTOP (>=1024px)
         ===================================================================== */}
      <aside
        className={`sticky top-0 hidden h-[100dvh] shrink-0 flex-col border-r border-slate-200/80 bg-white transition-all duration-200 lg:flex ${
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
                    v5.0
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

      {/* Drawer Completo para Celular e Tablet */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-[#1E1B39]/45 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="pt-safe pb-safe relative z-10 flex h-[100dvh] w-[86vw] max-w-xs flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 p-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#6C5CE7] font-black text-white">
                  N
                </div>
                <div>
                  <span className="text-base font-extrabold text-[#1E1B39]">
                    NOVA
                  </span>
                  <p className="text-[11px] text-slate-500">
                    {activeWorkspace.name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Fechar menu"
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F5F6FA] text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Seletor Rápido de Ambiente PF/PJ no Drawer Mobile/Tablet */}
            <div className="border-b border-slate-100 bg-[#F5F6FA]/70 px-3 py-2.5">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <span>Ambiente Ativo</span>
                <a
                  href="/onboarding"
                  className="font-bold text-[#6C5CE7] hover:underline"
                >
                  + Novo Ambiente
                </a>
              </div>
              <div className="mt-1.5 grid grid-cols-2 gap-1.5">
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
                      className={`inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-bold transition ${
                        active
                          ? "bg-[#6C5CE7] text-white shadow-xs"
                          : "border border-slate-200 bg-white text-slate-600"
                      }`}
                    >
                      {ws.type === "BUSINESS" ? (
                        <Building2 className="h-3.5 w-3.5 shrink-0" />
                      ) : (
                        <User className="h-3.5 w-3.5 shrink-0" />
                      )}
                      <span className="truncate">
                        {ws.type === "BUSINESS" ? "Empresarial" : "Pessoal"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {renderSidebarNav(false)}

            {/* Rodapé do Drawer Mobile/Tablet com Perfil e Logout */}
            <div className="border-t border-slate-100 p-3 text-xs">
              <div className="flex items-center justify-between gap-2 rounded-xl bg-[#F5F6FA] px-3 py-2">
                <div className="min-w-0">
                  <div className="truncate font-bold text-[#1E1B39]">
                    {currentUserInfo?.name || "Administrador NOVA"}
                  </div>
                  <div className="truncate text-[10px] text-slate-500">
                    Papel: {currentRole} • {activeWorkspace.baseCurrency}
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="inline-flex min-h-[36px] shrink-0 items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sair
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          CONTEÚDO PRINCIPAL (FUNDO CINZA SUAVE #F5F6FA + CARTÕES BRANCOS)
         ===================================================================== */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar Oficial NOVA Adaptativa para Celular, Tablet e Desktop */}
        <header className="pt-safe sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 px-3 py-2.5 backdrop-blur sm:px-6 sm:py-3">
          <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-2">
            {/* Esquerda: Menu Mobile + Alternância PF/PJ compacta no celular + Pilares no Tablet/Desktop */}
            <div className="flex min-w-0 items-center gap-2">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-[#F5F6FA] text-[#1E1B39] active:scale-95 md:hidden"
                aria-label="Abrir menu"
              >
                <Menu className="h-5 w-5" />
              </button>

              {/* Navegação Superior Oficial (Visível em Tablet & Desktop — no celular fica na Barra Inferior) */}
              <div className="hidden rounded-xl bg-[#F5F6FA] p-1 ring-1 ring-slate-200/80 md:inline-flex">
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
                      className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
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

              {/* Seletor Pessoal vs Empresarial (Compacto no Celular, Completo no Tablet/Desktop) */}
              <div className="inline-flex items-center rounded-xl bg-[#F5F6FA] p-1 ring-1 ring-slate-200/80">
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
                      className={`inline-flex min-h-[32px] items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition sm:gap-1.5 sm:px-3 sm:py-1.5 ${
                        active
                          ? "bg-white text-[#6C5CE7] shadow-xs"
                          : "text-slate-500 hover:text-[#1E1B39]"
                      }`}
                    >
                      {ws.type === "BUSINESS" ? (
                        <Building2 className="h-3.5 w-3.5 shrink-0 text-[#6C5CE7]" />
                      ) : (
                        <User className="h-3.5 w-3.5 shrink-0 text-[#6C5CE7]" />
                      )}
                      <span className="sm:hidden">
                        {ws.type === "BUSINESS" ? "PJ" : "PF"}
                      </span>
                      <span className="hidden sm:inline">
                        {ws.type === "BUSINESS" ? "Empresarial" : "Pessoal"}
                      </span>
                    </button>
                  );
                })}
                <a
                  href="/onboarding"
                  title="Criar novo ambiente Pessoal (PF) ou Empresarial (PJ)"
                  className="ml-0.5 hidden items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-bold text-[#6C5CE7] transition hover:bg-[#EFEFFD] lg:inline-flex"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Ambiente</span>
                </a>
              </div>

              {/* Seletor de Horizonte no Desktop largo */}
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

            {/* Direita: Busca Touch, Alertas, Lançamento Rápido e Sair */}
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              <div className="relative hidden lg:block">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Pesquisar na NOVA..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-44 rounded-xl border border-slate-200/80 bg-[#F5F6FA] py-1.5 pl-8 pr-3 text-xs text-[#1E1B39] focus:border-[#6C5CE7] focus:bg-white focus:outline-none"
                />
              </div>

              <button
                onClick={() => setMobileSearchOpen(!mobileSearchOpen)}
                className={`flex h-10 w-10 items-center justify-center rounded-xl border transition lg:hidden ${
                  mobileSearchOpen || searchQuery
                    ? "border-[#6C5CE7] bg-[#EFEFFD] text-[#6C5CE7]"
                    : "border-slate-200/80 bg-[#F5F6FA] text-[#1E1B39]"
                }`}
                aria-label="Pesquisar"
                title="Pesquisar lançamentos"
              >
                <Search className="h-4 w-4" />
              </button>

              <button
                onClick={() => navigateRoute("inteligencia/alertas")}
                className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200/80 bg-[#F5F6FA] text-[#1E1B39] hover:border-[#6C5CE7]/40 sm:h-9 sm:w-9"
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
                onClick={() => setShowQuickActionSheet(true)}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#6C5CE7] px-3 text-xs font-bold text-white shadow-xs transition hover:bg-[#5849BE] active:scale-95 md:hidden"
              >
                <Plus className="h-4 w-4" />
                <span>Ações</span>
              </button>

              <button
                onClick={() => {
                  if (accounts.length === 0) {
                    setShowAccountModal(true);
                  } else {
                    setShowTxModal(true);
                  }
                }}
                className="hidden items-center gap-1.5 rounded-xl bg-[#6C5CE7] px-3.5 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-[#5849BE] md:inline-flex"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>
                  {accounts.length === 0
                    ? "Cadastrar 1ª Conta"
                    : "Novo Lançamento"}
                </span>
              </button>

              <button
                onClick={handleLogout}
                title="Encerrar sessão com segurança"
                className="hidden items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 md:inline-flex"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden lg:inline">Sair</span>
              </button>
            </div>
          </div>

          {/* Barra Expansível de Busca para Celular e Tablet */}
          {mobileSearchOpen && (
            <div className="mx-auto mt-2.5 flex max-w-[1440px] items-center gap-2 lg:hidden">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filtrar movimentações ou centro de custo..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (activeRoute !== "movimentacoes") {
                      setActiveRoute("movimentacoes");
                    }
                  }}
                  className="min-h-[42px] w-full rounded-xl border border-slate-200 bg-[#F5F6FA] py-2 pl-10 pr-8 text-sm text-[#1E1B39] focus:border-[#6C5CE7] focus:bg-white focus:outline-none"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-2.5 text-xs font-bold text-slate-400"
                  >
                    ✕
                  </button>
                )}
              </div>
              <button
                onClick={() => setMobileSearchOpen(false)}
                className="rounded-xl px-2.5 py-2 text-xs font-bold text-[#6C5CE7]"
              >
                Fechar
              </button>
            </div>
          )}

          {/* Faixa Deslizável de Horizonte para Celular & Tablet (<1280px) */}
          <div className="no-scrollbar mx-auto mt-2 flex max-w-[1440px] items-center justify-between gap-2 overflow-x-auto xl:hidden">
            <div className="flex shrink-0 items-center gap-1">
              <span className="mr-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Horizonte:
              </span>
              {[
                { days: 30, label: "30d" },
                { days: 90, label: "90d" },
                { days: 180, label: "6 meses" },
                { days: 365, label: "12 meses" },
              ].map((h) => (
                <button
                  key={h.days}
                  onClick={() => setHorizonDays(h.days)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-bold whitespace-nowrap transition ${
                    horizonDays === h.days
                      ? "bg-[#EFEFFD] text-[#6C5CE7]"
                      : "text-slate-500 hover:bg-[#F5F6FA]"
                  }`}
                >
                  {h.label}
                </button>
              ))}
            </div>

            <div className="flex shrink-0 items-center gap-1.5 text-[11px]">
              <button
                onClick={() => navigateRoute("inteligencia/assistente")}
                className="inline-flex items-center gap-1 rounded-lg bg-[#EFEFFD]/80 px-2.5 py-1 font-bold whitespace-nowrap text-[#6C5CE7]"
              >
                <Bot className="h-3 w-3" />
                Assistente IA
              </button>
              <button
                onClick={() => navigateRoute("relatorios")}
                className="inline-flex items-center gap-1 rounded-lg bg-[#F5F6FA] px-2.5 py-1 font-semibold whitespace-nowrap text-slate-600"
              >
                <FileBarChart2 className="h-3 w-3" />
                {isPJ ? "DRE" : "Relatório"}
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
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {/* Cartão 1: Saúde Financeira */}
                <div
                  onClick={() => navigateRoute("inteligencia/diagnostico")}
                  className="min-w-0 cursor-pointer rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition hover:border-[#6C5CE7]/50 hover:shadow-md sm:p-6"
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
                  className="min-w-0 cursor-pointer rounded-2xl border border-[#6C5CE7]/25 bg-gradient-to-br from-[#6C5CE7] to-[#5849BE] p-5 text-white shadow-sm transition hover:shadow-md sm:p-6"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-violet-100">
                      Patrimônio Líquido
                    </span>
                    <span className="rounded-xl bg-white/15 p-2 text-white">
                      <Wallet className="h-4 w-4" />
                    </span>
                  </div>
                  <div className="mt-3 font-mono text-2xl font-black tabular-nums text-white sm:text-3xl">
                    {formatBRL(netWorthCents)}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1 text-xs text-violet-100">
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
                  className="min-w-0 cursor-pointer rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition hover:border-[#6C5CE7]/50 hover:shadow-md sm:p-6 md:col-span-2 lg:col-span-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Projeção Financeira
                    </span>
                    <span className="rounded-xl bg-[#EFEFFD] p-2 text-[#6C5CE7]">
                      <LineChart className="h-4 w-4" />
                    </span>
                  </div>
                  <div className="mt-3 font-mono text-2xl font-black tabular-nums text-[#1E1B39] sm:text-3xl">
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
                        primeira conta bancária ou importe um extrato real
                        (.csv / .ofx) para acompanhar a evolução patrimonial.
                      </p>
                      <div className="mt-5 flex flex-wrap justify-center gap-2.5">
                        <button
                          onClick={() => setShowAccountModal(true)}
                          className="rounded-xl bg-[#6C5CE7] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#5849BE]"
                        >
                          Cadastrar Primeira Conta
                        </button>
                        <button
                          onClick={() => navigateRoute("integracoes/importacoes")}
                          className="rounded-xl border border-slate-200 bg-[#F5F6FA] px-4 py-2 text-xs font-semibold text-[#1E1B39] hover:border-[#6C5CE7]"
                        >
                          Importar Extrato (.CSV / .OFX)
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

          {/* Sub-navegação Rápida Mobile para o Pilar Financeiro */}
          {(activeRoute === "contas" ||
            activeRoute === "movimentacoes" ||
            activeRoute === "contas-a-pagar" ||
            activeRoute === "contas-a-receber" ||
            activeRoute === "reservas") && (
            <div className="no-scrollbar -mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-1 md:hidden">
              {[
                { key: "contas" as NovaRouteKey, label: "Contas", icon: Wallet },
                {
                  key: "movimentacoes" as NovaRouteKey,
                  label: "Movimentações",
                  icon: ArrowLeftRight,
                },
                {
                  key: "contas-a-pagar" as NovaRouteKey,
                  label: "A Pagar",
                  icon: CalendarClock,
                },
                {
                  key: "contas-a-receber" as NovaRouteKey,
                  label: "A Receber",
                  icon: Receipt,
                },
                {
                  key: "reservas" as NovaRouteKey,
                  label: "Cofres",
                  icon: Shield,
                },
              ].map((pill) => {
                const PillIcon = pill.icon;
                const active = activeRoute === pill.key;
                return (
                  <button
                    key={pill.key}
                    onClick={() => navigateRoute(pill.key)}
                    className={`inline-flex min-h-[38px] shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold whitespace-nowrap transition ${
                      active
                        ? "bg-[#6C5CE7] text-white shadow-sm"
                        : "border border-slate-200/80 bg-white text-slate-600"
                    }`}
                  >
                    <PillIcon className="h-3.5 w-3.5" />
                    <span>{pill.label}</span>
                  </button>
                );
              })}
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
                  className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl bg-[#6C5CE7] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#5849BE]"
                >
                  <Plus className="h-4 w-4" />
                  Nova Conta
                </button>
              </div>

              {accounts.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center sm:p-12">
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
                    className="mt-4 min-h-[42px] rounded-xl bg-[#6C5CE7] px-4 py-2 text-xs font-bold text-white"
                  >
                    Criar Conta Agora
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                  <button
                    onClick={() => setShowTransferModal(true)}
                    disabled={accounts.length < 2}
                    className="inline-flex min-h-[42px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#6C5CE7] bg-white px-3.5 py-2 text-xs font-bold text-[#6C5CE7] disabled:opacity-40 sm:flex-none"
                  >
                    <ArrowLeftRight className="h-3.5 w-3.5" />
                    Transferência entre Contas
                  </button>
                  <button
                    onClick={() => setShowTxModal(true)}
                    disabled={accounts.length === 0}
                    className="inline-flex min-h-[42px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#6C5CE7] px-4 py-2 text-xs font-bold text-white disabled:opacity-40 sm:flex-none"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Registrar Receita / Despesa
                  </button>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs">
                {/* Versão Celular (<768px): Lista de Cartões Touch sem rolagem lateral */}
                <div className="divide-y divide-slate-100 md:hidden">
                  {filteredTransactions.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-500">
                      Nenhuma movimentação registrada neste workspace.
                    </div>
                  ) : (
                    filteredTransactions.map((tx) => {
                      const isPositive =
                        tx.kind === "INCOME" || tx.kind === "TRANSFER_IN";
                      return (
                        <div
                          key={tx.id}
                          className={`space-y-2.5 p-4 ${
                            tx.status === "CANCELED"
                              ? "opacity-50 line-through"
                              : ""
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                                <span className="font-mono font-semibold text-slate-600">
                                  {formatDateBR(tx.occurredOn)}
                                </span>
                                <span>•</span>
                                <span className="truncate font-medium">
                                  {tx.account?.name || "Conta"}
                                </span>
                              </div>
                              <div className="mt-0.5 text-sm font-extrabold text-[#1E1B39]">
                                {tx.description}
                              </div>
                            </div>
                            <div className="shrink-0 text-right">
                              <div
                                className={`font-mono text-sm font-black tabular-nums ${
                                  isPositive
                                    ? "text-emerald-700"
                                    : "text-rose-700"
                                }`}
                              >
                                {isPositive ? "+" : "-"}
                                {formatBRL(tx.amountCents)}
                              </div>
                              <span
                                className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                  tx.status === "SETTLED"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : tx.status === "PENDING"
                                    ? "bg-amber-100 text-amber-900"
                                    : "bg-slate-200 text-slate-600"
                                }`}
                              >
                                {tx.status}
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                            <div className="flex flex-wrap gap-1.5 text-[10px]">
                              <span className="rounded-lg bg-[#EFEFFD] px-2 py-0.5 font-mono font-bold text-[#6C5CE7]">
                                {tx.kind}
                              </span>
                              {tx.categoryName && (
                                <span className="rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                                  {tx.categoryName}
                                </span>
                              )}
                              {tx.counterpartyName && (
                                <span className="rounded bg-[#EFEFFD] px-2 py-0.5 font-medium text-[#6C5CE7]">
                                  {tx.counterpartyName}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
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
                                  className="min-h-[34px] rounded-xl bg-[#6C5CE7] px-3 py-1.5 text-xs font-bold text-white"
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
                                  className="inline-flex min-h-[34px] items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-800"
                                >
                                  <Ban className="h-3.5 w-3.5" />
                                  Estornar
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Versão Tablet & Desktop (>=768px): Tabela Analítica Completa */}
                <div className="hidden overflow-x-auto md:block">
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
                              <div className="mt-0.5 flex flex-wrap gap-1.5 text-[10px] text-slate-500">
                                {tx.categoryName && (
                                  <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-700">
                                    {tx.categoryName}
                                  </span>
                                )}
                                {tx.counterpartyName && (
                                  <span className="rounded bg-[#EFEFFD] px-1.5 py-0.5 font-medium text-[#6C5CE7]">
                                    {tx.counterpartyName}
                                  </span>
                                )}
                                {tx.costCenter && (
                                  <span>Centro: {tx.costCenter}</span>
                                )}
                              </div>
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

              {/* =============================================================
                  PACOTE 10: MOTOR DE RECORRÊNCIAS AUTOMÁTICAS
                 ============================================================= */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-2.5">
                    <span className="rounded-xl bg-[#EFEFFD] p-2 text-[#6C5CE7]">
                      <Repeat className="h-4 w-4" />
                    </span>
                    <div>
                      <h3 className="text-sm font-extrabold text-[#1E1B39]">
                        Motor de Recorrências Automáticas (Salários, Assinaturas, Aluguel, Contratos)
                      </h3>
                      <p className="text-xs text-slate-500">
                        Projeta automaticamente todas as ocorrências futuras no Fluxo de Caixa e permite materialização no Ledger com chave idempotente.
                      </p>
                    </div>
                  </div>
                  <span className="rounded-full bg-[#EFEFFD] px-2.5 py-0.5 text-[10px] font-bold text-[#6C5CE7]">
                    {recurrences.filter((r) => r.active).length} ativa(s)
                  </span>
                </div>

                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!recTitle.trim()) return;
                    const ok = await executeAction(
                      {
                        action: "CREATE_RECURRENCE",
                        title: recTitle,
                        kind: recKind,
                        accountId: recAccountId || accounts[0]?.id,
                        categoryId: recCategoryId || undefined,
                        periodicity: recPeriodicity,
                        nextDate: recNextDate,
                        amountDecimal: recAmountDecimal,
                      },
                      "Recorrência criada e incorporada à projeção automática."
                    );
                    if (ok) setRecTitle("");
                  }}
                  className="mt-4 grid grid-cols-1 gap-2.5 text-xs sm:grid-cols-2 lg:grid-cols-7"
                >
                  <input
                    type="text"
                    required
                    placeholder="Ex: Salário / Aluguel / AWS"
                    value={recTitle}
                    onChange={(e) => setRecTitle(e.target.value)}
                    className="min-h-[42px] rounded-xl border border-slate-200 bg-[#F5F6FA] px-3 py-2 sm:col-span-2"
                  />
                  <select
                    value={recKind}
                    onChange={(e) =>
                      setRecKind(e.target.value as "INCOME" | "EXPENSE")
                    }
                    className="min-h-[42px] rounded-xl border border-slate-200 bg-[#F5F6FA] px-2.5 py-2"
                  >
                    <option value="EXPENSE">Despesa Fixa</option>
                    <option value="INCOME">Receita Recorrente</option>
                  </select>
                  <select
                    value={recPeriodicity}
                    onChange={(e) =>
                      setRecPeriodicity(
                        e.target.value as "MONTHLY" | "WEEKLY" | "YEARLY"
                      )
                    }
                    className="min-h-[42px] rounded-xl border border-slate-200 bg-[#F5F6FA] px-2.5 py-2"
                  >
                    <option value="MONTHLY">Mensal</option>
                    <option value="WEEKLY">Semanal</option>
                    <option value="YEARLY">Anual</option>
                  </select>
                  <input
                    type="date"
                    value={recNextDate}
                    onChange={(e) => setRecNextDate(e.target.value)}
                    className="min-h-[42px] rounded-xl border border-slate-200 bg-[#F5F6FA] px-2.5 py-2"
                  />
                  <input
                    type="text"
                    inputMode="decimal"
                    required
                    placeholder="Valor (R$)"
                    value={recAmountDecimal}
                    onChange={(e) => setRecAmountDecimal(e.target.value)}
                    className="min-h-[42px] rounded-xl border border-slate-200 bg-[#F5F6FA] px-3 py-2 font-mono"
                  />
                  <button
                    type="submit"
                    disabled={accounts.length === 0}
                    className="min-h-[42px] rounded-xl bg-[#6C5CE7] px-3 py-2 font-bold text-white disabled:opacity-40 sm:col-span-2 lg:col-span-1"
                  >
                    + Recorrência
                  </button>
                </form>

                {recurrences.length > 0 && (
                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                    {recurrences.map((rec) => (
                      <div
                        key={rec.id}
                        className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3.5 text-xs ${
                          rec.active
                            ? "border-slate-200 bg-[#F5F6FA]"
                            : "border-slate-200 bg-slate-50 opacity-60"
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-[#1E1B39]">
                              {rec.title}
                            </span>
                            <span className="rounded bg-[#EFEFFD] px-2 py-0.5 font-mono text-[10px] font-bold text-[#6C5CE7]">
                              {rec.periodicity}
                            </span>
                          </div>
                          <p className="mt-0.5 text-[11px] text-slate-500">
                            Próxima: {formatDateBR(rec.nextDate)} •{" "}
                            {rec.accountName || "Conta"} •{" "}
                            {rec.categoryName || "Geral"}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`font-mono font-extrabold ${
                              rec.kind === "INCOME"
                                ? "text-emerald-700"
                                : "text-rose-700"
                            }`}
                          >
                            {rec.kind === "INCOME" ? "+" : "-"}
                            {formatBRL(rec.amountCents)}
                          </span>
                          {rec.active && (
                            <button
                              onClick={() =>
                                executeAction(
                                  {
                                    action: "MATERIALIZE_RECURRENCE",
                                    recurrenceId: rec.id,
                                    settleImmediately: true,
                                  },
                                  `Ocorrência de ${rec.title} lançada no Ledger e próxima data avançada.`
                                )
                              }
                              title="Lançar ocorrência atual no Ledger e avançar calendário"
                              className="inline-flex items-center gap-1 rounded-lg bg-[#6C5CE7] px-2.5 py-1 text-[10px] font-bold text-white hover:bg-[#5849BE]"
                            >
                              <Play className="h-3 w-3" />
                              Lançar
                            </button>
                          )}
                          <button
                            onClick={() =>
                              executeAction(
                                {
                                  action: "TOGGLE_RECURRENCE",
                                  recurrenceId: rec.id,
                                },
                                rec.active
                                  ? "Recorrência pausada."
                                  : "Recorrência reativada."
                              )
                            }
                            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-700"
                          >
                            {rec.active ? "Pausar" : "Ativar"}
                          </button>
                          <button
                            onClick={() =>
                              executeAction(
                                {
                                  action: "DELETE_RECURRENCE",
                                  recurrenceId: rec.id,
                                },
                                "Recorrência removida."
                              )
                            }
                            className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] font-semibold text-rose-700"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* =============================================================
                  PACOTE 10: CATEGORIAS E CONTRAPARTES (CLIENTES / FORNECEDORES)
                 ============================================================= */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Categorias */}
                <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                    <Tag className="h-4 w-4 text-[#6C5CE7]" />
                    <h3 className="text-sm font-extrabold text-[#1E1B39]">
                      Categorias Contábeis ({categories.length})
                    </h3>
                  </div>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!newCatName.trim()) return;
                      const ok = await executeAction(
                        {
                          action: "CREATE_CATEGORY",
                          name: newCatName,
                          type: newCatType,
                          isEssential: newCatEssential,
                        },
                        "Categoria cadastrada."
                      );
                      if (ok) setNewCatName("");
                    }}
                    className="mt-3 flex flex-wrap items-center gap-2 text-xs"
                  >
                    <input
                      type="text"
                      required
                      placeholder="Nova categoria..."
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      className="flex-1 rounded-xl border border-slate-200 bg-[#F5F6FA] px-3 py-1.5"
                    />
                    <select
                      value={newCatType}
                      onChange={(e) =>
                        setNewCatType(e.target.value as "EXPENSE" | "INCOME")
                      }
                      className="rounded-xl border border-slate-200 bg-[#F5F6FA] px-2.5 py-1.5"
                    >
                      <option value="EXPENSE">Despesa</option>
                      <option value="INCOME">Receita</option>
                    </select>
                    <label className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600">
                      <input
                        type="checkbox"
                        checked={newCatEssential}
                        onChange={(e) => setNewCatEssential(e.target.checked)}
                      />
                      Essencial
                    </label>
                    <button
                      type="submit"
                      className="rounded-xl bg-[#6C5CE7] px-3 py-1.5 font-bold text-white"
                    >
                      Criar
                    </button>
                  </form>
                  <div className="mt-3 flex max-h-44 flex-wrap gap-1.5 overflow-y-auto">
                    {categories.map((cat) => (
                      <span
                        key={cat.id}
                        className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-[#F5F6FA] px-2.5 py-1 text-[11px] font-medium text-[#1E1B39]"
                      >
                        <span
                          className={`h-2 w-2 rounded-full ${
                            cat.type === "INCOME"
                              ? "bg-emerald-500"
                              : cat.isEssential
                              ? "bg-[#6C5CE7]"
                              : "bg-amber-500"
                          }`}
                        />
                        {cat.name}
                        <button
                          type="button"
                          onClick={() =>
                            executeAction(
                              {
                                action: "ARCHIVE_CATEGORY",
                                categoryId: cat.id,
                              },
                              "Categoria arquivada."
                            )
                          }
                          title="Arquivar categoria"
                          className="ml-0.5 text-slate-400 hover:text-rose-600"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Contrapartes (Clientes / Fornecedores) */}
                <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                    <Users className="h-4 w-4 text-[#6C5CE7]" />
                    <h3 className="text-sm font-extrabold text-[#1E1B39]">
                      Clientes &amp; Fornecedores ({counterparties.length})
                    </h3>
                  </div>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!newCpName.trim()) return;
                      const ok = await executeAction(
                        {
                          action: "CREATE_COUNTERPARTY",
                          name: newCpName,
                          type: newCpType,
                          document: newCpDoc || undefined,
                          costCenter: newCpCostCenter || undefined,
                        },
                        "Contraparte cadastrada."
                      );
                      if (ok) {
                        setNewCpName("");
                        setNewCpDoc("");
                      }
                    }}
                    className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-4"
                  >
                    <input
                      type="text"
                      required
                      placeholder="Nome / Razão Social"
                      value={newCpName}
                      onChange={(e) => setNewCpName(e.target.value)}
                      className="rounded-xl border border-slate-200 bg-[#F5F6FA] px-3 py-1.5 sm:col-span-2"
                    />
                    <input
                      type="text"
                      placeholder="CPF/CNPJ (opc.)"
                      value={newCpDoc}
                      onChange={(e) => setNewCpDoc(e.target.value)}
                      className="rounded-xl border border-slate-200 bg-[#F5F6FA] px-3 py-1.5 font-mono"
                    />
                    <button
                      type="submit"
                      className="rounded-xl bg-[#6C5CE7] px-3 py-1.5 font-bold text-white"
                    >
                      + Cadastrar
                    </button>
                  </form>
                  <div className="mt-3 max-h-44 space-y-1.5 overflow-y-auto text-xs">
                    {counterparties.length === 0 ? (
                      <p className="text-[11px] text-slate-400">
                        Nenhum cliente ou fornecedor cadastrado ainda.
                      </p>
                    ) : (
                      counterparties.map((cp) => (
                        <div
                          key={cp.id}
                          className="flex items-center justify-between rounded-lg bg-[#F5F6FA] px-3 py-1.5"
                        >
                          <div>
                            <span className="font-bold text-[#1E1B39]">
                              {cp.name}
                            </span>
                            {cp.document && (
                              <span className="ml-2 font-mono text-[10px] text-slate-500">
                                {cp.document}
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              executeAction(
                                {
                                  action: "DELETE_COUNTERPARTY",
                                  counterpartyId: cp.id,
                                },
                                "Contraparte removida."
                              )
                            }
                            className="text-slate-400 hover:text-rose-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
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
                <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                  <button
                    onClick={() =>
                      navigateRoute(
                        activeRoute === "contas-a-pagar"
                          ? "contas-a-receber"
                          : "contas-a-pagar"
                      )
                    }
                    className="min-h-[42px] flex-1 rounded-xl border border-slate-200 bg-[#F5F6FA] px-3.5 py-2 text-xs font-bold text-[#1E1B39] sm:flex-none"
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
                    className="inline-flex min-h-[42px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#6C5CE7] px-4 py-2 text-xs font-bold text-white sm:flex-none"
                  >
                    <Plus className="h-4 w-4" />
                    {activeRoute === "contas-a-receber"
                      ? "Novo Recebível"
                      : "Nova Conta a Pagar"}
                  </button>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs">
                {/* Versão Celular (<768px): Cartões de Parcelas e Baixa Rápida */}
                <div className="divide-y divide-slate-100 md:hidden">
                  {(activeRoute === "contas-a-pagar"
                    ? payableInstallments
                    : receivableInstallments
                  ).length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-500">
                      Nenhum compromisso registrado nesta visão.
                    </div>
                  ) : (
                    (activeRoute === "contas-a-pagar"
                      ? payableInstallments
                      : receivableInstallments
                    ).map((inst) => (
                      <div key={inst.id} className="space-y-3 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                              <span className="font-mono font-bold text-[#1E1B39]">
                                Vence {formatDateBR(inst.dueOn)}
                              </span>
                              <span>•</span>
                              <span className="font-mono font-semibold text-[#6C5CE7]">
                                Parcela {inst.number}/{inst.totalInstallments}
                              </span>
                            </div>
                            <div className="mt-0.5 text-sm font-extrabold text-[#1E1B39]">
                              {inst.obligationTitle}
                            </div>
                            <div className="mt-0.5 flex flex-wrap gap-1.5 text-[11px] text-slate-500">
                              {inst.counterparty && (
                                <span className="font-medium text-slate-700">
                                  {inst.counterparty}
                                </span>
                              )}
                              {inst.categoryName && (
                                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px]">
                                  {inst.categoryName}
                                </span>
                              )}
                            </div>
                          </div>

                          <span
                            className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
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
                        </div>

                        <div className="grid grid-cols-2 gap-2 rounded-xl bg-[#F5F6FA] p-3 text-xs">
                          <div>
                            <span className="block text-[10px] text-slate-500">
                              Valor Original
                            </span>
                            <span className="font-mono font-semibold text-slate-700">
                              {formatBRL(inst.amountCents)}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="block text-[10px] text-slate-500">
                              Saldo em Aberto
                            </span>
                            <span className="font-mono text-sm font-black text-[#1E1B39]">
                              {formatBRL(inst.outstandingCents)}
                            </span>
                          </div>
                        </div>

                        {inst.outstandingCents > 0 &&
                          inst.derivedStatus !== "CANCELED" && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  setSettlementTarget(inst);
                                  setSettleAmountDecimal(
                                    centsToDecimalString(inst.outstandingCents)
                                  );
                                }}
                                className="min-h-[40px] flex-1 rounded-xl bg-[#6C5CE7] px-3 py-2 text-xs font-bold text-white"
                              >
                                Registrar Baixa
                              </button>
                              <button
                                onClick={() =>
                                  executeAction(
                                    {
                                      action: "CANCEL_OBLIGATION",
                                      obligationId: inst.obligationId,
                                      reason:
                                        "Compromisso cancelado pelo usuário",
                                    },
                                    "Compromisso e parcelas em aberto cancelados."
                                  )
                                }
                                className="min-h-[40px] rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-800"
                              >
                                Cancelar
                              </button>
                            </div>
                          )}
                      </div>
                    ))
                  )}
                </div>

                {/* Versão Tablet & Desktop (>=768px): Tabela Completa */}
                <div className="hidden overflow-x-auto md:block">
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
                              {inst.outstandingCents > 0 &&
                                inst.derivedStatus !== "CANCELED" && (
                                  <div className="inline-flex flex-wrap justify-end gap-1.5">
                                    <button
                                      onClick={() => {
                                        setSettlementTarget(inst);
                                        setSettleAmountDecimal(
                                          centsToDecimalString(
                                            inst.outstandingCents
                                          )
                                        );
                                      }}
                                      className="rounded-lg bg-[#6C5CE7] px-3 py-1 text-[11px] font-bold text-white hover:bg-[#5849BE]"
                                    >
                                      Registrar Baixa
                                    </button>
                                    <button
                                      onClick={() =>
                                        executeAction(
                                          {
                                            action: "CANCEL_OBLIGATION",
                                            obligationId: inst.obligationId,
                                            reason:
                                              "Compromisso cancelado pelo usuário",
                                          },
                                          "Compromisso e parcelas em aberto cancelados."
                                        )
                                      }
                                      title="Cancelar obrigação em aberto"
                                      className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-[10px] font-semibold text-rose-800 hover:bg-rose-100"
                                    >
                                      Cancelar
                                    </button>
                                  </div>
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
                <div className="no-scrollbar -mx-1 flex w-full flex-nowrap gap-1.5 overflow-x-auto px-1 pb-1 sm:mx-0 sm:w-auto sm:flex-wrap sm:pb-0">
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
                        className={`inline-flex min-h-[38px] shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold whitespace-nowrap transition ${
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
                  className="flex w-full flex-wrap items-center gap-2 text-xs sm:w-auto"
                >
                  <span className="font-semibold text-slate-600">
                    Margem de Segurança (B): R$
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={bufferInputDecimal}
                    onChange={(e) => setBufferInputDecimal(e.target.value)}
                    className="min-h-[38px] w-28 flex-1 rounded-lg border border-slate-200 bg-[#F5F6FA] px-2.5 py-1.5 font-mono text-xs font-bold text-[#1E1B39] sm:flex-none"
                  />
                  <button
                    type="submit"
                    className="min-h-[38px] rounded-lg bg-[#6C5CE7] px-3.5 py-1.5 font-bold text-white"
                  >
                    Salvar
                  </button>
                </form>
              </div>

              {/* Visão Consolidada: Motor Inteligente de Capacidade de Reserva + Simulação */}
              {activeRoute === "planejamento" && (
                <IntelligenceEngineCard
                  reserveCapacity={reserveCapacityEngine}
                  workspaceType={isPJ ? "PJ" : "PF"}
                  onUpdateSafetyMargin={async (cents) => {
                    await executeAction(
                      {
                        action: "UPDATE_SAFETY_BUFFER",
                        safetyBufferDecimal: centsToDecimalString(cents),
                      },
                      "Margem de segurança atualizada."
                    );
                  }}
                  onQuickAllocate={(cents) => {
                    if (reserves[0]) {
                      setReserveActionModal({
                        reserve: reserves[0],
                        mode: "ALLOCATE",
                      });
                      setResMoveAmountDecimal(centsToDecimalString(cents));
                    } else {
                      setShowReserveModal(true);
                    }
                  }}
                />
              )}

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
                        list="nova-budget-categories"
                        value={budgetCat}
                        onChange={(e) => setBudgetCat(e.target.value)}
                        className="mt-1 rounded-xl border border-slate-200 bg-[#F5F6FA] px-3 py-1.5 text-xs"
                      />
                      <datalist id="nova-budget-categories">
                        {categories
                          .filter((c) => c.type === "EXPENSE")
                          .map((c) => (
                            <option key={c.id} value={c.name} />
                          ))}
                      </datalist>
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
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-extrabold text-[#1E1B39]">
                            {b.categoryName} ({b.period})
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="rounded-full bg-[#EFEFFD] px-2.5 py-0.5 font-mono text-xs font-bold text-[#6C5CE7]">
                              {b.usagePct}% do teto
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                executeAction(
                                  {
                                    action: "DELETE_BUDGET",
                                    budgetId: b.id,
                                  },
                                  "Orçamento removido."
                                )
                              }
                              title="Excluir orçamento"
                              className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] font-bold text-rose-700 hover:bg-rose-100"
                            >
                              Excluir
                            </button>
                          </div>
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
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
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
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <h4 className="font-extrabold text-[#1E1B39]">
                              {g.name}
                            </h4>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                                g.status === "ACHIEVED"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : g.status === "PAUSED"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-[#EFEFFD] text-[#6C5CE7]"
                              }`}
                            >
                              {g.status}
                            </span>
                          </div>
                          <span className="font-mono text-xs font-bold text-[#6C5CE7]">
                            {g.progressPct}%
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
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
                        <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-3">
                          {g.status !== "ACHIEVED" && (
                            <button
                              type="button"
                              onClick={() =>
                                executeAction(
                                  {
                                    action: "UPDATE_GOAL_STATUS",
                                    goalId: g.id,
                                    status: "ACHIEVED",
                                  },
                                  "Meta marcada como concluída!"
                                )
                              }
                              className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-emerald-700"
                            >
                              Concluir Meta
                            </button>
                          )}
                          {g.status === "ACTIVE" ? (
                            <button
                              type="button"
                              onClick={() =>
                                executeAction(
                                  {
                                    action: "UPDATE_GOAL_STATUS",
                                    goalId: g.id,
                                    status: "PAUSED",
                                  },
                                  "Meta pausada."
                                )
                              }
                              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-700"
                            >
                              Pausar
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                executeAction(
                                  {
                                    action: "UPDATE_GOAL_STATUS",
                                    goalId: g.id,
                                    status: "ACTIVE",
                                  },
                                  "Meta reativada."
                                )
                              }
                              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-700"
                            >
                              Reativar
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              executeAction(
                                {
                                  action: "UPDATE_GOAL_STATUS",
                                  goalId: g.id,
                                  status: "DELETE",
                                },
                                "Meta removida."
                              )
                            }
                            className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-[10px] font-bold text-rose-700"
                          >
                            Excluir
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Subtela: Calendário Preditivo 21d + Assistente Financeiro Determinístico */}
              {activeRoute === "planejamento/calendario" && (
                <AssistantAndCalendarView
                  workspaceType={isPJ ? "PJ" : "PF"}
                  workspaceName={activeWorkspace.name}
                  reserveCapacity={reserveCapacityEngine}
                  predictiveCalendar={
                    state.analytics?.predictiveCalendar21d ?? []
                  }
                  transactions={transactions.map((t) => ({
                    id: t.id,
                    type: t.kind,
                    status: t.status,
                    amountCents: t.amountCents,
                    description: t.description,
                    category: t.categoryName || "Geral",
                    costCenter: t.costCenter || "Geral",
                    essentiality:
                      t.isEssential === false ? "DISCRETIONARY" : "ESSENTIAL",
                  }))}
                  totalInvestmentsCents={p03Summary.totalEstimatedNetCents}
                />
              )}

              {/* Série Diária de Fluxo de Caixa / Calendário Financeiro */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
                <h3 className="text-sm font-bold text-[#1E1B39]">
                  Série Diária do Fluxo de Caixa e Calendário ({horizonDays}{" "}
                  dias • Cenário {scenarioKind})
                </h3>

                {/* Versão Celular (<768px): Cartões Diários sem rolagem horizontal */}
                <div className="mt-3 max-h-96 divide-y divide-slate-100 overflow-y-auto md:hidden">
                  {forecastSeries.map((pt) => (
                    <div
                      key={pt.date}
                      className={`space-y-1.5 py-3 text-xs ${
                        pt.isNegative
                          ? "rounded-xl bg-rose-50 px-3"
                          : pt.isCritical
                          ? "rounded-xl bg-amber-50/70 px-3"
                          : ""
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-extrabold text-[#1E1B39]">
                          {formatDateBR(pt.date)}
                        </span>
                        {pt.isNegative ? (
                          <span className="rounded bg-rose-200 px-2 py-0.5 text-[10px] font-bold text-rose-900">
                            Saldo Negativo
                          </span>
                        ) : pt.isCritical ? (
                          <span className="rounded bg-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                            Abaixo da Margem
                          </span>
                        ) : (
                          <span className="text-[11px] font-semibold text-emerald-700">
                            Normal
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[11px]">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-slate-500">
                            Inic: {formatBRL(pt.startingCents)}
                          </span>
                          {pt.inboundCents > 0 && (
                            <span className="font-bold text-emerald-700">
                              +{formatBRL(pt.inboundCents)}
                            </span>
                          )}
                          {pt.outboundCents > 0 && (
                            <span className="font-bold text-amber-800">
                              -{formatBRL(pt.outboundCents)}
                            </span>
                          )}
                        </div>
                        <span className="font-extrabold text-[#6C5CE7]">
                          Final: {formatBRL(pt.endingCents)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Versão Tablet & Desktop (>=768px): Tabela Analítica */}
                <div className="mt-4 hidden max-h-96 overflow-y-auto md:block">
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

              {/* Motor Inteligente de Capacidade de Reserva + Simulador Rápido */}
              <IntelligenceEngineCard
                reserveCapacity={reserveCapacityEngine}
                workspaceType={isPJ ? "PJ" : "PF"}
                onUpdateSafetyMargin={async (cents) => {
                  await executeAction(
                    {
                      action: "UPDATE_SAFETY_BUFFER",
                      safetyBufferDecimal: centsToDecimalString(cents),
                    },
                    "Margem de segurança atualizada."
                  );
                }}
                onQuickAllocate={(cents) => {
                  if (reserves[0]) {
                    setReserveActionModal({
                      reserve: reserves[0],
                      mode: "ALLOCATE",
                    });
                    setResMoveAmountDecimal(centsToDecimalString(cents));
                  } else {
                    setShowReserveModal(true);
                  }
                }}
              />

              {/* Resumo de Cobertura */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
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

              {/* Simulador de Juros Compostos da Reserva Inteligente */}
              <ReserveSimulatorCard
                reservePotentialCents={Math.max(100000, kpis.headroomCents)}
              />

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
              p05Canonical={state.p05Canonical}
              onExecuteAction={executeAction}
              onNavigateRoute={(r) => navigateRoute(r as NovaRouteKey)}
            />
          )}

          {/* =================================================================
              TELA L (P11): DEMONSTRATIVO GERENCIAL PF / DRE SIMPLIFICADO PJ
             ================================================================= */}
          {activeRoute === "relatorios" && (
            <div className="space-y-6 print:space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
                <div>
                  <h2 className="text-lg font-extrabold text-[#1E1B39]">
                    {isPJ
                      ? `DRE Gerencial Simplificado & Fluxo por Competência (${activeWorkspace.name})`
                      : `Demonstrativo Financeiro Consolidado PF (${activeWorkspace.name})`}
                  </h2>
                  <p className="text-xs text-slate-500">
                    Apuração auditável de receitas e despesas realizadas vs.
                    projetadas, concentração por categoria e ranking de{" "}
                    {isPJ ? "clientes/fornecedores" : "contrapartes"} — com
                    exportação CSV blindada contra injeção de fórmulas.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 print:hidden">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-[#1E1B39] hover:bg-slate-50"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    Imprimir / PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const header = [
                        "Data",
                        "Descricao",
                        "Categoria",
                        "Contraparte",
                        "Centro_Custo",
                        "Tipo",
                        "Status",
                        "Valor_BRL",
                      ]
                        .map((h) => sanitizeCsvCell(h))
                        .join(",");
                      const rows = transactions.map((t) =>
                        [
                          sanitizeCsvCell(t.occurredOn),
                          sanitizeCsvCell(t.description),
                          sanitizeCsvCell(t.categoryName || "Geral"),
                          sanitizeCsvCell(t.counterpartyName || ""),
                          sanitizeCsvCell(t.costCenter || ""),
                          sanitizeCsvCell(t.kind),
                          sanitizeCsvCell(t.status),
                          sanitizeCsvCell(centsToDecimalString(t.amountCents)),
                        ].join(",")
                      );
                      const csv = [header, ...rows].join("\n");
                      const blob = new Blob(["\uFEFF" + csv], {
                        type: "text/csv;charset=utf-8;",
                      });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `ledger-nova-${activeWorkspace.id}.csv`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[#6C5CE7]/30 bg-[#EFEFFD] px-3.5 py-2 text-xs font-bold text-[#6C5CE7] hover:bg-[#E2E0FC]"
                  >
                    <Download className="h-3.5 w-3.5" />
                    CSV Ledger Seguro
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const monthly = state.analytics?.monthlySummary ?? [];
                      const header = [
                        "Competencia",
                        "Receitas_Realizadas_BRL",
                        "Despesas_Realizadas_BRL",
                        "Resultado_Realizado_BRL",
                        "Receitas_Previstas_BRL",
                        "Despesas_Previstas_BRL",
                        "Resultado_Projetado_BRL",
                      ]
                        .map((h) => sanitizeCsvCell(h))
                        .join(",");
                      const rows = monthly.map((m) =>
                        [
                          sanitizeCsvCell(m.period),
                          sanitizeCsvCell(
                            centsToDecimalString(m.realizedIncomeCents)
                          ),
                          sanitizeCsvCell(
                            centsToDecimalString(m.realizedExpenseCents)
                          ),
                          sanitizeCsvCell(
                            centsToDecimalString(m.netRealizedCents)
                          ),
                          sanitizeCsvCell(
                            centsToDecimalString(m.projectedIncomeCents)
                          ),
                          sanitizeCsvCell(
                            centsToDecimalString(m.projectedExpenseCents)
                          ),
                          sanitizeCsvCell(
                            centsToDecimalString(m.netProjectedCents)
                          ),
                        ].join(",")
                      );
                      const csv = [header, ...rows].join("\n");
                      const blob = new Blob(["\uFEFF" + csv], {
                        type: "text/csv;charset=utf-8;",
                      });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `dre-mensal-${activeWorkspace.id}.csv`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#6C5CE7] px-4 py-2 text-xs font-bold text-white hover:bg-[#5849BE]"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Exportar DRE Mensal CSV
                  </button>
                </div>
              </div>

              {/* 4 KPIs Executivos do Período */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
                  <span className="text-xs font-semibold text-slate-500">
                    {isPJ ? "Receita Operacional Realizada" : "Receitas Realizadas"}
                  </span>
                  <div className="mt-1 font-mono text-2xl font-extrabold text-emerald-700">
                    {formatBRL(kpis.settledIncomeCents)}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
                  <span className="text-xs font-semibold text-slate-500">
                    {isPJ ? "Saídas / Custos Realizados" : "Despesas Realizadas"}
                  </span>
                  <div className="mt-1 font-mono text-2xl font-extrabold text-rose-700">
                    {formatBRL(kpis.settledExpenseCents)}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
                  <span className="text-xs font-semibold text-slate-500">
                    {isPJ ? "Resultado Caixa Líquido" : "Superávit / Déficit Realizado"}
                  </span>
                  <div
                    className={`mt-1 font-mono text-2xl font-extrabold ${
                      kpis.settledIncomeCents - kpis.settledExpenseCents >= 0
                        ? "text-[#1E1B39]"
                        : "text-rose-700"
                    }`}
                  >
                    {formatBRL(
                      kpis.settledIncomeCents - kpis.settledExpenseCents
                    )}
                  </div>
                </div>
                <div className="rounded-2xl bg-gradient-to-br from-[#6C5CE7] to-[#5849BE] p-4 text-white shadow-xs">
                  <span className="text-xs font-bold text-violet-100">
                    {isPJ ? "Margem Líquida de Caixa" : "Taxa de Poupança Realizada"}
                  </span>
                  <div className="mt-1 font-mono text-2xl font-black">
                    {kpis.settledIncomeCents > 0
                      ? `${Math.round(
                          ((kpis.settledIncomeCents - kpis.settledExpenseCents) /
                            kpis.settledIncomeCents) *
                            1000
                        ) / 10}%`
                      : "0%"}
                  </div>
                </div>
              </div>

              {/* Tabela Mensal: Demonstrativo / DRE por Competência */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
                <h3 className="text-sm font-extrabold text-[#1E1B39]">
                  Demonstrativo Mensal — Realizado vs. Projetado (Ledger + Parcelas + Recorrências Ativas)
                </h3>

                {/* Versão Celular (<768px): Cartões de Competência Mensal */}
                <div className="mt-4 space-y-3 md:hidden">
                  {(state.analytics?.monthlySummary ?? []).length === 0 ? (
                    <p className="py-4 text-center text-xs text-slate-400">
                      Nenhuma movimentação ou projeção registrada até o momento.
                    </p>
                  ) : (
                    (state.analytics?.monthlySummary ?? []).map((row) => {
                      const openNet =
                        row.projectedIncomeCents - row.projectedExpenseCents;
                      return (
                        <div
                          key={row.period}
                          className="space-y-2 rounded-xl border border-slate-200/80 bg-[#F5F6FA] p-3.5 text-xs"
                        >
                          <div className="flex items-center justify-between border-b border-slate-200/70 pb-2">
                            <span className="font-mono text-sm font-extrabold text-[#1E1B39]">
                              Competência {row.period}
                            </span>
                            <span
                              className={`font-mono font-black ${
                                row.netProjectedCents >= 0
                                  ? "text-[#6C5CE7]"
                                  : "text-rose-700"
                              }`}
                            >
                              Proj: {formatBRL(row.netProjectedCents)}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                            <div>
                              <span className="block font-sans text-[10px] text-slate-500">
                                Receita Realizada
                              </span>
                              <span className="font-bold text-emerald-700">
                                +{formatBRL(row.realizedIncomeCents)}
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="block font-sans text-[10px] text-slate-500">
                                Despesa Realizada
                              </span>
                              <span className="font-bold text-rose-700">
                                -{formatBRL(row.realizedExpenseCents)}
                              </span>
                            </div>
                            <div>
                              <span className="block font-sans text-[10px] text-slate-500">
                                Resultado Realizado
                              </span>
                              <span
                                className={`font-bold ${
                                  row.netRealizedCents >= 0
                                    ? "text-emerald-700"
                                    : "text-rose-700"
                                }`}
                              >
                                {formatBRL(row.netRealizedCents)}
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="block font-sans text-[10px] text-slate-500">
                                Aberto / Recorrente
                              </span>
                              <span className="font-semibold text-slate-700">
                                {openNet >= 0 ? "+" : ""}
                                {formatBRL(openNet)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Versão Tablet & Desktop (>=768px): Tabela Completa */}
                <div className="mt-4 hidden overflow-x-auto md:block">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-200 bg-[#F5F6FA] text-[11px] font-bold uppercase text-slate-500">
                      <tr>
                        <th className="px-3 py-2.5">Competência</th>
                        <th className="px-3 py-2.5 text-right">
                          Receita Realizada
                        </th>
                        <th className="px-3 py-2.5 text-right">
                          Despesa Realizada
                        </th>
                        <th className="px-3 py-2.5 text-right">
                          Resultado Realizado
                        </th>
                        <th className="px-3 py-2.5 text-right">
                          Aberto / Recorrente ( Líq. )
                        </th>
                        <th className="px-3 py-2.5 text-right">
                          Resultado Projetado
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {(state.analytics?.monthlySummary ?? []).length === 0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="px-3 py-6 text-center font-sans text-xs text-slate-400"
                          >
                            Nenhuma movimentação ou projeção registrada até o momento.
                          </td>
                        </tr>
                      ) : (
                        (state.analytics?.monthlySummary ?? []).map((row) => {
                          const openNet =
                            row.projectedIncomeCents -
                            row.projectedExpenseCents;
                          return (
                            <tr key={row.period} className="hover:bg-slate-50/70">
                              <td className="px-3 py-2.5 font-bold text-[#1E1B39]">
                                {row.period}
                              </td>
                              <td className="px-3 py-2.5 text-right text-emerald-700">
                                +{formatBRL(row.realizedIncomeCents)}
                              </td>
                              <td className="px-3 py-2.5 text-right text-rose-700">
                                -{formatBRL(row.realizedExpenseCents)}
                              </td>
                              <td
                                className={`px-3 py-2.5 text-right font-bold ${
                                  row.netRealizedCents >= 0
                                    ? "text-emerald-700"
                                    : "text-rose-700"
                                }`}
                              >
                                {formatBRL(row.netRealizedCents)}
                              </td>
                              <td className="px-3 py-2.5 text-right text-slate-600">
                                {openNet >= 0 ? "+" : ""}
                                {formatBRL(openNet)}
                              </td>
                              <td
                                className={`px-3 py-2.5 text-right font-extrabold ${
                                  row.netProjectedCents >= 0
                                    ? "text-[#6C5CE7]"
                                    : "text-rose-700"
                                }`}
                              >
                                {formatBRL(row.netProjectedCents)}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Breakdown por Categoria e Ranking de Contrapartes */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-extrabold text-[#1E1B39]">
                      Concentração de Saídas por Categoria
                    </h3>
                    <span className="rounded-full bg-[#EFEFFD] px-2.5 py-0.5 font-mono text-[11px] font-bold text-[#6C5CE7]">
                      Maior fatia:{" "}
                      {state.analytics?.topExpenseCategorySharePct ?? 0}%
                    </span>
                  </div>
                  <div className="mt-4 space-y-3 text-xs">
                    {(state.analytics?.categoryBreakdown ?? []).length === 0 ? (
                      <p className="text-slate-400">
                        Sem despesas classificadas para compor o ranking.
                      </p>
                    ) : (
                      (state.analytics?.categoryBreakdown ?? []).map((cat) => (
                        <div key={cat.categoryName} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-[#1E1B39]">
                                {cat.categoryName}
                              </span>
                              <span
                                className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                                  cat.isEssential
                                    ? "bg-[#EFEFFD] text-[#6C5CE7]"
                                    : "bg-amber-50 text-amber-800"
                                }`}
                              >
                                {cat.isEssential
                                  ? "Essencial"
                                  : "Discricionária"}
                              </span>
                            </div>
                            <span className="font-mono font-bold text-[#1E1B39]">
                              {formatBRL(cat.totalCents)} ({cat.sharePct}%)
                            </span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                            <div
                              style={{
                                width: `${Math.min(100, cat.sharePct)}%`,
                              }}
                              className={`h-full ${
                                cat.sharePct > 50
                                  ? "bg-rose-500"
                                  : "bg-[#6C5CE7]"
                              }`}
                            />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
                  <h3 className="text-sm font-extrabold text-[#1E1B39]">
                    Ranking de {isPJ ? "Clientes & Fornecedores" : "Contrapartes"}
                  </h3>
                  <div className="mt-4 space-y-2 text-xs">
                    {(state.analytics?.counterpartyBreakdown ?? []).length ===
                    0 ? (
                      <p className="text-slate-400">
                        Vincule clientes ou fornecedores aos lançamentos e obrigações para visualizar concentração comercial.
                      </p>
                    ) : (
                      (state.analytics?.counterpartyBreakdown ?? []).map(
                        (cp) => (
                          <div
                            key={cp.name}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#F5F6FA] px-3.5 py-2.5"
                          >
                            <div>
                              <span className="font-bold text-[#1E1B39]">
                                {cp.name}
                              </span>
                              <span className="ml-2 text-[10px] text-slate-500">
                                ({cp.txCount} reg.)
                              </span>
                              {cp.costCenter && (
                                <span className="ml-2 rounded bg-white px-1.5 py-0.5 text-[10px] text-slate-600">
                                  CC: {cp.costCenter}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 font-mono text-[11px]">
                              {cp.totalIncomeCents > 0 && (
                                <span className="font-bold text-emerald-700">
                                  +{formatBRL(cp.totalIncomeCents)}
                                </span>
                              )}
                              {cp.totalExpenseCents > 0 && (
                                <span className="font-bold text-rose-700">
                                  -{formatBRL(cp.totalExpenseCents)}
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      )
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =================================================================
              TELA M (P10): GOVERNANÇA RBAC MULTI-USUÁRIO, SESSÕES & AUDITORIA
             ================================================================= */}
          {(activeRoute === "configuracoes" || activeRoute === "auditoria") && (
            <div className="space-y-6">
              {/* Gestão Multi-Usuário RBAC */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <h2 className="text-lg font-extrabold text-[#1E1B39]">
                      Governança Multi-Usuário &amp; Permissões RBAC
                    </h2>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Seu papel atual neste ambiente:{" "}
                      <strong className="text-[#6C5CE7]">{currentRole}</strong>.{" "}
                      {isPJ
                        ? "Convide sócios, gestores financeiros ou contadores (VIEWER somente leitura)."
                        : "Compartilhe o planejamento familiar com controle estrito de alçada."}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={!canAdminWorkspace}
                    onClick={() =>
                      executeAction(
                        {
                          action: "SET_WORKSPACE_RECONCILED",
                          reconciled: !(
                            state.p05Canonical?.reconciled ??
                            activeWorkspace.reconciled ??
                            false
                          ),
                        },
                        "Status de conciliação contábil do ambiente atualizado."
                      )
                    }
                    className={`rounded-xl px-3.5 py-2 text-xs font-bold transition disabled:opacity-50 ${
                      state.p05Canonical?.reconciled ??
                      activeWorkspace.reconciled
                        ? "bg-emerald-100 text-emerald-800"
                        : "border border-slate-200 bg-[#F5F6FA] text-slate-700"
                    }`}
                  >
                    {state.p05Canonical?.reconciled ??
                    activeWorkspace.reconciled
                      ? "✓ Ambiente Conciliado (P05)"
                      : "Marcar Ambiente Conciliado"}
                  </button>
                </div>

                {canAdminWorkspace && (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!inviteEmail.trim()) return;
                      const ok = await executeAction(
                        {
                          action: "INVITE_WORKSPACE_MEMBER",
                          email: inviteEmail.trim(),
                          role: inviteRole,
                        },
                        `Membro ${inviteEmail.trim()} vinculado com papel ${inviteRole}.`
                      );
                      if (ok) setInviteEmail("");
                    }}
                    className="mt-4 flex flex-wrap items-center gap-2.5 text-xs"
                  >
                    <input
                      type="email"
                      required
                      placeholder="E-mail de usuário já cadastrado na NOVA..."
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="min-w-[240px] flex-1 rounded-xl border border-slate-200 bg-[#F5F6FA] px-3.5 py-2"
                    />
                    <select
                      value={inviteRole}
                      onChange={(e) =>
                        setInviteRole(
                          e.target.value as "ADMIN" | "EDITOR" | "VIEWER"
                        )
                      }
                      className="rounded-xl border border-slate-200 bg-[#F5F6FA] px-3 py-2 font-semibold"
                    >
                      <option value="ADMIN">ADMIN (Gestão Total)</option>
                      <option value="EDITOR">EDITOR (Operação Financeira)</option>
                      <option value="VIEWER">VIEWER (Contador / Leitura)</option>
                    </select>
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#6C5CE7] px-4 py-2 font-bold text-white hover:bg-[#5849BE]"
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      Adicionar Membro
                    </button>
                  </form>
                )}

                <div className="mt-4 space-y-2 text-xs">
                  {memberships.map((m) => (
                    <div
                      key={m.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/70 bg-[#F5F6FA] px-4 py-3"
                    >
                      <div>
                        <span className="font-extrabold text-[#1E1B39]">
                          {m.user?.name || m.userId}
                        </span>
                        {m.user?.email && (
                          <span className="ml-2 text-slate-500">
                            ({m.user.email})
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {canAdminWorkspace && m.role !== "OWNER" ? (
                          <>
                            <select
                              value={m.role}
                              onChange={(e) =>
                                executeAction(
                                  {
                                    action: "UPDATE_MEMBER_ROLE",
                                    targetUserId: m.userId,
                                    role: e.target.value,
                                  },
                                  "Papel de acesso atualizado."
                                )
                              }
                              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-[#6C5CE7]"
                            >
                              <option value="ADMIN">ADMIN</option>
                              <option value="EDITOR">EDITOR</option>
                              <option value="VIEWER">VIEWER</option>
                            </select>
                            <button
                              type="button"
                              onClick={() =>
                                executeAction(
                                  {
                                    action: "REMOVE_WORKSPACE_MEMBER",
                                    targetUserId: m.userId,
                                  },
                                  "Acesso do membro revogado."
                                )
                              }
                              className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-100"
                            >
                              Remover
                            </button>
                          </>
                        ) : (
                          <span className="rounded-full bg-[#EFEFFD] px-3 py-1 font-mono text-[11px] font-bold text-[#6C5CE7]">
                            {m.role}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Segurança de Sessão P09 */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-extrabold text-[#1E1B39]">
                      Segurança de Autenticação &amp; Sessões Ativas (P09)
                    </h3>
                    <p className="text-xs text-slate-500">
                      {currentUserInfo
                        ? `Conectado como ${currentUserInfo.name} (${currentUserInfo.email}) • ${activeSessions.length} sessão(ões) ativa(s).`
                        : "Sessão protegida via cookie HttpOnly + validação transacional."}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {activeSessions.length > 1 && (
                      <button
                        type="button"
                        onClick={handleRevokeOtherSessions}
                        className="rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-bold text-amber-900 hover:bg-amber-100"
                      >
                        Encerrar Outras Sessões ({activeSessions.length - 1})
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      Encerrar Sessão Atual
                    </button>
                  </div>
                </div>
                {activeSessions.length > 0 && (
                  <div className="mt-3 grid grid-cols-1 gap-2 text-[11px] md:grid-cols-2">
                    {activeSessions.map((sess) => (
                      <div
                        key={sess.id}
                        className="flex items-center justify-between rounded-xl border border-slate-200/70 bg-[#F5F6FA] px-3 py-2"
                      >
                        <div className="truncate pr-2">
                          <span className="font-bold text-[#1E1B39]">
                            {sess.isCurrent ? "● Dispositivo Atual" : "Sessão Secundária"}
                          </span>
                          <p className="truncate text-[10px] text-slate-500">
                            {sess.userAgent || "Navegador Web"}
                          </p>
                        </div>
                        <span className="shrink-0 font-mono text-[10px] text-slate-500">
                          Expira {formatDateBR(sess.expiresAt.slice(0, 10))}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Trilha Imutável de Auditoria */}
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
              accounts={accounts}
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
          BARRA DE NAVEGAÇÃO INFERIOR NATIVA PARA CELULAR (<768px | SAFE AREA)
          Em Tablets (>=768px) a navegação usa o Rail Vertical dedicado à esquerda
         ===================================================================== */}
      <nav className="pb-safe fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-slate-200/90 bg-white/95 px-2 pt-1.5 backdrop-blur-md md:hidden">
        <button
          onClick={() => navigateRoute("visao-geral")}
          className={`flex min-h-[46px] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-1 text-[10px] font-bold transition ${
            activeRoute === "visao-geral" ? "text-[#6C5CE7]" : "text-slate-500"
          }`}
        >
          <LayoutDashboard className="h-5 w-5" />
          <span>Início</span>
        </button>

        <button
          onClick={() =>
            navigateRoute(
              accounts.length === 0 ? "contas" : "movimentacoes"
            )
          }
          className={`flex min-h-[46px] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-1 text-[10px] font-bold transition ${
            activeRoute === "contas" ||
            activeRoute === "movimentacoes" ||
            activeRoute === "contas-a-pagar" ||
            activeRoute === "contas-a-receber" ||
            activeRoute === "reservas"
              ? "text-[#6C5CE7]"
              : "text-slate-500"
          }`}
        >
          <Wallet className="h-5 w-5" />
          <span>Financeiro</span>
        </button>

        <div className="flex flex-1 flex-col items-center justify-center">
          <button
            onClick={() => setShowQuickActionSheet(true)}
            aria-label="Lançamento rápido"
            className="-mt-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#6C5CE7] to-[#4834D4] text-white shadow-lg shadow-[#6C5CE7]/35 active:scale-95"
          >
            <Plus className="h-6 w-6" />
          </button>
          <span className="mt-0.5 text-[10px] font-extrabold text-[#6C5CE7]">
            Lançar
          </span>
        </div>

        <button
          onClick={() => navigateRoute("planejamento")}
          className={`flex min-h-[46px] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-1 text-[10px] font-bold transition ${
            activeRoute.startsWith("planejamento") ||
            activeRoute === "fluxo-de-caixa"
              ? "text-[#6C5CE7]"
              : "text-slate-500"
          }`}
        >
          <Compass className="h-5 w-5" />
          <span>Planejar</span>
        </button>

        <button
          onClick={() => navigateRoute("investimentos")}
          className={`flex min-h-[46px] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-1 text-[10px] font-bold transition ${
            activeRoute === "investimentos" || activeRoute === "simulacoes"
              ? "text-[#6C5CE7]"
              : "text-slate-500"
          }`}
        >
          <Layers className="h-5 w-5" />
          <span>Investir</span>
        </button>
      </nav>

      {/* =====================================================================
          BOTTOM SHEET DE AÇÕES RÁPIDAS MOBILE / TABLET (1 TOQUE)
         ===================================================================== */}
      {showQuickActionSheet && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-[#1E1B39]/55 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={() => setShowQuickActionSheet(false)}
        >
          <div
            className="pb-safe max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-2xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-200 sm:hidden" />
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-[#1E1B39]">
                  Ações Rápidas • {activeWorkspace.name}
                </h3>
                <p className="text-xs text-slate-500">
                  Escolha o que deseja registrar agora
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowQuickActionSheet(false)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F5F6FA] text-slate-600"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2.5 text-left text-xs">
              <button
                type="button"
                onClick={() => {
                  setShowQuickActionSheet(false);
                  if (accounts.length === 0) {
                    setShowAccountModal(true);
                  } else {
                    setTxKind("INCOME");
                    setShowTxModal(true);
                  }
                }}
                className="flex flex-col gap-2 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3.5 transition active:scale-[0.98]"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white">
                  <ArrowUpRight className="h-4 w-4" />
                </span>
                <div>
                  <div className="font-extrabold text-[#1E1B39]">
                    Nova Receita
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Entrada no caixa
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowQuickActionSheet(false);
                  if (accounts.length === 0) {
                    setShowAccountModal(true);
                  } else {
                    setTxKind("EXPENSE");
                    setShowTxModal(true);
                  }
                }}
                className="flex flex-col gap-2 rounded-2xl border border-rose-200 bg-rose-50/70 p-3.5 transition active:scale-[0.98]"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-600 text-white">
                  <ArrowDownRight className="h-4 w-4" />
                </span>
                <div>
                  <div className="font-extrabold text-[#1E1B39]">
                    Nova Despesa
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Saída ou pagamento
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowQuickActionSheet(false);
                  setObDirection("PAYABLE");
                  setShowObligationModal(true);
                }}
                className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-[#F5F6FA] p-3.5 transition active:scale-[0.98]"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EFEFFD] text-[#6C5CE7]">
                  <CalendarClock className="h-4 w-4" />
                </span>
                <div>
                  <div className="font-extrabold text-[#1E1B39]">
                    Conta a Pagar / Receber
                  </div>
                  <div className="text-[11px] text-slate-500">
                    1 a 60 parcelas
                  </div>
                </div>
              </button>

              <button
                type="button"
                disabled={accounts.length < 2}
                onClick={() => {
                  setShowQuickActionSheet(false);
                  setShowTransferModal(true);
                }}
                className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-[#F5F6FA] p-3.5 transition active:scale-[0.98] disabled:opacity-45"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EFEFFD] text-[#6C5CE7]">
                  <ArrowLeftRight className="h-4 w-4" />
                </span>
                <div>
                  <div className="font-extrabold text-[#1E1B39]">
                    Transferência
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Entre contas próprias
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowQuickActionSheet(false);
                  setShowAccountModal(true);
                }}
                className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-[#F5F6FA] p-3.5 transition active:scale-[0.98]"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EFEFFD] text-[#6C5CE7]">
                  <Wallet className="h-4 w-4" />
                </span>
                <div>
                  <div className="font-extrabold text-[#1E1B39]">
                    Cadastrar Conta
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Banco ou carteira
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowQuickActionSheet(false);
                  setShowReserveModal(true);
                }}
                className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-[#F5F6FA] p-3.5 transition active:scale-[0.98]"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EFEFFD] text-[#6C5CE7]">
                  <Shield className="h-4 w-4" />
                </span>
                <div>
                  <div className="font-extrabold text-[#1E1B39]">
                    Criar Cofre
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Reserva virtual
                  </div>
                </div>
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowQuickActionSheet(false);
                navigateRoute("integracoes/importacoes");
              }}
              className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-[#6C5CE7]/30 bg-[#EFEFFD] px-4 py-2.5 text-xs font-bold text-[#6C5CE7]"
            >
              <Link2 className="h-4 w-4" />
              Importar Extrato (.CSV / .OFX) ou Conciliar
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAIS DE OPERAÇÃO — BOTTOM-SHEET NO CELULAR & MODAL NO TABLET/DESKTOP
         ===================================================================== */}
      {showAccountModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#1E1B39]/55 p-0 backdrop-blur-sm sm:items-center sm:p-4">
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
            className="pb-safe max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-2xl sm:p-6"
          >
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-200 sm:hidden" />
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
                  className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-200 bg-[#F5F6FA] px-3 py-2"
                />
              </div>
              <div>
                <label className="font-bold">Tipo</label>
                <select
                  value={accType}
                  onChange={(e) => setAccType(e.target.value)}
                  className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-200 bg-[#F5F6FA] px-3 py-2"
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
                  inputMode="decimal"
                  value={accOpeningDecimal}
                  onChange={(e) => setAccOpeningDecimal(e.target.value)}
                  className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-200 bg-[#F5F6FA] px-3 py-2 font-mono"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAccountModal(false)}
                className="min-h-[44px] flex-1 rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold sm:flex-none"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="min-h-[44px] flex-1 rounded-xl bg-[#6C5CE7] px-4 py-2 text-xs font-bold text-white sm:flex-none"
              >
                Salvar Conta
              </button>
            </div>
          </form>
        </div>
      )}

      {showTxModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#1E1B39]/55 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await executeAction(
                {
                  action: "CREATE_TRANSACTION",
                  accountId: txAccountId || accounts[0]?.id,
                  categoryId: txCategoryId || undefined,
                  counterpartyId: txCounterpartyId || undefined,
                  kind: txKind,
                  status: txStatus,
                  description: txDescription,
                  amountDecimal: txAmountDecimal,
                  occurredOn: txDate,
                  dueOn: txDate,
                  costCenter: txCostCenter || undefined,
                },
                "Lançamento registrado."
              );
              if (ok) {
                setTxDescription("");
                setShowTxModal(false);
              }
            }}
            className="pb-safe max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-2xl sm:p-6"
          >
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-200 sm:hidden" />
            <h3 className="text-base font-extrabold text-[#1E1B39]">
              Registrar Movimentação (P01)
            </h3>
            <div className="mt-4 space-y-3 text-xs">
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <div>
                  <label className="font-bold">Tipo</label>
                  <select
                    value={txKind}
                    onChange={(e) =>
                      setTxKind(e.target.value as "INCOME" | "EXPENSE")
                    }
                    className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-200 bg-[#F5F6FA] px-3 py-2"
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
                    className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-200 bg-[#F5F6FA] px-3 py-2"
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
                  className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-200 bg-[#F5F6FA] px-3 py-2"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <div>
                  <label className="font-bold">Categoria</label>
                  <select
                    value={txCategoryId}
                    onChange={(e) => setTxCategoryId(e.target.value)}
                    className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-200 bg-[#F5F6FA] px-3 py-2"
                  >
                    <option value="">Sem categoria (Geral)</option>
                    {categories
                      .filter((c) => c.type === txKind)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="font-bold">
                    {isPJ ? "Cliente / Fornecedor" : "Contraparte"}
                  </label>
                  <select
                    value={txCounterpartyId}
                    onChange={(e) => setTxCounterpartyId(e.target.value)}
                    className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-200 bg-[#F5F6FA] px-3 py-2"
                  >
                    <option value="">Opcional</option>
                    {counterparties.map((cp) => (
                      <option key={cp.id} value={cp.id}>
                        {cp.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="font-bold">Descrição</label>
                <input
                  type="text"
                  required
                  value={txDescription}
                  onChange={(e) => setTxDescription(e.target.value)}
                  className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-200 bg-[#F5F6FA] px-3 py-2"
                />
              </div>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                <div>
                  <label className="font-bold">Valor Positivo (R$)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    required
                    value={txAmountDecimal}
                    onChange={(e) => setTxAmountDecimal(e.target.value)}
                    className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-200 bg-[#F5F6FA] px-3 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold">Data</label>
                  <input
                    type="date"
                    value={txDate}
                    onChange={(e) => setTxDate(e.target.value)}
                    className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-200 bg-[#F5F6FA] px-3 py-2"
                  />
                </div>
                <div>
                  <label className="font-bold">Centro Custo</label>
                  <input
                    type="text"
                    placeholder="Opcional"
                    value={txCostCenter}
                    onChange={(e) => setTxCostCenter(e.target.value)}
                    className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-200 bg-[#F5F6FA] px-3 py-2"
                  />
                </div>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowTxModal(false)}
                className="min-h-[44px] flex-1 rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold sm:flex-none"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="min-h-[44px] flex-1 rounded-xl bg-[#6C5CE7] px-4 py-2 text-xs font-bold text-white sm:flex-none"
              >
                Confirmar
              </button>
            </div>
          </form>
        </div>
      )}

      {showTransferModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#1E1B39]/55 p-0 backdrop-blur-sm sm:items-center sm:p-4">
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
            className="pb-safe max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-2xl sm:p-6"
          >
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-200 sm:hidden" />
            <h3 className="text-base font-extrabold text-[#1E1B39]">
              Transferência entre Contas Próprias
            </h3>
            <div className="mt-4 space-y-3 text-xs">
              <div>
                <label className="font-bold">Conta de Origem (Saída)</label>
                <select
                  value={tfSourceId}
                  onChange={(e) => setTfSourceId(e.target.value)}
                  className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-200 bg-[#F5F6FA] px-3 py-2"
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
                  className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-200 bg-[#F5F6FA] px-3 py-2"
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
                  inputMode="decimal"
                  value={tfAmountDecimal}
                  onChange={(e) => setTfAmountDecimal(e.target.value)}
                  className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-200 bg-[#F5F6FA] px-3 py-2 font-mono"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowTransferModal(false)}
                className="min-h-[44px] flex-1 rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold sm:flex-none"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="min-h-[44px] flex-1 rounded-xl bg-[#6C5CE7] px-4 py-2 text-xs font-bold text-white sm:flex-none"
              >
                Transferir
              </button>
            </div>
          </form>
        </div>
      )}

      {showObligationModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#1E1B39]/55 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await executeAction(
                {
                  action: "CREATE_OBLIGATION",
                  direction: obDirection,
                  title: obTitle,
                  categoryId: obCategoryId || undefined,
                  categoryName: obCategory,
                  counterpartyId: obCounterpartyId || undefined,
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
            className="pb-safe max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-2xl sm:p-6"
          >
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-200 sm:hidden" />
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
                  className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-200 bg-[#F5F6FA] px-3 py-2"
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
                  className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-200 bg-[#F5F6FA] px-3 py-2"
                />
              </div>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <div>
                  <label className="font-bold">Categoria</label>
                  <select
                    value={obCategoryId}
                    onChange={(e) => {
                      const val = e.target.value;
                      setObCategoryId(val);
                      const found = categories.find((c) => c.id === val);
                      if (found) setObCategory(found.name);
                    }}
                    className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-200 bg-[#F5F6FA] px-3 py-2"
                  >
                    <option value="">Padrão ({obCategory || "Geral"})</option>
                    {categories
                      .filter((c) =>
                        obDirection === "PAYABLE"
                          ? c.type === "EXPENSE"
                          : c.type === "INCOME"
                      )
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="font-bold">
                    {isPJ ? "Cliente / Fornecedor" : "Contraparte"}
                  </label>
                  <select
                    value={obCounterpartyId}
                    onChange={(e) => {
                      const val = e.target.value;
                      setObCounterpartyId(val);
                      const found = counterparties.find((cp) => cp.id === val);
                      setObCounterparty(found ? found.name : "");
                    }}
                    className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-200 bg-[#F5F6FA] px-3 py-2"
                  >
                    <option value="">Opcional</option>
                    {counterparties.map((cp) => (
                      <option key={cp.id} value={cp.id}>
                        {cp.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="font-bold">Valor Total (R$)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    required
                    value={obTotalDecimal}
                    onChange={(e) => setObTotalDecimal(e.target.value)}
                    className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-200 bg-[#F5F6FA] px-3 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold">Nº de Parcelas</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={60}
                    value={obCount}
                    onChange={(e) => setObCount(Number(e.target.value))}
                    className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-200 bg-[#F5F6FA] px-3 py-2 font-mono"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <div>
                  <label className="font-bold">1º Vencimento</label>
                  <input
                    type="date"
                    value={obFirstDue}
                    onChange={(e) => setObFirstDue(e.target.value)}
                    className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-200 bg-[#F5F6FA] px-3 py-2"
                  />
                </div>
                <div>
                  <label className="font-bold">Centro de Custo</label>
                  <input
                    type="text"
                    placeholder="Opcional"
                    value={obCostCenter}
                    onChange={(e) => setObCostCenter(e.target.value)}
                    className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-200 bg-[#F5F6FA] px-3 py-2"
                  />
                </div>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowObligationModal(false)}
                className="min-h-[44px] flex-1 rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold sm:flex-none"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="min-h-[44px] flex-1 rounded-xl bg-[#6C5CE7] px-4 py-2 text-xs font-bold text-white sm:flex-none"
              >
                Gerar Parcelas
              </button>
            </div>
          </form>
        </div>
      )}

      {settlementTarget && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#1E1B39]/55 p-0 backdrop-blur-sm sm:items-center sm:p-4">
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
            className="pb-safe max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-2xl sm:p-6"
          >
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-200 sm:hidden" />
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
                  className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-200 bg-[#F5F6FA] px-3 py-2"
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
                  inputMode="decimal"
                  required
                  value={settleAmountDecimal}
                  onChange={(e) => setSettleAmountDecimal(e.target.value)}
                  className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-200 bg-[#F5F6FA] px-3 py-2 font-mono"
                />
              </div>
              <div>
                <label className="font-bold">Data Efetiva</label>
                <input
                  type="date"
                  value={settleDate}
                  onChange={(e) => setSettleDate(e.target.value)}
                  className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-200 bg-[#F5F6FA] px-3 py-2"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSettlementTarget(null)}
                className="min-h-[44px] flex-1 rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold sm:flex-none"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="min-h-[44px] flex-1 rounded-xl bg-[#6C5CE7] px-4 py-2 text-xs font-bold text-white sm:flex-none"
              >
                Confirmar Baixa
              </button>
            </div>
          </form>
        </div>
      )}

      {showReserveModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#1E1B39]/55 p-0 backdrop-blur-sm sm:items-center sm:p-4">
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
            className="pb-safe max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-2xl sm:p-6"
          >
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-200 sm:hidden" />
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
                  className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-200 bg-[#F5F6FA] px-3 py-2"
                />
              </div>
              <div>
                <label className="font-bold">Finalidade</label>
                <select
                  value={resKind}
                  onChange={(e) => setResKind(e.target.value)}
                  className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-200 bg-[#F5F6FA] px-3 py-2"
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
                  inputMode="decimal"
                  value={resTargetDecimal}
                  onChange={(e) => setResTargetDecimal(e.target.value)}
                  className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-200 bg-[#F5F6FA] px-3 py-2 font-mono"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowReserveModal(false)}
                className="min-h-[44px] flex-1 rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold sm:flex-none"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="min-h-[44px] flex-1 rounded-xl bg-[#6C5CE7] px-4 py-2 text-xs font-bold text-white sm:flex-none"
              >
                Criar Cofre
              </button>
            </div>
          </form>
        </div>
      )}

      {reserveActionModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#1E1B39]/55 p-0 backdrop-blur-sm sm:items-center sm:p-4">
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
            className="pb-safe max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-2xl sm:p-6"
          >
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-200 sm:hidden" />
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
                    className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-200 bg-[#F5F6FA] px-3 py-2"
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
                  inputMode="decimal"
                  required
                  value={resMoveAmountDecimal}
                  onChange={(e) => setResMoveAmountDecimal(e.target.value)}
                  className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-200 bg-[#F5F6FA] px-3 py-2 font-mono"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReserveActionModal(null)}
                className="min-h-[44px] flex-1 rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold sm:flex-none"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="min-h-[44px] flex-1 rounded-xl bg-[#6C5CE7] px-4 py-2 text-xs font-bold text-white sm:flex-none"
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
