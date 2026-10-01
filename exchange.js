import { reward, baggagePrice, initialState, accept, openRedemption, redeem } from './offers.mjs?v=20261002g';

const root = document.getElementById('flex-journey');
const content = document.getElementById('journey-content');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const arrow = '<svg aria-hidden="true"><use href="#arrow"/></svg>';
const check = '<svg aria-hidden="true"><use href="#check"/></svg>';
const bag = '<svg viewBox="0 0 80 80" aria-hidden="true"><rect x="23" y="25" width="34" height="44" rx="6"/><path d="M31 25V16a9 9 0 0 1 18 0v9M32 37v19m16-19v19M29 69v5m22-5v5"/></svg>';
const copy = {
  offer: { chapter:'EARN FLEX CREDITS', title:'A later flight<br> today.', description:'When another traveller needs your flight, Flex can offer you credits to leave later.', context:'Your journey' },
  earned: { chapter:'EARN FLEX CREDITS', title:'Your flexibility,<br> rewarded.', description:'Your later flight is confirmed. Your reward stays in your Flex balance.', context:'Your Flex balance' },
  use: { chapter:'USE THEM ON A FUTURE TRIP', title:'Extra baggage.<br> Next time.', description:'Use your credits for something you need when you next travel.', context:'Your next trip' },
  complete: { chapter:'READY FOR YOUR NEXT TRIP', title:'Ready for your<br> next journey.', description:'Your flight change helped someone else. Its reward now helps you.', context:'Your next trip' }
};
let state = initialState();
let animations = [];
function clearMotion() { animations.forEach(animation => animation.cancel()); animations = []; }
function animate(element, frames, options = {}) {
  if (reducedMotion.matches) return;
  const animation = element.animate(frames, { duration: 420, easing: 'cubic-bezier(.23,1,.32,1)', ...options });
  animations.push(animation);
  animation.finished.catch(() => {});
}
function render() {
  const current = copy[state.stage];
  root.dataset.stage = state.stage;
  document.getElementById('journey-chapter').textContent = current.chapter;
  document.getElementById('journey-title').innerHTML = current.title;
  document.getElementById('journey-description').textContent = current.description;
  document.getElementById('app-context').textContent = current.context;
  root.querySelectorAll('[data-part]').forEach(element => element.classList.toggle('is-current', element.dataset.part === (['use','complete'].includes(state.stage) ? 'use' : 'earn')));
  if (state.stage === 'earned') {
    content.innerHTML = `<div class="credit-earned"><div class="small-confirmation">${check}<span>Flight change confirmed</span></div><p class="confirmed-detail">You’re departing 2 hours later.</p><h3 class="credit-number" id="card-title" tabindex="-1">${state.balance}</h3><p class="credit-caption">Flex credits added</p><button class="journey-action" type="button" data-action="use">Use on a future trip ${arrow}</button></div>`;
  } else if (state.stage === 'use') {
    content.innerHTML = `<div class="future-benefit"><div class="baggage-icon">${bag}</div><h3 id="card-title" tabindex="-1">Extra baggage</h3><p class="future-caption">For your next trip</p><div class="redemption-price"><strong>${baggagePrice}</strong><span>Flex credits</span></div><button class="journey-action" type="button" data-action="redeem">Use ${baggagePrice} credits ${arrow}</button><p class="available-balance">Your balance <strong>${state.balance} Flex credits</strong></p></div>`;
  } else if (state.stage === 'complete') {
    content.innerHTML = `<div class="benefit-complete"><div class="baggage-icon">${bag}<span class="bag-confirmed">${check}</span></div><h3 id="card-title" tabindex="-1">Extra baggage booked.</h3><p class="future-caption">Ready for your next trip.</p><div class="remaining-balance"><strong>${state.balance}</strong><span>Flex credits left</span></div></div>`;
  }
}
root.addEventListener('click', event => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const transition = { accept, use: openRedemption, redeem }[button.dataset.action];
  if (!transition) return;
  const next = transition(state);
  if (next === state) return;
  state = next; clearMotion(); render();
  animate(content, [{ opacity: 0, transform: 'translateY(9px)' }, { opacity: 1, transform: 'translateY(0)' }]);
  animate(document.querySelector('.journey-editorial'), [{ opacity: .55 }, { opacity: 1 }], { duration: 300 });
  document.getElementById('card-title').focus({ preventScroll: true });
  const announcements = {
    earned: `Your later flight is confirmed. ${reward} Flex credits have been added.`,
    use: `On a future trip, extra baggage costs ${baggagePrice} Flex credits. Your balance is ${state.balance}.`,
    complete: `Extra baggage booked for your next trip. ${state.balance} Flex credits remain.`
  };
  document.getElementById('journey-announcement').textContent = announcements[state.stage];
});
reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) clearMotion(); });
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => {
    if (!entries[0].isIntersecting) return;
    if (state.stage === 'offer') {
      animate(document.querySelector('.journey-request'), [{ opacity: .3, transform: 'translateY(5px)' }, { opacity: 1, transform: 'translateY(0)' }]);
      animate(document.querySelector('.journey-offer'), [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'translateY(0)' }], { delay: 280, duration: 420, fill: 'backwards' });
    }
    observer.disconnect();
  }, { threshold: .4 });
  observer.observe(root);
}
