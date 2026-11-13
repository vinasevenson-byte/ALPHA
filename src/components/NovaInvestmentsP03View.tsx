"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  TrendingUp,
  Briefcase,
  ArrowLeftRight,
  Scale,
  ShieldAlert,
  Calculator,
  Database,
  Plus,
  Info,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  PieChart,
  Shield,
  FileBarChart2,
  RefreshCw,
  ArrowDownToLine,
  Trash2,
} from "lucide-react";
import {
  brazilPfFixedIncomeTax,
  futureValue,
  projectLiquidity,
  taxableFixedIncomeRedemption,
} from "@/domain/investments";
import { centsToDecimalString, formatBRL } from "@/domain/planning";
import { DEFAULT_MACRO_RATES } from "@/lib/financial-engine";
import { InvestmentComparatorView } from "@/components/InvestmentComparatorView";
import { ReserveSimulatorCard } from "@/components/ReserveSimulatorCard";

export type P03TabKey =
  | "visao-geral"
  | "carteira"
  | "operacoes"
  | "comparador"
  | "rentabilidade"
  | "riscos"
  | "simulador"
  | "metas"
  | "relatorios"
  | "fontes";

export interface PositionRow {
  id: string;
  symbol: string;
  name: string;
  kind:
    | "TESOURO_SELIC"
    | "CDB"
    | "LCI"
    | "LCA"
    | "TESOURO_IPCA"
    | "TESOURO_PREFIXADO"
    | "FUND"
    | "ETF";
  institution: string;
  indexer: string;
  rateLabel: string;
  costBasisReais: number;
  currentGrossReais: number;
  daysHeld: number;
  redemptionAvailableAt: string;
  maturityDate: string;
  fgcEligible: boolean;
  quoteStatus: "VALID" | "STALE";
}

export const SAMPLE_P03_POSITIONS: PositionRow[] = [
  {
    id: "pos-1",
    symbol: "LFT-2029",
    name: "Tesouro Selic 2029",
    kind: "TESOURO_SELIC",
    institution: "Tesouro Direto",
    indexer: "SELIC",
    rateLabel: "100% Selic + 0,05%",
    costBasisReais: 15000,
    currentGrossReais: 16680,
    daysHeld: 400,
    redemptionAvailableAt: "2026-01-01",
    maturityDate: "2029-03-01",
    fgcEligible: false,
    quoteStatus: "VALID",
  },
  {
    id: "pos-2",
    symbol: "CDB-DI-105",
    name: "CDB Liquidez Diária 105% CDI",
    kind: "CDB",
    institution: "Banco Itaú",
    indexer: "CDI",
    rateLabel: "105% do CDI",
    costBasisReais: 10000,
    currentGrossReais: 11150,
    daysHeld: 370,
    redemptionAvailableAt: "2026-01-01",
    maturityDate: "2028-06-01",
    fgcEligible: true,
    quoteStatus: "VALID",
  },
  {
    id: "pos-3",
    symbol: "LCI-94",
    name: "LCI Habitação 94% CDI (Carência)",
    kind: "LCI",
    institution: "Caixa Econômica",
    indexer: "CDI",
    rateLabel: "94% CDI (Isento IR PF)",
    costBasisReais: 12000,
    currentGrossReais: 13260,
    daysHeld: 280,
    redemptionAvailableAt: "2027-04-01",
    maturityDate: "2027-11-01",
    fgcEligible: true,
    quoteStatus: "VALID",
  },
];

export function computePortfolioSummary(
  positions: PositionRow[],
  workspaceType: "PERSONAL" | "BUSINESS"
) {
  let totalCost = 0;
  let totalGross = 0;
  let totalEstimatedNet = 0;

  for (const p of positions) {
    totalCost += p.costBasisReais;
    totalGross += p.currentGrossReais;

    if (
      (p.kind === "LCI" || p.kind === "LCA") &&
      workspaceType === "PERSONAL"
    ) {
      totalEstimatedNet += p.currentGrossReais;
    } else {
      const red = taxableFixedIncomeRedemption({
        principal: p.costBasisReais,
        grossRedemption: p.currentGrossReais,
        days: Math.max(30, p.daysHeld),
      });
      totalEstimatedNet += red.netRedemption;
    }
  }

  const liq = projectLiquidity(
    positions.map((p) => ({
      amount: p.currentGrossReais,
      redemptionAvailableAt: p.redemptionAvailableAt,
    })),
    new Date().toISOString().slice(0, 10)
  );

  const returnPct =
    totalCost > 0 ? ((totalGross - totalCost) / totalCost) * 100 : 0;

  return {
    totalCostCents: Math.round(totalCost * 100),
    totalGrossCents: Math.round(totalGross * 100),
    grossReturnCents: Math.round((totalGross - totalCost) * 100),
    totalEstimatedNetCents: Math.round(totalEstimatedNet * 100),
    availableLiquidityCents: Math.round(liq.available * 100),
    lockedLiquidityCents: Math.round(liq.locked * 100),
    returnPct: Math.round(returnPct * 100) / 100,
  };
}

interface Props {
  workspaceType: "PERSONAL" | "BUSINESS";
  workspaceName: string;
  activeSubTab?: P03TabKey;
  positions?: PositionRow[];
  accounts?: Array<{ id: string; name: string; status?: string }>;
  onPositionsChange?: (next: PositionRow[]) => void;
  onPersistAction?: (
    payload: Record<string, unknown>,
    successMsg?: string
  ) => Promise<boolean>;
  workspaceHeadroomCents?: number;
  workspaceReservesCents?: number;
  workspaceEligibleBalanceCents?: number;
  onNavigateWorkspaceRoute?: (route: string) => void;
}

