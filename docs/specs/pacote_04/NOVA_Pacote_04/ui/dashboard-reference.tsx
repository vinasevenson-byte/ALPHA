import React from 'react';
/** Visual reference component; parent app must provide authenticated, authorized API data. */
type Card={label:string;value:string;state?:'ok'|'empty'|'stale'};
export function NovaDashboardReference({cards,insights}:{cards:Card[];insights:{title:string;explanation:string}[]}){
 return <main className="min-h-screen bg-[#F5F6FA] p-5 text-[#172033]" lang="pt-BR">
  <div className="mb-5 flex items-center justify-between"><h1 className="text-2xl font-semibold">Visão Geral</h1><span className="text-sm text-slate-500">NOVA · Inteligência Financeira</span></div>
  <section className="grid gap-3 md:grid-cols-3">{cards.map(c=><article key={c.label} className="rounded-[10px] border border-[#E4E7EF] bg-white p-5"><h2 className="text-sm text-slate-600">{c.label}</h2><p className="mt-3 text-3xl font-semibold">{c.value}</p>{c.state==='stale'&&<p className="text-amber-700">Dados desatualizados</p>}</article>)}</section>
  <section className="mt-3 grid gap-3 lg:grid-cols-[2fr_1fr]"><div className="rounded-[10px] border border-[#E4E7EF] bg-white p-5"><h2 className="font-semibold">Evolução Financeira</h2><p className="mt-8 text-center text-sm text-slate-500">Conecte dados autorizados para visualizar o gráfico</p></div><aside className="rounded-[10px] border border-[#E4E7EF] bg-white p-5"><h2 className="font-semibold">Recomendações</h2>{insights.length===0?<p className="mt-4 text-sm text-slate-500">Sem recomendações no momento</p>:insights.map((x,i)=><article key={i} className="mt-4 border-t pt-3"><h3 className="font-medium text-[#6D28D9]">{x.title}</h3><p className="text-sm text-slate-600">{x.explanation}</p></article>)}</aside></section>
 </main>;
}
