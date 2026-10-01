import test from 'node:test';
import assert from 'node:assert/strict';
import { seats, travellers, evaluateAssignment, findExchange, settleExchange, redeem, futureJourneys } from '../market.mjs';

test('a direct Maya and Alex swap fails Maya’s aisle condition', () => {
  const direct = evaluateAssignment([seats[1], seats[0], seats[2]]);
  assert.equal(direct.valid, false);
  assert.deepEqual(direct.checks.map(check => check.passes), [false, true, true]);
});
test('six possible allocations contain exactly one valid three-person cycle', () => {
  const result = findExchange();
  assert.equal(result.candidates.length, 6);
  assert.equal(result.matches.length, 1);
  assert.deepEqual(result.matches[0].assignment.map(seat => seat.id), ['later-aisle', 'early-window', 'later-window']);
});
test('one seat cannot be assigned to two travellers', () => {
  assert.equal(evaluateAssignment([seats[2], seats[0], seats[2]]).valid, false);
});
test('a lower reward budget blocks this offer', () => {
  assert.equal(findExchange(699).matches.length, 0);
});
test('every participant must accept the complete exchange', () => {
  assert.throws(() => settleExchange(['maya', 'alex']), /Every traveller/);
  assert.deepEqual(settleExchange(travellers.map(t => t.id)).balances, { maya: 600, alex: 0, sam: 100 });
});
test('future services consume credits and preserve the ledger total', () => {
  const result = futureJourneys();
  assert.deepEqual(result.balances, { maya: 400, alex: 0, sam: 0 });
  assert.equal(result.issued - result.redeemed, result.outstanding);
});
test('unaffordable or invalid redemptions cannot manufacture credits', () => {
  assert.throws(() => redeem(100, 200));
  assert.throws(() => redeem(100, -200));
  assert.throws(() => redeem(100, NaN));
});
test('replaying the story derives the same balances without repeated issuance', () => {
  assert.deepEqual(futureJourneys(), futureJourneys());
  assert.equal(settleExchange(['maya', 'alex', 'sam']).issued, 700);
});
