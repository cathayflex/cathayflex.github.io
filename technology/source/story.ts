import type { Command, State, IntentRecord } from "./types.ts";
import { quoteRequest } from "./request-quote.ts";

export const storyEpoch = "2026-10-05T08:00:00+08:00";
export type StoryStep = {
  id: string;
  hour: number;
  title: string;
  narration: string;
  actor: string;
  utterance?: string;
  intent?: Record<string, unknown>;
  expectedOutcome: string;
  action:
    | "intent_save"
    | "preferences"
    | "seat_preferences"
    | "quote"
    | "accept"
    | "execute"
    | "advance"
    | "travel_need";
  candidateId?: string;
  person?: string;
};

// Narrative metadata belongs to the director workspace. It never impersonates
// a live traveller or claims that a scripted interpretation came from a model.
export const storySteps: StoryStep[] = [
  {
    id: "preferences",
    hour: 0,
    actor: "A",
    title: "Different trips, different priorities",
    narration:
      "Lin is preparing for a solo trip to Taipei. In one message, Lin explains what can change and what matters on other journeys.",
    utterance:
      "When I travel alone, any seat is fine on flights up to six hours. On longer flights, I need an aisle. When I’m with my family, I’d like us to sit together.",
    intent: {
      description:
        "The three reviewed clauses remain one source statement with explicit duration and booking-party conditions.",
    },
    expectedOutcome:
      "Lin reviews and confirms three contextual seat preferences. Nothing about the booking changes.",
    action: "intent_save",
    person: "A",
  },
  {
    id: "alex-request",
    hour: 0,
    actor: "B",
    title: "An aisle would help Alex",
    narration:
      "Alex has a window seat on the same Taipei flight. Every unallocated aisle seat is gone, so a normal seat-map search cannot help.",
    utterance:
      "Could I have an aisle seat on my Taipei flight? I’m happy to keep the same flight and cabin.",
    intent: {
      journeyId: "story-taipei",
      seat: "aisle",
      keepFlight: true,
      keepCabin: true,
    },
    expectedOutcome:
      "Alex accepts the platform’s fixed zero-credit quote and an expiry before changes close. A matching arrangement can proceed without another approval from Alex.",
    action: "intent_save",
    person: "B",
  },
  {
    id: "seat-offer",
    hour: 0,
    actor: "platform",
    title: "One useful offer",
    narration:
      "The platform checks the same flight, seat eligibility, confirmed preferences and airline reward budget. It reserves both seats for a complete exchange.",
    expectedOutcome:
      "Lin can move from aisle 22C to window 22A for 400 Flex credits. Alex’s confirmed request authorizes the aisle assignment. Lin still decides whether to move.",
    action: "quote",
    candidateId: "exchange-A-seat-taipei>tpe-22A|B-seat-taipei>tpe-22C",
  },
  {
    id: "lin-seat-consent",
    hour: 0,
    actor: "A",
    title: "Lin chooses to move",
    narration:
      "The offer says exactly which seat changes, which flight stays and when the reward becomes available.",
    utterance: "The window is fine for this short flight. I accept.",
    expectedOutcome:
      "Lin’s consent completes the arrangement. The airline confirms both seats, then the platform issues 400 credits once.",
    action: "accept",
    candidateId: "exchange-A-seat-taipei>tpe-22A|B-seat-taipei>tpe-22C",
    person: "A",
  },
  {
    id: "alex-seat-consent",
    hour: 0,
    actor: "B",
    title: "Alex’s request already covers the change",
    narration:
      "The platform checks the aisle assignment, zero-credit cost and validity period against the terms Alex already confirmed. Alex does not need to return for another approval.",
    expectedOutcome:
      "Alex now holds aisle 22C. The platform records the existing request authorization alongside Lin’s voluntary acceptance.",
    action: "accept",
    candidateId: "exchange-A-seat-taipei>tpe-22A|B-seat-taipei>tpe-22C",
    person: "B",
  },
  {
    id: "seat-settlement",
    hour: 0,
    actor: "platform",
    title: "A small change, value kept",
    narration:
      "Both seat assignments are verified. Only then does the airline-funded reward reach Lin’s wallet.",
    expectedOutcome:
      "Lin has 400 available Flex credits. Alex has the aisle. The credit ledger records one verified issuance.",
    action: "execute",
    candidateId: "exchange-A-seat-taipei>tpe-22A|B-seat-taipei>tpe-22C",
  },
  {
    id: "two-weeks-later",
    hour: 336,
    actor: "A",
    title: "Two weeks later",
    narration:
      "Lin and Mia are planning their Tokyo trip with seven-year-old Jamie. Mia and Jamie already have adjacent seats. Lin is two rows behind them.",
    expectedOutcome:
      "The same wallet and confirmed preferences continue into a different journey and travel party.",
    action: "advance",
  },
  {
    id: "family-request",
    hour: 336,
    actor: "A",
    title: "One message for the family trip",
    narration:
      "The booking identifies the family party. Lin asks to join them and adds a practical need for the same journey.",
    utterance:
      "For Tokyo, can the three of us sit together? Mia and Jamie are in 32A and 32B. We also need one extra checked bag.",
    intent: {
      journeyId: "story-tokyo",
      partyId: "lin-family",
      sitTogether: true,
      extraBags: 1,
    },
    expectedOutcome:
      "The platform quotes 160 credits for seating and 200 for baggage. Lin accepts the fixed 360-credit price and authorizes both changes together. The credits are reserved while Daniel reviews his move.",
    action: "intent_save",
    person: "A",
  },
  {
    id: "family-offer",
    hour: 336,
    actor: "platform",
    title: "The missing seat in their row",
    narration:
      "Daniel holds 32C. He travels alone and has already said that another regular aisle is acceptable. The platform proposes a complete exchange with Lin’s 34C.",
    expectedOutcome:
      "Both seats and the baggage entitlement are reserved as one complete arrangement. Lin would spend exactly 360 credits, Daniel would receive 160, and Mia and Jamie would keep their seats.",
    action: "quote",
    candidateId: "bundle-exchange-A-seat-tokyo>hnd-32C|C-seat-tokyo>hnd-34C~redeem-A-tokyo-extra-bag",
  },
  {
    id: "lin-family-consent",
    hour: 336,
    actor: "A",
    title: "The family seats fit Lin’s authorization",
    narration:
      "The platform verifies the full row, exact 23 kg baggage product, fixed 360-credit price and unchanged guardian arrangement against Lin’s published request.",
    expectedOutcome:
      "Lin’s accepted quote covers all requested changes together. The 360 credits remain reserved. No seat or baggage change is completed before the whole arrangement is accepted.",
    action: "accept",
    candidateId: "bundle-exchange-A-seat-tokyo>hnd-32C|C-seat-tokyo>hnd-34C~redeem-A-tokyo-extra-bag",
    person: "A",
  },
  {
    id: "daniel-consent",
    hour: 336,
    actor: "C",
    title: "Daniel keeps what matters to him",
    narration:
      "Daniel reviews 34C, another regular aisle seat on the same flight. No one changes his booking automatically.",
    utterance:
      "34C is still an aisle. I accept the move and the 160 Flex credits.",
    expectedOutcome:
      "Daniel’s acceptance completes the exchange within Lin’s published terms. The seats and baggage are confirmed together and the exact quoted credits settle automatically.",
    action: "accept",
    candidateId: "bundle-exchange-A-seat-tokyo>hnd-32C|C-seat-tokyo>hnd-34C~redeem-A-tokyo-extra-bag",
    person: "C",
  },
  {
    id: "family-settlement",
    hour: 336,
    actor: "platform",
    title: "Three seats together",
    narration:
      "The airline adapter confirms both changed seats and the baggage entitlement. The platform then settles the agreed credit amounts once.",
    expectedOutcome:
      "Mia, Jamie and Lin hold 32A, 32B and 32C. Daniel has 34C and 160 credits. Lin has 40 credits remaining after the complete seat and baggage arrangement.",
    action: "execute",
    candidateId: "bundle-exchange-A-seat-tokyo>hnd-32C|C-seat-tokyo>hnd-34C~redeem-A-tokyo-extra-bag",
  },
  {
    id: "baggage-offer",
    hour: 336,
    actor: "platform",
    title: "Room for the extra bag",
    narration:
      "The booking includes the extra bag confirmed with the family seats. This timeline moment shows the delivered entitlement and its receipt.",
    expectedOutcome:
      "One additional 23 kg checked bag has been confirmed for Lin as the 200-credit line item in the accepted fixed quote.",
    action: "quote",
    candidateId: "bundle-exchange-A-seat-tokyo>hnd-32C|C-seat-tokyo>hnd-34C~redeem-A-tokyo-extra-bag",
  },
  {
    id: "baggage-consent",
    hour: 336,
    actor: "A",
    title: "The bag fits the same request",
    narration:
      "The audit shows that Lin’s published request covered the 200-credit baggage entitlement. No additional approval was requested.",
    expectedOutcome:
      "The baggage receipt and the single redemption entry confirm delivery. This story moment does not change the booking or charge again.",
    action: "accept",
    candidateId: "bundle-exchange-A-seat-tokyo>hnd-32C|C-seat-tokyo>hnd-34C~redeem-A-tokyo-extra-bag",
    person: "A",
  },
  {
    id: "baggage-settlement",
    hour: 336,
    actor: "platform",
    title: "Flexibility that travels with you",
    narration:
      "The family now has its seats together and the extra bag. A small voluntary change on an earlier solo trip helped meet different needs later.",
    expectedOutcome:
      "Lin retains 40 Flex credits. Daniel retains 160. The ledger reconciles 400 issued and 200 redeemed across two settled contracts.",
    action: "execute",
    candidateId: "bundle-exchange-A-seat-tokyo>hnd-32C|C-seat-tokyo>hnd-34C~redeem-A-tokyo-extra-bag",
  },
];

