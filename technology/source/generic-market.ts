import { baggagePlans, baggageRequirementSatisfied } from "./baggage-plans.ts";
import { isExtraBaggage, isExtraBagSlot } from "./baggage.ts";
import type {
  Allocation,
  Candidate,
  Change,
  Resource,
  State,
} from "./types.ts";
import {
  intentContextIssues,
  intentPurpose,
  requestGoalSatisfied,
  rulesFor,
  requestRulesFor,
  conditionalOutcomeDependencies,
} from "./intent.ts";
import { simulationEpoch } from "./time.ts";

type Seating = (
  s: State,
  partyId: string,
  changes?: Change[],
) => { together: boolean; guardiansProtected: boolean; seats: Resource[] };
type SeatFacts = {
  from: Resource;
  rules: ReturnType<typeof rulesFor>;
  demand: ReturnType<typeof requestRulesFor>;
  contextKnown: boolean;
  hasParty: boolean;
  age: number;
  canMove: boolean;
  hasSeatRequest: boolean;
};
const current = (s: State, id: string | null) =>
  s.resources.find((r) => r.id === id);
const change = (a: Allocation, to: string | null): Change => ({
  key: a.key,
  from: a.resource,
  to,
  version: a.version,
});
const active = (c: Candidate & { status?: string }) =>
  ["HELD", "ACCEPTED", "AWAITING_EVIDENCE", "RECONCILING"].includes(
    c.status || "",
  );
