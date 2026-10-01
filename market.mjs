export const seats = [
  { id: 'early-window', flight: '10:00', arrival: '11:40', departureMinutes: 600, arrivalMinutes: 700, seat: '22A', type: 'Window' },
  { id: 'later-window', flight: '12:00', arrival: '13:40', departureMinutes: 720, arrivalMinutes: 820, seat: '18A', type: 'Window' },
  { id: 'later-aisle', flight: '12:00', arrival: '13:40', departureMinutes: 720, arrivalMinutes: 820, seat: '18C', type: 'Aisle' }
];

// Reviewed interpretations of the dialogue in this authored product story.
// A live language model is not called by this public, static website.
export const travellers = [
  { id: 'maya', name: 'Maya', initialSeat: 'early-window', reward: 600, message: 'I can fly two hours later, as long as I get an aisle seat.', preference: 'An aisle seat if I fly later.', accepts: seat => seat.departureMinutes <= 720 && (seat.flight === '10:00' || seat.type === 'Aisle') },
  { id: 'alex', name: 'Alex', initialSeat: 'later-window', reward: 0, message: 'My connection has changed. I need to arrive before 13:00.', preference: 'Arrive before 13:00.', accepts: seat => seat.arrivalMinutes < 780 },
  { id: 'sam', name: 'Sam', initialSeat: 'later-aisle', reward: 100, message: 'A window or an aisle is fine. Keep me on the noon flight.', preference: 'Keep the 12:00 flight. Either seat works.', accepts: seat => seat.flight === '12:00' }
];

function permutations(items) {
  if (!items.length) return [[]];
  return items.flatMap((item, index) => permutations(items.filter((_, i) => i !== index)).map(rest => [item, ...rest]));
}

export function evaluateAssignment(assignment, budget = 700) {
  const checks = travellers.map((traveller, index) => ({ traveller: traveller.id, passes: Boolean(assignment[index] && traveller.accepts(assignment[index])) }));
  const uniqueSeats = assignment.length === travellers.length && new Set(assignment.map(seat => seat.id)).size === travellers.length;
  const funded = travellers.reduce((sum, traveller) => sum + traveller.reward, 0) <= budget;
  return { checks, uniqueSeats, funded, valid: checks.every(check => check.passes) && uniqueSeats && funded };
}

export function findExchange(budget = 700) {
  const candidates = permutations(seats).map(assignment => ({ assignment, ...evaluateAssignment(assignment, budget) }));
  return { candidates, matches: candidates.filter(candidate => candidate.valid) };
}

export function settleExchange(accepted, budget = 700) {
  if (!travellers.every(traveller => accepted.includes(traveller.id))) throw new Error('Every traveller must accept before settlement.');
  const match = findExchange(budget).matches[0];
  if (!match) throw new Error('No funded exchange satisfies every condition.');
  return { assignments: Object.fromEntries(travellers.map((traveller, i) => [traveller.id, match.assignment[i]])), balances: Object.fromEntries(travellers.map(traveller => [traveller.id, traveller.reward])), issued: 700 };
}

export function redeem(balance, price) {
  if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(balance) || balance < price) throw new Error('A valid price and sufficient credits are required.');
  return balance - price;
}

export function futureJourneys() {
  const settled = settleExchange(travellers.map(traveller => traveller.id));
  const balances = { ...settled.balances, maya: redeem(settled.balances.maya, 200), sam: redeem(settled.balances.sam, 100) };
  return { ...settled, balances, redeemed: 300, outstanding: Object.values(balances).reduce((sum, value) => sum + value, 0) };
}
