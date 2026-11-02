import {describe,it,expect} from 'vitest';
import {brazilPfFixedIncomeTax, taxableFixedIncomeRedemption, futureValue, assessQuote, projectLiquidity} from '../src/investments';
describe('faixas renda fixa PF',()=>{
 it('testa as quatro fronteiras',()=>{expect([180,181,360,361,720,721].map(d=>brazilPfFixedIncomeTax(d).rate)).toEqual([.225,.2,.2,.175,.175,.15]);});
 it('não tributa prejuízo e exige IOF antes de 30 dias',()=>{expect(taxableFixedIncomeRedemption({principal:1000,grossRedemption:950,days:365}).incomeTax).toBe(0);expect(()=>taxableFixedIncomeRedemption({principal:1000,grossRedemption:1100,days:10})).toThrow('IOF');});
 it('desconta tributos somente de ganho positivo',()=>{const a=taxableFixedIncomeRedemption({principal:1000,grossRedemption:1100,days:365});expect(a.incomeTax).toBeCloseTo(17.5);expect(a.netRedemption).toBeCloseTo(1082.5);});
});
describe('projeções',()=>{
 it('taxa zero',()=>expect(futureValue({principal:1000,monthly:100,years:1,annualRate:0}).amount).toBeCloseTo(2200));
 it('não cria saldo sem aporte',()=>expect(futureValue({principal:0,monthly:0,years:10,annualRate:.1}).amount).toBe(0));
 it('inflacao impacta poder de compra',()=>{let a=futureValue({principal:1000,monthly:0,years:2,annualRate:.1,inflation:.05});expect(a.inflationAdjusted).toBeLessThan(a.amount)});
});
describe('fonte e liquidez',()=>{
 it('indica cotação defasada',()=>expect(assessQuote({price:1,asOfMs:100,nowMs:1000,maxAgeMs:100})).toBe('STALE'));
 it('separa recursos bloqueados',()=>expect(projectLiquidity([{amount:100,redemptionAvailableAt:'2026-01-01'},{amount:200,redemptionAvailableAt:'2027-01-01'}],'2026-11-01')).toEqual({available:100,locked:200}));
});
