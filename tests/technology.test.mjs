import test from 'node:test';
import assert from 'node:assert/strict';
import {technologyExamples, expiryLabel} from '../technology.mjs';
import {preferences, journey, otherTravellers, request, requestTerms, requestQuote, tokyoFlight, bookedParty, services, timeline} from '../offers.mjs';

test('the two visuals use the existing eligible exchange and complete arrangement', () => {
  const examples = technologyExamples();
  assert.equal(examples.flexibility.offer.reward, 400);
  assert.equal(examples.flexibility.offer.after.id, '22A');
  assert.equal(examples.request.arrangement.total, 360);
  assert.deepEqual(examples.request.arrangement.services.map(service => service.kind), ['seats-together', 'extra-bag']);
  for (const example of Object.values(examples)) assert.equal(example.clauses.join(' '), example.words);
});

test('the seat visual cannot claim a match when duration, demand or deadline makes it invalid', () => {
  assert.equal(technologyExamples({flight: {...journey, durationMinutes: 241}}).flexibility.offer, null);
  assert.equal(technologyExamples({people: []}).flexibility.offer, null);
  assert.equal(technologyExamples({seatNow: journey.changesClose}).flexibility.offer, null);
});

test('the request visual cannot invent inventory, consent or affordable completion', () => {
  assert.equal(technologyExamples({terms: {...requestTerms, quotedCredits: 359}}).request.arrangement, null);
  assert.equal(technologyExamples({balance: 359}).request.arrangement, null);
  assert.equal(technologyExamples({requestNow: requestTerms.validUntil}).request.arrangement, null);
  assert.equal(technologyExamples({catalog: services.filter(service => service.kind !== 'extra-bag')}).request.arrangement, null);
  assert.equal(technologyExamples({catalog: services.map(service => ({...service, supplierConfirmed: false}))}).request.arrangement, null);
});

test('the platform quote stays separate from natural language and publication expiry', () => {
  const terms = {...requestTerms, validUntil: '2026-10-31T09:00:00+08:00'};
  const {request: example} = technologyExamples({terms});
  assert.equal(example.rules.some(rule => rule.id === 'limit'), false);
  assert.equal(example.terms.quotedCredits, requestQuote.quotedCredits);
  assert.equal(example.words.includes('credits'), false);
  assert.equal(example.words.includes('31 Oct'), false);
  assert.equal(example.arrangement.total, 360);
  assert.deepEqual(example.quote, requestQuote);
  assert.equal(expiryLabel(terms.validUntil), '31 Oct, 09:00 HKT');
});

test('the explanation resolves account entities and concrete conditions without adding a user budget', () => {
  const {request: example} = technologyExamples();
  assert.deepEqual(example.structured.entities, {
    journeyId: tokyoFlight.id, partyId: bookedParty.id, travellerId: request.travellerId,
    companionIds: request.companionIds, partySize: bookedParty.travellers.length,
  });
  assert.deepEqual(example.structured.conditions, {seating: request.seating, baggage: request.baggage});
  assert.equal(example.rules.find(rule => rule.id === 'journey').value.includes(tokyoFlight.number), true);
  assert.equal(example.rules.find(rule => rule.id === 'party').value.includes('Mia'), true);
  assert.equal(Object.hasOwn(example.structured.conditions, 'maxCredits'), false);
});

test('rendering the technology model never changes the experience fixtures', () => {
  const source = {preferences, journey, otherTravellers, requestTerms, requestQuote, tokyoFlight, bookedParty, services, timeline};
  const before = JSON.stringify(source);
  technologyExamples();
  assert.equal(JSON.stringify(source), before);
});
