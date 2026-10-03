import type { State } from "./types.ts";

export const simulationEpoch = (state: State) =>
  state.scenarioId === "lin-family"
    ? Date.parse("2026-10-05T00:00:00Z")
    : Date.UTC(2026, 9, 18, 7);

export const simulationTimeZone = (state: State) =>
  state.scenarioId === "lin-family" ? "Hong Kong time" : "UTC";

/** Native datetime-local values use the simulation's displayed timezone. */
export function simulationTimeInput(state: State, hour: number) {
  const offset = state.scenarioId === "lin-family" ? 8 : 0;
  return new Date(simulationEpoch(state) + (hour + offset) * 3600000)
    .toISOString()
    .slice(0, 16);
}

export function simulationHourFromInput(state: State, value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return NaN;
  const zone = state.scenarioId === "lin-family" ? "+08:00" : "Z";
  return (Date.parse(`${value}:00${zone}`) - simulationEpoch(state)) / 3600000;
}
