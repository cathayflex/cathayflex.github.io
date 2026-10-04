import type { State, Resource, Allocation } from "./types.ts";
import { quoteRequest } from "./request-quote.ts";
export function initialState(): State {
  const resources: Resource[] = [];
  const allocations: Allocation[] = [];
  const add = (
    id: string,
    label: string,
    kind: Resource["kind"],
    journey: string,
    hour: number,
    capacity = 1,
    background = 0,
    product = "regular",
    q = 0,
    eligible: string[] = [],
  ) =>
    resources.push({
      id,
      label,
      kind,
      journey,
      serviceHour: hour,
      deadline: hour - 1,
      capacity,
      background,
      protected: 0,
      product,
      q,
      eligible,
      serviceCost: id === "nov-extra-bag" ? 8 : id === "dec-preferred" ? 1 : 0,
      opportunityCost:
        id === "nov-extra-bag" ? 12 : id === "dec-preferred" ? 9 : 0,
      seatPosition:
        kind === "seat"
          ? ["oct-34C", "nov-32C", "dec-preferred", "ring-B"].includes(id)
            ? "aisle"
            : ["ring-A", "ring-C"].includes(id)
              ? "window"
              : "middle"
          : null,
    });
  add(
    "flight-early",
    "CX 548 HKG to HND at 09:00",
    "flight",
    "oct-tokyo",
    2,
    100,
    99,
    "economy",
  );
  add(
    "flight-late",
    "CX 550 HKG to HND at 11:00",
    "flight",
    "oct-tokyo",
    4,
    100,
    95,
    "economy",
  );
  add("oct-32B", "Middle seat 32B", "seat", "oct-tokyo", 2);
  add("oct-34B", "Middle seat 34B", "seat", "oct-tokyo", 4, 1, 0, "regular", 40);
  add("oct-34C", "Aisle seat 34C", "seat", "oct-tokyo", 4, 1, 0, "regular", 140);
  add("nov-32B", "Middle seat 32B", "seat", "nov-seoul", 600, 1, 0, "regular", 40);
  add("nov-32C", "Aisle seat 32C", "seat", "nov-seoul", 600, 1, 0, "regular", 160);
  add(
    "nov-extra-bag",
    "One additional 23 kg checked bag for Seoul",
    "baggage",
    "nov-seoul",
    600,
    1,
    0,
    "extra-bag",
    200,
    ["A"],
  );
  add("dec-regular", "Regular middle seat 42B", "seat", "dec-taipei", 1200);
  add(
    "dec-preferred",
    "Preferred aisle seat 20C",
    "seat",
    "dec-taipei",
    1200,
    1,
    0,
    "preferred",
    100,
    ["B"],
  );
  add(
    "c-future-regular",
    "Seat 42B on Hong Kong to Taipei",
    "seat",
    "dec-taipei-c",
    1350,
  );
  add(
    "c-future-preferred",
    "Preferred aisle seat 20C for Taipei",
    "seat",
    "dec-taipei-c",
    1350,
    1,
    0,
    "preferred",
    100,
    ["C"],
  );
  resources.at(-1)!.seatPosition = "aisle";
  resources.at(-1)!.serviceCost = 1;
  resources.at(-1)!.opportunityCost = 9;
  add(
    "d-future-regular",
    "Seat 32B on Hong Kong to Seoul",
    "seat",
    "dec-seoul-d",
    1416,
  );
  add(
    "d-future-aisle",
    "Advance aisle reservation 32C for Seoul",
    "seat",
    "dec-seoul-d",
    1416,
    1,
    0,
    "regular",
    30,
    ["D"],
  );
  resources.at(-1)!.seatPosition = "aisle";
  resources.at(-1)!.serviceCost = 1;
  resources.at(-1)!.opportunityCost = 2;
  for (const [id, label] of [
    ["ring-A", "Window seat 40A"],
    ["ring-B", "Aisle seat 40C"],
    ["ring-C", "Forward window seat 30A"],
  ])
    add(id, label, "seat", "nov-osaka", 650, 1, 0, "regular", 100);
  add(
    "meal-d",
    "Standard meal production plan for Osaka",
    "meal",
    "nov-osaka",
    650,
    30,
    19,
    "standard",
    0,
    ["D"],
  );
  resources[resources.length - 1].deadline = 602;
  const own = (key: string, person: string, resource: string | null) =>
    allocations.push({ key, person, resource, version: 0 });
  own("A-flight-oct", "A", "flight-early");
  own("A-seat-oct", "A", "oct-32B");
  own("C-seat-oct", "C", "oct-34C");
  own("A-seat-nov", "A", "nov-32B");
  own("B-seat-nov", "B", "nov-32C");
  own("A-bag-nov", "A", null);
  own("B-seat-dec", "B", "dec-regular");
  own("D-ring", "D", "ring-A");
  own("E-ring", "E", "ring-B");
  own("F-ring", "F", "ring-C");
  own("D-meal", "D", "meal-d");
  own("C-seat-future", "C", "c-future-regular");
  own("D-seat-future", "D", "d-future-regular");
  const people = [
    {
      id: "A",
      name: "Lin Yue",
      initials: "LY",
      note: "Can depart two hours later if an aisle seat is confirmed",
    },
    {
      id: "B",
      name: "Chen Yu",
      initials: "CY",
      note: "Open to exchanging an aisle seat for compensation",
    },
    {
      id: "C",
      name: "Ho Ning",
      initials: "HN",
      note: "Open to a different seat with a useful reward",
    },
    {
      id: "D",
      name: "Zoe Lam",
      initials: "ZL",
      note: "Prefers an aisle seat and can opt out of a standard meal",
    },
    {
      id: "E",
      name: "Owen Ng",
      initials: "ON",
      note: "Prefers a forward window seat",
    },
    {
      id: "F",
      name: "Eva Yip",
      initials: "EY",
      note: "Prefers a window seat near family further back",
    },
  ];
  return {
    schema: 3,
    version: 0,
    hour: 0,
    people,
    resources,
    allocations,
    wallets: Object.fromEntries(people.map((p) => [p.id, 0])),
    operationalOffers: [
      {id: "meal-release", title: "Skip the main meal before the catering cutoff", description: "Airline catering programme",
        changes: [{allocationKey: "D-meal", to: null}], credits: {D: 30}, issuance: 30, redemption: 0,
        budget: "catering", evidence: "catering_plan", value: 15, cost: 3, risk: 1},

    ],
    budgets: [
      {
        id: "recovery",
        label: "Flight capacity release",
        limit: 1000,
        issued: 0,
        stressCost: 0.1,
      },
      {
        id: "catering",
        label: "Avoidable catering cost",
        limit: 100,
        issued: 0,
        stressCost: 0.1,
      },

    ],
    preferences: Object.fromEntries(
      people.map((p) => [
        p.id,
        {
          maxDelayHours: p.id === "A" ? 2 : 0,
          requireAisle: p.id === "A",
          allowMealSkip: p.id === "D",
          allowGateCheck: p.id === "A",
          confirmed: true,
        },
      ]),
    ),
    seatWishes: {
      "A-seat-oct": ["oct-34C"],
      "C-seat-oct": ["oct-34B"],
      "A-seat-nov": ["nov-32C"],
      "B-seat-nov": ["nov-32B"],
      "B-seat-dec": [],
      "D-ring": ["ring-B"],
      "E-ring": ["ring-C"],
      "F-ring": ["ring-A"],
    },
    economics: {
      marginalValue: 300,
      executionCost: 40,
      riskReserve: 30,
      stressCost: 0.1,
    },
    contracts: [],
    ledger: [],
    usedEvents: [],
    requests: {},
    audit: [
      {
        hour: 0,
        message:
          "Workspace created. All travellers start with zero Flex. Airline budgets remain unissued.",
      },
    ],
  };
}

