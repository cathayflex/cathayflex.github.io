export const reward = 600;
export const baggagePrice = 200;
export function initialState() {
  return { stage: 'offer', balance: 0 };
}
export function accept(state) {
  return state.stage === 'offer' ? { stage: 'earned', balance: reward } : state;
}
export function openRedemption(state) {
  return state.stage === 'earned' ? { ...state, stage: 'use' } : state;
}
export function redeem(state) {
  return state.stage === 'use' && state.balance >= baggagePrice
    ? { stage: 'complete', balance: state.balance - baggagePrice }
    : state;
}
