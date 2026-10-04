import type { RequestQuote } from "./request-quote-schema.ts";
export type Person = {
  id: string;
  name: string;
  initials: string;
  note: string;
  age?: number;
};
export type SeatChoice = "any" | "aisle" | "window";
export type IntentCondition =
  | {
      field: "journeyId" | "origin" | "destination" | "cabin" | "partyId";
      op: "eq" | "ne";
      value: string;
    }
  | {
      field: "durationMinutes" | "partySize";
      op: "eq" | "lt" | "lte" | "gt" | "gte";
      value: number;
    };
/** A bounded Boolean tree. Missing facts stay unknown, including under negation. */
export type PredicateTree<T> =
  | { kind: "atom"; condition: T }
  | { kind: "and" | "or"; terms: PredicateTree<T>[] }
  | { kind: "not"; term: PredicateTree<T> };
export type IntentPredicate = PredicateTree<IntentCondition>;
export type IntentEffect =
  | { kind: "seat_position"; positions: ("aisle" | "window" | "middle")[] }
  | { kind: "seating_together"; partyId?: string }
  | {
      kind: "departure_window";
      earliest?: string;
      latest?: string;
      maxDelayMinutes?: number;
    }
  | { kind: "baggage"; extraPieces: number; maxKgPerPiece?: number }
  | { kind: "baggage_release"; minRemainingPieces: number }
  | { kind: "gate_check"; allowed: boolean }
  | { kind: "meal"; receive: boolean }
  | { kind: "credit_budget"; maxCredits: number };
export type OutcomeCondition =
  | Exclude<IntentEffect, { kind: "credit_budget" }>
  | { kind: "flight_unchanged" };
export type OutcomePredicate = PredicateTree<OutcomeCondition>;
export type IntentRule = {
  id: string;
  evidence: string;
  when: IntentCondition[];
  condition?: IntentPredicate;
  /** A conditional permission, checked against the complete proposed allocation. */
  onlyIf?: OutcomePredicate;
  sourceSpan?: { start: number; end: number };
  effect: IntentEffect;
  strength: "must" | "prefer" | "flexible";
};
export type IntentPurpose = "flexibility" | "request";
export type LegacyRequestAuthorizationTerms = {
  maxCredits: number;
  validUntil: number;
  allowPartial: boolean;
};
export type FixedRequestAuthorizationTerms = {
  quote: RequestQuote;
  validUntil: number;
  allowPartial: false;
};
// Legacy terms remain readable for persisted workspaces. New publications must
// carry a validated fixed quote and cannot inherit a legacy spending authority.
export type RequestAuthorizationTerms =
  | FixedRequestAuthorizationTerms
  | LegacyRequestAuthorizationTerms;
