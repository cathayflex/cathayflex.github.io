import { preferenceWords, needWords, initialState, accept, openRequest, publishRequest } from './offers.mjs?v=20261003-story';

const root = document.getElementById('flex-journey');
const content = document.getElementById('journey-content');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const arrow = '<svg aria-hidden="true"><use href="#arrow"/></svg>';
const check = '<svg aria-hidden="true"><use href="#check"/></svg>';
const bag = '<svg viewBox="0 0 32 36" aria-hidden="true"><rect x="5" y="9" width="22" height="24" rx="3"/><path d="M11 9V5a5 5 0 0 1 10 0v4M11 16v10m10-10v10"/></svg>';
const copy = {
  offer: {context: 'Taipei · 7 Oct', announcement: 'Earn credits. A window seat fits your saved flexibility. Accepting this seat change earns 400 Flex credits.'},
  earned: {context: 'Taipei · Confirmed', announcement: 'Window seat 22A confirmed. 400 Flex credits earned.'},
  request: {context: 'Tokyo · 2 Nov', announcement: 'Use credits. Review seats together and an extra bag for Tokyo within one 360-credit limit.'},
  complete: {context: 'Tokyo · Confirmed', announcement: 'Tokyo confirmed. Seats 32A, 32B and 32C together, one extra checked bag, 360 credits used and 40 remaining.'},
};
let state = initialState(), animations = [], publication = null;
const wallet = document.createElement('span');
wallet.id = 'journey-wallet';
wallet.className = 'journey-wallet';
root.querySelector('.journey-appbar').append(wallet);

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
function language(words, label) {
  return `<div class="journey-language"><p class="card-overline">${label}</p><p class="journey-words">“${words}”</p></div>`;
}
function render() {
  const current = copy[state.stage];
  root.dataset.stage = state.stage;
  root.removeAttribute('data-publishing');
  content.removeAttribute('aria-busy');
  document.getElementById('app-context').textContent = current.context;
  wallet.innerHTML = `<strong>${state.balance}</strong><span>Flex credits</span>`;
  const future = ['request', 'complete'].includes(state.stage);
  const beginning = document.getElementById('journey-beginning');
  const use = root.querySelector('[data-part="use"]');
  beginning.disabled = state.stage === 'offer';
  beginning.classList.toggle('is-current', !future);
  beginning.setAttribute('aria-label', state.stage === 'offer' ? 'Earn credits' : 'Return to earning credits');
  beginning.title = 'Back to earning credits';
  use.classList.toggle('is-current', future);
  if (future) {
    beginning.removeAttribute('aria-current');
    use.setAttribute('aria-current', 'step');
  } else {
    beginning.setAttribute('aria-current', 'step');
    use.removeAttribute('aria-current');
  }

  if (state.stage === 'offer') {
    content.innerHTML = `<div class="journey-offer">
      ${language(preferenceWords, 'YOUR SAVED FLEXIBILITY')}
      <dl class="understood-rules" aria-label="Your words, understood"><div><dt>Up to 4 hours</dt><dd>Any seat</dd></div><div><dt>Over 4 hours</dt><dd>Aisle</dd></div></dl>
      <div class="seat-change"><h3 id="card-title" tabindex="-1">Switch seats. Earn credits.</h3><div class="seat-pair"><div><strong>22C</strong><span>Current aisle seat</span></div><span class="seat-arrow">${arrow}</span><div class="seat-destination"><strong>22A</strong><span>New window seat</span></div></div><p class="card-detail">Same flight. Another traveller gets the aisle.</p></div>
      <div class="offer-reward"><span>You earn</span><strong>400 <small>Flex credits</small></strong></div>
      ${action('accept', 'Accept seat change')}
    </div>`;
  } else if (state.stage === 'earned') {
    content.innerHTML = `<div class="journey-earned"><p class="confirmation-line">${check}<span>Window seat 22A confirmed</span></p><h3 id="card-title" class="earned-number" tabindex="-1">400</h3><p class="earned-caption">Flex credits earned</p><p class="earned-explanation">Available for this journey<br>or a future one.</p><div class="next-journey"><span>Your next trip</span><strong>Tokyo <span>2 Nov</span></strong></div>${action('request', 'Use credits')}</div>`;
  } else if (state.stage === 'request') {
    content.innerHTML = `<div class="journey-request">
      ${language(needWords, 'YOUR NEXT REQUEST')}
      <h3 id="card-title" class="request-heading" tabindex="-1">One request. Both changes.</h3>
      <dl class="request-review"><div><dt>Seats</dt><dd>Together with your family</dd></div><div><dt>Baggage</dt><dd>1 extra checked bag</dd></div><div class="request-cap"><dt>Total credit limit</dt><dd>360 <span>Flex credits</span></dd></div></dl>
      <p class="request-terms">Arrange both together by <strong>1 Nov, 9 am HKT</strong>.</p>
      ${action('publish', 'Publish request')}
      <p class="authorization-note">This allows Flex to confirm both changes within your limit.</p>
    </div>`;
  } else {
    content.innerHTML = `<div class="journey-complete"><p class="confirmation-line">${check}<span>Both changes confirmed</span></p><h3 id="card-title" tabindex="-1">Ready for Tokyo.</h3><div class="family-outcome"><p class="card-overline">YOUR FAMILY, TOGETHER</p><div class="family-seats"><div><strong>32A</strong><span>Mia</span></div><div><strong>32B</strong><span>Jamie</span></div><div class="your-seat"><strong>32C</strong><span>You</span></div></div></div><div class="bag-outcome">${bag}<div><strong>1 extra checked bag</strong><span>Up to 23 kg · Confirmed</span></div>${check}</div><dl class="credit-receipt"><div><dt>Flex credits used</dt><dd>360</dd></div><div><dt>Yours to keep</dt><dd><strong>40</strong> Flex credits</dd></div></dl></div>`;
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
function show(next, keyboard = false) {
  const previousBalance = state.balance;
  clearMotion();
  state = next;
  render();
  if (!quietMotion(keyboard)) {
    animate(content, [{opacity: 0, transform: 'translateY(5px)'}, {opacity: 1, transform: 'translateY(0)'}]);
    if (previousBalance !== state.balance) animate(wallet, [{opacity: .45, transform: 'translateY(3px)'}, {opacity: 1, transform: 'translateY(0)'}]);
  }
  document.getElementById('card-title').focus({preventScroll: true});
  keepJourneyContextVisible(keyboard);
  announce(copy[state.stage].announcement);
}
function finishPublication(keyboard = false) {
  if (!publication) return;
  clearTimeout(publication.timer);
  const next = publication.next;
  publication = null;
  show(next, keyboard);
}
root.addEventListener('click', event => {
  const button = event.target.closest('[data-action]');
  if (!button || button.disabled) return;
  const keyboard = event.detail === 0;
  const name = button.dataset.action;
  if (name === 'restart') {
    if (publication) clearTimeout(publication.timer);
    publication = null;
    show(initialState(), keyboard);
    return;
  }
  if (publication) return;
  const transition = {accept, request: openRequest, publish: publishRequest}[name];
  if (!transition) return;
  const next = transition(state);
  if (next === state) return;
  if (name === 'publish' && !quietMotion(keyboard)) {
    root.dataset.publishing = 'true';
    content.setAttribute('aria-busy', 'true');
    button.disabled = true;
    button.querySelector('span').textContent = 'Arranging both changes';
    announce('Request published. Flex is matching both changes within your 360-credit limit.');
    publication = {next, timer: setTimeout(() => finishPublication(), 650)};
  } else show(next, keyboard);
});
reducedMotion.addEventListener('change', () => {
  if (reducedMotion.matches) { clearMotion(); finishPublication(true); }
});
render();
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => {
    if (!entries[0].isIntersecting) return;
    if (state.stage === 'offer' && !quietMotion()) {
      content.querySelectorAll('.understood-rules>div').forEach((row, index) => animate(row,
        [{opacity: .25, transform: 'translateY(4px)'}, {opacity: 1, transform: 'translateY(0)'}],
        {delay: index * 65, duration: 220, fill: 'backwards'}));
    }
    observer.disconnect();
  }, {threshold: .3});
  observer.observe(root);
}
