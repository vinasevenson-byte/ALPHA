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
    <div className="flex min-h-screen items-center justify-center bg-[#F4F7FA] p-4 text-[#142D43]">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#142D43] font-black text-[#69E2C0]">
            N
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-[#142D43]">NOVA</h1>
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
              className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5"
            />
          </div>
          <div>
            <label className="font-bold">E-mail</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5"
            />
          </div>
          <div>
            <label className="font-bold">Senha Segura</label>
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
            className="w-full rounded-xl bg-[#142D43] py-2.5 font-bold text-white"
          >
            Criar Conta e Configurar Workspace
          </button>
        </form>

        <div className="mt-4 text-center text-xs text-slate-500">
          Já possui cadastro?{" "}
          <Link href="/entrar" className="font-bold text-[#142D43] hover:underline">
            Entrar
          </Link>
        </div>
      </div>
    </div>
  );
}
