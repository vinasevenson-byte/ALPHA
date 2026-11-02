"use client";

import React, { useState } from "react";
import {
  ShieldCheck,
  Sparkles,
  AlertTriangle,
  ArrowUpRight,
  SlidersHorizontal,
  RotateCcw,
  Lock,
  TrendingUp,
} from "lucide-react";
import {
  calculateReserveCapacity,
  formatBRLFromCents,
  formatPct,
  ReserveCapacityResult,
} from "@/lib/financial-engine";

interface Props {
  reserveCapacity: ReserveCapacityResult;
  workspaceType: "PF" | "PJ";
  onQuickAllocate?: (amountCents: number) => void;
  onUpdateSafetyMargin?: (newMarginCents: number) => Promise<void>;
}

export function IntelligenceEngineCard({
  reserveCapacity,
  workspaceType,
  onQuickAllocate,
  onUpdateSafetyMargin,
}: Props) {
  const [simMode, setSimMode] = useState(false);
  const [customAvailableReais, setCustomAvailableReais] = useState(
    reserveCapacity.availableBalanceCents / 100
  );
  const [customBillsReais, setCustomBillsReais] = useState(
    reserveCapacity.predictedBillsCents / 100
  );
  const [customSafetyReais, setCustomSafetyReais] = useState(
    reserveCapacity.safetyMarginCents / 100
  );
  const [savingMargin, setSavingMargin] = useState(false);

  const displayedResult = simMode
    ? calculateReserveCapacity({
        availableBalanceCents: Math.round(customAvailableReais * 100),
        predictedBillsCents: Math.round(customBillsReais * 100),
        predictedIncomesCents: reserveCapacity.predictedIncomesCents,
        safetyMarginCents: Math.round(customSafetyReais * 100),
        essentialMonthlyExpensesCents: Math.round(customBillsReais * 100),
        workspaceType,
      })
    : reserveCapacity;

  const handleOpenSim = () => {
    if (!simMode) {
      setCustomAvailableReais(reserveCapacity.availableBalanceCents / 100);
      setCustomBillsReais(reserveCapacity.predictedBillsCents / 100);
      setCustomSafetyReais(reserveCapacity.safetyMarginCents / 100);
    }
    setSimMode(!simMode);
  };

  const handlePersistMargin = async () => {
    if (!onUpdateSafetyMargin) return;
    setSavingMargin(true);
    try {
      await onUpdateSafetyMargin(Math.round(customSafetyReais * 100));
      setSimMode(false);
    } finally {
      setSavingMargin(false);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-slate-900/95 via-[#0b1324] to-emerald-950/30 p-6 shadow-2xl">
      {/* Glow decorativo */}
      <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />

      <div className="relative z-10 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-300 ring-1 ring-emerald-500/30">
                Motor de Inteligência Financeira
              </span>
              <span className="text-xs text-slate-400">
                {simMode ? "• Modo Simulação Interativa" : "• Cálculo em Tempo Real do Ledger"}
              </span>
            </div>
            <h2 className="mt-1 text-lg font-semibold text-white">
              Análise Automática de Capacidade Segura de Reserva e Investimento
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenSim}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-medium transition ${
              simMode
                ? "bg-amber-500/20 text-amber-200 ring-1 ring-amber-500/40"
                : "bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white ring-1 ring-slate-700"
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {simMode ? "Voltar aos Dados Reais" : "Testar Cenário / Ajustar Margem"}
          </button>
        </div>
      </div>

      {/* Painel de Ajuste se simMode estiver ativo */}
      {simMode && (
        <div className="mt-4 grid grid-cols-1 gap-4 rounded-xl border border-amber-500/25 bg-slate-950/70 p-4 md:grid-cols-4">
          <div>
            <label className="block text-xs font-medium text-slate-400">
              Saldo Disponível Simulado (R$)
            </label>
            <input
              type="number"
              value={customAvailableReais}
              onChange={(e) => setCustomAvailableReais(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400">
              Contas Previstas (R$)
            </label>
            <input
              type="number"
              value={customBillsReais}
              onChange={(e) => setCustomBillsReais(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400">
              Margem de Segurança ({workspaceType === "PJ" ? "Giro" : "Colchão"}) (R$)
            </label>
            <input
              type="number"
              value={customSafetyReais}
              onChange={(e) => setCustomSafetyReais(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div className="flex items-end gap-2">
            <button
              onClick={() => {
                setCustomAvailableReais(8000);
                setCustomBillsReais(3500);
                setCustomSafetyReais(1500);
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-200 hover:bg-slate-700"
              title="Carregar valores ilustrativos R$ 8.000 / R$ 3.500 / R$ 1.500"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Exemplo R$ 8k
            </button>
            {onUpdateSafetyMargin && (
              <button
                onClick={handlePersistMargin}
                disabled={savingMargin}
                className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                {savingMargin ? "Salvando..." : "Salvar Margem"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* 4 Blocos Principais do Motor */}
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-800/90 bg-slate-900/75 p-4">
          <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
            Saldo disponível
          </span>
          <div className="mt-2 font-mono text-2xl font-bold text-white">
            {formatBRLFromCents(displayedResult.availableBalanceCents)}
          </div>
          <p className="mt-1 text-xs text-slate-400">
            {workspaceType === "PJ"
              ? "Caixa imediato conciliado nos bancos"
              : "Recursos líquidos em conta corrente/digital"}
          </p>
        </div>

        <div className="rounded-xl border border-slate-800/90 bg-slate-900/75 p-4">
          <span className="text-xs font-medium uppercase tracking-wider text-amber-400/90">
            Contas previstas
          </span>
          <div className="mt-2 font-mono text-2xl font-bold text-amber-300">
            {formatBRLFromCents(displayedResult.predictedBillsCents)}
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Compromissos pendentes no ciclo ({formatPct(displayedResult.commitmentsPct)})
          </p>
        </div>

        <div className="rounded-xl border border-slate-800/90 bg-slate-900/75 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-sky-400/90">
              Margem de segurança
            </span>
            <Lock className="h-3.5 w-3.5 text-sky-400" />
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-sky-300">
            {formatBRLFromCents(displayedResult.safetyMarginCents)}
          </div>
          <p className="mt-1 text-xs text-slate-400">
            {workspaceType === "PJ" ? "Capital de giro mínimo protegido" : "Colchão de liquidez intocável"}{" "}
            ({formatPct(displayedResult.safetyPct)})
          </p>
        </div>

        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 ring-1 ring-emerald-500/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
              Potencial para reservar
            </span>
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2 font-mono text-2xl font-extrabold text-emerald-300">
            {formatBRLFromCents(displayedResult.reservePotentialCents)}
          </div>
          <p className="mt-1 text-xs text-emerald-200/80">
            Livre para alocar com segurança ({formatPct(displayedResult.reservePct)})
          </p>
        </div>
      </div>

      {/* Barra de Distribuição do Saldo Analisado */}
      <div className="mt-5 rounded-xl border border-slate-800/80 bg-slate-950/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-semibold uppercase tracking-wider text-slate-300">
            Distribuição do saldo analisado
          </span>
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
              Compromissos{" "}
              <strong className="font-mono text-white">
                {formatPct(displayedResult.commitmentsPct)}
              </strong>
            </span>
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="h-2.5 w-2.5 rounded-full bg-sky-400" />
              Segurança{" "}
              <strong className="font-mono text-white">
                {formatPct(displayedResult.safetyPct)}
              </strong>
            </span>
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              Reserva{" "}
              <strong className="font-mono text-emerald-300">
                {formatPct(displayedResult.reservePct)}
              </strong>
            </span>
          </div>
        </div>

        <div className="mt-3 flex h-3.5 w-full overflow-hidden rounded-full bg-slate-800 p-0.5">
          <div
            style={{ width: `${Math.min(100, displayedResult.commitmentsPct)}%` }}
            className="h-full rounded-l-full bg-amber-400 transition-all duration-500"
            title={`Compromissos: ${formatPct(displayedResult.commitmentsPct)}`}
          />
          <div
            style={{ width: `${Math.min(100, displayedResult.safetyPct)}%` }}
            className="h-full bg-sky-400 transition-all duration-500"
            title={`Segurança: ${formatPct(displayedResult.safetyPct)}`}
          />
          <div
            style={{ width: `${Math.min(100, displayedResult.reservePct)}%` }}
            className="h-full rounded-r-full bg-emerald-400 transition-all duration-500"
            title={`Reserva: ${formatPct(displayedResult.reservePct)}`}
          />
        </div>

        {/* Diagnóstico e Ação */}
        <div className="mt-4 flex flex-col justify-between gap-4 border-t border-slate-800/80 pt-4 lg:flex-row lg:items-center">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
              {displayedResult.status === "HEALTHY" ? (
                <TrendingUp className="h-4 w-4" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-amber-400" />
              )}
              <span>Análise financeira</span>
            </div>
            <p className="text-sm font-medium text-white">
              {displayedResult.headline}
            </p>
            <p className="text-xs text-slate-400">
              {displayedResult.recommendationText}
            </p>
          </div>

          {displayedResult.reservePotentialCents > 0 && onQuickAllocate && !simMode && (
            <button
              onClick={() => onQuickAllocate(displayedResult.reservePotentialCents)}
              className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-semibold text-slate-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400"
            >
              <span>Alocar Potencial na Reserva</span>
              <ArrowUpRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
