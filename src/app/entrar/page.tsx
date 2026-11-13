'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function Entrar() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message || 'Falha ao entrar');
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
        className="w-full max-w-md rounded-3xl bg-white p-6 sm:p-8 shadow-xl border border-slate-200/70 space-y-5 text-[#1E1B39]"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#6C5CE7] to-[#4834D4] text-lg font-black text-white shadow-sm">
            N
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold tracking-tight text-[#1E1B39]">
                NOVA
              </h1>
              <span className="rounded-full bg-[#EFEFFD] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#6C5CE7]">
                Mobile &amp; Tablet
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500">
              Entre na sua conta financeira (PF &amp; PJ)
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <label className="block text-sm font-semibold text-[#1E1B39]">
            Login ou E-mail
            <input
              className="mt-1.5 block w-full min-h-[48px] rounded-xl border border-slate-200 bg-[#F5F6FA] px-3.5 py-3 text-base text-[#1E1B39] transition focus:border-[#6C5CE7] focus:bg-white focus:outline-none"
              type="text"
              inputMode="email"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="admin ou seu e-mail"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>

          <label className="block text-sm font-semibold text-[#1E1B39]">
            Senha
            <input
              className="mt-1.5 block w-full min-h-[48px] rounded-xl border border-slate-200 bg-[#F5F6FA] px-3.5 py-3 text-base text-[#1E1B39] transition focus:border-[#6C5CE7] focus:bg-white focus:outline-none"
              type="password"
              autoComplete="current-password"
              autoCapitalize="none"
              autoCorrect="off"
              placeholder="Sua senha"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
        </div>

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
          {busy ? 'Verificando…' : 'Entrar'}
        </button>

        <div className="flex items-center justify-between pt-1 text-sm font-semibold text-[#6C5CE7]">
          <Link href="/cadastro" className="py-1.5 hover:underline">
            Criar conta
          </Link>
          <Link href="/recuperar-senha" className="py-1.5 hover:underline">
            Esqueci a senha
          </Link>
        </div>
      </form>
    </main>
  );
}