export type RequestAuthorization = LegacyRequestAuthorizationTerms & {
  mode?: "fixed_quote";
  quote?: RequestQuote;
  authorizedAt: number;
  termsRevision: number;
};
export type IntentRecord = {
  purpose?: IntentPurpose;
  cancelled?: boolean;
  id: string;
  sourceText: string;
  scope: { kind: "all" } | { kind: "journey"; journeyId: string };
  rules: IntentRule[];
  questions: string[];
  confirmed: boolean;
  revision: number;
  authorization?: RequestAuthorization;
};
export type Journey = {
  id: string;
  origin: string;
  destination: string;
  flightNumber: string;
  departureAt: string;
  durationMinutes: number;
  cabin: string;
};
export type BookingParty = {
  id: string;
  journeyId: string;
  memberIds: string[];
  guardianPairs: { child: string; adult: string }[];
  bookingReference: string;
};
export type TravelNeed = {
  journeyId: string;
  sitTogether: boolean;
  extraBags: number;
  maxCredits: number;
  confirmed: boolean;
};
export type Resource = {
  id: string;
  label: string;
  kind: "flight" | "seat" | "baggage" | "meal" | "handover" | "service";
  cabin?: string;
  includedServices?: ("wifi" | "lounge")[];
  serviceOnly?: boolean;
  mealName?: string;
  journey: string;
  serviceHour: number;
  /** Operating flight identity, independent of the logical journey. */
  flightNumber?: string;
  deadline: number;
  capacity: number;
  background: number;
  protected: number;
  product: string;
  q: number;
  eligible: string[];
  seatPosition: "aisle" | "middle" | "window" | null;
  serviceCost: number;
  opportunityCost: number;
  seatMap?: { row: number; column: number; block: string; exitRow: boolean };
  source?: "airline_inventory" | "allocated_seat";
  capacityUses?: { poolId: string; units: number }[];
  baggage?: {
    pieces: number;
    maxKg: number;
    maxCm: number;
    passenger: string;
    role?: "included" | "extra";
    entitlementId?: string;
    checkedThroughKey?: string;
    checkedIn?: boolean;
  };
};
export type Allocation = {
  key: string;
  person: string;
  resource: string | null;
  version: number;
  journeyId?: string;
  resourceKind?: Resource["kind"];
  baggageRole?: "included" | "extra";
  partyId?: string | null;
};
export type Change = {
  key: string;
  from: string | null;
  to: string | null;
  version: number;
};
export type Preference = {
  maxDelayHours: number;
  requireAisle: boolean;
  allowMealSkip: boolean;
  allowGateCheck: boolean;
  confirmed: boolean;
  contextualSeats?: {
    soloShort: SeatChoice;
    soloLong: SeatChoice;
    familyTogether: boolean;
  };
};
export type TravelServiceKind = "upgrade" | "neighbour_free" | "lounge" | "wifi" | "meal_skip" | "baggage_release";
export type ServiceProduct = {
  id: string;
  revision: number;
  kind: TravelServiceKind;
  journeyId: string;
  title: string;
  description: string;
  credits: number;
  bookBy: number;
  confirmBy: number;
  confirmFrom?: number;
  deferred?: boolean;
  delivery: "immediate" | "departure";
  resourceId: string;
  physicalSeatId?: string;
  mealAllocationKey?: string;
  baggageAllocationKey?: string;
  entitlementId?: string;
  programmeId?: string;
  person?: string;
  budget?: string;
  terms: string[];
};
export type ServiceOrder = {
  product: ServiceProduct;
  person: string;
  quotedAt: number;
  phase?: "queue" | "allocated";
};
export type ServiceOffer = {
  product: ServiceProduct;
  quoteKey: string;
  available: boolean;
  included?: boolean;
  reason?: string;
  contractId?: string;
  status?: Status;
};
export type Candidate = {
  serviceOrder?: ServiceOrder;
  baggageReturns?: BaggageReturn[];
  manualPerson?: string;
  requestRefs?: { person: string; intentId: string; revision: number }[];
  id: string;
  title: string;
  description: string;
  category: "earn" | "exchange" | "redeem";
  participants: string[];
  changes: Change[];
  dependencies: Change[];
  pricingVersion: string;
  credits: Record<string, number>;
  issuance: number;
  redemption: number;
  budget?: string;
  event?: string;
  evidence?: "baggage_handover" | "catering_plan" | "service_delivery";
  gain: number;
  value: number;
  cost: number;
  risk: number;
  deadline: number;
  prerequisites: string[];
  conditions: string[];
  experimental?: boolean;
  availableFrom?: number;
  partyId?: string;
  requiredEvents?: string[];
};
export type Status =
  | "QUEUED"
  | "HELD"
  | "ACCEPTED"
  | "AWAITING_EVIDENCE"
  | "RECONCILING"
  | "SETTLED"
  | "CANCELLED"
  | "EXPIRED"
  | "FAILED";
