"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

export default function OnboardingPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [type, setType] = useState<"PERSONAL" | "BUSINESS">("PERSONAL");

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F4F7FA] p-4 text-[#142D43]">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
        <span className="rounded-full bg-[#69E2C0]/30 px-2.5 py-0.5 text-[10px] font-bold uppercase text-[#142D43]">
          Onboarding NOVA • Pacote 01
        </span>
        <h1 className="mt-2 text-xl font-extrabold text-[#142D43]">
          Criar novo ambiente (PF ou PJ)
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          O novo workspace começa com saldo R$ 0,00, moeda BRL e fuso
          America/Sao_Paulo, com isolamento total de dados.
        </p>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const res = await fetch("/api/platform", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "CREATE_WORKSPACE",
                name: name || (type === "BUSINESS" ? "Minha Empresa PJ" : "Meu Financeiro PF"),
                type,
              }),
            });
            const json = await res.json();
            if (json.workspace?.id) {
              router.push(`/app/${json.workspace.id}/visao-geral`);
            }
          }}
          className="mt-5 space-y-4 text-xs"
        >
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setType("PERSONAL")}
              className={`rounded-xl border p-4 text-left ${
                type === "PERSONAL"
                  ? "border-2 border-[#142D43] bg-[#F4F7FA]"
                  : "border-slate-200"
              }`}
            >
              <div className="font-extrabold text-[#142D43]">
                Pessoa Física (PERSONAL)
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                Salário, despesas domésticas, reserva de emergência e metas.
              </p>
            </button>
            <button
              type="button"
              onClick={() => setType("BUSINESS")}
              className={`rounded-xl border p-4 text-left ${
                type === "BUSINESS"
                  ? "border-2 border-[#142D43] bg-[#F4F7FA]"
                  : "border-slate-200"
              }`}
            >
              <div className="font-extrabold text-[#142D43]">
                Empresarial (BUSINESS)
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                Recebimentos, fornecedores, centros de custo, tributos e giro.
              </p>
            </button>
          </div>

          <div>
            <label className="font-bold">Nome do Workspace</label>
            <input
              type="text"
              required
              placeholder="Ex: Finanças da Família / Empresa Ltda"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-xl bg-[#142D43] py-2.5 font-bold text-white"
          >
            Criar Workspace em R$ 0,00 e Continuar
          </button>
        </form>
      </div>
    </div>
  );
}
