// An authored product illustration with a fixed clock. No live model, booking
// integration or actual credit account is connected to this public page.
export const timeline = {
  start: '2026-10-05T08:00:00+08:00',
  nextTripRequest: '2026-10-19T08:00:00+08:00',
  requestExpiry: '2026-11-01T09:00:00+08:00',
};
export const preferenceWords = 'On flights up to four hours, any seat is fine. On longer flights, I need an aisle.';
export const needWords = 'For Tokyo, I’d like us to sit together and take one extra checked bag. Use up to 360 Flex credits.';
export const preferences = [
  { maximumMinutes: 240, positions: ['aisle', 'middle', 'window'] },
  { minimumMinutesExclusive: 240, positions: ['aisle'] },
];
export const journey = {
  id: 'hong-kong-taipei', durationMinutes: 105,
  changesClose: '2026-10-07T08:00:00+08:00',
  seat: { id: '22C', type: 'aisle' },
};
export const otherTravellers = [{
  journeyId: journey.id, seat: { id: '22A', type: 'window' },
  authorization: { position: 'aisle', maxCredits: 0, validUntil: journey.changesClose },
}];
export const reward = 400;
export const request = {
  journeyId: 'tokyo-next-month', services: ['seats-together', 'extra-bag'],
  partyId: 'family-booking', companionSeats: ['32A', '32B'],
};
export const requestTerms = { maxCredits: 360, validUntil: timeline.requestExpiry, allowPartial: false };
export const services = [
  { id: 'tokyo-family-row', journeyId: request.journeyId, kind: 'seats-together', partyId: request.partyId,
    seats: ['32A', '32B', '32C'], travellerSeat: '32C', creditPrice: 160,
    available: true, supplierConfirmed: true, changesClose: '2026-11-02T08:00:00+08:00' },
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
    && person.authorization.maxCredits >= 0
    && time(now) < time(person.authorization.validUntil)
    && seatAllowed(profile, flight.durationMinutes, person.seat.type));
  return match ? { id: 'taipei-seat-change', before: {...flight.seat}, after: {...match.seat}, reward } : null;
}
export function findRequestArrangement(need, balance, terms, now = timeline.nextTripRequest, catalog = services) {
  const clock = time(now), expires = time(terms.validUntil);
  if (!Number.isFinite(clock) || !Number.isFinite(expires) || expires <= clock
    || !Number.isInteger(terms.maxCredits) || terms.maxCredits < 0 || terms.maxCredits > balance
    || terms.allowPartial !== false || !need.services.length) return null;
  const matches = need.services.map(kind => catalog.find(service =>
    service.kind === kind && service.journeyId === need.journeyId && service.available
    && Number.isInteger(service.creditPrice) && service.creditPrice >= 0
    && expires <= time(service.changesClose)
    && (kind !== 'seats-together' || (service.supplierConfirmed && service.partyId === need.partyId
      && need.companionSeats.every(seat => service.seats.includes(seat))))
    && (kind !== 'extra-bag' || (service.source === 'airline' && service.pieces === 1))));
  if (matches.some(service => !service)) return null;
  const total = matches.reduce((sum, service) => sum + service.creditPrice, 0);
  if (total > terms.maxCredits || total > balance) return null;
  return { services: matches.map(service => ({...service})), total };
}
export function initialState() {
  return { stage: 'offer', balance: 0, seat: journey.seat.id,
    offer: findSeatOffer(), futureSeat: '34C', extraBags: 0, ledger: [] };
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
export function publishRequest(state, terms = requestTerms, now = timeline.nextTripRequest, catalog = services) {
  if (state.stage !== 'request') return state;
  const arrangement = findRequestArrangement(request, state.balance, terms, now, catalog);
  if (!arrangement) return state;
  const seat = arrangement.services.find(service => service.kind === 'seats-together');
  const bag = arrangement.services.find(service => service.kind === 'extra-bag');
  return { ...state, stage: 'complete', balance: state.balance - arrangement.total,
    authorization: {...terms, authorizedAt: now}, futureSeat: seat.travellerSeat,
    familySeats: [...seat.seats], extraBags: bag.pieces, bagMaxKg: bag.maxKg,
    spent: arrangement.total,
    ledger: [...state.ledger, {id: 'tokyo-arrangement', kind: 'used', amount: arrangement.total}] };
}
