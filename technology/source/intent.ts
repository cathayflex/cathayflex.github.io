import { z } from "zod";
import { requestQuoteSchema } from "./request-quote-schema.ts";
import {
  andTruth,
  orTruth,
  evaluatePredicate,
  predicateAtoms,
  describePredicate,
  intentConditionSchema,
  intentEffectSchema,
  intentPredicateSchema,
  outcomePredicateSchema,
} from "./predicates.ts";
import { simulationEpoch } from "./time.ts";
import type {
  Candidate,
  IntentCondition,
  IntentPurpose,
  IntentEffect,
  OutcomeCondition,
  OutcomePredicate,
  IntentRecord,
  IntentRule,
  Resource,
  State,
} from "./types.ts";

export const intentRuleSchema = z
  .object({
    id: z.string().min(1).max(100),
    evidence: z.string().min(1).max(4000),
    when: z.array(intentConditionSchema).max(16),
    condition: intentPredicateSchema.optional(),
    onlyIf: outcomePredicateSchema.optional(),
    sourceSpan: z
      .object({
        start: z.number().int().nonnegative().max(8000),
        end: z.number().int().positive().max(8000),
      })
      .strict()
      .optional(),
    effect: intentEffectSchema,
    strength: z.enum(["must", "prefer", "flexible"]),
  })
  .strict();
export const intentRecordSchema = z
  .object({
    purpose: z.enum(["flexibility", "request"]).optional(),
    cancelled: z.boolean().optional(),
    id: z.string().min(1).max(100),
    sourceText: z.string().min(1).max(8000),
    scope: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("all") }).strict(),
      z
        .object({
          kind: z.literal("journey"),
          journeyId: z.string().min(1).max(100),
        })
        .strict(),
    ]),
    rules: z.array(intentRuleSchema).max(30),
    questions: z.array(z.string().min(1).max(500)).max(10),
    confirmed: z.boolean(),
    revision: z.number().int().min(0),
    authorization: z
      .object({
        mode: z.literal("fixed_quote").optional(),
        quote: requestQuoteSchema.optional(),
        maxCredits: z.number().int().min(0).max(1000000),
        validUntil: z.number().finite().nonnegative().max(1500),
        allowPartial: z.boolean(),
        authorizedAt: z.number().finite().nonnegative().max(1500),
        termsRevision: z.number().int().positive(),
      })
      .strict()
      .optional(),
  })
  .strict();
export const requestAuthorizationSchema = z
  .object({
    quote: requestQuoteSchema,
    validUntil: z.number().finite().nonnegative().max(1500),
    allowPartial: z.literal(false),
  })
  .strict();

