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
  <details class="match-explore" id="matching-decisions"><summary><span class="match-disclosure-label"><strong id="matching-explanation-question">Why does this seat exchange work?</strong><small id="matching-explanation-preview">Check the seats, Daniel’s preferences and the extra bag.</small></span><span class="match-disclosure-icon" aria-hidden="true">+</span></summary><div id="matching-diagnostics" class="match-diagnostics"></div></details>
  <p class="match-fixture">Computed example · Synthetic bookings</p>`;

  const element = id => root.querySelector(`#matching-${id}`);
  const session = () => {
    if (!sessions.has(scenario)) sessions.set(scenario, {example: prepareExample(scenario), execution: null});
    return sessions.get(scenario);
  };
  const stateOf = current => current.execution?.state ?? current.example.state;
  const personName = (state, person) => state.people.find(entry => entry.id === person)?.name.split(' ')[0] ?? person;
  const resource = (state, id) => state.resources.find(entry => entry.id === id);
  const seatName = (state, id) => resource(state, id)?.label.split(' · ')[0] ?? 'Unassigned';
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
    const nextDanielSeat = execution ? allocationFor(execution.state, 'C').resource : example.chosen?.changes.find(change => change.key === allocationFor(example.state, 'C').key)?.to;
    const title = settled ? view === 'current' ? 'Seat change confirmed' : 'Seats and extra bag confirmed' : example.chosen ? view === 'current' ? 'Seat change proposed' : 'Seats and extra bag found' : scenario === 'expired' ? 'Request expired' : 'Extra bag unavailable';
    const bagStatus = assignedBag ? 'Confirmed' : scenario === 'expired' ? 'Request closed' : freeBags >= bagLine.quantity ? 'Available from airline inventory' : 'Unavailable from airline inventory';

    element('flight').textContent = `${journey.flightNumber} · ${journey.destination}`;
    element('request').innerHTML = `<strong>Lin’s request</strong> Seats together + ${bagLine.quantity} extra checked bag`;
    element('quote').textContent = settled ? 'Fulfilled' : scenario === 'expired' ? 'Request expired' : 'Approved by Lin';
    element('current').textContent = settled ? 'Original booking' : 'Current booking';
    element('proposed').textContent = settled ? 'Confirmed booking' : 'Proposed match';
    element('proposed').disabled = !example.chosen;
    for (const button of root.querySelectorAll('[data-view]')) button.setAttribute('aria-pressed', String(button.dataset.view === (example.chosen ? view : 'current')));
    element('map').innerHTML = seatMap(current, showingResult);
    element('map-caption').textContent = showingResult ? 'Mia and Jamie keep their seats. Lin joins them.' : 'Mia and Jamie sit together. Lin is two rows back.';
    element('outcome').innerHTML = `<div class="match-outcome-heading"><span class="match-status-dot ${example.chosen ? '' : 'match-status-wait'}" aria-hidden="true"></span><h3>${title}</h3></div>
      <div class="match-seat-outcome"><span class="match-outcome-symbol" aria-hidden="true">⇄</span><div><strong>${example.chosen ? `Daniel ${settled ? 'has' : 'takes'} aisle seat ${escape(seatName(state, nextDanielSeat))}` : 'The existing seats stay in place'}</strong><small>${example.chosen ? `Another aisle seat · ${settled ? 'Earned' : 'Earns'} ${danielCredits} credits` : scenario === 'expired' ? 'Request closed without a booking change' : 'Both seats and bag are required'}</small></div></div>
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
    const initial = example.state;
    const state = stateOf(current);
    const settled = execution?.contract.status === 'SETTLED';
    const book = bookSnapshot(state);
    const request = book.requests.find(entry => entry.source.person === 'A' && entry.source.intentId === example.request.id);
    const permission = book.permissions.find(entry => entry.source.person === 'C');
    const contracts = book.contracts.filter(entry => entry.requestReferences.some(reference => reference.person === 'A' && reference.intentId === example.request.id));
    const quote = example.request.authorization.quote;
    const bagLine = quote.lineItems.find(line => line.kind === 'baggage');
    const bag = resource(initial, bagLine.resourceIds[0]);
    const bagCapacity = Math.max(0, bag.capacity - bag.background - bag.protected - initial.allocations.filter(allocation => allocation.resource === bag.id).length);
    const linOptions = example.candidates.filter(candidate => candidate.changes.some(change => {
      const allocation = initial.allocations.find(entry => entry.key === change.key);
      return allocation?.person === 'A' && allocation.journeyId === example.request.scope.journeyId;
    }));
    const changesKind = (candidate, kind) => candidate.changes.some(change => {
      const allocation = initial.allocations.find(entry => entry.key === change.key);
      return allocation?.person === 'A' && resource(initial, change.to)?.kind === kind;
    });
    const seatOption = linOptions.find(candidate => changesKind(candidate, 'seat') && !changesKind(candidate, 'baggage'));
    const proposal = example.chosen ?? seatOption;
    const outcomeResource = person => {
      const allocation = allocationFor(initial, person);
      const id = execution ? allocationFor(state, person).resource : proposal?.changes.find(change => change.key === allocation.key)?.to ?? allocation.resource;
      return resource(state, id);
    };
    const family = initial.parties.find(party => party.journeyId === example.request.scope.journeyId && party.memberIds.includes('A'));
    const familySeats = family.memberIds.map(outcomeResource);
    const columns = familySeats.map(seat => seat.seatMap.column).sort((a, b) => a - b);
    const adjacent = familySeats.every(seat => seat.seatMap.row === familySeats[0].seatMap.row && seat.seatMap.block === familySeats[0].seatMap.block)
      && columns.every((column, index) => !index || column === columns[index - 1] + 1);
    const danielSeat = outcomeResource('C');
    const permittedPositions = permission?.source.rules.flatMap(rule => rule.effect.kind === 'seat_position' ? rule.effect.positions : []) ?? [];
    const danielFits = Boolean(proposal) && permittedPositions.includes(danielSeat.seatPosition);
    const bagAssigned = state.allocations.some(allocation => allocation.person === 'A' && allocation.resource === bag.id);
    const bagOpen = initial.hour < bag.deadline && bagCapacity >= bagLine.quantity;
    const authorizationActive = example.authorization.status === 'active';
    const danielAccepted = contracts.some(contract => contract.accepted.includes('C'));
    const beforeSeats = person => seatName(initial, allocationFor(initial, person).resource);
    const afterSeats = person => seatName(state, outcomeResource(person).id);
    const familySeatNames = familySeats.map(seat => seatName(state, seat.id)).sort().join(', ');
    const wallet = walletSummary(state);
    const technicalOpen = Boolean(element('diagnostics').querySelector('[data-detail="technical"][open]'));
    const requirements = [
      {name: 'Three adjacent family seats', fact: proposal ? `${settled ? 'The confirmed exchange puts' : 'The seat exchange would put'} Lin, Mia and Jamie in ${familySeatNames}.` : `Their current seats are ${familySeatNames}.`, verdict: adjacent ? 'Fits' : 'Separated', ok: adjacent},
      {name: 'Daniel keeps an aisle seat', fact: proposal ? `${danielSeat.label}. His saved preference accepts ${permittedPositions.join(' or ')} seats.` : `Daniel keeps ${beforeSeats('C')}. There is no new seat proposal.`, verdict: danielFits ? 'Fits' : 'No proposal', ok: danielFits},
      {name: 'One extra checked bag', fact: bagAssigned ? `${bagLine.quantity} bag is assigned to Lin, up to ${bag.baggage.maxKg} kg.` : initial.hour >= bag.deadline ? `Booking for this bag has closed at the request deadline.` : bagOpen ? `The airline can add ${bagLine.quantity} checked ${bagLine.quantity === 1 ? 'bag' : 'bags'} of up to ${bag.baggage.maxKg} kg.` : 'The airline has no extra bag available.', verdict: bagAssigned ? 'Confirmed' : bagOpen ? 'Available' : initial.hour >= bag.deadline ? 'Closed' : 'Unavailable', ok: bagAssigned || bagOpen},
      {name: 'The total Lin approved', fact: settled ? `${request.funding.spent} credits paid for the seats and bag together.` : authorizationActive ? `${quote.debit} credits are reserved for both items together. ${wallet.available} credits remain available for other uses.` : `The approval expired. All ${wallet.available} credits are available again.`, verdict: settled ? 'Paid once' : authorizationActive ? 'Approved' : 'Expired', ok: settled || authorizationActive},
      {name: 'Daniel agrees to this exchange', fact: danielAccepted ? `Daniel accepted the seat change and ${execution.contract.credits.C}-credit reward.` : example.chosen ? `Daniel needs to accept moving to ${afterSeats('C')} for ${example.chosen.credits.C} credits.` : 'There is no complete offer for Daniel to accept.', verdict: danielAccepted ? 'Recorded' : example.chosen ? 'Awaiting Daniel' : 'No offer', ok: danielAccepted}
    ];
    const explanation = settled
      ? `Lin now has ${afterSeats('A')}, beside Mia in ${afterSeats('G')} and Jamie in ${afterSeats('H')}. Daniel has ${afterSeats('C')}, also an aisle seat. The extra bag is confirmed and ${request.funding.spent} credits have been settled.`
      : example.chosen
        ? `Exchanging Lin’s and Daniel’s seats would give the family ${familySeatNames}. Daniel would keep an aisle in ${afterSeats('C')}. The available extra bag completes the request Lin approved for ${quote.debit} credits.`
        : example.scenario === 'expired'
          ? `The request reached its deadline before an arrangement was accepted. The bookings stay unchanged and the ${quote.debit}-credit reservation is released.`
          : `A seat exchange would put the family together. The airline has no extra bag available, so the combined request stays open with ${wallet.reserved} credits reserved.`;
    const optionRows = linOptions.map(candidate => {
      const seats = changesKind(candidate, 'seat');
      const baggage = changesKind(candidate, 'baggage');
      const selected = example.result.selected.includes(candidate.id);
      const name = seats && baggage ? 'Family seats and extra bag' : seats ? 'Family seats alone' : 'Extra bag alone';
      const reason = selected
        ? `Includes both requested outcomes at the approved total of ${-candidate.credits.A} credits.`
        : seats && !baggage
          ? `Leaves the bag request unfilled. Lin approved the seats and bag together.`
          : baggage && !seats
            ? `${bagCapacity < bagLine.quantity ? 'The extra bag is unavailable. ' : ''}Leaves the family in separate rows. Lin approved both outcomes together.`
            : 'One or more booking or authorization checks failed.';
      return `<tr><th scope="row">${name}<small>${-candidate.credits.A} credits</small></th><td>${reason}</td><td><span class="match-verdict ${selected ? 'match-verdict-pass' : ''}">${selected ? settled ? 'Confirmed' : 'Selected' : 'Excluded'}</span></td></tr>`;
    }).join('');
    const validLinOptions = linOptions.filter(candidate => candidate.blocked.length === 0);
    const selectedLinOptions = linOptions.filter(candidate => example.result.selected.includes(candidate.id));
    const stale = example.chosen ? staleExample(example) : null;
    element('explanation-question').textContent = example.chosen ? 'Why does this seat exchange work?' : 'Why is this request waiting?';
    if (example.scenario === 'expired') element('explanation-question').textContent = 'Why did this request close?';
    element('explanation-preview').textContent = example.scenario === 'expired' ? 'Review the deadline and the released credit reservation.' : example.chosen ? 'Check the seats, Daniel’s preferences and the extra bag.' : 'See why seats alone cannot complete this request.';
    element('diagnostics').innerHTML = `<div class="match-worked-example">
      <p>Lin originally has ${beforeSeats('A')}. Mia and Jamie have ${beforeSeats('G')} and ${beforeSeats('H')}. Daniel has ${beforeSeats('C')}, next to them.</p><p>${explanation}</p>
      <div class="match-evidence-scroll"><table class="match-evidence"><caption>The checks for this request</caption><thead><tr><th>Requirement</th><th>What the booking records show</th><th>Result</th></tr></thead><tbody>${requirements.map(row => `<tr><th scope="row">${row.name}</th><td>${escape(row.fact)}</td><td><span class="match-verdict ${row.ok ? 'match-verdict-pass' : ''}">${row.verdict}</span></td></tr>`).join('')}</tbody></table></div>
      <h4>Options for Lin’s request</h4><p>${execution ? 'The search before confirmation produced these options.' : linOptions.length ? 'The search tests each option against the whole request.' : 'The closed request produces no new option for Lin.'}</p>
      ${linOptions.length ? `<div class="match-evidence-scroll"><table class="match-evidence match-options"><thead><tr><th>Option</th><th>Why it is selected or excluded</th><th>Result</th></tr></thead><tbody>${optionRows}</tbody></table></div>` : ''}
      ${stale?.length ? `<p class="match-dependency-note">Mia and Jamie keep their booked seats. If either booking changes, Flex checks the plan again.</p>` : ''}
      ${linOptions.length ? `<p class="match-run-result">${validLinOptions.length === 1 && selectedLinOptions.length === 1 && changesKind(selectedLinOptions[0], 'seat') && changesKind(selectedLinOptions[0], 'baggage') ? 'Only the combined plan passes all checks, so the selection contains one plan.' : validLinOptions.length === 0 ? 'None of these options fulfils the complete request, so no plan is selected.' : `${validLinOptions.length} options pass the checks and ${selectedLinOptions.length} are selected.`}</p>` : ''}
      <details class="match-technical-record" data-detail="technical" ${technicalOpen ? 'open' : ''}><summary><span class="match-disclosure-label"><strong>What data produced this result?</strong><small>Inspect the request rules, generated plans and booking checks.</small></span><span class="match-disclosure-icon" aria-hidden="true">+</span></summary>${json({source: example.request.sourceText, rules: example.request.rules, quote, originalAuthorization: example.authorization, candidates: example.candidates, selection: example.result, currentBook: book, wallet, companionVersionCheck: stale, confirmation: execution ? {status: execution.contract.status, trace: execution.contract.log, ledger: state.ledger.filter(entry => entry.contract === execution.contract.contractId)} : null, stateChecks: execution?.checks ?? example.checks}, 'Complete technical record for this matching example')}</details>
    </div>`;
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


const recoveryRoot = document.getElementById('confirmation-recovery');
if (recoveryRoot) {
  let example = prepareExample('ready');
  let execution = null;
  recoveryRoot.classList.add('confirmation-recovery');
  recoveryRoot.innerHTML = `<p class="recovery-demo-context">Separate simulated booking</p><div id="recovery-process"></div><div class="recovery-demo-action"><button type="button" id="recovery-action">Simulate a missing reply</button><p id="recovery-announcement" role="status" aria-live="polite"></p></div><details class="match-technical-record"><summary><span class="match-disclosure-label"><strong>What did the booking services record?</strong><small>Inspect completed changes, receipts and the credit entry.</small></span><span class="match-disclosure-icon" aria-hidden="true">+</span></summary><div id="recovery-record"></div></details>`;
  const element = id => recoveryRoot.querySelector(`#recovery-${id}`);
  function renderRecovery() {
    const state = execution?.state ?? example.state;
    const wallet = walletSummary(state);
    const settled = execution?.contract.status === 'SETTLED';
    const seat = person => {
      const allocation = state.allocations.find(entry => entry.person === person && entry.journeyId === 'story-tokyo' && state.resources.some(resource => resource.id === entry.resource && resource.kind === 'seat'));
      return state.resources.find(resource => resource.id === allocation.resource).label.split(' · ')[0];
    };
    const bagAssigned = state.allocations.some(entry => entry.person === 'A' && entry.resource === 'tokyo-extra-bag');
    const entries = execution ? state.ledger.filter(entry => entry.contract === execution.contract.contractId) : [];
    const status = !execution ? 'The request is ready for Daniel’s acceptance.' : settled ? 'The booking has been checked and the credits settled.' : 'The seats changed. Their confirmation reply was lost.';
    element('process').innerHTML = `<p class="recovery-demo-status">${status}</p><ol class="recovery-demo-steps"><li><span>1</span><div><strong>Seat booking</strong><p>Lin has ${seat('A')}. Daniel has ${seat('C')}.</p><small>${!execution ? 'Original seats' : settled ? 'Confirmed by checking the booking' : 'Seat change recorded, reply missing'}</small></div></li><li><span>2</span><div><strong>Extra bag</strong><p>${bagAssigned ? 'One extra bag is assigned to Lin.' : 'The extra bag has not been added yet.'}</p><small>${bagAssigned ? 'Confirmed' : execution ? 'Waiting for the seat check' : 'Available for this request'}</small></div></li><li><span>3</span><div><strong>Flex credits</strong><p>${wallet.balance} total · ${wallet.reserved} reserved · ${wallet.available} available</p><small>${entries.length ? `${entries.length} settlement recorded` : 'No settlement recorded'}</small></div></li></ol>${execution ? `<p class="recovery-demo-explanation">${settled ? `Checking the existing seat changes allowed the bag step to finish. Lin paid ${-execution.contract.credits.A} credits and Daniel received ${execution.contract.credits.C}. The ledger contains ${entries.length} settlement for this arrangement.` : `The ${wallet.reserved} credits stay reserved while the system checks the recorded seats. It can then add the bag and settle the complete request.`}</p>` : ''}`;
    element('action').textContent = !execution ? 'Simulate a missing reply' : settled ? 'Run again' : 'Check booking and finish';
    element('record').innerHTML = json({status: execution?.contract.status ?? 'REQUEST_OPEN', wallet, allocations: state.allocations.filter(allocation => allocation.journeyId === 'story-tokyo'), receipts: execution?.contract.receipts ?? [], ledger: entries, trace: execution?.contract.log ?? [], checks: execution?.checks ?? example.checks}, 'Separate recovery example technical record');
  }
  element('action').addEventListener('click', () => {
    try {
      if (execution?.contract.status === 'SETTLED') { example = prepareExample('ready'); execution = commitExample(example, 'after_write'); }
      else execution = execution ? reconcileExample(execution) : commitExample(example, 'after_write');
      renderRecovery();
      element('announcement').textContent = execution.contract.status === 'SETTLED' ? 'The seats and bag are confirmed. Credits were settled once.' : 'Seat changes are recorded. The bag is waiting and credits remain reserved.';
    } catch (error) { element('announcement').textContent = error.message; }
  });
  renderRecovery();
}
