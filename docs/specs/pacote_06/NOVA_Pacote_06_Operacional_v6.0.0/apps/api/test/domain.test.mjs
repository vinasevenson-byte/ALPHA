import test from 'node:test';import assert from 'node:assert/strict';import {parseMoney,compute,validateISODate} from '../src/domain.mjs';
test('precisão decimal',()=>{assert.equal(parseMoney('100.05'),10005n);assert.throws(()=>parseMoney('0.001'));assert.throws(()=>parseMoney('1e5'));});
test('transferência interna não aumenta receitas',()=>{const a=[{openingCents:10000n},{openingCents:0n}],t=[{status:'SETTLED',kind:'TRANSFER_OUT',signedCents:-5000n},{status:'SETTLED',kind:'TRANSFER_IN',signedCents:5000n}];const r=compute(a,t);assert.equal(r.summary.balance,'100.00');assert.equal(r.summary.income,'0.00')});
test('pendências não alteram saldo liquidado, apenas projeção',()=>{const r=compute([{openingCents:10000n}],[{status:'PENDING',kind:'EXPENSE',signedCents:-15000n,dueDate:'2026-12-01'}]);assert.equal(r.summary.balance,'100.00');assert.equal(r.projection.minimum,'-50.00')});
test('reserva é alocação, não despesa',()=>{const r=compute([{openingCents:10000n}],[],[{amountCents:3000n}],true);assert.equal(r.summary.balance,'100.00');assert.equal(r.capacity,'70.00')});
test('capacidade bloqueada até conferência',()=>assert.equal(compute([],[]).capacity,null));
test('data inválida bloqueada',()=>{assert.throws(()=>validateISODate('2026-02-30'));assert.equal(validateISODate('2026-11-02').toISOString().slice(0,10),'2026-11-02')});