export function bookedJourneys(s: State, person: string): string[] {
  return [
    ...new Set(
      s.allocations
        .filter((a) => a.person === person)
        .map(
          (a) =>
            a.journeyId ||
            s.resources.find((r) => r.id === a.resource)?.journey,
        )
        .filter((j): j is string => !!j),
    ),
  ];
}
export class IntentAvailabilityError extends Error {
  constructor(
    public code: "REQUESTS_CLOSED" | "REQUEST_SERVICE_CLOSED",
    message: string,
  ) {
    super(message);
    this.name = "IntentAvailabilityError";
  }
}
/** Inventory deadlines share the authoritative workspace clock. */
export function journeyAcceptsRequests(s: State, journeyId: string): boolean {
  return s.resources.some(
    (resource) => resource.journey === journeyId && resource.deadline > s.hour,
  );
}
export function journeyServiceAcceptsRequests(
  s: State,
  journeyId: string,
  kind: Resource["kind"],
): boolean {
  return s.resources.some(
    (resource) =>
      resource.journey === journeyId &&
      resource.kind === kind &&
      resource.deadline > s.hour,
  );
}
export function assertRequestJourneyOpen(s: State, journeyId: string): void {
  if (!journeyAcceptsRequests(s, journeyId))
    throw new IntentAvailabilityError(
      "REQUESTS_CLOSED",
      "Changes are closed for this journey. Choose an upcoming journey.",
    );
}
export function journeyFacts(s: State, person: string, journeyId: string) {
  const journey = s.journeys?.find((j) => j.id === journeyId);
  const party = s.parties?.find(
    (p) => p.journeyId === journeyId && p.memberIds.includes(person),
  );
  const soloKnown = s.allocations.some(
    (a) =>
      a.person === person &&
      a.partyId === null &&
      (a.journeyId === journeyId ||
        s.resources.find((r) => r.id === a.resource)?.journey === journeyId),
  );
  return {
    journeyId,
    origin: journey?.origin,
    destination: journey?.destination,
    cabin: journey?.cabin,
    durationMinutes: journey?.durationMinutes,
    partyId: party?.id ?? (soloKnown ? null : undefined),
    partySize: party?.memberIds.length ?? (soloKnown ? 1 : undefined),
  };
}
export function matchesCondition(
  facts: ReturnType<typeof journeyFacts>,
  condition: IntentCondition,
): boolean | undefined {
  const value = facts[condition.field];
  if (value === undefined) return undefined;
  if (condition.op === "eq") return value === condition.value;
  if (condition.op === "ne") return value !== condition.value;
  if (typeof value !== "number" || typeof condition.value !== "number")
    return undefined;
  if (condition.op === "lt") return value < condition.value;
  if (condition.op === "lte") return value <= condition.value;
  if (condition.op === "gt") return value > condition.value;
  return value >= condition.value;
}
/** The legacy AND list and the explicit Boolean tree both constrain activation. */
export function ruleConditionMatches(
  facts: ReturnType<typeof journeyFacts>,
  rule: IntentRule,
): boolean | undefined {
  return andTruth([
    ...rule.when.map((condition) => matchesCondition(facts, condition)),
    rule.condition
      ? evaluatePredicate(rule.condition, (condition) =>
          matchesCondition(facts, condition),
        )
      : true,
  ]);
}
export type AppliedRule = IntentRule & {
  recordId: string;
  recordRevision: number;
  purpose: IntentPurpose;
};
/** Old statements had no purpose. Their declared scope and concessions provide a conservative migration. */
export function intentPurpose(record: IntentRecord): IntentPurpose {
  return (
    record.purpose ??
    (record.scope.kind === "all" ||
    record.rules.every((rule) => rule.strength === "flexible")
      ? "flexibility"
      : "request")
  );
}
function relevantRecords(s: State, person: string, journeyId: string) {
  return (s.intents?.[person] || []).filter(
    (record) =>
      record.confirmed &&
      !record.cancelled &&
      !record.questions.length &&
      (record.scope.kind === "all" || record.scope.journeyId === journeyId),
  );
}
function appliedRules(
  s: State,
  person: string,
  journeyId: string,
  records: IntentRecord[],
): AppliedRule[] {
  const facts = journeyFacts(s, person, journeyId);
  return records.flatMap((record) =>
    record.rules
      .filter((rule) => ruleConditionMatches(facts, rule) === true)
      .map((rule) => ({
        ...rule,
        recordId: record.id,
        recordRevision: record.revision,
        purpose: intentPurpose(record),
      })),
  );
}
export function flexibilityRulesFor(
  s: State,
  person: string,
  journeyId: string,
): AppliedRule[] {
  const records = relevantRecords(s, person, journeyId).filter(
    (record) => intentPurpose(record) === "flexibility",
  );
  const journeyRules = appliedRules(
    s,
    person,
    journeyId,
    records.filter((record) => record.scope.kind === "journey"),
  );
  const overridden = new Set(journeyRules.map((rule) => rule.effect.kind));
  return [
    ...appliedRules(
      s,
      person,
      journeyId,
      records.filter((record) => record.scope.kind === "all"),
    ).filter(
      (rule) => rule.strength === "must" || !overridden.has(rule.effect.kind),
    ),
    ...journeyRules,
  ];
}
function resourceOn(s: State, id: string | null, journeyId: string) {
  return s.resources.find((r) => r.id === id && r.journey === journeyId);
}
export function requestGoalSatisfied(
  s: State,
  person: string,
  journeyId: string,
  rule: IntentRule,
): boolean {
  const own = s.allocations.filter(
    (a) =>
      a.person === person &&
      (a.journeyId === journeyId || resourceOn(s, a.resource, journeyId)),
  );
  const resources = own.flatMap((a) => {
    const r = resourceOn(s, a.resource, journeyId);
    return r ? [r] : [];
  });
  const effect = rule.effect;
  if (effect.kind === "seat_position")
    return resources.some(
      (r) =>
        r.kind === "seat" &&
        !!r.seatPosition &&
        effect.positions.includes(r.seatPosition),
    );
  if (effect.kind === "baggage")
    return (
      resources
        .filter(
          (r) =>
            r.kind === "baggage" &&
            (!effect.maxKgPerPiece ||
              (r.baggage?.maxKg || 0) >= effect.maxKgPerPiece),
        )
        .reduce((n, r) => n + (r.baggage?.pieces || 0), 0) >= effect.extraPieces
    );
  if (effect.kind === "seating_together") {
    const party = s.parties?.find(
      (p) =>
        p.journeyId === journeyId &&
        p.memberIds.includes(person) &&
        (!effect.partyId || p.id === effect.partyId),
    );
    if (!party) return false;
    const seats = party.memberIds.map((member) =>
      s.allocations
        .filter((a) => a.person === member)
        .map((a) => resourceOn(s, a.resource, journeyId))
        .find((r) => r?.kind === "seat"),
    );
    if (seats.some((r) => !r?.seatMap)) return false;
    const maps = seats
      .map((r) => r!.seatMap!)
      .sort((a, b) => a.column - b.column);
    return maps.every(
      (m, i) =>
        m.row === maps[0].row &&
        m.block === maps[0].block &&
        (i === 0 || m.column === maps[i - 1].column + 1),
    );
  }
  if (effect.kind === "meal")
    return resources.some((r) => r.kind === "meal") === effect.receive;
  if (effect.kind === "gate_check")
    return resources.some((r) => r.kind === "handover") === effect.allowed;
  if (effect.kind === "departure_window") {
    const current = resources.find((r) => r.kind === "flight");
    const departure = current
      ? simulationEpoch(s) + current.serviceHour * 3600000
      : undefined;
    if (departure === undefined || (!effect.earliest && !effect.latest))
      return false;
    return (
      (!effect.earliest || departure >= Date.parse(effect.earliest)) &&
      (!effect.latest || departure <= Date.parse(effect.latest))
    );
  }
  return true;
}
export type RequestProgress = {
  status: "active" | "partly_fulfilled" | "fulfilled" | "expired" | "cancelled";
  fulfilledRules: number;
  totalRules: number;
  matchedOfferIds: string[];
};
export function requestAuthorizationDeadline(
  s: State,
  person: string,
  record: IntentRecord,
): number {
  if (record.scope.kind !== "journey") return s.hour;
  const journeyId = record.scope.journeyId;
  const facts = journeyFacts(s, person, journeyId);
  const journeyResources = s.resources.filter(
    (resource) => resource.journey === journeyId,
  );
  const journeyDeadline = Math.max(
    s.hour,
    ...journeyResources.map((resource) => resource.deadline),
  );
  const deadlines = record.rules
    .filter(
      (rule) =>
        rule.strength !== "flexible" &&
        rule.effect.kind !== "credit_budget" &&
        ruleConditionMatches(facts, rule) === true &&
        !requestGoalSatisfied(s, person, journeyId, rule),
    )
    .map((rule) => {
      const kind =
        rule.effect.kind === "seat_position" ||
        rule.effect.kind === "seating_together"
          ? "seat"
          : rule.effect.kind === "departure_window"
            ? "flight"
            : rule.effect.kind === "gate_check"
              ? "handover"
              : rule.effect.kind;
      const services = journeyResources.filter(
        (resource) => resource.kind === kind,
      );
      return services.length
        ? Math.max(...services.map((resource) => resource.deadline))
        : journeyDeadline;
    });
  return Math.min(1500, journeyDeadline, ...deadlines);
}
export function requestProgress(
  s: State,
  person: string,
  record: IntentRecord,
  offers: Candidate[] = [],
): RequestProgress {
  const unresolved = s.contracts.filter(
    (contract) => contract.status === "RECONCILING",
  );
  if (unresolved.length) {
    const original = new Map(
      unresolved.flatMap((contract) =>
        contract.changes.map((change) => [change.key, change.from] as const),
      ),
    );
    s = {
      ...s,
      allocations: s.allocations.map((allocation) =>
        original.has(allocation.key)
          ? { ...allocation, resource: original.get(allocation.key)! }
          : allocation,
      ),
    };
  }
  const journeyId =
    record.scope.kind === "journey" ? record.scope.journeyId : "";
  const facts = journeyFacts(s, person, journeyId);
  const goals = record.rules.filter(
    (rule) =>
      rule.strength !== "flexible" &&
      rule.effect.kind !== "credit_budget" &&
      ruleConditionMatches(facts, rule) === true,
  );
  const fulfilledRules = goals.filter((rule) =>
    requestGoalSatisfied(s, person, journeyId, rule),
  ).length;
  const expired =
    (record.authorization !== undefined &&
      record.authorization.validUntil <= s.hour) ||
    goals.some((rule) => {
      if (requestGoalSatisfied(s, person, journeyId, rule)) return false;
      const kind =
        rule.effect.kind === "seating_together" ||
        rule.effect.kind === "seat_position"
          ? "seat"
          : rule.effect.kind === "departure_window"
            ? "flight"
            : rule.effect.kind === "gate_check"
              ? "handover"
              : rule.effect.kind;
      const resources = s.resources.filter(
        (resource) => resource.journey === journeyId && resource.kind === kind,
      );
      return (
        resources.length > 0 &&
        resources.every((resource) => resource.deadline <= s.hour)
      );
    });
  const status = record.cancelled
    ? "cancelled"
    : goals.length > 0 && fulfilledRules === goals.length
      ? "fulfilled"
      : expired
        ? "expired"
        : fulfilledRules > 0
          ? "partly_fulfilled"
          : "active";
  return {
    status,
    fulfilledRules,
    totalRules: goals.length,
    matchedOfferIds: offers
      .filter(
        (offer) =>
          (!("blocked" in offer) ||
            !Array.isArray(offer.blocked) ||
            offer.blocked.length === 0) &&
          offer.requestRefs?.some(
            (ref) =>
              ref.person === person &&
              ref.intentId === record.id &&
              ref.revision === record.revision,
          ),
      )
      .map((offer) => offer.id),
  };
}
export function requestRulesFor(
  s: State,
  person: string,
  journeyId: string,
): AppliedRule[] {
  return appliedRules(
    s,
    person,
    journeyId,
    relevantRecords(s, person, journeyId).filter(
      (record) =>
        intentPurpose(record) === "request" &&
        ["active", "partly_fulfilled"].includes(
          requestProgress(s, person, record).status,
        ),
    ),
  );
}
export function rulesFor(
  s: State,
  person: string,
  journeyId: string,
): AppliedRule[] {
  // A fulfilled request protects the completed arrangement for the rest of this journey.
  const requests = relevantRecords(s, person, journeyId).filter(
    (record) =>
      intentPurpose(record) === "request" &&
      requestProgress(s, person, record).status !== "expired",
  );
  return [
    ...flexibilityRulesFor(s, person, journeyId),
    ...appliedRules(s, person, journeyId, requests),
  ];
}
export function ruleDescription(rule: IntentRule): string {
  const effect = rule.effect;
  const prefix =
    rule.strength === "must"
      ? "Require"
      : rule.strength === "prefer"
        ? "Prefer"
        : "Open to";
  let result = "";
  if (effect.kind === "seat_position")
    result = `${prefix} ${effect.positions.length === 3 ? "any seat" : effect.positions.join(" or ") + " seats"}`;
  if (effect.kind === "seating_together")
    result = `${prefix} seats together with the booking party`;
  if (effect.kind === "departure_window")
    result = `${prefix} a departure${effect.earliest ? ` from ${effect.earliest}` : ""}${effect.latest ? ` by ${effect.latest}` : ""}${effect.maxDelayMinutes !== undefined ? ` no more than ${effect.maxDelayMinutes} minutes later` : ""}`;
  if (effect.kind === "baggage")
    result = `${prefix} ${effect.extraPieces} extra checked ${effect.extraPieces === 1 ? "bag" : "bags"}${effect.maxKgPerPiece ? ` up to ${effect.maxKgPerPiece} kg each` : ""}`;
  if (effect.kind === "gate_check")
    result = effect.allowed
      ? "Open to checking a cabin bag when the airline requests it"
      : "Keep the cabin bag with you";
  if (effect.kind === "meal")
    result = effect.receive
      ? `${prefix} the included meal`
      : "Open to declining the included meal";
  if (effect.kind === "credit_budget")
    result = `Spend up to ${effect.maxCredits} Flex credits in total`;
  const labels: Record<IntentCondition["field"], string> = {
    journeyId: "journey",
    origin: "origin",
    destination: "destination",
    cabin: "cabin",
    partyId: "booking party",
    durationMinutes: "flight duration in minutes",
    partySize: "travellers in the booking",
  };
  const operators = {
    eq: "is",
    ne: "is not",
    lt: "is under",
    lte: "is at most",
    gt: "is over",
    gte: "is at least",
  };
  const describeContext = (condition: IntentCondition) =>
    `${labels[condition.field]} ${operators[condition.op]} ${condition.value}`;
  const contexts = [
    ...rule.when.map(describeContext),
    ...(rule.condition
      ? [describePredicate(rule.condition, describeContext)]
      : []),
  ];
  if (contexts.length) result += ` when ${contexts.join(" and ")}`;
  if (rule.onlyIf)
    result += ` only if ${describePredicate(rule.onlyIf, (condition) =>
      condition.kind === "flight_unchanged"
        ? "the booked flight remains unchanged"
        : ruleDescription({
            id: "description",
            evidence: "description",
            when: [],
            effect: condition,
            strength: "must",
          }).replace(/^Require /, ""),
    )}`;
  return result;
}
export const explainRule = ruleDescription;
export function intentContextIssues(
  s: State,
  person: string,
  journeyId: string,
): string[] {
  const facts = journeyFacts(s, person, journeyId),
    errors: string[] = [];
  const overrideKinds = new Set(
    relevantRecords(s, person, journeyId)
      .filter(
        (record) =>
          intentPurpose(record) === "flexibility" &&
          record.scope.kind === "journey",
      )
      .flatMap((record) =>
        record.rules
          .filter((rule) => ruleConditionMatches(facts, rule) === true)
          .map((rule) => rule.effect.kind),
      ),
  );
  for (const record of s.intents?.[person] || []) {
    if (
      !record.confirmed ||
      record.cancelled ||
      record.questions.length ||
      (record.scope.kind === "journey" && record.scope.journeyId !== journeyId)
    )
      continue;
    for (const rule of record.rules) {
      if (
        intentPurpose(record) === "flexibility" &&
        record.scope.kind === "all" &&
        rule.strength !== "must" &&
        overrideKinds.has(rule.effect.kind)
      )
        continue;
      const outcome = ruleConditionMatches(facts, rule);
      if (outcome === undefined)
        errors.push(
          `The booking does not establish a condition in “${rule.evidence}”`,
        );
    }
  }
  const rules = rulesFor(s, person, journeyId),
    seatRules = rules.filter(
      (r) => r.strength === "must" && r.effect.kind === "seat_position",
    );
  if (
    seatRules.length &&
    !(["aisle", "window", "middle"] as const).some((p) =>
      seatRules.every(
        (r) =>
          r.effect.kind === "seat_position" && r.effect.positions.includes(p),
      ),
    )
  )
    errors.push(
      "The confirmed seat requirements conflict. Review the source statements.",
    );
  const meals = rules.filter(
    (r) => r.strength === "must" && r.effect.kind === "meal",
  );
  if (
    meals.some((r) => r.effect.kind === "meal" && r.effect.receive) &&
    meals.some((r) => r.effect.kind === "meal" && !r.effect.receive)
  )
    errors.push("The confirmed meal requirements conflict.");
  const windows = rules.filter(
    (r) => r.strength === "must" && r.effect.kind === "departure_window",
  );
  const earliest = Math.max(
    -Infinity,
    ...windows.flatMap((r) =>
      r.effect.kind === "departure_window" && r.effect.earliest
        ? [Date.parse(r.effect.earliest)]
        : [],
    ),
  );
  const latest = Math.min(
    Infinity,
    ...windows.flatMap((r) =>
      r.effect.kind === "departure_window" && r.effect.latest
        ? [Date.parse(r.effect.latest)]
        : [],
    ),
  );
  if (earliest > latest)
    errors.push("The confirmed departure windows conflict.");
  return errors;
}
export function validateIntent(
  s: State,
  person: string,
  input: IntentRecord,
): void {
  const parsed = intentRecordSchema.parse(input) as IntentRecord;
  if (!s.people.some((p) => p.id === person))
    throw new Error("Choose an existing traveller");
  const journeys = bookedJourneys(s, person);
  if (intentPurpose(parsed) === "request" && parsed.scope.kind !== "journey")
    throw new Error("Choose one booked journey for this request");
  if (
    parsed.scope.kind === "journey" &&
    !journeys.includes(parsed.scope.journeyId)
  )
    throw new Error("Choose a journey on your own booking");
  const isRequest = intentPurpose(parsed) === "request";
  if (isRequest && parsed.scope.kind === "journey")
    assertRequestJourneyOpen(s, parsed.scope.journeyId);
  if (new Set(parsed.rules.map((r) => r.id)).size !== parsed.rules.length)
    throw new Error("Rule identifiers must be unique within a statement");
  for (const rule of parsed.rules) {
    if (!parsed.sourceText.includes(rule.evidence))
      throw new Error(
        "Every interpretation must refer to the original statement",
      );
    if (
      rule.sourceSpan &&
      (rule.sourceSpan.start >= rule.sourceSpan.end ||
        parsed.sourceText.slice(rule.sourceSpan.start, rule.sourceSpan.end) !==
          rule.evidence)
    )
      throw new Error("The source span does not match the original evidence");
    if (
      rule.onlyIf &&
      (rule.strength !== "flexible" || rule.effect.kind === "credit_budget")
    )
      throw new Error(
        "An only-if condition must guard a defined flexible service change",
      );
    for (const c of [
      ...rule.when,
      ...(rule.condition ? predicateAtoms(rule.condition) : []),
    ]) {
      if (c.field === "journeyId" && !journeys.includes(String(c.value)))
        throw new Error("A condition refers to an unbooked journey");
      if (
        c.field === "partyId" &&
        !s.parties?.some(
          (p) => p.id === c.value && p.memberIds.includes(person),
        )
      )
        throw new Error("A condition refers to an unverified booking party");
    }
    for (const atom of rule.onlyIf ? predicateAtoms(rule.onlyIf) : []) {
      if (
        atom.kind === "seating_together" &&
        atom.partyId &&
        !s.parties?.some(
          (p) =>
            p.id === atom.partyId &&
            p.memberIds.includes(person) &&
            (parsed.scope.kind !== "journey" ||
              parsed.scope.journeyId === p.journeyId),
        )
      )
        throw new Error(
          "An outcome condition refers to an unverified booking party",
        );
      if (atom.kind === "departure_window") validateDepartureWindow(atom);
    }
    const effect = rule.effect;
    if (
      isRequest &&
      parsed.scope.kind === "journey" &&
      rule.strength !== "flexible" &&
      effect.kind !== "credit_budget"
    ) {
      const kind =
        effect.kind === "seat_position" || effect.kind === "seating_together"
          ? "seat"
          : effect.kind === "departure_window"
            ? "flight"
            : effect.kind === "gate_check"
              ? "handover"
              : effect.kind;
      // A missing inventory category means no known offer, not an elapsed deadline.
      const journeyId = parsed.scope.journeyId;
      const knownService = s.resources.some(
        (resource) => resource.journey === journeyId && resource.kind === kind,
      );
      if (knownService && !journeyServiceAcceptsRequests(s, journeyId, kind)) {
        const label = {
          seat: "Seat changes",
          flight: "Flight changes",
          baggage: "Extra baggage requests",
          handover: "Cabin bag check-in requests",
          meal: "Meal requests",
        }[kind];
        throw new IntentAvailabilityError(
          "REQUEST_SERVICE_CLOSED",
          `${label} are closed for this journey. Other services may still be available.`,
        );
      }
    }
    if (
      effect.kind === "seating_together" &&
      effect.partyId &&
      !s.parties?.some(
        (p) =>
          p.id === effect.partyId &&
          p.memberIds.includes(person) &&
          (parsed.scope.kind !== "journey" ||
            parsed.scope.journeyId === p.journeyId),
      )
    )
      throw new Error("The requested party is not verified on this booking");
    if (effect.kind === "departure_window") validateDepartureWindow(effect);
  }
}

