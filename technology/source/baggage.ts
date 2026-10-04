import type {
  BaggageReturnProgramme,
  Allocation,
  Candidate,
  Resource,
  State,
} from "./types.ts";

export const isExtraBaggage = (r: Resource | undefined): boolean =>
  r?.kind === "baggage" && r.baggage?.role !== "included";
export function isExtraBagSlot(s: State, a: Allocation): boolean {
  const r = s.resources.find((r) => r.id === a.resource);
  return (
    a.baggageRole !== "included" &&
    r?.baggage?.role !== "included" &&
    (a.resourceKind === "baggage" || r?.kind === "baggage")
  );
}
export function programmeTerms(p: BaggageReturnProgramme): string {
  return JSON.stringify([
    p.id,
    p.revision,
    p.journeyId,
    p.checkedThroughKey,
    p.deadline,
    p.reward,
    [...p.eligibleEntitlementIds].sort(),
    p.value,
    p.cost,
    p.risk,
  ]);
}
const priorReturn = (s: State, entitlementId: string) =>
  s.contracts.some(
    (c) =>
      c.status === "SETTLED" &&
      c.baggageReturns?.some((r) => r.entitlementId === entitlementId),
  );

/** Alternatives to a specific airline-issued bag purchase. Each retires an original personal right. */
export function* baggageReturnCandidates(
  s: State,
  purchase: Candidate,
  visit: () => boolean = () => true,
): Generator<Candidate> {
  if (purchase.changes.length !== 1) return;
  const receive = purchase.changes[0];
  const product = s.resources.find((r) => r.id === receive.to);
  const buyer = s.allocations.find((a) => a.key === receive.key);
  if (
    !product ||
    !buyer ||
    receive.from ||
    !isExtraBaggage(product) ||
    product.baggage?.pieces !== 1
  )
    return;
  for (const programme of s.baggageReturnProgrammes || []) {
    if (programme.journeyId !== product.journey || programme.deadline <= s.hour)
      continue;
    for (const donor of s.allocations) {
      if (!visit()) return;
      const source = s.resources.find((r) => r.id === donor.resource);
      const bag = source?.baggage;
      if (
        !source ||
        !bag?.entitlementId ||
        donor.person === buyer.person ||
        bag.role !== "included" ||
        !programme.eligibleEntitlementIds.includes(bag.entitlementId) ||
        priorReturn(s, bag.entitlementId)
      )
        continue;
      const claim = {
        programmeId: programme.id,
        programmeTerms: programmeTerms(programme),
        entitlementId: bag.entitlementId,
        donorKey: donor.key,
        recipientKey: receive.key,
        recipientProduct: product.id,
        reward: programme.reward,
      };
      const related = s.allocations.filter(
        (a) =>
          a.person === donor.person &&
          a.key !== donor.key &&
          s.resources.find((r) => r.id === a.resource)?.baggage
            ?.checkedThroughKey === programme.checkedThroughKey,
      );
      const candidate: Candidate = {
        ...purchase,
        id: `${purchase.id}:return:${bag.entitlementId}:${programme.id}`,
        title: "Return an unused checked bag allowance",
        description:
          "Another traveller needs an extra checked bag. Review your remaining allowance and the fixed reward.",
        participants: [...new Set([...purchase.participants, donor.person])],
        changes: [
          ...purchase.changes,
          {
            key: donor.key,
            from: donor.resource,
            to: null,
            version: donor.version,
          },
        ],
        dependencies: [
          ...purchase.dependencies,
          ...related.map((a) => ({
            key: a.key,
            from: a.resource,
            to: a.resource,
            version: a.version,
          })),
        ],
        credits: { ...purchase.credits, [donor.person]: programme.reward },
        redemption: purchase.redemption - programme.reward,
        // The donor reward is funded by the baggage charge. It creates no credit issuance.
        value: purchase.value + programme.value,
        cost: purchase.cost + programme.cost,
        risk: purchase.risk + programme.risk,
        deadline: Math.min(
          purchase.deadline,
          programme.deadline,
          source.deadline,
        ),
        baggageReturns: [claim],
        conditions: [
          ...purchase.conditions,
          "Your included allowance is reduced only when the airline confirms the complete exchange.",
        ],
      };
      if (!baggageReturnErrors(s, candidate).length) yield candidate;
    }
  }
}

