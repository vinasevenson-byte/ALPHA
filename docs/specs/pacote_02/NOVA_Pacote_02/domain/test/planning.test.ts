import { describe, expect, it } from 'vitest';
import {buildForecast, calculateReserveCapacity, allocationBalance, remainingInstallment, monthlyContribution} from '../src/planning';

describe('NOVA P02 planning invariants', () => {
  it('prevê apenas abertos futuros; entradas e saídas fornecidas sem duplicação', () => {
    const rows = buildForecast(100000n,[{date:'2026-11-03',inbound:30000n,outbound:10000n},{date:'2026-11-02',inbound:0n,outbound:20000n}]);
    expect(rows.map(x=>x.ending)).toEqual([80000n,100000n]);
  });
  it('não propõe reserva quando menor saldo fica abaixo da margem', () => {
    expect(calculateReserveCapacity({eligibleBalance:100000n,minForecastBalance:15000n,safetyBuffer:20000n,alreadyAllocated:0n,overdueNotInForecast:0n})).toBe(0n);
  });
  it('evita descontar compromissos vencidos duas vezes', () => {
    expect(calculateReserveCapacity({eligibleBalance:1000000n,minForecastBalance:700000n,safetyBuffer:200000n,alreadyAllocated:100000n,overdueNotInForecast:0n})).toBe(400000n);
  });
  it('alocações entre cofres são neutras no agregado', () => {
    expect(allocationBalance([{kind:'ALLOCATE',amount:10000n},{kind:'TRANSFER_OUT',amount:3000n},{kind:'TRANSFER_IN',amount:3000n}])).toBe(10000n);
  });
  it('não permite baixa maior que o saldo da parcela', () => {
    expect(()=>remainingInstallment(10000n,[7000n,4000n])).toThrow('OVER_SETTLEMENT');
    expect(remainingInstallment(10000n,[7000n])).toBe(3000n);
  });
  it('arredonda o aporte mensal para cima em centavos', () => {
    expect(monthlyContribution(10001n,0n,3)).toBe(3334n);
  });
});
