import { simulationEpoch } from "./time.ts";
import type { Change, Journey, State } from "./types.ts";

/** An existing entitlement can accompany a departure change without expanding
 * its product, allowance or credit terms. Physical empty-seat guarantees need
 * a separate coordinated plan and are excluded from ordinary access transfer.
 */
export function preservesFlightEntitlement(s: State, change: Change): boolean {
  const from = s.resources.find(entry => entry.id === change.from),
    to = s.resources.find(entry => entry.id === change.to);
  if (!from || !to || from.kind !== to.kind || from.journey !== to.journey ||
    from.product !== to.product || from.q !== to.q) return false;
  if (from.kind === "meal") return from.mealName === to.mealName;
  if (from.kind === "service") return ["wifi", "lounge"].includes(from.product);
  if (from.kind !== "baggage" || !from.baggage || !to.baggage) return false;
  return from.baggage.role === to.baggage.role && from.baggage.pieces === to.baggage.pieces &&
    from.baggage.maxKg === to.baggage.maxKg && from.baggage.maxCm === to.baggage.maxCm &&
    from.baggage.passenger === to.baggage.passenger && from.baggage.entitlementId === to.baggage.entitlementId;
}

export function confirmedAllocations(s: State): State["allocations"] {
  const pending = new Map(s.contracts.filter(contract => contract.status === "RECONCILING")
    .flatMap(contract => contract.changes.map(change => [change.key, change.from] as const)));
  return s.allocations.map(allocation => pending.has(allocation.key)
    ? {...allocation, resource: pending.get(allocation.key)!} : allocation);
}

/** Resolve the operating departure associated with an arrangement's resource.
 * This keeps historical receipts tied to their accepted flight after later changes.
 */
export function resourceJourney(s: State, resourceId: string | null): Journey | undefined {
  const resource = s.resources.find(entry => entry.id === resourceId);
  const journey = s.journeys?.find(entry => entry.id === resource?.journey);
  if (!journey || !resource) return undefined;
  const flight = resource.kind === "flight" ? resource : s.resources.find(entry =>
    entry.kind === "flight" && entry.journey === resource.journey && entry.serviceHour === resource.serviceHour);
  return {
    ...journey,
    flightNumber: flight?.flightNumber || (flight?.kind === "flight" ? flight.label : undefined) || journey.flightNumber,
    departureAt: new Date(simulationEpoch(s) + resource.serviceHour * 3600000).toISOString(),
  };
}

export function arrangementBooking(s: State, person: string, changes: Change[]): Journey | undefined {
  const own = changes.filter(change => s.allocations.find(allocation => allocation.key === change.key)?.person === person);
  const relevant = own.length ? own : changes;
  const flight = relevant.find(change => s.resources.find(resource => resource.id === (change.to || change.from))?.kind === "flight");
  const selected = flight || relevant[0];
  return resourceJourney(s, selected?.to || selected?.from || null);
}

/** Project one passenger's confirmed departure without mutating the shared
 * journey or historical service orders. Partially applied adapter writes stay
 * behind their pending transaction until the complete arrangement settles.
 */
export function bookedJourney(s: State, person: string, journeyId: string): Journey | undefined {
  const journey = s.journeys?.find(entry => entry.id === journeyId);
  if (!journey) return undefined;
  const flights = confirmedAllocations(s).filter(allocation => allocation.person === person).flatMap(allocation => {
    const resource = s.resources.find(entry => entry.id === allocation.resource);
    return resource?.kind === "flight" && resource.journey === journeyId ? [resource] : [];
  });
  if (flights.length !== 1) return {...journey};
  return resourceJourney(s, flights[0].id);
}
