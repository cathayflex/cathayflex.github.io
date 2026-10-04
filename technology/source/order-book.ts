import {
  available,
  availableRequestCredits,
  held,
  requestAuthorizationStatus,
  validate,
} from "./engine.ts";
import {
  bookedJourneys,
  flexibilityRulesFor,
  intentPurpose,
  journeyFacts,
  requestProgress,
  ruleConditionMatches,
  ruleDescription,
  validateIntent,
} from "./intent.ts";
import { acceptedQuoteContextCurrent } from "./request-quote.ts";
import type { RequestQuote } from "./request-quote.ts";
import type { Contract, IntentRecord, State } from "./types.ts";

export type BookStatus =
  | "draft"
  | "indicative"
  | "open"
  | "reserved"
  | "executing"
  | "settled"
  | "fulfilled"
  | "expired"
  | "withdrawn"
  | "invalidated";

export type BookWallet = {
  person: string;
  balance: number;
  reserved: number;
  free: number;
  contractReserved: number;
  requestEarmarked: number;
};

type BookSource = {
  person: string;
  intentId: string;
  revision: number;
  text: string;
  scope: IntentRecord["scope"];
  rules: IntentRecord["rules"];
  descriptions: string[];
};

export type BookPermission = {
  id: string;
  kind: "permission";
  source: BookSource;
  status: "indicative" | "draft" | "withdrawn" | "invalidated";
  firm: false;
  authority: "none";
  reason: string;
  applicability: {
    journeyId: string;
    effectiveRuleIds: string[];
    unknownRuleIds: string[];
  }[];
};

export type BookRequest = {
  id: string;
  kind: "request";
  source: BookSource;
  status: Exclude<BookStatus, "indicative">;
  /** True only for a funded, current request available for a NEW arrangement.
   * The matcher must still validate an exact complete candidate and its supply. */
  firm: boolean;
  reason: string;
  authorizationMode: "fixed_quote" | "legacy" | "missing";
  authorizationStatus: ReturnType<typeof requestAuthorizationStatus>["status"];
  authorizedAt: number | null;
  termsRevision: number | null;
  expiresAt: number | null;
  quote: RequestQuote | null;
  contextCurrent: boolean | null;
  progress: ReturnType<typeof requestProgress>;
  funding: {
    debit: number | null;
    spent: number;
    committed: number;
    reserved: number;
    earmarked: number;
    availableForThisRequest: number;
    wallet: BookWallet;
  };
  contractIds: string[];
  currentContractIds: string[];
};

export type BookContract = {
  id: string;
  kind: "contract";
  contractId: string;
  candidateId: string;
  title: string;
  status:
    | "reserved"
    | "executing"
    | "settled"
    | "expired"
    | "withdrawn"
    | "invalidated";
  engineStatus: Contract["status"];
  reason: string;
  createdAt: number;
  expiresAt: number;
  deadline: number;
  /** Due is observational. Only an engine transition releases a recorded hold. */
  expiryDue: boolean;
  reservationRetained: boolean;
  participants: string[];
  accepted: string[];
  awaitingConsent: string[];
  allAccepted: boolean;
  pricingVersion: string;
  credits: Record<string, number>;
  reservedCredits: Record<string, number>;
  requestReferences: {
    person: string;
    intentId: string;
    revision: number;
    entryId: string;
  }[];
  authorizations: NonNullable<Contract["authorizations"]>;
  changes: Contract["changes"];
  dependencies: Contract["dependencies"];
  receipts: string[];
  ledgerEntryIds: string[];
  validationErrors: string[];
};

export type OrderBook = {
  version: 1;
  audit: { stateVersion: number; hour: number; stateSchema: State["schema"] };
  /** A diagnostic projection of supplied state, never a reservation or access boundary. */
  semantics: "derived_conditional_book";
  wallets: BookWallet[];
  permissions: BookPermission[];
  requests: BookRequest[];
  contracts: BookContract[];
};

const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const sorted = (values: string[]) => [...new Set(values)].sort(compare);
const active = (contract: Contract) =>
  ["QUEUED", "HELD", "ACCEPTED", "AWAITING_EVIDENCE", "RECONCILING"].includes(
    contract.status,
  );
const debit = (contract: Contract, person: string) =>
  Math.max(0, -(contract.credits[person] || 0));
const sourceId = (
  kind: "permission" | "request",
  person: string,
  intentId: string,
  revision: number,
) =>
  `${kind}/${encodeURIComponent(person)}/${encodeURIComponent(intentId)}/r${revision}`;
const source = (person: string, record: IntentRecord): BookSource => ({
  person,
  intentId: record.id,
  revision: record.revision,
  text: record.sourceText,
  scope: record.scope,
  rules: record.rules,
  descriptions: record.rules.map(ruleDescription),
});

