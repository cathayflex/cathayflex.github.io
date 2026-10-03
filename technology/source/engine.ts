import { initialState, storyState } from "./seed.ts";
import { nextStoryCommand, storySteps } from "./story.ts";
import { simulationEpoch } from "./time.ts";
import { candidatePlansConflict, outstandingCapacityDemand, solveCandidateSelection, type SelectionOptions } from "./selection.ts";
import { acceptedQuoteContextCurrent, quoteCoversCandidate, validateRequestQuote } from "./request-quote.ts";
import {
  bookedJourneys,
  IntentAvailabilityError,
  intentPurpose,
  journeyFacts,
  ruleConditionMatches,
  conditionalOutcomeIssues,
  requestGoalSatisfied,
  requestProgress,
  rulesFor,
  validateIntent,
} from "./intent.ts";
import {
  genericCandidates,
  genericIntentErrors,
  generateGenericMarket,
  type GenerationDiagnostics,
} from "./generic-market.ts";
import type {
  State,
  Candidate,
  Contract,
  Command,
  Change,
  Resource,
  IntentRecord,
} from "./types.ts";
export class FlexError extends Error {
  constructor(
    public code: string,
    message: string,
    public contractIds?: string[],
  ) {
    super(message);
  }
}
function assert(value: unknown, code: string, message: string): asserts value {
  if (!value) throw new FlexError(code, message);
}
const active = (c: Contract) =>
  ["HELD", "ACCEPTED", "AWAITING_EVIDENCE", "RECONCILING"].includes(c.status);
const debit = (c: Candidate, person: string) =>
  Math.max(0, -(c.credits[person] || 0));
function requestContracts(
  s: State,
  person: string,
  id: string,
  except?: string,
  revision?: number,
) {
  return s.contracts.filter(
    (c) =>
      c.contractId !== except &&
      (revision === undefined || c.authorizations?.[person]?.revision === revision || c.requestRefs?.some((ref) => ref.person === person && ref.intentId === id && ref.revision === revision)) &&
      (c.authorizations?.[person]?.intentId === id ||
        (!c.authorizations?.[person] &&
          c.requestRefs?.some(
            (ref) => ref.person === person && ref.intentId === id,
          ))),
  );
}
export function requestAuthorizationStatus(
  s: State,
  person: string,
  record: IntentRecord,
) {
  const authorization = record.authorization;
  const contracts = requestContracts(s, person, record.id, undefined, record.revision);
  const spent = contracts
    .filter((c) => c.status === "SETTLED")
    .reduce((n, c) => n + debit(c, person), 0);
  const committed = contracts
    .filter(active)
    .reduce((n, c) => n + debit(c, person), 0);
  const progress = requestProgress(s, person, record);
  const status = record.cancelled
    ? ("cancelled" as const)
    : !authorization ||
        authorization.mode !== "fixed_quote" ||
        !authorization.quote ||
        authorization.quote.targetRevision !== record.revision ||
        authorization.termsRevision !== record.revision ||
        !record.confirmed ||
        record.questions.length
      ? ("missing" as const)
      : progress.status === "fulfilled"
        ? ("fulfilled" as const)
        : authorization.validUntil <= s.hour || progress.status === "expired"
          ? ("expired" as const)
          : ("active" as const);
  const fixedQuote = authorization?.mode === "fixed_quote" ? authorization.quote : undefined;
  const maxCredits = fixedQuote?.debit || 0;
  const reservable =
    status === "active" &&
    record.confirmed &&
    !record.questions.length &&
    authorization?.termsRevision === record.revision;
  return {
    status,
    mode: fixedQuote ? "fixed_quote" as const : "legacy" as const,
    quote: fixedQuote ?? null,
    quotedCredits: fixedQuote?.debit ?? null,
    maxCredits,
    validUntil: authorization?.validUntil ?? null,
    spent,
    committed,
    reserved: reservable ? Math.max(committed, maxCredits - spent) : committed,
    remaining: Math.max(0, maxCredits - spent - committed),
  };
}
export function held(s: State, person: string, except?: string) {
  const contractHeld = s.contracts
    .filter((c) => active(c) && c.contractId !== except)
    .reduce((n, c) => n + debit(c, person), 0);
  const standing = (s.intents?.[person] || [])
    .filter((record) => intentPurpose(record) === "request")
    .reduce((n, record) => {
      const status = requestAuthorizationStatus(s, person, record);
      // Contract reservations consume this earmark. They never create a second debit hold.
      return n + Math.max(0, status.reserved - status.committed);
    }, 0);
  return contractHeld + standing;
}
export const available = (s: State, p: string) => s.wallets[p] - held(s, p);
export function availableRequestCredits(
  s: State,
  person: string,
  excludeIntentId?: string,
) {
  const record = s.intents?.[person]?.find(
    (record) => record.id === excludeIntentId,
  );
  const status = record
    ? requestAuthorizationStatus(s, person, record)
    : undefined;
  return Math.max(
    0,
    available(s, person) +
      (status
        ? Math.max(0, status.reserved - status.committed)
        : 0),
  );
}
const resource = (s: State, id: string) =>
  s.resources.find((r) => r.id === id)!;
const alloc = (s: State, key: string) =>
  s.allocations.find((a) => a.key === key)!;
const change = (s: State, key: string, to: string | null): Change => ({
  key,
  from: alloc(s, key).resource,
  to,
  version: alloc(s, key).version,
});
export const name = (s: State, p: string) =>
  s.people.find((x) => x.id === p)?.name || p;
