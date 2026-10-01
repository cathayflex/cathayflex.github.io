import test from 'node:test';
import assert from 'node:assert/strict';
import { offers, initialState, accept, redeem } from '../offers.mjs';

test('credits are unavailable until an offer is accepted', () => {
  const state = initialState();
  assert.equal(state.balance, 0);
  assert.equal(redeem(state, 'baggage'), state);
});
test('accepting twice cannot issue credits twice', () => {
  const state = accept(initialState());
  assert.equal(state.balance, offers.flight.credits);
  assert.equal(accept(state), state);
});
test('future services debit the balance once', () => {
  const state = redeem(accept(initialState()), 'baggage');
  assert.equal(state.balance, 400);
  assert.equal(redeem(state, 'baggage'), state);
  assert.equal(redeem(state, 'seat').balance, 300);
});
test('an offer cannot pay for a service above its balance', () => {
  const state = accept(initialState('seat'));
  assert.equal(redeem(state, 'baggage'), state);
  assert.equal(redeem(state, 'seat').balance, 0);
  assert.equal(redeem(state, 'unknown'), state);
});
test('changing examples starts an independent illustrative booking', () => {
  const oldState = redeem(accept(initialState()), 'baggage');
  const newState = initialState('seat');
  assert.equal(newState.accepted, false);
  assert.equal(newState.balance, 0);
  assert.deepEqual(newState.redeemed, []);
  assert.equal(oldState.balance, 400);
  assert.throws(() => initialState('unknown'));
});
