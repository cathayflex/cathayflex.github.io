import { technologyExamples, capitalize, durationLabel, expiryLabel } from './technology.mjs';

const mount = document.getElementById('technology-visual');
const arrow = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6"/></svg>';
const check = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>';
const bag = '<svg viewBox="0 0 32 36" aria-hidden="true"><rect x="5" y="9" width="22" height="24" rx="3"/><path d="M11 9V5a5 5 0 0 1 10 0v4M11 16v10m10-10v10"/></svg>';
const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));

function source(example, key) {
  return `<blockquote class="technology-quote">${example.clauses.map((clause, index) => {
    const rules = key === 'flexibility' ? [`seat-${index}`] : index === 0 ? ['journey', 'seats', 'bag'] : ['limit'];
    return `<button type="button" class="technology-clause" data-clause="${index}" data-rules="${rules.join(' ')}" aria-describedby="${rules.map(id => `technology-${key}-${id}`).join(' ')}" aria-pressed="false">${index === 0 ? '<span aria-hidden="true">“</span>' : ''}${escape(clause)}${index === example.clauses.length - 1 ? '<span aria-hidden="true">”</span>' : ''}</button>`;
  }).join(' ')}</blockquote>`;
}

function rules(example, key) {
  return `<dl class="technology-rules">${example.rules.map(rule => `<div id="technology-${key}-${rule.id}" data-rule="${rule.id}"><dt>${escape(rule.label)}</dt><dd>${escape(rule.value)}</dd></div>`).join('')}</dl>`;
}

function seatResult(example) {
  const offer = example.offer;
  if (!offer) return '<div class="technology-no-match"><h4>No eligible exchange</h4><p>The available seats do not meet every condition.</p></div>';
  return `<div class="technology-match-context">${durationLabel(example.flight.durationMinutes)} flight <span>Same flight</span></div>
    <div class="technology-seat-swap" aria-label="An eligible exchange from ${escape(offer.before.id)} ${escape(offer.before.type)} to ${escape(offer.after.id)} ${escape(offer.after.type)}">
      <div><strong>${escape(offer.before.id)}</strong><span>${capitalize(offer.before.type)}</span></div>
      <span class="technology-swap-arrows" aria-hidden="true">${arrow}${arrow}</span>
      <div><strong>${escape(offer.after.id)}</strong><span>${capitalize(offer.after.type)}</span></div>
    </div>
    <p class="technology-match-reason">Another traveller has requested the ${escape(offer.before.type)}.</p>
    <div class="technology-result-line">${check}<span>Eligible offer <strong>${offer.reward} Flex credits</strong></span></div>
    <p class="technology-result-note">You decide whether to accept.</p>`;
}

function requestResult(example) {
  const match = example.arrangement;
  if (!match) return '<div class="technology-no-match"><h4>No eligible arrangement</h4><p>The available services do not meet all the published terms.</p></div>';
  const seat = match.services.find(service => service.kind === 'seats-together');
  const baggage = match.services.find(service => service.kind === 'extra-bag');
  return `<p class="technology-match-context">One eligible arrangement</p>
    <div class="technology-family-row" aria-label="Adjacent seats ${seat.seats.map(escape).join(', ')}">${seat.seats.map(id => `<span class="${id === seat.travellerSeat ? 'is-yours' : ''}">${escape(id)}</span>`).join('')}</div>
    <div class="technology-service-line"><span>Seats together</span><strong>${seat.creditPrice}</strong></div>
    <div class="technology-service-line technology-baggage">${bag}<span>${baggage.pieces} extra checked bag<small>Airline product · Up to ${baggage.maxKg} kg</small></span><strong>${baggage.creditPrice}</strong></div>
    <div class="technology-result-line">${check}<span>Within your limit <strong>${match.total} Flex credits</strong></span></div>
    <p class="technology-result-note">Every change must fit the agreed terms.</p>`;
}

function terms(example) {
  return `<aside class="technology-terms" aria-label="Terms separately confirmed by the traveller"><p>Separately confirmed at publication</p><span>${example.terms.maxCredits} credit limit</span><span>${example.terms.allowPartial ? 'Changes may be arranged separately' : 'Both changes together'}</span><span>Until ${escape(expiryLabel(example.terms.validUntil))}</span></aside>`;
}

function details(key) {
  const checks = key === 'flexibility' ? [
    ['Applicable flexibility', 'The flight duration selects the relevant seat rule. A longer flight keeps the aisle requirement.'],
    ['A matching request', 'The other traveller has an active aisle request for this flight.'],
    ['Booking and consent', 'Seat eligibility, capacity and existing reservations are checked. Your saved flexibility still requires you to accept an offer.'],
  ] : [
    ['Seats and baggage', 'The seats must keep the booked party together. The airline must have exactly the requested extra baggage available.'],
    ['Published limits', 'The combined cost must fit the authorized credit cap and available balance before the request expires. Both changes must be arranged together.'],
    ['Booking and consent', 'Every affected traveller must have accepted the arrangement or authorized the exact change in a request. Credits settle after the booking changes are verified.'],
  ];
  return `<details class="technology-details"><summary><span>What the engine checks</span><span class="technology-plus" aria-hidden="true"></span></summary><div class="technology-detail-content">${checks.map(([heading, copy]) => `<div><h4>${heading}</h4><p>${copy}</p></div>`).join('')}</div></details>`;
}

