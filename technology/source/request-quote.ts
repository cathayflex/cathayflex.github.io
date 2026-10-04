import { baggagePlans } from "./baggage-plans.ts";
import { preservesFlightEntitlement } from "./booking-view.ts";
import { isExtraBaggage, isExtraBagSlot } from "./baggage.ts";
import {
  bookedJourneys,
  intentPurpose,
  journeyFacts,
  requestAuthorizationDeadline,
  requestGoalSatisfied,
  requestRulesFor,
  ruleConditionMatches,
  rulesFor,
  validateIntent,
  conditionalOutcomeIssues,
} from "./intent.ts";
import type {
  Candidate,
  IntentRecord,
  IntentRule,
  Resource,
  State,
  OperationalOffer,
} from "./types.ts";

import {
  REQUEST_PRICING_VERSION,
  requestQuoteSchema,
} from "./request-quote-schema.ts";
import type { RequestQuote } from "./request-quote-schema.ts";
export {
  REQUEST_PRICING_VERSION,
  requestQuoteSchema,
} from "./request-quote-schema.ts";
export type { RequestQuote } from "./request-quote-schema.ts";

export type RequestQuoteResult =
  | { status: "quoted"; quote: RequestQuote }
  | { status: "unavailable"; reason: string };

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
const unavailable = (reason: string): RequestQuoteResult => ({
  status: "unavailable",
  reason,
});
const resource = (s: State, id: string | null) =>
  s.resources.find((entry) => entry.id === id);
const onJourney = (
  s: State,
  allocation: State["allocations"][number],
  journeyId: string,
) =>
  (allocation.journeyId || resource(s, allocation.resource)?.journey) ===
  journeyId;
const resourcePrice = (entry: Resource) =>
  Number.isSafeInteger(entry.q) && entry.q >= 0;
const eligible = (entry: Resource, person: string) =>
  !entry.eligible.length || entry.eligible.includes(person);
const seatCost = (from: Resource, to: Resource) =>
  Math.max(0, to.source === "airline_inventory" ? to.q : to.q - from.q);
const seatSettlement = (from: Resource, to: Resource) =>
  to.source === "airline_inventory" ? to.q : to.q - from.q;

function seatReleaseRequestedBy(
  s: State,
  person: string,
  booked: Resource,
  released: Resource,
) {
  return (
    booked.kind === "seat" &&
    booked.journey === released.journey &&
    eligible(released, person) &&
    requestRulesFor(s, person, released.journey).some(
      (rule) =>
        rule.strength !== "flexible" &&
        rule.effect.kind === "seat_position" &&
        !!released.seatPosition &&
        rule.effect.positions.includes(released.seatPosition) &&
        !!booked.seatPosition &&
        !rule.effect.positions.includes(booked.seatPosition),
    )
  );
}

function seatQuoteTerms(
  s: State,
  key: string,
  from: Resource,
  to: Resource,
  version: 1 | 2,
  fixedCampaign?: string | null,
) {
  if (version === 1)
    return { charge: seatCost(from, to), reward: 0, campaign: undefined };
  const amount = seatSettlement(from, to);
  const owner = s.allocations.find(
    (allocation) => allocation.key === key,
  )?.person;
  const requestedRelease = s.allocations.some((allocation) => {
    const booked = resource(s, allocation.resource);
    return (
      allocation.person !== owner &&
      !!booked &&
      seatReleaseRequestedBy(s, allocation.person, booked, from)
    );
  });
  const campaign =
    to.source === "airline_inventory" ||
    fixedCampaign === null ||
    (fixedCampaign === undefined && !requestedRelease)
      ? undefined
      : s.campaigns?.find(
          (entry) =>
            (fixedCampaign === undefined || entry.id === fixedCampaign) &&
            entry.journeyId === from.journey &&
            !!from.seatPosition &&
            !!to.seatPosition &&
            entry.releasePositions.includes(from.seatPosition) &&
            entry.receivePositions.includes(to.seatPosition),
        );
  const reward =
    campaign && !s.usedEvents.includes(`${campaign.id}:${key}:${from.id}`)
      ? {
          id: campaign.id,
          event: `${campaign.id}:${key}:${from.id}`,
          credits: campaign.reward,
          termsKey: canonical(campaign),
        }
      : undefined;
  return {
    charge: Math.max(0, amount),
    reward: Math.max(0, -amount) + (reward?.credits || 0),
    campaign: reward,
  };
}

