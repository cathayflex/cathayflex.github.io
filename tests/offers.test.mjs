import test from 'node:test';
import assert from 'node:assert/strict';
import { preferences, journey, otherTravellers, request, services, requestTerms, requestQuote, timeline,
  tokyoFlight, bookedParty, accountTravellerId, initialState, findSeatOffer, seatAllowed,
  findRequestArrangement, accept, openRequest, publishRequest, settlePublishedRequest,
  expirePublishedRequest, spendableCredits } from '../offers.mjs';

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
test('seat rewards equal the fixed quote the requesting traveller authorised', () => {
  const quote = otherTravellers[0].authorization.quotedCredits;
  assert.equal(findSeatOffer().reward, quote);
  const withQuote = quotedCredits => [{...otherTravellers[0], authorization: {...otherTravellers[0].authorization, quotedCredits}}];
  assert.equal(findSeatOffer(preferences, journey, withQuote(250)).reward, 250);
  for (const amount of [-1, 0.5, NaN, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(findSeatOffer(preferences, journey, withQuote(amount)), null);
  }
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
test('publication reserves the displayed fixed quote before a later eligible match settles both changes', () => {
  const reviewed = openRequest(accept(initialState()));
  assert.equal(reviewed.stage, 'request');
  assert.equal(reviewed.balance, 400);
  assert.equal(reviewed.authorization, undefined);
  const published = publishRequest(reviewed);
  assert.equal(published.stage, 'published');
  assert.equal(published.balance, 400);
  assert.equal(published.creditHold, 360);
  assert.equal(spendableCredits(published), 40);
  assert.equal(published.futureSeat, '34C');
  assert.equal(published.extraBags, 0);
  assert.equal(published.ledger.length, 1);
  assert.equal(publishRequest(published), published);
  assert.equal(settlePublishedRequest(published, timeline.start), published);
  const complete = settlePublishedRequest(published);
  assert.equal(complete.stage, 'complete');
  assert.equal(complete.balance, 40);
  assert.equal(complete.spent, 360);
  assert.equal(complete.creditHold, 0);
  assert.equal(complete.settledAt, timeline.requestMatched);
  assert.equal(complete.futureSeat, '32C');
  assert.deepEqual(complete.familySeats, ['32A', '32B', '32C']);
  assert.equal(complete.extraBags, 1);
  assert.equal(complete.bagMaxKg, 23);
  assert.deepEqual(complete.authorization, {...requestTerms, authorizedAt: timeline.nextTripRequest});
  assert.equal(complete.ledger.reduce((total, entry) => total + (entry.kind === 'earned' ? entry.amount : -entry.amount), 0), complete.balance);
  assert.equal(complete.ledger.length, 2);
  assert.equal(publishRequest(complete), complete);
  assert.equal(settlePublishedRequest(complete), complete);
});
test('publication requires the exact platform quote, sufficient balance and a valid expiry', () => {
  const reviewed = openRequest(accept(initialState()));
  for (const terms of [
    {...requestTerms, quotedCredits: 359}, {...requestTerms, quotedCredits: 401},
    {...requestTerms, quotedCredits: NaN}, {...requestTerms, quotedCredits: -1},
    {...requestTerms, quoteId: 'another-quote'}, {...requestTerms, allowPartial: true},
    {...requestTerms, validUntil: timeline.nextTripRequest},
    {...requestTerms, validUntil: '2026-11-01T11:00:00+08:00'},
    {...requestTerms, validUntil: 'invalid'},
  ]) assert.equal(publishRequest(reviewed, terms), reviewed);
  assert.equal(publishRequest(reviewed, requestTerms, requestTerms.validUntil), reviewed);
  assert.equal(findRequestArrangement(request, 350, requestTerms), null);
  const underfunded = {...reviewed, balance: 359};
  assert.equal(publishRequest(underfunded), underfunded);
});
test('a published request stays pending with its quote reserved until all services are eligible', () => {
  const published = publishRequest(openRequest(accept(initialState())));
  for (const index of [0, 1]) {
    const unavailable = services.map((service, i) => ({...service, available: i !== index}));
    assert.equal(settlePublishedRequest(published, timeline.requestMatched, unavailable), published);
  }
  const unconfirmedSupplier = services.map(service => ({...service, supplierConfirmed: false}));
  assert.equal(settlePublishedRequest(published, timeline.requestMatched, unconfirmedSupplier), published);
  assert.equal(published.balance, 400);
  assert.equal(published.creditHold, 360);
  assert.equal(published.futureSeat, '34C');
  assert.equal(published.extraBags, 0);
  assert.equal(settlePublishedRequest(published).stage, 'complete');
});
test('an unfulfilled request releases its reserved credits when it expires without changing a booking', () => {
  const published = publishRequest(openRequest(accept(initialState())));
  assert.equal(expirePublishedRequest(published, timeline.requestMatched), published);
  const expired = settlePublishedRequest(published, requestTerms.validUntil);
  assert.equal(expired.stage, 'expired');
  assert.equal(expired.balance, 400);
  assert.equal(expired.creditHold, 0);
  assert.equal(spendableCredits(expired), 400);
  assert.equal(expired.futureSeat, '34C');
  assert.equal(expired.extraBags, 0);
  assert.deepEqual(expired.ledger, published.ledger);
  assert.equal(settlePublishedRequest(expired), expired);
});
test('matching never silently reprices the published quote or changes its included baggage', () => {
  const published = publishRequest(openRequest(accept(initialState())));
  for (const prices of [[159, 200], [161, 200], [159, 201]]) {
    const repriced = services.map((service, index) => ({...service, creditPrice: prices[index]}));
    assert.equal(findRequestArrangement(request, 400, requestTerms, timeline.requestMatched, repriced), null);
    assert.equal(settlePublishedRequest(published, timeline.requestMatched, repriced), published);
  }
  for (const change of [{pieces: 2}, {maxKg: 15}, {changesClose: timeline.nextTripRequest}]) {
    const altered = services.map(service => service.kind === 'extra-bag' ? {...service, ...change} : service);
    assert.equal(findRequestArrangement(request, 400, requestTerms, timeline.requestMatched, altered), null);
  }
});
test('matching never substitutes a different journey, party or personal baggage allowance', () => {
  assert.equal(findRequestArrangement({...request, journeyId: 'taipei'}, 400, requestTerms), null);
  assert.equal(findRequestArrangement({...request, partyId: 'another-party'}, 400, requestTerms), null);
  assert.equal(findRequestArrangement(request, 400, requestTerms, timeline.nextTripRequest,
    services.map(service => ({...service, source: 'another-traveller'}))), null);
  assert.equal(findRequestArrangement(request, 400, requestTerms, timeline.nextTripRequest,
    services.map(service => ({...service, seats: ['12A', '12B', '12C']}))), null);
});
test('the interpreted request resolves to the account flight and its actual booked companions', () => {
  assert.equal(request.journeyId, tokyoFlight.id);
  assert.equal(request.partyId, bookedParty.id);
  assert.equal(request.travellerId, accountTravellerId);
  assert.deepEqual(request.companionIds, bookedParty.travellers
    .filter(person => person.id !== accountTravellerId).map(person => person.id));
  for (const change of [
    {travellerId: 'another-person'}, {companionIds: ['invented-mia', 'invented-jamie']},
    {companionIds: ['traveller-mia']}, {companionIds: ['traveller-mia', 'traveller-mia']},
    {companionSeats: ['34A', '34B']}, {baggage: {pieces: 1, maxKg: 15}},
  ]) assert.equal(findRequestArrangement({...request, ...change}, 400, requestTerms), null);
  assert.equal(requestQuote.quotedCredits, requestQuote.items.reduce((sum, item) => sum + item.credits, 0));
});
test('seating requires three distinct booked people in consecutive seats in the same row and block', () => {
  const seatService = services.find(service => service.kind === 'seats-together');
  const invalidSeats = [
    {...seatService, seatPositions: seatService.seatPositions.map((seat, index) => ({...seat, row: index === 2 ? 33 : seat.row}))},
    {...seatService, seatPositions: seatService.seatPositions.map((seat, index) => ({...seat, block: index === 2 ? 'DEF' : seat.block}))},
    {...seatService, seatPositions: seatService.seatPositions.map((seat, index) => ({...seat, position: index === 2 ? 3 : seat.position}))},
    {...seatService, assignments: seatService.assignments.map(item => ({...item, travellerId: accountTravellerId}))},
    {...seatService, assignments: seatService.assignments.map(item => ({...item, seatId: '32A'}))},
    {...seatService, travellerSeat: '32D'},
  ];
  for (const invalid of invalidSeats) {
    const catalog = services.map(service => service.kind === 'seats-together' ? invalid : service);
    assert.equal(findRequestArrangement(request, 400, requestTerms, timeline.requestMatched, catalog), null);
  }
});
test('stages cannot be skipped and the chapter return creates a fresh illustration', () => {
  const start = initialState();
  assert.equal(openRequest(start), start);
  assert.equal(publishRequest(start), start);
  const earned = accept(start);
  assert.equal(publishRequest(earned), earned);
  assert.equal(settlePublishedRequest(earned), earned);
  const complete = settlePublishedRequest(publishRequest(openRequest(earned)));
  assert.equal(accept(complete), complete);
  assert.equal(openRequest(complete), complete);
  assert.deepEqual(initialState(), start);
});