export function nextStoryCommand(
  s: State,
): Omit<Command, "expectedVersion" | "requestId"> | null {
  if (s.scenarioId !== "lin-family") return null;
  const step = storySteps[s.storyCursor || 0];
  if (!step) return null;
  const noChange = { action: "advance" as const, hour: s.hour };
  if (step.action === "advance")
    return { action: "advance", hour: Math.max(s.hour, step.hour) };
  if (step.action === "intent_save") {
    const intent = storyIntent(step.id);
    if (s.intents?.[step.person!]?.some((record) => record.id === intent.id && record.confirmed)) return noChange;
    if (intent.purpose !== "request") return {action: "intent_save", person: step.person, intent};
    const result = quoteRequest(s, step.person!, intent);
    if (result.status !== "quoted") throw new Error(result.reason);
    return {action: "intent_save", person: step.person, intent,
      requestAuthorization: {quote: result.quote, validUntil: result.quote.validUntil, allowPartial: false}};
  }

  const contract = s.contracts
    .filter(
      (c) =>
        c.id === step.candidateId &&
        !["CANCELLED", "EXPIRED", "FAILED"].includes(c.status),
    )
    .at(-1);
  if (step.action === "quote")
    return contract
      ? noChange
      : { action: "quote", candidateId: step.candidateId };
  if (!contract)
    throw new Error(
      "The story offer was cancelled or expired. Create a fresh story workspace to replay this sequence.",
    );
  if (contract.status === "SETTLED") return noChange;
  if (step.action === "accept")
    return contract.accepted.includes(step.person!)
      ? noChange
      : {
          action: "accept",
          contractId: contract.contractId,
          person: step.person,
        };
  if (contract.status === "RECONCILING")
    return { action: "reconcile", contractId: contract.contractId };
  return { action: "execute", contractId: contract.contractId };
}

