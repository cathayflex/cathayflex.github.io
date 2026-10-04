import { seatNumber } from "./resource-label.ts";
import { conditionalOutcomeIssues, rulesFor } from "./intent.ts";
import { bookedJourney, confirmedAllocations } from "./booking-view.ts";
import type {
  Candidate,
  Contract,
  ServiceOffer,
  ServiceProduct,
  State,
} from "./types.ts";
import { capacityPoolErrors } from "./capacity.ts";
import {
  candidatePlansConflict,
  outstandingCapacityDemand,
} from "./selection.ts";

const active = (c: Contract) =>
  ["QUEUED", "HELD", "ACCEPTED", "AWAITING_EVIDENCE", "RECONCILING"].includes(c.status);
const resource = (s: State, id: string | null) =>
  s.resources.find((r) => r.id === id);
const seatFor = (s: State, person: string, journey: string) =>
  s.allocations.find(
    (a) =>
      a.person === person &&
      resource(s, a.resource)?.kind === "seat" &&
      resource(s, a.resource)?.journey === journey,
  );
export const serviceSlot = (person: string, product: ServiceProduct) =>
  `extra:${person}:${product.journeyId}:${product.kind}`;
export function effectiveServiceProduct(
  s: State,
  person: string,
  product: ServiceProduct,
): ServiceProduct {
  if (product.kind !== "upgrade") return product;
  const includes = resource(s, product.resourceId)?.includedServices || [];
  const paid = s.contracts
    .filter(
      (c) =>
        c.status === "SETTLED" &&
        c.serviceOrder?.person === person &&
        c.serviceOrder.product.journeyId === product.journeyId &&
        includes.includes(c.serviceOrder.product.kind as "wifi" | "lounge"),
    )
    .reduce((total, c) => total + c.redemption, 0);
  return paid
    ? {
        ...product,
        credits: Math.max(0, product.credits - paid),
        terms: [
          ...product.terms,
          `${paid} credits already paid for included services applied to this upgrade`,
        ],
      }
    : product;
}
export function serviceQuoteKey(
  s: State,
  person: string,
  product: ServiceProduct,
) {
  const seat = seatFor(s, person, product.journeyId);
  const meal = s.allocations.find((a) => a.key === (product.mealAllocationKey || product.baggageAllocationKey));
  return JSON.stringify([
    product,
    person,
    product.kind === "upgrade" || product.kind === "neighbour_free"
      ? [seat?.key, seat?.resource, seat?.version]
      : null,
    meal ? [meal.key, meal.resource, meal.version] : null,
  ]);
}
export function serviceCandidate(
  s: State,
  person: string,
  product: ServiceProduct,
  phase: "queue" | "allocated" = product.deferred ? "queue" : "allocated",
): Candidate {
  const seat = seatFor(s, person, product.journeyId);
  const key =
    product.kind === "upgrade"
      ? seat?.key
      : product.kind === "baggage_release"
        ? product.baggageAllocationKey
      : product.kind === "meal_skip"
        ? product.mealAllocationKey
        : serviceSlot(person, product);
  const allocation = s.allocations.find((a) => a.key === key);
  const dependencies = s.allocations.filter(
    (a) =>
      a.person === person &&
      resource(s, a.resource)?.kind === "flight" &&
      resource(s, a.resource)?.journey === product.journeyId,
  );
  if (product.kind === "neighbour_free" && seat) dependencies.push(seat);
  const reward = Math.max(0, -product.credits);
  return {
    id: `service:${person}:${product.id}:${product.revision}`,
    title: product.title,
    description: product.description,
    serviceOrder: {
      product: structuredClone(product),
      person,
      quotedAt: s.hour,
      phase,
    },
    participants: [person],
    category: reward ? "earn" : "redeem",
    changes: phase === "queue" ? [] : [
      {
        key: key || "",
        from: allocation?.resource || null,
        to: ["meal_skip", "baggage_release"].includes(product.kind) ? null : product.resourceId,
        version: allocation?.version || 0,
      },
    ],
    dependencies: phase === "queue" ? [] : dependencies.map((a) => ({
      key: a.key,
      from: a.resource,
      to: a.resource,
      version: a.version,
    })),
    pricingVersion: "SERVICES-2026-10",
    credits: { [person]: -product.credits },
    issuance: reward,
    redemption: Math.max(0, product.credits),
    budget: product.budget,
    event: reward ? product.kind === "baggage_release" ? `baggage-return:${product.entitlementId}` : `meal:${product.mealAllocationKey}` : undefined,
    evidence: product.delivery === "departure" ? "service_delivery" : undefined,
    gain: 1,
    value: reward ? reward + 10 : product.credits,
    cost: 0,
    risk: 0,
    deadline: product.bookBy,
    prerequisites: [],
    conditions: product.terms,
  };
}
export function ensureServiceSlot(
  s: State,
  person: string,
  product: ServiceProduct,
) {
  if (["meal_skip", "upgrade", "baggage_release"].includes(product.kind)) return;
  const key = serviceSlot(person, product);
  if (!s.allocations.some((a) => a.key === key))
    s.allocations.push({
      key,
      person,
      resource: null,
      version: 0,
      journeyId: product.journeyId,
      resourceKind: "service",
    });
}
export function serviceErrors(
  s: State,
  c: Candidate,
  except?: string,
): string[] {
  const order = c.serviceOrder;
  if (!order) return ["The service order is missing."];
  const p = order.product,
    person = order.person;
  const existing = except
    ? s.contracts.find((c) => c.contractId === except)
    : undefined;
  const errors: string[] = [];
  const queued = order.phase === "queue";
  if (queued && (!p.deferred || c.changes.length || c.dependencies.length)) errors.push("Invalid queued request.");
  const stored = s.serviceProducts?.find((product) => product.id === p.id);
  const live = stored && effectiveServiceProduct(s, person, stored);
  if (!existing && JSON.stringify(live) !== JSON.stringify(p))
    errors.push("This service quote has changed. Review the current price.");
  if (
    s.contracts.some(
      (c) =>
        c.contractId !== except &&
        c.serviceOrder?.person === person &&
        c.serviceOrder.product.journeyId === p.journeyId &&
        c.serviceOrder.product.kind === p.kind &&
        (p.kind !== "meal_skip" || c.serviceOrder.product.mealAllocationKey === p.mealAllocationKey) &&
        (p.kind !== "baggage_release" || c.serviceOrder.product.entitlementId === p.entitlementId) &&
        (active(c) || c.status === "SETTLED"),
    )
  )
    errors.push("This service is already on your booking.");
  const cutoff = existing?.accepted.includes(person) ? p.confirmBy : p.bookBy;
  if (s.hour >= cutoff) errors.push("This service is closed for this flight.");
  if (
    !s.people.some((a) => a.id === person) ||
    (p.person && p.person !== person)
  )
    errors.push("This service belongs to another traveller.");
  const seat = seatFor(s, person, p.journeyId);
  if (!seat) errors.push("A confirmed seat on this flight is required.");
  if (
    resource(s, seat?.resource || null)?.serviceHour !==
    resource(s, p.resourceId)?.serviceHour
  )
    errors.push(
      "This service belongs to a different departure. Review services for your current flight.",
    );
  if (
    !Number.isSafeInteger(p.credits) ||
    c.credits[person] !== -p.credits ||
    c.issuance !== Math.max(0, -p.credits) ||
    c.redemption !== Math.max(0, p.credits) ||
    c.participants.length !== 1 ||
    c.participants[0] !== person
  )
    errors.push("This service has invalid settlement terms.");
  const projected = {
    ...s,
    allocations: s.allocations.map((a) => {
      const change = c.changes.find((ch) => ch.key === a.key);
      return change ? { ...a, resource: change.to } : a;
    }),
  };
  if (!queued) errors.push(...conditionalOutcomeIssues(s, projected, person, p.journeyId));
  if (
    (p.kind === "wifi" || p.kind === "lounge") &&
    resource(s, seat?.resource || null)?.includedServices?.includes(p.kind)
  )
    errors.push(
      `Included with your ${resource(s, seat!.resource)?.cabin || "booked cabin"}.`,
    );
  if (p.kind === "upgrade") {
    const destination = resource(s, p.resourceId);
    if (!queued &&
      rulesFor(s, person, p.journeyId).some(
        (rule) =>
          rule.strength === "must" &&
          rule.effect.kind === "seat_position" &&
          !rule.effect.positions.includes(
            destination?.seatPosition || "middle",
          ),
      )
    )
      errors.push("This seat does not match your saved seat requirements.");
    if (!queued &&
      rulesFor(s, person, p.journeyId).some(
        (rule) =>
          rule.strength === "must" && rule.effect.kind === "seating_together",
      )
    )
      errors.push(
        "This upgrade needs to keep your booking party together. Contact the airline to arrange the seats together.",
      );
    const ranks: Record<string, number> = {
      Economy: 0,
      "Premium Economy": 1,
      Business: 2,
      First: 3,
    };
    const fromCabin =
      resource(s, seat?.resource || null)?.cabin ||
      s.journeys?.find((j) => j.id === p.journeyId)?.cabin ||
      "Economy";
    if (
      (ranks[resource(s, p.resourceId)?.cabin || ""] ?? -1) <=
      (ranks[fromCabin] ?? 0)
    )
      errors.push(
        "Your booking already includes this cabin or a higher cabin.",
      );
    if (
      s.parties?.some(
        (party) =>
          party.journeyId === p.journeyId &&
          party.guardianPairs.some(
            (pair) => pair.adult === person || pair.child === person,
          ),
      )
    )
      errors.push(
        "This booking needs an upgrade for the child and guardian together. Contact the airline to arrange both seats.",
      );
  }
  if (p.kind === "neighbour_free" && !queued) {
    const own = resource(s, seat?.resource || null),
      neighbour = resource(s, p.physicalSeatId || null);
    if (
      !own?.seatMap ||
      !neighbour?.seatMap ||
      own.serviceHour !== neighbour.serviceHour ||
      own.seatMap.row !== neighbour.seatMap.row ||
      own.seatMap.block !== neighbour.seatMap.block ||
      Math.abs(own.seatMap.column - neighbour.seatMap.column) !== 1
    )
      errors.push("Choose a seat next to your current seat.");
  }
  if (
    p.kind === "meal_skip" &&
    (!s.allocations.some(
      (a) =>
        a.key === p.mealAllocationKey &&
        a.person === person &&
        a.resource === p.resourceId,
    ) ||
      s.usedEvents.includes(c.event!))
  )
    errors.push("This meal has already been declined.");
  if (p.kind === "baggage_release") {
    const a = s.allocations.find(a => a.key === p.baggageAllocationKey);
    const r = resource(s, a?.resource || null);
    const programme = s.baggageReturnProgrammes?.find(x => x.id === p.programmeId);
    if (!a || a.person !== person || a.resource !== p.resourceId ||
        r?.baggage?.role !== "included" || r.baggage.passenger !== person ||
        r.baggage.entitlementId !== p.entitlementId || r.baggage.checkedIn ||
        !programme || programme.journeyId !== p.journeyId ||
        programme.checkedThroughKey !== r.baggage.checkedThroughKey ||
        !programme.eligibleEntitlementIds.includes(p.entitlementId || "") ||
        programme.reward !== -p.credits || s.hour >= programme.deadline || s.usedEvents.includes(c.event!) ||
        s.contracts.some(other => other.contractId !== except && (active(other) || other.status === "SETTLED") && other.baggageReturns?.some(claim => claim.entitlementId === p.entitlementId)))
      errors.push("This unused baggage allowance is no longer available to return.");
    const remaining = projected.allocations.filter(a => a.person === person).reduce((n, a) => {
      const r = resource(s, a.resource);
      return n + (r?.journey === p.journeyId && r.kind === "baggage" && r.baggage?.role === "included" ? r.baggage?.pieces || 0 : 0);
    }, 0);
    for (const rule of rulesFor(s, person, p.journeyId)) {
      if (rule.effect.kind === "baggage_release" && remaining < rule.effect.minRemainingPieces)
        errors.push(`Keep at least ${rule.effect.minRemainingPieces} checked bags under your saved flexibility.`);
    }
  }
  for (const ch of [...c.changes, ...c.dependencies]) {
    const a = s.allocations.find((a) => a.key === ch.key);
    if (!a || a.resource !== ch.from || a.version !== ch.version)
      errors.push("Your booking changed. Review this service again.");
    if (ch.to) {
      const r = resource(s, ch.to);
      if (!r || (r.eligible.length && !r.eligible.includes(person)))
        errors.push("This service is unavailable for your booking.");
    }
  }
  const reservations = s.contracts.filter(
    (c) => active(c) && c.contractId !== except,
  );
  if (reservations.some((other) => candidatePlansConflict(s, c, other)))
    errors.push(
      "Another booking update is using this seat or service. Complete or cancel it first.",
    );
  for (const [id, units] of outstandingCapacityDemand(s, c)) {
    const r = resource(s, id);
    const reserved = reservations.reduce(
      (n, other) => n + (outstandingCapacityDemand(s, other).get(id) || 0),
      0,
    );
    if (
      !r ||
      r.background +
        s.allocations.filter((a) => a.resource === id).length +
        reserved +
        units >
        r.capacity - r.protected
    )
      errors.push("This service has sold out.");
  }
  errors.push(...capacityPoolErrors(s, c, except));
  if (c.issuance) {
    const budget = s.budgets.find((b) => b.id === c.budget);
    if (
      !budget ||
      budget.issued +
        reservations
          .filter((r) => r.budget === c.budget)
          .reduce((n, r) => n + r.issuance, 0) +
        c.issuance >
        budget.limit
    )
      errors.push("This reward programme is fully subscribed.");
  }
  return [...new Set(errors)];
}
export function serviceOffers(s: State, person: string): ServiceOffer[] {
  return (s.serviceProducts || [])
    .filter(
      (p) =>
        (!p.person || p.person === person) && seatFor(s, person, p.journeyId),
    )
    .filter((p) => {
      if (p.kind !== "neighbour_free") return true;
      const own = resource(
          s,
          seatFor(s, person, p.journeyId)?.resource || null,
        ),
        target = resource(s, p.physicalSeatId || null);
      return (
        !!own?.seatMap &&
        !!target?.seatMap &&
        own.serviceHour === target.serviceHour &&
        own.seatMap.row === target.seatMap.row &&
        own.seatMap.block === target.seatMap.block &&
        Math.abs(own.seatMap.column - target.seatMap.column) === 1
      );
    })
    .map((storedProduct) => {
      const product = effectiveServiceProduct(s, person, storedProduct);
      const seat = resource(
        s,
        seatFor(s, person, product.journeyId)?.resource || null,
      );
      const included =
        (product.kind === "wifi" || product.kind === "lounge") &&
        !!seat?.includedServices?.includes(product.kind);
      const prior = s.contracts
        .filter(
          (c) =>
            c.serviceOrder?.person === person &&
            c.serviceOrder.product.journeyId === product.journeyId &&
            c.serviceOrder.product.kind === product.kind &&
            (product.kind !== "meal_skip" || c.serviceOrder.product.id === product.id) &&
            (product.kind !== "baggage_release" || c.serviceOrder.product.entitlementId === product.entitlementId) &&
            (active(c) || c.status === "SETTLED"),
        )
        .at(-1);
      const view = { ...s, allocations: [...s.allocations] };
      ensureServiceSlot(view, person, product);
      const errors = serviceErrors(
        view,
        serviceCandidate(view, person, product),
      );
      return {
        product,
        included,
        quoteKey: serviceQuoteKey(s, person, product),
        available: !prior && !errors.length,
        reason: included
          ? `Included with ${seat?.cabin || "your cabin"}`
          : prior
            ? prior.status === "SETTLED"
              ? "Added to your booking"
              : "Already requested"
            : errors[0],
        contractId: prior?.contractId,
        status: prior?.status,
      };
    }).filter((offer, index, all) => !offer.product.deferred ||
      all.findIndex(o => o.product.kind === offer.product.kind && o.product.journeyId === offer.product.journeyId) === index);
}
export function cabinMealManifest(s: State) {
  const confirmed = {...s, allocations: confirmedAllocations(s)};
  return confirmed.allocations
    .filter(
      (a) =>
        a.resourceKind === "meal" || resource(s, a.resource)?.kind === "meal",
    )
    .map((a) => {
      const original = (s.serviceProducts || []).find(
        (p) => p.mealAllocationKey === a.key,
      );
      const journey =
        a.journeyId ||
        resource(s, a.resource)?.journey ||
        original?.journeyId ||
        "";
      const seat = resource(s, seatFor(confirmed, a.person, journey)?.resource || null);
      const flight = bookedJourney(confirmed, a.person, journey);
      return {
        key: a.key,
        person: a.person,
        journey,
        flight,
        flightKey: JSON.stringify([flight?.origin, flight?.destination, flight?.flightNumber, flight?.departureAt]),
        seat: seatNumber(seat?.label) || "Unassigned",
        meal:
          resource(s, a.resource)?.mealName ||
          resource(s, original?.resourceId || null)?.mealName ||
          "Main meal",
        declined: !a.resource,
      };
    });
}
