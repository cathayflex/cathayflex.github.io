import { storyState, transition, market, optimize, invariants, held, available, validate, requestAuthorizationStatus, projectOrderBook } from './engine.mjs?v=ae302d3de407';

export function act(state, command) {
  return transition(state, {...command, expectedVersion:state.version, requestId:crypto.randomUUID()});
}
export function prepareExample(scenario = 'ready') {
  let state = storyState();
  for (let i=0;i<8;i++) state = act(state,{action:'story_advance'});
  // Keep the full earlier ledger, while limiting this view to Lin's published request.
  // The unrelated Osaka requesters do not participate in this focused example.
  for (const person of ['D','E','F']) state.intents[person] = [];
  if (scenario === 'bag-full') {
    const bag = state.resources.find(r => r.id === 'tokyo-extra-bag');
    state = act(state,{action:'inventory',resourceId:bag.id,capacity:bag.background + bag.protected,protected:bag.protected});
  }
  if (scenario === 'expired') {
    const request = state.intents.A.find(r => r.purpose === 'request');
    state = act(state,{action:'advance',hour:request.authorization.validUntil});
  }
  const start = performance.now();
  const candidates = market(state);
  const result = optimize(state);
  const elapsed = performance.now() - start;
  const request = state.intents.A.find(r => r.purpose === 'request');
  const chosen = candidates.find(c => result.selected.includes(c.id) && c.participants.includes('A') && c.changes.some(change => change.to === 'tokyo-extra-bag'));
  return {state, candidates, result, request, chosen, elapsed, scenario,
    authorization:requestAuthorizationStatus(state,'A',request),checks:invariants(state)};
}
export function commitExample(example, fault = 'none') {
  if (!example.chosen) throw new Error('There is no complete arrangement to commit.');
  let state = act(example.state,{action:'quote',candidateId:example.chosen.id});
  const contract = state.contracts.find(c => c.id === example.chosen.id);
  if (!contract) throw new Error('The arrangement was not reserved.');
  const quoteTrace = [...contract.log];
  state = act(state,{action:'accept',contractId:contract.contractId,person:'C',fault});
  return {state,contract:state.contracts.find(c => c.contractId === contract.contractId),quoteTrace,checks:invariants(state)};
}
export function reconcileExample(execution) {
  const state = act(execution.state,{action:'reconcile',contractId:execution.contract.contractId});
  return {...execution,state,contract:state.contracts.find(c => c.contractId === execution.contract.contractId),checks:invariants(state)};
}
export function staleExample(example) {
  const state = structuredClone(example.state);
  state.allocations.find(a => a.key === 'G-seat-tokyo').version++;
  return validate(state,example.chosen);
}
export function walletSummary(state) {
  return {balance:state.wallets.A,reserved:held(state,'A'),available:available(state,'A')};
}
export const bookSnapshot = state => projectOrderBook(state);
