import { isExtraBaggage, isExtraBagSlot } from "./baggage.ts";
import type { IntentRule, Resource, State } from "./types.ts";

export type BaggageRequirement = Extract<IntentRule["effect"], {kind: "baggage"}>;

/** Each threshold counts the pieces that satisfy it. A heavier allowance also
 * satisfies a lower threshold, so different requirements can share a piece.
 */
export function baggageRequirementSatisfied(resources: Resource[], requirement: BaggageRequirement) {
  return resources.filter(resource => isExtraBaggage(resource) &&
    (resource.baggage?.maxKg || 0) >= (requirement.maxKgPerPiece || 0))
    .reduce((pieces, resource) => pieces + (resource.baggage?.pieces || 0), 0) >= requirement.extraPieces;
}

export type BaggagePlan = {
  changes: {key: string; from: null; to: string; version: number}[];
  credits: number;
};

/** Uniform-cost search over product multisets. Quote and matching use the same
 * feasible covers. Capacity remains a reservation check, so a fixed catalog
 * price does not change when another traveller consumes inventory.
 */
export function baggagePlans(
  s: State,
  person: string,
  journeyId: string,
  rules: Pick<IntentRule, "effect" | "strength">[],
  options: {createSlots?: boolean; maxPlans?: number; workLimit?: number} = {},
): {plans: BaggagePlan[]; limited: "candidate_limit" | "work_limit" | null; work: number} {
  const requirements = rules.flatMap(rule => rule.effect.kind === "baggage" && rule.strength !== "flexible" ? [rule.effect] : []);
  if (!requirements.length) return {plans: [], limited: null, work: 0};
  const own = s.allocations.filter(allocation => allocation.person === person &&
    (allocation.journeyId === journeyId || s.resources.find(resource => resource.id === allocation.resource)?.journey === journeyId)
    && isExtraBagSlot(s, allocation));
  const supplied = own.flatMap(allocation => {
    const resource = s.resources.find(entry => entry.id === allocation.resource);
    return resource && isExtraBaggage(resource) ? [resource] : [];
  });
  if (requirements.every(requirement => baggageRequirementSatisfied(supplied, requirement))) return {plans: [], limited: null, work: 0};
  const requested = Math.max(...requirements.map(requirement => requirement.extraPieces));
  const needed = requested - supplied.reduce((pieces, resource) => pieces + (resource.baggage?.pieces || 0), 0);
  if (needed <= 0) return {plans: [], limited: null, work: 0};
  const slots = own.filter(allocation => allocation.resource === null).map(allocation => ({key: allocation.key, version: allocation.version})).sort((a, b) => a.key.localeCompare(b.key));
  if (options.createSlots) for (let index = own.length; index < requested; index++)
    slots.push({key: `extra-baggage:${person}:${journeyId}:${index}`, version: 1});
  if (!slots.length) return {plans: [], limited: null, work: 0};
  const products = s.resources.filter(resource => isExtraBaggage(resource) && resource.journey === journeyId &&
    resource.source === "airline_inventory" && (!resource.eligible.length || resource.eligible.includes(person)) &&
    resource.baggage?.passenger === person && Number.isSafeInteger(resource.q) && resource.q >= 0 &&
    Number.isInteger(resource.baggage.pieces) && resource.baggage.pieces > 0 && resource.baggage.pieces <= needed)
    .sort((a, b) => a.id.localeCompare(b.id));
  if (!products.length) return {plans: [], limited: null, work: 0};
  type Node = {cost: number; pieces: number; indexes: number[]; sequence: number};
  const heap: Node[] = [];
  const less = (a: Node, b: Node) => a.cost < b.cost || (a.cost === b.cost && a.sequence < b.sequence);
  const push = (node: Node) => {
    heap.push(node);
    let i = heap.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!less(heap[i], heap[parent])) break;
      [heap[i], heap[parent]] = [heap[parent], heap[i]];
      i = parent;
    }
  };
  const pop = () => {
    const first = heap[0], last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      while (true) {
        let child = i * 2 + 1;
        if (child >= heap.length) break;
        if (child + 1 < heap.length && less(heap[child + 1], heap[child])) child++;
        if (!less(heap[child], heap[i])) break;
        [heap[i], heap[child]] = [heap[child], heap[i]];
        i = child;
      }
    }
    return first;
  };
  const plans: BaggagePlan[] = [], maxPlans = options.maxPlans ?? 64, workLimit = options.workLimit ?? 20000;
  let sequence = 0, visited = 0, created = 1;
  push({cost: 0, pieces: 0, indexes: [], sequence: sequence++});
  while (heap.length) {
    if (++visited > workLimit) return {plans, limited: "work_limit", work: Math.min(workLimit, Math.max(visited, created))};
    const node = pop();
    if (node.pieces === needed) {
      const selected = node.indexes.map(index => products[index]);
      if (requirements.every(requirement => baggageRequirementSatisfied([...supplied, ...selected], requirement))) {
        plans.push({credits: node.cost, changes: selected.map((resource, index) =>
          ({key: slots[index].key, from: null, to: resource.id, version: slots[index].version}))});
        if (plans.length >= maxPlans) return {plans, limited: heap.length ? "candidate_limit" : null, work: Math.max(visited, created)};
      }
      continue;
    }
    if (node.indexes.length >= slots.length) continue;
    for (let index = node.indexes.at(-1) ?? 0; index < products.length; index++) {
      const product = products[index], pieces = node.pieces + product.baggage!.pieces;
      if (pieces > needed) continue;
      // A branch that cannot meet a weight threshold with its remaining piece
      // count has no feasible completion and need not enter the frontier.
      const selected = [...supplied, ...node.indexes.map(index => products[index]), product];
      if (requirements.some(requirement => {
        const covered = selected.filter(resource => resource.baggage!.maxKg >= (requirement.maxKgPerPiece || 0))
          .reduce((total, resource) => total + resource.baggage!.pieces, 0);
        return covered + needed - pieces < requirement.extraPieces;
      })) continue;
      if (++created > workLimit) return {plans, limited: "work_limit", work: Math.min(workLimit, Math.max(visited, created))};
      push({cost: node.cost + product.q, pieces, indexes: [...node.indexes, index], sequence: sequence++});
    }
  }
  return {plans, limited: null, work: Math.max(visited, created)};
}
