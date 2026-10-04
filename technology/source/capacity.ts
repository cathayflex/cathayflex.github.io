import type { Candidate, State } from "./types.ts";

const active = (status: string) =>
  ["QUEUED", "HELD", "ACCEPTED", "AWAITING_EVIDENCE", "RECONCILING"].includes(status);

/** Carrier-approved incremental load pools are independent of ticket allowances. */
export function poolUsage(s: State): Map<string, number> {
  const used = new Map(
    (s.capacityPools || []).map((pool) => [pool.id, pool.background]),
  );
  for (const allocation of s.allocations) {
    for (const use of s.resources.find((r) => r.id === allocation.resource)
      ?.capacityUses || [])
      used.set(use.poolId, (used.get(use.poolId) || 0) + use.units);
  }
  return used;
}

export function poolDemand(
  s: State,
  candidate: Candidate,
): Map<string, number> {
  const delta = new Map<string, number>();
  for (const change of candidate.changes) {
    // Reconciliation may already have written some destinations.
    const current = s.allocations.find((a) => a.key === change.key)?.resource;
    for (const [id, sign] of [
      [current, -1],
      [change.to, 1],
    ] as const)
      for (const use of s.resources.find((r) => r.id === id)?.capacityUses ||
        [])
        delta.set(use.poolId, (delta.get(use.poolId) || 0) + sign * use.units);
  }
  return new Map([...delta].filter(([, units]) => units > 0));
}

export function availablePools(s: State, except?: string): Map<string, number> {
  const used = poolUsage(s);
  for (const contract of s.contracts.filter(
    (c) => active(c.status) && c.contractId !== except,
  ))
    for (const [id, units] of poolDemand(s, contract))
      used.set(id, (used.get(id) || 0) + units);
  return new Map(
    (s.capacityPools || []).map((pool) => [
      pool.id,
      Math.max(0, pool.capacity - pool.protected - (used.get(pool.id) || 0)),
    ]),
  );
}

export function capacityPoolErrors(
  s: State,
  c: Candidate,
  except?: string,
): string[] {
  const errors: string[] = [];
  for (const change of c.changes)
    for (const use of s.resources.find((r) => r.id === change.to)
      ?.capacityUses || [])
      if (
        !Number.isSafeInteger(use.units) ||
        use.units <= 0 ||
        !s.capacityPools?.some((p) => p.id === use.poolId)
      )
        errors.push("The airline capacity allocation is unavailable.");
  const available = availablePools(s, except);
  for (const [id, units] of poolDemand(s, c))
    if (units > (available.get(id) ?? 0))
      errors.push(
        `${s.capacityPools?.find((p) => p.id === id)?.label || "Shared capacity"} has insufficient capacity.`,
      );
  return errors;
}
