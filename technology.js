import { technologyExamples, capitalize, durationLabel } from './technology.mjs?v=20261004-copy';

const mount = document.getElementById('technology-visual');
const arrow = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6"/></svg>';
const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));

function rules(example, key) {
  const rows = key === 'flexibility' ? example.rules : [
    {label:'Booked flight', value:example.rules.find(rule => rule.id === 'journey').value},
    {label:`${example.structured.entities.partySize} travellers`, value:'Adjacent seats in one row'},
    {label:'Extra baggage', value:'1 bag up to 23 kg'},
  ];
  return `<dl class="technology-rules">${rows.map(rule => `<div><dt>${escape(rule.label)}</dt><dd>${escape(rule.value)}</dd></div>`).join('')}</dl>`;
}
function result(example, key) {
  if (key === 'flexibility') {
    const offer = example.offer;
    if (!offer) return '<p class="technology-empty">No compatible seat available.</p>';
    return `<p class="technology-context">${durationLabel(example.flight.durationMinutes)} flight</p>
      <div class="technology-seat-swap" aria-label="Proposed change from ${escape(offer.before.id)} ${escape(offer.before.type)} to ${escape(offer.after.id)} ${escape(offer.after.type)}">
        <div><strong>${escape(offer.before.id)}</strong><span>${capitalize(offer.before.type)}</span></div>
        ${arrow}<div><strong>${escape(offer.after.id)}</strong><span>${capitalize(offer.after.type)}</span></div>
      </div><p class="technology-outcome">+${offer.reward} credits</p><p class="technology-context">Another traveller needs the aisle.</p>`;
  }
  const match = example.arrangement;
  if (!match) return '<p class="technology-empty">No complete arrangement available.</p>';
  const seating = match.services.find(service => service.kind === 'seats-together');
  const baggage = match.services.find(service => service.kind === 'extra-bag');
  return `<div class="technology-family-row" aria-label="Three adjacent seats">${seating.seats.map(seat => `<span>${escape(seat)}</span>`).join('')}</div>
    <p class="technology-context">Together, with ${baggage.pieces} extra checked bag</p><p class="technology-outcome">${match.total} credits</p>`;
}
function panel(example, key, selected) {
  return `<div class="technology-panel" id="technology-panel-${key}" role="tabpanel" aria-labelledby="technology-tab-${key}" tabindex="0"${selected ? '' : ' hidden'}>
    <div class="technology-flow">
      <section class="technology-source"><h3><span>01</span>${key === 'flexibility' ? 'Your preference' : 'Your request'}</h3><blockquote class="technology-quote">“${escape(example.words)}”</blockquote></section>
      <section class="technology-interpretation"><h3><span>02</span>AI interpretation</h3>${rules(example,key)}</section>
      <section class="technology-result"><h3><span>03</span>${key === 'flexibility' ? 'Matched offer' : 'Matched arrangement'}</h3>${result(example,key)}</section>
    </div>
  </div>`;
}
if (mount) {
  const examples = technologyExamples();
  mount.innerHTML = `<div class="technology-tabs" role="tablist" aria-label="Matching examples"><button type="button" id="technology-tab-flexibility" role="tab" aria-controls="technology-panel-flexibility" aria-selected="true" tabindex="0">Seat flexibility</button><button type="button" id="technology-tab-request" role="tab" aria-controls="technology-panel-request" aria-selected="false" tabindex="-1">Travel request</button></div>${panel(examples.flexibility,'flexibility',true)}${panel(examples.request,'request',false)}`;
  const tabs = [...mount.querySelectorAll('[role="tab"]')];
  const panels = [...mount.querySelectorAll('[role="tabpanel"]')];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let animations = [];
  function selectTab(tab, keyboard = false) {
    if (tab.getAttribute('aria-selected') === 'true') return;
    animations.forEach(animation => animation.cancel());
    animations = [];
    tabs.forEach(item => {
      const selected = item === tab;
      item.setAttribute('aria-selected', String(selected));
      item.tabIndex = selected ? 0 : -1;
    });
    const target = document.getElementById(tab.getAttribute('aria-controls'));
    panels.forEach(item => { item.hidden = item !== target; });
    if (!keyboard && !reduced.matches && document.documentElement.dataset.keyboard !== 'true') {
      target.querySelectorAll('.technology-flow > section').forEach((section,i) => {
        const animation = section.animate([{opacity:0,transform:'translateY(5px)'},{opacity:1,transform:'translateY(0)'}],{duration:220,delay:i*50,easing:'cubic-bezier(.23,1,.32,1)',fill:'backwards'});
        animation.finished.catch(() => {});
        animations.push(animation);
      });
    }
  }
  tabs.forEach((tab,index) => {
    tab.addEventListener('click',event => selectTab(tab,event.detail === 0));
    tab.addEventListener('keydown',event => {
      const next = {ArrowRight:(index+1)%tabs.length,ArrowLeft:(index-1+tabs.length)%tabs.length,Home:0,End:tabs.length-1}[event.key];
      if (next === undefined) return;
      event.preventDefault();selectTab(tabs[next],true);tabs[next].focus({preventScroll:true});
    });
  });
  reduced.addEventListener('change',() => { if (reduced.matches) animations.forEach(animation => animation.cancel()); });
}
