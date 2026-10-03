import test from 'node:test';
import assert from 'node:assert/strict';
import {technologyExamples, expiryLabel} from '../technology.mjs';
import {preferences, journey, otherTravellers, requestTerms, services, timeline} from '../offers.mjs';

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
  assert.equal(technologyExamples({terms: {...requestTerms, maxCredits: 359}}).request.arrangement, null);
  assert.equal(technologyExamples({balance: 359}).request.arrangement, null);
  assert.equal(technologyExamples({requestNow: requestTerms.validUntil}).request.arrangement, null);
  assert.equal(technologyExamples({catalog: services.filter(service => service.kind !== 'extra-bag')}).request.arrangement, null);
  assert.equal(technologyExamples({catalog: services.map(service => ({...service, supplierConfirmed: false}))}).request.arrangement, null);
});

test('confirmed publication terms stay separate from the prepared interpretation', () => {
  const terms = {...requestTerms, maxCredits: 380, validUntil: '2026-10-31T09:00:00+08:00'};
  const {request: example} = technologyExamples({terms});
  assert.equal(example.rules.find(rule => rule.id === 'limit').value, '360 Flex credits');
  assert.equal(example.terms.maxCredits, 380);
  assert.equal(example.words.includes('31 Oct'), false);
  assert.equal(expiryLabel(terms.validUntil), '31 Oct, 09:00 HKT');
});

test('rendering the technology model never changes the experience fixtures', () => {
  const source = {preferences, journey, otherTravellers, requestTerms, services, timeline};
  const before = JSON.stringify(source);
  technologyExamples();
  assert.equal(JSON.stringify(source), before);
});
