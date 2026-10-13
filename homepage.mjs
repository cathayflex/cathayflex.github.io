import {resources} from './homepage-model.mjs';
import {renderInterface} from './interface-preview.mjs';
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
function activeNav(){scrollQueued=false;let selected=-1;sections.forEach((s,i)=>{if(s.getBoundingClientRect().top<180)selected=i});links.forEach((link,i)=>{if(i===selected)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current')})}
addEventListener('scroll',()=>{if(!scrollQueued){scrollQueued=true;requestAnimationFrame(activeNav)}},{passive:true});activeNav();
function transitionContent(el,keyboard){
  if(reduced.matches||keyboard)return;
  el.getAnimations().forEach(a=>a.cancel());
  el.animate([{opacity:.5,transform:'translateY(4px)'},{opacity:1,transform:'translateY(0)'}],{duration:200,easing:'cubic-bezier(.23,1,.32,1)'});
}
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
  return index=>select(buttons[index],false);
}
const processSteps=[
  {title:'Describe the travel change you need',body:'Tell Flex what you want to change and the conditions that matter to you. Review the request and its credit price before it enters the marketplace.',left:'Your request',right:'Available changes',leftArrow:'→',rightArrow:'←'},
  {title:'Flex connects requests with people and services that can help',body:'Flex considers what passengers need, which changes others can accept and the services Cathay has available. It finds arrangements that fit those conditions.',left:'Passenger needs',right:'Willingness to change',leftArrow:'→',rightArrow:'←'},
  {title:'The helping passenger chooses whether to accept',body:'They see the proposed change to their journey and the credits they would earn. Accepting makes the requested travel arrangement possible.',left:'Match found',right:'Change accepted',leftArrow:'←',rightArrow:'←'},
  {title:'Cathay confirms the booking changes',body:'Flex coordinates the passengers involved and sends the agreed changes to Cathay. Each traveller receives confirmation when the booking or service is updated.',left:'Booking confirmed',right:'Booking confirmed',leftArrow:'←',rightArrow:'→'},
  {title:'The passenger who helped receives the credits',body:'Once Cathay confirms the changes, Flex completes the agreed credit payment. Those credits can be used for another travel benefit on this journey or a later one.',left:'Request fulfilled',right:'Credits received',leftArrow:'←',rightArrow:'→'}
];
const selectProcess=tabs('[data-step]','step',(key,keyboard)=>{
  const i=Number(key),step=processSteps[i];
  $('process-explanation').innerHTML=`<p class="step-label">STEP ${i+1} OF 5</p><h3>${step.title}</h3><p>${step.body}</p><button class="step-next" type="button" data-next="${(i+1)%5}">${i===4?'Start again':'Next step'} <span aria-hidden="true">${i===4?'↺':'→'}</span></button>`;
  document.querySelector('.process-map').dataset.stage=key;
  document.querySelector('.requester-path span').textContent=step.left;
  document.querySelector('.helper-path span').textContent=step.right;
  document.querySelector('.requester-path i').textContent=step.leftArrow;
  document.querySelector('.helper-path i').textContent=step.rightArrow;
  $('process-panel').setAttribute('aria-labelledby',`step-${key}`);
  transitionContent($('process-explanation'),keyboard);
});
$('process-explanation').addEventListener('click',e=>{const button=e.target.closest('[data-next]');if(button){const next=Number(button.dataset.next);selectProcess(next);document.querySelector(`[data-step="${next}"]`).focus({preventScroll:true})}});

tabs('[data-resource]','resource',(key,keyboard)=>{
  const r=resources[key];
  $('resource-content').innerHTML=`<img class="resource-hero-icon" src="assets/resources/${r.icon}.svg" alt=""><h3>${r.title}</h3><p class="resource-intro">${r.intro}</p><div class="resource-actions ${r.earn&&r.use?'':'single'}">${r.earn?`<div><h4>Earn credits</h4><p>${r.earn}</p></div>`:''}${r.use?`<div><h4>Use credits</h4><p>${r.use}</p></div>`:''}</div><p class="allocation-note">${r.allocation}</p>`;
  $('resource-detail').setAttribute('aria-labelledby',`resource-${key}`);transitionContent($('resource-content'),keyboard);
});
const mark='<img src="assets/flex-credits.svg" width="28" height="28" alt="Flex Credits">';
const technology={
  intent:{title:'Your own words become a clear travel request',body:'AI reads your description alongside your booking and available travel options. It identifies the change you need and the conditions to keep in place.',visual:'<p class="visual-label">Your request</p><p class="request-words">“I can change seats if I stay beside my companion.”</p><div class="down-arrow" aria-hidden="true">↓</div><div class="condition-fields"><div><span>Change allowed</span><strong>Seat assignment</strong></div><div><span>Keep together</span><strong>Both travellers</strong></div><div><span>Journey</span><strong>Current flight</strong></div></div>'},
  matching:{title:'Passenger flexibility creates more ways to meet a need',body:'Flex searches across the marketplace for compatible requests and available services. It checks that the proposed arrangements fit passenger conditions, capacity and credit balances.',visual:'<div class="matching-inputs"><span>Passenger requests</span><span>Changes people can accept</span><span>Available services</span></div><div class="down-arrow" aria-hidden="true">↓</div><div class="matching-output">Travel arrangements that work for the passengers involved</div>'},
  settlement:{title:'Booking changes and credit payments stay connected',body:'Flex coordinates the agreed changes with Cathay and completes the credit payment after the booking or service is confirmed.',visual:`<div class="settlement-steps"><div><span>1</span>Agree the change</div><b aria-hidden="true">→</b><div><span>2</span>Confirm the booking</div><b aria-hidden="true">→</b><div><span>${mark}</span>Pay the credits</div></div>`}
};
tabs('[data-tech]','tech',(key,keyboard)=>{const t=technology[key];$('tech-panel').innerHTML=`<div><h3>${t.title}</h3><p>${t.body}</p></div><div class="tech-visual">${t.visual}</div>`;$('tech-panel').setAttribute('aria-labelledby',`tech-${key}`);transitionContent($('tech-panel'),keyboard)});

tabs('[data-app]','app',(key,keyboard)=>{
  $('native-app').innerHTML=renderInterface(key);
  $('app-screen').setAttribute('aria-labelledby',`app-${key}`);
  transitionContent($('native-app'),keyboard);
});
function fitInterface(){
  const display=$('app-screen'),space=document.querySelector('.device-space'),frame=document.querySelector('.device-frame');
  const scale=Math.min((display.clientWidth-40)/390,(display.clientHeight-40)/820,1);
  space.style.width=`${390*scale}px`;space.style.height=`${820*scale}px`;frame.style.transform=`scale(${scale})`;
}
new ResizeObserver(fitInterface).observe($('app-screen'));fitInterface();
const film=$('flex-film'),dialog=$('film-dialog');
$('watch-film').addEventListener('click',()=>{dialog.showModal();document.body.style.overflow='hidden';film.play().catch(()=>{})});
document.querySelector('.film-close').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close()}});
dialog.addEventListener('close',()=>{film.pause();document.body.style.overflow='';$('watch-film').focus({preventScroll:true})});
tabs('[data-evidence]','evidence',key=>{document.querySelector('.evidence-grid').dataset.selected=key});
tabs('[data-sustain]','sustain',key=>{document.querySelector('.sustainability-grid').dataset.selected=key});
