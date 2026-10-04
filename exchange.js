import { preferenceWords, needWords, publishRequest } from './offers.mjs?v=20261004-fixed2';
import { snapshotAt, nextIndex, previousIndex } from './experience.mjs?v=20261004-flow3';

const root = document.getElementById('flex-journey');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const $ = id => document.getElementById(id);
const descriptions = {
  flexibility: {title: 'Your travel preferences.', action: 'Save preferences'},
  offer: {title: 'Earn 400 credits for a seat change.', action: 'Accept change', explanation: 'Another traveller needs an aisle. The window seat fits your preferences.'},
  earned: {title: '400 credits earned.', action: 'Use credits', explanation: 'Your window seat is confirmed.'},
  need: {title: 'Your next journey.', action: 'Review request'},
  review: {title: 'Review your request.', action: 'Confirm request', amount: '360 credits', expiry: 'Request valid until 1 Nov, 9 am HKT'},
  complete: {title: 'Your family trip, confirmed.', action: 'Experience again', amount: '360 credits used'},
};
let index = 0, current = snapshotAt(0), animations = [], epoch = 0, pendingMatch = null;
const text = (id, value) => { $(id).textContent = value; };
function quietMotion(keyboard) { return keyboard || reducedMotion.matches || document.documentElement.dataset.keyboard === 'true'; }
function cancelMotion() {
  epoch++;
  clearTimeout(pendingMatch);
  pendingMatch = null;
  root.removeAttribute('aria-busy');
  animations.forEach(animation => animation.cancel());
  animations = [];
  root.querySelectorAll('.credit-flight').forEach(node => node.remove());
}
function animate(node, frames, options = {}) {
  if (!node?.animate) return null;
  const animation = node.animate(frames, {duration: 230, easing: 'cubic-bezier(.23,1,.32,1)', ...options});
  animations.push(animation);
  animation.finished.catch(() => {});
  return animation;
}
function render() {
  const {screen, state} = current, copy = descriptions[screen];
  const configuring = screen === 'flexibility';
  const future = index >= 3, earned = index >= 2, completed = index === 5;
  root.dataset.stage = screen;
  text('experience-counter', `0${index + 1} / 06`);
  $('experience-counter').setAttribute('aria-label', `Step ${index + 1} of 6`);
  $('journey-context').hidden = configuring;
  text('app-context', future ? 'Hong Kong to Tokyo' : 'Hong Kong to Taipei');
  text('journey-date', future ? '2 Nov' : '7 Oct · 1 h 45 min');
  text('card-title', copy.title);
  $('scene-terms').hidden = !copy.amount;
  text('scene-amount', copy.amount || '');
  text('scene-expiry', copy.expiry || '');
  const naturalLanguage = configuring || screen === 'need';
  $('journey-words').hidden = !naturalLanguage;
  text('journey-words', `“${future ? needWords : preferenceWords}”`);
  $('scene-explanation').hidden = !copy.explanation;
  text('scene-explanation', copy.explanation || '');
  $('taipei-booking').hidden = configuring || future;
  $('tokyo-booking').hidden = !['review', 'complete'].includes(screen);
  const seatMap = root.querySelector('.seat-map');
  seatMap.classList.toggle('seat-moved', earned);
  seatMap.setAttribute('aria-label', `Your seat is ${earned ? '22A, by the window' : '22C, on the aisle'}`);
  text('seat-change-label', earned ? 'Confirmed seat' : 'Proposed change');
  text('seat-change-value', earned ? '22A · Window' : '22C → 22A');
  text('seat-change-note', earned ? '' : 'Aisle to window');
  $('credit-award').hidden = true;
  root.querySelectorAll('.service-state').forEach(node => { node.hidden = !completed; node.textContent = 'Confirmed'; });
  root.querySelectorAll('.assigned-seat').forEach(node => { node.hidden = !completed; });
  root.querySelectorAll('.seat-person').forEach(node => { node.hidden = completed; });
  $('tokyo-booking').classList.toggle('is-confirmed', completed);
  $('journey-wallet').setAttribute('aria-label', `${state.balance} Flex credits available`);
  text('wallet-number', state.balance);
  $('wallet-held').hidden = true;
  const back = root.querySelector('[data-action="back"]');
  back.disabled = index === 0;
  const forward = root.querySelector('[data-action="forward"]');
  forward.disabled = false;
  forward.querySelector('span').textContent = copy.action;
  forward.setAttribute('aria-label', copy.action);
  for (const part of ['earn','use']) {
    const node = root.querySelector(`[data-part="${part}"]`);
    if ((part === 'use') === future) node.setAttribute('aria-current', 'step');
    else node.removeAttribute('aria-current');
  }
}
function animateBalance(before, after, source, reverse = false) {
  if (before === after) return;
  const number = $('wallet-number');
  const from = source.getBoundingClientRect(), to = number.getBoundingClientRect();
  const board = root.querySelector('.experience').getBoundingClientRect();
  const pill = document.createElement('span');
  pill.className = 'credit-flight';
  pill.setAttribute('aria-hidden', 'true');
  pill.textContent = after > before ? '+400' : '−360';
  const start = after > before ? from : to, end = after > before ? to : from;
  pill.style.left = `${start.left - board.left + start.width / 2}px`;
  pill.style.top = `${start.top - board.top + start.height / 2}px`;
  root.querySelector('.experience').append(pill);
  // This short explanatory transfer links the booking change to its balance.
  // Back navigation uses a direct balance transition, without replaying payment.
  if (reverse) { pill.remove(); animate(number,[{opacity:.4},{opacity:1}]); return; }
  const dx = end.left + end.width / 2 - start.left - start.width / 2;
  const dy = end.top + end.height / 2 - start.top - start.height / 2;
  const transfer = animate(pill, [
    {opacity:0,transform:'translate(-50%, -50%) scale(.94)',offset:0},
    {opacity:1,transform:'translate(-50%, -50%) scale(1)',offset:.15},
    {opacity:1,transform:`translate(calc(-50% + ${dx * .6}px), calc(-50% + ${dy * .6 - 28}px))`,offset:.65},
    {opacity:0,transform:`translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.94)`,offset:1},
  ],{duration:620,easing:'cubic-bezier(.22,.68,.2,1)'});
  transfer?.finished.then(()=>pill.remove()).catch(()=>{});
  number.innerHTML = `<span class="balance-old">${before}</span><span class="balance-new">${after}</span>`;
  animate(number.querySelector('.balance-old'),[{transform:'translateY(0)',opacity:1},{transform:'translateY(-90%)',opacity:0}],{delay:390,duration:240,fill:'both'});
  animate(number.querySelector('.balance-new'),[{transform:'translateY(90%)',opacity:0},{transform:'translateY(0)',opacity:1}],{delay:390,duration:240,fill:'both'});
  const version = epoch;
  const last = animations.at(-1);
  last?.finished.then(()=>{ if(version===epoch) text('wallet-number',after); }).catch(()=>{});
}
function showMatch(keyboard) {
  if (pendingMatch) return;
  cancelMotion();
  const published = publishRequest(current.state);
  if (published.stage !== 'published') return;
  current = {screen: current.screen, state: published};
  root.setAttribute('aria-busy', 'true');
    text('card-title', 'Finding your changes.');
  $('wallet-held').hidden = false;
  text('wallet-held', `${published.creditHold} held`);
  $('journey-wallet').setAttribute('aria-label', `${published.balance} Flex credits, including ${published.creditHold} reserved for this request`);
  const forward = root.querySelector('[data-action="forward"]');
  forward.disabled = true;
  forward.querySelector('span').textContent = 'Matching';
  forward.setAttribute('aria-label', 'Matching');
  text('journey-announcement', 'Request published. Finding both changes at the confirmed price.');
  // A brief authored passage connects publication to the later matching result.
  // Back cancels it immediately. Keyboard and reduced-motion users skip it.
  if (quietMotion(keyboard)) { go(5, keyboard); return; }
  root.querySelectorAll('.service-state').forEach(node => { node.textContent = 'Matching'; });
  animate($('tokyo-booking'), [{opacity:1},{opacity:.5},{opacity:1}], {duration:700});
  pendingMatch = setTimeout(() => go(5, false), 850);
}
function keepInView(keyboard) {
  const frame = root.querySelector('.experience'), box = frame.getBoundingClientRect();
  const header = document.querySelector('.site-header').getBoundingClientRect().bottom;
  if (box.top < header || box.top > innerHeight - 180) window.scrollTo({top:scrollY+box.top-header-14,behavior:quietMotion(keyboard)?'instant':'smooth'});
}
function go(next, keyboard) {
  const previous = current, backward = next < index;
  cancelMotion();
  index = next;
  current = snapshotAt(index);
  const quiet = quietMotion(keyboard);
  root.classList.toggle('quiet-motion', quiet);
  render();
  if (!quiet) {
    animate(root.querySelector('.scene-copy'),[{opacity:.35,transform:`translateY(${backward?-4:6}px)`},{opacity:1,transform:'translateY(0)'}]);
    if (index === 1) animate($('taipei-booking'),[{opacity:0,transform:'translateX(18px) scale(.98)'},{opacity:1,transform:'translateX(0) scale(1)'}],{duration:280});
    if (index === 4) animate($('tokyo-booking'),[{opacity:0,transform:'translateX(18px)'},{opacity:1,transform:'translateX(0)'}],{duration:280});
    if (index === 5) root.querySelectorAll('.service-visual').forEach((node,i)=>animate(node,[{opacity:.5,transform:'translateY(5px)'},{opacity:1,transform:'translateY(0)'}],{delay:i*60}));
    animateBalance(previous.state.balance,current.state.balance,index>=3?$('scene-amount'):$('seat-change-value'),backward);
  }
  if (keyboard) $('card-title').focus({preventScroll:true});
  keepInView(keyboard);
  text('journey-announcement',`${descriptions[current.screen].title} ${current.state.balance} Flex credits available. Step ${index+1} of 6.`);
}
root.addEventListener('click',event=>{
  const button = event.target.closest('[data-action]');
  if (!button || button.disabled) return;
  if (index === 4 && button.dataset.action === 'forward') { showMatch(event.detail === 0); return; }
  const next = button.dataset.action === 'back' ? previousIndex(index) : index===5 ? 0 : nextIndex(index);
  go(next,event.detail===0);
});
reducedMotion.addEventListener('change',()=>{
  if (pendingMatch !== null) { go(5, true); return; }
  cancelMotion();
  root.classList.toggle('quiet-motion',reducedMotion.matches);
  render();
});
root.classList.toggle('quiet-motion',reducedMotion.matches);
render();
