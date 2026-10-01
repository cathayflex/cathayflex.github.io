import { offers, benefits, initialState, accept, redeem } from './offers.mjs?v=20261002f';

const root = document.getElementById('flex-offer');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const action = document.getElementById('offer-action');
const reset = document.getElementById('reset-offer');
const feedback = document.getElementById('offer-feedback');
const text = (id, value) => { document.getElementById(id).textContent = value; };
let state = initialState();
const ongoing = new Set();
function animate(element, frames, options = {}) {
  if (reducedMotion.matches) return;
  const animation = element.animate(frames, { duration: 380, easing: 'cubic-bezier(.23,1,.32,1)', ...options });
  ongoing.add(animation);
  animation.finished.catch(() => {}).finally(() => ongoing.delete(animation));
}
function clearMotion() { ongoing.forEach(animation => animation.cancel()); ongoing.clear(); }
function revealOffer() {
  clearMotion();
  animate(document.querySelector('.ai-interpretation'), [{ opacity: 0, transform: 'translateX(-8px)' }, { opacity: 1, transform: 'translateX(0)' }], { delay: 180, fill: 'backwards' });
  animate(document.querySelector('.offer-body'), [{ opacity: .2, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }], { delay: 420, duration: 480, fill: 'backwards' });
}
function render() {
  const offer = offers[state.offer];
  root.dataset.state = state.accepted ? 'accepted' : 'offered';
  text('request-words', offer.words);
  const chips = document.getElementById('preference-chips');
  chips.replaceChildren(...offer.conditions.map(condition => { const chip = document.createElement('span'); chip.textContent = condition; return chip; }));
  text('offer-name', offer.name);
  for (const [id, value] of [['before-caption', offer.beforeCaption], ['before-value', offer.before], ['after-caption', offer.afterCaption], ['after-value', offer.after], ['kept-detail', offer.kept]]) text(id, value);
  text('reward-label', state.accepted ? 'YOUR FLEX BALANCE' : 'YOU RECEIVE');
  text('reward-status', state.accepted ? (state.balance ? 'Ready to use' : 'Credits used') : 'On confirmation');
  text('credit-amount', state.accepted ? String(state.balance) : `+${offer.credits}`);
  const canRedeem = Object.entries(benefits).some(([id, item]) => !state.redeemed.includes(id) && state.balance >= item.price);
  text('reward-use', state.accepted ? (canRedeem ? 'Choose a benefit for a future trip.' : 'Your benefits are ready for your next trip.') : 'Use them on a future trip.');
  feedback.textContent = state.accepted ? `${offer.credits} credits earned. Your updated booking is confirmed.` : offer.benefit;
  action.disabled = state.accepted;
  action.querySelector('span').textContent = state.accepted ? 'Offer accepted' : 'Accept & earn credits';
  action.querySelector('use').setAttribute('href', state.accepted ? '#check' : '#arrow');
  reset.hidden = !state.accepted;
  root.querySelectorAll('[data-offer]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.offer === state.offer)));
  root.querySelectorAll('[data-benefit]').forEach(button => {
    const id = button.dataset.benefit;
    const booked = state.redeemed.includes(id);
    button.disabled = !state.accepted || booked || state.balance < benefits[id].price;
    button.classList.toggle('is-booked', booked);
    button.querySelector('small').textContent = booked ? 'Reserved with Flex' : `${benefits[id].price} credits`;
  });
}
root.querySelectorAll('[data-offer]').forEach(button => button.addEventListener('click', () => {
  if (state.offer === button.dataset.offer) return;
  state = initialState(button.dataset.offer); render(); revealOffer();
}));
action.addEventListener('click', () => {
  state = accept(state); render(); clearMotion();
  animate(document.querySelector('.reward-amount'), [{ opacity: .35, transform: 'translateY(7px)' }, { opacity: 1, transform: 'translateY(0)' }]);
  animate(document.querySelector('.offer-bridge'), [{ transform: 'translate(-50%,-50%) scale(.8)' }, { transform: 'translate(-50%,-50%) scale(1)' }]);
});
root.querySelectorAll('[data-benefit]').forEach(button => button.addEventListener('click', () => {
  const id = button.dataset.benefit;
  const next = redeem(state, id);
  if (next === state) return;
  state = next; render();
  feedback.textContent = `${benefits[id].name} reserved for your next trip. ${state.balance} credits remain.`;
  animate(document.querySelector('.reward-amount'), [{ opacity: .3, transform: 'translateY(5px)' }, { opacity: 1, transform: 'translateY(0)' }]);
}));
reset.addEventListener('click', () => { state = initialState(state.offer); render(); revealOffer(); action.focus({ preventScroll: true }); });
reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) clearMotion(); });
render();
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => {
    if (!entries[0].isIntersecting) return;
    revealOffer(); observer.disconnect();
  }, { threshold: .35 });
  observer.observe(root);
}
