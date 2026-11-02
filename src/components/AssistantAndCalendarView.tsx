"use client";

import React, { useState } from "react";
import {
  Bot,
  Calendar,
  Send,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
} from "lucide-react";
import {
  formatBRLFromCents,
  ReserveCapacityResult,
} from "@/lib/financial-engine";

interface CalendarDay {
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
}

interface TransactionItem {
  id: string;
  type: string;
  status: string;
  amountCents: number;
  description: string;
  category: string;
  costCenter: string;
  essentiality: string;
}

interface Props {
  workspaceType: "PF" | "PJ";
  workspaceName: string;
  reserveCapacity: ReserveCapacityResult;
  predictiveCalendar: CalendarDay[];
  transactions: TransactionItem[];
  totalInvestmentsCents: number;
}

export function AssistantAndCalendarView({
  workspaceType,
  workspaceName,
  reserveCapacity,
  predictiveCalendar,
  transactions,
  totalInvestmentsCents,
}: Props) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<
    Array<{ role: "user" | "assistant"; text: string }>
  >([
    {
      role: "assistant",
      text:
        workspaceType === "PJ"
          ? `Olá! Sou o Assistente Financeiro Inteligente da ${workspaceName}. Analisei seu livro razão corporativo: você possui ${formatBRLFromCents(
              reserveCapacity.availableBalanceCents
            )} em caixa disponível, ${formatBRLFromCents(
              reserveCapacity.predictedBillsCents
            )} em contas a pagar previstas e um potencial líquido de ${formatBRLFromCents(
              reserveCapacity.reservePotentialCents
            )} para remunerar em liquidez diária sem afetar seu capital de giro.`
          : `Olá! Sou seu Assistente Financeiro Inteligente. Analisei suas contas em ${workspaceName}: você tem ${formatBRLFromCents(
              reserveCapacity.availableBalanceCents
            )} disponíveis, ${formatBRLFromCents(
              reserveCapacity.predictedBillsCents
            )} em contas previstas e ${formatBRLFromCents(
              reserveCapacity.reservePotentialCents
            )} livres para reservar ou investir mantendo sua margem de segurança de ${formatBRLFromCents(
              reserveCapacity.safetyMarginCents
            )}.`,
    },
  ]);

  const generateSmartAnswer = (q: string): string => {
    const lower = q.toLowerCase();

    // Agrupamento de despesas por categoria
    const expenses = transactions.filter((t) => t.type === "EXPENSE");
    const byCat: Record<string, number> = {};
    for (const e of expenses) {
      byCat[e.category] = (byCat[e.category] || 0) + e.amountCents;
    }
    const sortedCats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
    const topCat = sortedCats[0];

    if (lower.includes("quanto posso gastar") || lower.includes("limite") || lower.includes("disponível")) {
      const safeToSpend = Math.max(
        0,
        reserveCapacity.availableBalanceCents -
          reserveCapacity.predictedBillsCents -
          reserveCapacity.safetyMarginCents
      );
      const flexibleSpend = Math.round(safeToSpend * 0.35);
      return `Com base no seu saldo atual de ${formatBRLFromCents(
        reserveCapacity.availableBalanceCents
      )}, descontando ${formatBRLFromCents(
        reserveCapacity.predictedBillsCents
      )} de contas previstas e preservando sua margem de segurança de ${formatBRLFromCents(
        reserveCapacity.safetyMarginCents
      )}, seu excedente livre é de ${formatBRLFromCents(
        safeToSpend
      )}. Se você destinar 65% desse excedente para suas Reservas (${formatBRLFromCents(
        safeToSpend - flexibleSpend
      )}), você ainda pode gastar até ${formatBRLFromCents(
        flexibleSpend
      )} neste mês sem comprometer nenhuma meta!`;
    }

    if (lower.includes("despesa") || lower.includes("aumentaram") || lower.includes("gastos") || lower.includes("custo")) {
      const totalExp = expenses.reduce((s, e) => s + e.amountCents, 0);
      const lifestyleExp = expenses
        .filter((e) => e.essentiality === "LIFESTYLE")
        .reduce((s, e) => s + e.amountCents, 0);
      return `Suas despesas totais (pagas + previstas no ciclo) somam ${formatBRLFromCents(
        totalExp
      )}. A maior concentração está em "${
        topCat ? topCat[0] : "Geral"
      }" com ${formatBRLFromCents(
        topCat ? topCat[1] : 0
      )}. Além disso, identificamos ${formatBRLFromCents(
        lifestyleExp
      )} em gastos variáveis/não essenciais que podem ser otimizados para acelerar suas reservas.`;
    }

    if (lower.includes("50 mil") || lower.includes("acumular") || lower.includes("meta") || lower.includes("100 mil")) {
      const targetCents = lower.includes("100 mil") ? 10000000 : 5000000;
      const currentPatrimony =
        totalInvestmentsCents + reserveCapacity.reservePotentialCents;
      const remainingCents = Math.max(0, targetCents - currentPatrimony);
      const monthlyCap = Math.max(100000, reserveCapacity.reservePotentialCents);
      const monthsNeeded = Math.ceil(remainingCents / monthlyCap);

      if (remainingCents === 0) {
        return `Excelente notícia! Somando sua carteira atual (${formatBRLFromCents(
          totalInvestmentsCents
        )}) com seu potencial imediato de reserva (${formatBRLFromCents(
          reserveCapacity.reservePotentialCents
        )}), você já alcançou ${formatBRLFromCents(currentPatrimony)}, superando esse marco!`;
      }
      return `Considerando seu patrimônio investido atual de ${formatBRLFromCents(
        totalInvestmentsCents
      )} e mantendo aportes mensais de ${formatBRLFromCents(
        monthlyCap
      )} (seu potencial seguro calculado) rentabilizados a ~11,25% a.a., você atingirá ${formatBRLFromCents(
        targetCents
      )} em aproximadamente ${monthsNeeded} meses (cerca de ${(
        monthsNeeded / 12
      ).toFixed(1)} anos).`;
    }

    if (lower.includes("risco") || lower.includes("calendário") || lower.includes("faltar") || lower.includes("giro")) {
      const riskyDays = predictiveCalendar.filter((d) => d.riskState !== "SAFE");
      if (riskyDays.length === 0) {
        return `Analisei os próximos 21 dias no Calendário Financeiro Preditivo: não há nenhum dia com risco de saldo negativo ou violação da sua margem de segurança de ${formatBRLFromCents(
          reserveCapacity.safetyMarginCents
        )}. O menor saldo projetado no período é de ${formatBRLFromCents(
          Math.min(...predictiveCalendar.map((d) => d.projectedBalanceCents))
        )}.`;
      }
      return `Atenção: identificamos ${riskyDays.length} dia(s) nos próximos 21 dias em que o saldo projetado fica abaixo da margem de segurança (primeiro alerta em ${riskyDays[0].dayLabel}). Recomendamos programar os pagamentos ou antecipar recebíveis.`;
    }

    return `Analisei os lançamentos de ${workspaceName}: seu saldo líquido é de ${formatBRLFromCents(
      reserveCapacity.availableBalanceCents
    )}, com ${formatBRLFromCents(
      reserveCapacity.predictedBillsCents
    )} a pagar e ${formatBRLFromCents(
      reserveCapacity.predictedIncomesCents
    )} a receber. Seu potencial seguro de alocação hoje é de ${formatBRLFromCents(
      reserveCapacity.reservePotentialCents
    )} (${reserveCapacity.reservePct}% do saldo disponível).`;
  };

  const handleAsk = (qText: string) => {
    if (!qText.trim()) return;
    const answer = generateSmartAnswer(qText);
    setMessages((prev) => [
      ...prev,
      { role: "user", text: qText },
      { role: "assistant", text: answer },
    ]);
    setQuestion("");
  };

  const quickPrompts =
    workspaceType === "PJ"
      ? [
          "Quanto posso aplicar sem afetar o capital de giro?",
          "Onde estão concentrados os maiores custos da empresa?",
          "Há risco de fluxo de caixa nos próximos 21 dias?",
          "Quando conseguirei acumular R$ 100 mil em reservas?",
        ]
      : [
          "Quanto posso gastar neste mês com segurança?",
          "Por que minhas despesas estão nesse patamar?",
          "Quando conseguirei acumular R$ 50 mil?",
          "Há risco de ficar sem dinheiro antes do próximo recebimento?",
        ];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Assistente Financeiro Inteligente */}
      <div className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/85 p-5 shadow-xl lg:col-span-6">
        <div>
          <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">
                Assistente Financeiro Inteligente
              </h3>
              <p className="text-xs text-slate-400">
                Respostas baseadas diretamente nos seus lançamentos e projeções
                autorizadas
              </p>
            </div>
          </div>

          {/* Sugestões de Perguntas Rápidas */}
          <div className="mt-4 flex flex-wrap gap-2">
            {quickPrompts.map((p) => (
              <button
                key={p}
                onClick={() => handleAsk(p)}
                className=" inline-flex items-center gap-1.5 rounded-full border border-slate-700/80 bg-slate-950/80 px-3 py-1.5 text-xs text-slate-300 transition hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-200"
              >
                <Sparkles className="h-3 w-3 text-emerald-400" />
                {p}
              </button>
            ))}
          </div>

          {/* Histórico de Conversa */}
          <div className="mt-4 max-h-80 space-y-3 overflow-y-auto pr-1">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`rounded-xl p-3.5 text-xs leading-relaxed ${
                  m.role === "user"
                    ? "ml-8 bg-emerald-500/15 text-emerald-100 ring-1 ring-emerald-500/30"
                    : "mr-4 border border-slate-800 bg-slate-950/90 text-slate-200"
                }`}
              >
                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  {m.role === "user" ? "Você perguntou" : "Motor Inteligente ALPHA"}
                </span>
                {m.text}
              </div>
            ))}
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAsk(question);
          }}
          className="mt-4 flex gap-2 border-t border-slate-800 pt-4"
        >
          <input
            type="text"
            placeholder="Pergunte sobre seus gastos, reservas ou metas..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
          />
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
          >
            <Send className="h-3.5 w-3.5" />
            Perguntar
          </button>
        </form>
      </div>

      {/* Calendário Financeiro Preditivo */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/85 p-5 shadow-xl lg:col-span-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400 ring-1 ring-sky-500/30">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">
                Calendário Financeiro Preditivo (Próximos 21 dias)
              </h3>
              <p className="text-xs text-slate-400">
                Projeção diária de saldo e detecção antecipada de risco de caixa
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 max-h-[420px] space-y-2.5 overflow-y-auto pr-1">
          {predictiveCalendar.map((day, idx) => {
            const hasMovement = day.inflowCents > 0 || day.outflowCents > 0;
            if (!hasMovement && idx !== 0 && idx % 4 !== 0) return null;

            return (
              <div
                key={day.dateIso}
                className={`rounded-xl border p-3 transition ${
                  day.riskState === "NEGATIVE"
                    ? "border-rose-500/40 bg-rose-950/20"
                    : day.riskState === "BELOW_SAFETY"
                    ? "border-amber-500/40 bg-amber-950/20"
                    : hasMovement
                    ? "border-slate-700/80 bg-slate-950/80"
                    : "border-slate-800/50 bg-slate-950/40"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="rounded-lg bg-slate-800 px-2.5 py-1 font-mono text-xs font-semibold text-slate-200">
                      {idx === 0 ? `Hoje (${day.dayLabel})` : day.dayLabel}
                    </span>
                    {day.inflowCents > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400">
                        <ArrowUpRight className="h-3.5 w-3.5" />+
                        {formatBRLFromCents(day.inflowCents)}
                      </span>
                    )}
                    {day.outflowCents > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-300">
                        <ArrowDownRight className="h-3.5 w-3.5" />-
                        {formatBRLFromCents(day.outflowCents)}
                      </span>
                    )}
                    {!hasMovement && (
                      <span className="text-xs text-slate-500">
                        Sem vencimentos previstos
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400">
                      Saldo Previsto:
                    </span>
                    <span className="font-mono text-xs font-bold text-white">
                      {formatBRLFromCents(day.projectedBalanceCents)}
                    </span>
                    {day.riskState === "SAFE" ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-amber-400" />
                    )}
                  </div>
                </div>

                {day.events.length > 0 && (
                  <div className="mt-2 space-y-1 border-t border-slate-800/80 pt-2">
                    {day.events.map((ev) => (
                      <div
                        key={ev.id}
                        className="flex items-center justify-between text-[11px] text-slate-300"
                      >
                        <span>• {ev.description}</span>
                        <span
                          className={`font-mono ${
                            ev.type === "INCOME"
                              ? "text-emerald-300"
                              : "text-amber-300"
                          }`}
                        >
                          {ev.type === "INCOME" ? "+" : "-"}
                          {formatBRLFromCents(ev.amountCents)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
