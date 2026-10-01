export const offers = {
  flight: {
    words: '“I can leave later. Please keep my aisle seat.”',
    conditions: ['Later departure', 'Aisle required'],
    name: 'Take a later flight.',
    beforeCaption: 'Current departure', before: '10:00',
    afterCaption: 'New departure', after: '12:00',
    kept: 'Your aisle seat stays.',
    benefit: 'Your change opens an earlier place for another traveller.',
    credits: 600
  },
  seat: {
    words: '“A window seat works too. Keep me on this flight.”',
    conditions: ['Window accepted', 'Same flight'],
    name: 'Choose the window.',
    beforeCaption: 'Current seat', before: '18C',
    afterCaption: 'New seat', after: '18A',
    kept: 'Aisle to window. Same flight.',
    benefit: 'Your change makes an aisle seat available to someone who needs it.',
    credits: 100
  }
};
export const benefits = {
  baggage: { name: 'Extra baggage', price: 200 },
  seat: { name: 'Preferred seat', price: 100 }
};
export function initialState(offer = 'flight') {
  if (!offers[offer]) throw new Error('Unknown offer');
  return { offer, accepted: false, balance: 0, redeemed: [] };
}
export function accept(state) {
  if (state.accepted) return state;
  return { ...state, accepted: true, balance: offers[state.offer].credits };
}
export function redeem(state, benefit) {
  const item = benefits[benefit];
  if (!item || !state.accepted || state.redeemed.includes(benefit) || state.balance < item.price) return state;
  return { ...state, balance: state.balance - item.price, redeemed: [...state.redeemed, benefit] };
}
