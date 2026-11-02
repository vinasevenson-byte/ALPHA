"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("titular@nova.fin.br");
  const [password, setPassword] = useState("••••••••••••");

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F5F6FA] p-4 text-[#1E1B39]">
      <div className="w-full max-w-md rounded-2xl border border-slate-200/80 bg-white p-8 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#6C5CE7] to-[#5849BE] font-black text-white shadow-sm">
            N
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-[#1E1B39]">NOVA</h1>
            <p className="text-xs text-slate-500">
              Seu dinheiro organizado. Seu futuro planejado.
            </p>
          </div>
        </div>

        <h2 className="mt-6 text-base font-bold text-[#1E1B39]">
          Entrar na sua conta
        </h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            router.push("/app/ws-nova-pf/visao-geral");
          }}
          className="mt-4 space-y-4 text-xs"
        >
          <div>
            <label className="font-bold text-slate-700">E-mail</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-[#F5F6FA] px-3.5 py-2.5 focus:border-[#6C5CE7] focus:bg-white focus:outline-none"
            />
          </div>
          <div>
            <label className="font-bold text-slate-700">Senha</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-[#F5F6FA] px-3.5 py-2.5 focus:border-[#6C5CE7] focus:bg-white focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-xl bg-[#6C5CE7] py-2.5 font-bold text-white shadow-sm transition hover:bg-[#5849BE]"
          >
            Acessar Painel NOVA
          </button>
        </form>

        <div className="mt-4 flex justify-between text-xs text-slate-500">
          <Link
            href="/cadastro"
            className="font-semibold text-[#6C5CE7] hover:underline"
          >
            Criar nova conta
          </Link>
          <Link href="/onboarding" className="hover:underline">
            Configurar novo Workspace PF/PJ
          </Link>
        </div>
      </div>
    </div>
  );
}
