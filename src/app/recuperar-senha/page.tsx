'use client';
import React, { useState } from 'react';
import Link from 'next/link';

export default function Recuperar() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await fetch('/api/auth/request-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      setMessage('Se o e-mail estiver cadastrado, você receberá instruções.');
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
            Recuperar acesso à NOVA
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500">
            Informe o e-mail cadastrado para receber o link de redefinição.
          </p>
        </div>

        <label className="block text-sm font-semibold">
          E-mail
          <input
            required
            type="email"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="voce@exemplo.com"
            className="mt-1.5 block w-full min-h-[48px] rounded-xl border border-slate-200 bg-[#F5F6FA] px-3.5 py-3 text-base focus:border-[#6C5CE7] focus:bg-white focus:outline-none"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        {message && (
          <p
            role="status"
            className="rounded-xl border border-violet-200 bg-[#EFEFFD] px-3.5 py-2.5 text-sm font-medium text-[#1E1B39]"
          >
            {message}
          </p>
        )}

        <button
          disabled={busy}
          className="w-full min-h-[48px] rounded-xl bg-[#6C5CE7] px-4 py-3 text-base font-bold text-white shadow-sm transition hover:bg-[#5849BE] active:scale-[0.99] disabled:opacity-50"
        >
          {busy ? 'Enviando…' : 'Enviar instruções'}
        </button>

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