function validateDepartureWindow(
  effect: Extract<IntentEffect, { kind: "departure_window" }>,
): void {
  if (
    effect.earliest === undefined &&
    effect.latest === undefined &&
    effect.maxDelayMinutes === undefined
  )
    throw new Error("A departure window requires an explicit bound");
  if (
    effect.earliest &&
    effect.latest &&
    Date.parse(effect.earliest) > Date.parse(effect.latest)
  )
    throw new Error("The departure window ends before it begins");
}

function effectResourceKind(effect: OutcomeCondition): Resource["kind"] {
  if (effect.kind === "seat_position" || effect.kind === "seating_together")
    return "seat";
  if (effect.kind === "departure_window" || effect.kind === "flight_unchanged")
    return "flight";
  if (effect.kind === "gate_check") return "handover";
  return effect.kind;
}
function outcomeAllocations(
  s: State,
  person: string,
  journeyId: string,
  kind: Resource["kind"],
) {
  return s.allocations.filter((allocation) => {
    const resource = s.resources.find(
      (item) => item.id === allocation.resource,
    );
    return (
      allocation.person === person &&
      (allocation.journeyId || resource?.journey) === journeyId &&
      (resource?.kind || allocation.resourceKind) === kind
    );
  });
}
/** Outcome facts come from the complete proposed allocation, never a single move. */
export function evaluateOutcomePredicate(
  before: State,
  after: State,
  person: string,
  journeyId: string,
  predicate: OutcomePredicate,
): boolean | undefined {
  return evaluatePredicate(predicate, (condition) =>
    outcomeConditionMatches(before, after, person, journeyId, condition),
  );
}
function outcomeConditionMatches(
  before: State,
  after: State,
  person: string,
  journeyId: string,
  condition: OutcomeCondition,
): boolean | undefined {
  if (condition.kind === "seating_together") {
    const party = after.parties?.find(
      (p) =>
        p.journeyId === journeyId &&
        p.memberIds.includes(person) &&
        (!condition.partyId || condition.partyId === p.id),
    );
    if (!party || !party.memberIds.length) return undefined;
    const seats = party.memberIds.map((member) => {
      const allocations = outcomeAllocations(after, member, journeyId, "seat");
      if (allocations.length !== 1) return undefined;
      return resourceOn(after, allocations[0].resource, journeyId);
    });
    if (seats.some((seat) => !seat?.seatMap)) return undefined;
    const maps = seats
      .map((seat) => seat!.seatMap!)
      .sort((a, b) => a.column - b.column);
    return maps.every(
      (map, i) =>
        map.row === maps[0].row &&
        map.block === maps[0].block &&
        (i === 0 || map.column === maps[i - 1].column + 1),
    );
  }
  const kind = effectResourceKind(condition);
  const allocations = outcomeAllocations(after, person, journeyId, kind);
  if (!allocations.length) return undefined;
  const resources = allocations.flatMap((allocation) => {
    const resource = resourceOn(after, allocation.resource, journeyId);
    return resource ? [resource] : [];
  });
  if (
    allocations.some(
      (allocation) =>
        allocation.resource !== null &&
        !resourceOn(after, allocation.resource, journeyId),
    )
  )
    return undefined;
  if (condition.kind === "seat_position") {
    if (resources.some((resource) => resource.seatPosition === null))
      return undefined;
    return resources.some((resource) =>
      condition.positions.includes(resource.seatPosition!),
    );
  }
  if (condition.kind === "baggage") {
    if (resources.some((resource) => !resource.baggage)) return undefined;
    return (
      resources
        .filter(
          (resource) =>
            condition.maxKgPerPiece === undefined ||
            resource.baggage!.maxKg >= condition.maxKgPerPiece,
        )
        .reduce((pieces, resource) => pieces + resource.baggage!.pieces, 0) >=
      condition.extraPieces
    );
  }
  if (condition.kind === "meal")
    return resources.length > 0 === condition.receive;
  if (condition.kind === "gate_check")
    return resources.length > 0 === condition.allowed;
  const prior = outcomeAllocations(before, person, journeyId, "flight");
  if (condition.kind === "flight_unchanged") {
    if (
      prior.length !== 1 ||
      allocations.length !== 1 ||
      !prior[0].resource ||
      !allocations[0].resource
    )
      return undefined;
    return prior[0].resource === allocations[0].resource;
  }
  if (resources.length !== 1) return undefined;
  const departure = simulationEpoch(after) + resources[0].serviceHour * 3600000;
  const checks: (boolean | undefined)[] = [
    condition.earliest ? departure >= Date.parse(condition.earliest) : true,
    condition.latest ? departure <= Date.parse(condition.latest) : true,
  ];
  if (condition.maxDelayMinutes !== undefined) {
    const from =
      prior.length === 1
        ? resourceOn(before, prior[0].resource, journeyId)
        : undefined;
    checks.push(
      from
        ? (resources[0].serviceHour - from.serviceHour) * 60 <=
            condition.maxDelayMinutes
        : undefined,
    );
  }
  return andTruth(checks);
}

