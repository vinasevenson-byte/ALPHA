'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function Cadastro() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email: email.trim(), password }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message || 'Cadastro não concluído');
      router.replace(`/app/${j.workspaceId}/visao-geral`);
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
        className="w-full max-w-md rounded-3xl bg-white p-6 sm:p-8 shadow-xl border border-slate-200/70 space-y-4 text-[#1E1B39]"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#6C5CE7] to-[#4834D4] font-black text-white">
            N
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-[#1E1B39]">
              Criar conta NOVA
            </h1>
            <p className="text-xs text-slate-500">
              Ambiente pessoal criado com saldo inicial zerado.
            </p>
          </div>
        </div>

        <label className="block text-sm font-semibold">
          Nome completo
          <input
            required
            minLength={2}
            maxLength={120}
            className="mt-1.5 block w-full min-h-[48px] rounded-xl border border-slate-200 bg-[#F5F6FA] px-3.5 py-3 text-base focus:border-[#6C5CE7] focus:bg-white focus:outline-none"
            autoComplete="name"
            placeholder="Seu nome"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <label className="block text-sm font-semibold">
          E-mail
          <input
            required
            type="email"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="mt-1.5 block w-full min-h-[48px] rounded-xl border border-slate-200 bg-[#F5F6FA] px-3.5 py-3 text-base focus:border-[#6C5CE7] focus:bg-white focus:outline-none"
            autoComplete="email"
            placeholder="voce@exemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        <label className="block text-sm font-semibold">
          Senha (mínimo 12 caracteres)
          <input
            required
            minLength={12}
            maxLength={128}
            type="password"
            autoCapitalize="none"
            autoCorrect="off"
            className="mt-1.5 block w-full min-h-[48px] rounded-xl border border-slate-200 bg-[#F5F6FA] px-3.5 py-3 text-base focus:border-[#6C5CE7] focus:bg-white focus:outline-none"
            autoComplete="new-password"
            placeholder="Mínimo 12 caracteres"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
          {busy ? 'Cadastrando…' : 'Criar conta'}
        </button>

        <div className="pt-1 text-center">
          <Link
            href="/entrar"
            className="inline-block py-1.5 text-sm font-semibold text-[#6C5CE7] hover:underline"
          >
            Já possuo conta — Entrar
          </Link>
        </div>
      </form>
    </main>
  );
}
