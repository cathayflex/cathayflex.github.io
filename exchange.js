import { preferenceWords, needWords, initialState, matchSeats, accept, openRequest, matchServices, redeem } from './offers.mjs?v=20261002h';

const root = document.getElementById('flex-journey');
const content = document.getElementById('journey-content');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const arrow = '<svg aria-hidden="true"><use href="#arrow"/></svg>';
const check = '<svg aria-hidden="true"><use href="#check"/></svg>';
const bag = '<svg viewBox="0 0 80 80" aria-hidden="true"><rect x="23" y="25" width="34" height="44" rx="6"/><path d="M31 25V16a9 9 0 0 1 18 0v9M32 37v19m16-19v19M29 69v5m22-5v5"/></svg>';
const copy = {
  preferences: { chapter:'YOUR FLEXIBILITY', title:'Your preferences.<br> In your own words.', description:'Tell Flex where you can be flexible and what matters on different journeys.', context:'Your preferences' },
  'seat-offer': { chapter:'A MATCH FOR BOTH OF YOU', title:'A seat you can change.<br> A seat someone needs.', description:'On this short flight, a window works for you. Alex would prefer your aisle seat.', context:'Hong Kong to Taipei' },
  earned: { chapter:'YOUR FLEXIBILITY, REWARDED', title:'A different seat.<br> More possibilities.', description:'You stay on the same flight. Your seat change earns credits for a future journey.', context:'Your Flex balance' },
  request: { chapter:'A NEW JOURNEY. A NEW NEED.', title:'What would make<br> your next trip better?', description:'Say what you need. Flex connects your request with the right trip and available services.', context:'Your next trip' },
  'service-offer': { chapter:'MATCHED TO YOUR NEXT TRIP', title:'Extra baggage.<br> For Tokyo.', description:'Flex finds baggage for your Tokyo trip that your credit balance can cover.', context:'Tokyo · Next month' },
  complete: { chapter:'READY FOR YOUR NEXT TRIP', title:'Your flexibility,<br> put to use.', description:'A seat change on one journey. Extra baggage on another. The value travels with you.', context:'Tokyo · Next month' }
};
let state = initialState();
let animations = [];
function clearMotion() { animations.forEach(animation => animation.cancel()); animations = []; }
function animate(element, frames, options = {}) {
  if (!element || reducedMotion.matches || document.documentElement.dataset.keyboard === 'true') return;
  const animation = element.animate(frames, { duration: 280, easing: 'cubic-bezier(.23,1,.32,1)', ...options });
  animations.push(animation);
  animation.finished.catch(() => {});
}
function action(name, label) { return `<button class="journey-action" type="button" data-action="${name}">${label} ${arrow}</button>`; }
function interpretation(words, rows, title, next, label) {
  return `<div class="language-step"><h3 class="sr-only" id="card-title" tabindex="-1">${title}</h3><div class="journey-request"><p>“${words}”</p></div><div class="understood"><p class="card-overline">YOUR WORDS, UNDERSTOOD</p><dl class="preference-rules">${rows.map(([key,value])=>`<div><dt>${key}</dt><dd>${value}</dd></div>`).join('')}</dl></div>${action(next,label)}</div>`;
}
function render() {
  const current = copy[state.stage];
  root.dataset.stage = state.stage;
  document.getElementById('journey-chapter').textContent = current.chapter;
  document.getElementById('journey-title').innerHTML = current.title;
  document.getElementById('journey-description').textContent = current.description;
  document.getElementById('app-context').textContent = current.context;
  const spending = ['request','service-offer','complete'].includes(state.stage);
  const restart = document.getElementById('journey-beginning');
  restart.disabled = state.stage === 'preferences';
  restart.classList.toggle('is-current', !spending);
  document.querySelector('[data-part="use"]').classList.toggle('is-current', spending);
  if (state.stage === 'preferences') {
    content.innerHTML = interpretation(preferenceWords, [['Short flights','Any seat'],['Long flights','Aisle preferred']], 'Your seat preferences', 'match-seats', 'Find a seat match');
  } else if (state.stage === 'seat-offer') {
    content.innerHTML = `<div class="seat-match"><p class="card-overline">ON YOUR SHORT FLIGHT</p><div class="fellow-request"><span>${state.offer.traveller} would like an aisle.</span><span>${check} Ready to switch</span></div><h3 id="card-title" tabindex="-1">A window for you.<br> An aisle for ${state.offer.traveller}.</h3><p class="match-explanation">Same flight. Both preferences met.</p><p class="offer-reward-line">You earn <strong>${state.offer.reward}</strong> Flex credits.</p>${action('accept','Accept seat change')}</div>`;
  } else if (state.stage === 'earned') {
    content.innerHTML = `<div class="credit-earned"><div class="small-confirmation">${check}<span>Your window seat is confirmed.</span></div><p class="confirmed-detail">Alex has the aisle. You keep your flight.</p><h3 class="credit-number" id="card-title" tabindex="-1">${state.balance}</h3><p class="credit-caption">Flex credits added</p>${action('request','Use credits on your next trip')}</div>`;
  } else if (state.stage === 'request') {
    content.innerHTML = interpretation(needWords, [['Journey','Tokyo, next month'],['Need','Extra baggage'],['Use','Flex credits']], 'Your next journey request', 'match-services', 'Find options');
  } else if (state.stage === 'service-offer') {
    content.innerHTML = `<div class="future-benefit"><div class="baggage-icon">${bag}</div><h3 id="card-title" tabindex="-1">Extra baggage</h3><p class="future-caption">Matched to your Tokyo trip.</p><div class="redemption-price"><strong>${state.service.creditPrice}</strong><span>Flex credits</span></div>${action('redeem',`Use ${state.service.creditPrice} credits`)}<p class="available-balance">Your balance <strong>${state.balance} Flex credits</strong></p></div>`;
  } else if (state.stage === 'complete') {
    content.innerHTML = `<div class="benefit-complete"><div class="baggage-icon">${bag}<span class="bag-confirmed">${check}</span></div><h3 id="card-title" tabindex="-1">Extra baggage booked.</h3><p class="future-caption">Ready for Tokyo next month.</p><div class="remaining-balance"><strong>${state.balance}</strong><span>Flex credits left</span></div></div>`;
  }
}
function revealInterpretation() {
  const rows = content.querySelectorAll('.preference-rules>div');
  animate(content.querySelector('.journey-request'), [{ opacity: .4, transform: 'translateY(4px)' }, { opacity: 1, transform: 'translateY(0)' }]);
  rows.forEach((row,index)=>animate(row,[{ opacity: 0, transform: 'translateY(6px)' },{ opacity: 1, transform: 'translateY(0)' }],{delay:240+index*70,duration:330,fill:'backwards'}));
}
root.addEventListener('click', event => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const transition = { 'match-seats':matchSeats, accept, request:openRequest, 'match-services':matchServices, redeem, restart:initialState }[button.dataset.action];
  if (!transition) return;
  const next = transition(state);
  if (next === state) return;
  state = next; clearMotion(); render();
  animate(content,[{opacity:0,transform:'translateY(7px)'},{opacity:1,transform:'translateY(0)'}]);
  if (['preferences','request'].includes(state.stage)) revealInterpretation();
  document.getElementById('card-title').focus({ preventScroll:true });
  const announcement = state.stage === 'complete'
    ? `Extra baggage booked for Tokyo next month. ${state.balance} Flex credits remain.`
    : state.stage === 'earned' ? `Seat change confirmed. ${state.balance} Flex credits added.`
    : copy[state.stage].description;
  document.getElementById('journey-announcement').textContent = announcement;
});
reducedMotion.addEventListener('change',()=>{if(reducedMotion.matches)clearMotion();});
render();
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries=>{
    if(!entries[0].isIntersecting)return;
    if(state.stage==='preferences')revealInterpretation();
    observer.disconnect();
  },{threshold:.35});
  observer.observe(root);
}
