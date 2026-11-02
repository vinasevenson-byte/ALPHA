/** NOVA P02 — Funções puras de referência, sem acesso a banco ou arredondamento float.
 * Montantes devem ser inteiros em centavos; o serviço converte Decimal para centavos.
 * Para moedas com 4 casas de persistência, normalizar/arredondar explicitamente para BRL.
 */
export type MoneyCents = bigint;
export type ForecastEntry = { date: string; inbound: MoneyCents; outbound: MoneyCents };
export type ForecastPoint = { date: string; starting: MoneyCents; inbound: MoneyCents; outbound: MoneyCents; ending: MoneyCents };

export function buildForecast(opening: MoneyCents, entries: ForecastEntry[]): ForecastPoint[] {
  let balance = opening;
  return [...entries].sort((a,b) => a.date.localeCompare(b.date)).map(row => {
    if (row.inbound < 0n || row.outbound < 0n) throw new Error('NEGATIVE_FORECAST_AMOUNT');
    const point: ForecastPoint = {date:row.date, starting:balance, inbound:row.inbound, outbound:row.outbound, ending: balance + row.inbound - row.outbound};
    balance = point.ending;
    return point;
  });
}

export type CapacityInput = {
  eligibleBalance: MoneyCents;
  minForecastBalance: MoneyCents;
  safetyBuffer: MoneyCents;
  alreadyAllocated: MoneyCents;
  overdueNotInForecast: MoneyCents;
};
export function calculateReserveCapacity(x: CapacityInput): MoneyCents {
  if (x.safetyBuffer < 0n || x.alreadyAllocated < 0n || x.overdueNotInForecast < 0n) throw new Error('NEGATIVE_INPUT');
  const minimum = x.eligibleBalance < x.minForecastBalance ? x.eligibleBalance : x.minForecastBalance;
  const remaining = minimum - x.safetyBuffer - x.alreadyAllocated - x.overdueNotInForecast;
  return remaining > 0n ? remaining : 0n;
}

export function allocationBalance(movements: {kind:'ALLOCATE'|'RELEASE'|'TRANSFER_IN'|'TRANSFER_OUT'; amount:MoneyCents}[]): MoneyCents {
  return movements.reduce((sum, m) => {
    if (m.amount <= 0n) throw new Error('NON_POSITIVE_ALLOCATION');
    return sum + (m.kind === 'ALLOCATE' || m.kind === 'TRANSFER_IN' ? m.amount : -m.amount);
  }, 0n);
}
export function remainingInstallment(amount: MoneyCents, settlements: MoneyCents[]): MoneyCents {
  if(amount <= 0n || settlements.some(x => x <= 0n)) throw new Error('INVALID_SETTLEMENT');
  const paid = settlements.reduce((a,b)=>a+b,0n);
  if(paid > amount) throw new Error('OVER_SETTLEMENT');
  return amount - paid;
}
export function monthlyContribution(target:MoneyCents, allocated:MoneyCents, remainingMonths:number):MoneyCents {
  if(!Number.isInteger(remainingMonths) || remainingMonths <= 0) throw new Error('INVALID_MONTHS');
  const missing = target - allocated;
  if(missing <= 0n) return 0n;
  return (missing + BigInt(remainingMonths) - 1n) / BigInt(remainingMonths);
}
