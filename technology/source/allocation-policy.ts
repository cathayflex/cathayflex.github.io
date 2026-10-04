import {
  bookedJourneys,
  intentPurpose,
  journeyFacts,
  requestGoalSatisfied,
  requestProgress,
  ruleConditionMatches,
  rulesFor,
} from "./intent.ts";
import type { Candidate, IntentRule, State } from "./types.ts";

export type AllocationEvaluation = {
  readonly score: readonly number[];
  /** Informational saved request identities, including equivalent requests with different IDs. */
  readonly fulfilledRequestIds: readonly string[];
  /** Canonical owner, journey and complete goal sets used by the primary objective. */
  readonly fulfilledEffectiveRequestIds: readonly string[];
  /** Canonical outcome predicates that become true or false on this snapshot. */
  readonly improvedPreferenceGoals: readonly string[];
  readonly lostPreferenceGoals: readonly string[];
  /** Informational owner identities with an improvement and no lost standing goal. */
  readonly improvedPreferenceOwners: readonly string[];
};

export type AllocationPolicy = {
  readonly policyId: string;
  readonly objectiveNames: readonly string[];
  readonly stressNetIndex: number;
  evaluate(candidate: Candidate): AllocationEvaluation;
};

type Goals = {
  id: string;
  person: string;
  journey: string;
  rules: IntentRule[];
  before: boolean[];
};

function immutableEvaluation(
  score: number[],
  outcomes: Partial<Omit<AllocationEvaluation, "score">> = {},
): AllocationEvaluation {
  return Object.freeze({
    score: Object.freeze(score),
    fulfilledRequestIds: Object.freeze(outcomes.fulfilledRequestIds || []),
    fulfilledEffectiveRequestIds: Object.freeze(outcomes.fulfilledEffectiveRequestIds || []),
    improvedPreferenceOwners: Object.freeze(outcomes.improvedPreferenceOwners || []),
    improvedPreferenceGoals: Object.freeze(outcomes.improvedPreferenceGoals || []),
    lostPreferenceGoals: Object.freeze(outcomes.lostPreferenceGoals || []),
  });
}

