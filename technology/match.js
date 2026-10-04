import { prepareExample, commitExample, reconcileExample, walletSummary } from './lab.mjs?v=397fc4d8318a';

const root = document.getElementById('matching-visual');
const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const bagIcon = '<img src="../assets/resources/checked-baggage.svg" width="28" height="28" alt="" aria-hidden="true">';

if (root) {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const sessions = new Map();
  let scenario = 'ready';
  let view = 'current';
  let animations = [];
  let pointerControl = null;

  root.innerHTML = `<div class="match-surface">
    <div class="match-toolbar"><div><span class="match-flight" id="matching-flight"></span><h3>Seats together. One extra bag.</h3></div><label class="match-availability" for="matching-availability"><span class="sr-only">Resource availability</span><select id="matching-availability"><option value="ready">Resources available</option><option value="bag-full">Extra bag unavailable</option><option value="expired">Request expired</option></select></label></div>
    <div class="match-body">
      <div class="match-booking"><div class="match-switch" role="group" aria-label="Compare seating"><button type="button" id="matching-current" data-view="current">Current seats</button><button type="button" id="matching-proposed" data-view="proposed">Matching plan</button></div><div id="matching-map" class="match-map"></div><p class="match-map-caption" id="matching-map-caption"></p></div>
      <div class="match-outcome" id="matching-outcome"></div>
    </div>
    <div class="match-footer"><div class="match-wallet" id="matching-wallet" aria-label="Lin’s Flex credits"></div><div class="match-action-area"><button type="button" class="match-action" id="matching-confirm">See the arrangement <span aria-hidden="true">→</span></button><span id="matching-state" class="match-state"></span></div></div>
  </div><p class="sr-only" id="matching-announcement" role="status" aria-live="polite" aria-atomic="true"></p>`;

  const element = id => root.querySelector(`#matching-${id}`);
  const session = () => {
    if (!sessions.has(scenario)) sessions.set(scenario, {example: prepareExample(scenario), execution: null});
    return sessions.get(scenario);
  };
  const reportError = message => {
    element('state').textContent = message;
    element('announcement').textContent = message;
    element('confirm').disabled = true;
    element('confirm').hidden = true;
  };
  const stateOf = current => current.execution?.state ?? current.example.state;
  const resource = (state, id) => state.resources.find(entry => entry.id === id);
  const personName = (state, person) => state.people.find(entry => entry.id === person)?.name.split(' ')[0] ?? person;
  const seatName = (state, id) => resource(state, id)?.label.match(/\b\d{1,3}[A-Z]\b/)?.[0] ?? 'Unassigned';
  const allocationFor = (state, person) => state.allocations.find(allocation => allocation.person === person && resource(state, allocation.resource)?.kind === 'seat' && allocation.journeyId === 'story-tokyo');

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
      return `<div class="match-seat ${moving ? `match-seat-${occupant.person === 'A' ? 'lin' : 'daniel'}` : 'match-seat-family'}"><span class="match-seat-number">${escape(seatName(shownState, id))}</span><strong>${escape(name)}</strong></div>`;
    };
    return `<div class="match-seat-grid" role="img" aria-label="${escape(['hnd-32A', 'hnd-32B', 'hnd-32C', 'hnd-34C'].map(id => `${seatName(shownState, id)} ${personName(shownState, allocations.find(allocation => allocation.resource === id)?.person ?? 'Available')}`).join(', '))}"><span class="match-row-label">32</span>${tile('hnd-32A')}${tile('hnd-32B')}${tile('hnd-32C')}<span class="match-row-label">34</span><span class="match-seat-gap" aria-hidden="true"></span><span class="match-seat-gap" aria-hidden="true"></span>${tile('hnd-34C')}<span class="match-aisle" aria-hidden="true">Aisle</span></div>`;
  }

  function render(announce = false, animate = false) {
    animations.forEach(animation => animation.cancel());
    const previousSeats = animate && !reducedMotion.matches
      ? ['lin', 'daniel'].map(person => [person, element('map').querySelector(`.match-seat-${person}`)?.getBoundingClientRect()])
      : [];
    const current = session();
    const {example, execution} = current;
    const state = stateOf(current);
    const settled = execution?.contract.status === 'SETTLED';
    const showingResult = view === 'proposed' && Boolean(example.chosen);
    const quote = example.request.authorization.quote;
    const bagLine = quote.lineItems.find(line => line.kind === 'baggage');
    const seatLine = quote.lineItems.find(line => line.kind === 'seat');
    const bag = resource(state, bagLine.resourceIds[0]);
    const wallet = walletSummary(state);
    const journey = state.journeys.find(entry => entry.id === example.request.scope.journeyId);
    const danielCredits = execution?.contract.credits.C ?? example.chosen?.credits.C ?? seatLine.credits;
    const nextDanielSeat = execution ? allocationFor(execution.state, 'C').resource : example.chosen?.changes.find(change => change.key === allocationFor(example.state, 'C').key)?.to;
    const title = settled ? 'Booking confirmed' : example.chosen ? showingResult ? 'The family sits together.' : 'A complete plan is available.' : scenario === 'expired' ? 'Request expired.' : 'Waiting for an extra bag.';
    const explanation = settled ? 'Seats and baggage are confirmed.' : example.chosen ? showingResult ? 'Lin joins Mia and Jamie in row 32.' : 'One seat exchange brings the family together.' : scenario === 'expired' ? 'The credit hold has been released.' : 'The request includes both seats and baggage.';

    element('flight').textContent = `Lin’s request for ${journey.flightNumber} to ${journey.destination}`;
    element('current').textContent = settled ? 'Original seats' : 'Current seats';
    element('proposed').textContent = settled ? 'Confirmed seats' : 'Matching plan';
    element('proposed').disabled = !example.chosen;
    for (const button of root.querySelectorAll('[data-view]')) button.setAttribute('aria-pressed', String(button.dataset.view === (example.chosen ? view : 'current')));
    element('map').innerHTML = seatMap(current, showingResult);
    element('map-caption').textContent = showingResult ? 'Lin, Mia and Jamie together' : 'Lin is two rows behind Mia and Jamie';
    element('outcome').innerHTML = `<h3>${title}</h3><p>${explanation}</p>
      ${example.chosen ? `<div class="match-benefit"><span class="match-outcome-symbol" aria-hidden="true">⇄</span><div><strong>Daniel keeps an aisle</strong><small>Seat ${escape(seatName(state, nextDanielSeat))}</small><small>+${danielCredits} credits</small></div></div>` : ''}
      <div class="match-benefit ${!example.chosen ? 'match-benefit-muted' : ''}">${bagIcon}<div><strong>${bagLine.quantity} extra checked bag</strong><small>Up to ${bag.baggage.maxKg} kg</small><small>${settled ? 'Confirmed' : scenario === 'expired' ? 'Request closed' : scenario === 'bag-full' ? 'Currently unavailable' : 'Available'}</small></div></div>`;
    element('wallet').innerHTML = settled ? `<span>Remaining balance</span><strong>${wallet.balance}<small> credits</small></strong>` : `<span>${scenario === 'expired' ? 'Available balance' : 'Approved total'}</span><strong>${scenario === 'expired' ? wallet.available : quote.debit}<small> credits</small></strong>`;
    element('confirm').hidden = !example.chosen;
    element('confirm').disabled = false;
    element('confirm').classList.toggle('match-action-reset', settled);
    element('confirm').innerHTML = settled ? 'Replay <span aria-hidden="true">↻</span>' : showingResult ? 'Daniel accepts <span aria-hidden="true">→</span>' : 'See the arrangement <span aria-hidden="true">→</span>';
    element('state').textContent = !example.chosen && scenario !== 'expired' ? 'Request open' : '';
    root.dataset.state = settled ? 'confirmed' : example.chosen ? 'proposed' : scenario;
    renderCandidates(example, settled);
    if (announce) element('announcement').textContent = `${title} ${explanation} ${settled ? `Daniel earned ${danielCredits} credits. Lin has ${wallet.balance} remaining.` : ''}`;
    if (animate && !reducedMotion.matches) {
      animations = previousSeats.flatMap(([person, before]) => {
        const seat = element('map').querySelector(`.match-seat-${person}`);
        if (!before || !seat) return [];
        const after = seat.getBoundingClientRect();
        const x = before.x - after.x;
        const y = before.y - after.y;
        return x || y ? [seat.animate([{transform: `translate(${x}px, ${y}px)`}, {transform: 'translate(0, 0)'}], {duration: 280, easing: 'cubic-bezier(.23,1,.32,1)'})] : [];
      });
    }
  }

  function renderCandidates(example, settled) {
    const target = document.getElementById('matching-diagnostics');
    if (!target) return;
    const options = example.candidates.filter(candidate => candidate.changes.some(change => example.state.allocations.find(entry => entry.key === change.key)?.person === 'A'));
    target.innerHTML = options.length ? `<div class="candidate-comparison">${options.map(candidate => {
      const kinds = candidate.changes.filter(change => example.state.allocations.find(entry => entry.key === change.key)?.person === 'A').map(change => resource(example.state, change.to)?.kind);
      const seats = kinds.includes('seat');
      const bags = kinds.includes('baggage');
      const selected = example.result.selected.includes(candidate.id);
      return `<div class="candidate-option ${selected ? 'candidate-selected' : ''}"><span>${selected ? '✓' : '○'}</span><strong>${seats && bags ? 'Seats + bag' : seats ? 'Seats only' : 'Bag only'}</strong><p>${selected ? settled ? 'Confirmed arrangement' : 'Fulfils the complete request' : seats && !bags ? 'Missing the extra bag' : bags && !seats ? 'Family remains separated' : 'Bag unavailable'}</p></div>`;
    }).join('')}</div>` : '<p class="method-limit">The expired request is closed and generates no new plan.</p>';
  }

  root.addEventListener('pointerdown', event => { pointerControl = event.target.closest('select, button'); });
  root.addEventListener('keydown', () => { pointerControl = null; });
  reducedMotion.addEventListener('change', () => animations.forEach(animation => animation.cancel()));
  element('availability').addEventListener('change', event => {
    scenario = event.target.value;
    view = 'current';
    try { render(true, pointerControl === event.target); }
    catch { reportError('Unable to load this arrangement. Try another availability option.'); }
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
      if (current.execution?.contract.status === 'SETTLED') { sessions.delete(scenario); view = 'current'; }
      else if (view === 'current') view = 'proposed';
      else current.execution = commitExample(current.example);
      render(true, Boolean(event.detail));
    } catch { reportError('Unable to complete this arrangement. Reload to try again.'); }
  });
  try { render(); }
  catch { reportError('Unable to load the example. Please reload.'); }
}

