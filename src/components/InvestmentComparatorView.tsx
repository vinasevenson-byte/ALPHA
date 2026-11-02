"use client";

import React, { useMemo, useState } from "react";
import {
  TrendingUp,
  Shield,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Plus,
  Scale,
  Landmark,
  Info,
} from "lucide-react";
import {
  evaluateMarketProducts,
  formatBRLFromCents,
  formatBRLFromDecimal,
  formatPct,
  InvestmentObjective,
  MacroRates,
} from "@/lib/financial-engine";

interface InvestmentPositionItem {
  id: string;
  name: string;
  assetClass: string;
  institution: string;
  investedAmountCents: number;
  currentAmountCents: number;
  indexer: string;
  rateDescription: string;
  annualGrossYieldBps: number;
  liquidity: string;
  maturityDate?: string | null;
  fgcCovered: boolean;
  taxExempt: boolean;
  riskLevel: string;
}

interface Props {
  workspaceType: "PF" | "PJ";
  investments: InvestmentPositionItem[];
  macroRates: MacroRates;
  reservePotentialCents: number;
  onAddInvestment: (payload: {
    name: string;
    assetClass: string;
    institution: string;
    investedAmountCents: number;
    currentAmountCents: number;
    indexer: string;
    rateDescription: string;
    annualGrossYieldBps: number;
    liquidity: string;
    maturityDate: string;
    fgcCovered: boolean;
    taxExempt: boolean;
    riskLevel: string;
  }) => Promise<void>;
}

const REFERENCE_MATRIX = [
  {
    name: "Tesouro Selic",
    analysis: "Taxa, liquidez D+0/D+1 e custos B3",
    use: "Reserva de emergência e caixa imediato",
  },
  {
    name: "CDB",
    analysis: "Percentual do CDI, emissor, FGC e liquidez",
    use: "Reserva ou objetivos definidos",
  },
  {
    name: "LCI e LCA",
    analysis: "Rentabilidade líquida isenta (PF), carência e prazo",
    use: "Objetivos de prazo compatível (>= 9 meses)",
  },
  {
    name: "Tesouro IPCA+",
    analysis: "Taxa real acima da inflação, vencimento e marcação a mercado",
    use: "Objetivos de longo prazo e proteção patrimonial",
  },
  {
    name: "Tesouro Prefixado",
    analysis: "Taxa nominal contratada e risco de venda antecipada",
    use: "Planejamento com vencimento exato definido",
  },
  {
    name: "Fundos",
    analysis: "Taxas de adm/perf, estratégia, come-cotas e histórico",
    use: "Diversificação e caixa corporativo",
  },
  {
    name: "ETFs e ações",
    analysis: "Volatilidade, custos de corretagem/B3 e riscos de mercado",
    use: "Objetivos com tolerância a oscilações no longo prazo",
  },
];

