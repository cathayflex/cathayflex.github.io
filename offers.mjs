// Reviewed interpretations used by this authored product illustration.
// The public site does not call a language model or an airline booking API.
export const preferenceWords = 'On short flights, any seat is fine. On long flights, I’d like an aisle.';
export const needWords = 'I need extra baggage for Tokyo next month. Can I use my credits?';
export const preferences = { short: { preferred: [] }, long: { preferred: ['aisle'] } };
export const journey = { id: 'hong-kong-taipei', category: 'short', seat: { id: 'your-aisle', type: 'aisle' } };
export const otherTravellers = [
  { name: 'Alex', journeyId: journey.id, seat: { id: 'alex-window', type: 'window' }, wants: 'aisle', agreed: true }
];
export const request = { journeyId: 'tokyo-next-month', destination: 'Tokyo', service: 'baggage', payment: 'credits' };
export const services = [
  { id: 'taipei-bag', journeyId: journey.id, type: 'baggage', available: true, creditPrice: 150 },
  { id: 'tokyo-seat', journeyId: request.journeyId, type: 'seat', available: true, creditPrice: 100 },
  { id: 'tokyo-bag', journeyId: request.journeyId, type: 'baggage', available: true, creditPrice: 200 }
];
export const reward = 300;

export function seatPreferenceScore(profile, category, seatType) {
  return profile[category]?.preferred.includes(seatType) ? 1 : 0;
}
export function findSeatOffer(profile = preferences, flight = journey, people = otherTravellers) {
  if (!profile[flight.category]) return null;
  const currentFit = seatPreferenceScore(profile, flight.category, flight.seat.type);
  const person = people.filter(candidate => candidate.journeyId === flight.id
    && candidate.agreed && candidate.seat.id !== flight.seat.id
    && candidate.wants === flight.seat.type
    // Only offer a change that preserves or improves the preference already met.
    // A nonpreferred seat remains eligible when it does not worsen that fit.
    && seatPreferenceScore(profile, flight.category, candidate.seat.type) >= currentFit)
    .sort((a, b) => seatPreferenceScore(profile, flight.category, b.seat.type)
      - seatPreferenceScore(profile, flight.category, a.seat.type))[0];
  return person ? { traveller: person.name, before: flight.seat, after: person.seat, reward } : null;
}
export function findServiceOffer(need, balance, catalog = services) {
  if (need.payment !== 'credits') return null;
  return catalog.filter(service => service.journeyId === need.journeyId && service.type === need.service
    && service.available && Number.isFinite(service.creditPrice) && service.creditPrice > 0
    && service.creditPrice <= balance).sort((a, b) => a.creditPrice - b.creditPrice)[0] ?? null;
}
export function initialState() { return { stage: 'preferences', balance: 0 }; }
export function matchSeats(state) {
  if (state.stage !== 'preferences') return state;
  const offer = findSeatOffer();
  return offer ? { ...state, stage: 'seat-offer', offer } : state;
}
export function accept(state) {
  return state.stage === 'seat-offer' && state.offer
    ? { ...state, stage: 'earned', balance: state.offer.reward } : state;
}
export function openRequest(state) {
  return state.stage === 'earned' ? { ...state, stage: 'request' } : state;
}
export function matchServices(state) {
  if (state.stage !== 'request') return state;
  const service = findServiceOffer(request, state.balance);
  return service ? { ...state, stage: 'service-offer', service } : state;
}
export function redeem(state) {
  return state.stage === 'service-offer' && state.service && state.balance >= state.service.creditPrice
    ? { ...state, stage: 'complete', balance: state.balance - state.service.creditPrice } : state;
}
