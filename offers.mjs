// An authored product illustration with a fixed clock. No live model, booking
// integration or actual credit account is connected to this public page.
export const timeline = {
  start: '2026-10-05T08:00:00+08:00',
  nextTripRequest: '2026-10-19T08:00:00+08:00',
  requestMatched: '2026-10-19T08:12:00+08:00',
  requestExpiry: '2026-11-01T09:00:00+08:00',
};
export const preferenceWords = 'On flights up to four hours, any seat is fine. On longer flights, I need an aisle.';
export const needWords = 'For Tokyo, I’d like us to sit together and take one extra checked bag.';
export const preferences = [
  { maximumMinutes: 240, positions: ['aisle', 'middle', 'window'] },
  { minimumMinutesExclusive: 240, positions: ['aisle'] },
];
export const journey = {
  id: 'hong-kong-taipei', durationMinutes: 105,
  changesClose: '2026-10-07T08:00:00+08:00',
  seat: { id: '22C', type: 'aisle' },
};
export const reward = 400;
export const otherTravellers = [{
  journeyId: journey.id, seat: { id: '22A', type: 'window' },
  authorization: { position: 'aisle', quotedCredits: reward, validUntil: journey.changesClose },
}];
export const accountTravellerId = 'traveller-you';
// A synthetic account booking resolves the authored request to a specific
// flight and its booked companions. These are not live flight records.
export const tokyoFlight = {
  id: 'hong-kong-tokyo-2026-11-02', number: 'CX520',
  origin: 'HKG', destination: 'NRT', destinationName: 'Tokyo',
  departure: '2026-11-02T10:30:00+08:00', durationMinutes: 255,
  changesClose: '2026-11-02T08:00:00+08:00',
};
export const bookedParty = {
  id: 'booking-tokyo-family', journeyId: tokyoFlight.id,
  travellers: [
    { id: accountTravellerId, name: 'You', seatId: '34C' },
    { id: 'traveller-mia', name: 'Mia', seatId: '32A' },
    { id: 'traveller-jamie', name: 'Jamie', seatId: '32B' },
  ],
};
export const request = {
  journeyId: tokyoFlight.id, services: ['seats-together', 'extra-bag'],
  partyId: bookedParty.id, travellerId: accountTravellerId,
  companionIds: ['traveller-mia', 'traveller-jamie'], companionSeats: ['32A', '32B'],
  seating: { relation: 'adjacent', sameRow: true, sameBlock: true },
  baggage: { pieces: 1, maxKg: 23 },
};
// The platform supplies a fixed quote after interpreting the request. Its
// credit amount is not part of the traveller's natural language preferences.
export const requestQuote = {
  id: 'quote-tokyo-family-bag', journeyId: request.journeyId, partyId: request.partyId,
  items: [{ kind: 'seats-together', credits: 160 }, { kind: 'extra-bag', credits: 200 }],
  quotedCredits: 360, validUntil: timeline.requestExpiry,
};
export const requestTerms = {
  quoteId: requestQuote.id, quotedCredits: requestQuote.quotedCredits,
  validUntil: timeline.requestExpiry, allowPartial: false,
};
export const services = [
  { id: 'tokyo-family-row', journeyId: request.journeyId, kind: 'seats-together', partyId: request.partyId,
    seats: ['32A', '32B', '32C'], travellerSeat: '32C', creditPrice: 160,
    seatPositions: [
      { id: '32A', row: 32, block: 'ABC', position: 0 },
      { id: '32B', row: 32, block: 'ABC', position: 1 },
      { id: '32C', row: 32, block: 'ABC', position: 2 },
    ],
    assignments: [
      { travellerId: 'traveller-mia', seatId: '32A' },
      { travellerId: 'traveller-jamie', seatId: '32B' },
      { travellerId: accountTravellerId, seatId: '32C' },
    ],
    available: true, supplierConfirmed: true, changesClose: tokyoFlight.changesClose },
  { id: 'tokyo-extra-bag', journeyId: request.journeyId, kind: 'extra-bag', pieces: 1, maxKg: 23,
    source: 'airline', creditPrice: 200, available: true, changesClose: '2026-11-01T10:00:00+08:00' },
];
const time = value => Date.parse(value);
export function seatAllowed(profile, durationMinutes, position) {
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) return false;
  const applicable = profile.filter(rule =>
    (rule.maximumMinutes === undefined || durationMinutes <= rule.maximumMinutes)
    && (rule.minimumMinutesExclusive === undefined || durationMinutes > rule.minimumMinutesExclusive));
  return applicable.length > 0 && applicable.every(rule => rule.positions.includes(position));
}
export function findSeatOffer(profile = preferences, flight = journey, people = otherTravellers, now = timeline.start) {
  if (!Number.isFinite(time(now)) || time(now) >= time(flight.changesClose)) return null;
  const match = people.find(person => person.journeyId === flight.id
    && person.seat.id !== flight.seat.id
    && person.authorization?.position === flight.seat.type
    && Number.isSafeInteger(person.authorization.quotedCredits) && person.authorization.quotedCredits >= 0
    && time(now) < time(person.authorization.validUntil)
    && seatAllowed(profile, flight.durationMinutes, person.seat.type));
  return match ? { id: 'taipei-seat-change', before: {...flight.seat}, after: {...match.seat}, reward: match.authorization.quotedCredits } : null;
}
function sameMembers(actual, expected) {
  return Array.isArray(actual) && actual.length === expected.length
    && new Set(actual).size === actual.length && expected.every(value => actual.includes(value));
}
function resolvesToBooking(need) {
  const companions = bookedParty.travellers.filter(person => person.id !== accountTravellerId);
  return need?.journeyId === tokyoFlight.id && need.partyId === bookedParty.id
    && need.travellerId === accountTravellerId
    && sameMembers(need.companionIds, companions.map(person => person.id))
    && sameMembers(need.companionSeats, companions.map(person => person.seatId))
    && sameMembers(need.services, requestQuote.items.map(item => item.kind))
    && need.seating?.relation === 'adjacent' && need.seating.sameRow === true && need.seating.sameBlock === true
    && need.baggage?.pieces === 1 && need.baggage.maxKg === 23;
}
function quoteIsValid(need, balance, terms, now) {
  const clock = time(now), expires = time(terms?.validUntil);
  return resolvesToBooking(need) && Number.isFinite(clock) && Number.isFinite(expires) && expires > clock
    && need.journeyId === requestQuote.journeyId && need.partyId === requestQuote.partyId
    && expires <= time(requestQuote.validUntil) && expires <= time(tokyoFlight.changesClose)
    && terms?.quoteId === requestQuote.id && terms.quotedCredits === requestQuote.quotedCredits
    && Number.isInteger(terms.quotedCredits) && terms.quotedCredits >= 0
    && Number.isInteger(balance) && balance >= terms.quotedCredits && terms.allowPartial === false;
}
function seatsMeetRequest(service, need) {
  const members = [need.travellerId, ...need.companionIds];
  const positions = service.seatPositions;
  const assignments = service.assignments;
  if (!service.supplierConfirmed || service.partyId !== need.partyId
    || !Array.isArray(positions) || !Array.isArray(assignments)
    || !sameMembers(service.seats, positions.map(seat => seat.id))
    || !sameMembers(assignments.map(item => item.travellerId), members)
    || !sameMembers(assignments.map(item => item.seatId), service.seats)
    || !need.companionSeats.every(seat => service.seats.includes(seat))) return false;
  if (assignments.find(item => item.travellerId === need.travellerId)?.seatId !== service.travellerSeat) return false;
  const order = [...positions].sort((a, b) => a.position - b.position);
  return order.length === members.length && order.every((seat, index) =>
    Number.isInteger(seat.row) && seat.row > 0 && seat.row === order[0].row
    && typeof seat.block === 'string' && seat.block.length > 0 && seat.block === order[0].block
    && Number.isInteger(seat.position) && seat.position >= 0
    && (index === 0 || seat.position === order[index - 1].position + 1));
}
export function findRequestArrangement(need, balance, terms, now = timeline.nextTripRequest, catalog = services) {
  if (!quoteIsValid(need, balance, terms, now)) return null;
  const expires = time(terms.validUntil);
  const matches = need.services.map(kind => catalog.find(service =>
    service.kind === kind && service.journeyId === need.journeyId && service.available
    && service.creditPrice === requestQuote.items.find(item => item.kind === kind).credits
    && expires <= time(service.changesClose)
    && (kind !== 'seats-together' || seatsMeetRequest(service, need))
    && (kind !== 'extra-bag' || (service.source === 'airline'
      && service.pieces === need.baggage.pieces && service.maxKg === need.baggage.maxKg))));
  if (matches.some(service => !service)) return null;
  const total = matches.reduce((sum, service) => sum + service.creditPrice, 0);
  if (total !== terms.quotedCredits || total > balance) return null;
  return { services: structuredClone(matches), total, quoteId: terms.quoteId };
}
export function initialState() {
  return { stage: 'offer', balance: 0, creditHold: 0, seat: journey.seat.id,
    offer: findSeatOffer(), futureSeat: bookedParty.travellers.find(person => person.id === accountTravellerId).seatId,
    extraBags: 0, ledger: [] };
}
export function accept(state, now = timeline.start) {
  const offer = findSeatOffer(preferences, journey, otherTravellers, now);
  if (state.stage !== 'offer' || !offer || state.offer?.id !== offer.id) return state;
  return { ...state, stage: 'earned', seat: offer.after.id, balance: state.balance + offer.reward,
    ledger: [...state.ledger, { id: offer.id, kind: 'earned', amount: offer.reward }] };
}
export function openRequest(state) {
  return state.stage === 'earned' ? {...state, stage: 'request'} : state;
}
export function spendableCredits(state) {
  return Math.max(0, state.balance - state.creditHold);
}
export function publishRequest(state, terms = requestTerms, now = timeline.nextTripRequest) {
  if (state.stage !== 'request' || state.creditHold !== 0
    || !quoteIsValid(request, spendableCredits(state), terms, now)) return state;
  return { ...state, stage: 'published', creditHold: terms.quotedCredits,
    authorization: { ...terms, authorizedAt: now } };
}
export function expirePublishedRequest(state, now) {
  if (state.stage !== 'published' || !Number.isFinite(time(now))
    || time(now) < time(state.authorization.validUntil)) return state;
  return { ...state, stage: 'expired', creditHold: 0 };
}
// The public illustration shows a later eligible match. Publication by itself
// never guarantees inventory, changes a booking or deducts the quoted credits.
export function settlePublishedRequest(state, now = timeline.requestMatched, catalog = services) {
  if (state.stage !== 'published') return state;
  if (time(now) < time(state.authorization.authorizedAt)) return state;
  const expired = expirePublishedRequest(state, now);
  if (expired !== state) return expired;
  if (state.creditHold !== state.authorization.quotedCredits) return state;
  const arrangement = findRequestArrangement(request, state.balance, state.authorization, now, catalog);
  if (!arrangement) return state;
  const seat = arrangement.services.find(service => service.kind === 'seats-together');
  const bag = arrangement.services.find(service => service.kind === 'extra-bag');
  return { ...state, stage: 'complete', balance: state.balance - arrangement.total, creditHold: 0,
    settledAt: now, futureSeat: seat.travellerSeat,
    familySeats: [...seat.seats], extraBags: bag.pieces, bagMaxKg: bag.maxKg,
    spent: arrangement.total,
    ledger: [...state.ledger, {id: 'tokyo-arrangement', kind: 'used', amount: arrangement.total}] };
}