export function effectiveSeatPreference(
  s: State,
  person: string,
  journeyId: string,
) {
  const preferences = s.preferences[person];
  const party = s.parties?.find(
    (p) => p.journeyId === journeyId && p.memberIds.includes(person),
  );
  const journey = s.journeys?.find((j) => j.id === journeyId);
  if (party && preferences?.contextualSeats?.familyTogether)
    return "together" as const;
  if (preferences?.requireAisle) return "aisle" as const;
  if (!journey || !preferences?.contextualSeats) return "any" as const;
  return journey.durationMinutes <= 360
    ? preferences.contextualSeats.soloShort
    : preferences.contextualSeats.soloLong;
}
export function partySeating(
  s: State,
  partyId: string,
  changes: Change[] = [],
) {
  const party = s.parties?.find((p) => p.id === partyId);
  if (!party)
    return {
      together: false,
      guardiansProtected: false,
      seats: [] as Resource[],
    };
  const seats = party.memberIds.map((person) => {
    const a = s.allocations.find(
      (a) =>
        a.person === person &&
        a.resource &&
        resource(s, a.resource)?.kind === "seat" &&
        resource(s, a.resource)?.journey === party.journeyId,
    );
    if (!a) return undefined;
    const projected = changes.find((ch) => ch.key === a.key);
    const id = projected ? projected.to : a.resource;
    return id ? resource(s, id) : undefined;
  });
  const adjacent = (a?: Resource, b?: Resource) =>
    !!a?.seatMap &&
    !!b?.seatMap &&
    a.seatMap.row === b.seatMap.row &&
    a.seatMap.block === b.seatMap.block &&
    Math.abs(a.seatMap.column - b.seatMap.column) === 1;
  const guardiansProtected = party.guardianPairs.every(({ child, adult }) => {
    const childSeat = seats[party.memberIds.indexOf(child)];
    const adultSeat = seats[party.memberIds.indexOf(adult)];
    const guardian = s.people.find((p) => p.id === adult);
    return (
      !!guardian &&
      (guardian.age ?? 0) >= 18 &&
      adjacent(childSeat, adultSeat) &&
      !childSeat?.seatMap?.exitRow &&
      !adultSeat?.seatMap?.exitRow
    );
  });
  const maps = seats.map((r) => r?.seatMap);
  const columns = maps.map((m) => m?.column ?? -999).sort((a, b) => a - b);
  const together =
    seats.every(Boolean) &&
    maps.every(
      (m) => m && m.row === maps[0]?.row && m.block === maps[0]?.block,
    ) &&
    columns.every((n, i) => i === 0 || n === columns[i - 1] + 1);
  return {
    together,
    guardiansProtected,
    seats: seats.filter((r): r is Resource => !!r),
  };
}
export function candidates(s: State): Candidate[] {
  if (s.intents) return genericCandidates(s, partySeating);
  const list: Candidate[] = [];
  const base = (
    id: string,
    title: string,
    description: string,
    category: Candidate["category"],
    participants: string[],
    changes: Change[],
    credits: Record<string, number>,
  ): Candidate => ({
    id,
    title,
    description,
    category,
    participants,
    changes,
    dependencies: [],
    pricingVersion: "SIM-2026-10-01",
    credits,
    issuance: 0,
    redemption: 0,
    gain: participants.length,
    value: 0,
    cost: 0,
    risk: 0,
    deadline: Math.min(
      ...changes.flatMap((c) =>
        [c.from, c.to].filter(Boolean).map((id) => resource(s, id!).deadline),
      ),
    ),
    prerequisites: [],
    conditions: [],
  });
  if (alloc(s, "A-flight-oct")?.resource === "flight-early") {
    const c = base(
      "flight-bundle",
      "A later flight. Your aisle seat, confirmed.",
      "Release a seat on the morning flight. A coordinated seat exchange secures your preferred alternative.",
      "earn",
      ["A", "C"],
      [
        change(s, "A-flight-oct", "flight-late"),
        change(s, "A-seat-oct", "oct-34C"),
        change(s, "C-seat-oct", "oct-34B"),
      ],
      { A: 600, C: 100 },
    );
    Object.assign(c, {
      issuance: 700,
      budget: "recovery",
      event: "recovery-oct-548-original-A",
      value: s.economics.marginalValue,
      cost: s.economics.executionCost,
      risk: s.economics.riskReserve,
      conditions: [
        "Move to CX 550, departing two hours later",
        "Lin receives aisle seat 34C. Ho receives seat 34B.",
        "Confirm the replacement flight and both seats before releasing the reward",
      ],
      prerequisites: [
        "Capacity remains available on the replacement flight",
        "Both travellers have a valid request authorization or accept this arrangement",
      ],
    });
    list.push(c);
  }
  if (alloc(s, "A-bag-nov")?.resource === null) {
    const c = base(
      "future-bag",
      "An extra bag for Seoul",
      "Reserve one additional 23 kg checked bag for your November journey.",
      "redeem",
      ["A"],
      [change(s, "A-bag-nov", "nov-extra-bag")],
      { A: -200 },
    );
    Object.assign(c, {
      redemption: 200,
      cost:
        resource(s, "nov-extra-bag").serviceCost +
        resource(s, "nov-extra-bag").opportunityCost,
      conditions: [
        "Valid for Lin on the November Seoul journey",
        "200 Flex is redeemed when the baggage entitlement is confirmed",
      ],
      prerequisites: ["At least 200 Flex available"],
    });
    list.push(c);
  }
  if (alloc(s, "B-seat-dec")?.resource === "dec-regular") {
    const c = base(
      "preferred-redemption",
      "A preferred seat on a later journey",
      "Redeem earned Flex for an airline-owned Preferred seat on the December journey.",
      "redeem",
      ["B"],
      [change(s, "B-seat-dec", "dec-preferred")],
      { B: -100 },
    );
    Object.assign(c, {
      redemption: 100,
      cost:
        resource(s, "dec-preferred").serviceCost +
        resource(s, "dec-preferred").opportunityCost,
      conditions: [
        "December journey to Taipei",
        "Confirm product eligibility and the new seat together",
      ],
      prerequisites: ["Chen needs at least 100 Flex available"],
    });
    list.push(c);
  }
  for (const [id, p, key, from, to, title] of [
    [
      "ho-redemption",
      "C",
      "C-seat-future",
      "c-future-regular",
      "c-future-preferred",
      "A Preferred seat for Ho’s next journey",
    ],
    [
      "zoe-redemption",
      "D",
      "D-seat-future",
      "d-future-regular",
      "d-future-aisle",
      "An advance aisle reservation for Zoe",
    ],
  ] as const) {
    if (alloc(s, key)?.resource === from) {
      const r = resource(s, to);
      const c = base(
        id,
        title,
        "Use verified rewards for a concrete seat entitlement on a later journey. Prices are synthetic pilot assumptions.",
        "redeem",
        [p],
        [change(s, key, to)],
        { [p]: -r.q },
      );
      Object.assign(c, {
        redemption: r.q,
        cost: r.serviceCost + r.opportunityCost,
        experimental: true,
        conditions: [
          `Confirm ${r.label} before redeeming ${r.q} Flex`,
          "This pilot price is synthetic. Availability and eligibility are rechecked.",
        ],
        prerequisites: [`At least ${r.q} Flex available`],
      });
      list.push(c);
    }
  }
  // Enumerate simple cycles from confirmed, editable preferences within a journey and product.
  const seats = s.allocations.filter(
    (a) =>
      a.resource &&
      resource(s, a.resource).kind === "seat" &&
      !(
        s.scenarioId === "lin-family" &&
        ["story-taipei", "story-tokyo"].includes(
          resource(s, a.resource).journey,
        )
      ),
  );
  const found = new Set<string>();
  for (const start of seats) {
    const walk = (path: typeof seats) => {
      const last = path[path.length - 1];
      for (const wanted of s.seatWishes[last.key] || []) {
        const owner = seats.find((a) => a.resource === wanted);
        if (!owner || owner.key === last.key) continue;
        const r = resource(s, last.resource!),
          target = resource(s, wanted);
        if (r.journey !== target.journey || r.product !== target.product)
          continue;
        if (owner.key === start.key && path.length > 1) {
          const keys = path.map((a) => a.key);
          const group = [...keys].sort().join("|");
          const canonical = path
            .map((a, i) => `${a.key}>${path[(i + 1) % path.length].resource}`)
            .sort()
            .join("|");
          if (found.has(canonical)) continue;
          found.add(canonical);
          const ps = path.map((a) => a.person);
          if (new Set(ps).size !== ps.length) continue;
          const changes = path.map((a, i) =>
            change(s, a.key, path[(i + 1) % path.length].resource),
          );
          const credits = Object.fromEntries(
            path.map((a, i) => [
              a.person,
              resource(s, a.resource!).q -
                resource(s, path[(i + 1) % path.length].resource!).q,
            ]),
          );
          const isPair = group === "A-seat-nov|B-seat-nov",
            isRing = canonical === "D-ring>ring-B|E-ring>ring-C|F-ring>ring-A";
          const c = base(
            isPair
              ? "seat-pair"
              : isRing
                ? "cycle-DEF"
                : `exchange-${canonical}`,
            isPair
              ? "An aisle seat for your next journey"
              : isRing
                ? "Three preferences. One complete exchange."
                : `${ps.length}-traveller seat exchange`,
            "Exchange allocated seats using confirmed preferences and fixed reference values.",
            "exchange",
            ps,
            changes,
            credits,
          );
          c.conditions = [
            "Same journey and seat product. Protected eligibility stays intact.",
            "Every traveller receives a seat they explicitly marked acceptable",
            "Fixed reference-value differences settle with zero net issuance",
          ];
          list.push(c);
        } else if (path.length < 4 && !path.some((a) => a.key === owner.key))
          walk([...path, owner]);
      }
    };
    walk([start]);
  }
  if (alloc(s, "D-meal")?.resource === "meal-d") {
    const c = base(
      "meal-release",
      "Skip a meal before production is committed",
      "Opt out of a standard meal. Earn a reward only after catering confirms one fewer meal in the production plan.",
      "earn",
      ["D"],
      [change(s, "D-meal", null)],
      { D: 30 },
    );
    Object.assign(c, {
      issuance: 30,
      budget: "catering",
      event: "catering-osaka-original-D",
      evidence: "catering_plan",
      value: 15,
      cost: 3,
      risk: 1,
      experimental: true,
      conditions: [
        "Zoe has confirmed no protected meal requirement",
        "Reward follows a verified reduction in the catering plan",
      ],
      prerequisites: ["The production plan can still be changed"],
    });
    list.push(c);
  }
  if (alloc(s, "A-handover")?.resource === "carry-a") {
    const c = base(
      "bag-handover",
      "Check your cabin bag voluntarily",
      "Help an airline-requested cabin loading adjustment. The reward follows physical baggage acceptance.",
      "earn",
      ["A"],
      [change(s, "A-handover", "checked-a")],
      { A: 100 },
    );
    Object.assign(c, {
      dependencies: [
        change(s, "A-flight-oct", alloc(s, "A-flight-oct").resource),
        change(s, "A-seat-oct", alloc(s, "A-seat-oct").resource),
      ],
      issuance: 100,
      budget: "baggage",
      event: "handover-oct-original-A",
      evidence: "baggage_handover",
      value: 45,
      cost: 15,
      risk: 5,
      experimental: true,
      conditions: [
        "Compliant 7 kg bag with simulated hold-capacity and weight checks",
        "Reward follows physical acceptance and a baggage-tag receipt",
      ],
      prerequisites: [
        "Replacement journey confirmed",
        "No specific overhead space or arrival sequence is promised",
      ],
    });
    list.push(c);
  }
  return list;
}
function locks(c: Candidate) {
  return new Set(
    [...c.changes, ...c.dependencies].flatMap((x) => [
      x.key,
      ...[x.from, x.to].filter(Boolean),
    ]),
  );
}
function compatible(s: State, a: Candidate, b: Candidate) {
  return !candidatePlansConflict(s, a, b);
}
function manualConsentState(state: State, person: string): State {
  const s = structuredClone(state);
  s.intents ||= {};
  s.intents[person] = (s.intents[person] || [])
    .map((record) =>
      intentPurpose(record) === "flexibility"
        ? {
            ...record,
            rules: record.rules.filter(
              (rule) =>
                !["seat_position", "seating_together"].includes(
                  rule.effect.kind,
                ),
            ),
          }
        : record,
    )
    .filter((record) => record.rules.length);
  s.intents[person].push({
    id: "one-arrangement-seat-choice",
    purpose: "flexibility",
    sourceText:
      "I will review this particular seat arrangement before accepting it.",
    scope: { kind: "all" },
    rules: [
      {
        id: "seat-choice",
        evidence: "this particular seat arrangement",
        when: [],
        effect: {
          kind: "seat_position",
          positions: ["aisle", "window", "middle"],
        },
        strength: "flexible",
      },
    ],
    questions: [],
    confirmed: true,
    revision: 1,
  });
  return s;
}
export type DiscoveryOpportunity = Candidate & {
  blocked: string[];
  fitsFlexibility: boolean;
  discoveryReason: string;
};
export function discoverOpportunities(
  s: State,
  person: string,
): DiscoveryOpportunity[] {
  if (!s.people.some((p) => p.id === person)) return [];
  const automatic = market(s).filter((c) => c.participants.includes(person));
  if (!s.intents)
    return automatic.map((c) => ({
      ...c,
      fitsFlexibility: true,
      discoveryReason: "Matches your saved flexibility.",
    }));
  const manual = manualConsentState(s, person);
  const offers = market(manual).filter(
    (c) =>
      c.participants.includes(person) &&
      c.changes.some(
        (ch) =>
          s.allocations.find((a) => a.key === ch.key)?.person === person &&
          !!ch.to &&
          resource(s, ch.to)?.kind === "seat",
      ),
  );
  const union = new Map(
    automatic.map(
      (c) =>
        [
          c.id,
          {
            ...c,
            fitsFlexibility: true,
            discoveryReason: "Matches your saved flexibility.",
          },
        ] as [string, DiscoveryOpportunity],
    ),
  );
  for (const c of offers) {
    const existing = union.get(c.id);
    if (existing && !existing.blocked.length) continue;
    const choice = { ...c, manualPerson: person };
    const blocked = validate(s, choice);
    if (!blocked.length)
      union.set(c.id, {
        ...choice,
        blocked,
        fitsFlexibility: false,
        discoveryReason:
          "A seat choice beyond your saved flexibility. Your saved settings stay unchanged.",
      });
  }
  return [...union.values()].slice(0, 192);
}
function requestTermsCover(
  s: State,
  c: Candidate,
  person: string,
  record: IntentRecord,
) {
  if (record.scope.kind !== "journey") return false;
  const journey = record.scope.journeyId;
  const facts = journeyFacts(s, person, journey);
  const goals = record.rules.filter(
    (rule) =>
      rule.strength !== "flexible" &&
      rule.effect.kind !== "credit_budget" &&
      ruleConditionMatches(facts, rule) === true,
  );
  const own = c.changes.filter(
    (ch) => alloc(s, ch.key)?.person === person && ch.from !== ch.to,
  );
  const projected: State = {
    ...s,
    contracts: s.contracts.filter(
      (contract) => contract.status !== "RECONCILING",
    ),
    allocations: s.allocations.map((a) => {
      const change = c.changes.find((ch) => ch.key === a.key);
      return change ? { ...a, resource: change.to } : a;
    }),
  };
  const satisfied = (rule: (typeof goals)[number]) => {
    if (rule.effect.kind !== "departure_window")
      return requestGoalSatisfied(projected, person, journey, rule);
    const effect = rule.effect;
    const flight = own.find(
      (ch) => ch.to && resource(s, ch.to)?.kind === "flight",
    );
    if (!flight?.to)
      return requestGoalSatisfied(projected, person, journey, rule);
    const from = flight.from ? resource(s, flight.from) : undefined;
    const to = resource(s, flight.to);
    const departure = simulationEpoch(s) + to.serviceHour * 3600000;
    return (
      Number.isFinite(departure) &&
      !!(
        effect.earliest ||
        effect.latest ||
        effect.maxDelayMinutes !== undefined
      ) &&
      (!effect.earliest || departure >= Date.parse(effect.earliest)) &&
      (!effect.latest || departure <= Date.parse(effect.latest)) &&
      (effect.maxDelayMinutes === undefined ||
        (!!from &&
          (to.serviceHour - from.serviceHour) * 60 <= effect.maxDelayMinutes))
    );
  };
  const applies = (ch: Change) =>
    [ch.from, ch.to].some((id) => id && resource(s, id)?.journey === journey);
  const covered = own.every((ch) => {
    if (!applies(ch)) return false;
    const kind = resource(s, (ch.to || ch.from)!)?.kind;
    return goals.some(
      (rule) =>
        satisfied(rule) &&
        ((kind === "seat" &&
          ["seat_position", "seating_together"].includes(rule.effect.kind)) ||
          (kind === "flight" && rule.effect.kind === "departure_window") ||
          (kind === "baggage" && rule.effect.kind === "baggage" && !!ch.to) ||
          (kind === "meal" && rule.effect.kind === "meal") ||
          (kind === "handover" && rule.effect.kind === "gate_check")),
    );
  });
  const baggageGoals = goals.filter((rule) => rule.effect.kind === "baggage");
  if (
    own.some(
      (change) => change.to && resource(s, change.to)?.kind === "baggage",
    )
  ) {
    const authorizedPieces = Math.max(
      0,
      ...baggageGoals.map((rule) =>
        rule.effect.kind === "baggage" ? rule.effect.extraPieces : 0,
      ),
    );
    const projectedPieces = projected.allocations
      .filter((allocation) => allocation.person === person)
      .reduce((total, allocation) => {
        const assigned = allocation.resource
          ? resource(s, allocation.resource)
          : undefined;
        return (
          total +
          (assigned?.kind === "baggage" && assigned.journey === journey
            ? assigned.baggage?.pieces || 0
            : 0)
        );
      }, 0);
    if (projectedPieces > authorizedPieces) return false;
  }
  const improves = goals.some(
    (rule) =>
      !requestGoalSatisfied(s, person, journey, rule) && satisfied(rule),
  );
  return (
    own.length > 0 &&
    covered &&
    improves &&
    (record.authorization?.allowPartial !== false || goals.every(satisfied))
  );
}
export function candidateRequestAuthorization(
  s: State,
  c: Candidate,
  person: string,
  except?: string,
) {
  // Manual browsing remains an explicit one-arrangement choice.
  if (c.manualPerson === person || bookingPlanErrors(s, c).length)
    return undefined;
  const records = (c.requestRefs || [])
    .filter((ref) => ref.person === person)
    .flatMap((ref) => {
      const record = s.intents?.[person]?.find(
        (record) =>
          record.id === ref.intentId && record.revision === ref.revision,
      );
      return record ? [record] : [];
    });
  for (const record of records) {
    const authorization = record.authorization;
    if (
      !authorization ||
      authorization.mode !== "fixed_quote" ||
      !authorization.quote ||
      authorization.quote.targetRevision !== record.revision ||
      authorization.allowPartial !== false ||
      !record.confirmed ||
      record.cancelled ||
      record.questions.length ||
      authorization.termsRevision !== record.revision ||
      authorization.validUntil <= s.hour
    )
      continue;
    const status = requestAuthorizationStatus(s, person, record);
    const ownHold = except
      ? requestContracts(s, person, record.id, undefined, record.revision).find(
          (contract) => contract.contractId === except,
        )
      : undefined;
    const remaining =
      authorization.maxCredits -
      status.spent -
      status.committed +
      (ownHold ? debit(ownHold, person) : 0);
    if (
      remaining < debit(c, person) ||
      !acceptedQuoteContextCurrent(s, person, record, authorization.quote) ||
      !quoteCoversCandidate(s, person, authorization.quote, c) ||
      !requestTermsCover(s, c, person, record)
    )
      continue;
    return {
      intentId: record.id,
      revision: record.revision,
      ...authorization,
      debit: debit(c, person),
    };
  }
  return undefined;
}
export function contractConsentReadiness(
  s: State,
  c: Contract,
  person: string,
) {
  const highImpact = c.changes.some(
    (ch) =>
      alloc(s, ch.key)?.person === person &&
      ch.from !== ch.to &&
      [ch.from, ch.to].some((id) => id && resource(s, id)?.kind === "flight"),
  );
  const accepted = c.accepted.includes(person);
  const acceptedCount = c.consentSummary?.accepted ?? c.accepted.length;
  const total = c.consentSummary?.total ?? c.participants.length;
  const waitingForOthers = acceptedCount - (accepted ? 1 : 0) < total - 1;
  const closed = !["HELD", "ACCEPTED"].includes(c.status);
  const mode = closed
    ? ("closed" as const)
    : c.authorizations?.[person]
      ? ("authorized" as const)
      : accepted
        ? ("accepted" as const)
        : waitingForOthers
          ? ("coordination" as const)
          : ("ready" as const);
  return {
    highImpact,
    waitingForOthers,
    mode,
    canAccept: !closed && !accepted && (!highImpact || !waitingForOthers),
  };
}
function bookingPlanErrors(s: State, c: Candidate): string[] {
  const errors: string[] = [];
  const affected = new Set<string>();
  for (const change of c.changes) {
    const allocation = alloc(s, change.key);
    if (!allocation) continue;
    const from = change.from ? resource(s, change.from) : undefined;
    const to = change.to ? resource(s, change.to) : undefined;
    const expectedKind = from?.kind || allocation.resourceKind;
    if (to && expectedKind && to.kind !== expectedKind)
      errors.push(
        "An entitlement cannot be replaced with a different resource type.",
      );
    const bookedJourney = from?.journey || allocation.journeyId;
    if (to && bookedJourney && to.journey !== bookedJourney)
      errors.push("An entitlement must remain on its booked journey.");
    if (
      from?.kind === "flight" &&
      to?.kind === "flight" &&
      (from.journey !== to.journey || from.product !== to.product)
    )
      errors.push(
        "A departure change must preserve the booked route and cabin.",
      );
    if (
      from?.kind === "seat" &&
      to?.kind === "seat" &&
      from.serviceHour !== to.serviceHour &&
      !c.changes.some(
        (flightChange) =>
          alloc(s, flightChange.key)?.person === allocation.person &&
          flightChange.to &&
          resource(s, flightChange.to)?.kind === "flight" &&
          resource(s, flightChange.to)?.journey === to.journey &&
          resource(s, flightChange.to)?.serviceHour === to.serviceHour,
      )
    )
      errors.push(
        "A seat change must stay on the booked flight or accompany a confirmed departure change.",
      );
    if (
      from?.kind === "flight" ||
      to?.kind === "flight" ||
      from?.kind === "seat" ||
      to?.kind === "seat"
    )
      affected.add(allocation.person);
  }
  for (const person of affected) {
    const assigned = s.allocations
      .filter((allocation) => allocation.person === person)
      .flatMap((allocation) => {
        const update = c.changes.find(
          (change) => change.key === allocation.key,
        );
        const id = update ? update.to : allocation.resource;
        const item = id ? resource(s, id) : undefined;
        return item ? [item] : [];
      });
    for (const seat of assigned.filter((item) => item.kind === "seat")) {
      const flights = assigned.filter(
        (item) => item.kind === "flight" && item.journey === seat.journey,
      );
      if (
        flights.length &&
        !flights.some((flight) => flight.serviceHour === seat.serviceHour)
      )
        errors.push(
          "The complete arrangement must confirm seats on the replacement flight.",
        );
    }
  }
  const projected: State = {
    ...s,
    allocations: s.allocations.map(allocation => {
      const change = c.changes.find(item => item.key === allocation.key);
      return change ? { ...allocation, resource: change.to } : allocation;
    }),
  };
  for (const person of c.participants) {
    const journeys = new Set(c.changes.filter(change => alloc(s, change.key)?.person === person).flatMap(change => {
      const allocation = alloc(s, change.key);
      return [allocation?.journeyId, change.from ? resource(s, change.from)?.journey : undefined, change.to ? resource(s, change.to)?.journey : undefined].filter((journey): journey is string => !!journey);
    }));
    for (const journey of journeys) errors.push(...conditionalOutcomeIssues(s, projected, person, journey));
  }
  return [...new Set(errors)];
}
export function validate(s: State, c: Candidate, except?: string): string[] {
  const source = s;
  const recordedContract =
    "contractId" in c
      ? source.contracts.find(
          (contract) => contract.contractId === c.contractId,
        )
      : undefined;
  const legacyConsent = recordedContract?.legacyConsent || {};
  const signed =
    !!recordedContract &&
    recordedContract.accepted.length === recordedContract.participants.length;
  if (signed && recordedContract.authorizations) {
    // Once all parties have committed, the request clock cannot interrupt an
    // adapter write or remove funds needed for authoritative reconciliation.
    s = {
      ...s,
      intents: Object.fromEntries(
        Object.entries(s.intents || {}).map(([person, records]) => [
          person,
          records.map((record) => {
            const authorization = recordedContract.authorizations?.[person];
            return authorization?.intentId === record.id &&
              authorization.revision === record.revision &&
              record.authorization
              ? {
                  ...record,
                  authorization: {
                    ...record.authorization,
                    validUntil: Math.max(
                      record.authorization.validUntil,
                      s.hour + 1,
                    ),
                  },
                }
              : record;
          }),
        ]),
      ),
    };
  }
  const usesLegacy = (person: string) =>
    !s.intents || Object.hasOwn(legacyConsent, person);
  const legacyState = {
    ...s,
    preferences: {
      ...s.preferences,
      ...Object.fromEntries(
        Object.entries(legacyConsent).map(([person, entry]) => [
          person,
          entry.preferences,
        ]),
      ),
    },
    seatWishes: {
      ...s.seatWishes,
      ...Object.assign(
        {},
        ...Object.values(legacyConsent).map((entry) => entry.seatWishes),
      ),
    },
  };
  if (c.manualPerson && c.participants.includes(c.manualPerson))
    s = manualConsentState(s, c.manualPerson);
  const errors: string[] = [
    ...bookingPlanErrors(s, c),
    ...(s.intents
      ? genericIntentErrors(
          s,
          {
            ...c,
            participants: c.participants.filter(
              (person) => !usesLegacy(person),
            ),
          },
          partySeating,
          except,
        )
      : []),
  ];
  if (c.manualPerson && !c.participants.includes(c.manualPerson))
    errors.push("The manual choice belongs to an offer participant");
  for (const ref of c.requestRefs || []) {
    const record = source.intents?.[ref.person]?.find(
      (record) => record.id === ref.intentId,
    );
    if (
      !record ||
      record.cancelled ||
      !record.confirmed ||
      record.revision !== ref.revision
    )
      errors.push(
        "A supporting request has changed. Review the current offer.",
      );
    if (
      record?.authorization &&
      record.authorization.validUntil <= source.hour &&
      !signed
    )
      errors.push(
        "A supporting request has expired. Its authorization is no longer available.",
      );
  }
  if (
    ![
      c.issuance,
      c.redemption,
      c.value,
      c.cost,
      c.risk,
      ...Object.values(c.credits),
    ].every(Number.isFinite) ||
    c.issuance < 0 ||
    c.redemption < 0 ||
    c.cost < 0 ||
    c.risk < 0
  )
    errors.push("The offer contains invalid financial amounts");
  if (
    Object.keys(c.credits).some(
      (p) => !c.participants.includes(p) || s.wallets[p] === undefined,
    )
  )
    errors.push("Credit movements must belong to verified offer participants");
  if (c.requiredEvents?.some((event) => !s.usedEvents.includes(event)))
    errors.push("A prerequisite delivery event has not been verified");
  if (c.availableFrom !== undefined && s.hour < c.availableFrom)
    errors.push("This journey request is not open yet");
  if (s.hour >= c.deadline) errors.push("The operating deadline has passed");
  if (c.event && s.usedEvents.includes(c.event))
    errors.push("This original entitlement has already earned its reward");
  if (!s.intents || Object.keys(legacyConsent).length) {
    if (
      usesLegacy("A") &&
      c.id === "flight-bundle" &&
      (!legacyState.preferences.A.confirmed ||
        legacyState.preferences.A.maxDelayHours < 2)
    )
      errors.push("Lin has not agreed to a two-hour delay");
    if (
      usesLegacy("C") &&
      c.id === "flight-bundle" &&
      !legacyState.seatWishes["C-seat-oct"]?.includes("oct-34B")
    )
      errors.push("Ho has not accepted the alternative seat");
    if (
      usesLegacy("D") &&
      c.id === "meal-release" &&
      (!legacyState.preferences.D.confirmed ||
        !legacyState.preferences.D.allowMealSkip)
    )
      errors.push("Zoe has not agreed to skip the standard meal");
    if (
      usesLegacy("A") &&
      c.id === "bag-handover" &&
      (!legacyState.preferences.A.allowGateCheck ||
        alloc(s, "A-flight-oct").resource !== "flight-late" ||
        !s.usedEvents.includes("recovery-oct-548-original-A"))
    )
      errors.push(
        "First confirm the complete replacement journey and voluntary bag check",
      );
  }
  for (const p of c.participants) {
    if (usesLegacy(p) && !legacyState.preferences[p]?.confirmed)
      errors.push(`${name(s, p)} has not confirmed their preferences`);
    const authorization =
      recordedContract?.authorizations?.[p] ||
      candidateRequestAuthorization(s, c, p, except);
    const authorizedRecord = authorization
      ? s.intents?.[p]?.find((record) => record.id === authorization.intentId)
      : undefined;
    const funding = authorizedRecord
      ? requestAuthorizationStatus(s, p, authorizedRecord)
      : undefined;
    const ownHeld =
      recordedContract && active(recordedContract)
        ? debit(recordedContract, p)
        : 0;
    const earmark = funding
      ? Math.max(0, funding.reserved - funding.committed)
      : 0;
    if (s.wallets[p] - held(s, p, except) + earmark + (c.credits[p] || 0) < 0)
      errors.push(`${name(s, p)} has insufficient available Flex`);
    if (
      authorization &&
      authorizedRecord &&
      funding &&
      funding.spent + funding.committed - ownHeld + debit(c, p) >
        authorization.maxCredits
    )
      errors.push(
        "The arrangement exceeds this request's reserved fixed quote.",
      );
    if (authorization?.mode === "fixed_quote" && authorization.quote && !signed && !quoteCoversCandidate(s, p, authorization.quote, c))
      errors.push("The arrangement does not match the exact products and prices in the accepted quote.");
    for (const ref of c.requestRefs?.filter((ref) => ref.person === p) || []) {
      const record = s.intents?.[p]?.find(
        (record) => record.id === ref.intentId,
      );
      if (
        record?.authorization?.allowPartial === false &&
        !requestTermsCover(s, c, p, record)
      )
        errors.push(
          "This request requires all requested changes in one arrangement.",
        );
      if (record?.authorization?.mode === "fixed_quote") {
        if (!signed && (!record.authorization.quote || !acceptedQuoteContextCurrent(s, p, record, record.authorization.quote) || !quoteCoversCandidate(s, p, record.authorization.quote, c)))
          errors.push("The request or booking no longer matches the accepted fixed quote. Review a new quote.");
        if (!requestTermsCover(s, c, p, record))
          errors.push(
            "The proposed changes fall outside this request's authorized terms.",
          );
        const request = requestAuthorizationStatus(s, p, record);
        const existingDebit =
          recordedContract &&
          requestContracts(s, p, record.id).some(
            (item) => item.contractId === recordedContract.contractId,
          ) &&
          active(recordedContract)
            ? debit(recordedContract, p)
            : 0;
        if (
          request.spent + request.committed - existingDebit + debit(c, p) >
          record.authorization.maxCredits
        )
          errors.push(
            "The arrangement exceeds this request's reserved fixed quote.",
          );
      }
    }
    const need = usesLegacy(p)
      ? legacyConsent[p]?.need || s.needs?.[p]
      : undefined;
    if (
      need &&
      (c.credits[p] || 0) < 0 &&
      c.changes.some(
        (ch) => ch.to && resource(s, ch.to)?.journey === need.journeyId,
      )
    ) {
      const committed = s.contracts
        .filter(
          (old) =>
            old.contractId !== except &&
            (old.status === "SETTLED" || active(old)) &&
            old.changes.some(
              (ch) => ch.to && resource(s, ch.to)?.journey === need.journeyId,
            ),
        )
        .reduce((n, old) => n + Math.max(0, -(old.credits[p] || 0)), 0);
      if (committed - c.credits[p] > need.maxCredits)
        errors.push(
          `${name(s, p)}’s confirmed journey credit limit would be exceeded`,
        );
    }
  }
  for (const old of s.contracts.filter(
    (x) => active(x) && x.contractId !== except,
  ))
    if (!compatible(s, c, old))
      errors.push("A related resource is reserved by another contract");
  if (c.issuance) {
    const catalogueFloor = Math.max(
      0,
      ...s.resources
        .filter((r) => r.serviceCost + r.opportunityCost > 0)
        .map((r) => (r.serviceCost + r.opportunityCost) / r.q),
    );
    const rate =
      c.budget === "recovery"
        ? s.economics.stressCost
        : s.budgets.find((b) => b.id === c.budget)?.stressCost || 0;
    if (rate < catalogueFloor)
      errors.push(
        "The stress rate does not cover the redemption catalogue costs",
      );
    const b = s.budgets.find((x) => x.id === c.budget);
    const reserved = s.contracts
      .filter(
        (x) => active(x) && x.contractId !== except && x.budget === c.budget,
      )
      .reduce((n, x) => n + x.issuance, 0);
    if (!b || b.limit - b.issued - reserved < c.issuance)
      errors.push("The issuance budget is insufficient");
    if (
      b &&
      c.value -
        c.cost -
        c.risk -
        c.issuance *
          (c.budget === "recovery" ? s.economics.stressCost : b.stressCost) <
        0
    )
      errors.push(
        "The arrangement has insufficient value under the stress-cost assumptions",
      );
  }
  if (
    Object.values(c.credits).reduce((a, b) => a + b, 0) !==
    c.issuance - c.redemption
  )
    errors.push("Contract credit flows do not balance");
  for (const ch of [...c.changes, ...c.dependencies]) {
    const a = alloc(s, ch.key);
    if (!a || a.version !== ch.version || a.resource !== ch.from) {
      errors.push("The entitlement changed. Request a new offer.");
      if (!a) continue;
    }
    if (ch.to) {
      const r = resource(s, ch.to);
      if (!r) errors.push("The resource does not exist");
      else if (
        r.kind === "seat" &&
        usesLegacy(a.person) &&
        legacyState.preferences[a.person]?.requireAisle &&
        r.seatPosition !== "aisle"
      )
        errors.push(`${name(s, a.person)} requires an aisle seat`);
      else if (r.eligible.length && !r.eligible.includes(a.person))
        errors.push(
          "The traveller is not eligible for the destination product",
        );
      if (r?.kind === "seat") {
        const preferred = usesLegacy(a.person)
          ? effectiveSeatPreference(legacyState, a.person, r.journey)
          : "any";
        const before = ch.from ? resource(s, ch.from) : undefined;
        if (
          ["aisle", "window"].includes(preferred) &&
          before?.seatPosition === preferred &&
          r.seatPosition !== preferred
        )
          errors.push(
            `${name(s, a.person)} would give up an already confirmed preferred ${preferred} seat`,
          );
        if (
          r.seatMap?.exitRow &&
          (s.people.find((p) => p.id === a.person)?.age ?? 18) < 15
        )
          errors.push("A child cannot be allocated an exit-row seat");
      }
      if (
        r?.kind === "baggage" &&
        r.baggage &&
        r.baggage.passenger !== a.person
      )
        errors.push(
          "Baggage entitlements cannot be transferred to another passenger",
        );
    }
  }
  for (const party of s.parties || []) {
    const after = partySeating(s, party.id, c.changes);
    if (!after.guardiansProtected)
      errors.push("Protected child and guardian adjacency must remain intact");
    if (c.partyId === party.id && !after.together)
      errors.push(
        "The complete family must receive adjacent seats in the same seat block",
      );
    if (
      c.participants.some(
        (person) => party.memberIds.includes(person) && usesLegacy(person),
      ) &&
      partySeating(s, party.id).together &&
      !after.together
    )
      errors.push(
        "An existing family seating arrangement cannot be split by an exchange",
      );
  }
  const projected = s.allocations.map((a) => ({
    ...a,
    resource:
      c.changes.find((x) => x.key === a.key)?.to === undefined
        ? a.resource
        : c.changes.find((x) => x.key === a.key)!.to,
  }));
  for (const r of s.resources) {
    const reserved = s.contracts.filter((old) => active(old) && old.contractId !== except)
      .reduce((total, old) => total + (outstandingCapacityDemand(s, old).get(r.id) || 0), 0);
    const n =
      r.background + projected.filter((a) => a.resource === r.id).length;
    if (n + reserved > r.capacity - r.protected)
      errors.push(`${r.label} has insufficient allocatable capacity`);
  }
  return [...new Set(errors)];
}
export function market(s: State) {
  return candidates(s).map((c) => ({ ...c, blocked: validate(s, c) }));
}
function originalContractAllocationView(state: State, contract: Contract): State {
  // Restore only this contract's changed rights for validation. Unchanged
  // dependencies retain their authoritative values and must still match.
  const original = new Map(contract.changes.map((change) => [change.key, change]));
  return {
    ...state,
    allocations: state.allocations.map((allocation) => {
      const change = original.get(allocation.key);
      return change
        ? { ...allocation, resource: change.from, version: change.version }
        : allocation;
    }),
  };
}
function assertReservedArrangementsRemainValid(state: State, person: string) {
  const conflicts = state.contracts
    .filter(
      (contract) => active(contract) && contract.participants.includes(person),
    )
    .filter((contract) => {
      // Adapter progress changes the allocation version. Validate the promised
      // arrangement against its original rights without touching actual progress.
      const view =
        contract.status === "RECONCILING"
          ? originalContractAllocationView(state, contract)
          : state;
      return validate(view, contract, contract.contractId).length > 0;
    });
  if (conflicts.length)
    throw new FlexError(
      "RESERVED_OFFER_CONFLICT",
      conflicts.some((contract) => contract.status === "RECONCILING")
        ? "A booking change is being confirmed. You can save this update when it finishes."
        : "This change conflicts with a reserved offer. Complete or decline that offer before saving this change.",
      conflicts.map((contract) => contract.contractId),
    );
}
export const OPTIMIZER_NODE_LIMIT = 20000;
/** Bind funding only after checking the exact accepted request and its revision. */
export function candidateSelectionFunding(s: State, candidates: Candidate[]): Pick<SelectionOptions,
  "availableCredits" | "creditEarmarks" | "candidateCreditEarmarks"> {
  const availableCredits = Object.fromEntries(Object.keys(s.wallets).map((person) => [person, Math.max(0, available(s, person))]));
  const creditEarmarks: NonNullable<SelectionOptions["creditEarmarks"]> = {};
  const candidateCreditEarmarks: NonNullable<SelectionOptions["candidateCreditEarmarks"]> = {};
  for (const candidate of candidates) {
    for (const person of candidate.participants) {
      if (!debit(candidate, person)) continue;
      const authorization = candidateRequestAuthorization(s, candidate, person);
      if (!authorization) continue;
      const record = s.intents?.[person]?.find((record) => record.id === authorization.intentId && record.revision === authorization.revision);
      if (!record) continue;
      const funding = requestAuthorizationStatus(s, person, record);
      const amount = Math.max(0, funding.reserved - funding.committed);
      if (!amount) continue;
      const id = JSON.stringify([person, record.id, record.revision]);
      creditEarmarks[id] = {person, amount};
      (candidateCreditEarmarks[candidate.id] ||= {})[person] = id;
    }
  }
  return {availableCredits, creditEarmarks, candidateCreditEarmarks};
}
export function optimize(s: State, options: { nodeLimit?: number } = {}) {
  const generated = s.intents
    ? generateGenericMarket(s, partySeating)
    : undefined;
  const raw = generated?.candidates ?? candidates(s);
  const generation: GenerationDiagnostics = generated?.diagnostics ?? {
    complete: true,
    reason: null,
    candidateCount: raw.length,
    candidateLimit: raw.length,
    seatCandidateLimit: raw.length,
    workLimit: 0,
    visited: 0,
    bundleAttempts: 0,
  };
  const all = raw.filter((candidate) => validate(s, candidate).length === 0);
  const selection = solveCandidateSelection(s, all, {
    nodeLimit: options.nodeLimit ?? OPTIMIZER_NODE_LIMIT,
    ...candidateSelectionFunding(s, all),
  });
  const fullyExplored = generation.complete && selection.complete;
  return {
    selected: selection.selected,
    // Kept for existing clients. This coefficient is a model score, not welfare
    // or a count of completed requests. The explicit policy fields remove ambiguity.
    coveredParticipants: selection.objective[0],
    modelScore: selection.objective[0],
    stressNetValue: selection.objective[1] / 100,
    candidateCount: selection.candidateCount,
    visited: selection.visited,
    status: fullyExplored
      ? ("EXACT_WITHIN_ENUMERATED_CANDIDATES" as const)
      : ("BOUNDED_RECOMMENDATION" as const),
    gap: fullyExplored ? 0 : null,
    generation,
    search: {complete: selection.complete, nodeLimit: selection.nodeLimit, visited: selection.visited},
    optimality: selection.complete
      ? ("proven_within_generated_set" as const)
      : ("unproven" as const),
    objective: selection.objective,
    objectiveNames: ["model_gain", "stress_net_minor_units", "negative_credit_issuance"],
    upperBound: selection.upperBound,
    firstUnresolvedTier: selection.firstUnresolvedTier,
    absoluteGapAtFirstUnresolvedTier: selection.absoluteGapAtFirstUnresolvedTier,
    boundScope: "supplied_validated_candidates_only" as const,
    reservationPolicy: selection.reservationPolicy,
    selectionRejected: selection.rejected,
  };
}

