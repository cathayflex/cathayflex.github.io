import {
  preferenceWords, needWords, preferences, journey, otherTravellers,
  request, requestTerms, services, reward, timeline,
  findSeatOffer, findRequestArrangement,
} from './offers.mjs';

// The extracts are authored explanations of the shared examples, not a parser
// or a model response. Eligibility still comes from the actual example matcher.
export function technologyExamples(overrides = {}) {
  const profile = overrides.profile ?? preferences;
  const flight = overrides.flight ?? journey;
  const people = overrides.people ?? otherTravellers;
  const terms = overrides.terms ?? requestTerms;
  const catalog = overrides.catalog ?? services;
  const balance = overrides.balance ?? reward;
  return {
    flexibility: {
      words: preferenceWords,
      clauses: preferenceWords.match(/[^.!?]+[.!?]+/g).map(text => text.trim()),
      rules: profile.map((rule, index) => ({
        id: `seat-${index}`,
        label: rule.maximumMinutes !== undefined
          ? `Up to ${rule.maximumMinutes / 60} hours`
          : `Over ${rule.minimumMinutesExclusive / 60} hours`,
        value: rule.positions.length === 3 ? 'Any seat' : `${rule.positions.map(capitalize).join(' or ')} required`,
      })),
      flight,
      offer: findSeatOffer(profile, flight, people, overrides.seatNow ?? timeline.start),
    },
    request: {
      words: needWords,
      clauses: needWords.match(/[^.!?]+[.!?]+/g).map(text => text.trim()),
      rules: [
        {id: 'journey', label: 'Journey', value: 'Tokyo'},
        {id: 'seats', label: 'Seating', value: 'Together with booked companions'},
        {id: 'bag', label: 'Baggage', value: '1 extra checked bag'},
        {id: 'limit', label: 'Credit limit', value: `${requestTerms.maxCredits} Flex credits`},
      ],
      terms: {...terms},
      arrangement: findRequestArrangement(request, balance, terms, overrides.requestNow ?? timeline.nextTripRequest, catalog),
    },
  };
}

export function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

export function durationLabel(minutes) {
  const hours = Math.floor(minutes / 60), remaining = minutes % 60;
  return [hours ? `${hours} h` : '', remaining ? `${remaining} min` : ''].filter(Boolean).join(' ');
}

export function expiryLabel(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Invalid expiry';
  const day = new Intl.DateTimeFormat('en-GB', {timeZone: 'Asia/Hong_Kong', day: 'numeric', month: 'short'}).format(date);
  const time = new Intl.DateTimeFormat('en-GB', {timeZone: 'Asia/Hong_Kong', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'}).format(date);
  return `${day}, ${time} HKT`;
}