function wallet(state: State, person: string): BookWallet {
  const reserved = held(state, person);
  const contractReserved = state.contracts
    .filter(active)
    .reduce((total, contract) => total + debit(contract, person), 0);
  return {
    person,
    balance: state.wallets[person],
    reserved,
    free: available(state, person),
    contractReserved,
    requestEarmarked: Math.max(0, reserved - contractReserved),
  };
}

function permission(
  state: State,
  person: string,
  record: IntentRecord,
): BookPermission {
  let status: BookPermission["status"] = "indicative";
  let reason =
    "Confirmed preferences and conditional permissions guide proposals. Every proposed change still needs its own transaction authority.";
  if (record.cancelled) {
    status = "withdrawn";
    reason = "This statement was withdrawn and supplies no current permission.";
  } else if (!record.confirmed || record.questions.length) {
    status = "draft";
    reason =
      "The statement still needs review and supplies no confirmed permission.";
  } else {
    try {
      validateIntent(state, person, record);
    } catch {
      status = "invalidated";
      reason =
        "The statement no longer validates against the supplied booking context. Review its interpretation.";
    }
  }
  const journeys = bookedJourneys(state, person).filter(
    (journey) =>
      record.scope.kind === "all" || record.scope.journeyId === journey,
  );
  const applicability = sorted(journeys).map((journeyId) => ({
    journeyId,
    effectiveRuleIds:
      status === "indicative"
        ? sorted(
            flexibilityRulesFor(state, person, journeyId)
              .filter((rule) => rule.recordId === record.id)
              .map((rule) => rule.id),
          )
        : [],
    unknownRuleIds: sorted(
      record.rules
        .filter(
          (rule) =>
            ruleConditionMatches(
              journeyFacts(state, person, journeyId),
              rule,
            ) === undefined,
        )
        .map((rule) => rule.id),
    ),
  }));
  return {
    id: sourceId("permission", person, record.id, record.revision),
    kind: "permission",
    source: source(person, record),
    status,
    firm: false,
    authority: "none",
    reason,
    applicability,
  };
}

