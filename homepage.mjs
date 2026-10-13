import {resources,journeyAt,nextJourney,previousJourney} from './homepage-model.mjs';
const $=id=>document.getElementById(id);
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const mobile=matchMedia('(max-width: 800px)');
const menu=document.querySelector('.menu-toggle');
const nav=$('site-nav');
function closeMenu(restore=false){menu.setAttribute('aria-expanded','false');nav.hidden=mobile.matches;if(restore)menu.focus()}
closeMenu();
menu.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',String(open));nav.hidden=!open});
nav.addEventListener('click',e=>{if(e.target.closest('a'))closeMenu()});
mobile.addEventListener('change',()=>closeMenu());
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&menu.getAttribute('aria-expanded')==='true')closeMenu(true)});
document.addEventListener('pointerdown',e=>{if(mobile.matches&&!e.target.closest('.site-header'))closeMenu()},{passive:true});
const links=[...nav.querySelectorAll('a')];
const sections=links.map(a=>document.querySelector(a.hash));
let scrollQueued=false;
function activeNav(){scrollQueued=false;let selected=-1;sections.forEach((s,i)=>{if(s.getBoundingClientRect().top<170)selected=i});links.forEach((link,i)=>{if(i===selected)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current')})}
addEventListener('scroll',()=>{if(!scrollQueued){scrollQueued=true;requestAnimationFrame(activeNav)}},{passive:true});activeNav();

function transitionContent(el,keyboard){
  if(reduced.matches||keyboard)return;
  el.getAnimations().forEach(a=>a.cancel());
  el.animate([{opacity:.35,transform:'translateY(5px)'},{opacity:1,transform:'translateY(0)'}],{duration:240,easing:'cubic-bezier(.23,1,.32,1)'});
}
const person=`<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="6" r="3.4"/><path d="M5 22v-4.5a7 7 0 0 1 14 0V22"/></svg>`;
const credit=`<img src="assets/flex-credits.svg" width="28" height="28" alt="Flex Credits">`;
const scenes=[
()=>`<p class="micro">Hong Kong to Paris / A change you can accept</p><h3>Your seat can help a family sit together.</h3><p>Another passenger will pay 160 credits if you move to a different aisle seat in the same cabin.</p><div class="seat-change"><div class="seat-option"><span>Your current seat</span><strong>22C</strong><p>Economy aisle</p><img src="assets/resources/seat-changes.svg" alt=""></div><span class="transfer-arrow" aria-label="changes to">→</span><div class="seat-option new"><span>Your new seat</span><strong>24C</strong><p>Economy aisle</p><img src="assets/resources/seat-changes.svg" alt=""></div></div><div class="reward-line"><span>You earn when the change is completed</span><strong>+160 ${credit}</strong></div>`,
()=>`<p class="micro">Hong Kong to Paris / Seat change completed</p><h3>You helped another traveller.</h3><p>Your booking now shows seat 24C, and the other passenger’s family can sit together.</p><div class="earned-receipt">${credit}<div><strong>160 credits earned</strong><p>Your balance has increased from 600 to 760.</p></div></div><p class="receipt-note">The credits remain available for the next travel benefit you need.</p>`,
()=>`<p class="micro">A later journey / Hong Kong to Tokyo</p><h3>This time, your family needs a change.</h3><p>You want three adjacent seats and an extra checked bag. Flex combines the seating request with Cathay’s baggage availability.</p><div class="request-quote"><span>Three seats together</span><strong>160 credits</strong><span>One extra checked bag</span><strong>200 credits</strong><div class="quote-total"><span>Total for your request</span><span><strong>360</strong>${credit}</span></div></div>`,
()=>`<p class="micro">Hong Kong to Tokyo / Changes confirmed</p><h3>Your family’s arrangements are in place.</h3><p>A fellow passenger accepted the seat change, and Cathay confirmed the extra baggage.</p><div class="confirmed-services"><div class="family-confirmed"><div class="confirmed-label"><span>Seats together</span><span aria-label="Confirmed">✓</span></div><div class="family-seats">${[['32A','Mia'],['32B','Jamie'],['32C','You']].map(([seat,name])=>`<div class="family-seat"><strong>${seat}</strong>${person}<span>${name}</span></div>`).join('')}</div></div><div class="bag-confirmed"><div class="confirmed-label"><span>Extra baggage</span><span aria-label="Confirmed">✓</span></div><img src="assets/resources/checked-baggage.svg" alt=""><strong>1 checked bag</strong><p>Up to 23 kg</p></div></div><div class="reward-line"><span>160 to the helping passenger, 200 for baggage</span><strong>−360 ${credit}</strong></div>`
];
let state=journeyAt(0);
const labels=['Accept this seat change','See a later journey','Find the complete arrangement','Replay the exchange'];
function renderJourney(keyboard=false,initial=false){
  $('demo-screen').innerHTML=scenes[state.step]();
  $('demo-balance').textContent=state.balance;
  $('demo-count').textContent=`${state.step+1} of 4`;
  $('demo-back').disabled=state.step===0;
  $('demo-next').innerHTML=`${labels[state.step]} <span aria-hidden="true">${state.step===3?'↺':'→'}</span>`;
  document.querySelectorAll('[data-story]').forEach((el,i)=>{if(i===state.step)el.setAttribute('aria-current','step');else el.removeAttribute('aria-current')});
  $('demo-announcement').textContent=`${$('demo-screen').querySelector('h3').textContent} ${state.balance} Flex Credits available. Step ${state.step+1} of 4.`;
  transitionContent($('demo-screen'),keyboard);
  if(!initial){
    if(keyboard)$('demo-screen').focus({preventScroll:true});
    const panel=document.querySelector('.demo-panel');
    if(panel.getBoundingClientRect().top<document.querySelector('.site-header').offsetHeight+18)panel.scrollIntoView({block:'start',behavior:reduced.matches||keyboard?'instant':'smooth'});
  }
}
$('demo-next').addEventListener('click',e=>{state=nextJourney(state.step);renderJourney(e.detail===0)});
$('demo-back').addEventListener('click',e=>{state=previousJourney(state.step);renderJourney(e.detail===0)});
renderJourney(true,true);

function tabs(selector,attribute,render){
  const buttons=[...document.querySelectorAll(selector)];
  function select(button,keyboard=false){buttons.forEach(b=>{const active=b===button;b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1});render(button.dataset[attribute],keyboard)}
  buttons.forEach((button,index)=>{
    button.addEventListener('click',e=>select(button,e.detail===0));
    button.addEventListener('keydown',e=>{
      let target;
      if(['ArrowRight','ArrowDown'].includes(e.key))target=(index+1)%buttons.length;
      if(['ArrowLeft','ArrowUp'].includes(e.key))target=(index-1+buttons.length)%buttons.length;
      if(e.key==='Home')target=0;if(e.key==='End')target=buttons.length-1;
      if(target===undefined)return;e.preventDefault();buttons[target].focus();select(buttons[target],true);
    });
  });
  select(buttons[0],true);
}
tabs('[data-resource]','resource',(key,keyboard)=>{
  const r=resources[key];
  $('resource-content').innerHTML=`<img class="resource-hero-icon" src="assets/resources/${r.icon}.svg" alt=""><h3>${r.title}</h3><p class="resource-intro">${r.intro}</p><div class="resource-actions ${r.earn&&r.use?'':'single'}">${r.earn?`<div><h4>How you earn credits</h4><p>${r.earn}</p></div>`:''}${r.use?`<div><h4>How you use credits</h4><p>${r.use}</p></div>`:''}</div><p class="allocation-note">${r.allocation}</p>`;
  $('resource-detail').setAttribute('aria-labelledby',`resource-${key}`);transitionContent($('resource-content'),keyboard);
});
const technology={
  intent:{title:'Turn passenger language into matching conditions',body:'Passengers describe what they need in their own words. AI combines that description with their booking and the services available, then prepares specific conditions for the passenger to review.',method:'Booking context, available options and structured outputs',visual:`<p class="visual-label">Passenger request</p><p class="request-words">“I can change seats if I stay beside my companion.”</p><div class="down-arrow" aria-hidden="true">↓</div><div class="condition-fields"><div><span>Change allowed</span><strong>Seat assignment</strong></div><div><span>Keep together</span><strong>Both travellers</strong></div><div><span>Apply to</span><strong>Current flight</strong></div></div>`},
  matching:{title:'Find combinations that meet passenger needs',body:'The optimisation engine searches across requests, acceptable changes and available services. It selects compatible arrangements within passenger conditions, capacity and credit limits.',method:'Graph search and branch-and-bound selection',visual:`<div class="matching-inputs"><span>Passenger requests</span><span>Acceptable changes</span><span>Available services</span></div><div class="down-arrow" aria-hidden="true">↓</div><div class="matching-output">Compatible arrangements across the marketplace</div><p class="visual-label">Each selected arrangement respects the conditions of the passengers involved.</p>`},
  settlement:{title:'Keep booking changes and credits in step',body:'The transaction engine records agreed terms, reserves the resources and coordinates passenger agreement with airline updates. Credits are settled once fulfilment is confirmed.',method:'Conditional order book, coordinated updates and a credit ledger',visual:`<div class="settlement-steps"><div><span>1</span>Reserve the agreed arrangement</div><b aria-hidden="true">→</b><div><span>2</span>Confirm the airline updates</div><b aria-hidden="true">→</b><div><span>${credit}</span>Settle the agreed credits</div></div>`}
};
tabs('[data-tech]','tech',(key,keyboard)=>{const t=technology[key];$('tech-panel').innerHTML=`<div><h3>${t.title}</h3><p>${t.body}</p><p class="tech-method">${t.method}</p></div><div class="tech-visual">${t.visual}</div>`;$('tech-panel').setAttribute('aria-labelledby',`tech-${key}`);transitionContent($('tech-panel'),keyboard)});
// Load the actual exported matching engine only when the visitor opens the example.
let labModule,labEpoch=0;
async function runMatching(){
  const epoch=++labEpoch;
  try{
    labModule??=import('./technology/lab.mjs');
    const {prepareExample}=await labModule;
    const example=prepareExample($('bag-available').checked?'ready':'bag-full');
    if(epoch!==labEpoch)return;
    const matched=Boolean(example.chosen);
    $('lab-result').innerHTML=`<div class="lab-result-card ${matched?'':'waiting'}"><h4>${matched?'Both parts can be fulfilled':'The request is waiting for baggage capacity'}</h4><p>${matched?'Flex has found a seating arrangement and the baggage capacity needed for the complete request.':'A seating arrangement alone does not fulfil this passenger’s request. Flex keeps looking for an arrangement that includes the extra bag.'}</p><ul><li>Adjacent seats ${matched?'matched':'can be matched'}</li><li>Extra bag ${matched?'available':'unavailable'}</li><li>Agreed request price remains 360 credits</li></ul></div>`;
  }catch(error){console.error('Matching example could not load',error);$('lab-result').innerHTML='<div class="lab-result-card"><h4>The matching example could not load.</h4><p>Please reload the page to try again.</p></div>'}
}
document.querySelector('.matching-lab').addEventListener('toggle',e=>{if(e.target.open)runMatching()});
$('bag-available').addEventListener('change',runMatching);

const appDescriptions={journeys:['Cathay Flex Journey screen showing a Paris trip, credit balance and lounge suggestions','Journey overview'],requests:['Cathay Flex Request changes screen with a request form and existing requests','Request changes'],earn:['Cathay Flex Earn credits screen listing suitable changes and credit rewards','Earn credits'],credits:['Cathay Flex View balance screen with available credits and account activity','View balance']};
tabs('[data-app]','app',(key,keyboard)=>{
  $('app-image').src=`assets/deck/ui-${key}.jpg`;$('app-image').alt=appDescriptions[key][0];$('app-caption').textContent=appDescriptions[key][1];$('app-screen').setAttribute('aria-labelledby',`app-${key}`);transitionContent($('app-image'),keyboard);
});