/** An only-if relation does not require, or authorize, its antecedent action. */
export function conditionalOutcomeIssues(
  before: State,
  after: State,
  person: string,
  journeyId: string,
): string[] {
  const rules = rulesFor(before, person, journeyId);
  const guarded = rules.filter(
    (rule) =>
      rule.onlyIf &&
      rule.effect.kind !== "credit_budget" &&
      outcomeConditionMatches(before, after, person, journeyId, rule.effect) !==
        false,
  );
  const errors: string[] = [];
  const kinds = new Set(
    guarded.map((rule) => effectResourceKind(rule.effect as OutcomeCondition)),
  );
  for (const kind of kinds) {
    const old = outcomeAllocations(before, person, journeyId, kind);
    const next = outcomeAllocations(after, person, journeyId, kind);
    if (
      old.length === next.length &&
      old.every((allocation) =>
        next.some(
          (item) =>
            item.key === allocation.key &&
            item.resource === allocation.resource,
        ),
      )
    )
      continue;
    const alternatives = rules.filter(
      (rule) =>
        rule.strength === "flexible" &&
        rule.effect.kind !== "credit_budget" &&
        effectResourceKind(rule.effect) === kind,
    );
    const permissions = alternatives.map((rule) =>
      andTruth([
        outcomeConditionMatches(
          before,
          after,
          person,
          journeyId,
          rule.effect as OutcomeCondition,
        ),
        rule.onlyIf
          ? evaluateOutcomePredicate(
              before,
              after,
              person,
              journeyId,
              rule.onlyIf,
            )
          : true,
      ]),
    );
    if (orTruth(permissions) !== true)
      errors.push(
        `The complete arrangement does not establish an only-if condition in “${guarded
          .filter(
            (rule) =>
              effectResourceKind(rule.effect as OutcomeCondition) === kind,
          )
          .map((rule) => rule.evidence)
          .join(" and ")}”`,
      );
  }
  return errors;
}

/** Keep unchanged companion and service allocations locked while their promise is used. */
export function conditionalOutcomeDependencies(
  s: State,
  person: string,
  journeyId: string,
): string[] {
  const keys = new Set<string>();
  for (const rule of rulesFor(s, person, journeyId)) {
    if (!rule.onlyIf) continue;
    for (const condition of predicateAtoms(rule.onlyIf)) {
      const members =
        condition.kind === "seating_together"
          ? s.parties?.find(
              (p) =>
                p.journeyId === journeyId &&
                p.memberIds.includes(person) &&
                (!condition.partyId || condition.partyId === p.id),
            )?.memberIds || []
          : [person];
      for (const member of members)
        for (const allocation of outcomeAllocations(
          s,
          member,
          journeyId,
          effectResourceKind(condition),
        ))
          keys.add(allocation.key);
    }
  }
  return [...keys].sort();
}