export function storyDate(hour: number) {
  return new Date(
    new Date(storyEpoch).getTime() + hour * 3600000,
  ).toISOString();
}

export function storyIntent(stepId: string): IntentRecord {
  const step = storySteps.find((s) => s.id === stepId)!;
  const base = {
    purpose:
      stepId === "preferences"
        ? ("flexibility" as const)
        : ("request" as const),
    id: `story-${stepId}`,
    sourceText: step.utterance!,
    scope: { kind: "all" as const },
    questions: [],
    confirmed: false,
    revision: 0,
  };
  if (stepId === "preferences")
    return {
      ...base,
      rules: [
        {
          id: "solo-window",
          evidence: "any seat is fine on flights up to six hours",
          when: [
            { field: "partySize", op: "eq", value: 1 },
            { field: "durationMinutes", op: "lte", value: 360 },
          ],
          effect: {
            kind: "seat_position",
            positions: ["aisle", "window", "middle"],
          },
          strength: "flexible",
        },
        {
          id: "longer-aisle",
          evidence: "On longer flights, I need an aisle",
          when: [
            { field: "partySize", op: "eq", value: 1 },
            { field: "durationMinutes", op: "gt", value: 360 },
          ],
          effect: { kind: "seat_position", positions: ["aisle"] },
          strength: "must",
        },
        {
          id: "companions",
          evidence: "When I’m with my family, I’d like us to sit together",
          when: [{ field: "partyId", op: "eq", value: "lin-family" }],
          effect: { kind: "seating_together" },
          strength: "prefer",
        },
      ],
    };
  if (stepId === "alex-request")
    return {
      ...base,
      scope: { kind: "journey", journeyId: "story-taipei" },
      rules: [
        {
          id: "aisle",
          evidence: "Could I have an aisle seat on my Taipei flight?",
          when: [],
          effect: { kind: "seat_position", positions: ["aisle"] },
          strength: "must",
        },
      ],
    };
  if (stepId === "family-request")
    return {
      ...base,
      scope: { kind: "journey", journeyId: "story-tokyo" },
      rules: [
        {
          id: "together",
          evidence: "can the three of us sit together?",
          when: [],
          effect: { kind: "seating_together", partyId: "lin-family" },
          strength: "must",
        },
        {
          id: "bag",
          evidence: "We also need one extra checked bag",
          when: [],
          effect: { kind: "baggage", extraPieces: 1 },
          strength: "must",
        },

      ],
    };
  throw new Error("Unknown authored story statement");
}

for (const step of storySteps)
  if (step.action === "intent_save") step.intent = { ...storyIntent(step.id) };
