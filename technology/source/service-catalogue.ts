import { resourceLabel, seatNumber } from "./resource-label.ts";
import type { Resource, ServiceProduct, State } from "./types.ts";

/** Explicit synthetic inventory provisioning. Calling this never alters booked entitlements. */
export function installServiceCatalogue(s: State) {
  s.serviceProducts ||= [];
  s.capacityPools ||= [];
  if (!s.budgets.some((b) => b.id === "meal-choice"))
    s.budgets.push({
      id: "meal-choice",
      label: "Advance meal choices",
      issued: 0,
      limit: 6000,
      stressCost: 0.05,
    });
  if (!s.budgets.some(b => b.id === "baggage-release"))
    s.budgets.push({id: "baggage-release", label: "Advance baggage returns", issued: 0, limit: 6000, stressCost: 0.05});
  const add = (r: Resource) => {
    if (!s.resources.some((x) => x.id === r.id)) s.resources.push(r);
  };
  const product = (p: ServiceProduct) => {
    const index = s.serviceProducts!.findIndex(x => x.id === p.id);
    if (index < 0) s.serviceProducts!.push(p);
    else if (s.serviceProducts![index].revision < p.revision) s.serviceProducts![index] = p;
  };
  for (const journey of s.journeys || []) {
    const people = [
      ...new Set(
        s.allocations
          .filter(
            (a) =>
              a.journeyId === journey.id ||
              s.resources.some(
                (r) => r.id === a.resource && r.journey === journey.id,
              ),
          )
          .map((a) => a.person),
      ),
    ];
    const seats = s.resources.filter(
      (r) => r.journey === journey.id && r.kind === "seat" && !r.serviceOnly,
    );
    if (!seats.length) continue;
    const hour = seats[0].serviceHour;
    const base = {
      journey: journey.id,
      serviceHour: hour,
      deadline: hour - 1,
      capacity: 1,
      background: 0,
      protected: 0,
      q: 0,
      eligible: people,
      seatPosition: null,
      serviceCost: 0,
      opportunityCost: 0,
    } satisfies Omit<Resource, "id" | "kind" | "label" | "product">;
    const terms = {
      revision: 2,
      journeyId: journey.id,
      bookBy: hour - 1,
      confirmBy: hour,
      delivery: "immediate" as const,
    };
    for (const [kind, title, price, description, capacity] of [
      [
        "wifi",
        "Full-flight Wi-Fi",
        40,
        "Internet access for one device throughout this flight.",
        200,
      ],
      [
        "lounge",
        "Departure lounge access",
        240,
        `One lounge visit at ${journey.origin}, within three hours of departure.`,
        12,
      ],
    ] as const) {
      const id = `${journey.id}:${kind}`;
      const capacityUses: { poolId: string; units: number }[] = [];
      if (kind === "lounge")
        for (
          let block = Math.floor(hour) - 3;
          block < Math.ceil(hour);
          block++
        ) {
          const poolId = `lounge:${journey.origin}:${block}`;
          if (!s.capacityPools.some((p) => p.id === poolId))
            s.capacityPools.push({
              id: poolId,
              label: `${journey.origin} lounge admission window ${block}`,
              capacity: 12,
              background: 0,
              protected: 0,
            });
          capacityUses.push({ poolId, units: 1 });
        }
      add({
        ...base,
        id,
        label: title,
        kind: "service",
        product: kind,
        capacity,
        q: price,
        capacityUses,
      });
      product({
        ...terms,
        id,
        kind,
        resourceId: id,
        title,
        description,
        credits: price,
        terms:
          kind === "wifi"
            ? [
                "One device at a time",
                "Valid on this flight",
                "Access code issued on confirmation",
              ]
            : [
                "One named traveller",
                "Access within three hours of departure",
                "Pass issued on confirmation",
              ],
      });
    }
    for (const [label, column, position] of [
      ["12A", 0, "window"],
      ["12C", 1, "aisle"],
    ] as const) {
      const id = `${journey.id}:business:${label}`;
      add({
        ...base,
        id,
        label: `Business ${position} seat ${label}`,
        kind: "seat",
        product: "business",
        cabin: "Business",
        includedServices: ["wifi"],
        q: 1800,
        serviceOnly: true,
        seatPosition: position,
        seatMap: { row: 12, column, block: "business-left", exitRow: false },
      });
      product({
        ...terms,
        id,
        resourceId: id,
        kind: "upgrade",
        deferred: true,
        bookBy: hour - 26,
        confirmFrom: hour - 24,
        confirmBy: hour - 1,
        title: "Business upgrade",
        description: "Request a Business seat on this flight. We will confirm when upgrade inventory is released.",
        credits: 1800,
        terms: [
          "Credits held until the upgrade is confirmed",
          "Eligible requests filled in order of submission",
          "Your seat requirements are checked before confirmation",
          "Business cabin and onboard service",
          "Baggage allowance stays as booked",
          "Full-flight Wi-Fi included",
          "Credits already paid for included services reduce the final charge",
          "Lounge access sold separately",
        ],
      });
    }
    for (const person of people) {
      const key = `${person}:${journey.id}:main-meal`;
      const id = `${journey.id}:main-meal:${person}`;
      add({
        ...base,
        id,
        label: "Main meal",
        kind: "meal",
        mealName: "Main meal",
        product: "main-meal",
        eligible: [person],
        deadline: hour - 25,
      });
      if (!s.allocations.some((a) => a.key === key))
        s.allocations.push({
          key,
          person,
          resource: id,
          resourceKind: "meal",
          journeyId: journey.id,
          version: 0,
        });
      product({
        ...terms,
        id: `${id}:skip`,
        resourceId: id,
        mealAllocationKey: key,
        kind: "meal_skip",
        person,
        title: "Decline main meal",
        description: "Decline the main meal on this flight.",
        credits: -30,
        budget: "meal-choice",
        bookBy: hour - 25,
        confirmBy: hour - 24,
        terms: [
          "Applies to the main meal only",
          "Drinks remain included",
          "Meal choice appears on the cabin service list",
        ],
      });
    }
  }
  // Every occupied or blocked seat consumes the same physical capacity pool.
  for (const seat of s.resources.filter((r) => r.kind === "seat")) {
    const poolId = `physical:${seat.id}`;
    if (!s.capacityPools.some((p) => p.id === poolId))
      s.capacityPools.push({
        id: poolId,
        label: `${resourceLabel(seat.label)} physical seat`,
        capacity: seat.capacity,
        background: seat.background,
        protected: seat.protected,
      });
    seat.capacityUses ||= [];
    if (!seat.capacityUses.some((p) => p.poolId === poolId))
      seat.capacityUses.push({ poolId, units: 1 });
    if (!seat.seatMap || seat.serviceOnly) continue;
    const id = `${seat.id}:empty`;
    add({
      ...seat,
      id,
      label: `Seat ${seatNumber(seat.label)} kept free`,
      kind: "service",
      product: "neighbour_free",
      source: undefined,
      capacity: 1,
      background: 0,
      protected: 0,
      q: 180,
      seatPosition: null,
    });
    product({
      id,
      revision: 2,
      journeyId: seat.journey,
      kind: "neighbour_free",
      deferred: true,
      resourceId: id,
      physicalSeatId: seat.id,
      title: "Neighbour-free seat",
      description: "Request an empty seat beside you. Availability is confirmed at departure.",
      credits: 180,
      bookBy: seat.serviceHour - 1,
      confirmFrom: seat.serviceHour,
      confirmBy: seat.serviceHour + 1,
      delivery: "departure",
      terms: [
        "180 credits held until departure",
        "Eligible requests filled in order of submission",
        "Charged when the seat is kept free at departure",
        "Credits released if the service is unavailable",
      ],
    });
  }
  for (const programme of s.baggageReturnProgrammes || []) {
    for (const a of s.allocations) {
      const r = s.resources.find(r => r.id === a.resource);
      if (!r?.baggage || r.baggage.role !== "included" || r.journey !== programme.journeyId ||
          !programme.eligibleEntitlementIds.includes(r.baggage.entitlementId || "")) continue;
      product({
        id: `return:${r.baggage.entitlementId}`, revision: programme.revision + 1,
        kind: "baggage_release", journeyId: r.journey, person: a.person,
        resourceId: r.id, baggageAllocationKey: a.key, entitlementId: r.baggage.entitlementId,
        programmeId: programme.id, budget: "baggage-release",
        title: "Return unused baggage allowance",
        description: `Return ${r.baggage.pieces} included checked bag${r.baggage.pieces === 1 ? "" : "s"} on this journey.`,
        credits: -programme.reward, bookBy: programme.deadline, confirmBy: programme.deadline,
        delivery: "immediate", terms: [
          `${r.baggage.pieces} included bag${r.baggage.pieces === 1 ? "" : "s"} removed from this booking`,
          `${programme.reward} credits earned when the airline confirms the return`,
          "Your cabin baggage allowance stays the same",
          "Extra checked baggage can be purchased separately",
        ],
      });
    }
  }
  s.resourceModelVersion = 4;
  return s;
}
