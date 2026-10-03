import {
  preferenceWords, needWords, preferences, journey, otherTravellers,
  request, requestTerms, requestQuote, tokyoFlight, bookedParty, services, reward, timeline,
  findSeatOffer, findRequestArrangement,
} from './offers.mjs?v=20261004-fixed2';

// The phrase links and structured extracts are authored illustrations. This
// module does not parse text or call a model. Both results use the shared matcher.
export function technologyExamples(overrides = {}) {
  const profile = overrides.profile ?? preferences;
  const flight = overrides.flight ?? journey;
  const people = overrides.people ?? otherTravellers;
  const terms = overrides.terms ?? requestTerms;
  const catalog = overrides.catalog ?? services;
  const balance = overrides.balance ?? reward;
  const flexibilityClauses = preferenceWords.match(/[^.!?]+[.!?]+/g).map(text => text.trim());
  return {
    flexibility: {
      words: preferenceWords,
      clauses: flexibilityClauses,
      phrases: flexibilityClauses.map((text, index) => ({text, rules: [`seat-${index}`]})),
      rules: profile.map((rule, index) => ({
        id: `seat-${index}`,
        label: rule.maximumMinutes !== undefined
          ? `Up to ${rule.maximumMinutes / 60} hours`
          : `Over ${rule.minimumMinutesExclusive / 60} hours`,
        value: rule.positions.length === 3 ? 'Any seat' : `${rule.positions.map(capitalize).join(' or ')} required`,
      })),
      structured: {seatPreferences: structuredClone(profile)},
      flight,
      offer: findSeatOffer(profile, flight, people, overrides.seatNow ?? timeline.start),
    },
    request: {
      words: needWords,
      clauses: needWords.match(/[^.!?]+[.!?]+/g).map(text => text.trim()),
      phrases: [
        {text: 'For Tokyo,', rules: ['journey']},
        {text: 'I’d like us to sit together', rules: ['party', 'seats']},
        {text: 'and take one extra checked bag.', rules: ['bag']},
      ],
      rules: [
        {id: 'journey', label: 'Booked flight', value: `${tokyoFlight.number} · ${tokyoFlight.origin} → ${tokyoFlight.destination}`, detail: dateLabel(tokyoFlight.departure)},
        {id: 'party', label: `${bookedParty.travellers.length} travellers on this booking`, value: partyNames(bookedParty.travellers)},
        {id: 'seats', label: 'Seats together', value: 'Same row, consecutive seats', detail: 'No aisle between you'},
        {id: 'bag', label: 'Extra baggage', value: `${request.baggage.pieces} checked bag · Up to ${request.baggage.maxKg} kg`},
      ],
      structured: {
        entities: {
          journeyId: request.journeyId,
          partyId: request.partyId,
          travellerId: request.travellerId,
          companionIds: [...request.companionIds],
          partySize: bookedParty.travellers.length,
        },
        conditions: {
          seating: {...request.seating},
          baggage: {...request.baggage},
        },
      },
      quote: structuredClone(requestQuote),
      terms: {...terms},
      arrangement: findRequestArrangement(request, balance, terms, overrides.requestNow ?? timeline.nextTripRequest, catalog),
    },
  };
}

function partyNames(travellers) {
  const names = travellers.map(traveller => traveller.name);
  return names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

export function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

export function durationLabel(minutes) {
  const hours = Math.floor(minutes / 60), remaining = minutes % 60;
  return [hours ? `${hours} h` : '', remaining ? `${remaining} min` : ''].filter(Boolean).join(' ');
}

export function dateLabel(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Invalid date';
  return new Intl.DateTimeFormat('en-GB', {timeZone: 'Asia/Hong_Kong', day: 'numeric', month: 'short', year: 'numeric'}).format(date);
}

export function expiryLabel(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Invalid expiry';
  const day = new Intl.DateTimeFormat('en-GB', {timeZone: 'Asia/Hong_Kong', day: 'numeric', month: 'short'}).format(date);
  const time = new Intl.DateTimeFormat('en-GB', {timeZone: 'Asia/Hong_Kong', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'}).format(date);
  return `${day}, ${time} HKT`;
}
