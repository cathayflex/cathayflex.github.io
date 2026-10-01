import test from 'node:test';
import assert from 'node:assert/strict';
import { preferences, journey, otherTravellers, request, services, reward, initialState, findSeatOffer, seatPreferenceScore, findServiceOffer, matchSeats, accept, openRequest, matchServices, redeem } from '../offers.mjs';

test('a short-flight seat match meets both travellers’ preferences', () => {
  const offer = findSeatOffer();
  assert.equal(offer.before.type, 'aisle');
  assert.equal(offer.after.type, 'window');
  assert.notEqual(offer.before.id, offer.after.id);
  assert.equal(offer.traveller, 'Alex');
});
test('a match preserves a long-flight aisle preference that is already met', () => {
  assert.equal(findSeatOffer(preferences, { ...journey, category: 'long' }), null);
});
test('a preferred seat is ranked higher without making alternatives forbidden', () => {
  assert.equal(seatPreferenceScore(preferences, 'long', 'aisle'), 1);
  assert.equal(seatPreferenceScore(preferences, 'long', 'window'), 0);
  const flight = { ...journey, category: 'long', seat: { id: 'your-middle', type: 'middle' } };
  const person = { ...otherTravellers[0], wants: 'middle' };
  assert.equal(findSeatOffer(preferences, flight, [person]).after.type, 'window');
});
test('matching requires the same flight and the other traveller’s agreement', () => {
  assert.equal(findSeatOffer(preferences, journey, [{ ...otherTravellers[0], journeyId: 'other-flight' }]), null);
  assert.equal(findSeatOffer(preferences, journey, [{ ...otherTravellers[0], agreed: false }]), null);
  assert.equal(findSeatOffer(preferences, journey, [{ ...otherTravellers[0], seat: journey.seat }]), null);
});
test('the next request matches the correct journey, service and balance', () => {
  assert.equal(findServiceOffer(request, reward).id, 'tokyo-bag');
  assert.equal(findServiceOffer(request, 100), null);
  assert.equal(findServiceOffer(request, reward, services.map(item => ({ ...item, available: false }))), null);
  assert.equal(findServiceOffer({ ...request, payment: 'cash' }, reward), null);
});
test('earning then spending advances through both language requests', () => {
  const offer = matchSeats(initialState());
  assert.equal(offer.stage, 'seat-offer');
  const earned = accept(offer);
  assert.equal(earned.balance, 300);
  const requested = openRequest(earned);
  assert.equal(requested.stage, 'request');
  const service = matchServices(requested);
  assert.equal(service.service.creditPrice, 200);
  const complete = redeem(service);
  assert.equal(complete.stage, 'complete');
  assert.equal(complete.balance, 100);
});
test('repeat actions cannot duplicate credits or reservations', () => {
  const earned = accept(matchSeats(initialState()));
  assert.equal(accept(earned), earned);
  const complete = redeem(matchServices(openRequest(earned)));
  assert.equal(redeem(complete), complete);
  assert.equal(accept(complete), complete);
});
test('stages cannot be skipped, and restarting yields a fresh illustration', () => {
  const start = initialState();
  assert.equal(accept(start), start);
  assert.equal(redeem(start), start);
  assert.equal(openRequest(start), start);
  assert.equal(matchServices(start), start);
  const completed = redeem(matchServices(openRequest(accept(matchSeats(start)))));
  assert.deepEqual(initialState(completed), { stage: 'preferences', balance: 0 });
});
