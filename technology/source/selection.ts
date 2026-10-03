import type { Candidate, State } from "./types.ts";

export type Objective = readonly number[];
export type SelectionOptions = {
  nodeLimit?: number;
  /** Unreserved wallet funds. Request earmarks remain separate capacity pools. */
  availableCredits?: Record<string, number>;
  creditEarmarks?: Record<string, { person: string; amount: number }>;
  candidateCreditEarmarks?: Record<string, Record<string, string>>;
  scoreCandidate?: (candidate: Candidate) => Objective;
};
const active = (status: string) =>
  ["HELD", "ACCEPTED", "AWAITING_EVIDENCE", "RECONCILING"].includes(status);
const order = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
export function compareObjectives(a: Objective, b: Objective): number {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] > b[i] ? 1 : -1;
  }
  return 0;
}
export function stressNetValue(s: State, c: Candidate): number {
  const rate = c.budget === "recovery"
    ? s.economics.stressCost
    : s.budgets.find((budget) => budget.id === c.budget)?.stressCost || 0;
  return c.value - c.cost - c.risk - c.issuance * rate;
}
export function netValueMinorUnits(value: number): number {
  const scaled = value * 100;
  const rounded = Math.round(scaled);
  return Number.isSafeInteger(rounded) && Math.abs(scaled - rounded) < 0.000001 ? rounded : NaN;
}
type StateIndex = {
  allocations: Map<string, State["allocations"][number]>;
  resources: Map<string, State["resources"][number]>;
};
const indexState = (s: State): StateIndex => ({
  allocations: new Map(s.allocations.map((a) => [a.key, a])),
  resources: new Map(s.resources.map((r) => [r.id, r])),
});
function scopes(index: StateIndex, c: Candidate): Set<string> {
  const result = new Set<string>();
  for (const change of c.changes) {
    const allocation = index.allocations.get(change.key);
    if (!allocation) continue;
    const journeys = new Set([
      allocation.journeyId,
      ...[change.from, change.to].map((id) => id ? index.resources.get(id)?.journey : undefined),
    ].filter((id): id is string => !!id));
    for (const journey of journeys) result.add(`${allocation.person}\0${journey}`);
  }
  return result;
}
type Footprint = {
  id: string; event?: string; scopes: Set<string>; writes: Set<string>;
  reads: Map<string, Candidate["dependencies"][number]>; seats: Set<string>;
};
function footprint(index: StateIndex, c: Candidate): Footprint {
  return {id: c.id, event: c.event, scopes: scopes(index, c), writes: new Set(c.changes.map((change) => change.key)),
    reads: new Map(c.dependencies.map((read) => [read.key, read])), seats: new Set(c.changes.flatMap((change) =>
      [change.from, change.to].filter((id): id is string => !!id && index.resources.get(id)?.kind === "seat")))};
}
function footprintsConflict(a: Footprint, b: Footprint): boolean {
  if (a.id === b.id || (a.event && a.event === b.event)) return true;
  if ([...a.scopes].some((scope) => b.scopes.has(scope))) return true;
  if ([...a.writes].some((key) => b.writes.has(key) || b.reads.has(key))
    || [...b.writes].some((key) => a.reads.has(key))) return true;
  for (const [key, read] of a.reads) {
    const other = b.reads.get(key);
    if (other && (other.from !== read.from || other.to !== read.to || other.version !== read.version)) return true;
  }
  return [...a.seats].some((seat) => b.seats.has(seat));
}
/** Shared reads may coexist. Writes, physical seats and reward events are exclusive. */
export function candidatePlansConflict(s: State, a: Candidate, b: Candidate): boolean {
  const index = indexState(s);
  return footprintsConflict(footprint(index, a), footprint(index, b));
}
/** Incremental capacity must be reserved without relying on a different contract releasing inventory. */
export function candidateCapacityDemand(c: Candidate): Map<string, number> {
  const delta = new Map<string, number>();
  for (const change of c.changes) {
    if (change.from) delta.set(change.from, (delta.get(change.from) || 0) - 1);
    if (change.to) delta.set(change.to, (delta.get(change.to) || 0) + 1);
  }
  return new Map([...delta].filter(([, amount]) => amount > 0));
}
export function outstandingCapacityDemand(s: State, c: Candidate): Map<string, number> {
  return candidateCapacityDemand({...c, changes: c.changes.map((change) => ({...change,
    from: s.allocations.find((allocation) => allocation.key === change.key)?.resource ?? null,
  }))});
}
function snapshotErrors(s: State, c: Candidate): string[] {
  const errors: string[] = [];
  const keys = c.changes.map((change) => change.key);
  if (new Set(keys).size !== keys.length) errors.push("duplicate_change");
  if (c.dependencies.some((read) => keys.includes(read.key) || read.from !== read.to)) errors.push("invalid_dependency");
  for (const change of [...c.changes, ...c.dependencies]) {
    const allocation = s.allocations.find((a) => a.key === change.key);
    if (!allocation || allocation.resource !== change.from || allocation.version !== change.version) errors.push("stale_allocation");
    if (change.to && !s.resources.some((resource) => resource.id === change.to)) errors.push("missing_resource");
  }
  if (!Number.isFinite(c.issuance) || c.issuance < 0 || !Object.values(c.credits).every(Number.isFinite)) errors.push("invalid_amount");
  if (c.issuance && !c.budget) errors.push("unfunded_issuance");
  return [...new Set(errors)];
}
type Entry = { candidate: Candidate; score: number[]; demand: Map<string, number>; footprint: Footprint };
type Node = { remaining: number[]; chosen: number[]; score: number[]; used: Map<string, number>; upper: number[] };

