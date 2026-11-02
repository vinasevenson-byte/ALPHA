"use client";

import React, { useMemo, useState } from "react";
import { Calculator, RotateCcw, Sparkles, Info } from "lucide-react";
import {
  formatBRLFromDecimal,
  formatPct,
  simulateSmartReserve,
} from "@/lib/financial-engine";

interface Props {
  reservePotentialCents?: number;
  compact?: boolean;
}

export function ReserveSimulatorCard({
  reservePotentialCents = 300000,
  compact = false,
}: Props) {
  // Valores padrão calibrados exatamente para o exemplo da especificação:
  // Inicial R$ 1.000 + Mensal R$ 300 por 5 anos a 9% a.a. =>
  // Total de aportes: R$ 19.000,00 | Patrimônio acumulado: R$ 23.958,48 | Rendimento bruto: R$ 4.958,48
  const [initialAmountReais, setInitialAmountReais] = useState<number>(1000);
  const [monthlyDepositReais, setMonthlyDepositReais] = useState<number>(300);
  const [years, setYears] = useState<number>(5);
  const [annualRatePct, setAnnualRatePct] = useState<number>(9);

  const result = useMemo(
    () =>
      simulateSmartReserve({
        initialAmountReais,
        monthlyDepositReais,
        years,
        annualRatePct,
      }),
    [initialAmountReais, monthlyDepositReais, years, annualRatePct]
  );

  const maxEvolutionVal = Math.max(
    1,
    ...result.yearlyEvolution.map((y) => y.accumulatedBalanceReais)
  );

  return (
    <div className="rounded-2xl border border-slate-800/90 bg-slate-900/75 p-6 shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-400 ring-1 ring-indigo-500/30">
            <Calculator className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">
              Simulador de Reserva Inteligente
            </h3>
            <p className="text-xs text-slate-400">
              Faça uma simulação de quanto uma reserva poderia acumular ao longo do
              tempo. Taxa hipotética, não representa uma oferta de investimento.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setInitialAmountReais(1000);
              setMonthlyDepositReais(300);
              setYears(5);
              setAnnualRatePct(9);
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/90 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-700 hover:text-white"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Padrão (9% a.a. / 5 anos)
          </button>
          <button
            onClick={() => {
              setInitialAmountReais(Math.round(reservePotentialCents / 100));
              setMonthlyDepositReais(
                Math.max(200, Math.round(reservePotentialCents / 100 / 3))
              );
              setAnnualRatePct(11.25);
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Usar Meu Potencial + Selic (11,25%)
          </button>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Coluna de Inputs */}
        <div className="space-y-4 lg:col-span-5">
          <div>
            <div className="flex justify-between text-xs">
              <label className="font-medium text-slate-300">
                Valor inicial (R$)
              </label>
              <span className="font-mono text-slate-400">
                {formatBRLFromDecimal(initialAmountReais)}
              </span>
            </div>
            <input
              type="number"
              min={0}
              step={100}
              value={initialAmountReais}
              onChange={(e) => setInitialAmountReais(Number(e.target.value))}
              className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 font-mono text-sm text-white focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs">
              <label className="font-medium text-slate-300">
                Depósito mensal (R$)
              </label>
              <span className="font-mono text-slate-400">
                {formatBRLFromDecimal(monthlyDepositReais)}/mês
              </span>
            </div>
            <input
              type="number"
              min={0}
              step={50}
              value={monthlyDepositReais}
              onChange={(e) => setMonthlyDepositReais(Number(e.target.value))}
              className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 font-mono text-sm text-white focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex justify-between text-xs">
                <label className="font-medium text-slate-300">Prazo</label>
                <span className="font-mono text-indigo-300">
                  {years} {years === 1 ? "ano" : "anos"}
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={30}
                value={years}
                onChange={(e) => setYears(Number(e.target.value))}
                className="mt-2.5 w-full accent-indigo-500"
              />
              <div className="mt-1 flex justify-between text-[11px] text-slate-500">
                <span>1 ano</span>
                <span>{years * 12} meses</span>
                <span>30 anos</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs">
                <label className="font-medium text-slate-300">
                  Rentabilidade anual
                </label>
                <span className="font-mono text-emerald-300">
                  {formatPct(annualRatePct, 2)} a.a.
                </span>
              </div>
              <input
                type="number"
                min={0.5}
                max={30}
                step={0.25}
                value={annualRatePct}
                onChange={(e) => setAnnualRatePct(Number(e.target.value))}
                className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-1.5 font-mono text-sm text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Coluna de Resultado em Destaque */}
        <div className="flex flex-col justify-between rounded-2xl border border-indigo-500/25 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/30 p-5 lg:col-span-7">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-300">
              Patrimônio acumulado estimado
            </span>
            <div className="mt-1 font-mono text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              {formatBRLFromDecimal(result.accumulatedBalanceReais)}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-3">
                <span className="text-[11px] uppercase tracking-wider text-slate-400">
                  Total de aportes
                </span>
                <div className="mt-1 font-mono text-base font-bold text-slate-100">
                  {formatBRLFromDecimal(result.totalContributedReais)}
                </div>
              </div>

              <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3">
                <span className="text-[11px] uppercase tracking-wider text-emerald-300">
                  Rendimento bruto estimado
                </span>
                <div className="mt-1 font-mono text-base font-bold text-emerald-300">
                  {formatBRLFromDecimal(result.grossEarningsReais)}
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-3">
                <span className="text-[11px] uppercase tracking-wider text-slate-400">
                  Líquido est. pós-IR
                </span>
                <div className="mt-1 font-mono text-base font-bold text-sky-300">
                  {formatBRLFromDecimal(result.netEstimatedBalanceReais)}
                </div>
              </div>
            </div>

            {/* Evolução Anual Visual */}
            {!compact && result.yearlyEvolution.length > 0 && (
              <div className="mt-5">
                <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
                  <span>Curva de acumulação (Aportes vs Juros Compostos)</span>
                  <span className="font-mono text-[11px]">
                    Taxa eq. mensal: {formatPct(result.monthlyEquivalentRatePct, 4)}
                  </span>
                </div>
                <div className="grid grid-cols-5 gap-2 sm:grid-cols-6">
                  {result.yearlyEvolution.slice(-6).map((pt) => {
                    const heightPct = Math.max(
                      12,
                      Math.round((pt.accumulatedBalanceReais / maxEvolutionVal) * 100)
                    );
                    const contribRatio =
                      pt.accumulatedBalanceReais > 0
                        ? Math.round(
                            (pt.totalContributedReais /
                              pt.accumulatedBalanceReais) *
                              100
                          )
                        : 100;
                    return (
                      <div
                        key={pt.year}
                        className="flex flex-col items-center rounded-lg border border-slate-800/80 bg-slate-950/60 p-2"
                      >
                        <div className="flex h-20 w-full items-end justify-center">
                          <div
                            style={{ height: `${heightPct}%` }}
                            className="flex w-6 flex-col justify-end overflow-hidden rounded-t bg-emerald-500/80"
                            title={`Ano ${pt.year}: ${formatBRLFromDecimal(
                              pt.accumulatedBalanceReais
                            )}`}
                          >
                            <div
                              style={{ height: `${contribRatio}%` }}
                              className="w-full bg-indigo-500/80"
                            />
                          </div>
                        </div>
                        <span className="mt-1.5 text-[11px] font-semibold text-slate-300">
                          Ano {pt.year}
                        </span>
                        <span className="font-mono text-[10px] text-emerald-300">
                          {formatBRLFromDecimal(pt.accumulatedBalanceReais)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 flex items-start gap-2 border-t border-slate-800/80 pt-3 text-[11px] text-slate-400">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
            <span>
              Juros compostos com aportes ao fim de cada mês, taxa constante e sem
              desconto de impostos, tarifas ou inflação no valor bruto principal. Não
              há garantia desse retorno.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
