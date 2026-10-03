import test from 'node:test';
import assert from 'node:assert/strict';
import { preferences, journey, otherTravellers, request, services, requestTerms, timeline,
  initialState, findSeatOffer, seatAllowed, findRequestArrangement, accept, openRequest, publishRequest } from '../offers.mjs';

test('the first screen already has an eligible offer and no earned value', () => {
  const state = initialState();
  assert.equal(state.stage, 'offer');
  assert.equal(state.balance, 0);
  assert.equal(state.seat, '22C');
  assert.equal(state.offer.after.id, '22A');
  assert.equal(state.offer.reward, 400);
  assert.equal(state.ledger.length, 0);
});
test('the stated four-hour boundary governs the same matching rule', () => {
  assert.equal(seatAllowed(preferences, 240, 'window'), true);
  assert.equal(seatAllowed(preferences, 241, 'window'), false);
  assert.equal(seatAllowed(preferences, 241, 'aisle'), true);
  assert.equal(seatAllowed(preferences, undefined, 'window'), false);
  assert.equal(seatAllowed([], 105, 'window'), false);
  assert.equal(findSeatOffer(preferences, {...journey, durationMinutes: 300}), null);
});
test('a seat match needs the correct flight and an active counterparty request', () => {
  assert.equal(findSeatOffer(preferences, journey, [{...otherTravellers[0], journeyId: 'another-flight'}]), null);
  assert.equal(findSeatOffer(preferences, journey, [{...otherTravellers[0], authorization: undefined}]), null);
  assert.equal(findSeatOffer(preferences, journey, [{...otherTravellers[0], seat: journey.seat}]), null);
  assert.equal(findSeatOffer(preferences, journey, otherTravellers, journey.changesClose), null);
  assert.equal(findSeatOffer(preferences, journey, [{...otherTravellers[0], authorization: {...otherTravellers[0].authorization, validUntil: timeline.start}}]), null);
});
test('acceptance earns credits once and leaves the later journey unchanged', () => {
  const before = initialState();
  const earned = accept(before);
  assert.equal(before.balance, 0);
  assert.equal(before.seat, '22C');
  assert.equal(earned.stage, 'earned');
  assert.equal(earned.balance, 400);
  assert.equal(earned.seat, '22A');
  assert.equal(earned.futureSeat, '34C');
  assert.equal(earned.extraBags, 0);
  assert.equal(accept(earned), earned);
  assert.equal(accept(before, journey.changesClose), before);
});
test('one published request fulfills two services inside one total credit cap', () => {
  const reviewed = openRequest(accept(initialState()));
  assert.equal(reviewed.stage, 'request');
  assert.equal(reviewed.balance, 400);
  assert.equal(reviewed.authorization, undefined);
  const complete = publishRequest(reviewed);
  assert.equal(complete.stage, 'complete');
  assert.equal(complete.balance, 40);
  assert.equal(complete.spent, 360);
  assert.equal(complete.futureSeat, '32C');
  assert.deepEqual(complete.familySeats, ['32A', '32B', '32C']);
  assert.equal(complete.extraBags, 1);
  assert.equal(complete.bagMaxKg, 23);
  assert.deepEqual(complete.authorization, {...requestTerms, authorizedAt: timeline.nextTripRequest});
  assert.equal(complete.ledger.reduce((total, entry) => total + (entry.kind === 'earned' ? entry.amount : -entry.amount), 0), complete.balance);
  assert.equal(complete.ledger.length, 2);
  assert.equal(publishRequest(complete), complete);
});
test('funding, expiry and service deadlines constrain request publication', () => {
  const reviewed = openRequest(accept(initialState()));
  for (const terms of [
    {...requestTerms, maxCredits: 359}, {...requestTerms, maxCredits: 401},
    {...requestTerms, maxCredits: NaN}, {...requestTerms, maxCredits: -1},
    {...requestTerms, validUntil: timeline.nextTripRequest},
    {...requestTerms, validUntil: '2026-11-01T11:00:00+08:00'},
    {...requestTerms, validUntil: 'invalid'},
  ]) assert.equal(publishRequest(reviewed, terms), reviewed);
  assert.equal(publishRequest(reviewed, requestTerms, requestTerms.validUntil), reviewed);
  assert.equal(findRequestArrangement(request, 350, requestTerms), null);
});
test('all-together terms preserve both original resources when a service is unavailable', () => {
  const reviewed = openRequest(accept(initialState()));
  for (const index of [0, 1]) {
    const unavailable = services.map((service, i) => ({...service, available: i !== index}));
    assert.equal(publishRequest(reviewed, requestTerms, timeline.nextTripRequest, unavailable), reviewed);
  }
  const unconfirmedSupplier = services.map(service => ({...service, supplierConfirmed: false}));
  assert.equal(publishRequest(reviewed, requestTerms, timeline.nextTripRequest, unconfirmedSupplier), reviewed);
  assert.equal(reviewed.futureSeat, '34C');
  assert.equal(reviewed.extraBags, 0);
});
test('matching never substitutes a different journey, party or personal baggage allowance', () => {
  assert.equal(findRequestArrangement({...request, journeyId: 'taipei'}, 400, requestTerms), null);
  assert.equal(findRequestArrangement({...request, partyId: 'another-party'}, 400, requestTerms), null);
  assert.equal(findRequestArrangement(request, 400, requestTerms, timeline.nextTripRequest,
    services.map(service => ({...service, source: 'another-traveller'}))), null);
  assert.equal(findRequestArrangement(request, 400, requestTerms, timeline.nextTripRequest,
    services.map(service => ({...service, seats: ['12A', '12B', '12C']}))), null);
});
test('stages cannot be skipped and the chapter return creates a fresh illustration', () => {
  const start = initialState();
  assert.equal(openRequest(start), start);
  assert.equal(publishRequest(start), start);
  const earned = accept(start);
  assert.equal(publishRequest(earned), earned);
  const complete = publishRequest(openRequest(earned));
  assert.equal(accept(complete), complete);
  assert.equal(openRequest(complete), complete);
  assert.deepEqual(initialState(), start);
});
