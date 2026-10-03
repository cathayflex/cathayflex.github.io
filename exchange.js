import { preferenceWords, needWords, publishRequest } from './offers.mjs?v=20261004-fixed2';
import { snapshotAt, nextIndex, previousIndex } from './experience.mjs?v=20261004-flow3';

const root = document.getElementById('flex-journey');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const $ = id => document.getElementById(id);
const descriptions = {
  flexibility: {status: 'YOUR FLEXIBILITY', title: 'Set your travel preferences.', action: 'Save flexibility', progress: 'Save your flexibility', bottom: 'You choose which offers to accept.'},
  offer: {status: 'AN OFFER FOR YOUR JOURNEY', title: 'A seat change offer for you.', action: 'Accept seat change', progress: 'Review your offer', explanation: 'On your Taipei flight, another traveller needs your aisle seat. This window seat fits your saved preferences.', bottom: 'Same flight. Same cabin. You decide.'},
  earned: {status: 'SEAT CHANGE CONFIRMED', title: 'Your flexibility earned 400 credits.', action: 'Use credits', progress: 'Credits added to your balance', explanation: 'Your window seat is confirmed. Your credits are ready whenever you need them.', bottom: '22A · Window seat confirmed'},
  need: {status: 'YOUR NEXT JOURNEY', title: 'What would make this trip better?', action: 'Review request', progress: 'Request what you need', bottom: 'Use your balance for the changes that matter to you.'},
  review: {status: 'REVIEW YOUR REQUEST', title: 'Two changes for 360 credits.', action: 'Publish request', progress: 'Approve your request', explanation: 'Flex found your Tokyo booking. Confirm the price and we’ll look for both changes together.', bottom: 'Complete both by 1 Nov, 9 am HKT.', amount: 'Fixed price · 360 credits'},
  complete: {status: 'REQUEST FULFILLED', title: 'Your family trip, confirmed.', action: 'Start again', progress: '400 earned · 360 used · 40 remaining', explanation: 'Your family is seated together, with room for the extra bag.', bottom: 'Both changes confirmed within your approved terms.', amount: '360 credits used'},
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
  text('app-context', configuring ? 'Your profile' : future ? 'Hong Kong to Tokyo' : 'Hong Kong to Taipei');
  $('journey-date').hidden = configuring;
  $('flexibility-note').hidden = !configuring;
  text('journey-date', future ? 'CX520 · 2 Nov' : '7 Oct · 1 h 45 min');
  text('scene-status', copy.status);
  text('card-title', copy.title);
  text('experience-progress', copy.progress);
  text('scene-bottom-copy', copy.bottom);
  text('scene-amount', copy.amount || '');
  $('scene-amount').hidden = !copy.amount;
  const naturalLanguage = screen === 'flexibility' || screen === 'need';
  $('journey-words').hidden = !naturalLanguage;
  text('journey-words', `“${future ? needWords : preferenceWords}”`);
  $('scene-explanation').hidden = naturalLanguage;
  text('scene-explanation', copy.explanation || '');
  $('taipei-booking').hidden = configuring || future;
  $('tokyo-booking').hidden = !future;
  const seatMap = root.querySelector('.seat-map');
  seatMap.classList.toggle('seat-moved', earned);
  seatMap.setAttribute('aria-label', `Your seat is ${earned ? '22A, by the window' : '22C, on the aisle'}`);
  text('seat-change-label', screen === 'offer' ? 'Your offered change' : earned ? 'Your confirmed seat' : 'Your current seat');
  text('seat-change-value', screen === 'offer' ? '22C → 22A' : earned ? '22A · Window' : '22C · Aisle');
  $('credit-award').hidden = index === 0;
  text('credit-award', earned ? '+400 earned' : '+400 credits');
  text('seat-change-note', screen === 'offer' ? 'Aisle to window' : earned ? 'Your flight and cabin stay the same.' : 'Your booking stays unchanged until you accept.');
  root.querySelectorAll('.service-state').forEach(node => { node.textContent = completed ? 'Confirmed' : index === 4 ? 'Included' : 'Requested'; });
  root.querySelectorAll('.assigned-seat').forEach(node => { node.hidden = !completed; });
  root.querySelectorAll('.seat-person').forEach(node => { node.hidden = completed; });
  $('tokyo-booking').classList.toggle('is-confirmed', completed);
  $('journey-wallet').setAttribute('aria-label', `${state.balance} Flex credits available`);
  text('wallet-number', state.balance);
  $('wallet-earned').hidden = !earned;
  $('wallet-spent').hidden = !completed;
  text('wallet-note', completed ? '40 credits stay in your balance.' : earned ? 'Earned on one journey. Ready for another.' : 'The credits you earn stay with you.');
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
  text('scene-status', 'REQUEST PUBLISHED');
  text('card-title', 'Finding your changes.');
  text('scene-explanation', 'Your request is active. Flex checks seats, baggage and each traveller’s agreement.');
  text('experience-progress', 'Looking for both changes together');
  text('wallet-note', `${published.creditHold} credits reserved for this request.`);
  $('journey-wallet').setAttribute('aria-label', `${published.balance} Flex credits, including ${published.creditHold} reserved for this request`);
  text('scene-bottom-copy', 'Your booking stays unchanged until both changes are confirmed.');
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
    if (index === 3) animate($('tokyo-booking'),[{opacity:0,transform:'translateX(18px)'},{opacity:1,transform:'translateX(0)'}],{duration:280});
    if (index === 5) root.querySelectorAll('.service-visual').forEach((node,i)=>animate(node,[{opacity:.5,transform:'translateY(5px)'},{opacity:1,transform:'translateY(0)'}],{delay:i*60}));
    animateBalance(previous.state.balance,current.state.balance,index>=3?$('scene-amount'):$('credit-award'),backward);
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