/** Compile one scoring policy for an immutable market snapshot. Feasibility and funding remain separate checks. */
export function createAllocationPolicy(state: State): AllocationPolicy {
  const baseline = structuredClone(state);
  const modern = baseline.intents !== undefined;
  const allocations = new Map(baseline.allocations.map((allocation) => [allocation.key, allocation]));
  const budgetRates = new Map(baseline.budgets.map((budget) => [budget.id, budget.stressCost]));
  const requests: (Goals & { effectiveId: string })[] = [];
  const preferences: Goals[] = [];
  const baselineTruth = new Map<string, boolean>();
  // Conditions have already selected the applicable rules for this snapshot.
  // IDs, evidence, strength and syntactic ordering cannot multiply the same
  // allocation predicate. Inferred and explicitly named booking parties agree.
  const goalKey = (person: string, journey: string, rule: IntentRule) => {
    const effect = rule.effect;
    let predicate: unknown[];
    switch (effect.kind) {
      case "seat_position":
        predicate = [effect.kind, [...new Set(effect.positions)].sort()];
        break;
      case "seating_together":
        predicate = [effect.kind, effect.partyId || baseline.parties?.find((party) =>
          party.journeyId === journey && party.memberIds.includes(person))?.id || null];
        break;
      case "baggage":
        predicate = [effect.kind, effect.extraPieces, effect.maxKgPerPiece || 0];
        break;
      case "departure_window":
        predicate = [effect.kind, effect.earliest ? Date.parse(effect.earliest) : null,
          effect.latest ? Date.parse(effect.latest) : null, effect.maxDelayMinutes ?? null];
        break;
      case "baggage_release": predicate = [effect.kind, effect.minRemainingPieces]; break;
      case "meal": predicate = [effect.kind, effect.receive]; break;
      case "gate_check": predicate = [effect.kind, effect.allowed]; break;
      case "credit_budget": predicate = [effect.kind, effect.maxCredits]; break;
    }
    return JSON.stringify([person, journey, predicate]);
  };
  const satisfiedBefore = (person: string, journey: string, rule: IntentRule) => {
    const key = goalKey(person, journey, rule);
    if (!baselineTruth.has(key))
      baselineTruth.set(key, requestGoalSatisfied(baseline, person, journey, rule, baseline));
    return baselineTruth.get(key)!;
  };
  if (modern) {
    for (const [person, records] of Object.entries(baseline.intents!)) {
      // The latest saved revision owns a request identity, even if an imported
      // snapshot accidentally contains an older duplicate record.
      const latest = new Map<string, (typeof records)[number]>();
      for (const record of records)
        if (!latest.has(record.id) || latest.get(record.id)!.revision < record.revision)
          latest.set(record.id, record);
      for (const record of latest.values()) {
        if (!record.confirmed || record.cancelled || record.questions.length ||
          intentPurpose(record) !== "request" || record.scope.kind !== "journey" ||
          !["active", "partly_fulfilled"].includes(requestProgress(baseline, person, record).status))
          continue;
        const journey = record.scope.journeyId;
        const facts = journeyFacts(baseline, person, journey);
        const outcomeRules = record.rules.filter((rule) =>
          rule.strength !== "flexible" && rule.effect.kind !== "credit_budget");
        if (outcomeRules.some((rule) => ruleConditionMatches(facts, rule) === undefined)) continue;
        const rules = outcomeRules.filter((rule) => ruleConditionMatches(facts, rule) === true);
        if (!rules.length) continue;
        requests.push({
          id: JSON.stringify([person, record.id]), person, journey, rules,
          effectiveId: JSON.stringify([person, journey,
            [...new Set(rules.map((rule) => goalKey(person, journey, rule)))].sort()]),
          before: rules.map((rule) => satisfiedBefore(person, journey, rule)),
        });
      }
      for (const journey of bookedJourneys(baseline, person)) {
        const applicable = rulesFor(baseline, person, journey).filter((rule) =>
          rule.purpose === "flexibility" && rule.strength !== "flexible" &&
          rule.effect.kind !== "credit_budget");
        const rules = [...new Map(applicable.map((rule) => [goalKey(person, journey, rule), rule])).values()];
        if (!rules.length) continue;
        preferences.push({
          id: JSON.stringify([person, journey]), person, journey, rules,
          before: rules.map((rule) => satisfiedBefore(person, journey, rule)),
        });
      }
    }
  }
  const cache = new Map<string, AllocationEvaluation>();
  const stressNetMinorUnits = (candidate: Candidate) => {
    const rate = candidate.budget === "recovery"
      ? baseline.economics.stressCost : budgetRates.get(candidate.budget || "") || 0;
    const scaled = (candidate.value - candidate.cost - candidate.risk - candidate.issuance * rate) * 100;
    const rounded = Math.round(scaled);
    return Number.isSafeInteger(rounded) && Math.abs(scaled - rounded) < 0.000001 ? rounded : NaN;
  };
  return Object.freeze({
    policyId: modern ? "fulfilled_requests_then_standing_goals_v1" : "legacy_model_gain_v1",
    objectiveNames: Object.freeze(modern
      ? ["completed_effective_requests", "net_standing_goals_satisfied", "stress_net_minor_units", "negative_credit_issuance", "negative_changed_allocations"]
      : ["model_gain", "stress_net_minor_units", "negative_credit_issuance"]),
    stressNetIndex: modern ? 2 : 1,
    evaluate(candidate: Candidate): AllocationEvaluation {
      const updates = [...candidate.changes].sort((a, b) => a.key.localeCompare(b.key));
      const key = JSON.stringify([
        updates.map((update) => [update.key, update.to]),
        candidate.value, candidate.cost, candidate.risk, candidate.issuance,
        candidate.budget, modern ? null : candidate.gain,
      ]);
      const cached = cache.get(key);
      if (cached) return cached;
      const net = stressNetMinorUnits(candidate);
      if (!modern) {
        const result = immutableEvaluation([candidate.gain, net, -candidate.issuance]);
        cache.set(key, result);
        return result;
      }
      const targets = new Map(updates.map((update) => [update.key, update.to]));
      const changedKeys = new Set(updates.filter((update) =>
        allocations.has(update.key) && allocations.get(update.key)!.resource !== update.to).map((update) => update.key));
      const projected: State = {
        ...baseline,
        allocations: baseline.allocations.map((allocation) => targets.has(allocation.key)
          ? { ...allocation, resource: targets.get(allocation.key)! } : allocation),
      };
      const afterTruth = new Map<string, boolean>();
      const after = (goals: Goals) => goals.rules.map((rule) => {
        const id = goalKey(goals.person, goals.journey, rule);
        if (!afterTruth.has(id))
          afterTruth.set(id, requestGoalSatisfied(projected, goals.person, goals.journey, rule, baseline));
        return afterTruth.get(id)!;
      });
      const fulfilled = requests.filter((request) => !request.before.every(Boolean) && after(request).every(Boolean));
      const fulfilledRequestIds = fulfilled.map((request) => request.id).sort();
      // Repeating the same current outcome under another saved ID creates no
      // additional allocation value. Different complete goal sets remain
      // separate requests, including partially overlapping bundles.
      const fulfilledEffectiveRequestIds = [...new Set(fulfilled.map((request) => request.effectiveId))].sort();
      const improvedPreferenceGoals: string[] = [], lostPreferenceGoals: string[] = [];
      const improvedPreferenceOwners = preferences.filter((owner) => {
        const next = after(owner);
        owner.rules.forEach((rule, index) => {
          const id = goalKey(owner.person, owner.journey, rule);
          if (next[index] && !owner.before[index]) improvedPreferenceGoals.push(id);
          if (!next[index] && owner.before[index]) lostPreferenceGoals.push(id);
        });
        return next.some((value, index) => value && !owner.before[index]) &&
          owner.before.every((value, index) => !value || next[index]);
      }).map((owner) => owner.id).sort();
      improvedPreferenceGoals.sort(); lostPreferenceGoals.sort();
      const result = immutableEvaluation([
        fulfilledEffectiveRequestIds.length, improvedPreferenceGoals.length - lostPreferenceGoals.length, net,
        candidate.issuance === 0 ? 0 : -candidate.issuance,
        changedKeys.size === 0 ? 0 : -changedKeys.size,
      ], { fulfilledRequestIds, fulfilledEffectiveRequestIds, improvedPreferenceOwners, improvedPreferenceGoals, lostPreferenceGoals });
      cache.set(key, result);
      return result;
    },
  });
}