export function NovaInvestmentsP03View({
  workspaceType,
  workspaceName,
  activeSubTab = "visao-geral",
  positions: controlledPositions,
  accounts = [],
  onPositionsChange,
  onPersistAction,
  workspaceHeadroomCents = 0,
  workspaceReservesCents = 0,
  workspaceEligibleBalanceCents = 0,
  onNavigateWorkspaceRoute,
}: Props) {
  const [subTab, setSubTab] = useState<P03TabKey>(activeSubTab);

  useEffect(() => {
    setSubTab(activeSubTab);
  }, [activeSubTab]);

  const activeAccounts = useMemo(
    () => accounts.filter((a) => !a.status || a.status === "ACTIVE"),
    [accounts]
  );

  // Se o usuário ainda não possuir investimentos cadastrados,
  // o sistema apresenta a carteira vazia (R$ 0,00), sem números fictícios.
  const [internalPositions, setInternalPositions] = useState<PositionRow[]>([]);
  const positions = controlledPositions ?? internalPositions;

  const updatePositions = (next: PositionRow[]) => {
    if (onPositionsChange) {
      onPositionsChange(next);
    } else {
      setInternalPositions(next);
    }
  };

  // Form de nova posição / operação (BUY)
  const [newName, setNewName] = useState("");
  const [newKind, setNewKind] = useState<PositionRow["kind"]>("TESOURO_SELIC");
  const [newInst, setNewInst] = useState("Tesouro Direto / Itaú");
  const [newRateLabel, setNewRateLabel] = useState("Selic + 0,05% a.a.");
  const [newCostReais, setNewCostReais] = useState(5000);
  const [newGrossReais, setNewGrossReais] = useState(5420);
  const [newDays, setNewDays] = useState(365);

  // Estado inline para Atualizar Cotação ou Resgatar Posição para Conta Bancária
  const [editingQuotePosId, setEditingQuotePosId] = useState<string | null>(null);
  const [quoteDecimalInput, setQuoteDecimalInput] = useState<string>("0.00");
  const [redeemingPos, setRedeemingPos] = useState<PositionRow | null>(null);
  const [redeemGrossDecimal, setRedeemGrossDecimal] = useState<string>("0.00");
  const [redeemAccountId, setRedeemAccountId] = useState<string>("");

  useEffect(() => {
    if (activeAccounts.length > 0 && !redeemAccountId) {
      setRedeemAccountId(activeAccounts[0].id);
    }
  }, [activeAccounts, redeemAccountId]);

  // Estado do Simulador Patrimonial P03
  const [simPrincipal, setSimPrincipal] = useState<number>(5000);
  const [simMonthly, setSimMonthly] = useState<number>(500);
  const [simYears, setSimYears] = useState<number>(10);
  const [simAnnualRatePct, setSimAnnualRatePct] = useState<number>(9);
  const [simInflationPct, setSimInflationPct] = useState<number>(4.5);

  // Estado do Comparador Rápido P03
  const [compAmount, setCompAmount] = useState<number>(10000);
  const [compDays, setCompDays] = useState<number>(365);

  const simResult = useMemo(
    () =>
      futureValue({
        principal: Math.max(0, simPrincipal),
        monthly: Math.max(0, simMonthly),
        years: Math.max(1, Math.min(60, Math.round(simYears))),
        annualRate: simAnnualRatePct / 100,
        inflation: simInflationPct / 100,
      }),
    [simPrincipal, simMonthly, simYears, simAnnualRatePct, simInflationPct]
  );

  const portfolioMetrics = useMemo(
    () => computePortfolioSummary(positions, workspaceType),
    [positions, workspaceType]
  );

  const clearPortfolioP03 = async () => {
    if (onPersistAction) {
      await onPersistAction(
        { action: "CLEAR_INVESTMENTS" },
        "Carteira de investimentos zerada (R$ 0,00)."
      );
      return;
    }
    updatePositions([]);
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho e Sub-abas do Pacote 03 no Padrão Visual Oficial NOVA (Roxo & Cinza Suave) */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-[#EFEFFD] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#6C5CE7]">
                Central de Investimentos • Pacote 03 + P10
              </span>
              <span className="text-xs text-slate-500">
                {workspaceName} (
                {workspaceType === "BUSINESS" ? "Empresarial PJ" : "Pessoal PF"})
              </span>
            </div>
            <h2 className="mt-1 text-lg font-extrabold text-[#1E1B39]">
              Gestão de Carteira, Resgate Líquido Pós-IR e Simulador Patrimonial
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {workspaceHeadroomCents > 0 && (
              <button
                onClick={() => {
                  setCompAmount(Math.round(workspaceHeadroomCents / 100));
                  setSubTab("comparador");
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#6C5CE7]/25 bg-[#EFEFFD] px-3 py-2 text-xs font-bold text-[#6C5CE7] transition hover:bg-[#6C5CE7]/15"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Simular aporte da Margem Livre ({formatBRL(workspaceHeadroomCents)})
              </button>
            )}

            <button
              onClick={() => setSubTab("operacoes")}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#6C5CE7] px-3.5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#5849BE]"
            >
              <Plus className="h-3.5 w-3.5" />
              Nova Posição
            </button>

            {positions.length > 0 && (
              <button
                onClick={clearPortfolioP03}
                className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Limpar Carteira
              </button>
            )}
          </div>
        </div>

        {/* Navegação de Módulos do Pacote 03 (Deslizável por toque no celular, fluida no tablet/desktop) */}
        <div className="no-scrollbar -mx-1 mt-4 flex flex-nowrap gap-1.5 overflow-x-auto px-1 pb-1 sm:mx-0 sm:flex-wrap sm:px-0 sm:pb-0">
          {[
            { key: "visao-geral" as P03TabKey, label: "Visão Geral", icon: PieChart },
            { key: "carteira" as P03TabKey, label: "Minha Carteira", icon: Briefcase },
            { key: "operacoes" as P03TabKey, label: "Operações", icon: ArrowLeftRight },
            { key: "comparador" as P03TabKey, label: "Comparador", icon: Scale },
            { key: "rentabilidade" as P03TabKey, label: "Rentabilidade", icon: TrendingUp },
            { key: "riscos" as P03TabKey, label: "Liquidez e Riscos", icon: ShieldAlert },
            { key: "simulador" as P03TabKey, label: "Simulador", icon: Calculator },
            { key: "metas" as P03TabKey, label: "Metas e Reservas", icon: Shield },
            { key: "relatorios" as P03TabKey, label: "Relatórios", icon: FileBarChart2 },
            { key: "fontes" as P03TabKey, label: "Fontes", icon: Database },
          ].map((t) => {
            const Icon = t.icon;
            const active = subTab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setSubTab(t.key)}
                className={`inline-flex min-h-[38px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-bold transition active:scale-[0.98] ${
                  active
                    ? "bg-[#6C5CE7] text-white shadow-sm"
                    : "bg-[#F5F6FA] text-slate-600 hover:bg-[#EFEFFD] hover:text-[#6C5CE7]"
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 4 Cartões de Indicadores Superiores (Padrão Global Predictions Portfolio) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div
          onClick={() => setSubTab("carteira")}
          className="cursor-pointer rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:border-[#6C5CE7]/40"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              Patrimônio Investido (Bruto)
            </span>
            <span className="rounded-lg bg-[#EFEFFD] p-1.5 text-[#6C5CE7]">
              <Briefcase className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 font-mono text-2xl font-extrabold tabular-nums text-[#1E1B39]">
            {formatBRL(portfolioMetrics.totalGrossCents)}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Custo de aquisição: {formatBRL(portfolioMetrics.totalCostCents)}
          </p>
        </div>

        <div
          onClick={() => setSubTab("rentabilidade")}
          className="cursor-pointer rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:border-[#6C5CE7]/40"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              Rentabilidade Acumulada
            </span>
            <span className="rounded-lg bg-emerald-50 p-1.5 text-emerald-600">
              <TrendingUp className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-extrabold tabular-nums text-emerald-600">
              {formatBRL(portfolioMetrics.grossReturnCents)}
            </span>
            {positions.length > 0 && (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-mono text-[11px] font-bold text-emerald-700">
                +{portfolioMetrics.returnPct}%
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {positions.length === 0
              ? "Carteira vazia (sem dados fictícios)"
              : "Rendimento bruto sobre posições ativas"}
          </p>
        </div>

        <div
          onClick={() => setSubTab("rentabilidade")}
          className="cursor-pointer rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:border-[#6C5CE7]/40"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              Patrimônio Líquido (Pós-IR)
            </span>
            <span className="rounded-lg bg-[#EFEFFD] p-1.5 text-[#6C5CE7]">
              <Scale className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 font-mono text-2xl font-extrabold tabular-nums text-[#1E1B39]">
            {formatBRL(portfolioMetrics.totalEstimatedNetCents)}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {workspaceType === "PERSONAL"
              ? "Deduzido pela tabela regressiva RF PF"
              : "Estimativa líquida corporativa PJ"}
          </p>
        </div>

        <div
          onClick={() => setSubTab("riscos")}
          className="cursor-pointer rounded-2xl border border-[#6C5CE7]/20 bg-gradient-to-br from-[#6C5CE7] to-[#5849BE] p-5 text-white shadow-sm transition hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-violet-100">
              Liquidez Disponível (D+0/D+1)
            </span>
            <ShieldAlert className="h-4 w-4 text-violet-200" />
          </div>
          <div className="mt-2 font-mono text-2xl font-extrabold tabular-nums text-white">
            {formatBRL(portfolioMetrics.availableLiquidityCents)}
          </div>
          <p className="mt-1 text-xs text-violet-100">
            Em carência/vencimento:{" "}
            {formatBRL(portfolioMetrics.lockedLiquidityCents)}
          </p>
        </div>
      </div>

      {/* Integração Automática P01 + P02 + P03 */}
      <div className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm lg:grid-cols-3">
        <div className="flex items-center justify-between rounded-xl bg-[#F5F6FA] p-3.5">
          <div>
            <span className="text-[11px] font-semibold text-slate-500">
              Caixa em Contas (P01)
            </span>
            <div className="mt-0.5 font-mono text-base font-extrabold tabular-nums text-[#1E1B39]">
              {formatBRL(workspaceEligibleBalanceCents)}
            </div>
          </div>
          {onNavigateWorkspaceRoute && (
            <button
              onClick={() => onNavigateWorkspaceRoute("contas")}
              className="text-xs font-bold text-[#6C5CE7] hover:underline"
            >
              Ver contas →
            </button>
          )}
        </div>

        <div className="flex items-center justify-between rounded-xl bg-[#F5F6FA] p-3.5">
          <div>
            <span className="text-[11px] font-semibold text-slate-500">
              Cofres e Reservas Planejadas (P02)
            </span>
            <div className="mt-0.5 font-mono text-base font-extrabold tabular-nums text-[#1E1B39]">
              {formatBRL(workspaceReservesCents)}
            </div>
          </div>
          {onNavigateWorkspaceRoute && (
            <button
              onClick={() => onNavigateWorkspaceRoute("reservas")}
              className="text-xs font-bold text-[#6C5CE7] hover:underline"
            >
              Ver reservas →
            </button>
          )}
        </div>

        <div className="flex items-center justify-between rounded-xl bg-[#EFEFFD] p-3.5">
          <div>
            <span className="text-[11px] font-bold text-[#6C5CE7]">
              Capacidade Segura p/ Novo Aporte (P02→P03)
            </span>
            <div className="mt-0.5 font-mono text-base font-black tabular-nums text-[#6C5CE7]">
              {formatBRL(workspaceHeadroomCents)}
            </div>
          </div>
          <button
            onClick={() => setSubTab("comparador")}
            className="rounded-lg bg-[#6C5CE7] px-2.5 py-1 text-[11px] font-bold text-white hover:bg-[#5849BE]"
          >
            Comparar
          </button>
        </div>
      </div>

      {/* =====================================================================
          SIMULADOR PATRIMONIAL (SEÇÃO 4 DO PACOTE 03 + RESERVE SIMULATOR CARD)
         ===================================================================== */}
      {(subTab === "visao-geral" || subTab === "simulador") && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <span className="rounded-full bg-[#EFEFFD] px-2.5 py-0.5 text-[10px] font-bold uppercase text-[#6C5CE7]">
                  Simulador Patrimonial • Prévia Interativa (P03)
                </span>
                <h3 className="mt-1 text-base font-extrabold text-[#1E1B39]">
                  Simulação de Crescimento Patrimonial (Juros Compostos e Inflação)
                </h3>
              </div>
              <button
                onClick={() => {
                  setSimPrincipal(5000);
                  setSimMonthly(500);
                  setSimYears(10);
                  setSimAnnualRatePct(9);
                  setSimInflationPct(4.5);
                }}
                className="rounded-xl border border-slate-200 bg-[#F5F6FA] px-3 py-1.5 text-xs font-semibold text-[#1E1B39] hover:border-[#6C5CE7]"
              >
                Restaurar Exemplo Padrão (10 anos / 9% a.a.)
              </button>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="space-y-4 text-xs lg:col-span-5">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="font-bold text-slate-700">
                      Capital inicial (R$)
                    </label>
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      value={simPrincipal}
                      onChange={(e) => setSimPrincipal(Number(e.target.value))}
                      className="mt-1 min-h-[42px] w-full rounded-xl border border-slate-200 bg-[#F5F6FA] px-3 py-2 font-mono text-sm font-bold text-[#1E1B39] focus:border-[#6C5CE7] focus:bg-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700">
                      Aporte mensal (R$)
                    </label>
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      value={simMonthly}
                      onChange={(e) => setSimMonthly(Number(e.target.value))}
                      className="mt-1 min-h-[42px] w-full rounded-xl border border-slate-200 bg-[#F5F6FA] px-3 py-2 font-mono text-sm font-bold text-[#1E1B39] focus:border-[#6C5CE7] focus:bg-white focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="font-bold text-slate-700">
                      Prazo (anos)
                    </label>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={60}
                      value={simYears}
                      onChange={(e) => setSimYears(Number(e.target.value))}
                      className="mt-1 min-h-[42px] w-full rounded-xl border border-slate-200 bg-[#F5F6FA] px-3 py-2 font-mono text-sm font-bold text-[#1E1B39] focus:border-[#6C5CE7] focus:bg-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700">
                      Taxa anual (%)
                    </label>
                    <input
                      type="number"
                      inputMode="decimal"
                      step={0.25}
                      value={simAnnualRatePct}
                      onChange={(e) => setSimAnnualRatePct(Number(e.target.value))}
                      className="mt-1 min-h-[42px] w-full rounded-xl border border-slate-200 bg-[#F5F6FA] px-3 py-2 font-mono text-sm font-bold text-[#1E1B39] focus:border-[#6C5CE7] focus:bg-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700">
                      Inflação est. (%)
                    </label>
                    <input
                      type="number"
                      inputMode="decimal"
                      step={0.25}
                      value={simInflationPct}
                      onChange={(e) => setSimInflationPct(Number(e.target.value))}
                      className="mt-1 min-h-[42px] w-full rounded-xl border border-slate-200 bg-[#F5F6FA] px-3 py-2 font-mono text-sm font-bold text-[#1E1B39] focus:border-[#6C5CE7] focus:bg-white focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col justify-between rounded-2xl bg-gradient-to-br from-[#6C5CE7] to-[#4834D4] p-6 text-white shadow-md lg:col-span-7">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-violet-200">
                    Patrimônio bruto estimado ao fim do período ({simYears} anos)
                  </span>
                  <div className="mt-1 font-mono text-3xl font-black tabular-nums text-white sm:text-4xl">
                    {formatBRL(Math.round(simResult.amount * 100))}
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="rounded-xl bg-white/15 p-3 backdrop-blur-sm">
                      <span className="text-[11px] text-violet-100">
                        Total investido
                      </span>
                      <div className="mt-1 font-mono text-base font-bold tabular-nums text-white">
                        {formatBRL(Math.round(simResult.contributions * 100))}
                      </div>
                    </div>
                    <div className="rounded-xl bg-white/20 p-3 backdrop-blur-sm">
                      <span className="text-[11px] font-semibold text-emerald-200">
                        Rendimento bruto
                      </span>
                      <div className="mt-1 font-mono text-base font-bold tabular-nums text-emerald-200">
                        {formatBRL(Math.round(simResult.earnings * 100))}
                      </div>
                    </div>
                    <div className="rounded-xl bg-white/15 p-3 backdrop-blur-sm">
                      <span className="text-[11px] text-violet-100">
                        Poder de compra (real)
                      </span>
                      <div className="mt-1 font-mono text-base font-bold tabular-nums text-amber-200">
                        {formatBRL(Math.round(simResult.inflationAdjusted * 100))}
                      </div>
                    </div>
                  </div>
                </div>

                <p className="mt-4 text-[11px] text-violet-100/90">
                  Simulação ilustrativa com capitalização mensal e aportes no fim
                  de cada mês, sem tributos ou taxas no valor bruto principal. Não
                  utiliza taxas atuais de mercado e não garante resultados.
                </p>
              </div>
            </div>
          </div>

          {subTab === "simulador" && (
            <ReserveSimulatorCard
              reservePotentialCents={Math.max(100000, workspaceHeadroomCents)}
            />
          )}
        </div>
      )}

      {/* =====================================================================
          COMPARADOR INTELIGENTE DE APLICAÇÕES (SEÇÃO 3 P03 + MOTOR COMPLETO P11)
         ===================================================================== */}
      {(subTab === "visao-geral" || subTab === "rentabilidade") && (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-extrabold text-[#1E1B39]">
                Comparador Rápido de Investimentos (Bruto vs Líquido Pós-IR)
              </h3>
              <p className="text-xs text-slate-500">
                Avalia rentabilidade líquida descontada da alíquota regressiva PF
                ({(brazilPfFixedIncomeTax(compDays).rate * 100).toFixed(1)}% para{" "}
                {compDays} dias), liquidez, garantias FGC e risco de marcação a
                mercado.
              </p>
            </div>
            <div className="flex w-full flex-wrap items-center gap-3 text-xs sm:w-auto">
              <div className="flex-1 sm:flex-initial">
                <label className="mr-1.5 block font-bold text-slate-600 sm:inline">Valor (R$):</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={compAmount}
                  onChange={(e) => setCompAmount(Number(e.target.value))}
                  className="mt-1 min-h-[40px] w-full rounded-xl border border-slate-200 bg-[#F5F6FA] px-2.5 py-1.5 font-mono font-bold text-[#1E1B39] sm:mt-0 sm:w-28"
                />
              </div>
              <div className="flex-1 sm:flex-initial">
                <label className="mr-1.5 block font-bold text-slate-600 sm:inline">Prazo:</label>
                <select
                  value={compDays}
                  onChange={(e) => setCompDays(Number(e.target.value))}
                  className="mt-1 min-h-[40px] w-full rounded-xl border border-slate-200 bg-[#F5F6FA] px-2.5 py-1.5 font-bold text-[#1E1B39] sm:mt-0 sm:w-auto"
                >
                  <option value={90}>90 dias (IR 22,5%)</option>
                  <option value={180}>180 dias (IR 22,5%)</option>
                  <option value={360}>360 dias (IR 20,0%)</option>
                  <option value={365}>365 dias (IR 17,5%)</option>
                  <option value={721}>721 dias (IR 15,0%)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                name: "Tesouro Selic 2029",
                grossRate: 0.1125,
                exemptPF: false,
                liquidity: "Diária (D+0/D+1)",
                guarantee: "Soberana (Tesouro Nacional)",
                mtmRisk: "Baixíssimo (Pós-fixado Selic)",
                source: "Tesouro Direto",
              },
              {
                name: "CDB Liquidez Diária 102% CDI",
                grossRate: 0.1137,
                exemptPF: false,
                liquidity: "Imediata (D+0)",
                guarantee: "FGC (até R$ 250 mil / CPF-CNPJ)",
                mtmRisk: "Baixíssimo",
                source: "Referência B3",
              },
              {
                name: "LCI / LCA 94% CDI",
                grossRate: 0.1048,
                exemptPF: true,
                liquidity: "Carência mínima legal (270d)",
                guarantee: "FGC (até R$ 250 mil)",
                mtmRisk: "Bloqueado até fim da carência",
                source: "Emissão Bancária",
              },
              {
                name: "Tesouro IPCA+ / Prefixado",
                grossRate: 0.118,
                exemptPF: false,
                liquidity: "D+1 (Sujeito a Marcação a Mercado)",
                guarantee: "Soberana (Tesouro Nacional)",
                mtmRisk: "Oscilação em resgate antecipado",
                source: "Tesouro Direto",
              },
            ].map((item) => {
              const yearsFrac = compDays / 365;
              const grossEnd = compAmount * Math.pow(1 + item.grossRate, yearsFrac);
              const isExempt = item.exemptPF && workspaceType === "PERSONAL";
              const calc = isExempt
                ? {
                    grossProfit: grossEnd - compAmount,
                    incomeTax: 0,
                    netRedemption: grossEnd,
                  }
                : taxableFixedIncomeRedemption({
                    principal: compAmount,
                    grossRedemption: grossEnd,
                    days: compDays,
                  });

              return (
                <div
                  key={item.name}
                  className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-[#F5F6FA] p-4 text-xs transition hover:border-[#6C5CE7]/50 hover:bg-white hover:shadow-sm"
                >
                  <div>
                    <span className="rounded-full bg-[#EFEFFD] px-2.5 py-0.5 text-[10px] font-bold text-[#6C5CE7]">
                      {item.source}
                    </span>
                    <h4 className="mt-2 text-sm font-extrabold text-[#1E1B39]">
                      {item.name}
                    </h4>
                    <div className="mt-2 font-mono text-lg font-black text-[#6C5CE7]">
                      Líq: {formatBRL(Math.round(calc.netRedemption * 100))}
                    </div>
                    <p className="font-mono text-[11px] text-slate-600">
                      Lucro Líquido:{" "}
                      {formatBRL(
                        Math.round((calc.netRedemption - compAmount) * 100)
                      )}{" "}
                      • IR: {formatBRL(Math.round(calc.incomeTax * 100))}
                    </p>
                  </div>
                  <div className="mt-3 space-y-1 border-t border-slate-200/80 pt-2 text-[11px] text-slate-600">
                    <div>
                      <strong>Liquidez:</strong> {item.liquidity}
                    </div>
                    <div>
                      <strong>Garantia:</strong> {item.guarantee}
                    </div>
                    <div>
                      <strong>Risco:</strong> {item.mtmRisk}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex items-start gap-2 rounded-xl border border-violet-200 bg-[#EFEFFD]/60 p-3 text-[11px] text-[#1E1B39]">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#6C5CE7]" />
            <span>
              <strong>Nota Regulatória (CVM / Receita Federal):</strong> O
              comparador fornece informações objetivas e simulações educacionais.
              Não constitui recomendação individualizada de valores mobiliários.
              No modo PJ, regras fiscais dependem do regime tributário da empresa.
            </span>
          </div>
        </div>
      )}

      {subTab === "comparador" && (
        <InvestmentComparatorView
          workspaceType={workspaceType === "BUSINESS" ? "PJ" : "PF"}
          investments={positions.map((p) => ({
            id: p.id,
            name: p.name,
            assetClass: p.kind,
            institution: p.institution,
            investedAmountCents: Math.round(p.costBasisReais * 100),
            currentAmountCents: Math.round(p.currentGrossReais * 100),
            indexer: p.indexer,
            rateDescription: p.rateLabel,
            annualGrossYieldBps: 1125,
            liquidity:
              p.redemptionAvailableAt <= new Date().toISOString().slice(0, 10)
                ? "D+0 / D+1"
                : `Carência até ${p.redemptionAvailableAt}`,
            maturityDate: p.maturityDate,
            fgcCovered: p.fgcEligible,
            taxExempt:
              (p.kind === "LCI" || p.kind === "LCA") &&
              workspaceType === "PERSONAL",
            riskLevel: "BAIXO",
          }))}
          macroRates={DEFAULT_MACRO_RATES}
          reservePotentialCents={workspaceHeadroomCents}
          onAddInvestment={async (payload) => {
            if (!onPersistAction) return;
            const mappedKind: PositionRow["kind"] =
              payload.assetClass === "LCI_LCA"
                ? "LCI"
                : payload.assetClass === "FUNDO"
                ? "FUND"
                : payload.assetClass === "ETF_ACAO"
                ? "ETF"
                : (payload.assetClass as PositionRow["kind"]);
            await onPersistAction(
              {
                action: "CREATE_INVESTMENT_POSITION",
                symbol: mappedKind,
                name: payload.name,
                kind: mappedKind,
                institution: payload.institution,
                indexer: payload.indexer,
                rateLabel: payload.rateDescription,
                costBasisCents: payload.investedAmountCents,
                currentGrossCents: payload.currentAmountCents,
                daysHeld: 365,
                maturityDate: `${payload.maturityDate}-01`,
              },
              "Posição adicionada à carteira consolidada."
            );
          }}
        />
      )}

      {/* =====================================================================
          MINHA CARTEIRA, OPERAÇÕES, ATUALIZAÇÃO DE COTAÇÃO E RESGATE P/ CONTA
         ===================================================================== */}
      {(subTab === "visao-geral" ||
        subTab === "carteira" ||
        subTab === "operacoes" ||
        subTab === "riscos" ||
        subTab === "metas" ||
        subTab === "relatorios" ||
        subTab === "fontes") && (
        <div className="space-y-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!newName.trim()) return;
              if (onPersistAction) {
                const ok = await onPersistAction(
                  {
                    action: "CREATE_INVESTMENT_POSITION",
                    symbol: newKind,
                    name: newName,
                    kind: newKind,
                    institution: newInst,
                    indexer: newKind.includes("IPCA")
                      ? "IPCA"
                      : newKind.includes("SELIC")
                      ? "SELIC"
                      : "CDI",
                    rateLabel: newRateLabel,
                    costBasisCents: Math.round(newCostReais * 100),
                    currentGrossCents: Math.round(newGrossReais * 100),
                    daysHeld: newDays,
                    redemptionAvailableAt:
                      newKind === "LCI" || newKind === "LCA"
                        ? "2027-03-01"
                        : new Date().toISOString().slice(0, 10),
                    maturityDate: "2028-12-01",
                  },
                  "Posição de investimento registrada no banco de dados."
                );
                if (ok) setNewName("");
                return;
              }
              updatePositions([
                ...positions,
                {
                  id: `pos-${Date.now()}`,
                  symbol: newKind,
                  name: newName,
                  kind: newKind,
                  institution: newInst,
                  indexer: "CDI/SELIC",
                  rateLabel: newRateLabel,
                  costBasisReais: newCostReais,
                  currentGrossReais: newGrossReais,
                  daysHeld: newDays,
                  redemptionAvailableAt: new Date().toISOString().slice(0, 10),
                  maturityDate: "2028-12-01",
                  fgcEligible:
                    newKind === "CDB" || newKind === "LCI" || newKind === "LCA",
                  quoteStatus: "VALID",
                },
              ]);
              setNewName("");
            }}
            className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:grid-cols-6"
          >
            <input
              type="text"
              required
              placeholder="Ativo (Ex: CDB Banco X)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="rounded-xl border border-slate-200 bg-[#F5F6FA] px-3 py-2 text-xs focus:border-[#6C5CE7] focus:bg-white focus:outline-none sm:col-span-2"
            />
            <select
              value={newKind}
              onChange={(e) =>
                setNewKind(e.target.value as PositionRow["kind"])
              }
              className="rounded-xl border border-slate-200 bg-[#F5F6FA] px-3 py-2 text-xs"
            >
              <option value="TESOURO_SELIC">Tesouro Selic</option>
              <option value="CDB">CDB</option>
              <option value="LCI">LCI</option>
              <option value="LCA">LCA</option>
              <option value="TESOURO_IPCA">Tesouro IPCA+</option>
              <option value="TESOURO_PREFIXADO">Tesouro Prefixado</option>
              <option value="FUND">Fundo</option>
              <option value="ETF">ETF / Renda Variável</option>
            </select>
            <input
              type="number"
              min={1}
              step={0.01}
              placeholder="Custo (R$)"
              value={newCostReais}
              onChange={(e) => setNewCostReais(Number(e.target.value))}
              className="rounded-xl border border-slate-200 bg-[#F5F6FA] px-3 py-2 font-mono text-xs"
            />
            <input
              type="number"
              min={1}
              step={0.01}
              placeholder="Valor Bruto Atual (R$)"
              value={newGrossReais}
              onChange={(e) => setNewGrossReais(Number(e.target.value))}
              className="rounded-xl border border-slate-200 bg-[#F5F6FA] px-3 py-2 font-mono text-xs"
            />
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-1 rounded-xl bg-[#6C5CE7] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#5849BE]"
            >
              <Plus className="h-3.5 w-3.5" />
              Registrar Posição
            </button>
          </form>

          {/* Modal / Painel de Resgate Integrado p/ Conta Bancária P01 */}
          {redeemingPos && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!onPersistAction || !redeemAccountId) return;
                const ok = await onPersistAction(
                  {
                    action: "REDEEM_OR_UPDATE_INVESTMENT",
                    subAction: "REDEEM",
                    positionId: redeemingPos.id,
                    targetAccountId: redeemAccountId,
                    redeemGrossDecimal,
                  },
                  `Resgate de ${redeemingPos.name} creditado na conta bancária (principal como TRANSFER_IN + rendimento líquido pós-IR como INCOME).`
                );
                if (ok) setRedeemingPos(null);
              }}
              className="rounded-2xl border border-[#6C5CE7]/30 bg-[#EFEFFD]/60 p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-extrabold text-[#1E1B39]">
                    Resgatar Posição para Conta Bancária: {redeemingPos.name}
                  </h4>
                  <p className="text-xs text-slate-600">
                    O principal retorna via <code>TRANSFER_IN</code> (sem inflar
                    receita) e o rendimento líquido pós-IR regressivo entra como{" "}
                    <code>INCOME</code> liquidado.
                  </p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 text-xs sm:grid-cols-4">
                <div>
                  <label className="font-bold text-slate-700">
                    Valor Bruto a Resgatar (R$)
                  </label>
                  <input
                    type="text"
                    required
                    value={redeemGrossDecimal}
                    onChange={(e) => setRedeemGrossDecimal(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono font-bold text-[#1E1B39]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="font-bold text-slate-700">
                    Conta Bancária de Destino (P01)
                  </label>
                  <select
                    value={redeemAccountId}
                    onChange={(e) => setRedeemAccountId(e.target.value)}
                    required
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-semibold text-[#1E1B39]"
                  >
                    {activeAccounts.length === 0 ? (
                      <option value="">
                        Cadastre uma conta bancária primeiro
                      </option>
                    ) : (
                      activeAccounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>
                <div className="flex items-end gap-2">
                  <button
                    type="button"
                    onClick={() => setRedeemingPos(null)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 font-semibold text-slate-600"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={activeAccounts.length === 0}
                    className="flex-1 rounded-xl bg-[#6C5CE7] px-4 py-2 font-bold text-white disabled:opacity-40"
                  >
                    Confirmar Resgate
                  </button>
                </div>
              </div>
            </form>
          )}

          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
              <h3 className="text-sm font-bold text-[#1E1B39]">
                Posições da Carteira e Custódia
              </h3>
              <span className="text-xs text-slate-500">
                {positions.length} ativo(s) monitorado(s)
              </span>
            </div>
            {/* Versão Celular (<768px): Cartões de Custódia Touch */}
            <div className="divide-y divide-slate-100 md:hidden">
              {positions.length === 0 ? (
                <div className="px-4 py-10 text-center text-xs text-slate-500">
                  Nenhum investimento cadastrado. Os indicadores permanecem em R$ 0,00 até o registro da primeira posição real.
                </div>
              ) : (
                positions.map((pos) => {
                  const isExempt =
                    (pos.kind === "LCI" || pos.kind === "LCA") &&
                    workspaceType === "PERSONAL";
                  const netVal = isExempt
                    ? pos.currentGrossReais
                    : taxableFixedIncomeRedemption({
                        principal: pos.costBasisReais,
                        grossRedemption: pos.currentGrossReais,
                        days: Math.max(30, pos.daysHeld),
                      }).netRedemption;

                  return (
                    <div key={pos.id} className="space-y-3 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="rounded-lg bg-[#EFEFFD] px-2 py-0.5 font-mono text-[10px] font-bold text-[#6C5CE7]">
                              {pos.kind}
                            </span>
                            <span className="text-[11px] text-slate-500">
                              {pos.rateLabel}
                            </span>
                          </div>
                          <h4 className="mt-1 text-sm font-extrabold text-[#1E1B39]">
                            {pos.name}
                          </h4>
                          <p className="text-[11px] text-slate-500">
                            {pos.institution} • Venc: {pos.maturityDate}
                          </p>
                        </div>
                        {pos.quoteStatus === "VALID" ? (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                            <CheckCircle2 className="h-3 w-3" /> Válida
                          </span>
                        ) : (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                            <AlertTriangle className="h-3 w-3" /> Defasada
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-2 rounded-xl bg-[#F5F6FA] p-2.5 text-[11px]">
                        <div>
                          <span className="block text-[10px] text-slate-500">Custo</span>
                          <strong className="font-mono text-slate-700">
                            {formatBRL(Math.round(pos.costBasisReais * 100))}
                          </strong>
                        </div>
                        <div>
                          <span className="block text-[10px] text-slate-500">Bruto</span>
                          <strong className="font-mono text-[#1E1B39]">
                            {formatBRL(Math.round(pos.currentGrossReais * 100))}
                          </strong>
                        </div>
                        <div>
                          <span className="block text-[10px] text-[#6C5CE7]">Líq. Est.</span>
                          <strong className="font-mono text-[#6C5CE7]">
                            {formatBRL(Math.round(netVal * 100))}
                          </strong>
                        </div>
                      </div>

                      {editingQuotePosId === pos.id && (
                        <div className="flex items-center gap-2 rounded-xl border border-[#6C5CE7]/30 bg-[#EFEFFD]/50 p-2.5">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={quoteDecimalInput}
                            onChange={(e) => setQuoteDecimalInput(e.target.value)}
                            className="min-h-[40px] flex-1 rounded-xl border border-[#6C5CE7] bg-white px-3 py-1.5 font-mono text-sm font-bold"
                          />
                          <button
                            type="button"
                            onClick={async () => {
                              if (onPersistAction) {
                                const ok = await onPersistAction(
                                  {
                                    action: "REDEEM_OR_UPDATE_INVESTMENT",
                                    subAction: "UPDATE_QUOTE",
                                    positionId: pos.id,
                                    newGrossDecimal: quoteDecimalInput,
                                  },
                                  "Cotação da posição atualizada."
                                );
                                if (ok) setEditingQuotePosId(null);
                              }
                            }}
                            className="min-h-[40px] rounded-xl bg-[#6C5CE7] px-3.5 py-1.5 text-xs font-bold text-white"
                          >
                            Salvar
                          </button>
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingQuotePosId(
                              editingQuotePosId === pos.id ? null : pos.id
                            );
                            setQuoteDecimalInput(
                              centsToDecimalString(
                                Math.round(pos.currentGrossReais * 100)
                              )
                            );
                          }}
                          className="inline-flex min-h-[38px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          Cotação
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRedeemingPos(pos);
                            setRedeemGrossDecimal(
                              centsToDecimalString(
                                Math.round(pos.currentGrossReais * 100)
                              )
                            );
                          }}
                          className="inline-flex min-h-[38px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#EFEFFD] px-2.5 py-2 text-xs font-bold text-[#6C5CE7]"
                        >
                          <ArrowDownToLine className="h-3.5 w-3.5" />
                          Resgatar
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (onPersistAction) {
                              await onPersistAction(
                                {
                                  action: "REDEEM_OR_UPDATE_INVESTMENT",
                                  subAction: "DELETE",
                                  positionId: pos.id,
                                },
                                "Posição removida da carteira."
                              );
                            }
                          }}
                          aria-label="Remover Posição"
                          className="inline-flex min-h-[38px] items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Versão Tablet & Desktop (>=768px): Tabela Completa */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200/80 bg-[#F5F6FA] text-[11px] font-bold uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Ativo / Instituição</th>
                    <th className="px-4 py-3">Classe / Taxa</th>
                    <th className="px-4 py-3">Cotação / Fonte</th>
                    <th className="px-4 py-3 text-right">Custo Aporte</th>
                    <th className="px-4 py-3 text-right">Saldo Bruto</th>
                    <th className="px-4 py-3 text-right">Líquido Est.</th>
                    <th className="px-4 py-3 text-right">Operações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {positions.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-10 text-center text-slate-500"
                      >
                        Nenhum investimento cadastrado. Os indicadores permanecem
                        em R$ 0,00 até o registro da primeira posição real.
                      </td>
                    </tr>
                  ) : (
                    positions.map((pos) => {
                      const isExempt =
                        (pos.kind === "LCI" || pos.kind === "LCA") &&
                        workspaceType === "PERSONAL";
                      const netVal = isExempt
                        ? pos.currentGrossReais
                        : taxableFixedIncomeRedemption({
                            principal: pos.costBasisReais,
                            grossRedemption: pos.currentGrossReais,
                            days: Math.max(30, pos.daysHeld),
                          }).netRedemption;

                      return (
                        <tr key={pos.id} className="hover:bg-[#F5F6FA]/60">
                          <td className="px-4 py-3">
                            <div className="font-bold text-[#1E1B39]">
                              {pos.name}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {pos.institution} • Venc: {pos.maturityDate}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="rounded-lg bg-[#EFEFFD] px-2 py-0.5 font-mono text-[10px] font-bold text-[#6C5CE7]">
                              {pos.kind}
                            </span>{" "}
                            <span className="text-slate-600">• {pos.rateLabel}</span>
                          </td>
                          <td className="px-4 py-3">
                            {pos.quoteStatus === "VALID" ? (
                              <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                                <CheckCircle2 className="h-3.5 w-3.5" /> Válida
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 font-medium text-amber-700">
                                <AlertTriangle className="h-3.5 w-3.5" /> Defasada
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-600">
                            {formatBRL(Math.round(pos.costBasisReais * 100))}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold tabular-nums text-[#1E1B39]">
                            {editingQuotePosId === pos.id ? (
                              <div className="inline-flex items-center gap-1">
                                <input
                                  type="text"
                                  value={quoteDecimalInput}
                                  onChange={(e) =>
                                    setQuoteDecimalInput(e.target.value)
                                  }
                                  className="w-24 rounded-lg border border-[#6C5CE7] bg-white px-2 py-1 text-right font-mono text-xs"
                                />
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (onPersistAction) {
                                      const ok = await onPersistAction(
                                        {
                                          action: "REDEEM_OR_UPDATE_INVESTMENT",
                                          subAction: "UPDATE_QUOTE",
                                          positionId: pos.id,
                                          newGrossDecimal: quoteDecimalInput,
                                        },
                                        "Cotação da posição atualizada."
                                      );
                                      if (ok) setEditingQuotePosId(null);
                                    }
                                  }}
                                  className="rounded-lg bg-[#6C5CE7] px-2 py-1 text-[10px] font-bold text-white"
                                >
                                  OK
                                </button>
                              </div>
                            ) : (
                              formatBRL(Math.round(pos.currentGrossReais * 100))
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold tabular-nums text-[#6C5CE7]">
                            {formatBRL(Math.round(netVal * 100))}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="inline-flex flex-wrap justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingQuotePosId(
                                    editingQuotePosId === pos.id ? null : pos.id
                                  );
                                  setQuoteDecimalInput(
                                    centsToDecimalString(
                                      Math.round(pos.currentGrossReais * 100)
                                    )
                                  );
                                }}
                                title="Atualizar Cotação / Marcação"
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-700 hover:border-[#6C5CE7]"
                              >
                                <RefreshCw className="h-3 w-3" />
                                Cotação
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setRedeemingPos(pos);
                                  setRedeemGrossDecimal(
                                    centsToDecimalString(
                                      Math.round(pos.currentGrossReais * 100)
                                    )
                                  );
                                }}
                                title="Resgatar para Conta Bancária"
                                className="inline-flex items-center gap-1 rounded-lg bg-[#EFEFFD] px-2 py-1 text-[10px] font-bold text-[#6C5CE7] hover:bg-[#6C5CE7] hover:text-white"
                              >
                                <ArrowDownToLine className="h-3 w-3" />
                                Resgatar
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  if (onPersistAction) {
                                    await onPersistAction(
                                      {
                                        action: "REDEEM_OR_UPDATE_INVESTMENT",
                                        subAction: "DELETE",
                                        positionId: pos.id,
                                      },
                                      "Posição removida da carteira."
                                    );
                                  }
                                }}
                                title="Remover Posição"
                                className="inline-flex items-center rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] font-semibold text-rose-700 hover:bg-rose-100"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
