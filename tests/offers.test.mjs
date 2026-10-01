import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, accept, openRedemption, redeem, reward, baggagePrice } from '../offers.mjs';

test('a traveller earns once and spends on a future journey', () => {
  const offered = initialState();
  const earned = accept(offered);
  assert.deepEqual(earned, { stage: 'earned', balance: 600 });
  const spending = openRedemption(earned);
  assert.equal(spending.stage, 'use');
  assert.equal(spending.balance, reward);
  assert.deepEqual(redeem(spending), { stage: 'complete', balance: reward - baggagePrice });
});
test('credits cannot be spent before an offer is accepted', () => {
  const state = initialState();
  assert.equal(redeem(state), state);
  assert.equal(openRedemption(state), state);
});
test('repeat acceptance cannot issue more credits', () => {
  const earned = accept(initialState());
  assert.equal(accept(earned), earned);
  const spending = openRedemption(earned);
  assert.equal(accept(spending), spending);
});
test('a completed reservation cannot be charged twice', () => {
  const complete = redeem(openRedemption(accept(initialState())));
  assert.equal(redeem(complete), complete);
  assert.equal(complete.balance, 400);
});
test('redemption cannot overdraw the available balance', () => {
  const state = { stage: 'use', balance: 100 };
  assert.equal(redeem(state), state);
});
