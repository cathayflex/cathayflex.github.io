import {
  bookedJourneys,
  intentPurpose,
  journeyFacts,
  requestAuthorizationDeadline,
  requestGoalSatisfied,
  ruleConditionMatches,
  rulesFor,
  validateIntent,
} from "./intent.ts";
import type {
  Candidate,
  IntentRecord,
  IntentRule,
  Resource,
  State,
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

function catalogKey(s: State, resourceIds: string[]) {
  return canonical(
    resourceIds
      .slice()
      .sort()
      .map((id) => {
        const entry = resource(s, id);
        if (!entry) return null;
        const { kind, product, source, q, seatPosition, seatMap, baggage } =
          entry;
        return { id, kind, product, source, q, seatPosition, seatMap, baggage };
      }),
  );
}

function bookingKey(s: State, person: string, journeyId: string) {
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
          members.has(allocation.person) && onJourney(s, allocation, journeyId),
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
      entry.kind === "seat" &&
      entry.journey === journeyId &&
      entry.id !== from.id &&
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
      entry.kind === "seat" && entry.journey === journeyId && entry.seatMap,
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
export function quoteRequest(
  s: State,
  person: string,
  record: IntentRecord,
  options: { validUntil?: number } = {},
): RequestQuoteResult {
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
  const lineItems: RequestQuote["lineItems"] = [];
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
    const price = Math.min(
      ...destinations.choices.map((seat) => seatCost(destinations.from, seat)),
    );
    const tier = destinations.choices.filter(
      (seat) => seatCost(destinations.from, seat) === price,
    );
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
      unitCredits: price,
      credits: price,
    });
  }
  const bagGoals = goals.filter((rule) => rule.effect.kind === "baggage");
  if (unmet.some((rule) => bagGoals.includes(rule))) {
    const pieces = Math.max(
      ...bagGoals.map((rule) =>
        rule.effect.kind === "baggage" ? rule.effect.extraPieces : 0,
      ),
    );
    const minimumKg = Math.max(
      0,
      ...bagGoals.map((rule) =>
        rule.effect.kind === "baggage" ? rule.effect.maxKgPerPiece || 0 : 0,
      ),
    );
    const own = s.allocations.filter(
      (allocation) =>
        allocation.person === person &&
        onJourney(s, allocation, journeyId) &&
        (allocation.resourceKind === "baggage" ||
          resource(s, allocation.resource)?.kind === "baggage"),
    );
    const supplied = own.reduce((sum, allocation) => {
      const entry = resource(s, allocation.resource);
      return (
        sum +
        ((entry?.baggage?.maxKg || 0) >= minimumKg
          ? entry?.baggage?.pieces || 0
          : 0)
      );
    }, 0);
    const needed = pieces - supplied;
    const products = s.resources.filter(
      (entry) =>
        entry.kind === "baggage" &&
        entry.journey === journeyId &&
        entry.source === "airline_inventory" &&
        eligible(entry, person) &&
        resourcePrice(entry) &&
        entry.baggage?.passenger === person &&
        entry.baggage.pieces > 0 &&
        entry.baggage.maxKg >= minimumKg &&
        needed > 0 &&
        needed % entry.baggage.pieces === 0,
    );
    if (!products.length)
      return unavailable(
        "An exact baggage product with a fixed catalog price is not available for this request.",
      );
    products.sort(
      (a, b) =>
        (a.q * needed) / a.baggage!.pieces -
          (b.q * needed) / b.baggage!.pieces ||
        a.baggage!.maxKg - b.baggage!.maxKg ||
        a.id.localeCompare(b.id),
    );
    const product = products[0],
      quantity = needed / product.baggage!.pieces;
    const slots = own
      .filter((allocation) => allocation.resource === null)
      .map((allocation) => allocation.key)
      .sort();
    // Publishing creates these empty entitlement slots deterministically.
    for (let index = own.length; index < pieces; index++)
      slots.push(`extra-baggage:${person}:${journeyId}:${index}`);
    if (slots.length < quantity)
      return unavailable(
        "This baggage quantity cannot be represented by the booking.",
      );
    const tier = products.filter(
      (entry) =>
        entry.q === product.q &&
        entry.product === product.product &&
        canonical(entry.baggage) === canonical(product.baggage),
    );
    lineItems.push({
      kind: "baggage",
      label: `${needed} extra checked ${needed === 1 ? "bag" : "bags"} · Up to ${product.baggage!.maxKg} kg each`,
      ruleIds: bagGoals.map((rule) => rule.id).sort(),
      resourceIds: tier.map((entry) => entry.id).sort(),
      catalogKey: catalogKey(
        s,
        tier.map((entry) => entry.id),
      ),
      allocationKeys: slots,
      quantity,
      unitCredits: product.q,
      credits: product.q * quantity,
    });
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
  const quote: RequestQuote = {
    version: 1,
    id: `request-quote:${person}:${record.id}:${record.revision + 1}:${s.hour}`,
    person,
    journeyId,
    intentId: record.id,
    targetRevision: record.revision + 1,
    pricingVersion: REQUEST_PRICING_VERSION,
    issuedAt: s.hour,
    validUntil,
    outcomeKey: canonical({
      sourceText: record.sourceText,
      scope: record.scope,
      rules: record.rules,
      standingHardSeats,
    }),
    bookingKey: bookingKey(s, person, journeyId),
    debit: lineItems.reduce((sum, item) => sum + item.credits, 0),
    lineItems,
    allowPartial: false,
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
  if (!parsed.success)
    return ["Review a valid platform quote before publishing."];
  const quote = parsed.data;
  if (quote.issuedAt > s.hour || quote.validUntil <= s.hour)
    return ["This quote has expired. Review a new quote."];
  // Recompute every field. The readable quote ID is a reference, never a proof
  // of authority. Altering a client debit or binding cannot grant consent.
  const result = quoteRequest({ ...s, hour: quote.issuedAt }, person, record, {
    validUntil: quote.validUntil,
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
    Math.max(0, -(candidate.credits[person] || 0)) !== quote.debit
  )
    return false;
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
      const cost = item.kind === "seat" && from ? seatCost(from, to) : to.q;
      return cost === item.unitCredits;
    });
  });
}