export function storyState(): State {
  const s = initialState();
  s.scenarioId = "lin-family";
  s.storyCursor = 0;
  s.operationalOffers = [];
  s.resources = [];
  s.allocations = [];
  s.seatWishes = {};
  s.people = [
    {
      id: "A",
      name: "Lin Yue",
      initials: "LY",
      age: 36,
      note: "Flexible when travelling alone. Wants the family together on their next trip.",
    },
    {
      id: "B",
      name: "Alex Wong",
      initials: "AW",
      age: 42,
      note: "Would like an aisle on the Taipei flight. Can accept the complete seat offer.",
    },
    {
      id: "C",
      name: "Daniel Ho",
      initials: "DH",
      age: 29,
      note: "Travelling alone to Tokyo. Happy to move between regular aisle seats for Flex credits.",
    },
    {
      id: "D",
      name: "Zoe Lam",
      initials: "ZL",
      age: 28,
      note: "Prefers an aisle on the Osaka journey.",
    },
    {
      id: "E",
      name: "Owen Ng",
      initials: "ON",
      age: 31,
      note: "Would like the forward window seat on the Osaka journey.",
    },
    {
      id: "F",
      name: "Eva Yip",
      initials: "EY",
      age: 33,
      note: "Prefers the window seat further back on the Osaka journey.",
    },
    {
      id: "G",
      name: "Mia Lin",
      initials: "ML",
      age: 35,
      note: "Travels with Lin and Jamie. Already seated beside Jamie.",
    },
    {
      id: "H",
      name: "Jamie Lin",
      initials: "JL",
      age: 7,
      note: "Travels with both parents. Guardian adjacency is protected.",
    },
  ];
  s.wallets = Object.fromEntries(s.people.map((p) => [p.id, 0]));
  s.preferences = Object.fromEntries(
    s.people.map((p) => [
      p.id,
      {
        maxDelayHours: 0,
        requireAisle: false,
        allowMealSkip: false,
        allowGateCheck: false,
        confirmed: p.id !== "A",
      },
    ]),
  );
  s.journeys = [
    {
      id: "story-taipei",
      origin: "Hong Kong",
      destination: "Taipei",
      flightNumber: "CX 470",
      departureAt: "2026-10-07T10:00:00+08:00",
      durationMinutes: 120,
      cabin: "Economy",
    },
    {
      id: "story-tokyo",
      origin: "Hong Kong",
      destination: "Tokyo",
      flightNumber: "CX 520",
      departureAt: "2026-11-02T10:00:00+08:00",
      durationMinutes: 250,
      cabin: "Economy",
    },
    {
      id: "story-london",
      origin: "Hong Kong",
      destination: "London",
      flightNumber: "CX 251",
      departureAt: "2026-11-23T23:00:00+08:00",
      durationMinutes: 870,
      cabin: "Economy",
    },
    {
      id: "story-osaka",
      origin: "Hong Kong",
      destination: "Osaka",
      flightNumber: "CX 566",
      departureAt: "2026-11-06T12:00:00+08:00",
      durationMinutes: 220,
      cabin: "Economy",
    },
    {
      id: "story-daniel-future",
      origin: "Hong Kong",
      destination: "Taipei",
      flightNumber: "CX 470",
      departureAt: "2026-11-30T10:00:00+08:00",
      durationMinutes: 120,
      cabin: "Economy",
    },
  ];
  s.parties = [
    {
      id: "lin-family",
      journeyId: "story-tokyo",
      memberIds: ["A", "G", "H"],
      guardianPairs: [{ child: "H", adult: "G" }],
      bookingReference: "FLEX26",
    },
  ];
  s.needs = {};
  s.intents = {};
  const statement = (
    person: string,
    text: string,
    positions: ("aisle" | "window" | "middle")[],
    strength: "must" | "prefer" | "flexible" = "flexible",
  ) => {
    s.intents![person] = [
      {
        id: `fixture-${person}`,
        purpose: "flexibility",
        sourceText: text,
        scope: { kind: "all" },
        rules: [
          {
            id: "seat",
            evidence: text,
            when: [],
            effect: { kind: "seat_position", positions },
            strength,
          },
        ],
        questions: [],
        confirmed: true,
        revision: 1,
      },
    ];
  };
  statement("C", "I am open to another aisle seat on my Tokyo journey.", [
    "aisle",
  ]);
  s.intents.C[0].scope = { kind: "journey", journeyId: "story-tokyo" };
  s.intents.C.push({
    id: "fixture-C-future",
    purpose: "request",
    sourceText: "On my next Taipei flight, I would prefer an aisle seat.",
    scope: { kind: "journey", journeyId: "story-daniel-future" },
    rules: [
      {
        id: "future-aisle",
        evidence: "I would prefer an aisle seat",
        when: [],
        effect: { kind: "seat_position", positions: ["aisle"] },
        strength: "prefer",
      },
    ],
    questions: [],
    confirmed: true,
    revision: 1,
  });
  statement(
    "B",
    "Could I have an aisle seat on my Taipei flight?",
    ["aisle"],
    "must",
  );
  Object.assign(s.intents.B[0], {
    id: "story-alex-request",
    purpose: "request",
    scope: { kind: "journey", journeyId: "story-taipei" },
  });
  statement("D", "I prefer an aisle seat.", ["aisle"], "prefer");
  Object.assign(s.intents.D[0], {
    purpose: "request",
    scope: { kind: "journey", journeyId: "story-osaka" },
  });
  statement("E", "I prefer a window seat.", ["window"], "prefer");
  Object.assign(s.intents.E[0], {
    purpose: "request",
    scope: { kind: "journey", journeyId: "story-osaka" },
  });
  statement("F", "I am open to another window seat.", ["window"]);
  s.campaigns = [
    {
      id: "taipei-seat-recovery",
      journeyId: "story-taipei",
      budget: "seat-recovery",
      releasePositions: ["aisle"],
      receivePositions: ["window", "middle"],
      reward: 400,
      value: 75,
      cost: 10,
      risk: 5,
    },
  ];
  const seat = (
    id: string,
    label: string,
    journey: string,
    hour: number,
    row: number,
    column: number,
    position: Resource["seatPosition"],
    q = 0,
  ) => {
    s.resources.push({
      id,
      label,
      kind: "seat",
      journey,
      serviceHour: hour,
      deadline: hour - 2,
      capacity: 1,
      background: 0,
      protected: 0,
      product: "regular",
      q,
      eligible: [],
      seatPosition: position,
      serviceCost: 0,
      opportunityCost: 0,
      seatMap: { row, column, block: "left", exitRow: false },
      source: "allocated_seat",
    });
  };
  const own = (key: string, person: string, resource: string | null) => {
    const journeyId = s.resources.find((r) => r.id === resource)?.journey;
    const partyId =
      s.parties?.find(
        (p) => p.journeyId === journeyId && p.memberIds.includes(person),
      )?.id ?? null;
    s.allocations.push({
      key,
      person,
      resource,
      version: 0,
      journeyId,
      partyId,
    });
  };
  seat("tpe-22C", "Aisle seat 22C", "story-taipei", 50, 22, 2, "aisle");
  seat("tpe-22A", "Window seat 22A", "story-taipei", 50, 22, 0, "window");
  own("A-seat-taipei", "A", "tpe-22C");
  own("B-seat-taipei", "B", "tpe-22A");
  s.seatWishes["A-seat-taipei"] = ["tpe-22A"];
  s.seatWishes["B-seat-taipei"] = [];
  seat("hnd-34C", "Aisle seat 34C", "story-tokyo", 674, 34, 2, "aisle", 40);
  seat("hnd-32A", "Window seat 32A", "story-tokyo", 674, 32, 0, "window", 40);
  seat("hnd-32B", "Middle seat 32B", "story-tokyo", 674, 32, 1, "middle", 40);
  seat("hnd-32C", "Aisle seat 32C", "story-tokyo", 674, 32, 2, "aisle", 200);
  own("A-seat-tokyo", "A", "hnd-34C");
  own("G-seat-tokyo", "G", "hnd-32A");
  own("H-seat-tokyo", "H", "hnd-32B");
  own("C-seat-tokyo", "C", "hnd-32C");
  s.seatWishes["A-seat-tokyo"] = [];
  s.seatWishes["C-seat-tokyo"] = ["hnd-34C"];
  seat("lhr-41C", "Aisle seat 41C", "story-london", 1191, 41, 2, "aisle");
  seat("lhr-41A", "Window seat 41A", "story-london", 1191, 41, 0, "window");
  own("A-seat-london", "A", "lhr-41C");
  s.resources.push({
    id: "tokyo-extra-bag",
    label: "One additional 23 kg checked bag for Tokyo",
    kind: "baggage",
    journey: "story-tokyo",
    serviceHour: 674,
    deadline: 650,
    capacity: 2,
    background: 0,
    protected: 1,
    product: "prepaid-extra-bag",
    q: 200,
    eligible: ["A"],
    seatPosition: null,
    serviceCost: 8,
    opportunityCost: 12,
    source: "airline_inventory",
    baggage: { pieces: 1, maxKg: 23, maxCm: 158, passenger: "A" },
  });
  Object.assign(s.resources.at(-1)!, {
    capacityUses: [{poolId: "hnd-extra-pieces", units: 1}, {poolId: "hnd-extra-kg", units: 23}],
    baggage: {pieces: 1, maxKg: 23, maxCm: 158, passenger: "A", role: "extra", checkedThroughKey: "HKG-HND-20261102"},
  });
  s.capacityPools = [
    {id: "hnd-extra-pieces", label: "Tokyo additional bags (pieces)", capacity: 1, background: 0, protected: 0},
    {id: "hnd-extra-kg", label: "Tokyo additional baggage load (kg)", capacity: 23, background: 0, protected: 0},
  ];
  for (const person of ["A", "C"]) {
    const id = `hnd-included-${person}`;
    s.resources.push({id, label: "One included checked bag up to 23 kg", kind: "baggage", journey: "story-tokyo",
      serviceHour: 674, deadline: 650, capacity: 1, background: 0, protected: 0, product: "fare-included-bag",
      q: 0, eligible: [person], seatPosition: null, serviceCost: 0, opportunityCost: 0,
      baggage: {pieces: 1, maxKg: 23, maxCm: 158, passenger: person, role: "included", entitlementId: id,
        checkedThroughKey: "HKG-HND-20261102", checkedIn: false}});
    own(`${person}-included-bag-tokyo`, person, id);
    Object.assign(s.allocations.at(-1)!, {baggageRole: "included", resourceKind: "baggage"});
  }
  s.baggageReturnProgrammes = [{id: "tokyo-bag-return", revision: 1, journeyId: "story-tokyo",
    checkedThroughKey: "HKG-HND-20261102", deadline: 650, reward: 80,
    eligibleEntitlementIds: ["hnd-included-C"], value: 15, cost: 8, risk: 2}];
  own("A-bag-tokyo", "A", null);
  Object.assign(s.allocations.at(-1)!, {
    journeyId: "story-tokyo",
    resourceKind: "baggage",
  });
  // A separate market remains available for demonstrating a genuine three-party cycle.
  seat(
    "story-ring-A",
    "Window seat 40A",
    "story-osaka",
    772,
    40,
    0,
    "window",
    100,
  );
  seat("story-ring-B", "Aisle seat 40C", "story-osaka", 772, 40, 2, "aisle", 100);
  seat(
    "story-ring-C",
    "Forward window seat 30A",
    "story-osaka",
    772,
    30,
    0,
    "window",
    100,
  );
  for (const [person, current, wanted] of [
    ["D", "story-ring-A", "story-ring-B"],
    ["E", "story-ring-B", "story-ring-C"],
    ["F", "story-ring-C", "story-ring-A"],
  ]) {
    own(`${person}-story-ring`, person, current);
    s.seatWishes[`${person}-story-ring`] = [wanted];
  }
  seat(
    "daniel-regular",
    "Middle seat 42B",
    "story-daniel-future",
    1346,
    42,
    1,
    "middle",
  );
  seat(
    "daniel-preferred",
    "Preferred aisle seat 20C",
    "story-daniel-future",
    1346,
    20,
    2,
    "aisle",
    120,
  );
  Object.assign(s.resources.at(-1)!, {
    source: "airline_inventory",
    product: "preferred",
    eligible: ["C"],
    serviceCost: 2,
    opportunityCost: 10,
  });
  own("C-seat-story-future", "C", "daniel-regular");
  s.budgets = [
    {
      id: "seat-recovery",
      label: "Voluntary seat recovery",
      limit: 1200,
      issued: 0,
      stressCost: 0.1,
    },
  ];
  s.audit = [
    {
      hour: 0,
      message:
        "Lin’s story workspace opened on 5 October 2026. Every wallet starts at zero. Flights, prices and operating values are synthetic.",
    },
  ];
  // Alex has explicitly published a no-charge request. The separate Osaka
  // statements remain reviewed interpretations awaiting publication terms.
  // Existing persisted workspaces are never upgraded into this authorization.
  for (const person of ["B"])
    for (const record of s.intents?.[person] || [])
      if (record.purpose === "request") {
        const result = quoteRequest(s, person, {...record, revision: record.revision - 1});
        if (result.status !== "quoted") throw new Error(result.reason);
        record.authorization = {
          mode: "fixed_quote", quote: result.quote, maxCredits: result.quote.debit,
          validUntil: result.quote.validUntil, allowPartial: false,
          authorizedAt: s.hour, termsRevision: record.revision,
        };
      }
  return s;
}
