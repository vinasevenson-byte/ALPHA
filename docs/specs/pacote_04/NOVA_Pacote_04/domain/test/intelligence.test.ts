import {describe,it,expect} from 'vitest';
import {projectCash,reserveCapacity,savingsRate,detectCashRisk,qualityStatus} from '../src/intelligence.js';
describe('NOVA P4 core',()=>{
 it('projects only pending, not settled twice',()=>{const p=projectCash(100000,'2026-11-01','2026-11-30',[{id:'a',date:'2026-11-10',amountCents:30000,kind:'EXPENSE',status:'PENDING'},{id:'b',date:'2026-11-12',amountCents:90000,kind:'INCOME',status:'SETTLED'}]);expect(p.minimumCents).toBe(70000);expect(p.closingCents).toBe(70000)});
 it('rejects duplicate events',()=>expect(()=>projectCash(100,'2026-11-01','2026-11-30',[{id:'x',date:'2026-11-10',amountCents:10,kind:'EXPENSE',status:'PENDING'},{id:'x',date:'2026-11-11',amountCents:10,kind:'EXPENSE',status:'PENDING'}])).toThrow('Duplicate'));
 it('returns unavailable if not reconciled',()=>expect(reserveCapacity({projection:null,protectedMinimumCents:0,allocatedReserveCents:0,uncertaintyBufferCents:0,complete:false,reconciled:false}).status).toBe('UNAVAILABLE'));
 it('never produces negative reserve capacity',()=>{const p=projectCash(3000,'2026-11-01','2026-11-30',[]);expect(reserveCapacity({projection:p,protectedMinimumCents:2000,allocatedReserveCents:2000,uncertaintyBufferCents:500,complete:true,reconciled:true})).toMatchObject({capacityCents:0})});
 it('notices negative future balances',()=>{const p=projectCash(1000,'2026-11-01','2026-11-30',[{id:'c',date:'2026-11-15',amountCents:4000,kind:'EXPENSE',status:'PENDING'}]);expect(detectCashRisk(p,'ledger')).toHaveLength(1)});
 it('does not fabricate savings rate',()=>expect(savingsRate(0,100)).toBeNull());
 it('gates suggestions on integrity',()=>expect(qualityStatus({missingAccounts:0,unreconciledTransactions:1,staleMarketPrices:0}).eligibleForAutomatedSuggestions).toBe(false));
 it('rejects invalid dates',()=>expect(()=>projectCash(0,'2026-02-30','2026-03-31',[])).toThrow('Invalid'));
});