function contractProjection(state: State, contract: Contract): BookContract {
  const reservationRetained = active(contract);
  const allAccepted = contract.participants.every((person) =>
    contract.accepted.includes(person),
  );
  // These are the existing engine's expiry conditions. Reporting a due release
  // does not apply that transition or reduce the engine's recorded wallet hold.
  const expiryDue =
    (contract.status === "QUEUED" && state.hour >= contract.serviceOrder!.product.confirmBy) ||
    ((contract.status === "HELD" || contract.status === "ACCEPTED") &&
      state.hour >= contract.expires &&
      !(contract.authorizations && allAccepted)) ||
    (contract.status === "HELD" &&
      Object.values(contract.authorizations || {}).some(
        (authorization) => authorization.validUntil <= state.hour,
      )) ||
    (contract.status === "AWAITING_EVIDENCE" &&
      state.hour >= (contract.serviceOrder?.product.confirmBy ?? contract.deadline));
  let validationErrors: string[] = [];
  if (reservationRetained) {
    // Match the engine's reconciliation view. Restore only changed allocations,
    // preserving current unchanged dependencies and leaving actual writes intact.
    const original = new Map(
      contract.changes.map((change) => [change.key, change]),
    );
    const view =
      contract.status === "RECONCILING"
        ? {
            ...state,
            allocations: state.allocations.map((allocation) => {
              const change = original.get(allocation.key);
              return change
                ? {
                    ...allocation,
                    resource: change.from,
                    version: change.version,
                  }
                : allocation;
            }),
          }
        : state;
    validationErrors = sorted(validate(view, contract, contract.contractId));
  }
  let status: BookContract["status"];
  let reason: string;
  switch (contract.status) {
    case "QUEUED":
      status = "reserved";
      reason = "Fixed-price request waiting for airline inventory. Credits are held and seats remain available for normal booking.";
      break;
    case "SETTLED":
      status = "settled";
      reason =
        "The engine recorded verified fulfilment and settlement. This arrangement holds no further credits.";
      break;
    case "EXPIRED":
      status = "expired";
      reason =
        "The engine expired this arrangement and released its reservations.";
      break;
    case "CANCELLED":
      status = "withdrawn";
      reason =
        "The arrangement was cancelled and its reservations were released.";
      break;
    case "FAILED":
      status = "invalidated";
      reason =
        "The arrangement failed without settlement. Its reservations were released.";
      break;
    case "RECONCILING":
      status = "executing";
      reason =
        "An adapter result needs reconciliation. Recorded consent, exact prices and all reservations remain in force until resolution.";
      break;
    case "AWAITING_EVIDENCE":
      status = "executing";
      reason =
        "Consent is recorded and the arrangement awaits delivery evidence. Reservations remain held.";
      break;
    case "ACCEPTED":
      status = "executing";
      reason =
        "All required consent is recorded. The arrangement awaits verified execution and retains its reservations.";
      break;
    default:
      status = validationErrors.length ? "invalidated" : "reserved";
      reason = validationErrors.length
        ? "This held arrangement no longer passes current validation. Its recorded reservations remain until the engine resolves it."
        : "The exact arrangement is reserved while the remaining participants review their changes.";
  }
  if (expiryDue)
    reason +=
      " Its expiry is due. The supplied state still records the hold until an engine transition releases it.";
  if (validationErrors.length && status === "executing")
    reason +=
      " Current validation blocks further delivery and requires resolution.";
  const references = [
    ...(contract.requestRefs || []),
    ...Object.entries(contract.authorizations || {}).map(
      ([person, authorization]) => ({
        person,
        intentId: authorization.intentId,
        revision: authorization.revision,
      }),
    ),
  ];
  const referenceMap = new Map(
    references.map((reference) => {
      const entryId = sourceId(
        "request",
        reference.person,
        reference.intentId,
        reference.revision,
      );
      return [entryId, { ...reference, entryId }];
    }),
  );
  const participants = sorted(contract.participants);
  return {
    id: `contract/${encodeURIComponent(contract.contractId)}`,
    kind: "contract",
    contractId: contract.contractId,
    candidateId: contract.id,
    title: contract.title,
    status,
    engineStatus: contract.status,
    reason,
    createdAt: contract.created,
    expiresAt: contract.expires,
    deadline: contract.deadline,
    expiryDue,
    reservationRetained,
    participants,
    accepted: sorted(contract.accepted),
    awaitingConsent: participants.filter(
      (person) => !contract.accepted.includes(person),
    ),
    allAccepted,
    pricingVersion: contract.pricingVersion,
    credits: Object.fromEntries(
      Object.entries(contract.credits).sort(([a], [b]) => compare(a, b)),
    ),
    reservedCredits: Object.fromEntries(
      participants.map((person) => [
        person,
        reservationRetained ? debit(contract, person) : 0,
      ]),
    ),
    requestReferences: [...referenceMap.values()].sort((a, b) =>
      compare(a.entryId, b.entryId),
    ),
    authorizations: Object.fromEntries(
      Object.entries(contract.authorizations || {}).sort(([a], [b]) =>
        compare(a, b),
      ),
    ),
    changes: [...contract.changes].sort((a, b) => compare(a.key, b.key)),
    dependencies: [...contract.dependencies].sort((a, b) =>
      compare(a.key, b.key),
    ),
    receipts: [...contract.receipts],
    ledgerEntryIds: sorted(
      state.ledger
        .filter((entry) => entry.contract === contract.contractId)
        .map((entry) => entry.id),
    ),
    validationErrors,
  };
}

