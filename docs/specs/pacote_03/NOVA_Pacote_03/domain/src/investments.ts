/** NOVA Pacote 03: motor educacional/analítico. Não executa ordens ou indica investimentos. */
export type FixedIncomeTax = { rate: number; category: 'PF_GENERAL_FIXED_INCOME' };
export function brazilPfFixedIncomeTax(days: number): FixedIncomeTax {
  if (!Number.isInteger(days) || days < 1) throw new Error('Prazo inválido');
  return { category: 'PF_GENERAL_FIXED_INCOME', rate: days <= 180 ? 0.225 : days <= 360 ? 0.20 : days <= 720 ? 0.175 : 0.15 };
}
export function taxableFixedIncomeRedemption(params: {principal: number; grossRedemption: number; days: number; fees?: number; iofRate?: number}): {grossProfit: number; incomeTax: number; iof: number; netRedemption: number} {
  const {principal, grossRedemption, days, fees = 0, iofRate} = params;
  for (const n of [principal,grossRedemption,fees]) if (!Number.isFinite(n) || n < 0) throw new Error('Valor inválido');
  if (days < 30 && iofRate === undefined) throw new Error('Tabela IOF obrigatória para resgate inferior a 30 dias');
  if (iofRate !== undefined && (!Number.isFinite(iofRate) || iofRate < 0 || iofRate > 1)) throw new Error('IOF inválido');
  const profit = Math.max(0, grossRedemption-principal);
  const iof = days < 30 ? profit * (iofRate ?? 0) : 0;
  const incomeTax = Math.max(0, profit-iof)*brazilPfFixedIncomeTax(days).rate;
  return {grossProfit: grossRedemption-principal, incomeTax, iof, netRedemption: grossRedemption-fees-iof-incomeTax};
}
export function futureValue(params: {principal: number; monthly: number; years: number; annualRate: number; inflation?: number}) {
  const {principal,monthly,years,annualRate,inflation=0}=params;
  if ([principal,monthly,years,annualRate,inflation].some(x => !Number.isFinite(x)) || principal < 0 || monthly < 0 || years < 0 || years > 60 || !Number.isInteger(years*12) || annualRate <= -1 || inflation <= -1) throw new Error('Premissas inválidas');
  const n=years*12, r=Math.pow(1+annualRate,1/12)-1;
  const amount=principal*Math.pow(1+r,n)+(Math.abs(r)<1e-12?monthly*n:monthly*(Math.pow(1+r,n)-1)/r);
  const contributions=principal+monthly*n;
  return {amount, contributions, earnings:amount-contributions, inflationAdjusted:amount/Math.pow(1+inflation,years)};
}
export function assessQuote(q: {price: number; asOfMs: number; nowMs: number; maxAgeMs: number}): 'VALID'|'STALE'|'INVALID' {
  if (![q.price,q.asOfMs,q.nowMs,q.maxAgeMs].every(Number.isFinite) || q.price<=0 || q.maxAgeMs<0 || q.asOfMs>q.nowMs) return 'INVALID';
  return q.nowMs-q.asOfMs<=q.maxAgeMs?'VALID':'STALE';
}
export function projectLiquidity(lots: {amount: number; redemptionAvailableAt: string}[], asOf: string) {
  const t=Date.parse(asOf); if (!Number.isFinite(t)) throw new Error('Data inválida');
  let available=0, locked=0;
  for (const lot of lots) { const d=Date.parse(lot.redemptionAvailableAt); if (!Number.isFinite(d) || !Number.isFinite(lot.amount)||lot.amount<0) throw new Error('Lote inválido'); if(d<=t) available+=lot.amount; else locked+=lot.amount; }
  return {available,locked};
}
