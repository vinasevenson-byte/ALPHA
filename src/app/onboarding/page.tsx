'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function Onboarding() {
  const router = useRouter();
  const [type, setType] = useState<'PERSONAL' | 'BUSINESS'>('PERSONAL');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await fetch('/api/auth/create-workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, name }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message || 'Não foi possível criar ambiente');
      router.push(`/app/${j.workspace.id}/visao-geral`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-[100dvh] bg-[#F5F6FA] flex flex-col items-center justify-center px-4 py-6 sm:p-8 pt-safe pb-safe">
      <form
        onSubmit={submit}
        className="w-full max-w-lg rounded-3xl bg-white p-6 sm:p-8 shadow-xl border border-slate-200/70 space-y-5 text-[#1E1B39]"
      >
        <div>
          <span className="rounded-full bg-[#EFEFFD] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-[#6C5CE7]">
            Novo Ambiente Financeiro
          </span>
          <h1 className="mt-2 text-2xl font-extrabold text-[#1E1B39]">
            Novo ambiente NOVA
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Ambientes pessoais (PF) e empresariais (PJ) são independentes e começam com saldo zerado.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            { id: 'PERSONAL' as const, title: 'Pessoal (PF)', desc: 'Contas, metas e carteira' },
            { id: 'BUSINESS' as const, title: 'Empresarial (PJ)', desc: 'Caixa, giro e DRE' },
          ].map((opt) => {
            const active = type === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setType(opt.id)}
                className={`rounded-2xl border p-3.5 text-left transition ${
                  active
                    ? 'border-[#6C5CE7] bg-[#EFEFFD]/70 ring-2 ring-[#6C5CE7]/20'
                    : 'border-slate-200 bg-[#F5F6FA] hover:bg-white'
                }`}
              >
                <div className="text-sm font-extrabold text-[#1E1B39]">{opt.title}</div>
                <div className="mt-0.5 text-xs text-slate-500">{opt.desc}</div>
              </button>
            );
          })}
        </div>

        <label className="block text-sm font-semibold">
          Nome do ambiente
          <input
            className="mt-1.5 block w-full min-h-[48px] rounded-xl border border-slate-200 bg-[#F5F6FA] px-3.5 py-3 text-base focus:border-[#6C5CE7] focus:bg-white focus:outline-none"
            required
            minLength={2}
            maxLength={100}
            placeholder={type === 'BUSINESS' ? 'Ex: Minha Empresa Ltda' : 'Ex: Finanças da Família'}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        {error && (
          <p
            role="alert"
            className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm font-medium text-rose-700"
          >
            {error}
          </p>
        )}

        <button
          disabled={busy}
          className="w-full min-h-[48px] rounded-xl bg-[#6C5CE7] px-4 py-3 text-base font-bold text-white shadow-sm transition hover:bg-[#5849BE] active:scale-[0.99] disabled:opacity-50"
        >
          {busy ? 'Criando…' : 'Criar ambiente'}
        </button>

        <div className="text-center">
          <Link
            href="/"
            className="inline-block py-1.5 text-sm font-semibold text-slate-500 hover:text-[#6C5CE7]"
          >
            ← Voltar ao painel
          </Link>
        </div>
      </form>
    </main>
  );
}