function audit(s: State, message: string) {
  s.audit.push({ hour: s.hour, message });
}
function expire(s: State) {
  for (const c of s.contracts) {
    const signedAuthorization =
      !!c.authorizations && c.accepted.length === c.participants.length;
    const requestExpired =
      c.status === "HELD" &&
      Object.values(c.authorizations || {}).some(
        (authorization) => authorization.validUntil <= s.hour,
      );
    if (
      (["HELD", "ACCEPTED"].includes(c.status) &&
        s.hour >= c.expires &&
        !signedAuthorization) ||
      requestExpired
    ) {
      c.status = "EXPIRED";
      c.log.push(
        "The offer expired. Credit and resource reservations were released.",
      );
    }
    if (c.status === "AWAITING_EVIDENCE" && s.hour >= c.deadline) {
      c.status = "FAILED";
      c.log.push(
        "No delivery evidence arrived before the deadline. No resource changes or rewards. Reservations released.",
      );
    }
  }
}
function verify(s: State, c: Contract) {
  return (
    c.changes.every((ch) => alloc(s, ch.key).resource === ch.to) &&
    (!c.evidence || c.receipts.some((r) => r.startsWith(c.evidence!)))
  );
}
function settle(s: State, c: Contract) {
  if (c.status === "SETTLED") return;
  assert(
    verify(s, c),
    "NOT_VERIFIED",
    "Not all resources and delivery receipts are verified",
  );
  assert(
    !c.event || !s.usedEvents.includes(c.event),
    "DUPLICATE_EVENT",
    "This operating event has already settled",
  );
  for (const [p, v] of Object.entries(c.credits)) s.wallets[p] += v;
  if (c.issuance)
    s.budgets.find((b) => b.id === c.budget)!.issued += c.issuance;
  if (c.event) s.usedEvents.push(c.event);
  s.ledger.push({
    id: `L-${s.ledger.length + 1}`,
    contract: c.contractId,
    hour: s.hour,
    title: c.title,
    credits: { ...c.credits },
    issuance: c.issuance,
    redemption: c.redemption,
  });
  c.status = "SETTLED";
  c.log.push(
    "Every adapter target was verified. The ledger settled once and reservations were released.",
  );
  audit(s, `${c.contractId} verified and settled.`);
}
function apply(s: State, c: Contract, fault: string = "none") {
  const groups = [
    ...new Set(c.changes.map((ch) => resource(s, (ch.to || ch.from)!).kind)),
  ];
  let index = 0;
  for (const kind of groups) {
    const changes = c.changes.filter(
      (ch) => resource(s, (ch.to || ch.from)!).kind === kind,
    );
    if (changes.every((ch) => alloc(s, ch.key).resource === ch.to)) continue;
    if (fault === "before_write" && index === 0) {
      c.status = "RECONCILING";
      c.log.push(
        `${kind} request timed out. The write outcome is unknown. Reservations remain until authoritative reconciliation.`,
      );
      return;
    }
    for (const ch of changes) {
      const a = alloc(s, ch.key);
      assert(
        a.resource === ch.from,
        "ADAPTER_CONFLICT",
        "Authoritative allocation conflicts with the contract. Manual intervention is required.",
      );
      a.resource = ch.to;
      a.version++;
    }
    c.receipts.push(`${kind}:${c.contractId}`);
    c.log.push(`${kind} adapter confirmed ${changes.length} changes.`);
    if (fault === "after_write" && index === 0) {
      c.status = "RECONCILING";
      c.log.push(
        "Simulated acknowledgement loss. Applied resources remain isolated while remaining steps await reconciliation.",
      );
      return;
    }
    index++;
  }
  settle(s, c);
}
function reserveCandidate(s: State, c: Candidate): Contract {
  const contract: Contract = {
    ...c,
    contractId: `F-${s.version + 1}-${s.contracts.length + 1}`,
    status: "HELD",
    accepted: [],
    created: s.hour,
    expires: Math.min(s.hour + 0.25, c.deadline),
    receipts: [],
    log: [
      "Resources and credits are reserved while the complete arrangement is coordinated.",
    ],
  };
  const authorizations = Object.fromEntries(
    c.participants.flatMap((person) => {
      const authorization = candidateRequestAuthorization(s, c, person);
      return authorization ? [[person, authorization]] : [];
    }),
  );
  if (Object.keys(authorizations).length) {
    contract.authorizations = authorizations;
    contract.accepted = Object.keys(authorizations);
    contract.expires = Math.min(
      contract.expires,
      ...Object.values(authorizations).map(
        (authorization) => authorization.validUntil,
      ),
    );
    contract.log.push(
      "Saved request authorizations cover their owners' exact changes and credit terms. Those travellers do not need to confirm again.",
    );
    if (contract.accepted.length === contract.participants.length)
      contract.status = "ACCEPTED";
  }
  s.contracts.push(contract);
  audit(
    s,
    `${contract.contractId} created with a bounded simulation-time reservation.`,
  );
  return contract;
}
function deliverAuthorized(
  s: State,
  contract: Contract,
  fault?: Command["fault"],
) {
  if (contract.status !== "ACCEPTED" || !contract.authorizations) return;
  if (fault === "reject") {
    contract.status = "FAILED";
    contract.log.push(
      "The adapter rejected execution before any write. No debit or issuance occurred.",
    );
  } else if (contract.evidence) {
    contract.status = "AWAITING_EVIDENCE";
    contract.log.push(
      "The complete arrangement is authorized. Delivery evidence is required before credits settle.",
    );
  } else apply(s, contract, fault);
}
function fulfilAuthorizedInventory(s: State) {
  // When every changed traveller has authorized the exact arrangement, no
  // further personal approval is needed. Work remains explicitly bounded.
  for (let i = 0; i < 8; i++) {
    const candidate = candidates(s).find(
      (candidate) =>
        candidate.participants.every(
          (person) => !!candidateRequestAuthorization(s, candidate, person),
        ) && !validate(s, candidate).length,
    );
    if (!candidate) return;
    deliverAuthorized(s, reserveCandidate(s, candidate));
  }
}
export function invariants(s: State) {
  const issued = s.ledger.reduce((n, l) => n + l.issuance, 0),
    redeemed = s.ledger.reduce((n, l) => n + l.redemption, 0),
    balance = Object.values(s.wallets).reduce((n, v) => n + v, 0);
  return [
    {
      name: "Credit conservation",
      ok: balance === issued - redeemed,
      detail: `Balance ${balance} = issued ${issued} − redeemed ${redeemed}`,
    },
    {
      name: "Valid credit reservations",
      ok: s.people.every((p) => available(s, p.id) >= 0),
      detail:
        "Available balances are nonnegative. Pending rewards cannot be spent.",
    },
    {
      name: "Capacity respected",
      ok: s.resources.every(
        (r) =>
          r.background +
            s.allocations.filter((a) => a.resource === r.id).length <=
          r.capacity - r.protected,
      ),
      detail: "Allocations remain within capacity after protected inventory.",
    },
    {
      name: "Unique reward events",
      ok: new Set(s.usedEvents).size === s.usedEvents.length,
      detail: "An original entitlement cannot earn the same reward twice.",
    },
    {
      name: "Budget reconciliation",
      ok: s.budgets.every(
        (b) =>
          b.issued <= b.limit &&
          b.issued ===
            s.ledger
              .filter(
                (l) =>
                  s.contracts.find((c) => c.contractId === l.contract)
                    ?.budget === b.id,
              )
              .reduce((n, l) => n + l.issuance, 0),
      ),
      detail: "Every issuance maps to its budget and contract.",
    },
    {
      name: "Idempotent settlement",
      ok: new Set(s.ledger.map((l) => l.contract)).size === s.ledger.length,
      detail: "Each contract has at most one ledger settlement.",
    },
    {
      name: "Protected family seating",
      ok: (s.parties || []).every(
        (party) => partySeating(s, party.id).guardiansProtected,
      ),
      detail:
        "Children remain beside their recorded guardian outside exit rows.",
    },
  ];
}
export function transition(input: State, cmd: Command): State {
  const signature = JSON.stringify({
    ...cmd,
    expectedVersion: undefined,
    requestId: undefined,
  });
  if (input.requests[cmd.requestId]) {
    assert(
      input.requests[cmd.requestId] === signature,
      "KEY_REUSED",
      "This idempotency key belongs to a different request",
    );
    return input;
  }
  assert(
    cmd.expectedVersion === input.version,
    "VERSION_CONFLICT",
    "The workspace changed. Refresh and try again.",
  );
  let s = structuredClone(input);
  expire(s);
  if (cmd.action === "story_advance") {
    assert(
      s.scenarioId === "lin-family",
      "STORY",
      "This workspace does not contain Lin’s story",
    );
    const next = nextStoryCommand(s);
    assert(
      next,
      "STORY_COMPLETE",
      "The story is complete. Create a fresh story workspace to begin again.",
    );
    const cursor = s.storyCursor || 0;
    s = transition(s, {
      ...next,
      expectedVersion: s.version,
      requestId: `${cmd.requestId}:engine`,
    });
    s.storyCursor = cursor + 1;
    audit(
      s,
      `Story ${storySteps[cursor].title}. ${storySteps[cursor].expectedOutcome}`,
    );
  } else if (cmd.action === "reset") {
    assert(
      !s.contracts.some((c) =>
        ["RECONCILING", "AWAITING_EVIDENCE"].includes(c.status),
      ),
      "UNFINISHED",
      "Resolve pending delivery or reconciliation before resetting the workspace",
    );
    s = s.scenarioId === "lin-family" ? storyState() : initialState();
    audit(s, "The simulation workspace was reset.");
  } else if (cmd.action === "advance") {
    assert(
      typeof cmd.hour === "number" && cmd.hour >= s.hour && cmd.hour <= 1500,
      "INVALID_TIME",
      "Simulation time can only move forward",
    );
    assert(
      !s.contracts.some((c) => c.status === "RECONCILING"),
      "UNFINISHED",
      "Resolve contracts with unknown execution results first",
    );
    s.hour = cmd.hour;
    expire(s);
    audit(s, `Simulation time advanced to hour ${s.hour}.`);
  } else if (cmd.action === "intent_save" || cmd.action === "intent_remove") {
    assert(
      cmd.person && s.people.some((p) => p.id === cmd.person),
      "INPUT",
      "Choose an existing traveller",
    );
    if (!input.intents) {
      // Preserve only commitments already recorded under the earlier model.
      // New proposals never receive this compatibility permission.
      for (const contract of s.contracts.filter(active)) {
        contract.legacyConsent = Object.fromEntries(
          contract.participants.map((person) => [
            person,
            {
              preferences: structuredClone(input.preferences[person]),
              seatWishes: Object.fromEntries(
                input.allocations
                  .filter((allocation) => allocation.person === person)
                  .map((allocation) => [
                    allocation.key,
                    [...(input.seatWishes[allocation.key] || [])],
                  ]),
              ),
              ...(input.needs?.[person]
                ? { need: structuredClone(input.needs[person]) }
                : {}),
            },
          ]),
        );
      }
    }
    for (const contract of s.contracts.filter(active)) {
      // A modern statement is authoritative for its owner. Withdrawal cannot
      // silently bring back a retired permission from the legacy model.
      if (contract.legacyConsent) delete contract.legacyConsent[cmd.person];
    }
    s.intents ||= {};
    const records = (s.intents[cmd.person] ||= []);
    if (cmd.action === "intent_remove") {
      const index = records.findIndex((r) => r.id === cmd.intentId);
      assert(index >= 0, "INPUT", "This saved statement does not exist");
      if (intentPurpose(records[index]) === "request")
        records[index] = {
          ...records[index],
          cancelled: true,
          revision: records[index].revision + 1,
        };
      else records.splice(index, 1);
      audit(s, `${name(s, cmd.person)} withdrew a saved travel statement.`);
    } else {
      assert(cmd.intent, "INPUT", "A reviewed travel statement is required");
      try {
        validateIntent(s, cmd.person, cmd.intent);
      } catch (error) {
        if (error instanceof IntentAvailabilityError)
          throw new FlexError(error.code, error.message);
        throw new FlexError(
          "INPUT",
          error instanceof Error ? error.message : "Invalid travel statement",
        );
      }
      assert(
        cmd.intent.rules.length > 0 && cmd.intent.questions.length === 0,
        "INPUT",
        "Resolve the interpretation questions before confirming this statement",
      );
      const index = records.findIndex((r) => r.id === cmd.intent!.id);
      assert(
        cmd.intent.revision === (index < 0 ? 0 : records[index].revision),
        "VERSION_CONFLICT",
        "This statement has changed. Review its current version.",
      );
      const record: IntentRecord = {
        ...cmd.intent,
        purpose: intentPurpose(cmd.intent),
        cancelled: false,
        confirmed: true,
        revision: cmd.intent.revision + 1,
      };
      // Model output and client records cannot grant financial consent.
      delete record.authorization;
      if (record.purpose === "request" && index >= 0) {
        // A reserved request revision is part of the accepted arrangement.
        // Surface that workflow conflict before asking for a replacement quote.
        assertReservedArrangementsRemainValid({
          ...s,
          intents: {...s.intents, [cmd.person]: records.map((saved, position) => position === index ? record : saved)},
        }, cmd.person);
      }
      if (cmd.requestAuthorization) {
        const terms = cmd.requestAuthorization;
        assert(record.purpose === "request", "INPUT", "Quote acceptance applies only to a journey request");
        assert("quote" in terms && terms.allowPartial === false, "REQUEST_QUOTE_REQUIRED", "Review a fixed platform quote before publishing this request");
        const errors = validateRequestQuote(s, cmd.person, cmd.intent, terms.quote);
        assert(!errors.length, "REQUEST_QUOTE_CHANGED", errors[0] || "Review the current fixed quote");
        assert(Number.isFinite(terms.validUntil) && terms.validUntil > s.hour && terms.validUntil <= terms.quote.validUntil,
          "INPUT", "The request expiry must be within the fixed quote's validity period");
        const previous = index < 0 ? undefined : records[index];
        assert(terms.quote.debit <= availableRequestCredits(s, cmd.person, previous?.id), "INSUFFICIENT_CREDITS", "There are not enough unreserved credits for this fixed quote");
        record.authorization = {
          mode: "fixed_quote", quote: structuredClone(terms.quote), maxCredits: terms.quote.debit,
          validUntil: terms.validUntil, allowPartial: false, authorizedAt: s.hour, termsRevision: record.revision,
        };
      }
      if (index < 0) records.push(record);
      else records[index] = record;
      for (const journey of bookedJourneys(s, cmd.person)) {
        const rules = rulesFor(s, cmd.person, journey);
        const limit = Math.min(
          Infinity,
          ...rules.flatMap((r) =>
            r.effect.kind === "credit_budget" ? [r.effect.maxCredits] : [],
          ),
        );
        const spent = s.contracts
          .filter(
            (c) =>
              c.status === "SETTLED" &&
              c.changes.some((ch) =>
                [ch.from, ch.to].some(
                  (id) =>
                    s.resources.find((r) => r.id === id)?.journey === journey,
                ),
              ),
          )
          .reduce((n, c) => n + Math.max(0, -(c.credits[cmd.person!] || 0)), 0);
        assert(
          limit >= spent,
          "INPUT",
          "The journey limit must cover credits already spent on confirmed arrangements",
        );
        const pieces = Math.max(
          0,
          ...rules.flatMap((r) =>
            r.effect.kind === "baggage" ? [r.effect.extraPieces] : [],
          ),
        );
        const slots = s.allocations.filter(
          (a) =>
            a.person === cmd.person &&
            (a.journeyId === journey ||
              s.resources.find((r) => r.id === a.resource)?.journey ===
                journey) &&
            (a.resourceKind === "baggage" ||
              s.resources.find((r) => r.id === a.resource)?.kind === "baggage"),
        );
        for (let i = slots.length; i < pieces; i++)
          s.allocations.push({
            key: `extra-baggage:${cmd.person}:${journey}:${i}`,
            person: cmd.person,
            resource: null,
            version: 1,
            journeyId: journey,
            resourceKind: "baggage",
          });
      }
      audit(
        s,
        `${name(s, cmd.person)} confirmed a travel statement with ${record.rules.length} reviewed conditions.`,
      );
    }
    assertReservedArrangementsRemainValid(s, cmd.person);
  } else if (cmd.action === "preferences") {
    assert(
      cmd.person && s.wallets[cmd.person] !== undefined && cmd.preferences,
      "INVALID_PERSON",
      "Invalid traveller or preferences",
    );
    assert(
      !s.contracts.some(
        (c) => active(c) && c.participants.includes(cmd.person!),
      ),
      "LOCKED",
      "Resolve this traveller’s reserved contract first",
    );
    const p = cmd.preferences;
    assert(
      Number.isFinite(p.maxDelayHours) &&
        p.maxDelayHours >= 0 &&
        p.maxDelayHours <= 48 &&
        [p.requireAisle, p.allowMealSkip, p.allowGateCheck].every(
          (v) => typeof v === "boolean",
        ),
      "INPUT",
      "Invalid travel preferences",
    );
    if (p.contextualSeats)
      assert(
        [p.contextualSeats.soloShort, p.contextualSeats.soloLong].every((v) =>
          ["any", "aisle", "window"].includes(v),
        ) && typeof p.contextualSeats.familyTogether === "boolean",
        "INPUT",
        "Invalid conditional seat preferences",
      );
    s.preferences[cmd.person] = { ...p, confirmed: true };
    audit(s, `${name(s, cmd.person)} confirmed their travel requirements.`);
  } else if (cmd.action === "travel_need") {
    assert(
      cmd.person && s.wallets[cmd.person] !== undefined && cmd.need,
      "INPUT",
      "Invalid traveller or journey request",
    );
    const need = cmd.need;
    assert(
      s.journeys?.some((j) => j.id === need.journeyId) &&
        s.allocations.some(
          (a) =>
            a.person === cmd.person &&
            a.resource &&
            resource(s, a.resource)?.journey === need.journeyId,
        ),
      "INPUT",
      "Choose a journey on this traveller’s booking",
    );
    assert(
      typeof need.sitTogether === "boolean" &&
        Number.isInteger(need.extraBags) &&
        need.extraBags >= 0 &&
        need.extraBags <= 1 &&
        Number.isInteger(need.maxCredits) &&
        need.maxCredits >= 0 &&
        need.maxCredits <= 10000,
      "INPUT",
      "Choose a valid request and credit limit",
    );
    if (need.sitTogether)
      assert(
        s.parties?.some(
          (party) =>
            party.journeyId === need.journeyId &&
            party.memberIds.includes(cmd.person!) &&
            party.memberIds.length > 1,
        ),
        "INPUT",
        "This journey has no verified travel party to seat together",
      );
    assert(
      !s.contracts.some(
        (c) => active(c) && c.participants.includes(cmd.person!),
      ),
      "LOCKED",
      "Resolve this traveller’s reserved contract before changing the request",
    );
    const spent = s.contracts
      .filter(
        (c) =>
          c.status === "SETTLED" &&
          c.changes.some(
            (ch) => ch.to && resource(s, ch.to)?.journey === need.journeyId,
          ),
      )
      .reduce((n, c) => n + Math.max(0, -(c.credits[cmd.person!] || 0)), 0);
    assert(
      need.maxCredits >= spent,
      "INPUT",
      "The journey limit must cover credits already spent on confirmed arrangements",
    );
    s.needs ||= {};
    s.needs[cmd.person] = { ...need, confirmed: true };

    audit(
      s,
      `${name(s, cmd.person)} confirmed a journey request with a ${need.maxCredits} Flex credit limit.`,
    );
  } else if (cmd.action === "seat_preferences") {
    const a = s.allocations.find((a) => a.key === cmd.allocationKey);
    assert(a && a.resource && cmd.wishes, "INPUT", "Invalid seat preferences");
    assert(
      !s.contracts.some((c) => active(c) && c.participants.includes(a.person)),
      "LOCKED",
      "This traveller has a reserved contract. Resolve it first.",
    );
    const current = resource(s, a.resource);
    assert(
      current.kind === "seat",
      "INPUT",
      "Only seat preferences can be edited here",
    );
    for (const id of cmd.wishes) {
      const target = resource(s, id);
      assert(
        target &&
          target.kind === "seat" &&
          target.journey === current.journey &&
          target.product === current.product &&
          target.id !== current.id,
        "INPUT",
        "Choose another seat in the same journey and product",
      );
    }
    s.seatWishes[a.key] = [...new Set(cmd.wishes)];
    audit(
      s,
      `${name(s, a.person)} updated acceptable seats. The market searched for exchanges again.`,
    );
  } else if (cmd.action === "policy") {
    assert(cmd.economics, "INPUT", "Missing cost assumptions");
    assert(
      [
        cmd.economics.marginalValue,
        cmd.economics.executionCost,
        cmd.economics.riskReserve,
        cmd.economics.stressCost,
      ].every((value) => Number.isFinite(value) && value >= 0),
      "INPUT",
      "Cost assumptions must be finite nonnegative numbers",
    );
    assert(
      !s.contracts.some((c) => active(c) && c.budget === "recovery"),
      "LOCKED",
      "A flight contract is reserved. Its cost policy cannot change.",
    );
    s.economics = { ...cmd.economics };
    audit(
      s,
      "Operations updated the synthetic cost assumptions. Candidates were revalidated.",
    );
  } else if (cmd.action === "budget") {
    const b = s.budgets.find((b) => b.id === cmd.budgetId);
    assert(
      b && Number.isInteger(cmd.limit) && cmd.limit! >= 0,
      "INPUT",
      "Invalid budget limit",
    );
    const reserved = s.contracts
      .filter((c) => active(c) && c.budget === b.id)
      .reduce((n, c) => n + c.issuance, 0);
    assert(
      cmd.limit! >= b.issued + reserved,
      "BUDGET",
      "The limit must cover issued and reserved rewards",
    );
    b.limit = cmd.limit!;
    audit(s, `Operations set ${b.label} budget to ${b.limit} Flex.`);
  } else if (cmd.action === "inventory") {
    const r = s.resources.find((r) => r.id === cmd.resourceId);
    assert(
      r &&
        Number.isInteger(cmd.capacity) &&
        Number.isInteger(cmd.protected) &&
        cmd.capacity! >= 0 &&
        cmd.protected! >= 0,
      "INPUT",
      "Invalid resource capacity",
    );
    assert(
      r.kind !== "seat" || cmd.capacity === 1,
      "CAPACITY",
      "A physical seat must retain a capacity of one",
    );
    assert(
      !s.contracts.some((c) => active(c) && locks(c).has(r.id)),
      "LOCKED",
      "Resolve reservations affecting this resource before changing capacity",
    );
    const occupied =
      r.background + s.allocations.filter((a) => a.resource === r.id).length;
    assert(
      cmd.capacity! >= occupied + cmd.protected!,
      "CAPACITY",
      "Capacity cannot be reduced below allocated and protected units",
    );
    r.capacity = cmd.capacity!;
    r.protected = cmd.protected!;
    audit(s, `Operations updated capacity for ${r.label}.`);
  } else if (cmd.action === "quote") {
    if (cmd.manualPerson)
      assert(
        s.people.some((person) => person.id === cmd.manualPerson),
        "INVALID_PERSON",
        "Choose an existing traveller",
      );
    const c = cmd.manualPerson
      ? discoverOpportunities(s, cmd.manualPerson).find(
          (c) => c.id === cmd.candidateId,
        )
      : candidates(s).find((c) => c.id === cmd.candidateId);
    assert(c, "NOT_FOUND", "The candidate is no longer available");
    const errors = validate(s, c);
    assert(!errors.length, "INELIGIBLE", errors.join(". "));
    const contract = reserveCandidate(s, c);
    deliverAuthorized(s, contract, cmd.fault);
  } else {
    const c = s.contracts.find((c) => c.contractId === cmd.contractId);
    assert(c, "NOT_FOUND", "Contract not found");
    if (
      c.status === "SETTLED" &&
      ["execute", "reconcile", "evidence"].includes(cmd.action)
    )
      return input;
    if (cmd.action === "accept") {
      if (c.accepted.includes(cmd.person || "") && c.status === "SETTLED")
        return input;
      assert(
        ["HELD", "ACCEPTED"].includes(c.status),
        "WRONG_STATE",
        "This contract can no longer be accepted",
      );
      assert(
        cmd.person && c.participants.includes(cmd.person),
        "INVALID_PERSON",
        "This traveller is not a contract participant",
      );
      const errors = validate(s, c, c.contractId);
      assert(!errors.length, "STALE", errors.join(". "));
      const readiness = contractConsentReadiness(s, c, cmd.person);
      assert(
        !readiness.highImpact || !readiness.waitingForOthers,
        "COORDINATION_REQUIRED",
        "The other travellers must confirm before you can commit to a departure change. Your current booking is protected.",
      );
      if (!c.accepted.includes(cmd.person)) c.accepted.push(cmd.person);
      if (c.accepted.length === c.participants.length) c.status = "ACCEPTED";
      c.log.push(`${name(s, cmd.person)} accepted the complete arrangement.`);
      deliverAuthorized(s, c, cmd.fault);
    } else if (cmd.action === "cancel") {
      assert(
        ["HELD", "ACCEPTED", "AWAITING_EVIDENCE"].includes(c.status),
        "WRONG_STATE",
        "Reconcile the executing contract before releasing reservations",
      );
      assert(
        !cmd.person || !c.authorizations?.[cmd.person],
        "BOUND_REQUEST",
        "This arrangement is covered by your published request. It is already reserved for the other travellers and cannot be withdrawn during coordination.",
      );
      c.status = "CANCELLED";
      c.log.push(
        "Cancelled or not delivered. Original entitlements remain, no reward is issued and reservations are released.",
      );
    } else if (cmd.action === "execute") {
      assert(
        c.status === "ACCEPTED",
        "CONSENT_REQUIRED",
        "Every participant must explicitly accept the complete arrangement",
      );
      const errors = validate(s, c, c.contractId);
      assert(!errors.length, "STALE", errors.join(". "));
      if (cmd.fault === "reject") {
        c.status = "FAILED";
        c.log.push(
          "The adapter rejected execution before any write. No debit or issuance occurred.",
        );
      } else if (c.evidence) {
        c.status = "AWAITING_EVIDENCE";
        c.log.push(
          "The commitment is recorded. Waiting for operational delivery evidence. No reward is available yet.",
        );
      } else apply(s, c, cmd.fault);
    } else if (cmd.action === "evidence") {
      assert(
        c.status === "AWAITING_EVIDENCE" && c.evidence,
        "WRONG_STATE",
        "This contract is not awaiting delivery evidence",
      );
      const errors = validate(s, c, c.contractId);
      assert(!errors.length, "DELIVERY_INVALID", errors.join(". "));
      c.receipts.push(`${c.evidence}:${c.contractId}:SIMULATED-AUTHORITY`);
      c.log.push(
        c.evidence === "catering_plan"
          ? "The simulated catering authority confirmed one fewer meal in the production plan."
          : "The simulated baggage authority accepted a 7 kg bag and issued a tag.",
      );
      apply(s, c);
    } else if (cmd.action === "reconcile") {
      assert(
        c.status === "RECONCILING",
        "WRONG_STATE",
        "This contract does not require reconciliation",
      );
      const errors = validate(
        originalContractAllocationView(s, c),
        c,
        c.contractId,
      );
      assert(!errors.length, "RECONCILIATION_BLOCKED", errors.join(". "));
      c.log.push(
        "Read authoritative adapter state, skip completed steps and complete the remaining conditions.",
      );
      apply(s, c);
    }
  }
  if (
    ["intent_save", "accept", "advance", "evidence", "reconcile"].includes(
      cmd.action,
    ) &&
    !s.contracts.some((contract) => contract.status === "RECONCILING")
  )
    fulfilAuthorizedInventory(s);
  s.version = input.version + 1;
  s.requests[cmd.requestId] = signature;
  assert(
    invariants(s).every((x) => x.ok),
    "INVARIANT_FAILURE",
    "An invariant failed. This change was not saved.",
  );
  return s;
}
