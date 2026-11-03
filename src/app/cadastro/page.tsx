"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Não foi possível concluir o cadastro.");
        return;
      }
      const targetWs = data.workspaces?.[0]?.id || "ws-nova-pf";
      router.push(`/app/${targetWs}/visao-geral`);
    } catch {
      setError("Erro de comunicação com o servidor.");
    } finally {
      setLoading(false);
    }
  }

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
              Cadastro de Titular • Pacote 06 (Cria PF + PJ automaticamente)
            </p>
          </div>
        </div>

        <form onSubmit={handleRegister} className="mt-5 space-y-3 text-xs">
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
            <label className="font-bold">
              Senha Segura (mínimo 12 caracteres, scrypt + salt)
            </label>
            <input
              type="password"
              required
              minLength={12}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-[#F5F6FA] px-3.5 py-2.5 focus:border-[#6C5CE7] focus:bg-white focus:outline-none"
            />
          </div>
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700"
            >
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[#6C5CE7] py-2.5 font-bold text-white shadow-sm transition hover:bg-[#5849BE] disabled:opacity-50"
          >
            {loading
              ? "Criando ambientes PF e PJ..."
              : "Criar Conta e Ambientes PF + PJ"}
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