/**
 * Select independently reservable, individually validated complete arrangements.
 * Prices are fixed coefficients. They are never inferred from passenger utility.
 * Exactness and bounds apply only to the supplied candidate set and score policy.
 */
export function solveCandidateSelection(s: State, candidates: Candidate[], options: SelectionOptions = {}) {
  const score = options.scoreCandidate || ((c: Candidate) => [c.gain, netValueMinorUnits(stressNetValue(s, c)), -c.issuance]);
  const requestedLimit = options.nodeLimit ?? 20000;
  const nodeLimit = Number.isFinite(requestedLimit)
    ? Math.max(1, Math.min(1000000, Math.floor(requestedLimit))) : 20000;
  const capacity = new Map<string, number>();
  const heldContracts = s.contracts.filter((contract) => active(contract.status));
  for (const resource of s.resources) {
    const occupied = s.allocations.filter((a) => a.resource === resource.id).length + resource.background;
    const held = heldContracts.reduce((sum, c) => sum + (outstandingCapacityDemand(s, c).get(resource.id) || 0), 0);
    capacity.set(`resource:${resource.id}`, Math.max(0, resource.capacity - resource.protected - occupied - held));
  }
  for (const [person, balance] of Object.entries(s.wallets)) {
    const held = heldContracts.reduce((sum, c) => sum + Math.max(0, -(c.credits[person] || 0)), 0);
    capacity.set(`wallet:${person}`, Math.max(0, balance - held));
    capacity.set(`free-wallet:${person}`, Math.max(0, options.availableCredits?.[person] ?? balance - held));
  }
  for (const [id, earmark] of Object.entries(options.creditEarmarks || {})) {
    if (!Number.isSafeInteger(earmark.amount) || earmark.amount < 0 || !(earmark.person in s.wallets)) {
      throw new RangeError("Credit earmarks require a known wallet and a nonnegative integer amount.");
    }
    capacity.set(`earmark:${id}`, earmark.amount);
  }
  for (const budget of s.budgets) {
    const held = heldContracts.filter((c) => c.budget === budget.id).reduce((sum, c) => sum + c.issuance, 0);
    capacity.set(`budget:${budget.id}`, Math.max(0, budget.limit - budget.issued - held));
  }
  const rejected: { id: string; reasons: string[] }[] = [];
  const stateIndex = indexState(s);
  let dimensions = 0;
  const ids = new Set<string>();
  const entries: Entry[] = [];
  for (const candidate of [...candidates].sort((a, b) => order(a.id, b.id))) {
    const reasons = snapshotErrors(s, candidate);
    const objective = [...score(candidate)];
    if (!dimensions) dimensions = objective.length;
    if (!objective.length || objective.length !== dimensions || !objective.every(Number.isSafeInteger)) reasons.push("invalid_objective");
    if (ids.has(candidate.id)) reasons.push("duplicate_candidate_id");
    ids.add(candidate.id);
    if (heldContracts.some((contract) => candidatePlansConflict(s, candidate, contract))) reasons.push("active_contract_conflict");
    const demand = new Map([...candidateCapacityDemand(candidate)].map(([id, amount]) => [`resource:${id}`, amount]));
    for (const [person, credits] of Object.entries(candidate.credits)) {
      if (credits >= 0) continue;
      const debit = -credits;
      const earmarkId = options.candidateCreditEarmarks?.[candidate.id]?.[person];
      const earmark = earmarkId === undefined ? undefined : options.creditEarmarks?.[earmarkId];
      if (earmarkId !== undefined && (!earmark || earmark.person !== person)) reasons.push("invalid_credit_earmark");
      const funded = earmark?.person === person ? Math.min(debit, earmark.amount) : 0;
      demand.set(`wallet:${person}`, debit);
      demand.set(`free-wallet:${person}`, debit - funded);
      if (funded) demand.set(`earmark:${earmarkId}`, funded);
    }
    if (candidate.issuance) demand.set(`budget:${candidate.budget}`, candidate.issuance);
    if ([...demand].some(([key, amount]) => amount > (capacity.get(key) ?? 0))) reasons.push("insufficient_reservation_capacity");
    if (reasons.length) rejected.push({id: candidate.id, reasons: [...new Set(reasons)]});
    else entries.push({candidate, score: objective, demand, footprint: footprint(stateIndex, candidate)});
  }
  dimensions ||= 3;
  for (let dimension = 0; dimension < dimensions; dimension++) {
    if (!Number.isSafeInteger(entries.reduce((sum, entry) => sum + Math.abs(entry.score[dimension]), 0))) {
      throw new RangeError("The objective sum exceeds exact integer arithmetic.");
    }
  }
  const zero = () => Array<number>(dimensions).fill(0);
  entries.sort((a, b) => compareObjectives(b.score, a.score) || order(a.candidate.id, b.candidate.id));
  const conflict = entries.map((a, i) => entries.map((b, j) => i === j || footprintsConflict(a.footprint, b.footprint)));
  const fits = (i: number, used: Map<string, number>) => [...entries[i].demand]
    .every(([key, amount]) => (used.get(key) || 0) + amount <= (capacity.get(key) ?? 0));
  const consume = (i: number, used: Map<string, number>) => {
    const next = new Map(used);
    for (const [key, amount] of entries[i].demand) next.set(key, (next.get(key) || 0) + amount);
    return next;
  };
  const plus = (a: number[], b: number[]) => a.map((value, index) => value + b[index]);
  // Partition into conflict cliques. At most one candidate per clique can be
  // selected. Componentwise maxima remain an admissible lexicographic bound.
  const upperBound = (remaining: number[], current: number[]) => {
    const cliques: number[][] = [];
    for (const i of remaining) {
      const clique = cliques.find((members) => members.every((j) => conflict[i][j]));
      if (clique) clique.push(i); else cliques.push([i]);
    }
    return current.map((value, dimension) => value + cliques.reduce((sum, clique) =>
      sum + Math.max(0, ...clique.map((i) => entries[i].score[dimension])), 0));
  };
  let chosen: number[] = [], objective = zero(), greedyUsed = new Map<string, number>();
  for (let i = 0; i < entries.length; i++) {
    if (compareObjectives(entries[i].score, zero()) <= 0 || chosen.some((j) => conflict[i][j]) || !fits(i, greedyUsed)) continue;
    chosen.push(i);
    objective = plus(objective, entries[i].score);
    greedyUsed = consume(i, greedyUsed);
  }
  const all = entries.map((_, index) => index);
  const stack: Node[] = [{remaining: all, chosen: [], score: zero(), used: new Map(), upper: upperBound(all, zero())}];
  let visited = 0;
  while (stack.length && visited < nodeLimit) {
    const node = stack.pop()!;
    visited++;
    if (compareObjectives(node.upper, objective) <= 0) continue;
    if (compareObjectives(node.score, objective) > 0) { objective = node.score; chosen = node.chosen; }
    if (!node.remaining.length) continue;
    const [first, ...rest] = node.remaining;
    const excludedUpper = upperBound(rest, node.score);
    if (compareObjectives(excludedUpper, objective) > 0) stack.push({...node, remaining: rest, upper: excludedUpper});
    if (fits(first, node.used)) {
      const includedScore = plus(node.score, entries[first].score);
      if (compareObjectives(includedScore, objective) > 0) { objective = includedScore; chosen = [...node.chosen, first]; }
      const remaining = rest.filter((i) => !conflict[first][i]);
      const upper = upperBound(remaining, includedScore);
      if (compareObjectives(upper, objective) > 0) stack.push({remaining, chosen: [...node.chosen, first], score: includedScore, used: consume(first, node.used), upper});
    }
  }
  // A frontier node remains a valid upper bound even if its incumbent improved.
  const frontier = stack.filter((node) => compareObjectives(node.upper, objective) > 0);
  const bound = frontier.reduce((best, node) => compareObjectives(node.upper, best) > 0 ? node.upper : best, [...objective]);
  const complete = frontier.length === 0;
  const firstUnresolvedTier = complete ? null : bound.findIndex((value, index) => value !== objective[index]);
  return {
    selected: chosen.map((i) => entries[i].candidate.id).sort(order),
    objective, upperBound: bound, complete, visited, nodeLimit,
    status: complete ? "OPTIMAL_WITHIN_SUPPLIED_CANDIDATES" as const : "FEASIBLE_NODE_LIMIT" as const,
    firstUnresolvedTier,
    absoluteGapAtFirstUnresolvedTier: firstUnresolvedTier === null ? 0 : bound[firstUnresolvedTier] - objective[firstUnresolvedTier],
    candidateCount: entries.length, rejected,
    reservationPolicy: "independent_contracts_no_cross_contract_release_credit" as const,
    objectivePolicy: options.scoreCandidate ? "caller_supplied_integer_lexicographic" as const : "model_gain_then_stress_net_minor_units_then_negative_issuance" as const,
  };
}
