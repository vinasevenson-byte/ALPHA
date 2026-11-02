"use client";

import React, { useEffect, useState } from "react";
import {
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  Bot,
  Database,
  Link2,
  Upload,
  CheckCircle2,
  FileSpreadsheet,
  Lock,
  Send,
  Info,
  Eye,
  XCircle,
  RefreshCw,
  ArrowRightLeft,
  Activity,
  Bell,
} from "lucide-react";
import { formatBRL, formatDateBR } from "@/domain/planning";

export type P04SectionMode = "inteligencia" | "integracoes";

export type P04IntelSubTab =
  | "visao"
  | "alertas"
  | "assistente"
  | "saude-dados";

export type P04IntegrationSubTab =
  | "conexoes"
  | "importacoes"
  | "conciliacao"
  | "consentimentos";

export interface P04HealthIndexPayload {
  totalScore: number;
  band: "CRITICAL" | "ATTENTION" | "STABLE" | "HEALTHY" | "EXCELLENT";
  summary: string;
  dimensions: Array<{
    key: "LIQUIDITY" | "PUNCTUALITY" | "BUDGET" | "RESERVE" | "CONCENTRATION";
    label: string;
    weightPct: number;
    score: number;
    weightedPoints: number;
    status: "GOOD" | "WARNING" | "CRITICAL";
    rationale: string;
  }>;
  evidence: Array<{ label: string; value: string }>;
}

export interface P04QualityPayload {
  status: "COMPLETE" | "PARTIAL" | "INSUFFICIENT_DATA" | "STALE";
  reasons: string[];
}

export interface FinancialInsightItem {
  id: string;
  code: string;
  title: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  status: "ACTIVE" | "ACKNOWLEDGED" | "DISMISSED" | "RESOLVED";
  summary: string;
  explanationJson: string;
  evidenceJson: string;
  originModule: string;
  ruleVersion: string;
  detectedAt: string;
}

export interface FinancialConnectionItem {
  id: string;
  providerId: string;
  institutionName: string;
  status: string;
  scopes: string;
  consentExpiresAt?: string | null;
  lastSyncedAt?: string | null;
}

export interface ImportBatchItem {
  id: string;
  sourceKind: string;
  fileName: string;
  fileHash: string;
  totalRows: number;
  importedRows: number;
  duplicateRows: number;
  errorRows: number;
  createdAt: string;
}

export interface ImportedTransactionItem {
  id: string;
  providerId: string;
  accountExternalId: string;
  externalId: string;
  dedupeKey: string;
  occurredAt: string;
  amountCents: number;
  direction: string;
  description: string;
  reconciliationState: "STAGED" | "RECONCILED" | "IGNORED";
  reconciledLedgerTxId?: string | null;
}

export interface ConsentAuditItem {
  id: string;
  connectionId: string;
  action: string;
  actorUserId: string;
  scopes: string;
  createdAt: string;
}

export interface UnifiedAlertItem {
  id: string;
  type: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  title: string;
  message: string;
  occurrenceOn: string;
  state: string;
}

interface Props {
  workspaceId: string;
  workspaceName: string;
  workspaceType: "PERSONAL" | "BUSINESS";
  sectionMode: P04SectionMode;
  initialIntelTab?: P04IntelSubTab;
  initialIntegrationTab?: P04IntegrationSubTab;
  accounts: Array<{ id: string; name: string; institution?: string | null }>;
  healthIndex: P04HealthIndexPayload | null;
  quality: P04QualityPayload;
  savingsRatePct: number | null;
  featureFlags: {
    openFinanceEnabled: boolean;
    aiAssistantEnabled: boolean;
    externalMarketDataEnabled: boolean;
  };
  insights: FinancialInsightItem[];
  alerts: UnifiedAlertItem[];
  connections: FinancialConnectionItem[];
  importBatches: ImportBatchItem[];
  importedTransactions: ImportedTransactionItem[];
  consentAudits: ConsentAuditItem[];
  onExecuteAction: (
    payload: Record<string, unknown>,
    successMsg?: string
  ) => Promise<boolean>;
  onNavigateRoute?: (route: string) => void;
}

const DEFAULT_CSV_BATCH = [
  {
    externalId: "OFX-202611-001",
    occurredAt: "2026-11-05",
    amountDecimal: "4850.00",
    direction: "CREDIT" as const,
    description: "TED Recebida Cliente / Receita Operacional",
  },
  {
    externalId: "OFX-202611-002",
    occurredAt: "2026-11-06",
    amountDecimal: "690.00",
    direction: "DEBIT" as const,
    description: "Pagamento Fornecedor Cloud / Infraestrutura",
  },
  {
    externalId: "OFX-202611-003",
    occurredAt: "2026-11-07",
    amountDecimal: "1500.00",
    direction: "SELF_TRANSFER" as const,
    description: "PIX mesma titularidade entre contas próprias",
  },
];

const PROVIDER_CATALOG = [
  {
    providerId: "ITAU_OPENFINANCE_BR",
    institutionName: "Itaú Unibanco S.A. (Open Finance)",
    badge: "Fase 2 — Dados Cadastrais e Transacionais",
  },
  {
    providerId: "NUBANK_OPENFINANCE_BR",
    institutionName: "Nu Pagamentos S.A. (Open Finance)",
    badge: "Fase 2 — Contas, Saldos e Extrato",
  },
  {
    providerId: "BTG_OPENFINANCE_BR",
    institutionName: "Banco BTG Pactual S.A. (Open Finance)",
    badge: "Fase 2 & 4 — Conta Corrente e Investimentos",
  },
];

