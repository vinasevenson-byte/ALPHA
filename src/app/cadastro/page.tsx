"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

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
              Cadastro de Titular • Pacote 01
            </p>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            router.push("/onboarding");
          }}
          className="mt-5 space-y-3 text-xs"
        >
          <div>
            <label className="font-bold">Nome Completo</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-[#F5F6FA] px-3.5 py-2.5 focus:border-[#6C5CE7] focus:bg-white focus:outline-none"
            />
          </div>
          <div>
            <label className="font-bold">E-mail</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-[#F5F6FA] px-3.5 py-2.5 focus:border-[#6C5CE7] focus:bg-white focus:outline-none"
            />
          </div>
          <div>
            <label className="font-bold">Senha Segura</label>
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
            Criar Conta e Configurar Workspace
          </button>
        </form>

        <div className="mt-4 text-center text-xs text-slate-500">
          Já possui cadastro?{" "}
          <Link
            href="/entrar"
            className="font-bold text-[#6C5CE7] hover:underline"
          >
            Entrar
          </Link>
        </div>
      </div>
    </div>
  );
}