export function InvestmentComparatorView({
  workspaceType,
  investments,
  macroRates,
  reservePotentialCents,
  onAddInvestment,
}: Props) {
  const [objective, setObjective] = useState<InvestmentObjective>(
    workspaceType === "PJ" ? "CORPORATE_CASH" : "EMERGENCY_LIQUIDITY"
  );
  const [horizonMonths, setHorizonMonths] = useState<number>(12);
  const [simulatedAmountReais, setSimulatedAmountReais] = useState<number>(
    Math.max(3000, Math.round(reservePotentialCents / 100))
  );
  const [showNewModal, setShowNewModal] = useState(false);

  // Form state para novo investimento
  const [newName, setNewName] = useState("");
  const [newInstitution, setNewInstitution] = useState("");
  const [newAssetClass, setNewAssetClass] = useState("CDB");
  const [newRateDesc, setNewRateDesc] = useState("105% do CDI");
  const [newAmountReais, setNewAmountReais] = useState(5000);
  const [newLiquidity, setNewLiquidity] = useState("D+0");
  const [newFgc, setNewFgc] = useState(true);
  const [newExempt, setNewExempt] = useState(false);

  const evaluatedProducts = useMemo(
    () =>
      evaluateMarketProducts({
        objective,
        horizonMonths,
        amountReais: simulatedAmountReais,
        workspaceType,
        macro: macroRates,
      }),
    [objective, horizonMonths, simulatedAmountReais, workspaceType, macroRates]
  );

  const compatibleProducts = evaluatedProducts.filter((p) => p.compatible);
  const incompatibleProducts = evaluatedProducts.filter((p) => !p.compatible);

  const totalPortfolioCents = investments.reduce(
    (s, i) => s + i.currentAmountCents,
    0
  );
  const totalInvestedCents = investments.reduce(
    (s, i) => s + i.investedAmountCents,
    0
  );
  const totalGainCents = totalPortfolioCents - totalInvestedCents;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    await onAddInvestment({
      name: newName,
      assetClass: newAssetClass,
      institution: newInstitution || "Corretora / Banco",
      investedAmountCents: Math.round(newAmountReais * 100),
      currentAmountCents: Math.round(newAmountReais * 100),
      indexer: newAssetClass.includes("SELIC")
        ? "SELIC"
        : newAssetClass.includes("IPCA")
        ? "IPCA"
        : "CDI",
      rateDescription: newRateDesc,
      annualGrossYieldBps: 1125,
      liquidity: newLiquidity,
      maturityDate: "2028-12",
      fgcCovered: newFgc,
      taxExempt: newExempt,
      riskLevel: "BAIXO",
    });
    setNewName("");
    setShowNewModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho de Indicadores de Mercado e Carteira */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
          <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
            Patrimônio Investido ({workspaceType})
          </span>
          <div className="mt-2 font-mono text-2xl font-bold text-white">
            {formatBRLFromCents(totalPortfolioCents)}
          </div>
          <p className="mt-1 text-xs text-emerald-400">
            Rendimento acumulado: +{formatBRLFromCents(totalGainCents)}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
          <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
            Referências Oficiais (B3 / BCB)
          </span>
          <div className="mt-2 flex items-baseline gap-3 font-mono">
            <div>
              <span className="text-xs text-slate-400">Selic: </span>
              <strong className="text-base text-emerald-300">
                {formatPct(macroRates.selicAnnualPct)}
              </strong>
            </div>
            <div>
              <span className="text-xs text-slate-400">CDI: </span>
              <strong className="text-base text-sky-300">
                {formatPct(macroRates.cdiAnnualPct)}
              </strong>
            </div>
            <div>
              <span className="text-xs text-slate-400">IPCA: </span>
              <strong className="text-base text-amber-300">
                {formatPct(macroRates.ipcaAnnualPct)}
              </strong>
            </div>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Base para cálculo de juro líquido real
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
          <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
            Cobertura FGC na Carteira
          </span>
          <div className="mt-2 font-mono text-2xl font-bold text-sky-300">
            {formatBRLFromCents(
              investments
                .filter((i) => i.fgcCovered)
                .reduce((s, i) => s + i.currentAmountCents, 0)
            )}
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Limite de R$ 250 mil por CPF/CNPJ e instituição
          </p>
        </div>

        <div className="flex flex-col justify-between rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
              Acompanhar Carteira Real
            </span>
            <p className="mt-1 text-xs text-slate-300">
              Cadastre seus CDBs, Tesouro, LCIs ou Fundos para consolidar seu
              rendimento líquido.
            </p>
          </div>
          <button
            onClick={() => setShowNewModal(!showNewModal)}
            className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
          >
            <Plus className="h-4 w-4" />
            Cadastrar Investimento na Carteira
          </button>
        </div>
      </div>

      {/* Modal/Form de Novo Investimento */}
      {showNewModal && (
        <form
          onSubmit={handleCreate}
          className="rounded-2xl border border-emerald-500/30 bg-slate-900 p-5 shadow-xl"
        >
          <h4 className="text-sm font-semibold text-white">
            Registrar Novo Ativo na Carteira ({workspaceType})
          </h4>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <div className="sm:col-span-2">
              <label className="block text-xs text-slate-400">
                Nome do Produto / Título
              </label>
              <input
                type="text"
                required
                placeholder="Ex: CDB Banco Itaú 102% CDI"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400">Classe</label>
              <select
                value={newAssetClass}
                onChange={(e) => setNewAssetClass(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
              >
                <option value="TESOURO_SELIC">Tesouro Selic</option>
                <option value="CDB">CDB</option>
                <option value="LCI_LCA">LCI / LCA</option>
                <option value="TESOURO_IPCA">Tesouro IPCA+</option>
                <option value="TESOURO_PREFIXADO">Tesouro Prefixado</option>
                <option value="FUNDO">Fundo de Investimento</option>
                <option value="ETF_ACAO">ETF / Ações</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400">Instituição</label>
              <input
                type="text"
                placeholder="Ex: BTG / XP / Itaú"
                value={newInstitution}
                onChange={(e) => setNewInstitution(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400">
                Taxa Contratada
              </label>
              <input
                type="text"
                value={newRateDesc}
                onChange={(e) => setNewRateDesc(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400">
                Valor Atual (R$)
              </label>
              <input
                type="number"
                min={100}
                value={newAmountReais}
                onChange={(e) => setNewAmountReais(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
              />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4 text-xs text-slate-300">
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={newFgc}
                  onChange={(e) => setNewFgc(e.target.checked)}
                />
                Coberto pelo FGC
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={newExempt}
                  onChange={(e) => setNewExempt(e.target.checked)}
                />
                Isento de IR (LCI/LCA/CRI/CRA PF)
              </label>
              <select
                value={newLiquidity}
                onChange={(e) => setNewLiquidity(e.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs text-white"
              >
                <option value="D+0">Liquidez Imediata (D+0)</option>
                <option value="D+1">Liquidez Diária (D+1)</option>
                <option value="CARENCIA_90D">Após Carência</option>
                <option value="NO_VENCIMENTO">Somente no Vencimento</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-lg bg-emerald-500 px-4 py-1.5 text-xs font-semibold text-slate-950"
              >
                Salvar na Carteira
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Comparador Inteligente de Oportunidades */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/85 p-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30">
              <Scale className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">
                Comparador Inteligente de Oportunidades Financeiras
              </h3>
              <p className="text-xs text-slate-400">
                Não exibe apenas a maior taxa nominal: filtra por liquidez,
                desconta impostos (IR regressivo), compara com CDI/Selic/IPCA e
                destaca produtos incompatíveis com seu objetivo.
              </p>
            </div>
          </div>
        </div>

        {/* Filtros do Comparador */}
        <div className="mt-4 grid grid-cols-1 gap-4 rounded-xl border border-slate-800 bg-slate-950/70 p-4 md:grid-cols-3">
          <div>
            <label className="block text-xs font-medium text-slate-300">
              1. Qual é o seu objetivo para este recurso?
            </label>
            <select
              value={objective}
              onChange={(e) =>
                setObjective(e.target.value as InvestmentObjective)
              }
              className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-white focus:border-emerald-500 focus:outline-none"
            >
              <option value="EMERGENCY_LIQUIDITY">
                Melhor alternativa para Liquidez e Emergência (Resgate imediato)
              </option>
              <option value="MAX_NET_YIELD">
                Maior Rentabilidade Líquida Estimada (Pós-Imposto de Renda)
              </option>
              <option value="BALANCED_MEDIUM_TERM">
                Melhor Equilíbrio entre Risco, Prazo e Retorno
              </option>
              <option value="LONG_TERM_REAL_GAIN">
                Proteção contra Inflação e Longo Prazo (Juro Real IPCA+)
              </option>
              <option value="CORPORATE_CASH">
                Gestão de Caixa Empresarial / Capital de Giro (PJ D+0)
              </option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300">
              2. Prazo estimado sem precisar resgatar
            </label>
            <select
              value={horizonMonths}
              onChange={(e) => setHorizonMonths(Number(e.target.value))}
              className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-white focus:border-emerald-500 focus:outline-none"
            >
              <option value={3}>3 meses (Curto Prazo — IR 22,5%)</option>
              <option value={6}>6 meses (180 dias — IR 22,5%)</option>
              <option value={12}>12 meses (1 ano — IR 20,0%)</option>
              <option value={24}>24 meses (2 anos — IR 17,5%)</option>
              <option value={36}>36 meses (3 anos — IR Mínimo 15,0%)</option>
              <option value={60}>60 meses (5 anos — IR Mínimo 15,0%)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300">
              3. Valor para simulação líquida (R$)
            </label>
            <input
              type="number"
              min={100}
              step={500}
              value={simulatedAmountReais}
              onChange={(e) => setSimulatedAmountReais(Number(e.target.value))}
              className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-xs text-white focus:border-emerald-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Lista de Alternativas Compatíveis */}
        <div className="mt-5">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
              Alternativas Compatíveis com seu Objetivo ({compatibleProducts.length})
            </h4>
            <span className="text-[11px] text-slate-400">
              Ordenadas por adequação e retorno líquido descontado de IR/custos
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {compatibleProducts.map((item, idx) => (
              <div
                key={item.product.id}
                className={`rounded-xl border p-4 transition ${
                  idx === 0
                    ? "border-emerald-500/40 bg-emerald-950/20 ring-1 ring-emerald-500/20"
                    : "border-slate-800 bg-slate-950/70"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      {idx === 0 && (
                        <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-950">
                          #1 Destaque do Objetivo
                        </span>
                      )}
                      <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-[10px] font-medium text-slate-300">
                        {item.product.category}
                      </span>
                      <span className="text-[11px] text-emerald-300">
                        {item.suitabilityBadge}
                      </span>
                    </div>
                    <h5 className="mt-1.5 text-sm font-semibold text-white">
                      {item.product.name}
                    </h5>
                    <p className="text-xs text-slate-400">
                      {item.product.issuer} • Fonte: {item.product.sourceLabel}
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="text-[11px] text-slate-400">
                      Rentabilidade Líquida Est.
                    </span>
                    <div className="font-mono text-lg font-bold text-emerald-400">
                      {formatPct(item.netAnnualPct)} a.a.
                    </div>
                    <span className="font-mono text-[11px] text-sky-300">
                      Ganho real +{formatPct(item.realNetGainAboveIpcaPct)} acima do IPCA
                    </span>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg border border-slate-800/80 bg-slate-900/70 p-2.5 text-xs sm:grid-cols-4">
                  <div>
                    <span className="block text-[10px] text-slate-400">
                      Taxa Nominal
                    </span>
                    <strong className="font-mono text-slate-200">
                      {item.product.rateDisplay}
                    </strong>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400">
                      Liquidez
                    </span>
                    <strong className="text-slate-200">
                      {item.product.liquidity}
                    </strong>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400">
                      Garantia
                    </span>
                    <strong className="text-slate-200">
                      {item.product.fgcCovered
                        ? "FGC (até R$ 250k)"
                        : item.product.category.includes("Tesouro")
                        ? "Soberana (Tesouro)"
                        : "Patrimônio Fundo"}
                    </strong>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400">
                      Saldo Líquido ({horizonMonths}m)
                    </span>
                    <strong className="font-mono text-emerald-300">
                      {formatBRLFromDecimal(item.estimatedNetValueReais)}
                    </strong>
                  </div>
                </div>

                {item.fgcWarning && (
                  <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-300">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    <span>{item.fgcWarning}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Lista de Produtos Incompatíveis com o Objetivo (Transparência Técnica) */}
        {incompatibleProducts.length > 0 && (
          <div className="mt-6 border-t border-slate-800 pt-5">
            <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-400">
              <XCircle className="h-4 w-4" />
              Produtos Incompatíveis com o Objetivo ou Prazo Selecionado (
              {incompatibleProducts.length})
            </h4>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {incompatibleProducts.map((item) => (
                <div
                  key={item.product.id}
                  className="rounded-xl border border-rose-500/20 bg-rose-950/10 p-3.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-200">
                      {item.product.name} ({item.product.rateDisplay})
                    </span>
                    <span className="font-mono text-xs text-slate-400">
                      Líq. {formatPct(item.netAnnualPct)} a.a.
                    </span>
                  </div>
                  <p className="mt-1.5 flex items-start gap-1.5 text-xs text-rose-300">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" />
                    <span>
                      <strong>Motivo da incompatibilidade:</strong>{" "}
                      {item.incompatibilityReason}
                    </span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Carteira Atual Cadastrada + Matriz de Critérios */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 lg:col-span-7">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Landmark className="h-4 w-4 text-emerald-400" />
              <h4 className="text-sm font-semibold text-white">
                Minha Carteira Consolidada ({investments.length} ativos)
              </h4>
            </div>
            <span className="font-mono text-xs text-emerald-400">
              Total: {formatBRLFromCents(totalPortfolioCents)}
            </span>
          </div>

          <div className="mt-4 space-y-3">
            {investments.map((inv) => {
              const profitCents = inv.currentAmountCents - inv.investedAmountCents;
              const profitPct =
                inv.investedAmountCents > 0
                  ? ((profitCents / inv.investedAmountCents) * 100).toFixed(2)
                  : "0.00";
              return (
                <div
                  key={inv.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800/90 bg-slate-950/60 p-3.5"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white">
                        {inv.name}
                      </span>
                      {inv.fgcCovered && (
                        <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-medium text-sky-300">
                          FGC
                        </span>
                      )}
                      {inv.taxExempt && (
                        <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300">
                          Isento IR
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {inv.institution} • {inv.rateDescription} • Liquidez:{" "}
                      {inv.liquidity}
                    </p>
                  </div>
                  <div className="text-right font-mono">
                    <div className="text-sm font-bold text-white">
                      {formatBRLFromCents(inv.currentAmountCents)}
                    </div>
                    <div className="text-xs text-emerald-400">
                      +{formatBRLFromCents(profitCents)} (+{profitPct}%)
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Matriz Técnica de Análise da Plataforma */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 lg:col-span-5">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Shield className="h-4 w-4 text-indigo-400" />
            <h4 className="text-sm font-semibold text-white">
              Metodologia de Análise por Classe de Ativo
            </h4>
          </div>
          <div className="mt-3 space-y-2.5">
            {REFERENCE_MATRIX.map((row) => (
              <div
                key={row.name}
                className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-2.5 text-xs"
              >
                <div className="flex items-center justify-between">
                  <strong className="text-white">{row.name}</strong>
                  <span className="text-[11px] text-emerald-300">{row.use}</span>
                </div>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  Critérios: {row.analysis}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-[11px] text-slate-300">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <div>
              <strong className="text-amber-300">
                Conformidade Regulatória (CVM / FGC):
              </strong>{" "}
              A comparação objetiva de produtos e educação financeira não
              constitui consultoria individualizada de valores mobiliários.
              Recomendações personalizadas reguladas observam as normas da CVM.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