function panel(example, key, selected) {
  return `<div class="technology-panel" id="technology-panel-${key}" role="tabpanel" aria-labelledby="technology-tab-${key}" tabindex="0"${selected ? '' : ' hidden'}>
    <div class="technology-flow">
      <section class="technology-region technology-source" aria-labelledby="technology-${key}-source-title"><h3 id="technology-${key}-source-title">Your words<span class="technology-connector">${arrow}</span></h3>${source(example, key)}</section>
      <section class="technology-region technology-interpretation" aria-labelledby="technology-${key}-interpretation-title"><h3 id="technology-${key}-interpretation-title">AI interpretation<span class="technology-connector">${arrow}</span></h3>${rules(example, key)}<p class="technology-interpretation-note">${key === 'flexibility' ? 'Preferences you review and save.' : 'Interpreted for your review.'}</p></section>
      <section class="technology-region technology-result" aria-labelledby="technology-${key}-result-title"><h3 id="technology-${key}-result-title">Matching engine</h3>${key === 'flexibility' ? seatResult(example) : requestResult(example)}</section>
    </div>
    ${key === 'request' ? terms(example) : ''}
    ${details(key)}
  </div>`;
}

if (mount) {
  const examples = technologyExamples();
  mount.innerHTML = `<div class="technology-tabs" role="tablist" aria-label="Matching examples"><button type="button" id="technology-tab-flexibility" role="tab" aria-controls="technology-panel-flexibility" aria-selected="true" tabindex="0">Seat flexibility</button><button type="button" id="technology-tab-request" role="tab" aria-controls="technology-panel-request" aria-selected="false" tabindex="-1">Travel request</button></div>${panel(examples.flexibility, 'flexibility', true)}${panel(examples.request, 'request', false)}<p class="technology-disclosure">Prepared examples illustrating AI interpretation and matching.</p>`;

  const tabs = [...mount.querySelectorAll('[role="tab"]')];
  const panels = [...mount.querySelectorAll('[role="tabpanel"]')];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let activeAnimation;
  function selectTab(tab, keyboard = false) {
    if (tab.getAttribute('aria-selected') === 'true') return;
    activeAnimation?.cancel();
    tabs.forEach(item => {
      const selected = item === tab;
      item.setAttribute('aria-selected', String(selected));
      item.tabIndex = selected ? 0 : -1;
    });
    const target = document.getElementById(tab.getAttribute('aria-controls'));
    panels.forEach(item => { item.hidden = item !== target; });
    if (!keyboard && !reduced.matches && target.animate && document.documentElement.dataset.keyboard !== 'true') {
      activeAnimation = target.animate([{opacity: 0, transform: 'translateY(4px)'}, {opacity: 1, transform: 'translateY(0)'}], {duration: 220, easing: 'cubic-bezier(.23,1,.32,1)'});
      activeAnimation.finished.catch(() => {});
    }
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', event => selectTab(tab, event.detail === 0));
    tab.addEventListener('keydown', event => {
      const next = {ArrowRight: (index + 1) % tabs.length, ArrowLeft: (index - 1 + tabs.length) % tabs.length, Home: 0, End: tabs.length - 1}[event.key];
      if (next === undefined) return;
      event.preventDefault();
      selectTab(tabs[next], true);
      tabs[next].focus({preventScroll: true});
    });
  });
  panels.forEach(current => {
    const clauses = [...current.querySelectorAll('.technology-clause')];
    const interpreted = [...current.querySelectorAll('[data-rule]')];
    function highlight(button) {
      const ids = button?.dataset.rules.split(' ') || [];
      clauses.forEach(item => {
        const selected = item === button;
        item.classList.toggle('is-highlighted', selected);
        item.setAttribute('aria-pressed', String(selected));
      });
      interpreted.forEach(item => item.classList.toggle('is-highlighted', ids.includes(item.dataset.rule)));
    }
    clauses.forEach(button => {
      button.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse') highlight(button); });
      button.addEventListener('focus', () => highlight(button));
      button.addEventListener('click', () => highlight(button));
    });
    current.querySelector('.technology-source').addEventListener('pointerleave', () => {
      if (!clauses.includes(document.activeElement)) highlight(null);
    });
    current.addEventListener('focusout', event => {
      if (!clauses.includes(event.relatedTarget)) highlight(null);
    });
  });
  reduced.addEventListener('change', () => { if (reduced.matches) activeAnimation?.cancel(); });
}