export function baggageReturnErrors(s: State, c: Candidate): string[] {
  const errors: string[] = [];
  const claims = c.baggageReturns || [];
  const sourceIds = claims.map((r) => r.entitlementId);
  if (
    new Set(sourceIds).size !== sourceIds.length ||
    new Set(claims.map((r) => r.recipientKey)).size !== claims.length
  )
    errors.push(
      "Each returned allowance must fund a different additional bag.",
    );
  for (const ch of c.changes) {
    const source = s.resources.find((r) => r.id === ch.from);
    if (
      source?.baggage?.role === "included" &&
      ch.from !== ch.to &&
      !claims.some((r) => r.donorKey === ch.key)
    )
      errors.push(
        "Returning an included allowance requires an eligible airline programme.",
      );
  }
  for (const claim of claims) {
    const p = s.baggageReturnProgrammes?.find(
      (p) => p.id === claim.programmeId,
    );
    const sourceChange = c.changes.find((ch) => ch.key === claim.donorKey);
    const receive = c.changes.find((ch) => ch.key === claim.recipientKey);
    const donor = s.allocations.find((a) => a.key === claim.donorKey);
    const buyer = s.allocations.find((a) => a.key === claim.recipientKey);
    const source = s.resources.find((r) => r.id === sourceChange?.from);
    const product = s.resources.find((r) => r.id === claim.recipientProduct);
    if (
      !p ||
      programmeTerms(p) !== claim.programmeTerms ||
      p.deadline <= s.hour
    ) {
      errors.push("This baggage return offer has changed or closed.");
      continue;
    }
    if (!source || !donor || !buyer || !product || !sourceChange || !receive) {
      errors.push("The baggage entitlement is unavailable.");
      continue;
    }
    const bag = source.baggage;
    if (
      bag?.role !== "included" ||
      bag.entitlementId !== claim.entitlementId ||
      bag.passenger !== donor.person ||
      bag.checkedIn ||
      bag.pieces !== 1 ||
      !p.eligibleEntitlementIds.includes(claim.entitlementId) ||
      priorReturn(s, claim.entitlementId) ||
      sourceChange.to !== null
    )
      errors.push(
        "Only an unused original included allowance can earn this reward once.",
      );
    if (
      source.journey !== p.journeyId ||
      product.journey !== p.journeyId ||
      bag?.checkedThroughKey !== p.checkedThroughKey ||
      product.baggage?.checkedThroughKey !== p.checkedThroughKey
    )
      errors.push(
        "Both baggage allowances must cover the same checked-through journey.",
      );
    if (donor.person === buyer.person)
      errors.push("A return must supply another traveller’s request.");
    if (
      !isExtraBaggage(product) ||
      product.source !== "airline_inventory" ||
      product.baggage?.passenger !== buyer.person ||
      product.baggage.pieces !== 1 ||
      receive.from !== null ||
      receive.to !== product.id ||
      product.baggage.maxKg !== bag?.maxKg ||
      product.baggage.maxCm !== bag?.maxCm
    )
      errors.push(
        "The recipient needs a new matching personal baggage product.",
      );
    if (!product.capacityUses?.length || source.capacityUses?.length)
      errors.push(
        "The airline must approve incremental baggage capacity independently of the returned allowance.",
      );
    if (
      !Number.isSafeInteger(p.reward) ||
      p.reward <= 0 ||
      p.reward > product.q ||
      claim.reward !== p.reward ||
      !Number.isFinite(p.value - p.cost - p.risk) ||
      p.value < p.cost + p.risk
    )
      errors.push(
        "The return reward requires approved funding and incremental value.",
      );
    // A beneficiary must have live published demand. Fixed-quote coverage is checked by the contract engine.
    if (!c.requestRefs?.some((r) => r.person === buyer.person))
      errors.push("A baggage return needs an active extra-baggage request.");
  }
  return [...new Set(errors)];
}
