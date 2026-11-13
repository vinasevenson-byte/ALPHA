'use client';
import React, { useState } from 'react';
import Link from 'next/link';

export default function Redefinir() {
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const token = new URLSearchParams(window.location.search).get('token');
    if (!token) {
      setMessage('Link inválido.');
      return;
    }
    setBusy(true);
    try {
      const r = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      setMessage(
        r.ok
          ? 'Senha alterada. Entre novamente.'
          : 'Não foi possível redefinir a senha. Solicite um novo link.'
      );
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
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#1E1B39]">
            Definir nova senha
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500">
            Crie uma senha forte com pelo menos 12 caracteres.
          </p>
        </div>

        <label className="block text-sm font-semibold">
          Nova senha
          <input
            required
            type="password"
            minLength={12}
            maxLength={128}
            autoCapitalize="none"
            autoCorrect="off"
            placeholder="Mínimo 12 caracteres"
            className="mt-1.5 block w-full min-h-[48px] rounded-xl border border-slate-200 bg-[#F5F6FA] px-3.5 py-3 text-base focus:border-[#6C5CE7] focus:bg-white focus:outline-none"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        <button
          disabled={busy}
          className="w-full min-h-[48px] rounded-xl bg-[#6C5CE7] px-4 py-3 text-base font-bold text-white shadow-sm transition hover:bg-[#5849BE] active:scale-[0.99] disabled:opacity-50"
        >
          {busy ? 'Atualizando…' : 'Atualizar senha'}
        </button>

        {message && (
          <p
            role="status"
            className="rounded-xl border border-violet-200 bg-[#EFEFFD] px-3.5 py-2.5 text-sm font-medium text-[#1E1B39]"
          >
            {message}
          </p>
        )}

        <div className="pt-1 text-center">
          <Link
            href="/entrar"
            className="inline-block py-1.5 text-sm font-semibold text-[#6C5CE7] hover:underline"
          >
            ← Voltar ao login
          </Link>
        </div>
      </form>
    </main>
  );
}
