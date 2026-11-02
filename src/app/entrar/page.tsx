"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("titular@nova.fin.br");
  const [password, setPassword] = useState("••••••••••••");

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F4F7FA] p-4 text-[#142D43]">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#142D43] font-black text-[#69E2C0]">
            N
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-[#142D43]">NOVA</h1>
            <p className="text-xs text-slate-500">
              Seu dinheiro organizado. Seu futuro planejado.
            </p>
          </div>
        </div>

        <h2 className="mt-6 text-base font-bold text-[#142D43]">
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
              className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5"
            />
          </div>
          <div>
            <label className="font-bold text-slate-700">Senha</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-xl bg-[#142D43] py-2.5 font-bold text-white hover:bg-[#142D43]/90"
          >
            Acessar Painel NOVA
          </button>
        </form>

        <div className="mt-4 flex justify-between text-xs text-slate-500">
          <Link href="/cadastro" className="font-semibold text-[#142D43] hover:underline">
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
