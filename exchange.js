import { preferenceWords, needWords, initialState, accept, openRequest, publishRequest } from './offers.mjs?v=20261003-story';

const root = document.getElementById('flex-journey');
const content = document.getElementById('journey-content');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const arrow = '<svg aria-hidden="true"><use href="#arrow"/></svg>';
const check = '<svg aria-hidden="true"><use href="#check"/></svg>';
const bag = '<svg viewBox="0 0 32 36" aria-hidden="true"><rect x="5" y="9" width="22" height="24" rx="3"/><path d="M11 9V5a5 5 0 0 1 10 0v4M11 16v10m10-10v10"/></svg>';
const copy = {
  flexibility: {context: 'Your preferences', announcement: 'Your flexibility. Save the example preferences to see a suitable offer.'},
  offer: {context: 'Taipei · 7 Oct', announcement: 'Earn credits. A window seat fits your saved flexibility. Accepting this seat change earns 400 Flex credits.'},
  earned: {context: 'Taipei · Confirmed', announcement: 'Window seat 22A confirmed. 400 Flex credits earned.'},
  need: {context: 'Tokyo · 2 Nov', announcement: 'Your next request. Seats together and one extra bag for Tokyo, using up to 360 Flex credits.'},
  review: {context: 'Tokyo · 2 Nov', announcement: 'Review both changes, the total credit limit and expiry before publishing your request.'},
  complete: {context: 'Tokyo · Confirmed', announcement: 'Tokyo confirmed. Seats 32A, 32B and 32C together, one extra checked bag, 360 credits used and 40 remaining.'},
};
let state = initialState(), screen = 'flexibility', animations = [];
const wallet = document.createElement('span');
wallet.id = 'journey-wallet';
wallet.className = 'journey-wallet';
root.querySelector('.journey-appbar').append(wallet);
root.querySelector('.journey-route').innerHTML = `<span data-part="earn">Earn credits</span><span class="route-line" aria-hidden="true"></span><span data-part="use">Use credits</span><button id="journey-beginning" class="journey-restart" type="button" data-action="restart" aria-label="Start the experience again" title="Start again"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10a8 8 0 1 1 1.7 7M4 4v6h6"/></svg></button>`;

