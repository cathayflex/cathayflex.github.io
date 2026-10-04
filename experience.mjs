import { initialState, accept, openRequest, publishRequest, settlePublishedRequest } from './offers.mjs?v=20261004-quote3';

export const stages = Object.freeze(['flexibility', 'offer', 'earned', 'need', 'review', 'complete']);

// Navigation revisits authored moments. It never reverses a booking or carries
// an already settled balance into another run of the illustration.
export function clampIndex(index) {
  if (typeof index !== 'number' || !Number.isFinite(index)) return 0;
  return Math.min(stages.length - 1, Math.max(0, Math.trunc(index)));
}

export const nextIndex = index => clampIndex(clampIndex(index) + 1);
export const previousIndex = index => clampIndex(clampIndex(index) - 1);

function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

function advance(state, reducer, expectedStage) {
  const next = reducer(state);
  if (next === state || next.stage !== expectedStage) {
    throw new Error(`The illustrated ${expectedStage} arrangement is not eligible.`);
  }
  return next;
}

export function snapshotAt(index) {
  const position = clampIndex(index);
  let state = initialState();
  if (position >= 2) state = advance(state, accept, 'earned');
  if (position >= 3) state = advance(state, openRequest, 'request');
  if (position >= 5) {
    state = advance(state, publishRequest, 'published');
    state = advance(state, settlePublishedRequest, 'complete');
  }

  // Clone before freezing so the consumer cannot change a snapshot or freeze
  // shared matching fixtures through a nested reference.
  return freeze({ screen: stages[position], state: structuredClone(state) });
}