export function NovaIntelligenceP04View({
  workspaceId,
  workspaceName,
  workspaceType,
  sectionMode,
  initialIntelTab = "visao",
  initialIntegrationTab = "conexoes",
  accounts,
  healthIndex,
  quality,
  savingsRatePct,
  featureFlags,
  insights,
  alerts,
  connections,
  importBatches,
  importedTransactions,
  consentAudits,
  onExecuteAction,
  onNavigateRoute,
}: Props) {
  const [intelTab, setIntelTab] = useState<P04IntelSubTab>(initialIntelTab);
  const [integrationTab, setIntegrationTab] = useState<P04IntegrationSubTab>(
    initialIntegrationTab
  );
  const [alertFilter, setAlertFilter] = useState<
    "ALL" | "CRITICAL" | "WARNING" | "INFO"
  >("ALL");

  useEffect(() => {
    setIntelTab(initialIntelTab);
  }, [initialIntelTab]);

  useEffect(() => {
    setIntegrationTab(initialIntegrationTab);
  }, [initialIntegrationTab]);

  // Estado do Assistente IA Contextual Somente Leitura
  const [questionInput, setQuestionInput] = useState(
    "Quanto posso reservar com segurança?"
  );
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantHistory, setAssistantHistory] = useState<
    Array<{
      id: string;
      question: string;
      answer: string;
      evidence: Array<{ label: string; value: string }>;
      limitations: string[];
      readOnlyConfirmed: boolean;
      timestamp: string;
    }>
  >([]);

  // Estado de Importação CSV/OFX e Conciliação
  const [csvFileName, setCsvFileName] = useState(
    "extrato_novembro_2026_openfinance.csv"
  );
  const [csvProviderId, setCsvProviderId] = useState("ITAU_OPENFINANCE_BR");
  const [csvAccountExtId, setCsvAccountExtId] = useState("ITAU-AG0001-CC9988");
  const [csvRows, setCsvRows] = useState(DEFAULT_CSV_BATCH);
  const [reconcileTargetAccountId, setReconcileTargetAccountId] = useState(
    accounts[0]?.id ?? ""
  );

  useEffect(() => {
    if (!reconcileTargetAccountId && accounts.length > 0) {
      setReconcileTargetAccountId(accounts[0].id);
    }
  }, [accounts, reconcileTargetAccountId]);

  const askAssistant = async (qText?: string) => {
    const query = (qText ?? questionInput).trim();
    if (!query) return;
    setAssistantLoading(true);
    try {
      const res = await fetch(
        `/v1/workspaces/${workspaceId}/assistant/query`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: query }),
        }
      );
      const data = await res.json();
      if (res.ok) {
        setAssistantHistory((prev) => [
          {
            id: `ask-${Date.now()}`,
            question: query,
            answer: data.answer,
            evidence: data.evidence ?? [],
            limitations: data.limitations ?? [],
            readOnlyConfirmed: Boolean(data.readOnlyGuardrail),
            timestamp: new Date().toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            }),
          },
          ...prev,
        ]);
      }
    } finally {
      setAssistantLoading(false);
    }
  };

  const filteredAlerts = alerts.filter((a) =>
    alertFilter === "ALL" ? true : a.severity === alertFilter
  );

  const stagedCount = importedTransactions.filter(
    (t) => t.reconciliationState === "STAGED"
  ).length;

  // =========================================================================
  // MODO 1: INTELIGÊNCIA FINANCEIRA (PACOTE 04)
  // =========================================================================
  if (sectionMode === "inteligencia") {
    return (
      <div className="space-y-6">
        {/* Cabeçalho do Módulo de Inteligência Financeira P04 */}
        <div className="rounded-2xl border border-[#E4E7EF] bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-[#EFE9FF] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#6D28D9]">
                  Inteligência Financeira Explicável • Pacote 04 (v4.0.0)
                </span>
                <span className="text-xs text-slate-500">
                  {workspaceName} (
                  {workspaceType === "BUSINESS"
                    ? "Empresarial PJ"
                    : "Pessoal PF"}
                  )
                </span>
              </div>
              <h2 className="mt-1 text-lg font-extrabold text-[#141726]">
                Diagnósticos Auditáveis, Saúde Financeira Ponderada e Assistente IA
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800">
                <Lock className="h-3.5 w-3.5" />
                Governança Ativa: IA Somente Leitura
              </span>
              {onNavigateRoute && (
                <button
                  onClick={() => onNavigateRoute("integracoes")}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#6D28D9]/30 bg-[#EFE9FF] px-3 py-1.5 text-xs font-bold text-[#6D28D9] hover:bg-[#6D28D9] hover:text-white"
                >
                  <Link2 className="h-3.5 w-3.5" />
                  Integrações & Conciliação ({stagedCount} pendentes)
                </button>
              )}
            </div>
          </div>

          {/* Sub-abas da Inteligência Financeira */}
          <div className="mt-4 flex flex-wrap gap-1.5">
            {[
              {
                key: "visao" as P04IntelSubTab,
                label: "Visão & Saúde Financeira (5 Dimensões)",
                icon: Sparkles,
              },
              {
                key: "alertas" as P04IntelSubTab,
                label: `Central de Alertas (${alerts.length})`,
                icon: Bell,
              },
              {
                key: "assistente" as P04IntelSubTab,
                label: "Assistente IA Contextual",
                icon: Bot,
              },
              {
                key: "saude-dados" as P04IntelSubTab,
                label: `Qualidade dos Dados (${quality.status})`,
                icon: Database,
              },
            ].map((tab) => {
              const Icon = tab.icon;
              const active = intelTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setIntelTab(tab.key)}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                    active
                      ? "bg-[#6D28D9] text-white shadow-sm"
                      : "bg-[#F5F6FA] text-[#5B6275] hover:bg-[#EFE9FF] hover:text-[#6D28D9]"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* SUB-ABA 1: VISÃO & ÍNDICE DE SAÚDE FINANCEIRA PONDERADO */}
        {intelTab === "visao" && (
          <div className="space-y-6">
            {/* Cartões Superiores de Indicadores P04 */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-[#E4E7EF] bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#5B6275]">
                    Índice de Saúde Financeira
                  </span>
                  <span className="rounded-lg bg-[#EFE9FF] p-1.5 text-[#6D28D9]">
                    <Activity className="h-4 w-4" />
                  </span>
                </div>
                <div className="mt-2 font-mono text-2xl font-extrabold tabular-nums text-[#141726]">
                  {healthIndex ? `${healthIndex.totalScore}/100` : "—"}
                </div>
                <p className="mt-1 text-[11px] font-semibold text-[#6D28D9]">
                  {healthIndex
                    ? `Faixa: ${healthIndex.band}`
                    : "Sem base suficiente (Estado Zero)"}
                </p>
              </div>

              <div className="rounded-2xl border border-[#E4E7EF] bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#5B6275]">
                    Taxa de Poupança Realizada
                  </span>
                  <span className="rounded-lg bg-emerald-50 p-1.5 text-emerald-700">
                    <ShieldCheck className="h-4 w-4" />
                  </span>
                </div>
                <div className="mt-2 font-mono text-2xl font-extrabold tabular-nums text-[#141726]">
                  {savingsRatePct !== null ? `${savingsRatePct}%` : "—"}
                </div>
                <p className="mt-1 text-[11px] text-[#5B6275]">
                  (Receitas − Despesas) ÷ Receitas Liquidadas
                </p>
              </div>

              <div className="rounded-2xl border border-[#E4E7EF] bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#5B6275]">
                    Insights Explicáveis Ativos
                  </span>
                  <span className="rounded-lg bg-[#EFE9FF] p-1.5 text-[#6D28D9]">
                    <Sparkles className="h-4 w-4" />
                  </span>
                </div>
                <div className="mt-2 font-mono text-2xl font-extrabold tabular-nums text-[#141726]">
                  {insights.filter((i) => i.status === "ACTIVE").length}
                </div>
                <p className="mt-1 text-[11px] text-[#5B6275]">
                  Regras determinísticas v4.0.0 auditáveis
                </p>
              </div>

              <div className="rounded-2xl border border-[#E4E7EF] bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#5B6275]">
                    Integridade e Frescor da Base
                  </span>
                  <span className="rounded-lg bg-slate-100 p-1.5 text-slate-700">
                    <Database className="h-4 w-4" />
                  </span>
                </div>
                <div className="mt-2 font-mono text-xl font-extrabold text-[#141726]">
                  {quality.status}
                </div>
                <p className="mt-1 text-[11px] text-[#5B6275]">
                  {quality.reasons.length === 0
                    ? "100% conciliado e atualizado"
                    : `Pendências: ${quality.reasons.join(", ")}`}
                </p>
              </div>
            </div>

            {/* Decomposição Ponderada do Índice de Saúde Financeira */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="rounded-2xl border border-[#E4E7EF] bg-white p-6 shadow-sm lg:col-span-7">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="text-base font-extrabold text-[#141726]">
                      Composição Auditável do Índice de Saúde Financeira
                    </h3>
                    <p className="text-xs text-[#5B6275]">
                      Pesos oficiais da especificação P04: Liquidez (30%),
                      Pontualidade (25%), Orçamento (20%), Reserva (15%) e
                      Concentração (10%).
                    </p>
                  </div>
                </div>

                {!healthIndex ? (
                  <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-[#F5F6FA] p-8 text-center">
                    <p className="text-sm font-bold text-[#141726]">
                      Estado Zero: Nenhum Score Fictício Exibido
                    </p>
                    <p className="mt-1 text-xs text-[#5B6275]">
                      O Índice de Saúde Financeira requer ao menos uma conta ou
                      transação persistida para calcular as 5 dimensões.
                    </p>
                  </div>
                ) : (
                  <div className="mt-5 space-y-4">
                    {healthIndex.dimensions.map((dim) => (
                      <div
                        key={dim.key}
                        className="rounded-xl border border-slate-100 bg-[#F5F6FA] p-3.5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="rounded-md bg-[#EFE9FF] px-2 py-0.5 font-mono text-[11px] font-bold text-[#6D28D9]">
                              Peso {dim.weightPct}%
                            </span>
                            <span className="font-bold text-[#141726]">
                              {dim.label}
                            </span>
                          </div>
                          <div className="font-mono font-bold text-[#141726]">
                            Nota: {dim.score}/100 ({dim.weightedPoints} pts)
                          </div>
                        </div>
                        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                          <div
                            className={`h-full rounded-full ${
                              dim.status === "GOOD"
                                ? "bg-[#6D28D9]"
                                : dim.status === "WARNING"
                                ? "bg-amber-500"
                                : "bg-rose-600"
                            }`}
                            style={{ width: `${Math.min(100, dim.score)}%` }}
                          />
                        </div>
                        <p className="mt-1.5 text-[11px] text-[#5B6275]">
                          {dim.rationale}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Painel de Insights Explicáveis Persistidos */}
              <div className="rounded-2xl border border-[#E4E7EF] bg-white p-6 shadow-sm lg:col-span-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="text-base font-extrabold text-[#141726]">
                      Recomendações e Insights Explicáveis
                    </h3>
                    <p className="text-xs text-[#5B6275]">
                      Cada diagnóstico exibe causa, evidência numérica e versão
                      da regra.
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {insights.length === 0 ? (
                    <div className="rounded-xl bg-[#F5F6FA] p-6 text-center text-xs text-[#5B6275]">
                      Nenhum insight registrado neste momento.
                    </div>
                  ) : (
                    insights.map((ins) => {
                      let explanation: { cause?: string; action?: string } = {};
                      let evidence: Record<string, unknown> = {};
                      try {
                        explanation = JSON.parse(ins.explanationJson);
                        evidence = JSON.parse(ins.evidenceJson);
                      } catch {
                        // ignore parse error
                      }
                      return (
                        <div
                          key={ins.id}
                          className={`rounded-xl border p-4 text-xs transition ${
                            ins.severity === "CRITICAL"
                              ? "border-rose-200 bg-rose-50/60"
                              : ins.severity === "WARNING"
                              ? "border-amber-200 bg-amber-50/60"
                              : "border-[#E4E7EF] bg-[#F5F6FA]"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                                ins.severity === "CRITICAL"
                                  ? "bg-rose-100 text-rose-800"
                                  : ins.severity === "WARNING"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-[#EFE9FF] text-[#6D28D9]"
                              }`}
                            >
                              {ins.severity} • {ins.originModule}
                            </span>
                            <span className="font-mono text-[10px] text-slate-500">
                              Regra {ins.ruleVersion} • {ins.status}
                            </span>
                          </div>
                          <h4 className="mt-2 text-sm font-extrabold text-[#141726]">
                            {ins.title}
                          </h4>
                          <p className="mt-1 text-xs text-[#5B6275]">
                            {ins.summary}
                          </p>
                          {explanation.action && (
                            <p className="mt-1.5 font-semibold text-[#6D28D9]">
                              Ação sugerida: {explanation.action}
                            </p>
                          )}
                          <div className="mt-2 flex flex-wrap gap-2 font-mono text-[10px] text-slate-600">
                            {Object.entries(evidence).map(([k, v]) => (
                              <span
                                key={k}
                                className="rounded bg-white px-2 py-0.5 shadow-2xs"
                              >
                                {k}: {String(v)}
                              </span>
                            ))}
                          </div>
                          {ins.status === "ACTIVE" && (
                            <div className="mt-3 flex items-center gap-2 border-t border-slate-200/70 pt-2.5">
                              <button
                                onClick={() =>
                                  onExecuteAction(
                                    {
                                      action: "ACKNOWLEDGE_INSIGHT",
                                      insightId: ins.id,
                                      status: "ACKNOWLEDGED",
                                    },
                                    "Insight reconhecido e auditado."
                                  )
                                }
                                className="rounded-lg bg-[#6D28D9] px-2.5 py-1 text-[11px] font-bold text-white hover:bg-[#5B21B6]"
                              >
                                Reconhecer Insight
                              </button>
                              <button
                                onClick={() =>
                                  onExecuteAction(
                                    {
                                      action: "ACKNOWLEDGE_INSIGHT",
                                      insightId: ins.id,
                                      status: "DISMISSED",
                                    },
                                    "Insight dispensado."
                                  )
                                }
                                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
                              >
                                Dispensar
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SUB-ABA 2: CENTRAL DE ALERTAS */}
        {intelTab === "alertas" && (
          <div className="rounded-2xl border border-[#E4E7EF] bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-extrabold text-[#141726]">
                  Central Unificada de Alertas (Vencimentos, Liquidez e Anomalias)
                </h3>
                <p className="text-xs text-[#5B6275]">
                  Monitoramento determinístico de risco de caixa negativo,
                  violação da margem de segurança, obrigações em atraso e
                  concentração patrimonial.
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {(["ALL", "CRITICAL", "WARNING", "INFO"] as const).map((sev) => (
                  <button
                    key={sev}
                    onClick={() => setAlertFilter(sev)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                      alertFilter === sev
                        ? "bg-[#6D28D9] text-white"
                        : "bg-[#F5F6FA] text-[#5B6275] hover:bg-[#EFE9FF]"
                    }`}
                  >
                    {sev === "ALL" ? "Todos" : sev}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {filteredAlerts.length === 0 ? (
                <div className="rounded-xl bg-[#F5F6FA] p-8 text-center text-xs text-[#5B6275]">
                  Nenhum alerta encontrado para o filtro selecionado.
                </div>
              ) : (
                filteredAlerts.map((al) => (
                  <div
                    key={al.id}
                    className={`flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4 text-xs ${
                      al.severity === "CRITICAL"
                        ? "border-rose-200 bg-rose-50/70"
                        : al.severity === "WARNING"
                        ? "border-amber-200 bg-amber-50/70"
                        : "border-[#E4E7EF] bg-[#F5F6FA]"
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                            al.severity === "CRITICAL"
                              ? "bg-rose-100 text-rose-800"
                              : al.severity === "WARNING"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-[#EFE9FF] text-[#6D28D9]"
                          }`}
                        >
                          {al.severity} • {al.type}
                        </span>
                        <span className="font-mono text-[11px] text-slate-500">
                          Data ref.: {formatDateBR(al.occurrenceOn)}
                        </span>
                      </div>
                      <h4 className="text-sm font-extrabold text-[#141726]">
                        {al.title}
                      </h4>
                      <p className="text-xs text-[#5B6275]">{al.message}</p>
                    </div>
                    <span className="rounded-lg bg-white px-2.5 py-1 font-mono text-[11px] font-bold text-[#141726] shadow-2xs">
                      {al.state}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* SUB-ABA 3: ASSISTENTE IA CONTEXTUAL SOMENTE LEITURA */}
        {intelTab === "assistente" && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="rounded-2xl border border-[#E4E7EF] bg-white p-6 shadow-sm lg:col-span-7">
              <div className="border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2">
                  <span className="rounded-lg bg-[#EFE9FF] p-1.5 text-[#6D28D9]">
                    <Bot className="h-4 w-4" />
                  </span>
                  <div>
                    <h3 className="text-base font-extrabold text-[#141726]">
                      Assistente Financeiro Contextual (Somente Leitura)
                    </h3>
                    <p className="text-xs text-[#5B6275]">
                      Responde dúvidas sobre despesas, receitas, margem de
                      reserva, vencimentos e fluxo projetado citando evidências
                      reais do banco de dados.
                    </p>
                  </div>
                </div>
              </div>

              {/* Chips de Perguntas Rápidas */}
              <div className="mt-4">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Perguntas sugeridas (Clique para consultar):
                </span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[
                    "Quanto posso reservar com segurança?",
                    "Por que gastei mais neste período?",
                    "Quais contas vencem nos próximos dias?",
                    "Qual meu fluxo projetado até dezembro?",
                    "Qual minha taxa de poupança e saúde financeira?",
                    "Pague agora meu boleto vencido",
                  ].map((q) => (
                    <button
                      key={q}
                      onClick={() => {
                        setQuestionInput(q);
                        askAssistant(q);
                      }}
                      className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                        q.includes("Pague agora")
                          ? "border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100"
                          : "border-[#E4E7EF] bg-[#F5F6FA] text-[#141726] hover:border-[#6D28D9] hover:bg-[#EFE9FF] hover:text-[#6D28D9]"
                      }`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>

              {/* Input de Pergunta */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  askAssistant();
                }}
                className="mt-4 flex gap-2"
              >
                <input
                  type="text"
                  value={questionInput}
                  onChange={(e) => setQuestionInput(e.target.value)}
                  placeholder="Pergunte sobre caixa, despesas, reservas, vencimentos..."
                  className="flex-1 rounded-xl border border-[#E4E7EF] bg-[#F5F6FA] px-4 py-2.5 text-xs font-medium text-[#141726] focus:border-[#6D28D9] focus:bg-white focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={assistantLoading}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#6D28D9] px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#5B21B6] disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" />
                  {assistantLoading ? "Analisando..." : "Perguntar"}
                </button>
              </form>

              {/* Histórico de Respostas */}
              <div className="mt-5 space-y-4">
                {assistantHistory.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-[#F5F6FA] p-6 text-center text-xs text-[#5B6275]">
                    Selecione uma das perguntas acima ou digite sua dúvida para
                    receber um diagnóstico baseado exclusivamente nos dados
                    persistidos do workspace.
                  </div>
                ) : (
                  assistantHistory.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-[#E4E7EF] bg-[#F5F6FA] p-4 text-xs"
                    >
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span className="font-bold text-[#6D28D9]">
                          Pergunta: “{item.question}”
                        </span>
                        <span>{item.timestamp}</span>
                      </div>
                      <p className="mt-2 text-sm font-semibold leading-relaxed text-[#141726]">
                        {item.answer}
                      </p>

                      {item.evidence.length > 0 && (
                        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                          {item.evidence.map((ev, i) => (
                            <div
                              key={i}
                              className="rounded-xl border border-slate-200/80 bg-white p-2.5"
                            >
                              <div className="text-[10px] font-semibold text-slate-500">
                                {ev.label}
                              </div>
                              <div className="mt-0.5 font-mono text-xs font-bold text-[#141726]">
                                {ev.value}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/70 pt-2 text-[10px] text-slate-500">
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                          <Lock className="h-3 w-3" />
                          Guardrail Somente Leitura Verificado
                        </span>
                        <span>{item.limitations[0]}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Guardrails e Governança da IA (Coluna Direita) */}
            <div className="rounded-2xl border border-[#E4E7EF] bg-white p-6 shadow-sm lg:col-span-5">
              <h3 className="text-base font-extrabold text-[#141726]">
                Regras de Governança e Explicabilidade (P04)
              </h3>
              <p className="mt-1 text-xs text-[#5B6275]">
                O Assistente Inteligente da NOVA opera sob restrições rígidas de
                segurança bancária e conformidade regulatória:
              </p>

              <ul className="mt-4 space-y-3 text-xs text-[#141726]">
                <li className="flex items-start gap-2.5 rounded-xl bg-[#F5F6FA] p-3">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#6D28D9]" />
                  <div>
                    <strong>Acesso Estritamente Somente Leitura:</strong> Jamais
                    altera saldos, não liquida parcelas, não executa pagamentos
                    e não realiza ordens de investimento.
                  </div>
                </li>
                <li className="flex items-start gap-2.5 rounded-xl bg-[#F5F6FA] p-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <div>
                    <strong>Zero Alucinação Numérica:</strong> Todos os valores
                    monetários vêm das funções puras de domínio (
                    <code className="rounded bg-white px-1 py-0.5 font-mono text-[10px]">
                      projectCash
                    </code>
                    ,{" "}
                    <code className="rounded bg-white px-1 py-0.5 font-mono text-[10px]">
                      reserveCapacity
                    </code>
                    ,{" "}
                    <code className="rounded bg-white px-1 py-0.5 font-mono text-[10px]">
                      savingsRate
                    </code>
                    ).
                  </div>
                </li>
                <li className="flex items-start gap-2.5 rounded-xl bg-[#F5F6FA] p-3">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <div>
                    <strong>Não Recomendação CVM:</strong> Análises de alocação
                    têm caráter educativo e matemático, sem promessa de
                    rentabilidade.
                  </div>
                </li>
              </ul>
            </div>
          </div>
        )}

        {/* SUB-ABA 4: SAÚDE DOS DADOS E FEATURE FLAGS */}
        {intelTab === "saude-dados" && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-[#E4E7EF] bg-white p-6 shadow-sm">
              <h3 className="text-base font-extrabold text-[#141726]">
                Diagnóstico de Qualidade e Frescor dos Dados
              </h3>
              <p className="mt-1 text-xs text-[#5B6275]">
                Avalia se a base do workspace possui completude e conciliação
                para projeções de alta confiança.
              </p>

              <div className="mt-4 rounded-xl border border-[#E4E7EF] bg-[#F5F6FA] p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#5B6275]">
                    Status Global de Qualidade
                  </span>
                  <span className="rounded-full bg-[#EFE9FF] px-3 py-1 font-mono text-xs font-extrabold text-[#6D28D9]">
                    {quality.status}
                  </span>
                </div>
                <div className="mt-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span>Contas financeiras cadastradas:</span>
                    <strong className="font-mono">{accounts.length}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Transações importadas aguardando conciliação:</span>
                    <strong className="font-mono">{stagedCount}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Conexões Open Finance ativas:</span>
                    <strong className="font-mono">
                      {connections.filter((c) => c.status === "ACTIVE").length}
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-[#E4E7EF] bg-white p-6 shadow-sm">
              <h3 className="text-base font-extrabold text-[#141726]">
                Feature Flags e Adaptadores do Ambiente (P04)
              </h3>
              <p className="mt-1 text-xs text-[#5B6275]">
                Configuração operacional dos motores externos e assistente.
              </p>

              <div className="mt-4 space-y-2.5 text-xs">
                <div className="flex items-center justify-between rounded-xl bg-[#F5F6FA] p-3">
                  <div>
                    <div className="font-bold text-[#141726]">
                      FEATURE_AI_ASSISTANT_ENABLED
                    </div>
                    <div className="text-[11px] text-[#5B6275]">
                      Motor contextual explicável em modo somente leitura
                    </div>
                  </div>
                  <span className="rounded-lg bg-emerald-100 px-2.5 py-1 font-mono text-[11px] font-bold text-emerald-800">
                    ATIVO
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-xl bg-[#F5F6FA] p-3">
                  <div>
                    <div className="font-bold text-[#141726]">
                      FEATURE_OPEN_FINANCE_ENABLED
                    </div>
                    <div className="text-[11px] text-[#5B6275]">
                      Conectores somente leitura + Importação CSV/OFX com SHA-256
                    </div>
                  </div>
                  <span className="rounded-lg bg-[#EFE9FF] px-2.5 py-1 font-mono text-[11px] font-bold text-[#6D28D9]">
                    {featureFlags.openFinanceEnabled
                      ? "CONECTOR REAL ATIVO"
                      : "SANDBOX / CSV ATIVO"}
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-xl bg-[#F5F6FA] p-3">
                  <div>
                    <div className="font-bold text-[#141726]">
                      FEATURE_EXTERNAL_MARKET_DATA_ENABLED
                    </div>
                    <div className="text-[11px] text-[#5B6275]">
                      Indexadores CDI, Selic e IPCA auditados
                    </div>
                  </div>
                  <span className="rounded-lg bg-[#EFE9FF] px-2.5 py-1 font-mono text-[11px] font-bold text-[#6D28D9]">
                    ATIVO
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // MODO 2: INTEGRAÇÕES BANCÁRIAS, IMPORTAÇÃO CSV E CONCILIAÇÃO (PACOTE 04)
  // =========================================================================
  return (
    <div className="space-y-6">
      {/* Cabeçalho do Módulo de Integrações e Conciliação */}
      <div className="rounded-2xl border border-[#E4E7EF] bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-[#EFE9FF] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#6D28D9]">
                Integrações Financeiras & Conciliação • Pacote 04
              </span>
              <span className="text-xs text-slate-500">{workspaceName}</span>
            </div>
            <h2 className="mt-1 text-lg font-extrabold text-[#141726]">
              Open Finance (Somente Leitura), Importação CSV/OFX e Fila Anti-Duplicidade
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-violet-200 bg-[#EFE9FF] px-3 py-1.5 text-xs font-bold text-[#6D28D9]">
              <ArrowRightLeft className="h-3.5 w-3.5" />
              {stagedCount} item(ns) aguardando conciliação
            </span>
          </div>
        </div>

        {/* Sub-abas de Integrações */}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {[
            {
              key: "conexoes" as P04IntegrationSubTab,
              label: `Conexões Open Finance (${connections.length})`,
              icon: Link2,
            },
            {
              key: "importacoes" as P04IntegrationSubTab,
              label: `Importar Extrato CSV/OFX (${importBatches.length} lotes)`,
              icon: Upload,
            },
            {
              key: "conciliacao" as P04IntegrationSubTab,
              label: `Fila de Conciliação (${stagedCount} pendentes)`,
              icon: FileSpreadsheet,
            },
            {
              key: "consentimentos" as P04IntegrationSubTab,
              label: `Consentimentos LGPD (${consentAudits.length})`,
              icon: ShieldCheck,
            },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = integrationTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setIntegrationTab(tab.key)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                  active
                    ? "bg-[#6D28D9] text-white shadow-sm"
                    : "bg-[#F5F6FA] text-[#5B6275] hover:bg-[#EFE9FF] hover:text-[#6D28D9]"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* SUB-ABA 1: CONEXÕES OPEN FINANCE SOMENTE LEITURA */}
      {integrationTab === "conexoes" && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {PROVIDER_CATALOG.map((prov) => {
            const existing = connections.find(
              (c) => c.providerId === prov.providerId
            );
            const isActive = existing?.status === "ACTIVE";
            return (
              <div
                key={prov.providerId}
                className="flex flex-col justify-between rounded-2xl border border-[#E4E7EF] bg-white p-5 shadow-sm"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full bg-[#EFE9FF] px-2.5 py-0.5 font-mono text-[10px] font-bold text-[#6D28D9]">
                      {prov.providerId}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                        isActive
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {existing ? existing.status : "DISCONNECTED"}
                    </span>
                  </div>
                  <h3 className="mt-3 text-sm font-extrabold text-[#141726]">
                    {prov.institutionName}
                  </h3>
                  <p className="mt-1 text-xs text-[#5B6275]">{prov.badge}</p>
                  <div className="mt-3 rounded-xl bg-[#F5F6FA] p-3 text-[11px] text-[#5B6275]">
                    <div>
                      <strong>Escopos:</strong> ACCOUNTS_READ, BALANCES_READ,
                      TRANSACTIONS_READ
                    </div>
                    {existing?.consentExpiresAt && (
                      <div className="mt-1">
                        <strong>Expira em:</strong>{" "}
                        {formatDateBR(existing.consentExpiresAt.slice(0, 10))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 border-t border-slate-100 pt-3">
                  {isActive && existing ? (
                    <button
                      onClick={() =>
                        onExecuteAction(
                          {
                            action: "REVOKE_CONNECTION_CONSENT",
                            connectionId: existing.id,
                          },
                          `Consentimento revogado para ${prov.institutionName}.`
                        )
                      }
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Revogar Consentimento (Imediato)
                    </button>
                  ) : (
                    <button
                      onClick={() =>
                        onExecuteAction(
                          {
                            action: "GRANT_CONNECTION_CONSENT",
                            providerId: prov.providerId,
                            institutionName: prov.institutionName,
                          },
                          `Consentimento somente leitura concedido para ${prov.institutionName}.`
                        )
                      }
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#6D28D9] px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#5B21B6]"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Autorizar Leitura Open Finance
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* SUB-ABA 2: IMPORTAÇÃO CSV / OFX COM CHAVE DETERMINÍSTICA SHA-256 */}
      {integrationTab === "importacoes" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="rounded-2xl border border-[#E4E7EF] bg-white p-6 shadow-sm lg:col-span-7">
            <h3 className="text-base font-extrabold text-[#141726]">
              Importador de Extrato Bancário (Staging com Deduplicação SHA-256)
            </h3>
            <p className="mt-1 text-xs text-[#5B6275]">
              Cada linha gera uma chave determinística{" "}
              <code className="rounded bg-[#F5F6FA] px-1 py-0.5 font-mono text-[10px]">
                externalDedupeKey(workspaceId, providerId, accountExternalId,
                externalId)
              </code>
              . Reimportar o mesmo lote ignora duplicidades automaticamente.
            </p>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="text-[11px] font-bold text-slate-600">
                  Arquivo de Origem
                </label>
                <input
                  type="text"
                  value={csvFileName}
                  onChange={(e) => setCsvFileName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-[#F5F6FA] px-3 py-2 text-xs font-semibold"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600">
                  Provedor / Instituição
                </label>
                <input
                  type="text"
                  value={csvProviderId}
                  onChange={(e) => setCsvProviderId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-[#F5F6FA] px-3 py-2 font-mono text-xs"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600">
                  Conta Externa ID
                </label>
                <input
                  type="text"
                  value={csvAccountExtId}
                  onChange={(e) => setCsvAccountExtId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-[#F5F6FA] px-3 py-2 font-mono text-xs"
                />
              </div>
            </div>

            <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F5F6FA] text-[10px] font-bold uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">ID Externo</th>
                    <th className="px-3 py-2">Data</th>
                    <th className="px-3 py-2">Direção</th>
                    <th className="px-3 py-2">Valor (R$)</th>
                    <th className="px-3 py-2">Descrição</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {csvRows.map((row, idx) => (
                    <tr key={idx}>
                      <td className="px-3 py-2 font-mono text-[11px]">
                        {row.externalId}
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px]">
                        {row.occurredAt}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`rounded px-2 py-0.5 font-mono text-[10px] font-bold ${
                            row.direction === "SELF_TRANSFER"
                              ? "bg-[#EFE9FF] text-[#6D28D9]"
                              : row.direction === "CREDIT"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {row.direction}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono font-bold">
                        R$ {row.amountDecimal}
                      </td>
                      <td className="px-3 py-2 text-slate-600">
                        {row.description}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setCsvRows(DEFAULT_CSV_BATCH)}
                className="rounded-xl border border-slate-200 bg-[#F5F6FA] px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Restaurar Lote Padrão (Com PIX Mesma Titularidade)
              </button>
              <button
                type="button"
                onClick={async () => {
                  const ok = await onExecuteAction(
                    {
                      action: "STAGE_CSV_IMPORT",
                      fileName: csvFileName,
                      providerId: csvProviderId,
                      accountExternalId: csvAccountExtId,
                      rows: csvRows,
                    },
                    "Lote processado com deduplicação determinística SHA-256."
                  );
                  if (ok) setIntegrationTab("conciliacao");
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#6D28D9] px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#5B21B6]"
              >
                <Upload className="h-3.5 w-3.5" />
                Processar Lote para Staging (Testar Deduplicação)
              </button>
            </div>
          </div>

          {/* Histórico de Lotes Importados */}
          <div className="rounded-2xl border border-[#E4E7EF] bg-white p-6 shadow-sm lg:col-span-5">
            <h3 className="text-base font-extrabold text-[#141726]">
              Histórico de Lotes Importados (Auditados)
            </h3>
            <div className="mt-4 space-y-3">
              {importBatches.length === 0 ? (
                <div className="rounded-xl bg-[#F5F6FA] p-6 text-center text-xs text-[#5B6275]">
                  Nenhum lote CSV/OFX processado ainda.
                </div>
              ) : (
                importBatches.map((b) => (
                  <div
                    key={b.id}
                    className="rounded-xl border border-slate-200/80 bg-[#F5F6FA] p-3.5 text-xs"
                  >
                    <div className="flex items-center justify-between font-bold text-[#141726]">
                      <span>{b.fileName}</span>
                      <span className="rounded bg-[#EFE9FF] px-2 py-0.5 font-mono text-[10px] text-[#6D28D9]">
                        {b.sourceKind}
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2 font-mono text-[11px]">
                      <div className="rounded bg-white p-2 text-center">
                        <div className="text-[10px] text-slate-400">Total</div>
                        <div className="font-bold">{b.totalRows}</div>
                      </div>
                      <div className="rounded bg-emerald-50 p-2 text-center text-emerald-800">
                        <div className="text-[10px]">Novas</div>
                        <div className="font-bold">{b.importedRows}</div>
                      </div>
                      <div className="rounded bg-amber-50 p-2 text-center text-amber-800">
                        <div className="text-[10px]">Duplicadas</div>
                        <div className="font-bold">{b.duplicateRows}</div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUB-ABA 3: FILA DE CONCILIAÇÃO ANTI-DUPLICIDADE E ANTI-RECEITA FALSA */}
      {integrationTab === "conciliacao" && (
        <div className="rounded-2xl border border-[#E4E7EF] bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-extrabold text-[#141726]">
                Fila de Conciliação de Transações Externas (Staging → Ledger P01)
              </h3>
              <p className="text-xs text-[#5B6275]">
                Transações marcadas como{" "}
                <strong className="text-[#6D28D9]">SELF_TRANSFER</strong> são
                conciliadas como transferência interna (
                <code>TRANSFER_IN</code>), jamais inflando as receitas do
                workspace.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <label className="font-bold text-slate-600">
                Conta Destino no Ledger:
              </label>
              <select
                value={reconcileTargetAccountId}
                onChange={(e) => setReconcileTargetAccountId(e.target.value)}
                className="rounded-xl border border-slate-200 bg-[#F5F6FA] px-3 py-1.5 font-semibold text-[#141726]"
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-[#F5F6FA] text-[10px] font-bold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Data / ID Externo</th>
                  <th className="px-4 py-3">Descrição</th>
                  <th className="px-4 py-3">Classificação</th>
                  <th className="px-4 py-3 text-right">Valor</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Ação de Conciliação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {importedTransactions.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-slate-500"
                    >
                      Nenhuma transação externa em staging. Importe um lote na
                      aba anterior ou carregue os dados de homologação.
                    </td>
                  </tr>
                ) : (
                  importedTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-[#F5F6FA]/60">
                      <td className="px-4 py-3 font-mono text-[11px]">
                        <div className="font-bold text-[#141726]">
                          {formatDateBR(tx.occurredAt.slice(0, 10))}
                        </div>
                        <div className="text-slate-400">{tx.externalId}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-[#141726]">
                          {tx.description}
                        </div>
                        <div className="font-mono text-[10px] text-slate-400">
                          Dedupe SHA-256: {tx.dedupeKey.slice(0, 16)}...
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-lg px-2 py-0.5 font-mono text-[10px] font-bold ${
                            tx.direction === "SELF_TRANSFER"
                              ? "bg-[#EFE9FF] text-[#6D28D9]"
                              : tx.direction === "CREDIT"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {tx.direction === "SELF_TRANSFER"
                            ? "TRANSFERÊNCIA PRÓPRIA (NÃO RECEITA)"
                            : tx.direction}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold">
                        {formatBRL(tx.amountCents)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                            tx.reconciliationState === "RECONCILED"
                              ? "bg-emerald-100 text-emerald-800"
                              : tx.reconciliationState === "IGNORED"
                              ? "bg-slate-200 text-slate-600"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {tx.reconciliationState}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {tx.reconciliationState === "STAGED" ? (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              onClick={() =>
                                onExecuteAction(
                                  {
                                    action: "RECONCILE_IMPORTED_ROW",
                                    importedTxId: tx.id,
                                    targetAccountId: reconcileTargetAccountId,
                                    decision: "APPROVE",
                                  },
                                  "Item conciliado com sucesso no Ledger P01."
                                )
                              }
                              className="rounded-lg bg-[#6D28D9] px-2.5 py-1 text-[11px] font-bold text-white hover:bg-[#5B21B6]"
                            >
                              Aprovar no Ledger
                            </button>
                            <button
                              onClick={() =>
                                onExecuteAction(
                                  {
                                    action: "RECONCILE_IMPORTED_ROW",
                                    importedTxId: tx.id,
                                    decision: "IGNORE",
                                  },
                                  "Item externo ignorado."
                                )
                              }
                              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
                            >
                              Ignorar
                            </button>
                          </div>
                        ) : (
                          <span className="font-mono text-[10px] text-slate-400">
                            Processado
                          </span>
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

      {/* SUB-ABA 4: TRILHA DE AUDITORIA DE CONSENTIMENTOS LGPD */}
      {integrationTab === "consentimentos" && (
        <div className="rounded-2xl border border-[#E4E7EF] bg-white p-6 shadow-sm">
          <h3 className="text-base font-extrabold text-[#141726]">
            Trilha de Auditoria de Consentimentos (LGPD & Open Finance)
          </h3>
          <p className="mt-1 text-xs text-[#5B6275]">
            Registro imutável de concessões e revogações de leitura de dados
            financeiros por workspace.
          </p>

          <div className="mt-4 space-y-2.5">
            {consentAudits.length === 0 ? (
              <div className="rounded-xl bg-[#F5F6FA] p-6 text-center text-xs text-[#5B6275]">
                Nenhum evento de consentimento registrado ainda.
              </div>
            ) : (
              consentAudits.map((ca) => (
                <div
                  key={ca.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/80 bg-[#F5F6FA] p-3.5 text-xs"
                >
                  <div>
                    <span
                      className={`mr-2 rounded px-2 py-0.5 font-mono text-[10px] font-bold ${
                        ca.action === "GRANTED"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-rose-100 text-rose-800"
                      }`}
                    >
                      {ca.action}
                    </span>
                    <strong className="text-[#141726]">
                      Conexão #{ca.connectionId.slice(0, 10)}
                    </strong>
                    <span className="ml-2 text-slate-500">
                      • Escopos: {ca.scopes}
                    </span>
                  </div>
                  <div className="font-mono text-[11px] text-slate-500">
                    Ator: {ca.actorUserId} •{" "}
                    {new Date(ca.createdAt).toLocaleString("pt-BR")}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