function quietMotion(keyboard = false) {
  return keyboard || reducedMotion.matches || document.documentElement.dataset.keyboard === 'true';
}
function clearMotion() {
  animations.forEach(animation => animation.cancel());
  animations = [];
}
function animate(element, frames, options = {}) {
  if (!element?.animate) return;
  const animation = element.animate(frames, {duration: 240, easing: 'cubic-bezier(.23,1,.32,1)', ...options});
  animations.push(animation);
  animation.finished.catch(() => {});
}
function action(name, label) {
  return `<button class="journey-action" type="button" data-action="${name}"><span>${label}</span>${arrow}</button>`;
}
function controls(name, label, back = false) {
  return `<div class="journey-controls">${action(name, label)}${back ? '<button class="journey-back" type="button" data-action="back">Back</button>' : ''}</div>`;
}
function language(words) {
  return `<blockquote class="journey-words">“${words}”</blockquote>`;
}
function render() {
  const current = copy[screen];
  root.dataset.stage = screen;
  document.getElementById('app-context').textContent = current.context;
  wallet.hidden = ['flexibility', 'offer'].includes(screen);
  wallet.innerHTML = `<strong>${state.balance}</strong><span>Flex credits</span>`;
  const future = ['need', 'review', 'complete'].includes(screen);
  const beginning = document.getElementById('journey-beginning');
  const earn = root.querySelector('[data-part="earn"]');
  const use = root.querySelector('[data-part="use"]');
  beginning.hidden = screen === 'flexibility';
  earn.classList.toggle('is-current', !future);
  use.classList.toggle('is-current', future);
  if (future) {
    earn.removeAttribute('aria-current');
    use.setAttribute('aria-current', 'step');
  } else {
    earn.setAttribute('aria-current', 'step');
    use.removeAttribute('aria-current');
  }

  if (screen === 'flexibility') {
    content.innerHTML = `<div class="journey-screen journey-language-screen"><div class="journey-screen-main"><h3 id="card-title" tabindex="-1">Your flexibility</h3>${language(preferenceWords)}</div>${controls('save-flexibility', 'Save flexibility')}</div>`;
  } else if (screen === 'offer') {
    content.innerHTML = `<div class="journey-screen journey-offer"><div class="journey-screen-main">
      <h3 id="card-title" tabindex="-1">Your seat change offer</h3>
      <div class="seat-pair"><div><strong>22C</strong><span>Current aisle seat</span></div><span class="seat-arrow">${arrow}</span><div class="seat-destination"><strong>22A</strong><span>New window seat</span></div></div>
      <p class="offer-reason">Another traveller needs an aisle. This window seat fits your flexibility.</p>
      <p class="card-detail">Same flight · Taipei, 7 Oct</p>
      <div class="offer-reward"><span>You earn</span><strong>400 <small>Flex credits</small></strong></div></div>
      ${controls('accept', 'Accept seat change', true)}
    </div>`;
  } else if (screen === 'earned') {
    content.innerHTML = `<div class="journey-screen journey-earned"><div class="journey-screen-main"><p class="confirmation-line">${check}<span>Window seat 22A confirmed</span></p><h3 id="card-title" class="earned-number" tabindex="-1">400</h3><p class="earned-caption">Flex credits earned</p><p class="earned-explanation">Use them on this journey or a future one.</p></div>${controls('request', 'Use credits')}</div>`;
  } else if (screen === 'need') {
    content.innerHTML = `<div class="journey-screen journey-language-screen"><div class="journey-screen-main"><h3 id="card-title" tabindex="-1">Your request</h3>${language(needWords)}</div>${controls('review', 'Review request', true)}</div>`;
  } else if (screen === 'review') {
    content.innerHTML = `<div class="journey-screen journey-request"><div class="journey-screen-main">
      <h3 id="card-title" tabindex="-1">Review your request</h3>
      <dl class="request-review"><div><dt>Seats</dt><dd>Together with your family</dd></div><div><dt>Baggage</dt><dd>1 extra checked bag</dd></div><div class="request-cap"><dt>Total credit limit</dt><dd>360 <span>Flex credits</span></dd></div></dl>
      <p class="request-terms">Arrange both together by <strong>1 Nov, 9 am HKT</strong>.</p>
      <p class="authorization-note">Publishing allows Flex to confirm both changes within these terms.</p></div>
      ${controls('publish', 'Publish request', true)}
    </div>`;
  } else {
    content.innerHTML = `<div class="journey-screen journey-complete"><div class="journey-screen-main"><p class="confirmation-line">${check}<span>Both changes confirmed</span></p><h3 id="card-title" tabindex="-1">Ready for Tokyo.</h3><div class="family-outcome"><p class="card-overline">YOUR FAMILY, TOGETHER</p><div class="family-seats"><div><strong>32A</strong><span>Mia</span></div><div><strong>32B</strong><span>Jamie</span></div><div class="your-seat"><strong>32C</strong><span>You</span></div></div></div><div class="bag-outcome">${bag}<div><strong>1 extra checked bag</strong><span>Up to 23 kg · Confirmed</span></div>${check}</div><dl class="credit-receipt"><div><dt>Flex credits used</dt><dd>360</dd></div><div><dt>Credits remaining</dt><dd><strong>40</strong> Flex credits</dd></div></dl></div></div>`;
  }
}
function announce(message) {
  document.getElementById('journey-announcement').textContent = message;
}
function keepJourneyContextVisible(keyboard) {
  const card = root.querySelector('.journey-card');
  const cardBounds = card.getBoundingClientRect();
  const headerBottom = Math.max(0, document.querySelector('.site-header')?.getBoundingClientRect().bottom || 0);
  const comfortableTop = headerBottom + 18;
  const comfortableBottom = window.innerHeight - 24;
  // Keep a visitor's scroll position when the date, balance and opening of the
  // new state are already readable. A long mobile card always starts at its top.
  if (cardBounds.top >= comfortableTop - 8
      && cardBounds.top + Math.min(160, cardBounds.height) <= comfortableBottom) return;
  const journeyBounds = root.getBoundingClientRect();
  const showWholeJourney = window.innerWidth > 800
    && journeyBounds.height <= comfortableBottom - comfortableTop;
  const targetTop = showWholeJourney ? journeyBounds.top : cardBounds.top;
  window.scrollTo({
    top: Math.max(0, window.scrollY + targetTop - comfortableTop),
    behavior: quietMotion(keyboard) ? 'instant' : 'smooth',
  });
}
function show(nextScreen, nextState = state, keyboard = false) {
  const previousBalance = state.balance;
  clearMotion();
  state = nextState;
  screen = nextScreen;
  render();
  if (!quietMotion(keyboard)) {
    animate(content, [{opacity: 0, transform: 'translateY(5px)'}, {opacity: 1, transform: 'translateY(0)'}]);
    if (previousBalance !== state.balance) animate(wallet, [{opacity: .45, transform: 'translateY(3px)'}, {opacity: 1, transform: 'translateY(0)'}]);
  }
  document.getElementById('card-title').focus({preventScroll: true});
  keepJourneyContextVisible(keyboard);
  announce(copy[screen].announcement);
}
root.addEventListener('click', event => {
  const button = event.target.closest('[data-action]');
  if (!button || button.disabled) return;
  const keyboard = event.detail === 0;
  const name = button.dataset.action;
  if (name === 'restart') {
    show('flexibility', initialState(), keyboard);
    return;
  }
  if (name === 'back') {
    const previous = {offer: 'flexibility', need: 'earned', review: 'need'}[screen];
    if (previous) show(previous, state, keyboard);
    return;
  }
  if (name === 'save-flexibility' && screen === 'flexibility' && state.offer) {
    show('offer', state, keyboard);
  } else if (name === 'accept' && screen === 'offer') {
    const next = accept(state);
    if (next !== state) show('earned', next, keyboard);
  } else if (name === 'request' && screen === 'earned') {
    const next = state.stage === 'earned' ? openRequest(state) : state;
    if (next.stage === 'request') show('need', next, keyboard);
  } else if (name === 'review' && screen === 'need') {
    show('review', state, keyboard);
  } else if (name === 'publish' && screen === 'review') {
    const next = publishRequest(state);
    if (next !== state) show('complete', next, keyboard);
  }
});
reducedMotion.addEventListener('change', () => {
  if (reducedMotion.matches) clearMotion();
});
render();