function request(
  state: State,
  person: string,
  record: IntentRecord,
  funds: BookWallet,
  contracts: BookContract[],
): BookRequest {
  const authorization = record.authorization;
  const finance = requestAuthorizationStatus(state, person, record);
  const progress = requestProgress(state, person, record);
  const quote =
    authorization?.mode === "fixed_quote" ? authorization.quote || null : null;
  const related = contracts.filter((contract) =>
    contract.requestReferences.some(
      (reference) =>
        reference.person === person && reference.intentId === record.id,
    ),
  );
  const current = related.filter((contract) =>
    contract.requestReferences.some(
      (reference) =>
        reference.person === person &&
        reference.intentId === record.id &&
        reference.revision === record.revision,
    ),
  );
  const pending = current.filter((contract) => contract.reservationRetained);
  const executing = pending.some((contract) => contract.status === "executing");
  const contextCurrent =
    quote && !pending.length && progress.status !== "fulfilled"
      ? acceptedQuoteContextCurrent(state, person, record, quote)
      : null;
  const availableForThisRequest = availableRequestCredits(
    state,
    person,
    record.id,
  );
  const authorizationExact =
    !!authorization &&
    !!quote &&
    authorization.mode === "fixed_quote" &&
    authorization.allowPartial === false &&
    authorization.maxCredits === quote.debit &&
    authorization.termsRevision === record.revision &&
    quote.targetRevision === record.revision &&
    authorization.validUntil <= quote.validUntil;
  const funded =
    !!quote &&
    Number.isFinite(funds.balance) &&
    funds.free >= 0 &&
    availableForThisRequest >= quote.debit &&
    finance.remaining >= quote.debit;
  let status: BookRequest["status"];
  let reason: string;
  let firm = false;
  if (executing) {
    status = "executing";
    reason =
      "An accepted contract is executing this request. Its signed terms and reservation survive request expiry until delivery or reconciliation resolves it.";
  } else if (pending.length) {
    status = pending.some(
      (contract) => contract.status === "invalidated" || contract.expiryDue,
    )
      ? "invalidated"
      : "reserved";
    reason =
      status === "reserved"
        ? "The request's accepted quote is assigned to a held arrangement. It cannot authorize a second arrangement."
        : "A linked held arrangement needs resolution. Its recorded reservation remains and this request cannot authorize another arrangement.";
  } else if (record.cancelled) {
    status = "withdrawn";
    reason =
      "The request was withdrawn. It supplies no authority for a new arrangement.";
  } else if (!record.confirmed || record.questions.length) {
    status = "draft";
    reason =
      "Review and publication are incomplete. No transaction is authorized.";
  } else if (progress.status === "fulfilled") {
    status = current.some((contract) => contract.status === "settled")
      ? "settled"
      : "fulfilled";
    reason =
      status === "settled"
        ? "The requested outcome is fulfilled and a linked arrangement settled. The request cannot authorize another debit."
        : "The current booking already meets the request. No linked settlement is inferred and no new debit is authorized.";
  } else if (
    progress.status === "expired" ||
    (quote && quote.validUntil <= state.hour)
  ) {
    status = "expired";
    reason =
      "The request or quoted service has expired and cannot authorize a new arrangement.";
  } else if (!authorizationExact || finance.status !== "active") {
    status = "invalidated";
    reason =
      authorization?.mode !== "fixed_quote"
        ? "A reviewed fixed quote is required. Saved preferences and legacy credit limits do not authorize a new arrangement."
        : "The accepted quote does not bind this request revision and complete-delivery terms. Review a new quote.";
  } else if (!contextCurrent) {
    status = "invalidated";
    reason =
      "The request, booking, party or quoted products changed. Review a new fixed quote before reserving another arrangement.";
  } else if (!funded) {
    status = "invalidated";
    reason =
      "The exact debit is not fully backed by this request's earmark and available wallet balance. No new arrangement is authorized.";
  } else {
    status = "open";
    firm = true;
    reason =
      "The current fixed quote and exact debit are authorized for one complete arrangement. Eligible supply and every other participant's consent still need validation.";
  }
  return {
    id: sourceId("request", person, record.id, record.revision),
    kind: "request",
    source: source(person, record),
    status,
    firm,
    reason,
    authorizationMode: authorization
      ? authorization.mode === "fixed_quote"
        ? "fixed_quote"
        : "legacy"
      : "missing",
    authorizationStatus: finance.status,
    authorizedAt: authorization?.authorizedAt ?? null,
    termsRevision: authorization?.termsRevision ?? null,
    expiresAt: authorization
      ? Math.min(authorization.validUntil, quote?.validUntil ?? Infinity)
      : null,
    quote,
    contextCurrent,
    progress,
    funding: {
      debit: quote?.debit ?? null,
      spent: finance.spent,
      committed: finance.committed,
      reserved: finance.reserved,
      earmarked: Math.max(0, finance.reserved - finance.committed),
      availableForThisRequest,
      wallet: funds,
    },
    contractIds: related.map((contract) => contract.contractId),
    currentContractIds: current.map((contract) => contract.contractId),
  };
}

/** Pure diagnostic book over authoritative state. This never runs a match,
 * reprices an accepted quote, manufactures consent or processes expiry.
 * Pass a full authorised state for engine parity. It is not a privacy filter. */
export function projectOrderBook(state: State): OrderBook {
  const wallets = sorted(Object.keys(state.wallets)).map((person) =>
    wallet(state, person),
  );
  const walletMap = new Map(wallets.map((entry) => [entry.person, entry]));
  const contracts = state.contracts
    .map((contract) => contractProjection(state, contract))
    .sort((a, b) => compare(a.id, b.id));
  const permissions: BookPermission[] = [];
  const requests: BookRequest[] = [];
  for (const [person, records] of Object.entries(state.intents || {})) {
    for (const record of records) {
      if (intentPurpose(record) === "flexibility")
        permissions.push(permission(state, person, record));
      else
        requests.push(
          request(
            state,
            person,
            record,
            walletMap.get(person) || wallet(state, person),
            contracts,
          ),
        );
    }
  }
  // Detach all nested source, quote and contract snapshots from the input. A
  // consumer can inspect or format this projection without mutating the engine.
  return structuredClone({
    version: 1,
    audit: {
      stateVersion: state.version,
      hour: state.hour,
      stateSchema: state.schema,
    },
    semantics: "derived_conditional_book",
    wallets,
    permissions: permissions.sort((a, b) => compare(a.id, b.id)),
    requests: requests.sort((a, b) => compare(a.id, b.id)),
    contracts,
  });
}
