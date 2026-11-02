"use client";

import React, { useMemo, useState } from "react";
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
} from "lucide-react";
import {
  brazilPfFixedIncomeTax,
  futureValue,
  projectLiquidity,
  taxableFixedIncomeRedemption,
} from "@/domain/investments";
import { formatBRL } from "@/domain/planning";

export type P03TabKey =
  | "visao-geral"
  | "carteira"
  | "operacoes"
  | "comparador"
  | "rentabilidade"
  | "riscos"
  | "simulador"
  | "fontes";

interface PositionRow {
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

interface Props {
  workspaceType: "PERSONAL" | "BUSINESS";
  workspaceName: string;
  activeSubTab?: P03TabKey;
}

export function NovaInvestmentsP03View({
  workspaceType,
  workspaceName,
  activeSubTab = "visao-geral",
}: Props) {
  const [subTab, setSubTab] = useState<P03TabKey>(activeSubTab);

  // Conforme regra fundamental P03: "Se o usuário ainda não possuir investimentos cadastrados,
  // o sistema deverá apresentar a carteira vazia (R$ 0,00), sem números fictícios."
  const [positions, setPositions] = useState<PositionRow[]>([]);

  // Form de nova posição / operação (BUY/SELL)
  const [newName, setNewName] = useState("");
  const [newKind, setNewKind] = useState<PositionRow["kind"]>("TESOURO_SELIC");
  const [newInst, setNewInst] = useState("Tesouro Direto / Itaú");
  const [newRateLabel, setNewRateLabel] = useState("Selic + 0,05% a.a.");
  const [newCostReais, setNewCostReais] = useState(5000);
  const [newGrossReais, setNewGrossReais] = useState(5420);
  const [newDays, setNewDays] = useState(365);

  // Estado do Simulador Patrimonial P03 (Calibrado para o exemplo oficial da especificação:
  // Capital inicial R$ 5.000 + Aporte mensal R$ 500 + Prazo 10 anos + Taxa 9% a.a. =>
  // Patrimônio bruto estimado: R$ 106.696,15 | Total investido: R$ 65.000,00 | Rendimento bruto: R$ 41.696,15)
  const [simPrincipal, setSimPrincipal] = useState<number>(5000);
  const [simMonthly, setSimMonthly] = useState<number>(500);
  const [simYears, setSimYears] = useState<number>(10);
  const [simAnnualRatePct, setSimAnnualRatePct] = useState<number>(9);
  const [simInflationPct, setSimInflationPct] = useState<number>(4.5);

  // Estado do Comparador Inteligente P03
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

  const portfolioMetrics = useMemo(() => {
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

    return {
      totalCostCents: Math.round(totalCost * 100),
      totalGrossCents: Math.round(totalGross * 100),
      grossReturnCents: Math.round((totalGross - totalCost) * 100),
      totalEstimatedNetCents: Math.round(totalEstimatedNet * 100),
      availableLiquidityCents: Math.round(liq.available * 100),
      lockedLiquidityCents: Math.round(liq.locked * 100),
    };
  }, [positions, workspaceType]);

  const loadSamplePortfolioP03 = () => {
    setPositions([
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
    ]);
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho e Sub-abas do Pacote 03 */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-[#69E2C0]/30 px-2.5 py-0.5 text-[10px] font-bold uppercase text-[#142D43]">
                NOVA — Pacote 03 v3.0.0
              </span>
              <span className="text-xs text-slate-500">
                {workspaceName} ({workspaceType})
              </span>
            </div>
            <h2 className="mt-1 text-lg font-extrabold text-[#142D43]">
              Investimentos, Rentabilidade e Planejamento Patrimonial
            </h2>
          </div>

          <div className="flex gap-2">
            {positions.length === 0 ? (
              <button
                onClick={loadSamplePortfolioP03}
                className="rounded-xl border border-[#142D43]/20 bg-[#69E2C0]/25 px-3.5 py-2 text-xs font-bold text-[#142D43] hover:bg-[#69E2C0]/40"
              >
                Carregar Carteira de Homologação (P03)
              </button>
            ) : (
              <button
                onClick={() => setPositions([])}
                className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600"
              >
                Zerar Carteira (R$ 0,00)
              </button>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {[
            { key: "visao-geral" as P03TabKey, label: "Visão Geral", icon: TrendingUp },
            { key: "carteira" as P03TabKey, label: "Minha Carteira", icon: Briefcase },
            { key: "operacoes" as P03TabKey, label: "Operações (Aporte/Resgate)", icon: ArrowLeftRight },
            { key: "comparador" as P03TabKey, label: "Comparador de Aplicações", icon: Scale },
            { key: "riscos" as P03TabKey, label: "Liquidez e Riscos", icon: ShieldAlert },
            { key: "simulador" as P03TabKey, label: "Simulador Patrimonial", icon: Calculator },
            { key: "fontes" as P03TabKey, label: "Fontes e Atualizações", icon: Database },
          ].map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => setSubTab(t.key)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                  subTab === t.key
                    ? "bg-[#142D43] text-white"
                    : "bg-[#F4F7FA] text-slate-600 hover:text-[#142D43]"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* KPIs Consolidados da Carteira (Começa em R$ 0,00 sem carteira) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <span className="text-xs font-semibold text-slate-500">
            Patrimônio Investido (Bruto)
          </span>
          <div className="mt-2 font-mono text-2xl font-extrabold tabular-nums text-[#142D43]">
            {formatBRL(portfolioMetrics.totalGrossCents)}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Custo de aquisição: {formatBRL(portfolioMetrics.totalCostCents)}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <span className="text-xs font-semibold text-slate-500">
            Retorno Bruto Acumulado
          </span>
          <div className="mt-2 font-mono text-2xl font-extrabold tabular-nums text-emerald-700">
            {formatBRL(portfolioMetrics.grossReturnCents)}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {positions.length === 0
              ? "Carteira vazia (sem números fictícios)"
              : "Observado sobre posições ativas"}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <span className="text-xs font-semibold text-slate-500">
            Patrimônio Líquido Estimado (Pós-IR)
          </span>
          <div className="mt-2 font-mono text-2xl font-extrabold tabular-nums text-[#142D43]">
            {formatBRL(portfolioMetrics.totalEstimatedNetCents)}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {workspaceType === "PERSONAL"
              ? "Tabela regressiva RF PF (22,5% a 15%)"
              : "Estimativa fiscal parametrizável PJ"}
          </p>
        </div>

        <div className="rounded-2xl border border-[#142D43]/15 bg-[#142D43] p-5 text-white shadow-sm">
          <span className="text-xs font-semibold text-[#69E2C0]">
            Disponível para Resgate Hoje
          </span>
          <div className="mt-2 font-mono text-2xl font-extrabold tabular-nums text-white">
            {formatBRL(portfolioMetrics.availableLiquidityCents)}
          </div>
          <p className="mt-1 text-xs text-slate-300">
            Em carência/vencimento:{" "}
            {formatBRL(portfolioMetrics.lockedLiquidityCents)}
          </p>
        </div>
      </div>

      {/* =====================================================================
          SIMULADOR PATRIMONIAL (SEÇÃO 4 DO PACOTE 03)
         ===================================================================== */}
      {(subTab === "visao-geral" || subTab === "simulador") && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <span className="rounded-full bg-[#F4F7FA] px-2.5 py-0.5 text-[10px] font-bold uppercase text-[#142D43]">
                Simulador Patrimonial — Prévia Interativa (P03)
              </span>
              <h3 className="mt-1 text-base font-extrabold text-[#142D43]">
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
              className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-[#142D43]"
            >
              Restaurar Exemplo Padrão (10 anos / 9% a.a.)
            </button>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="space-y-4 text-xs lg:col-span-5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700">
                    Capital inicial (R$)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={simPrincipal}
                    onChange={(e) => setSimPrincipal(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-sm font-bold text-[#142D43]"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700">
                    Aporte mensal (R$)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={simMonthly}
                    onChange={(e) => setSimMonthly(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-sm font-bold text-[#142D43]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700">
                    Prazo (anos)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={simYears}
                    onChange={(e) => setSimYears(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-sm font-bold text-[#142D43]"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700">
                    Taxa anual (%)
                  </label>
                  <input
                    type="number"
                    step={0.25}
                    value={simAnnualRatePct}
                    onChange={(e) => setSimAnnualRatePct(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-sm font-bold text-[#142D43]"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700">
                    Inflação est. (%)
                  </label>
                  <input
                    type="number"
                    step={0.25}
                    value={simInflationPct}
                    onChange={(e) => setSimInflationPct(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-sm font-bold text-[#142D43]"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col justify-between rounded-2xl bg-[#142D43] p-6 text-white lg:col-span-7">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#69E2C0]">
                  Patrimônio bruto estimado ao fim do período ({simYears} anos)
                </span>
                <div className="mt-1 font-mono text-3xl font-black tabular-nums text-white sm:text-4xl">
                  {formatBRL(Math.round(simResult.amount * 100))}
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-xl bg-white/10 p-3">
                    <span className="text-[11px] text-slate-300">
                      Total investido
                    </span>
                    <div className="mt-1 font-mono text-base font-bold tabular-nums text-white">
                      {formatBRL(Math.round(simResult.contributions * 100))}
                    </div>
                  </div>
                  <div className="rounded-xl bg-[#69E2C0]/20 p-3">
                    <span className="text-[11px] text-[#69E2C0]">
                      Rendimento bruto
                    </span>
                    <div className="mt-1 font-mono text-base font-bold tabular-nums text-[#69E2C0]">
                      {formatBRL(Math.round(simResult.earnings * 100))}
                    </div>
                  </div>
                  <div className="rounded-xl bg-white/10 p-3">
                    <span className="text-[11px] text-slate-300">
                      Poder de compra (deflacionado)
                    </span>
                    <div className="mt-1 font-mono text-base font-bold tabular-nums text-amber-300">
                      {formatBRL(Math.round(simResult.inflationAdjusted * 100))}
                    </div>
                  </div>
                </div>
              </div>

              <p className="mt-4 text-[11px] text-slate-300">
                Simulação ilustrativa com capitalização mensal e aportes no fim
                de cada mês, sem tributos ou taxas no valor bruto principal. Não
                utiliza taxas atuais de mercado e não garante resultados.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          COMPARADOR INTELIGENTE DE APLICAÇÕES (SEÇÃO 3 DO PACOTE 03)
         ===================================================================== */}
      {(subTab === "visao-geral" || subTab === "comparador") && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-extrabold text-[#142D43]">
                Comparador Inteligente de Investimentos (Bruto vs Líquido Pós-IR)
              </h3>
              <p className="text-xs text-slate-500">
                Avalia rentabilidade líquida descontada da alíquota regressiva PF
                ({(brazilPfFixedIncomeTax(compDays).rate * 100).toFixed(1)}% para{" "}
                {compDays} dias), liquidez, garantias FGC e risco de marcação a
                mercado.
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <div>
                <label className="mr-1.5 font-bold">Valor (R$):</label>
                <input
                  type="number"
                  value={compAmount}
                  onChange={(e) => setCompAmount(Number(e.target.value))}
                  className="w-28 rounded-lg border border-slate-300 px-2.5 py-1 font-mono font-bold"
                />
              </div>
              <div>
                <label className="mr-1.5 font-bold">Prazo (dias):</label>
                <select
                  value={compDays}
                  onChange={(e) => setCompDays(Number(e.target.value))}
                  className="rounded-lg border border-slate-300 px-2.5 py-1 font-bold"
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
                source: "Tesouro Direto (Cotação Válida)",
              },
              {
                name: "CDB Liquidez Diária 102% CDI",
                grossRate: 0.1137,
                exemptPF: false,
                liquidity: "Imediata (D+0)",
                guarantee: "FGC (até R$ 250 mil / CPF-CNPJ)",
                mtmRisk: "Baixíssimo",
                source: "Referência Bancária B3",
              },
              {
                name: "LCI / LCA 94% CDI",
                grossRate: 0.1048,
                exemptPF: true,
                liquidity: "Carência mínima legal (270d)",
                guarantee: "FGC (até R$ 250 mil)",
                mtmRisk: "Bloqueado até fim da carência",
                source: "Emissão Bancária Balcão",
              },
              {
                name: "Tesouro IPCA+ / Prefixado",
                grossRate: 0.118,
                exemptPF: false,
                liquidity: "D+1 (Sujeito a Marcação a Mercado)",
                guarantee: "Soberana (Tesouro Nacional)",
                mtmRisk: "Atenção: Oscilação em resgate antecipado",
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
                  className="flex flex-col justify-between rounded-xl border border-slate-200 bg-[#F4F7FA] p-4 text-xs"
                >
                  <div>
                    <span className="rounded bg-white px-2 py-0.5 text-[10px] font-bold text-[#142D43]">
                      {item.source}
                    </span>
                    <h4 className="mt-2 text-sm font-extrabold text-[#142D43]">
                      {item.name}
                    </h4>
                    <div className="mt-2 font-mono text-lg font-black text-emerald-700">
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
                  <div className="mt-3 space-y-1 border-t border-slate-200 pt-2 text-[11px] text-slate-600">
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

          <div className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-[11px] text-amber-950">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
            <span>
              <strong>Nota Regulatória (CVM / Receita Federal):</strong> O
              comparador fornece informações objetivas e simulações educacionais.
              Não constitui recomendação individualizada de valores mobiliários.
              No modo PJ, regras fiscais dependem do regime tributário da empresa.
            </span>
          </div>
        </div>
      )}

      {/* =====================================================================
          MINHA CARTEIRA E OPERAÇÕES (CADASTRO DE POSIÇÃO / APORTE)
         ===================================================================== */}
      {(subTab === "carteira" ||
        subTab === "operacoes" ||
        subTab === "riscos" ||
        subTab === "fontes") && (
        <div className="space-y-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!newName.trim()) return;
              setPositions((prev) => [
                ...prev,
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
                  redemptionAvailableAt: "2026-01-01",
                  maturityDate: "2028-12-01",
                  fgcEligible:
                    newKind === "CDB" || newKind === "LCI" || newKind === "LCA",
                  quoteStatus: "VALID",
                },
              ]);
              setNewName("");
            }}
            className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-6"
          >
            <input
              type="text"
              required
              placeholder="Ativo (Ex: CDB Banco X)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 text-xs sm:col-span-2"
            />
            <select
              value={newKind}
              onChange={(e) =>
                setNewKind(e.target.value as PositionRow["kind"])
              }
              className="rounded-xl border border-slate-300 px-3 py-2 text-xs"
            >
              <option value="TESOURO_SELIC">Tesouro Selic</option>
              <option value="CDB">CDB</option>
              <option value="LCI">LCI</option>
              <option value="LCA">LCA</option>
              <option value="TESOURO_IPCA">Tesouro IPCA+</option>
              <option value="FUND">Fundo</option>
            </select>
            <input
              type="number"
              placeholder="Custo (R$)"
              value={newCostReais}
              onChange={(e) => setNewCostReais(Number(e.target.value))}
              className="rounded-xl border border-slate-300 px-3 py-2 font-mono text-xs"
            />
            <input
              type="number"
              placeholder="Valor Bruto Atual (R$)"
              value={newGrossReais}
              onChange={(e) => setNewGrossReais(Number(e.target.value))}
              className="rounded-xl border border-slate-300 px-3 py-2 font-mono text-xs"
            />
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-1 rounded-xl bg-[#142D43] px-4 py-2 text-xs font-bold text-white"
            >
              <Plus className="h-3.5 w-3.5 text-[#69E2C0]" />
              Registrar Posição
            </button>
          </form>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-[#F4F7FA] text-[11px] font-bold uppercase text-slate-600">
                <tr>
                  <th className="px-4 py-3">Ativo / Instituição</th>
                  <th className="px-4 py-3">Classe / Taxa</th>
                  <th className="px-4 py-3">Cotação / Fonte</th>
                  <th className="px-4 py-3 text-right">Custo Aporte</th>
                  <th className="px-4 py-3 text-right">Saldo Bruto</th>
                  <th className="px-4 py-3 text-right">Líquido Est.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {positions.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-slate-500"
                    >
                      Nenhum investimento cadastrado. Os indicadores permanecem
                      em R$ 0,00 até o primeiro registro ou carga de homologação.
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
                      <tr key={pos.id}>
                        <td className="px-4 py-3">
                          <div className="font-bold text-[#142D43]">
                            {pos.name}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {pos.institution}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded bg-[#F4F7FA] px-2 py-0.5 font-mono text-[10px] font-bold">
                            {pos.kind}
                          </span>{" "}
                          • {pos.rateLabel}
                        </td>
                        <td className="px-4 py-3">
                          {pos.quoteStatus === "VALID" ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Válida
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-amber-700">
                              <AlertTriangle className="h-3.5 w-3.5" /> Defasada
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums">
                          {formatBRL(Math.round(pos.costBasisReais * 100))}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold tabular-nums">
                          {formatBRL(Math.round(pos.currentGrossReais * 100))}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold tabular-nums text-emerald-700">
                          {formatBRL(Math.round(netVal * 100))}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
