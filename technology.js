import { technologyExamples, capitalize, durationLabel, expiryLabel } from './technology.mjs?v=20261004-fixed2';

const mount = document.getElementById('technology-visual');
const arrow = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6"/></svg>';
const check = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>';
const bag = '<svg viewBox="0 0 32 36" aria-hidden="true"><rect x="5" y="9" width="22" height="24" rx="3"/><path d="M11 9V5a5 5 0 0 1 10 0v4M11 16v10m10-10v10"/></svg>';
const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));

function source(example, key) {
  return `<blockquote class="technology-quote">${example.phrases.map((phrase, index) =>
    `<button type="button" class="technology-clause" data-clause="${index}" data-rules="${phrase.rules.join(' ')}" aria-describedby="${phrase.rules.map(id => `technology-${key}-${id}`).join(' ')}" aria-pressed="false">${index === 0 ? '<span aria-hidden="true">“</span>' : ''}${escape(phrase.text)}${index === example.phrases.length - 1 ? '<span aria-hidden="true">”</span>' : ''}</button>`
  ).join(' ')}</blockquote><p class="technology-source-note">Select a phrase to see what it means.</p>`;
}

function rules(example, key) {
  return `<dl class="technology-rules">${example.rules.map(rule => `<div id="technology-${key}-${rule.id}" data-rule="${rule.id}"><dt>${escape(rule.label)}</dt><dd>${escape(rule.value)}${rule.detail ? `<small>${escape(rule.detail)}</small>` : ''}</dd></div>`).join('')}</dl>`;
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
    <div class="technology-family-row" aria-label="Consecutive seats ${seat.seats.map(escape).join(', ')} in the same row">${seat.seats.map(id => `<span class="${id === seat.travellerSeat ? 'is-yours' : ''}">${escape(id)}</span>`).join('')}</div>
    <div class="technology-service-line"><span>Three seats together</span><strong>${seat.creditPrice} credits</strong></div>
    <div class="technology-service-line technology-baggage">${bag}<span>${baggage.pieces} extra checked bag<small>Airline product · Up to ${baggage.maxKg} kg</small></span><strong>${baggage.creditPrice} credits</strong></div>
    <div class="technology-result-line">${check}<span>Every condition met <strong>${match.total} Flex credits</strong></span></div>
    <p class="technology-result-note">Matches the fixed platform quote you review before publishing.</p>`;
}

function terms(example) {
  return `<aside class="technology-terms" aria-label="Platform quote and publication terms"><p>Platform quote, shown before you publish</p><strong>${example.quote.quotedCredits} Flex credits</strong><span>${example.terms.allowPartial ? 'Changes may be arranged separately' : 'Both changes together'}</span><span>Valid until ${escape(expiryLabel(example.terms.validUntil))}</span></aside>`;
}

function structuredCode(value, label) {
  return `<pre class="technology-code" tabindex="0" aria-label="${escape(label)}"><code>${escape(JSON.stringify(value, null, 2))}</code></pre>`;
}

function details(example, key) {
  const content = key === 'flexibility'
    ? `<div><h4>Structured preference</h4>${structuredCode(example.structured, 'Illustrated seat preference rules')}</div>
       <div><h4>A condition the matcher can evaluate</h4><p>Flight duration selects the applicable rule. At 105 minutes, window, middle and aisle seats are permitted. Above 240 minutes, only an aisle seat qualifies.</p></div>
       <div><h4>Deterministic validation</h4><p>The matcher requires a different seat on the same flight, an active request for your current seat type, a permitted replacement and an open change window. An eligible result still needs your acceptance.</p></div>`
    : `<div><h4>Resolved booking</h4>${structuredCode(example.structured.entities, 'Resolved journey and traveller identifiers')}</div>
       <div><h4>Machine-readable conditions</h4>${structuredCode(example.structured.conditions, 'Exact seating and baggage conditions')}<p>Adjacent means consecutive seats in one row and one seat block.</p></div>
       <div><h4>Deterministic validation</h4><p>The matcher verifies all three booked travellers, seat adjacency, supplier confirmation and the exact baggage product.</p><p>Each service must match the fixed quote. The quote and request must be valid, the balance must cover 360 credits and both changes must be available together.</p><p class="technology-detail-note">AI resolves the request for your review. The matcher checks the resolved fields against the booking and available services.</p></div>`;
  return `<details class="technology-details"><summary><span>See structured rules and checks</span><span class="technology-plus" aria-hidden="true"></span></summary><div class="technology-detail-content">${content}</div></details>`;
}

function panel(example, key, selected) {
  return `<div class="technology-panel" id="technology-panel-${key}" role="tabpanel" aria-labelledby="technology-tab-${key}" tabindex="0"${selected ? '' : ' hidden'}>
    <div class="technology-flow">
      <section class="technology-region technology-source" aria-labelledby="technology-${key}-source-title"><h3 id="technology-${key}-source-title">Your words<span class="technology-connector">${arrow}</span></h3>${source(example, key)}</section>
      <section class="technology-region technology-interpretation" aria-labelledby="technology-${key}-interpretation-title"><h3 id="technology-${key}-interpretation-title">AI resolves<span class="technology-connector">${arrow}</span></h3>${rules(example, key)}<p class="technology-interpretation-note">${key === 'flexibility' ? 'Preferences you review and save.' : 'Flight and party from your booking. You review the resolved request.'}</p></section>
      <section class="technology-region technology-result" aria-labelledby="technology-${key}-result-title"><h3 id="technology-${key}-result-title">Matcher validates</h3>${key === 'flexibility' ? seatResult(example) : requestResult(example)}</section>
    </div>
    ${key === 'request' ? terms(example) : ''}
    ${details(example, key)}
  </div>`;
}

if (mount) {
  const examples = technologyExamples();
  mount.innerHTML = `<div class="technology-tabs" role="tablist" aria-label="Matching examples"><button type="button" id="technology-tab-flexibility" role="tab" aria-controls="technology-panel-flexibility" aria-selected="true" tabindex="0">Seat flexibility</button><button type="button" id="technology-tab-request" role="tab" aria-controls="technology-panel-request" aria-selected="false" tabindex="-1">Travel request</button></div>${panel(examples.flexibility, 'flexibility', true)}${panel(examples.request, 'request', false)}<p class="technology-disclosure">Prepared illustration with synthetic bookings. The AI interpretation is authored. Matching is computed from the example data.</p>`;

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
