import { prepareExample, commitExample, reconcileExample, staleExample, walletSummary, bookSnapshot } from './lab.mjs?v=aa3b57dabe77';

const root = document.getElementById('matching-visual');
const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const json = (value, label) => `<pre class="match-code" tabindex="0" aria-label="${escape(label)}"><code>${escape(JSON.stringify(value, null, 2))}</code></pre>`;
const bagIcon = '<svg viewBox="0 0 28 32" fill="none" aria-hidden="true"><rect x="4.5" y="7.5" width="19" height="20" rx="3"/><path d="M10 7V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v3M10 13v9m8-9v9M9 28v2m10-2v2"/></svg>';

if (root) {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const sessions = new Map();
  let scenario = 'ready';
  let view = 'proposed';
  let animation;
  let pointerControl = null;

  root.innerHTML = `<div class="match-surface">
    <div class="match-toolbar"><span class="match-flight" id="matching-flight"></span><label class="match-availability" for="matching-availability"><span>Availability</span><select id="matching-availability"><option value="ready">Resources available</option><option value="bag-full">Extra bag unavailable</option><option value="expired">Request expired</option></select></label></div>
    <div class="match-request"><p id="matching-request"></p><span id="matching-quote"></span></div>
    <div class="match-body">
      <div class="match-booking"><div class="match-switch" role="group" aria-label="Compare seating"><button type="button" id="matching-current" data-view="current">Current booking</button><button type="button" id="matching-proposed" data-view="proposed">Proposed match</button></div><div id="matching-map" class="match-map"></div><p class="match-map-caption" id="matching-map-caption"></p></div>
      <div class="match-outcome" id="matching-outcome"></div>
    </div>
    <div class="match-footer"><div class="match-wallet" id="matching-wallet" aria-label="Lin’s Flex credits"></div><div class="match-action-area"><button type="button" class="match-action" id="matching-confirm">Daniel accepts <span aria-hidden="true">→</span></button><span id="matching-state" class="match-state"></span></div></div>
  </div>
  <p class="match-announcement" id="matching-announcement" role="status" aria-live="polite" aria-atomic="true"></p>
  <details class="match-explore" id="matching-decisions"><summary>Explore the matching decisions <span aria-hidden="true">+</span></summary><div id="matching-diagnostics" class="match-diagnostics"></div></details>
  <p class="match-fixture">Computed example · Synthetic bookings</p>`;

  const element = id => root.querySelector(`#matching-${id}`);
  const session = () => {
    if (!sessions.has(scenario)) sessions.set(scenario, {example: prepareExample(scenario), execution: null, recovery: null});
    return sessions.get(scenario);
  };
  const stateOf = current => current.execution?.state ?? current.example.state;
  const personName = (state, person) => state.people.find(entry => entry.id === person)?.name.split(' ')[0] ?? person;
  const resource = (state, id) => state.resources.find(entry => entry.id === id);
  const seatName = (state, id) => resource(state, id)?.label.split(' · ')[0] ?? 'Unassigned';
  const allocationFor = (state, person) => state.allocations.find(allocation => allocation.person === person && resource(state, allocation.resource)?.kind === 'seat' && allocation.journeyId === 'story-tokyo');
  const trace = execution => `<ol class="match-trace">${execution.contract.log.map(line => `<li>${escape(line)}</li>`).join('')}</ol>`;

  function seatMap(current, showingResult) {
    const {example, execution} = current;
    const shownState = execution && showingResult ? execution.state : example.state;
    const allocations = shownState.allocations.map(allocation => {
      const change = !execution && showingResult ? example.chosen?.changes.find(entry => entry.key === allocation.key) : null;
      return change ? {...allocation, resource: change.to} : allocation;
    });
    const tile = id => {
      const occupant = allocations.find(allocation => allocation.resource === id);
      const name = occupant ? personName(shownState, occupant.person) : 'Available';
      const moving = occupant && ['A', 'C'].includes(occupant.person);
      return `<div class="match-seat ${moving ? `match-seat-${occupant.person === 'A' ? 'lin' : 'daniel'}` : 'match-seat-family'}"><span class="match-seat-number">${escape(seatName(shownState, id))}</span><strong>${escape(name)}</strong><span class="match-seat-position">${escape(resource(shownState, id)?.seatPosition)}</span></div>`;
    };
    return `<div class="match-seat-grid" role="img" aria-label="${escape(['hnd-32A', 'hnd-32B', 'hnd-32C', 'hnd-34C'].map(id => `${seatName(shownState, id)} ${personName(shownState, allocations.find(allocation => allocation.resource === id)?.person ?? 'Available')}`).join(', '))}"><span class="match-row-label">32</span>${tile('hnd-32A')}${tile('hnd-32B')}${tile('hnd-32C')}<span class="match-row-label">34</span><span class="match-seat-gap" aria-hidden="true"></span><span class="match-seat-gap" aria-hidden="true"></span>${tile('hnd-34C')}<span class="match-aisle" aria-hidden="true">Aisle</span></div>`;
  }

  function render(announce = false, animate = false) {
    const current = session();
    const {example, execution} = current;
    const state = stateOf(current);
    const settled = execution?.contract.status === 'SETTLED';
    const showingResult = view === 'proposed' && Boolean(example.chosen);
    const quote = example.request.authorization.quote;
    const bagLine = quote.lineItems.find(line => line.kind === 'baggage');
    const seatLine = quote.lineItems.find(line => line.kind === 'seat');
    const bag = resource(state, bagLine.resourceIds[0]);
    const assignedBag = state.allocations.some(allocation => allocation.person === 'A' && allocation.resource === bag.id);
    const freeBags = Math.max(0, bag.capacity - bag.background - bag.protected - state.allocations.filter(allocation => allocation.resource === bag.id).length);
    const wallet = walletSummary(state);
    const journey = state.journeys.find(entry => entry.id === example.request.scope.journeyId);
    const danielCredits = execution?.contract.credits.C ?? example.chosen?.credits.C ?? seatLine.credits;
    const originalDanielSeat = allocationFor(example.state, 'C').resource;
    const nextDanielSeat = execution ? allocationFor(execution.state, 'C').resource : example.chosen?.changes.find(change => change.key === allocationFor(example.state, 'C').key)?.to;
    const title = settled ? view === 'current' ? 'Confirmed changes.' : 'Together, confirmed.' : example.chosen ? view === 'current' ? 'Proposed changes.' : 'A complete match.' : scenario === 'expired' ? 'The request has expired.' : 'Waiting for the extra bag.';
    const bagStatus = assignedBag ? 'Confirmed' : scenario === 'expired' ? 'Request closed' : freeBags >= bagLine.quantity ? 'Available from airline inventory' : 'Unavailable from airline inventory';

    element('flight').textContent = `${journey.flightNumber} · ${journey.destination}`;
    element('request').innerHTML = `<strong>Lin’s request</strong> Seats together + ${bagLine.quantity} extra checked bag`;
    element('quote').textContent = settled ? 'Fulfilled' : scenario === 'expired' ? 'Authorization expired' : 'Approved by Lin';
    element('current').textContent = settled ? 'Original booking' : 'Current booking';
    element('proposed').textContent = settled ? 'Confirmed booking' : 'Proposed match';
    element('proposed').disabled = !example.chosen;
    for (const button of root.querySelectorAll('[data-view]')) button.setAttribute('aria-pressed', String(button.dataset.view === (example.chosen ? view : 'current')));
    element('map').innerHTML = seatMap(current, showingResult);
    element('map-caption').textContent = showingResult ? 'Mia and Jamie keep their seats. Lin joins them.' : 'Mia and Jamie sit together. Lin is two rows back.';
    element('outcome').innerHTML = `<div class="match-outcome-heading"><span class="match-status-dot ${example.chosen ? '' : 'match-status-wait'}" aria-hidden="true"></span><h3>${title}</h3></div>
      <div class="match-seat-outcome"><span class="match-outcome-symbol" aria-hidden="true">⇄</span><div><strong>${example.chosen ? `Daniel ${settled ? 'moved' : 'moves'} ${escape(seatName(state, originalDanielSeat))} → ${escape(seatName(state, nextDanielSeat))}` : 'The existing seats stay in place'}</strong><small>${example.chosen ? `Another aisle seat · ${settled ? 'Earned' : 'Earns'} ${danielCredits} credits` : scenario === 'expired' ? 'Request closed without a booking change' : 'Seats and bag stay in one request'}</small></div></div>
      <div class="match-bag-outcome ${freeBags < bagLine.quantity && !assignedBag ? 'match-bag-unavailable' : ''}">${bagIcon}<div><strong>${bagLine.quantity} extra bag <span>· ${bag.baggage.maxKg} kg</span></strong><small>${bagStatus}</small></div><span class="match-bag-check" aria-hidden="true">${assignedBag || (freeBags >= bagLine.quantity && scenario !== 'expired') ? '✓' : '○'}</span></div>
      <div class="match-price"><span>${settled ? 'Settled total' : 'Fixed total'}</span><strong>${quote.debit}<small> credits</small></strong><p>${seatLine.credits} for the seats + ${bagLine.credits} for the bag</p></div>`;
    element('wallet').innerHTML = `<span class="match-wallet-label">Lin’s credits</span><strong class="match-wallet-balance" data-wallet="balance">${wallet.balance}${!settled && example.chosen ? ` <span aria-hidden="true">→</span> <span class="match-wallet-projected">${wallet.balance + example.chosen.credits.A}</span>` : ''}</strong><span class="match-wallet-note">${settled ? `${-execution.contract.credits.A} used` : wallet.reserved ? `${wallet.reserved} reserved` : `${wallet.available} available`}</span>`;
    element('confirm').hidden = !example.chosen;
    element('confirm').classList.toggle('match-action-reset', settled);
    element('confirm').innerHTML = settled ? 'Start again <span aria-hidden="true">↻</span>' : 'Daniel accepts <span aria-hidden="true">→</span>';
    element('state').textContent = settled ? 'Booking confirmed' : example.chosen ? '' : scenario === 'expired' ? 'Reservation released' : 'No credits spent';
    root.dataset.state = settled ? 'confirmed' : example.chosen ? 'proposed' : scenario;
    renderDiagnostics(current);
    if (announce) element('announcement').textContent = `${title} ${settled ? `Daniel earned ${danielCredits} credits. Lin has ${wallet.balance} credits remaining.` : element('state').textContent}`;
    if (animate && !reducedMotion.matches) {
      animation?.cancel();
      animation = element('map').animate([{opacity: .5, transform: 'translateY(3px)'}, {opacity: 1, transform: 'translateY(0)'}], {duration: 220, easing: 'ease-out'});
    }
  }

  function renderDiagnostics(current) {
    const {example, execution} = current;
    const state = stateOf(current);
    const book = bookSnapshot(state);
    const request = book.requests.find(entry => entry.source.person === 'A' && entry.source.intentId === example.request.id);
    const permission = book.permissions.find(entry => entry.source.person === 'C');
    const contracts = book.contracts.filter(entry => entry.requestReferences.some(reference => reference.person === 'A' && reference.intentId === example.request.id));
    const open = new Set([...element('diagnostics').querySelectorAll('details[open]')].map(details => details.dataset.detail));
    const detail = (id, title, body) => `<details data-detail="${id}" ${open.has(id) ? 'open' : ''}><summary>${title}</summary>${body}</details>`;
    const valid = example.candidates.filter(candidate => !candidate.blocked.length);
    const status = entry => escape(entry?.status ?? 'Absent');
    element('diagnostics').innerHTML = `<p class="match-path">Published request → eligible complete arrangement → participant consent → verified settlement</p>
      ${detail('candidates', 'Candidates and exclusions', `<p>${example.candidates.length} arrangements generated · ${valid.length} pass validation${execution ? ' · Selection before confirmation' : ''}</p><ul class="match-candidates">${example.candidates.map(candidate => `<li><strong>${escape(candidate.title)}</strong><span>${escape(candidate.blocked.length ? candidate.blocked.join(' · ') : example.result.selected.includes(candidate.id) ? 'Selected as part of the preferred compatible combination.' : 'Eligible. Another compatible combination has the preferred objective.')}</span></li>`).join('') || '<li>The expired request supports no complete candidate.</li>'}</ul>`)}
      ${detail('book', 'Current conditional order book', `<div class="match-book-rows"><div><span>Lin’s request</span><strong>${status(request)}</strong><small>${request.funding.reserved} credits reserved · ${request.funding.spent} spent</small></div><div><span>Daniel’s flexibility</span><strong>${status(permission)}</strong><small>${contracts.some(contract => contract.accepted.includes('C')) ? 'Accepted for this arrangement' : 'Consent recorded per arrangement'}</small></div>${contracts.map(contract => `<div><span>Arrangement</span><strong>${status(contract)}</strong><small>${escape(contract.engineStatus)} · ${contract.awaitingConsent.length ? 'Awaiting participant consent' : 'Consent recorded'}</small></div>`).join('')}</div><p>Preferences guide proposals. A published request authorizes its exact quoted outcome.</p>${json({audit: book.audit, wallet: walletSummary(state), request, permission, contracts}, 'Current request, permission and arrangement records')}`)}
      ${detail('rules', 'Request rules and source evidence', json({source: example.request.sourceText, scope: example.request.scope, rules: example.request.rules, quote: example.request.authorization.quote, authorization: example.authorization}, 'Reviewed source, request rules and fixed quote'))}
      ${detail('bounds', 'Search bounds and state checks', `<p>${example.result.search.complete ? 'Selection is proven within this generated set.' : 'Selection reached its node limit.'} Generation is bounded by cycle length, bundle size and work limits. Computed in ${example.elapsed.toFixed(1)} ms in this browser.</p>${json({selection: example.result, invariants: execution?.checks ?? example.checks}, 'Bounded selection result and state invariants')}`)}
      ${example.chosen ? detail('stale', 'A companion’s booking changes', `<p>Mia’s unchanged seat is a dependency. Incrementing its allocation version produces this validation result.</p>${json(staleExample(example), 'Validation after a changed companion booking')}`) : ''}
      ${example.chosen ? detail('recovery', 'Recover a lost booking acknowledgement', '<p>This separate run writes the seats, loses the acknowledgement, and then verifies the authoritative booking state.</p><div id="matching-recovery"></div>') : ''}
      ${execution ? detail('settlement', 'Confirmation trace and ledger', `${trace(execution)}${json({wallet: walletSummary(state), ledger: state.ledger.filter(entry => entry.contract === execution.contract.contractId), checks: execution.checks}, 'Verified settlement and ledger')}`) : ''}`;
    renderRecovery(current);
  }

  function renderRecovery(current) {
    const target = element('recovery');
    if (!target) return;
    const execution = current.recovery;
    const settled = execution?.contract.status === 'SETTLED';
    target.innerHTML = `${execution ? `<p class="match-recovery-status">${settled ? 'Verified and settled once.' : 'Awaiting authoritative confirmation.'} Lin has ${walletSummary(execution.state).balance} total credits and ${walletSummary(execution.state).reserved} reserved.</p>${json({status: execution.contract.status, receipts: execution.contract.receipts, ledgerEntries: execution.state.ledger.filter(entry => entry.contract === execution.contract.contractId).length, checks: execution.checks}, 'Recovery transaction state')}` : ''}<button type="button" class="match-secondary" id="matching-recover">${!execution ? 'Run recovery test' : settled ? 'Run again' : 'Reconcile booking state'}</button><p class="match-recovery-live" id="matching-recovery-live" role="status" aria-live="polite"></p>`;
    element('recover').addEventListener('click', event => {
      try {
        current.recovery = execution && !settled ? reconcileExample(execution) : commitExample(current.example, 'after_write');
        renderRecovery(current);
        element('recovery-live').textContent = current.recovery.contract.status === 'SETTLED' ? 'Recovered and settled once.' : 'Acknowledgement lost. The credit reservation remains held.';
        if (!event.detail) element('recover').focus({preventScroll: true});
      } catch (error) { element('recovery-live').textContent = error.message; }
    });
  }

  root.addEventListener('pointerdown', event => { pointerControl = event.target.closest('select, button'); });
  root.addEventListener('keydown', () => { pointerControl = null; });
  element('availability').addEventListener('change', event => {
    scenario = event.target.value;
    view = 'proposed';
    try { render(true, pointerControl === event.target); }
    catch (error) { element('announcement').textContent = `The example could not complete. ${error.message}`; element('state').textContent = error.message; }
    pointerControl = null;
  });
  for (const button of root.querySelectorAll('[data-view]')) button.addEventListener('click', event => {
    view = button.dataset.view;
    render(false, Boolean(event.detail));
    element('announcement').textContent = `${button.textContent}. ${element('map-caption').textContent}`;
  });
  element('confirm').addEventListener('click', event => {
    const current = session();
    try {
      if (current.execution?.contract.status === 'SETTLED') sessions.delete(scenario);
      else current.execution = commitExample(current.example);
      view = 'proposed';
      render(true, Boolean(event.detail));
    } catch (error) { element('announcement').textContent = `The arrangement could not complete. ${error.message}`; element('state').textContent = error.message; }
  });
  try { render(); }
  catch (error) { element('announcement').textContent = `The example could not load. ${error.message}`; element('state').textContent = error.message; }
}