function base(
  s: State,
  id: string,
  participants: string[],
  changes: Change[],
  credits: Record<string, number>,
): Candidate {
  return {
    id,
    title: "A complete arrangement",
    description: "The platform confirms every change before settling credits.",
    category: "exchange",
    participants,
    changes,
    credits,
    dependencies: [],
    pricingVersion: "REFERENCE-2026-10",
    issuance: 0,
    redemption: 0,
    gain: participants.length,
    value: 0,
    cost: 0,
    risk: 0,
    deadline: Math.min(
      ...changes.flatMap((c) =>
        [c.from, c.to].flatMap((id) => {
          const r = current(s, id);
          return r ? [r.deadline] : [];
        }),
      ),
    ),
    prerequisites: [
      "Every changing traveller has a valid request authorization or accepts the complete arrangement",
    ],
    conditions: [],
  };
}
function acceptableSeat(
  s: State,
  a: Allocation,
  to: Resource,
  pricedInventory = false,
  facts?: SeatFacts,
): boolean {
  const from = facts?.from ?? current(s, a.resource);
  if (
    !from ||
    to.kind !== "seat" ||
    (to.serviceOnly && to.product !== from.product) ||
    (to.cabin || "Economy") !== (from.cabin || "Economy") ||
    to.journey !== from.journey ||
    (!pricedInventory && to.product !== from.product) ||
    to.serviceHour !== from.serviceHour ||
    to.id === from.id
  )
    return false;
  if (to.eligible.length && !to.eligible.includes(a.person)) return false;
  if (to.seatMap?.exitRow && (facts?.age ?? s.people.find((person) => person.id === a.person)?.age ?? 18) < 15) return false;
  if (facts ? !facts.contextKnown : intentContextIssues(s, a.person, from.journey).length > 0) return false;
  const rules = facts?.rules ?? rulesFor(s, a.person, from.journey);
  const hard = rules.filter(
    (r) => r.strength === "must" && r.effect.kind === "seat_position",
  );
  if (
    hard.some(
      (r) =>
        r.effect.kind === "seat_position" &&
        !r.effect.positions.includes(to.seatPosition!),
    )
  )
    return false;
  const demand = facts?.demand ?? requestRulesFor(s, a.person, from.journey);
  const together = rules.filter((r) => r.effect.kind === "seating_together");
  if (together.length) {
    const hasParty = facts?.hasParty ?? !!s.parties?.find(
      (p) => p.journeyId === from.journey && p.memberIds.includes(a.person),
    );
    if (!hasParty) return false;
    // Togetherness is a final-allocation predicate. An isolated move can fail
    // even when the full family permutation succeeds, so it cannot prune an edge.
    if (demand.some((r) => r.effect.kind === "seating_together")) return true;
  }
  // A desired destination creates demand. A flexible rule permits an offer.
  // A soft preference never becomes a hidden global hard constraint.
  return (
    rules.some(
      (r) =>
        r.purpose === "flexibility" &&
        r.strength === "flexible" &&
        r.effect.kind === "seat_position" &&
        r.effect.positions.includes(to.seatPosition!),
    ) ||
    demand.some(
      (r) =>
        r.effect.kind === "seat_position" &&
        r.effect.positions.includes(to.seatPosition!),
    )
  );
}
function affectedParties(s: State, changes: Change[]) {
  return (s.parties || []).filter((party) => changes.some((update) => {
    const allocation = s.allocations.find((a) => a.key === update.key);
    return allocation && party.memberIds.includes(allocation.person)
      && [update.from, update.to].some((id) => {
        const resource = current(s, id);
        return resource?.kind === "seat" && resource.journey === party.journeyId;
      });
  }));
}
/** Check relational requirements only after every move in an arrangement is known. */
export function completeSeatOutcomeValid(s: State, changes: Change[], seating: Seating): boolean {
  for (const party of affectedParties(s, changes)) {
    const after = seating(s, party.id, changes);
    if (!after.guardiansProtected) return false;
    const requiresTogether = party.memberIds.some((person) => rulesFor(s, person, party.journeyId).some((rule) =>
      rule.strength === "must" && rule.effect.kind === "seating_together"
      && (!rule.effect.partyId || rule.effect.partyId === party.id)));
    if (requiresTogether && !after.together) return false;
  }
  return true;
}
/** Close read dependencies after composition so they describe the final arrangement. */
export function closeCandidateDependencies(s: State, candidate: Candidate): Candidate {
  const keys = new Set(candidate.dependencies.map((dependency) => dependency.key));
  for (const party of affectedParties(s, candidate.changes)) {
    for (const allocation of s.allocations) {
      if (party.memberIds.includes(allocation.person) && current(s, allocation.resource)?.kind === "seat"
        && current(s, allocation.resource)?.journey === party.journeyId) keys.add(allocation.key);
    }
  }
  for (const person of candidate.participants) {
    const journeys = new Set(candidate.changes.filter((update) =>
      s.allocations.find((allocation) => allocation.key === update.key)?.person === person)
      .flatMap((update) => [current(s, update.from)?.journey, current(s, update.to)?.journey])
      .filter((journey): journey is string => !!journey));
    for (const journey of journeys) {
      for (const key of conditionalOutcomeDependencies(s, person, journey)) keys.add(key);
    }
  }
  const writes = new Set(candidate.changes.map((update) => update.key));
  return {...candidate, dependencies: [...keys].filter((key) => !writes.has(key)).sort().flatMap((key) => {
    const existing = candidate.dependencies.find((dependency) => dependency.key === key);
    const allocation = s.allocations.find((a) => a.key === key);
    return existing ? [{...existing}] : allocation ? [change(allocation, allocation.resource)] : [];
  })};
}
function seatImprovement(
  s: State,
  a: Allocation,
  to: Resource,
  seating: Seating,
  changes: Change[],
  facts?: SeatFacts,
): boolean {
  const from = facts?.from ?? current(s, a.resource);
  if (!from) return false;
  const rules = facts?.demand ?? requestRulesFor(s, a.person, from.journey);
  const requiredGain = rules.some(
    (r) =>
      r.strength === "must" &&
      r.effect.kind === "seat_position" &&
      r.effect.positions.includes(to.seatPosition!) &&
      !r.effect.positions.includes(from.seatPosition!),
  );
  const softDelta = rules
    .filter((r) => r.strength === "prefer" && r.effect.kind === "seat_position")
    .reduce(
      (n, r) =>
        r.effect.kind === "seat_position"
          ? n +
            Number(r.effect.positions.includes(to.seatPosition!)) -
            Number(r.effect.positions.includes(from.seatPosition!))
          : n,
      0,
    );
  const party = s.parties?.find(
    (p) => p.journeyId === from.journey && p.memberIds.includes(a.person),
  );
  const togetherGain =
    party &&
    rules.some(
      (r) => r.effect.kind === "seating_together" && r.strength !== "flexible",
    ) &&
    !seating(s, party.id).together &&
    seating(s, party.id, changes).together;
  return requiredGain || softDelta > 0 || !!togetherGain;
}
/** Compose existing offers without creating new inventory or reward events. */
export function composeCandidateBundle(
  s: State,
  parts: Candidate[],
): Candidate | null {
  if (
    parts.length < 2 ||
    parts.length > 3 ||
    new Set(parts.map((part) => part.id)).size !== parts.length
  )
    return null;
  if (
    parts.some((part) => part.manualPerson || part.experimental) ||
    new Set(parts.map((part) => part.pricingVersion)).size !== 1
  )
    return null;
  const values = <K extends "budget" | "evidence" | "partyId">(key: K) => [
    ...new Set(
      parts.map((part) => part[key]).filter((value) => value !== undefined),
    ),
  ];
  if (
    values("budget").length > 1 ||
    values("evidence").length > 1
  )
    return null;
  // One campaign event can fund an arrangement only once. Distinct campaigns
  // retain separate settlements so each budget keeps its own audit trail.
  const events = parts.flatMap((part) => (part.event ? [part.event] : []));
  if (events.length > 1) return null;
  const changes = parts.flatMap((part) => part.changes);
  if (new Set(changes.map((change) => change.key)).size !== changes.length)
    return null;
  const dependencies = new Map<string, Change>();
  for (const dependency of parts.flatMap((part) => part.dependencies)) {
    if (changes.some((change) => change.key === dependency.key)) return null;
    const existing = dependencies.get(dependency.key);
    if (
      existing &&
      (existing.from !== dependency.from ||
        existing.to !== dependency.to ||
        existing.version !== dependency.version)
    )
      return null;
    dependencies.set(dependency.key, dependency);
  }
  for (const snapshot of [...changes, ...dependencies.values()]) {
    const allocation = s.allocations.find(
      (allocation) => allocation.key === snapshot.key,
    );
    if (
      !allocation ||
      allocation.resource !== snapshot.from ||
      allocation.version !== snapshot.version
    )
      return null;
  }
  const projected = s.allocations.map((allocation) => {
    const update = changes.find((change) => change.key === allocation.key);
    return update ? { ...allocation, resource: update.to } : allocation;
  });
  for (const id of new Set(
    changes.flatMap((change) => (change.to ? [change.to] : [])),
  )) {
    const resource = current(s, id);
    if (
      !resource ||
      resource.background +
        projected.filter((allocation) => allocation.resource === id).length >
        resource.capacity - resource.protected
    )
      return null;
  }
  const requiredEvents = [
    ...new Set(parts.flatMap((part) => part.requiredEvents || [])),
  ];
  if (events.some((event) => requiredEvents.includes(event))) return null;
  const participants = [
    ...new Set(parts.flatMap((part) => part.participants)),
  ].sort();
  const credits = Object.fromEntries(
    participants.map((person) => [
      person,
      parts.reduce((sum, part) => sum + (part.credits[person] || 0), 0),
    ]),
  );
  const sum = (
    key: "issuance" | "redemption" | "gain" | "value" | "cost" | "risk",
  ) => parts.reduce((total, part) => total + part[key], 0);
  return {
    ...base(
      s,
      `bundle-${parts
        .map((part) => part.id)
        .sort()
        .join("~")}`,
      participants,
      changes,
      credits,
    ),
    title: "Your requested changes, arranged together",
    description:
      "All requested changes are reserved and confirmed as one arrangement at the fixed price you accepted.",
    dependencies: [...dependencies.values()],
    pricingVersion: parts[0].pricingVersion,
    issuance: sum("issuance"),
    redemption: sum("redemption"),
    gain: sum("gain"),
    value: sum("value"),
    cost: sum("cost"),
    risk: sum("risk"),
    budget: values("budget")[0],
    evidence: values("evidence")[0],
    partyId: values("partyId").length === 1 ? values("partyId")[0] : undefined,
    event: events[0],
    deadline: Math.min(...parts.map((part) => part.deadline)),
    availableFrom: Math.max(...parts.map((part) => part.availableFrom || 0)),
    requiredEvents,
    baggageReturns: parts.flatMap((part) => part.baggageReturns || []),
    prerequisites: [...new Set(parts.flatMap((part) => part.prerequisites))],
    conditions: [...new Set(parts.flatMap((part) => part.conditions))],
  };
}
export const DEFAULT_MARKET_LIMITS = { candidateLimit: 192, workLimit: 20000 };
export type GenerationDiagnostics = {
  complete: boolean;
  reason: null | "candidate_limit" | "work_limit";
  candidateCount: number;
  candidateLimit: number;
  seatCandidateLimit: number;
  workLimit: number;
  visited: number;
  bundleAttempts?: number;
  jointAttempts?: number;
  domain?: { maxSeatCycleLength: number; maxSeatChainLength: number; maxBundleParts: number };
};
export function generateGenericMarket(
  s: State,
  seating: Seating,
  options: Partial<typeof DEFAULT_MARKET_LIMITS> = {},
) {
  const boundedInteger = (value: number | undefined, fallback: number, minimum: number, maximum: number) =>
    Number.isFinite(value ?? fallback) ? Math.max(minimum, Math.min(maximum, Math.floor(value ?? fallback))) : fallback;
  const candidateLimit = boundedInteger(options.candidateLimit, DEFAULT_MARKET_LIMITS.candidateLimit, 1, 1000);
  const workLimit = boundedInteger(options.workLimit, DEFAULT_MARKET_LIMITS.workLimit, 30, 100000);
  const seatCandidateLimit = Math.max(1, Math.floor(candidateLimit * 0.75));
  const diagnostics: GenerationDiagnostics = {
    complete: true,
    reason: null,
    candidateCount: 0,
    candidateLimit,
    seatCandidateLimit,
    workLimit,
    visited: 0,
    bundleAttempts: 0,
    jointAttempts: 0,
    domain: {maxSeatCycleLength: 4, maxSeatChainLength: 4, maxBundleParts: 3},
  };
  const limited = (reason: GenerationDiagnostics["reason"]) => {
    diagnostics.complete = false;
    diagnostics.reason ??= reason;
  };
  // These indexes belong to this immutable generation snapshot. Context and
  // applicable rules are compiled once, before exploring alternative moves.
  const resources = new Map(s.resources.map((resource) => [resource.id, resource]));
  const allocations = new Map(s.allocations.map((allocation) => [allocation.key, allocation]));
  const people = new Map(s.people.map((person) => [person.id, person]));
  const occupied = new Map<string, number>();
  for (const allocation of s.allocations) if (allocation.resource) {
    occupied.set(allocation.resource, (occupied.get(allocation.resource) || 0) + 1);
  }
  const getResource = (id: string | null) => id ? resources.get(id) : undefined;
  const requestCache = new Map<string, ReturnType<typeof requestRulesFor>>();
  const requestRules = (person: string, journey: string) => {
    const key = JSON.stringify([person, journey]);
    let rules = requestCache.get(key);
    if (!rules) {
      rules = requestRulesFor(s, person, journey);
      requestCache.set(key, rules);
    }
    return rules;
  };
  const contextCache = new Map<string, Omit<SeatFacts, "from">>();
  const seatFacts = new Map<string, SeatFacts>();
  for (const allocation of s.allocations) {
    const from = getResource(allocation.resource);
    if (from?.kind !== "seat") continue;
    const key = JSON.stringify([allocation.person, from.journey]);
    let context = contextCache.get(key);
    if (!context) {
      const rules = rulesFor(s, allocation.person, from.journey);
      const demand = requestRules(allocation.person, from.journey);
      const hasSeatRequest = demand.some((rule) =>
        rule.effect.kind === "seat_position" || rule.effect.kind === "seating_together");
      const hasParty = !!s.parties?.some((party) =>
        party.journeyId === from.journey && party.memberIds.includes(allocation.person));
      const contextKnown = intentContextIssues(s, allocation.person, from.journey).length === 0;
      const permitted = rules.some((rule) => rule.purpose === "flexibility"
        && rule.strength === "flexible" && rule.effect.kind === "seat_position");
      context = {rules, demand, contextKnown, hasParty, hasSeatRequest,
        age: people.get(allocation.person)?.age ?? 18,
        canMove: contextKnown && (permitted || hasSeatRequest)
          && (!rules.some((rule) => rule.effect.kind === "seating_together") || hasParty)};
      contextCache.set(key, context);
    }
    seatFacts.set(allocation.key, {...context, from});
  }
  const seatGroup = (resource: Resource) =>
    JSON.stringify([resource.journey, resource.product, resource.serviceHour]);
  const activeGroups = new Set([...seatFacts.values()]
    .filter((facts) => facts.canMove && facts.hasSeatRequest).map((facts) => seatGroup(facts.from)));
  const seats = s.allocations.filter((allocation) => {
    const facts = seatFacts.get(allocation.key);
    return facts?.canMove && activeGroups.has(seatGroup(facts.from));
  }).sort((a, b) => {
    const left = seatFacts.get(a.key)!, right = seatFacts.get(b.key)!;
    return Number(right.hasSeatRequest) - Number(left.hasSeatRequest)
      || left.from.deadline - right.from.deadline || a.key.localeCompare(b.key);
  });
  const requestSeats = seats.filter((allocation) => seatFacts.get(allocation.key)!.hasSeatRequest);
  const list: Candidate[] = [], seatFragments: Candidate[] = [], found = new Set<string>();
  const completeRequests = Object.entries(s.intents || {}).flatMap(
    ([person, records]) =>
      records
        .filter(
          (record) =>
            intentPurpose(record) === "request" &&
            record.scope.kind === "journey" &&
            record.confirmed &&
            !record.cancelled &&
            !record.questions.length &&
            record.authorization?.mode === "fixed_quote" &&
            record.authorization.allowPartial === false &&
            record.authorization.termsRevision === record.revision &&
            record.authorization.validUntil > s.hour,
        )
        .map((record) => ({ person, record })),
  );
  const ordinaryLimit =
    completeRequests.length && candidateLimit > 1
      ? candidateLimit -
        Math.min(24, Math.max(1, Math.floor(candidateLimit / 8)))
      : candidateLimit;
  const graphBudget = Math.floor(workLimit * 0.45),
    walkBudget = Math.floor(workLimit * 0.45),
    catalogueBudget = workLimit - graphBudget - walkBudget;
  let graphVisits = 0,
    walkVisits = 0,
    catalogueVisits = 0,
    seatCount = 0,
    seatStopped = false;
  const edgeCache = new Map<string, Map<number, Allocation | null>>();
  const groups = new Map<string, Allocation[]>();
  for (const seat of seats) {
    const key = seatGroup(seatFacts.get(seat.key)!.from);
    const members = groups.get(key);
    if (members) members.push(seat); else groups.set(key, [seat]);
  }
  const outgoing = function* (from: Allocation): Generator<Allocation | null> {
    let edges = edgeCache.get(from.key);
    if (!edges) {
      edges = new Map();
      edgeCache.set(from.key, edges);
    }
    const facts = seatFacts.get(from.key)!;
    const group = groups.get(seatGroup(facts.from)) || [];
    for (let position = 0; position < group.length; position++) {
      const to = group[position];
      if (from.key === to.key) continue;
      if (edges.has(position)) {
        yield edges.get(position)!;
        continue;
      }
      if (graphVisits >= graphBudget || diagnostics.visited >= workLimit) {
        limited("work_limit");
        return;
      }
      graphVisits++;
      diagnostics.visited++;
      const destination = acceptableSeat(s, from, seatFacts.get(to.key)!.from, false, facts) ? to : null;
      edges.set(position, destination);
      // Rejected edges yield as well, so one large flight cannot spend the
      // graph budget before another request frontier receives a turn.
      yield destination;
    }
  };
  // One traversal step per frontier gives every active request an opportunity
  // before a dense component spends the remaining cycle-search budget.
  const runFrontiers = (frontiers: Generator<void>[]) => {
    let pending = frontiers;
    while (pending.length && !seatStopped) {
      const next: Generator<void>[] = [];
      for (const frontier of pending) {
        if (seatStopped) return;
        if (!frontier.next().done) next.push(frontier);
      }
      pending = next;
    }
  };
  const add = (c: Candidate, isSeat = false, isBundle = false) => {
    if (
      list.length >= (isBundle ? candidateLimit : ordinaryLimit) ||
      (isSeat && seatCount >= seatCandidateLimit)
    ) {
      limited("candidate_limit");
      return false;
    }
    const references = c.participants.flatMap((person) => {
      const journeys = [
        ...new Set(
          c.changes
            .filter(
              (ch) =>
                allocations.get(ch.key)?.person === person,
            )
            .flatMap((ch) => [
              getResource(ch.to)?.journey,
              getResource(ch.from)?.journey,
            ])
            .filter((j): j is string => !!j),
        ),
      ];
      const kinds = new Set(
        c.changes
          .filter(
            (ch) =>
              allocations.get(ch.key)?.person === person,
          )
          .flatMap((ch) => [
            getResource(ch.from)?.kind,
            getResource(ch.to)?.kind,
          ]),
      );
      return journeys.flatMap((journey) =>
        requestRules(person, journey)
          .filter((rule) => {
            const kind =
              rule.effect.kind === "seat_position" ||
              rule.effect.kind === "seating_together"
                ? "seat"
                : rule.effect.kind === "departure_window"
                  ? "flight"
                  : rule.effect.kind === "gate_check"
                    ? "handover"
                    : rule.effect.kind;
            return (
              rule.strength !== "flexible" &&
              kinds.has(kind as Resource["kind"])
            );
          })
          .map((rule) => ({
            person,
            intentId: rule.recordId,
            revision: rule.recordRevision,
          })),
      );
    });
    c.requestRefs = [
      ...new Map(
        references.map((ref) => [`${ref.person}:${ref.intentId}`, ref]),
      ).values(),
    ];
    list.push(c);
    if (isSeat) seatCount++;
    return true;
  };
  const catalogueWork = () => {
    if (catalogueVisits >= catalogueBudget || diagnostics.visited >= workLimit) {
      limited("work_limit");
      return false;
    }
    catalogueVisits++;
    diagnostics.visited++;
    return true;
  };
  const traversalWork = () => {
    if (walkVisits >= walkBudget || diagnostics.visited >= workLimit) {
      limited("work_limit");
      seatStopped = true;
      return false;
    }
    walkVisits++;
    diagnostics.visited++;
    return true;
  };
  for (let cycleLength = 2; cycleLength <= 4; cycleLength++) {
    const frontiers = requestSeats.map((start) => {
      const walk = function* (path: Allocation[]): Generator<void> {
        const last = path[path.length - 1];
        for (const owner of outgoing(last)) {
          if (seatStopped) return;
          if (!traversalWork()) return;
          yield;
          if (!owner) continue;
          if (owner.key === start.key && path.length === cycleLength) {
            const canonical = path
              .map((a, i) => `${a.key}>${path[(i + 1) % path.length].resource}`)
              .sort()
              .join("|");
            if (
              found.has(canonical) ||
              new Set(path.map((a) => a.person)).size !== path.length
            )
              continue;
            found.add(canonical);
            const changes = path.map((a, i) =>
              change(a, path[(i + 1) % path.length].resource),
            );
            const improves = path.some((a, i) =>
                seatImprovement(
                  s,
                  a,
                  getResource(path[(i + 1) % path.length].resource)!,
                  seating,
                  changes,
                  seatFacts.get(a.key),
                ));
            const jointGoal = path.some((a) => requestRules(a.person, getResource(a.resource)!.journey)
              .some((rule) => rule.effect.kind === "seating_together"));
            if (!improves && !jointGoal) continue;
            const credits = Object.fromEntries(
              path.map((a, i) => [
                a.person,
                getResource(a.resource)!.q -
                  getResource(path[(i + 1) % path.length].resource)!.q,
              ]),
            );
            const c = base(
              s,
              `exchange-${canonical}`,
              path.map((a) => a.person),
              changes,
              credits,
            );
            c.title =
              path.length === 2
                ? "A seat exchange for both travellers"
                : `${path.length} travellers, one complete seat exchange`;
            c.description =
              "Every traveller receives an eligible seat that matches their confirmed statement. Compensation is settled by the platform.";
            for (const party of s.parties || []) {
              if (
                path.some(
                  (a) =>
                    party.memberIds.includes(a.person) &&
                    getResource(a.resource)?.journey === party.journeyId,
                ) &&
                seating(s, party.id, changes).together
              ) {
                c.partyId = party.id;
                c.title = "Seats together for your booking party";
              }
            }
            for (const campaign of s.campaigns || []) {
              const released = path.find((a, i) => {
                const from = getResource(a.resource)!,
                  to = getResource(path[(i + 1) % path.length].resource)!;
                const recipient = path.find(
                  (_, j) => changes[j].to === from.id,
                );
                if (!recipient || recipient.person === a.person) return false;
                const recipientBefore = getResource(recipient.resource)!;
                const demand = requestRules(recipient.person, from.journey).some(
                  (r) =>
                    r.strength !== "flexible" &&
                    r.effect.kind === "seat_position" &&
                    r.effect.positions.includes(from.seatPosition!) &&
                    !r.effect.positions.includes(recipientBefore.seatPosition!),
                );
                return (
                  demand &&
                  from.journey === campaign.journeyId &&
                  campaign.releasePositions.includes(from.seatPosition!) &&
                  campaign.receivePositions.includes(to.seatPosition!)
                );
              });
              if (released) {
                // A published fixed quote can require catalog settlement without
                // a campaign. Later demand must not silently change that price.
                const fixedQuotes = (s.intents?.[released.person] || []).filter((record) =>
                  record.confirmed && !record.cancelled && !record.questions.length &&
                  record.authorization?.mode === "fixed_quote" && record.authorization.validUntil > s.hour,
                ).flatMap((record) => {
                  const quote = record.authorization?.quote;
                  return quote?.version === 2 ? quote.lineItems.filter((item) => item.kind === "seat" && item.allocationKeys.includes(released.key)) : [];
                });
                if (fixedQuotes.some((item) => item.campaign?.id !== campaign.id)) continue;
                const event = `${campaign.id}:${released.key}:${released.resource}`;
                Object.assign(c, {
                  category: "earn",
                  issuance: campaign.reward,
                  budget: campaign.budget,
                  event,
                  value: campaign.value,
                  cost: campaign.cost,
                  risk: campaign.risk,
                });
                c.credits[released.person] += campaign.reward;
                c.title = "An available seat change with a Flex reward";
                c.conditions.push(
                  `The airline campaign funds ${campaign.reward} credits after verified fulfilment.`,
                );
                break;
              }
            }
            c.gain = path.filter(
              (a, i) =>
                seatImprovement(
                  s,
                  a,
                  getResource(path[(i + 1) % path.length].resource)!,
                  seating,
                  changes,
                  seatFacts.get(a.key),
                ) || (c.credits[a.person] || 0) > 0,
            ).length;
            seatFragments.push(c);
            if (!improves || !completeSeatOutcomeValid(s, changes, seating)) continue;
            if (!add(c, true)) {
              seatStopped = true;
              return;
            }
          } else if (
            path.length < cycleLength &&
            !path.some((a) => a.key === owner.key || a.person === owner.person)
          )
            yield* walk([...path, owner]);
        }
      };
      return walk([start]);
    });
    runFrontiers(frontiers);
    if (seatStopped) break;
  }
  // A path can end at a genuinely empty airline seat instead of closing a cycle.
  // The initiating passenger buys their new seat. Intermediate movers settle
  // fixed reference-value differences, with the net debit funding that inventory.
  const emptySeatGroups = new Map<string, Resource[]>();
  const inventoryGroup = (resource: Resource) => JSON.stringify([resource.journey, resource.serviceHour]);
  for (const resource of s.resources) {
    if (resource.kind !== "seat" || resource.source !== "airline_inventory"
      || resource.capacity - resource.protected - resource.background - (occupied.get(resource.id) || 0) <= 0) continue;
    const key = inventoryGroup(resource), group = emptySeatGroups.get(key);
    if (group) group.push(resource); else emptySeatGroups.set(key, [resource]);
  }
  for (let length = 1; length <= 4 && !seatStopped; length++) {
    const frontiers = seats.map((start) => {
      const walk = function* (path: Allocation[]): Generator<void> {
        const last = path[path.length - 1];
        if (path.length === length) {
          for (const destination of emptySeatGroups.get(inventoryGroup(seatFacts.get(last.key)!.from)) || []) {
            if (!traversalWork()) return;
            yield;
            if (!acceptableSeat(s, last, destination, true, seatFacts.get(last.key))) continue;
            const changes = path.map((a, i) => change(a, path[i + 1]?.resource || destination.id));
            const improves = path.some((a, i) => seatImprovement(s, a,
              getResource(changes[i].to)!, seating, changes, seatFacts.get(a.key)));
            const jointGoal = path.some((a) => requestRules(a.person, getResource(a.resource)!.journey)
              .some((rule) => rule.effect.kind === "seating_together"));
            if (!improves && !jointGoal) continue;
            const credits = Object.fromEntries(path.map((a, i) => [a.person,
              getResource(a.resource)!.q - getResource(changes[i].to)!.q
                - (i === 0 ? getResource(start.resource)!.q : 0)]));
            const id = path.length === 1 ? `redeem-${start.person}-${destination.id}`
              : `chain-${changes.map((ch) => `${ch.key}>${ch.to}`).sort().join("|")}`;
            const candidate = {...base(s, id, path.map((a) => a.person), changes, credits),
              category: "redeem" as const, redemption: destination.q,
              cost: destination.serviceCost + destination.opportunityCost,
              gain: path.filter((a, i) => seatImprovement(s, a, getResource(changes[i].to)!, seating, changes, seatFacts.get(a.key))
                || credits[a.person] > 0).length,
              title: "A complete seat arrangement with airline inventory"};
            seatFragments.push(candidate);
            if (!improves || !completeSeatOutcomeValid(s, changes, seating)) continue;
            if (!add(candidate, true)) { seatStopped = true; return; }
          }
          return;
        }
        for (const owner of outgoing(last)) {
          if (!traversalWork()) return;
          yield;
          if (!owner) continue;
          if (!path.some((a) => a.key === owner.key || a.person === owner.person)) yield* walk([...path, owner]);
          if (seatStopped) return;
        }
      };
      return walk([start]);
    });
    runFrontiers(frontiers);
  }
  // Disconnected swaps or empty-seat paths can form one jointly feasible family
  // move. Keep infeasible components private until their complete union is valid.
  const jointIds = new Set<string>();
  joint: for (const party of s.parties || []) {
    const relevant = seatFragments.filter((candidate) => candidate.changes.some((update) => {
      const allocation = allocations.get(update.key);
      return allocation && party.memberIds.includes(allocation.person)
        && getResource(update.from)?.journey === party.journeyId;
    }));
    if (!party.memberIds.some((person) => requestRules(person, party.journeyId)
      .some((rule) => rule.effect.kind === "seating_together"))) continue;
    const fragmentKeys = relevant.map((candidate) => new Set(candidate.changes.map((update) => update.key)));
    const attempt = (parts: Candidate[]) => {
      if ((diagnostics.jointAttempts || 0) >= Math.max(192, candidateLimit * 4) || diagnostics.visited >= workLimit) {
        limited("work_limit"); return false;
      }
      diagnostics.jointAttempts = (diagnostics.jointAttempts || 0) + 1; diagnostics.visited++;
      const keys = parts.flatMap((part) => part.changes.map((change) => change.key));
      if (new Set(keys).size !== keys.length) return true;
      const candidate = composeCandidateBundle(s, parts);
      if (!candidate || jointIds.has(candidate.id) || !completeSeatOutcomeValid(s, candidate.changes, seating)
        || !seating(s, party.id, candidate.changes).together) return true;
      candidate.partyId = party.id;
      candidate.title = "Your complete booking party, seated together";
      candidate.gain = candidate.changes.filter((update) => {
        const allocation = allocations.get(update.key)!;
        return seatImprovement(s, allocation, getResource(update.to)!, seating, candidate.changes, seatFacts.get(allocation.key))
          || candidate.credits[allocation.person] > 0;
      }).length;
      jointIds.add(candidate.id);
      return add(candidate, true);
    };
    for (let i = 0; i < relevant.length; i++) for (let j = i + 1; j < relevant.length; j++) {
      if (!attempt([relevant[i], relevant[j]])) break joint;
      // A third fragment cannot repair duplicate writes in the first pair.
      if ([...fragmentKeys[i]].some((key) => fragmentKeys[j].has(key))) continue;
      for (let k = j + 1; k < relevant.length; k++) if (!attempt([relevant[i], relevant[j], relevant[k]])) break joint;
    }
  }
  const searchedBaggage = new Set<string>();
  inventory: for (const r of s.resources.filter(
    (r) => r.source === "airline_inventory",
  )) {
    for (const p of s.people) {
      if (!catalogueWork()) break inventory;
      if (r.eligible.length && !r.eligible.includes(p.id)) continue;
      const rules = requestRules(p.id, r.journey);
      if (r.kind === "baggage") {
        const key = JSON.stringify([p.id, r.journey]);
        if (searchedBaggage.has(key)) continue;
        searchedBaggage.add(key);
        const result = baggagePlans(s, p.id, r.journey, rules, {
          workLimit: Math.max(1, Math.min(20000, workLimit - diagnostics.visited)),
          maxPlans: Math.max(1, Math.min(64, ordinaryLimit - list.length)),
        });
        diagnostics.visited += result.work;
        if (result.limited) limited(result.limited);
        for (const plan of result.plans) {
          const ids = [...new Set(plan.changes.map(change => change.to))];
          const id = ids.length === 1 ? `redeem-${p.id}-${ids[0]}`
            : `redeem-baggage-${p.id}-${plan.changes.map(change => `${change.key}>${change.to}`).join("|")}`;
          const c = base(s, id, [p.id], plan.changes, {[p.id]: -plan.credits});
          const pieces = plan.changes.reduce((total, change) => total + getResource(change.to)!.baggage!.pieces, 0);
          Object.assign(c, {
            category: "redeem", redemption: plan.credits,
            cost: plan.changes.reduce((total, change) => {
              const product = getResource(change.to)!;
              return total + product.serviceCost + product.opportunityCost;
            }, 0),
            title: `${pieces} extra checked ${pieces === 1 ? "bag" : "bags"} for your journey`,
            description: "Personal baggage entitlements supplied by airline inventory.",
          });
          if (!add(c)) break inventory;
        }
      }
      if (r.kind === "seat") {
        // Empty-seat moves, including paths and joint family assignments, were
        // generated above with the same local and complete-outcome checks.
        if (list.some((candidate) => candidate.id === `redeem-${p.id}-${r.id}`)) continue;
        const a = seats.find(
          (a) =>
            a.person === p.id &&
            getResource(a.resource)?.journey === r.journey &&
            a.resource !== r.id,
        );
        if (
          !a ||
          !rules.some(
            (rule) =>
              rule.strength !== "flexible" &&
              rule.effect.kind === "seat_position" &&
              rule.effect.positions.includes(r.seatPosition!) &&
              !rule.effect.positions.includes(
                getResource(a.resource)!.seatPosition!,
              ),
          )
        )
          continue;
        const c = base(s, `redeem-${p.id}-${r.id}`, [p.id], [change(a, r.id)], {
          [p.id]: -r.q,
        });
        Object.assign(c, {
          category: "redeem",
          redemption: r.q,
          cost: r.serviceCost + r.opportunityCost,
          title: "A seat for a future journey",
          description:
            "The airline confirms your new seat before credits are redeemed.",
        });
        if (!add(c)) break inventory;
      }
    }
  }
  for (const offer of s.operationalOffers || []) {
    if (!catalogueWork()) break;
    const allocations = offer.changes.map((ch) =>
      s.allocations.find((a) => a.key === ch.allocationKey),
    );
    if (
      allocations.some((a) => !a) ||
      offer.changes.some((ch) => ch.to && !getResource(ch.to))
    )
      continue;
    if (offer.changes.every((ch, i) => allocations[i]!.resource === ch.to))
      continue;
    const changes = offer.changes.map((ch, i) =>
      change(allocations[i]!, ch.to),
    );
    const participants = [...new Set(allocations.map((a) => a!.person))];
    const c = base(s, offer.id, participants, changes, { ...offer.credits });
    Object.assign(c, {
      title: offer.title,
      description: offer.description,
      category: offer.issuance
        ? "earn"
        : offer.redemption
          ? "redeem"
          : "exchange",
      issuance: offer.issuance,
      redemption: offer.redemption,
      budget: offer.budget,
      evidence: offer.evidence,
      requiredEvents: offer.requiredEvents,
      value: offer.value,
      cost: offer.cost,
      risk: offer.risk,
    });
    if (offer.issuance)
      c.event = `${offer.id}:${changes
        .map((ch) => `${ch.key}:${ch.from}`)
        .sort()
        .join("|")}`;
    c.dependencies = (offer.dependencies || []).flatMap((key) => {
      const a = s.allocations.find((a) => a.key === key);
      return a ? [change(a, a.resource)] : [];
    });
    if (c.dependencies.length !== (offer.dependencies || []).length) continue;
    if (!add(c)) break;
  }
  const singles = [...list];
  const bundled = new Set<string>();
  bundles: for (const { person, record } of completeRequests) {
    if (record.scope.kind !== "journey") continue;
    const journeyId = record.scope.journeyId;
    const goals = requestRules(person, journeyId).filter(
      (rule) =>
        rule.recordId === record.id &&
        rule.strength !== "flexible" &&
        rule.effect.kind !== "credit_budget",
    );
    if (
      !goals.length ||
      goals.every((rule) => requestGoalSatisfied(s, person, journeyId, rule))
    )
      continue;
    const relevant = singles.filter((candidate) =>
      candidate.requestRefs?.some(
        (ref) =>
          ref.person === person &&
          ref.intentId === record.id &&
          ref.revision === record.revision,
      ),
    );
    const tryBundle = (parts: Candidate[]) => {
      if (
        (diagnostics.bundleAttempts || 0) >= 192 ||
        diagnostics.visited >= workLimit
      ) {
        limited("work_limit");
        return false;
      }
      diagnostics.bundleAttempts = (diagnostics.bundleAttempts || 0) + 1;
      diagnostics.visited++;
      const combined = composeCandidateBundle(s, parts);
      if (!combined || bundled.has(combined.id)) return true;
      if (!completeSeatOutcomeValid(s, combined.changes, seating)) return true;
      const projected = {
        ...s,
        allocations: s.allocations.map((allocation) => {
          const update = combined.changes.find(
            (change) => change.key === allocation.key,
          );
          return update ? { ...allocation, resource: update.to } : allocation;
        }),
      };
      if (
        !goals.every((rule) =>
          requestGoalSatisfied(projected, person, journeyId, rule),
        )
      )
        return true;
      bundled.add(combined.id);
      return add(combined, false, true);
    };
    for (let i = 0; i < relevant.length; i++)
      for (let j = i + 1; j < relevant.length; j++) {
        if (!tryBundle([relevant[i], relevant[j]])) break bundles;
        for (let k = j + 1; k < relevant.length; k++)
          if (!tryBundle([relevant[i], relevant[j], relevant[k]]))
            break bundles;
      }
  }
  diagnostics.candidateCount = list.length;
  return { candidates: list.map((candidate) => closeCandidateDependencies(s, candidate)), diagnostics };
}
export function genericCandidates(s: State, seating: Seating): Candidate[] {
  return generateGenericMarket(s, seating).candidates;
}
export function genericIntentErrors(
  s: State,
  c: Candidate,
  seating: Seating,
  except?: string,
): string[] {
  const errors: string[] = [];
  for (const person of c.participants) {
    const journeys = [
      ...new Set(
        c.changes
          .filter(
            (ch) =>
              s.allocations.find((a) => a.key === ch.key)?.person === person,
          )
          .flatMap((ch) => [
            current(s, ch.to)?.journey,
            current(s, ch.from)?.journey,
          ])
          .filter((j): j is string => !!j),
      ),
    ];
    for (const journey of journeys) {
      errors.push(...intentContextIssues(s, person, journey));
      const rules = rulesFor(s, person, journey);
      if (!rules.length)
        errors.push(
          "The traveller has no confirmed statement applying to this journey",
        );
      const own = c.changes.filter(
        (ch) =>
          s.allocations.find((a) => a.key === ch.key)?.person === person &&
          (current(s, ch.to)?.journey === journey ||
            current(s, ch.from)?.journey === journey),
      );
      for (const ch of own) {
        const from = current(s, ch.from),
          to = current(s, ch.to);
        if (
          to?.kind === "flight" &&
          !rules.some((r) => r.effect.kind === "departure_window")
        )
          errors.push(
            "The traveller has not offered flexibility over departure time",
          );
        if (
          to?.kind === "handover" &&
          !rules.some((r) => r.effect.kind === "gate_check" && r.effect.allowed)
        )
          errors.push(
            "The traveller has not offered voluntary cabin-bag handover",
          );
        if (
          from?.kind === "meal" &&
          ch.to === null &&
          !rules.some((r) => r.effect.kind === "meal" && !r.effect.receive)
        )
          errors.push("The traveller has not offered to decline the meal");
        if (from?.baggage?.role === "included" && ch.to === null) {
          const remaining = s.allocations.filter((a) => a.person === person).reduce((total, a) => {
            const update = c.changes.find((ch) => ch.key === a.key);
            const r = current(s, update ? update.to : a.resource);
            return total + (r?.journey === journey && r.baggage?.role === "included" ? r.baggage.pieces : 0);
          }, 0);
          if (!rules.some((r) => r.effect.kind === "baggage_release" && r.strength === "flexible" && remaining >= r.effect.minRemainingPieces))
            errors.push("Review the included baggage allowance you would give up.");
        }
        if (to?.kind === "seat") {
          const party = s.parties?.find(
            (p) => p.journeyId === journey && p.memberIds.includes(person),
          );
          const satisfiesParty =
            party &&
            rules.some((r) => r.effect.kind === "seating_together") &&
            seating(s, party.id, c.changes).together;
          const replacementSeat = rules.some(rule => rule.purpose === "request" &&
            rule.effect.kind === "departure_window" && rule.strength !== "flexible") &&
            own.some(change => {
              const flight = current(s, change.to);
              return flight?.kind === "flight" && flight.journey === to.journey && flight.serviceHour === to.serviceHour;
            });
          const seatAllowed = replacementSeat || rules.some(
            (r) =>
              r.effect.kind === "seat_position" &&
              r.effect.positions.includes(to.seatPosition!),
          );
          if (!seatAllowed && !satisfiesParty)
            errors.push(
              "The replacement seat is outside the traveller’s confirmed flexibility",
            );
        }
      }
      for (const rule of rules) {
        const e = rule.effect,
          ownChanges = c.changes.filter(
            (ch) =>
              s.allocations.find((a) => a.key === ch.key)?.person === person &&
              (current(s, ch.to)?.journey === journey ||
                current(s, ch.from)?.journey === journey),
          );
        if (
          e.kind === "seat_position" &&
          rule.strength === "must" &&
          ownChanges.some((ch) => {
            const r = current(s, ch.to);
            return r?.kind === "seat" && !e.positions.includes(r.seatPosition!);
          })
        )
          errors.push(`The proposed seat conflicts with “${rule.evidence}”`);
        if (
          e.kind === "seating_together" &&
          rule.strength === "must" &&
          ownChanges.some((ch) => current(s, ch.to)?.kind === "seat")
        ) {
          const party = s.parties?.find(
            (p) =>
              p.journeyId === journey &&
              p.memberIds.includes(person) &&
              (!e.partyId || p.id === e.partyId),
          );
          if (!party || !seating(s, party.id, c.changes).together)
            errors.push(
              "The confirmed booking-party seating requirement is not fulfilled",
            );
        }
        if (e.kind === "credit_budget") {
          const related = (item: Candidate) =>
            item.changes.some(
              (ch) =>
                current(s, ch.to)?.journey === journey ||
                current(s, ch.from)?.journey === journey,
            );
          const committed = s.contracts
            .filter(
              (old) =>
                old.contractId !== except &&
                (old.status === "SETTLED" || active(old)) &&
                related(old),
            )
            .reduce(
              (n, old) => n + Math.max(0, -(old.credits[person] || 0)),
              0,
            );
          if (committed + Math.max(0, -(c.credits[person] || 0)) > e.maxCredits)
            errors.push(
              `The confirmed ${e.maxCredits}-credit journey limit would be exceeded`,
            );
        }
        if (
          e.kind === "baggage" &&
          ownChanges.some((ch) => current(s, ch.to)?.kind === "baggage")
        ) {
          const bags = s.allocations
            .filter((a) => a.person === person)
            .map((a) =>
              current(
                s,
                (c.changes.find((ch) => ch.key === a.key) || {to: a.resource}).to,
              ),
            )
            .filter(
              (r): r is Resource =>
                !!r && isExtraBaggage(r) && r.journey === journey,
            );
          if (!baggageRequirementSatisfied(bags, e))
            errors.push("The offer does not supply the requested baggage quantity and weight allowances");
        }
        if (
          e.kind === "gate_check" &&
          rule.strength !== "prefer" &&
          !e.allowed &&
          ownChanges.some((ch) => current(s, ch.to)?.kind === "handover")
        )
          errors.push(
            "The traveller requires their cabin bag to remain with them",
          );
        if (
          e.kind === "meal" &&
          rule.strength !== "prefer" &&
          e.receive &&
          ownChanges.some(
            (ch) => current(s, ch.from)?.kind === "meal" && ch.to === null,
          )
        )
          errors.push("The traveller requires the included meal");
        if (e.kind === "departure_window" && rule.strength !== "prefer")
          for (const ch of ownChanges) {
            const from = current(s, ch.from),
              to = current(s, ch.to);
            if (to?.kind !== "flight") continue;
            const departure = simulationEpoch(s) + to.serviceHour * 3600000;
            if (
              (e.earliest && departure < Date.parse(e.earliest)) ||
              (e.latest && departure > Date.parse(e.latest))
            )
              errors.push(
                "The departure falls outside the confirmed time window",
              );
            if (
              e.maxDelayMinutes !== undefined &&
              (!from ||
                (to.serviceHour - from.serviceHour) * 60 > e.maxDelayMinutes)
            )
              errors.push("The departure exceeds the confirmed delay limit");
          }
      }
    }
  }
  return [...new Set(errors)];
}