export type Contract = Candidate & {
  readiness?: {
    canAccept: boolean;
    highImpact: boolean;
    waitingForOthers: boolean;
    mode: "ready" | "coordination" | "authorized" | "accepted" | "closed";
  };
  legacyConsent?: Record<
    string,
    {
      preferences: Preference;
      seatWishes: Record<string, string[]>;
      need?: TravelNeed;
    }
  >;
  contractId: string;
  status: Status;
  accepted: string[];
  created: number;
  expires: number;
  receipts: string[];
  log: string[];
  consentSummary?: { accepted: number; total: number };
  authorizations?: Record<
    string,
    {
      intentId: string;
      revision: number;
      termsRevision: number;
      authorizedAt: number;
      validUntil: number;
      maxCredits: number;
      mode?: "fixed_quote";
      quote?: RequestQuote;
      allowPartial: boolean;
      debit: number;
    }
  >;
};
export type LedgerEntry = {
  id: string;
  contract: string;
  hour: number;
  title: string;
  credits: Record<string, number>;
  issuance: number;
  redemption: number;
};
export type Budget = {
  id: string;
  label: string;
  limit: number;
  issued: number;
  stressCost: number;
};
export type AirlineCampaign = {
  id: string;
  journeyId: string;
  budget: string;
  releasePositions: ("aisle" | "window" | "middle")[];
  receivePositions: ("aisle" | "window" | "middle")[];
  reward: number;
  value: number;
  cost: number;
  risk: number;
};
export type OperationalOffer = {
  id: string;
  title: string;
  description: string;
  changes: { allocationKey: string; to: string | null }[];
  dependencies?: string[];
  credits: Record<string, number>;
  issuance: number;
  redemption: number;
  budget?: string;
  evidence?: Candidate["evidence"];
  requiredEvents?: string[];
  value: number;
  cost: number;
  risk: number;
};
export type CapacityPool = {
  id: string;
  label: string;
  capacity: number;
  background: number;
  protected: number;
};
export type BaggageReturnProgramme = {
  id: string;
  revision: number;
  journeyId: string;
  checkedThroughKey: string;
  deadline: number;
  reward: number;
  eligibleEntitlementIds: string[];
  /** Carrier-assessed incremental benefit and delivery costs, in valuation units. */
  value: number;
  cost: number;
  risk: number;
};
export type BaggageReturn = {
  programmeId: string;
  programmeTerms: string;
  entitlementId: string;
  donorKey: string;
  recipientKey: string;
  recipientProduct: string;
  reward: number;
};
export type SaveAvailability =
  | { allowed: true }
  | {
      allowed: false;
      code: "RESERVED_OFFER_CONFLICT";
      message: string;
      contractIds: string[];
    };
export type AgentResult = {
  provider: string;
  model: string;
  summary: string;
  preferences: Preference;
  need?: TravelNeed;
  intent?: IntentRecord;
  recommendations: string[];
  questions: string[];
  saveAvailability?: SaveAvailability;
  trace: { step: string; detail: string }[];
};
export type State = {
  resourceModelVersion?: number;
  serviceReleases?: { journeyId: string; kind: "upgrade" | "neighbour_free"; hour: number }[];
  serviceProducts?: ServiceProduct[];
  schema: 3;
  version: number;
  hour: number;
  people: Person[];
  resources: Resource[];
  allocations: Allocation[];
  wallets: Record<string, number>;
  budgets: Budget[];
  preferences: Record<string, Preference>;
  seatWishes: Record<string, string[]>;
  economics: {
    marginalValue: number;
    executionCost: number;
    riskReserve: number;
    stressCost: number;
  };
  contracts: Contract[];
  ledger: LedgerEntry[];
  usedEvents: string[];
  audit: { hour: number; message: string; category?: "operation" | "simulation" }[];
  requests: Record<string, string>;
  agent?: AgentResult;
  scenarioId?: "network" | "lin-family";
  storyCursor?: number;
  journeys?: Journey[];
  parties?: BookingParty[];
  needs?: Record<string, TravelNeed>;
  intents?: Record<string, IntentRecord[]>;
  campaigns?: AirlineCampaign[];
  operationalOffers?: OperationalOffer[];
  capacityPools?: CapacityPool[];
  baggageReturnProgrammes?: BaggageReturnProgramme[];
};
export type Command = {
  /** Set by the authenticated API boundary, never by a client payload. */
  actorId?: string;
  action:
    | "service_purchase"
    | "service_catalogue"
    | "service_release"
    | "quote"
    | "accept"
    | "execute"
    | "reconcile"
    | "evidence"
    | "cancel"
    | "advance"
    | "reset"
    | "preferences"
    | "seat_preferences"
    | "policy"
    | "inventory"
    | "budget"
    | "travel_need"
    | "intent_save"
    | "intent_remove"
    | "story_advance";
  serviceProductId?: string;
  serviceKind?: "upgrade" | "neighbour_free";
  journeyId?: string;
  serviceQuoteKey?: string;
  candidateId?: string;
  manualPerson?: string;
  contractId?: string;
  person?: string;
  fault?: "none" | "before_write" | "after_write" | "reject";
  hour?: number;
  preferences?: Preference;
  need?: TravelNeed;
  intent?: IntentRecord;
  requestAuthorization?: RequestAuthorizationTerms;
  intentId?: string;
  allocationKey?: string;
  wishes?: string[];
  economics?: State["economics"];
  budgetId?: string;
  limit?: number;
  resourceId?: string;
  capacity?: number;
  protected?: number;
  requestId: string;
  expectedVersion: number;
};
