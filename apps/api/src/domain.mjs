export function parseMoney(value) {
  const s=String(value);
  if(!/^(?:0|[1-9]\d{0,12})(?:\.\d{1,2})?$/.test(s)) throw Error('Valor monetário inválido');
  const [reais,centavos='']=s.split('.');
  const n=BigInt(reais)*100n+BigInt((centavos+'00').slice(0,2));
  if(n<=0n) throw Error('Valor deve ser positivo');
  return n;
}
export function asMoney(c){const v=BigInt(c),neg=v<0n?'-':'';const a=v<0n?-v:v;return neg+(a/100n).toString()+'.'+(a%100n).toString().padStart(2,'0')}
export function compute(accounts,transactions,reserves=[],reconciled=false){
 const balance=accounts.reduce((x,a)=>x+BigInt(a.openingCents),0n)+transactions.filter(t=>t.status==='SETTLED').reduce((x,t)=>x+BigInt(t.signedCents),0n);
 const income=transactions.filter(t=>t.status==='SETTLED'&&t.kind==='INCOME').reduce((x,t)=>x+BigInt(t.signedCents),0n);
 const expense=transactions.filter(t=>t.status==='SETTLED'&&t.kind==='EXPENSE').reduce((x,t)=>x-BigInt(t.signedCents),0n);
 let current=balance,min=balance;const pending=transactions.filter(t=>t.status==='PENDING').sort((a,b)=>String(a.dueDate).localeCompare(String(b.dueDate)));
 const points=pending.map(t=>{current+=BigInt(t.signedCents);if(current<min)min=current;return {date:String(t.dueDate).slice(0,10),balance:asMoney(current)}});
 const allocated=reserves.reduce((x,r)=>x+BigInt(r.amountCents),0n);
 const capacity=min-allocated;
 return {summary:{balance:asMoney(balance),income:asMoney(income),expense:asMoney(expense)},projection:{minimum:asMoney(min),closing:asMoney(current),points},capacity:reconciled?asMoney(capacity>0n?capacity:0n):null};
}
export function validateISODate(s){if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s)||Number.isNaN(Date.parse(s))||new Date(s+'T00:00:00Z').toISOString().slice(0,10)!==s)throw Error('Data inválida');return new Date(s+'T00:00:00Z')}
export function safeString(x,max=180){if(typeof x!=='string'||!x.trim()||x.length>max)throw Error('Texto inválido');return x.trim()}
