import test from 'node:test';
import assert from 'node:assert/strict';
import { stages, clampIndex, nextIndex, previousIndex, snapshotAt } from '../experience.mjs';
import { initialState, accept, openRequest, publishRequest, settlePublishedRequest, preferences, journey,
  otherTravellers, request, services, requestTerms, timeline } from '../offers.mjs';

test('Back restores the earlier illustrated booking and wallet without reversing a settlement', () => {
  const complete = snapshotAt(5);
  const review = snapshotAt(previousIndex(5));
  assert.equal(complete.state.balance, 40);
  assert.equal(complete.state.futureSeat, '32C');
  assert.equal(review.screen, 'review');
  assert.equal(review.state.balance, 400);
  assert.equal(review.state.futureSeat, '34C');
  assert.equal(review.state.extraBags, 0);
  assert.equal(review.state.authorization, undefined);

  const offer = snapshotAt(previousIndex(2));
  assert.equal(offer.screen, 'offer');
  assert.equal(offer.state.balance, 0);
  assert.equal(offer.state.seat, '22C');
  assert.equal(offer.state.ledger.length, 0);
  assert.equal(complete.state.balance, 40);
});

test('snapshots use eligible reducers and deduct only when a published request has a later match', () => {
  const initial = initialState();
  const earned = accept(initial);
  const requested = openRequest(earned);
  const published = publishRequest(requested);
  const completed = settlePublishedRequest(published);
  assert.equal(published.balance, requested.balance);
  assert.equal(published.creditHold, 360);
  assert.deepEqual(snapshotAt(0).state, initial);
  assert.deepEqual(snapshotAt(1).state, initial);
  assert.deepEqual(snapshotAt(2).state, earned);
  assert.deepEqual(snapshotAt(3).state, requested);
  assert.deepEqual(snapshotAt(4).state, requested);
  assert.deepEqual(snapshotAt(5).state, completed);
});

test('every illustrated balance is conserved by its ledger and transaction IDs stay unique', () => {
  for (let index = 0; index < stages.length; index += 1) {
    const { state } = snapshotAt(index);
    const balance = state.ledger.reduce((total, entry) =>
      total + (entry.kind === 'earned' ? entry.amount : -entry.amount), 0);
    assert.equal(state.balance, balance);
    assert.ok(state.balance >= 0);
    assert.equal(new Set(state.ledger.map(entry => entry.id)).size, state.ledger.length);
  }
});

test('repeated forward, Back and replay cycles never duplicate credits or retain a later booking', () => {
  const expected = stages.map((_, index) => snapshotAt(index));
  for (let cycle = 0; cycle < 10; cycle += 1) {
    let index = 0;
    for (let step = 0; step < stages.length; step += 1) {
      assert.deepEqual(snapshotAt(index), expected[index]);
      index = nextIndex(index);
    }
    for (let step = stages.length - 1; step >= 0; step -= 1) {
      assert.deepEqual(snapshotAt(index), expected[index]);
      index = previousIndex(index);
    }
    assert.equal(snapshotAt(0).state.balance, 0);
    assert.equal(snapshotAt(0).state.futureSeat, '34C');
    assert.equal(snapshotAt(5).state.ledger.length, 2);
  }
});

test('snapshots are fresh and deeply immutable without mutating or freezing shared fixtures', () => {
  const fixtures = { preferences, journey, otherTravellers, request, services, requestTerms, timeline };
  const before = structuredClone(fixtures);
  const first = snapshotAt(5);
  const second = snapshotAt(5);
  assert.notEqual(first, second);
  assert.notEqual(first.state, second.state);
  assert.notEqual(first.state.ledger, second.state.ledger);
  assert.notEqual(first.state.offer.after, second.state.offer.after);
  assert.throws(() => { first.state.balance = 999; }, TypeError);
  assert.throws(() => { first.state.ledger.push({ kind: 'earned', amount: 999 }); }, TypeError);
  assert.throws(() => { first.state.offer.after.id = '1A'; }, TypeError);
  assert.throws(() => { first.state.familySeats[0] = '1A'; }, TypeError);
  assert.deepEqual(fixtures, before);
  assert.equal(Object.isFrozen(services), false);
  assert.equal(Object.isFrozen(journey.seat), false);
  assert.equal(Object.isFrozen(requestTerms), false);
  assert.deepEqual(snapshotAt(5), second);
});

test('navigation stays within the story and invalid positions restart at its beginning', () => {
  assert.equal(previousIndex(0), 0);
  assert.equal(nextIndex(stages.length - 1), stages.length - 1);
  assert.equal(clampIndex(-50), 0);
  assert.equal(clampIndex(50), stages.length - 1);
  assert.equal(clampIndex(3.9), 3);
  for (const invalid of [undefined, null, NaN, Infinity, -Infinity, '4', {}, []]) {
    assert.equal(clampIndex(invalid), 0);
    assert.equal(snapshotAt(invalid).screen, 'flexibility');
  }
});
