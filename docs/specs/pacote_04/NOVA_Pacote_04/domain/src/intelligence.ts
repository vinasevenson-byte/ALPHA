/** Finance values use safe integer cents. Never pass floating-point BRL amounts. */
export type MoneyCents = number;
export interface FutureCashflow { date: string; amountCents: MoneyCents; status: 'PENDING'|'SETTLED'|'CANCELED'; kind:'INCOME'|'EXPENSE'; id:string }
export interface ProjectionResult { asOf:string; minimumCents:number; closingCents:number; points:ReadonlyArray<{date:string; balanceCents:number}> }
const assertAmount=(n:number)=>{if(!Number.isSafeInteger(n)||n<0) throw new Error('Amount must be nonnegative safe integer cents');};
const assertSigned=(n:number)=>{if(!Number.isSafeInteger(n)) throw new Error('Unsafe cents');};
const isoDate=(d:string)=>{ if(!/^\d{4}-\d{2}-\d{2}$/.test(d)||Number.isNaN(Date.parse(d+'T00:00:00Z'))||new Date(d+'T00:00:00Z').toISOString().slice(0,10)!==d) throw new Error('Invalid ISO date'); return d; };
/** Projection takes settled opening balance and only PENDING future items to avoid double counting. */
export function projectCash(openingCents:number, asOf:string, through:string, events:readonly FutureCashflow[]):ProjectionResult {
 assertSigned(openingCents);isoDate(asOf);isoDate(through); if(through<asOf)throw new Error('Inverted period');
 const seen=new Set<string>(); const buckets=new Map<string,number>();
 for(const e of events){assertAmount(e.amountCents);isoDate(e.date);if(seen.has(e.id))throw new Error('Duplicate cashflow id');seen.add(e.id);
  if(e.status!=='PENDING'||e.date<asOf||e.date>through)continue;
  const signed=e.kind==='INCOME'?e.amountCents:-e.amountCents;
  buckets.set(e.date,(buckets.get(e.date)??0)+signed);
 }
 let running=openingCents,minimum=openingCents;const points=[] as {date:string;balanceCents:number}[];
 for(const date of [...buckets.keys()].sort()){running+=buckets.get(date)!;assertSigned(running);minimum=Math.min(minimum,running);points.push({date,balanceCents:running});}
 return {asOf,minimumCents:minimum,closingCents:running,points};
}
export type ReserveResult={status:'AVAILABLE';capacityCents:number;reason:string}|{status:'UNAVAILABLE';capacityCents:null;reason:string};
export function reserveCapacity(input:{projection:ProjectionResult|null; protectedMinimumCents:number; allocatedReserveCents:number; uncertaintyBufferCents:number; complete:boolean; reconciled:boolean;}):ReserveResult {
 for(const v of [input.protectedMinimumCents,input.allocatedReserveCents,input.uncertaintyBufferCents])assertAmount(v);
 if(!input.complete||!input.reconciled||!input.projection)return{status:'UNAVAILABLE',capacityCents:null,reason:'Dados insuficientes ou não conciliados'};
 return{status:'AVAILABLE',capacityCents:Math.max(0,input.projection.minimumCents-input.protectedMinimumCents-input.allocatedReserveCents-input.uncertaintyBufferCents),reason:'Menor saldo projetado, menos mínimo protegido, alocações e incerteza'};
}
export function savingsRate(realizedIncomeCents:number,realizedExpenseCents:number):number|null{
 assertAmount(realizedIncomeCents);assertAmount(realizedExpenseCents);return realizedIncomeCents===0?null:(realizedIncomeCents-realizedExpenseCents)/realizedIncomeCents;
}
export type Evidence={metric:string;asOf:string;source:string;status:'VERIFIED'|'ESTIMATED'|'STALE'|'UNAVAILABLE';value:string};
export type Insight={code:string;priority:'HIGH'|'MEDIUM';title:string;explanation:string;evidence:Evidence[]};
export function detectCashRisk(projection:ProjectionResult|null,source:string):Insight[]{
 if(!projection||projection.minimumCents>=0)return[];
 return [{code:'NEGATIVE_PROJECTED_CASH',priority:'HIGH',title:'Risco de saldo negativo',explanation:'A projeção de compromissos conhecidos indica saldo negativo no horizonte analisado. Revise os lançamentos e vencimentos.',evidence:[{metric:'minimumProjectedCashCents',asOf:projection.asOf,source,status:'ESTIMATED',value:String(projection.minimumCents)}]}];
}
export function qualityStatus(inputs:{missingAccounts:number;unreconciledTransactions:number;staleMarketPrices:number}){
 for(const x of Object.values(inputs))assertAmount(x);
 return {eligibleForAutomatedSuggestions:Object.values(inputs).every(x=>x===0),issues:inputs};
}
