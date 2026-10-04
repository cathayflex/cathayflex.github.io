import { installServiceCatalogue } from "./service-catalogue.ts";
import type { State } from "./types.ts";

export const resourceGroups = [
  { id: "travel", title: "Travel changes", description: "Request a change, or earn credits by accepting one.", resources: ["seat", "flight"] },
  { id: "release", title: "Baggage and meals", description: "Return baggage allowance or skip a meal to earn credits. Use credits for extra baggage.", resources: ["baggage_release", "meal_skip"] },
  { id: "later", title: "Later confirmation", description: "Request now. Pay when availability is confirmed.", resources: ["upgrade", "neighbour_free"] },
  { id: "access", title: "Service access", description: "Use credits for services on this journey.", resources: ["lounge", "wifi"] },
] as const;

/** Idempotent catalogue migration. Existing executed contracts retain their accepted terms. */
export function upgradeResourceModel(s: State, enableCatalogue = false): State {
  if (s.resourceModelVersion === 4 && (s.serviceProducts?.length || !enableCatalogue || !s.journeys?.length)) return s;
  const retired = new Set(s.resources.filter(r => r.kind === "handover").map(r => r.id));
  s.operationalOffers = s.operationalOffers?.filter(o => !o.changes.some(ch =>
    retired.has(ch.to || "") || retired.has(s.allocations.find(a => a.key === ch.allocationKey)?.resource || "")));
  for (const c of s.contracts) {
    if (["HELD", "ACCEPTED", "AWAITING_EVIDENCE"].includes(c.status) &&
        c.changes.some(ch => retired.has(ch.from || "") || retired.has(ch.to || ""))) {
      c.status = "CANCELLED";
      c.log.push("This service has been withdrawn. All unspent credits are available again.");
    }
  }
  // Records referenced by settled or reconciling contracts remain available for history.
  if (s.serviceProducts?.length || (enableCatalogue && s.journeys?.length)) installServiceCatalogue(s);
  s.resourceModelVersion = 4;
  return s;
}