function catalogKey(s: State, resourceIds: string[]) {
  return canonical(
    resourceIds
      .slice()
      .sort()
      .map((id) => {
        const entry = resource(s, id);
        if (!entry) return null;
        const { kind, product, source, q, seatPosition, seatMap, baggage, flightNumber } =
          entry;
        return { id, kind, product, source, q, seatPosition, seatMap, baggage, flightNumber };
      }),
  );
}

function bookingKey(
  s: State,
  person: string,
  journeyId: string,
  version: 1 | 2,
) {
  const parties = (s.parties || []).filter(
    (party) =>
      party.journeyId === journeyId && party.memberIds.includes(person),
  );
  const members = new Set([
    person,
    ...parties.flatMap((party) => party.memberIds),
  ]);
  return canonical({
    journey: s.journeys?.find((journey) => journey.id === journeyId),
    parties: parties
      .map((party) => ({ ...party, memberIds: [...party.memberIds].sort() }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    allocations: s.allocations
      .filter(
        (allocation) =>
          (allocation.resourceKind || resource(s, allocation.resource)?.kind) !== "service" &&
          !s.serviceProducts?.some(p => p.mealAllocationKey === allocation.key) &&
          members.has(allocation.person) &&
          onJourney(s, allocation, journeyId) &&
          (version === 1 ||
            allocation.person === person ||
            (allocation.resourceKind ||
              resource(s, allocation.resource)?.kind) === "seat"),
      )
      .map(({ key, person: owner, resource: assigned, version }) => ({
        key,
        person: owner,
        resource: assigned,
        version,
      }))
      .sort((a, b) => a.key.localeCompare(b.key)),
  });
}

function seatDestinations(
  s: State,
  person: string,
  journeyId: string,
  rules: IntentRule[],
) {
  const own = s.allocations.find(
    (allocation) =>
      allocation.person === person &&
      onJourney(s, allocation, journeyId) &&
      resource(s, allocation.resource)?.kind === "seat",
  );
  const from = own && resource(s, own.resource);
  if (!own || !from || !resourcePrice(from)) return null;
  const positions = rules.filter(
    (rule) => rule.effect.kind === "seat_position",
  );
  const together = rules.filter(
    (rule) => rule.effect.kind === "seating_together",
  );
  const choices = s.resources.filter(
    (entry) =>
      entry.kind === "seat" && !entry.serviceOnly &&
      entry.journey === journeyId &&
      entry.id !== from.id &&
      (entry.cabin || "Economy") === (from.cabin || "Economy") &&
      entry.serviceHour === from.serviceHour &&
      resourcePrice(entry) &&
      eligible(entry, person) &&
      positions.every(
        (rule) =>
          rule.effect.kind === "seat_position" &&
          rule.effect.positions.includes(entry.seatPosition!),
      ),
  );
  if (!together.length) return { own, from, choices };
  const parties = (s.parties || []).filter(
    (party) =>
      party.journeyId === journeyId &&
      party.memberIds.includes(person) &&
      together.every(
        (rule) =>
          rule.effect.kind === "seating_together" &&
          (!rule.effect.partyId || rule.effect.partyId === party.id),
      ),
  );
  if (
    parties.length !== 1 ||
    parties[0].memberIds.length < 2 ||
    parties[0].memberIds.length > 8
  )
    return null;
  const party = parties[0];
  const current = party.memberIds.map(
    (member) =>
      s.allocations.find(
        (allocation) =>
          allocation.person === member &&
          onJourney(s, allocation, journeyId) &&
          resource(s, allocation.resource)?.kind === "seat",
      )?.resource,
  );
  if (current.some((id) => !id)) return null;
  const maps = s.resources.filter(
    (entry) =>
      entry.kind === "seat" && !entry.serviceOnly && entry.journey === journeyId && entry.seatMap,
  );
  const blocks = new Map<string, Resource[]>();
  for (const entry of maps) {
    const key = `${entry.seatMap!.row}:${entry.seatMap!.block}`;
    blocks.set(key, [...(blocks.get(key) || []), entry]);
  }
  const options: { seat: Resource; moves: number }[] = [];
  for (const seats of blocks.values()) {
    seats.sort((a, b) => a.seatMap!.column - b.seatMap!.column);
    for (let i = 0; i + party.memberIds.length <= seats.length; i++) {
      const tuple = seats.slice(i, i + party.memberIds.length);
      if (
        !tuple.every(
          (seat, index) =>
            !index ||
            seat.seatMap!.column === tuple[index - 1].seatMap!.column + 1,
        )
      )
        continue;
      for (const seat of choices.filter((choice) => tuple.includes(choice))) {
        // First preserve as many booked seats as possible. If all companions
        // must move, the same geometry can still receive a fixed quote.
        const unchanged = current.filter(
          (id, index) =>
            party.memberIds[index] !== person &&
            id !== seat.id &&
            tuple.some((entry) => entry.id === id),
        ).length;
        options.push({ seat, moves: party.memberIds.length - unchanged });
      }
    }
  }
  const minimumMoves = Math.min(
    Infinity,
    ...options.map((option) => option.moves),
  );
  return {
    own,
    from,
    choices: [
      ...new Set(
        options
          .filter((option) => option.moves === minimumMoves)
          .map((option) => option.seat),
      ),
    ],
  };
}

/** Quote a reviewed draft before publication. Its revision is the existing revision. */
function operationalTerms(s: State, candidate: Pick<Candidate, "id" | "changes" | "credits" | "issuance" | "redemption" | "budget" | "evidence" | "requiredEvents">) {
  return canonical({
    id: candidate.id,
    changes: [...candidate.changes].sort((a, b) => a.key.localeCompare(b.key)),
    credits: candidate.credits,
    issuance: candidate.issuance,
    redemption: candidate.redemption,
    budget: candidate.budget,
    evidence: candidate.evidence,
    requiredEvents: candidate.requiredEvents,
    resources: [...new Set(candidate.changes.flatMap(change => [change.from, change.to].filter((id): id is string => !!id)))].sort().map(id => {
      const entry = resource(s, id);
      return entry && {id, kind: entry.kind, journey: entry.journey, serviceHour: entry.serviceHour, flightNumber: entry.flightNumber,
        deadline: entry.deadline, product: entry.product, cabin: entry.cabin, q: entry.q,
        eligible: [...entry.eligible].sort(), seatPosition: entry.seatPosition, seatMap: entry.seatMap,
        baggage: entry.baggage, mealName: entry.mealName};
    }),
  });
}

function operationalChanges(s: State, offer: OperationalOffer) {
  return offer.changes.flatMap((change) => {
    const allocation = s.allocations.find((entry) => entry.key === change.allocationKey);
    return allocation ? [{ key: allocation.key, from: allocation.resource, to: change.to, version: allocation.version }] : [];
  });
}

/** Departure requests quote a complete airline plan, including replacement seats.
 * Inventory and approval are checked by the transaction engine at reservation.
 * The plan's published price does not vary with current demand or the wallet.
 */
function quoteDeparturePlan(
  s: State,
  person: string,
  record: IntentRecord,
  goals: IntentRule[],
  options: { validUntil?: number; fixedPlanId?: string },
): RequestQuoteResult {
  if (record.scope.kind !== "journey") return unavailable("Choose a journey on your booking.");
  const journeyId = record.scope.journeyId;
  const plans = (s.operationalOffers || []).flatMap((offer) => {
    if (options.fixedPlanId && offer.id !== options.fixedPlanId) return [];
    const changes = operationalChanges(s, offer);
    if (changes.length !== offer.changes.length || new Set(changes.map(change => change.key)).size !== changes.length) return [];
    const own = changes.filter(change => s.allocations.find(entry => entry.key === change.key)?.person === person);
    if (!own.some(change => change.from !== change.to && resource(s, change.to)?.kind === "flight")) return [];
    if (own.some(change => {
      const from = resource(s, change.from), to = resource(s, change.to);
      return change.from === change.to || !to || !["flight", "seat", "baggage", "meal", "service"].includes(to.kind)
        || to.journey !== journeyId || !eligible(to, person)
        || (to.kind === "baggage" && !goals.some(rule => rule.effect.kind === "baggage") && !preservesFlightEntitlement(s, change))
        || (["meal", "service"].includes(to.kind) && !preservesFlightEntitlement(s, change))
        || (from && (from.kind !== to.kind || from.journey !== to.journey))
        || (from?.kind === "flight" && from.product !== to.product)
        || (from?.kind === "seat" && (from.cabin || "Economy") !== (to.cabin || "Economy"));
    })) return [];
    const projected: State = { ...s, allocations: s.allocations.map(allocation => {
      const change = changes.find(entry => entry.key === allocation.key);
      return change ? { ...allocation, resource: change.to } : allocation;
    }) };
    const owned = projected.allocations.filter(allocation => allocation.person === person)
      .flatMap(allocation => { const entry = resource(s, allocation.resource); return entry?.journey === journeyId ? [entry] : []; });
    const flights = owned.filter(entry => entry.kind === "flight");
    if (owned.some(entry => ["seat", "meal", "baggage", "service"].includes(entry.kind) &&
      !flights.some(flight => flight.serviceHour === entry.serviceHour))) return [];
    const hardRules = rulesFor(s, person, journeyId).filter(rule => rule.recordId !== record.id && rule.strength === "must");
    if (![...goals, ...hardRules].every(rule => requestGoalSatisfied(projected, person, journeyId, rule, s))
      || conditionalOutcomeIssues(s, projected, person, journeyId).length) return [];
    const net = offer.credits[person] || 0;
    if (!Number.isSafeInteger(net) || Math.abs(net) > 1000000) return [];
    const deadline = Math.min(requestAuthorizationDeadline(s, person, record), ...changes.flatMap(change =>
      [change.from, change.to].flatMap(id => { const entry = resource(s, id); return entry ? [entry.deadline] : []; })));
    if (deadline <= s.hour) return [];
    return [{ offer, changes, own, net, deadline }];
  }).sort((a, b) => b.net - a.net || a.offer.id.localeCompare(b.offer.id));
  const plan = plans[0];
  if (!plan) return unavailable("No complete flight arrangement currently matches this request.");
  const validUntil = options.validUntil ?? plan.deadline;
  if (!Number.isFinite(validUntil) || validUntil <= s.hour || validUntil > plan.deadline)
    return unavailable("The quote must expire before the requested services close.");
  const chargeCredits = Math.max(0, -plan.net), rewardCredits = Math.max(0, plan.net);
  const pricedFlight = plan.own.find(change => resource(s, change.to)?.kind === "flight")!.key;
  const lineItems = plan.own.map(change => {
    const target = resource(s, change.to)!;
    const priced = change.key === pricedFlight;
    return {
      kind: target.kind as "flight" | "seat" | "baggage" | "meal" | "service",
      label: target.label,
      ruleIds: goals.map(rule => rule.id).sort(),
      resourceIds: [target.id],
      catalogKey: catalogKey(s, [target.id]),
      allocationKeys: [change.key],
      quantity: 1,
      unitCredits: priced ? chargeCredits : 0,
      credits: priced ? chargeCredits : 0,
      unitRewardCredits: priced ? rewardCredits : 0,
      rewardCredits: priced ? rewardCredits : 0,
    };
  });
  const quote: RequestQuote = {
    version: 2,
    id: `request-quote:${person}:${record.id}:${record.revision + 1}:${s.hour}`,
    person, journeyId, intentId: record.id, targetRevision: record.revision + 1,
    pricingVersion: REQUEST_PRICING_VERSION, issuedAt: s.hour, validUntil,
    outcomeKey: canonical({ sourceText: record.sourceText, scope: record.scope, rules: record.rules }),
    bookingKey: bookingKey(s, person, journeyId, 2),
    debit: chargeCredits, allowPartial: false, lineItems,
    operationalPlan: { id: plan.offer.id, termsKey: operationalTerms(s, { ...plan.offer, changes: plan.changes }) },
    settlement: { chargeCredits, rewardCredits, netCredits: plan.net },
  };
  const parsed = requestQuoteSchema.safeParse(quote);
  return parsed.success ? { status: "quoted", quote: parsed.data }
    : unavailable("This arrangement exceeds the supported fixed quote limits.");
}

export function quoteRequest(
  s: State,
  person: string,
  record: IntentRecord,
  options: {
    validUntil?: number;
    version?: 1 | 2;
    fixedCampaigns?: Record<string, string | null>;
    fixedPlanId?: string;
  } = {},
): RequestQuoteResult {
  const version = options.version ?? 2;
  try {
    validateIntent(s, person, record);
  } catch (error) {
    return unavailable(
      error instanceof Error
        ? error.message
        : "Review the request details first.",
    );
  }
  if (
    intentPurpose(record) !== "request" ||
    record.scope.kind !== "journey" ||
    record.questions.length
  )
    return unavailable(
      "Resolve the journey and request details before getting a quote.",
    );
  const journeyId = record.scope.journeyId;
  if (!bookedJourneys(s, person).includes(journeyId))
    return unavailable("Choose a journey on your booking.");
  if (record.rules.some((rule) => rule.effect.kind === "credit_budget"))
    return unavailable(
      "Remove the credit limit from this request. Flex will quote a fixed price for the requested changes.",
    );
  const facts = journeyFacts(s, person, journeyId);
  if (
    record.rules.some((rule) => ruleConditionMatches(facts, rule) === undefined)
  )
    return unavailable(
      "A request condition still needs verified booking details.",
    );
  const goals = record.rules.filter(
    (rule) =>
      rule.strength !== "flexible" &&
      ruleConditionMatches(facts, rule) === true,
  );
  const unmet = goals.filter(
    (rule) => !requestGoalSatisfied(s, person, journeyId, rule),
  );
  if (!unmet.length)
    return unavailable("Your booking already meets this request.");
  if (unmet.some(rule => rule.effect.kind === "departure_window"))
    return version === 2 ? quoteDeparturePlan(s, person, record, goals, options)
      : unavailable("Review a current fixed quote for this flight arrangement.");
  if (
    unmet.some(
      (rule) =>
        !["seat_position", "seating_together", "baggage"].includes(
          rule.effect.kind,
        ),
    )
  )
    return unavailable(
      "A fixed catalog price is not available for every part of this request. Review an exact offer before accepting these changes.",
    );
  const lineItems: Extract<RequestQuote, { version: 2 }>["lineItems"] = [];
  const seatGoals = goals.filter((rule) =>
    ["seat_position", "seating_together"].includes(rule.effect.kind),
  );
  const standingHardSeats = rulesFor(s, person, journeyId).filter(
    (rule) =>
      rule.recordId !== record.id &&
      rule.strength === "must" &&
      ["seat_position", "seating_together"].includes(rule.effect.kind),
  );
  if (unmet.some((rule) => seatGoals.includes(rule))) {
    const destinations = seatDestinations(s, person, journeyId, [
      ...seatGoals,
      ...standingHardSeats,
    ]);
    if (!destinations?.choices.length)
      return unavailable(
        "A fixed seating price is not available for this arrangement yet.",
      );
    const priced = destinations.choices.map((seat) => ({
      seat,
      terms: seatQuoteTerms(
        s,
        destinations.own.key,
        destinations.from,
        seat,
        version,
        options.fixedCampaigns?.[destinations.own.key],
      ),
    }));
    priced.sort(
      (a, b) =>
        a.terms.charge - a.terms.reward - (b.terms.charge - b.terms.reward) ||
        a.seat.id.localeCompare(b.seat.id),
    );
    const terms = priced[0].terms;
    const tier = priced
      .filter((entry) => canonical(entry.terms) === canonical(terms))
      .map((entry) => entry.seat);
    lineItems.push({
      kind: "seat",
      label: seatGoals.some((rule) => rule.effect.kind === "seating_together")
        ? "Seats together"
        : "Requested seat",
      ruleIds: seatGoals.map((rule) => rule.id).sort(),
      resourceIds: tier.map((seat) => seat.id).sort(),
      catalogKey: catalogKey(
        s,
        tier.map((seat) => seat.id),
      ),
      allocationKeys: [destinations.own.key],
      quantity: 1,
      unitCredits: terms.charge,
      credits: terms.charge,
      unitRewardCredits: terms.reward,
      rewardCredits: terms.reward,
      ...(terms.campaign ? { campaign: terms.campaign } : {}),
    });
  }
  const bagGoals = goals.filter((rule) => rule.effect.kind === "baggage");
  if (unmet.some((rule) => bagGoals.includes(rule))) {
    const result = baggagePlans(s, person, journeyId, bagGoals, {createSlots: true, maxPlans: 1});
    const plan = result.plans[0];
    if (!plan) return unavailable(result.limited === "work_limit"
      ? "This baggage request needs a more specific selection. Review the baggage quantities and weights."
      : "An exact baggage product with a fixed catalog price is not available for this request.");
    const own = s.allocations.filter(allocation => allocation.person === person &&
      onJourney(s, allocation, journeyId) && isExtraBagSlot(s, allocation));
    const slots = [...new Set([...own.filter(allocation => allocation.resource === null).map(allocation => allocation.key),
      ...plan.changes.map(change => change.key)])].sort();
    const requested = Math.max(...bagGoals.map(rule => rule.effect.kind === "baggage" ? rule.effect.extraPieces : 0));
    for (let index = own.length; index < requested; index++) {
      const key = `extra-baggage:${person}:${journeyId}:${index}`;
      if (!slots.includes(key)) slots.push(key);
    }
    const groups = new Map<string, {product: Resource; quantity: number}>();
    const productTerms = (entry: Resource) => canonical({product: entry.product, q: entry.q, baggage: entry.baggage});
    for (const change of plan.changes) {
      const product = resource(s, change.to)!, key = productTerms(product), prior = groups.get(key);
      if (prior) prior.quantity++;
      else groups.set(key, {product, quantity: 1});
    }
    for (const {product, quantity} of groups.values()) {
      const tier = s.resources.filter(entry => isExtraBaggage(entry) && entry.journey === journeyId &&
        entry.source === "airline_inventory" && eligible(entry, person) && productTerms(entry) === productTerms(product));
      const pieces = product.baggage!.pieces * quantity;
      lineItems.push({
        kind: "baggage",
        label: `${pieces} extra checked ${pieces === 1 ? "bag" : "bags"} up to ${product.baggage!.maxKg} kg each`,
        ruleIds: bagGoals.map(rule => rule.id).sort(),
        resourceIds: tier.map(entry => entry.id).sort(),
        catalogKey: catalogKey(s, tier.map(entry => entry.id)),
        allocationKeys: slots,
        quantity, unitCredits: product.q, credits: product.q * quantity,
        unitRewardCredits: 0, rewardCredits: 0,
      });
    }
  }

  const deadline = Math.min(
    requestAuthorizationDeadline(s, person, record),
    ...lineItems.flatMap((item) =>
      item.resourceIds.map((id) => resource(s, id)!.deadline),
    ),
  );
  const validUntil = options.validUntil ?? deadline;
  if (
    !Number.isFinite(validUntil) ||
    validUntil <= s.hour ||
    validUntil > deadline
  )
    return unavailable(
      "The quote must expire before the requested services close.",
    );
  const chargeCredits = lineItems.reduce((sum, item) => sum + item.credits, 0);
  const rewardCredits = lineItems.reduce(
    (sum, item) => sum + item.rewardCredits,
    0,
  );
  const common = {
    id: `request-quote:${person}:${record.id}:${record.revision + 1}:${s.hour}`,
    person,
    journeyId,
    intentId: record.id,
    targetRevision: record.revision + 1,
    pricingVersion: REQUEST_PRICING_VERSION as typeof REQUEST_PRICING_VERSION,
    issuedAt: s.hour,
    validUntil,
    outcomeKey: canonical({
      sourceText: record.sourceText,
      scope: record.scope,
      rules: record.rules,
      standingHardSeats,
    }),
    bookingKey: bookingKey(s, person, journeyId, version),
    debit: Math.max(0, chargeCredits - rewardCredits),
    allowPartial: false as const,
  };
  const quote: RequestQuote =
    version === 1
      ? {
          ...common,
          version: 1,
          lineItems: lineItems.map(
            ({ unitRewardCredits, rewardCredits, campaign, ...item }) => {
              void unitRewardCredits;
              void rewardCredits;
              void campaign;
              return item;
            },
          ),
        }
      : {
          ...common,
          version: 2,
          lineItems,
          settlement: {
            chargeCredits,
            rewardCredits,
            netCredits: rewardCredits - chargeCredits,
          },
        };
  const parsed = requestQuoteSchema.safeParse(quote);
  return parsed.success
    ? { status: "quoted", quote: parsed.data }
    : unavailable("This request exceeds the supported fixed quote limits.");
}

/** Validate against the current booking before publishing or reserving a quote. */
export function validateRequestQuote(
  s: State,
  person: string,
  record: IntentRecord,
  input: RequestQuote,
): string[] {
  const parsed = requestQuoteSchema.safeParse(input);
  if (!parsed.success) return ["Review a new fixed quote before publishing."];
  const quote = parsed.data;
  if (quote.issuedAt > s.hour || quote.validUntil <= s.hour)
    return ["This quote has expired. Review a new quote."];
  // Recompute every field. The readable quote ID is a reference, never a proof
  // of authority. Altering a client debit or binding cannot grant consent.
  const result = quoteRequest({ ...s, hour: quote.issuedAt }, person, record, {
    validUntil: quote.validUntil,
    version: quote.version,
    fixedPlanId: quote.version === 2 ? quote.operationalPlan?.id : undefined,
    // Demand can affect which campaign is available for a new quote. Accepted
    // commercial terms remain fixed when unrelated requests arrive or leave.
    fixedCampaigns:
      quote.version === 2
        ? Object.fromEntries(
            quote.lineItems
              .filter((item) => item.kind === "seat")
              .flatMap((item) =>
                item.allocationKeys.map((key) => [
                  key,
                  item.campaign?.id ?? null,
                ]),
              ),
          )
        : undefined,
  });
  return result.status === "quoted" &&
    canonical(result.quote) === canonical(quote)
    ? []
    : [
        "The request, booking or quoted products changed. Review a new fixed quote.",
      ];
}

/** Recheck an accepted quote's source and booking context before reservation. */
export function acceptedQuoteContextCurrent(
  s: State,
  person: string,
  record: IntentRecord,
  quote: RequestQuote,
): boolean {
  if (record.revision !== quote.targetRevision || record.id !== quote.intentId)
    return false;
  try {
    const baseline = JSON.parse(quote.bookingKey) as {
      allocations?: { key: string }[];
    };
    if (!Array.isArray(baseline.allocations)) return false;
    const originalKeys = new Set(
      baseline.allocations.map((allocation) => allocation.key),
    );
    const addedBagKeys = new Set(
      quote.lineItems
        .filter((item) => item.kind === "baggage")
        .flatMap((item) => item.allocationKeys),
    );
    const originalContext = {
      ...s,
      allocations: s.allocations.filter(
        (allocation) =>
          !(
            !originalKeys.has(allocation.key) &&
            addedBagKeys.has(allocation.key) &&
            allocation.person === person &&
            allocation.resource === null &&
            allocation.resourceKind === "baggage" &&
            allocation.version === 1
          ),
      ),
    };
    return (
      validateRequestQuote(
        originalContext,
        person,
        { ...record, revision: record.revision - 1 },
        quote,
      ).length === 0
    );
  } catch {
    return false;
  }
}

/** Check exact quoted products and line prices in a complete candidate. */
export function quoteCoversCandidate(
  s: State,
  person: string,
  quote: RequestQuote,
  candidate: Candidate,
): boolean {
  if (
    quote.person !== person ||
    quote.pricingVersion !== candidate.pricingVersion ||
    (quote.version === 2
      ? (candidate.credits[person] || 0) !== quote.settlement.netCredits
      : Math.max(0, -(candidate.credits[person] || 0)) !== quote.debit)
  )
    return false;
  if (quote.version === 2 && quote.operationalPlan) {
    if (candidate.id !== quote.operationalPlan.id || operationalTerms(s, candidate) !== quote.operationalPlan.termsKey) return false;
    const ownChanges = candidate.changes.filter(change => s.allocations.find(allocation => allocation.key === change.key)?.person === person);
    return ownChanges.length === quote.lineItems.length && quote.lineItems.every(item =>
      catalogKey(s, item.resourceIds) === item.catalogKey && ownChanges.some(change =>
        item.allocationKeys.includes(change.key) && !!change.to && item.resourceIds.includes(change.to)));
  }
  const ownChanges = candidate.changes.filter(
    (change) =>
      s.allocations.find((allocation) => allocation.key === change.key)
        ?.person === person,
  );
  if (
    ownChanges.length !==
    quote.lineItems.reduce((sum, item) => sum + item.quantity, 0)
  )
    return false;
  return quote.lineItems.every((item) => {
    if (catalogKey(s, item.resourceIds) !== item.catalogKey) return false;
    const changes = ownChanges.filter(
      (change) =>
        item.allocationKeys.includes(change.key) &&
        !!change.to &&
        item.resourceIds.includes(change.to),
    );
    if (changes.length !== item.quantity) return false;
    return changes.every((change) => {
      const to = resource(s, change.to),
        from = resource(s, change.from);
      if (!to || to.kind !== item.kind) return false;
      const quotedCampaign =
        "campaign" in item
          ? (item.campaign as Extract<
              RequestQuote,
              { version: 2 }
            >["lineItems"][number]["campaign"])
          : undefined;
      const terms =
        item.kind === "seat" && from
          ? seatQuoteTerms(
              s,
              change.key,
              from,
              to,
              quote.version,
              quote.version === 2 ? (quotedCampaign?.id ?? null) : undefined,
            )
          : { charge: to.q, reward: 0, campaign: undefined };
      if (terms.charge !== item.unitCredits) return false;
      if (quote.version === 1) return true;
      if (
        !("unitRewardCredits" in item) ||
        terms.reward !== item.unitRewardCredits ||
        canonical(terms.campaign) !== canonical(quotedCampaign)
      )
        return false;
      if (!terms.campaign) return true;
      const receiver = candidate.changes.find(
        (entry) => entry.to === change.from && entry.key !== change.key,
      );
      const recipient =
        receiver && s.allocations.find((entry) => entry.key === receiver.key);
      const recipientBefore = receiver && resource(s, receiver.from);
      const campaign = s.campaigns?.find(
        (entry) => entry.id === terms.campaign!.id,
      );
      return (
        !!from &&
        !!recipient &&
        recipient.person !== person &&
        !!recipientBefore &&
        seatReleaseRequestedBy(s, recipient.person, recipientBefore, from) &&
        [candidate.event, ...(candidate.requiredEvents || [])].includes(
          terms.campaign.event,
        ) &&
        candidate.budget === campaign?.budget &&
        candidate.issuance >= terms.campaign.credits
      );
    });
  });
}