const recoveryRoot = document.getElementById('confirmation-recovery');
if (recoveryRoot) {
  let example = prepareExample('ready');
  let execution = null;
  recoveryRoot.classList.add('confirmation-recovery');
  recoveryRoot.innerHTML = '<div id="recovery-process"></div><div class="recovery-demo-action"><button type="button" id="recovery-action">Interrupt a booking reply</button><p id="recovery-announcement" class="sr-only" role="status" aria-live="polite"></p></div>';
  const element = id => recoveryRoot.querySelector(`#recovery-${id}`);
  function renderRecovery() {
    const state = execution?.state ?? example.state;
    const settled = execution?.contract.status === 'SETTLED';
    const entries = execution ? state.ledger.filter(entry => entry.contract === execution.contract.contractId) : [];
    const bagAssigned = state.allocations.some(entry => entry.person === 'A' && entry.resource === 'tokyo-extra-bag');
    const status = !execution ? 'Recovery after an interrupted booking response' : settled ? 'Booking recovered. Credits settled once.' : 'Seats changed. The confirmation reply was lost.';
    element('process').innerHTML = `<p class="recovery-demo-status">${status}</p><ol class="recovery-demo-steps"><li><span>${execution ? '✓' : '○'}</span><div><strong>Seat exchange</strong><p>${!execution ? 'Ready' : settled ? 'Verified against booking' : 'Recorded by the airline'}</p></div></li><li><span>${bagAssigned ? '✓' : '○'}</span><div><strong>Extra bag</strong><p>${bagAssigned ? 'Confirmed' : execution ? 'Awaiting seat verification' : 'Ready'}</p></div></li><li><span>${entries.length ? '✓' : '○'}</span><div><strong>Settlement</strong><p>${entries.length ? `${entries.length} completed transaction` : '360 credits held'}</p></div></li></ol>`;
    element('action').textContent = !execution ? 'Interrupt a booking reply' : settled ? 'Replay recovery' : 'Verify booking and finish';
  }
  element('action').addEventListener('click', () => {
    try {
      if (execution?.contract.status === 'SETTLED') { example = prepareExample('ready'); execution = null; }
      else execution = execution ? reconcileExample(execution) : commitExample(example, 'after_write');
      renderRecovery();
      element('announcement').textContent = !execution ? 'Recovery example ready.' : execution.contract.status === 'SETTLED' ? 'The seats and bag are confirmed. Credits were settled once.' : 'Seat changes are recorded. The bag is waiting and credits remain reserved.';
    } catch (error) { element('announcement').textContent = error.message; }
  });
  renderRecovery();
}
