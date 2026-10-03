import { prepareExample, commitExample, reconcileExample, staleExample, walletSummary, bookSnapshot } from './lab.mjs?v=aa3b57dabe77';

const output = document.getElementById('lab-output');
const scenario = document.getElementById('scenario');
const run = document.getElementById('run-match');
const escape = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const code = (value,label) => `<pre class="lab-code" tabindex="0" aria-label="${label}"><code>${escape(JSON.stringify(value,null,2))}</code></pre>`;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let example, execution, animation;

function renderBook(state) {
  const book=bookSnapshot(state);
  const request=book.requests.find(entry=>entry.source.person==='A'&&entry.source.intentId===example.request.id);
  const permission=book.permissions.find(entry=>entry.source.person==='C');
  const contracts=book.contracts.filter(entry=>entry.requestReferences.some(ref=>ref.person==='A'&&ref.intentId===example.request.id));
  const name=person=>state.people.find(entry=>entry.id===person)?.name||person;
  const status=entry=>entry.firm?'Open · authorized':entry.status.replace(/^./,letter=>letter.toUpperCase());
  const requestRow=request?`<li><span class="book-kind">Published request</span><div class="book-terms"><strong>${escape(name(request.source.person))} · ${escape(request.quote?.lineItems.map(line=>line.label).join(' + ')||request.source.descriptions.join(' + '))}</strong><small>Revision ${request.source.revision} · Fixed ${request.quote?.debit??0} credits · ${request.funding.reserved} reserved</small></div><span class="book-status">${escape(status(request))}</span></li>`:'';
  const permissionRow=permission?`<li><span class="book-kind">Saved flexibility</span><div class="book-terms"><strong>${escape(name(permission.source.person))} · ${escape(permission.source.descriptions.join(' + '))}</strong><small>Guides proposed changes. Each arrangement requires consent.</small></div><span class="book-status">${escape(status(permission))}</span></li>`:'';
  const contractRows=contracts.map(entry=>`<li><span class="book-kind">Arrangement</span><div class="book-terms"><strong>${escape(entry.title)}</strong><small>${entry.awaitingConsent.length?`Awaiting ${escape(entry.awaitingConsent.map(name).join(', '))}’s consent`:entry.engineStatus==='SETTLED'?'All changes verified. Credits settled once.':'Consent recorded. Execution remains under verification.'}</small></div><span class="book-status">${escape(status(entry))}</span></li>`).join('');
  document.getElementById('order-book-output').innerHTML=`<div class="book-view"><div class="book-heading"><h4>The request book</h4><span>Workspace revision ${book.audit.stateVersion}</span></div><ul class="book-rows">${requestRow}${permissionRow}${contractRows}</ul><details><summary>Inspect book entries and funding</summary><p class="book-note">Computed from the current synthetic state. An open, authorized request can fund a new arrangement within its exact terms. It still needs eligible supply and the other participants’ consent. This display order creates no execution priority.</p>${code({audit:book.audit,request,permission,contracts},'Current conditional order book')}</details></div>`;
}
function render() {
  const {result,candidates,chosen,request,checks} = example;
  const wallet = walletSummary(example.state);
  const valid = candidates.filter(c=>!c.blocked.length);
  const title = chosen ? 'One complete arrangement.' : example.scenario === 'expired' ? 'The request has closed.' : 'Both outcomes are required.';
  const description = chosen ? 'Lin can join Mia and Jamie in row 32. Daniel moves to another aisle seat and earns 160 credits. One extra checked bag comes from airline inventory.' : example.scenario === 'expired' ? 'The published authorization has expired. The 360-credit reservation is released. No new booking change is authorized.' : 'A seat exchange on its own cannot fulfil this request. Flex keeps the existing bookings and waits for the complete quoted outcome.';
  const arrangement = chosen ? `<div class="arrangement-view"><div class="seat-diagram"><p>PROPOSED SEATING · ROW 32</p><div class="seat-row-tech"><div><strong>32A</strong><small>Mia</small></div><div><strong>32B</strong><small>Jamie</small></div><div><strong>32C</strong><small>Lin</small></div></div><p class="seat-move">Lin moves 34C → 32C<br>Daniel moves 32C → 34C<br>Mia and Jamie stay together.</p></div><dl class="resource-lines">${request.authorization.quote.lineItems.map(line=>`<div><dt>${escape(line.kind==='seat'?'Seats together':'Extra checked bag')}<small>${line.kind==='seat'?'Complete exchange':'One piece · up to 23 kg'}</small></dt><dd>${line.credits}</dd></div>`).join('')}<div class="total"><dt>Fixed total<small>Flex credits</small></dt><dd>${request.authorization.quote.debit}</dd></div></dl></div>` : `<div class="empty-arrangement"><p>${example.scenario==='expired'?'Lin’s full 400-credit balance is available again. A new request requires a new reviewed quote.':'The quoted price stays at 360 credits. An unavailable bag does not cause the system to buy only the seats or spend part of the reservation.'}</p></div>`;
  output.innerHTML = `<div class="lab-result-heading"><div><h4>${title}</h4><p>${description}</p></div><span class="result-mark">${chosen?'All conditions met':'No booking change'}</span></div>${arrangement}
    <div class="lab-stats"><div><strong>${candidates.length}</strong>Generated arrangements</div><div><strong>${valid.length}</strong>Pass validation</div><div><strong>${wallet.reserved}</strong>Credits reserved</div></div>
    ${chosen?'<div class="lab-transaction"><p>Try the final agreement and see the booking and ledger update.</p><button class="lab-action" id="accept-arrangement" type="button">Simulate Daniel’s acceptance <span aria-hidden="true">→</span></button><div id="settlement-output" role="status" aria-live="polite"></div></div>':''}
    <details class="lab-inspect"><summary>Why other arrangements were excluded</summary><ul class="candidate-list">${candidates.map(c=>`<li><strong>${escape(c.title)}</strong><span>${escape(c.blocked.length?c.blocked.join(' · '):result.selected.includes(c.id)?'Selected. Compatible with the other selected arrangements.':'Eligible. A different compatible combination has the preferred objective.')}</span></li>`).join('')||'<li><strong>No candidate is supported by the expired request.</strong></li>'}</ul></details>
    <details class="lab-inspect"><summary>Inspect the rules, quote and source evidence</summary>${code({source:request.sourceText,scope:request.scope,rules:request.rules,quote:request.authorization.quote,authorization:example.authorization},'Reviewed request and exact quote')}</details>
    <details class="lab-inspect"><summary>Inspect search bounds and reservation checks</summary><p class="lab-intro">${result.search.complete?'The selection search is complete for this generated set.':'A node limit stopped the selection search.'} Generation is bounded by cycle length, bundle size and work limits. This run took ${example.elapsed.toFixed(1)} ms in this browser.</p>${code({selection:result,invariants:checks},'Solver result and state invariants')}</details>
    ${chosen?`<details class="lab-inspect"><summary>What happens if a companion’s booking changes?</summary><p class="lab-intro">The following result is computed after incrementing Mia’s allocation version. Her unchanged seat is a dependency of the family arrangement.</p>${code(staleExample(example),'Rejected stale arrangement')}</details><details class="lab-inspect"><summary>Simulate a lost booking acknowledgement</summary><p class="lab-intro">In a separate run, the seat adapter writes its changes, then loses the acknowledgement. Inspect the actual transaction state before and after reconciliation.</p><div class="lab-transaction" style="padding-top:18px"><button class="lab-action" id="simulate-timeout" type="button">Run timeout scenario <span aria-hidden="true">→</span></button><div id="recovery-output" aria-live="polite"></div></div></details>`:''}`;
  output.setAttribute('aria-busy','false');
  renderBook(example.state);
  document.getElementById('accept-arrangement')?.addEventListener('click',accept);
  document.getElementById('simulate-timeout')?.addEventListener('click',timeout);
}
function safeAction(target, fn) {
  try { fn(); } catch(error) { target.innerHTML=`<p class="loading-note">${escape(error.message)} No live booking was affected.</p>`; }
}
function trace(execution) { return `<ol class="trace-list">${execution.contract.log.map(line=>`<li>${escape(line)}</li>`).join('')}</ol>`; }
function accept(event) {
  const target = document.getElementById('settlement-output');
  safeAction(target,()=>{
    execution = commitExample(example);
    event.currentTarget.hidden=true;
    const wallet = walletSummary(execution.state);
    output.querySelector('.lab-result-heading h4').textContent='The arrangement is confirmed.';
    output.querySelector('.result-mark').textContent='Verified and settled';
    output.querySelector('.seat-diagram>p').textContent='CONFIRMED SEATING · ROW 32';
    output.querySelector('.lab-stats div:last-child strong').textContent=String(wallet.reserved);
    renderBook(execution.state);
    target.innerHTML=`<div class="settlement-banner">Confirmed. Lin has ${wallet.balance} credits remaining.<small>Daniel earned 160 credits. The airline baggage product redeemed 200. ${execution.checks.filter(c=>c.ok).length} state invariants pass.</small></div><details class="lab-inspect" style="margin:15px 0 0"><summary>Inspect the confirmation trace</summary>${trace(execution)}${code({wallet,ledger:execution.state.ledger.at(-1),checks:execution.checks},'Settled wallet and ledger')}</details>`;
    if (!reduced.matches && event.detail) target.animate([{opacity:0,transform:'translateY(5px)'},{opacity:1,transform:'translateY(0)'}],{duration:220,easing:'cubic-bezier(.23,1,.32,1)'});
  });
}
function timeout(event) {
  const target=document.getElementById('recovery-output');
  safeAction(target,()=>{
    const partial=commitExample(example,'after_write');
    event.currentTarget.hidden=true;
    target.innerHTML=`<div class="settlement-banner">Awaiting authoritative confirmation.<small>Lin’s balance is still ${partial.state.wallets.A}. The ${walletSummary(partial.state).reserved}-credit reservation remains held.</small></div>${code({status:partial.contract.status,receipts:partial.contract.receipts,ledgerEntries:partial.state.ledger.filter(l=>l.contract===partial.contract.contractId).length},'Partial write status')}<button class="lab-action" id="reconcile" type="button">Reconcile booking state <span aria-hidden="true">→</span></button>`;
    document.getElementById('reconcile').addEventListener('click',()=>safeAction(target,()=>{
      const recovered=reconcileExample(partial);
      target.innerHTML=`<div class="settlement-banner">Verified and settled once.<small>Lin’s balance is ${recovered.state.wallets.A}. All ${recovered.checks.length} state invariants ${recovered.checks.every(c=>c.ok)?'pass':'require review'}.</small></div>${trace(recovered)}`;
    }));
  });
}
function runExample(event) {
  run.disabled=true;output.setAttribute('aria-busy','true');
  try { example=prepareExample(scenario.value);render();if(event?.detail&&!reduced.matches){animation?.cancel();animation=output.animate([{opacity:.6},{opacity:1}],{duration:200,easing:'ease-out'});} }
  catch(error){output.innerHTML=`<p class="loading-note">The example could not complete. ${escape(error.message)}</p>`;output.setAttribute('aria-busy','false');}
  finally {run.disabled=false;}
}
run.addEventListener('click',runExample);
scenario.addEventListener('change',runExample);
runExample();

const links=[...document.querySelectorAll('.chapter-nav a')];
const observer=new IntersectionObserver(entries=>{for(const entry of entries){if(entry.isIntersecting){links.forEach(link=>{if(link.hash===`#${entry.target.id}`)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current');});}}},{rootMargin:'-15% 0px -65% 0px'});
document.querySelectorAll('.chapter').forEach(section=>observer.observe(section));
fetch('manifest.json').then(r=>{if(!r.ok)throw new Error('Manifest unavailable');return r.json();}).then(manifest=>{
  document.getElementById('build-evidence').textContent=`${manifest.files.length} domain source files · SHA-256 ${manifest.sourceTreeDigest.slice(0,12)} · Exported ${new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Hong_Kong'}).format(new Date(manifest.generatedAt))}`;
}).catch(()=>{document.getElementById('build-evidence').textContent='Source and export details are available in the manifest.';});

fetch('benchmark.json').then(r=>{if(!r.ok)throw new Error('Benchmark unavailable');return r.json();}).then(report=>{
  const rows=report.rows.filter(row=>row.nodeLimit===20000);
  document.getElementById('benchmark-results').innerHTML=`<p>${escape(report.node)} · ${escape(report.platform)} ${escape(report.arch)} · 20,000-node budget</p><div class="benchmark-scroll" tabindex="0" aria-label="Measured solver results"><table><thead><tr><th>Candidates</th><th>Nodes visited</th><th>Search result</th><th>Time</th></tr></thead><tbody>${rows.map(row=>`<tr><td>${row.suppliedCandidates}</td><td>${row.visited.toLocaleString('en')}</td><td>${row.complete?'Proven within supplied set':'Feasible, search limit reached'}</td><td>${row.elapsedMs.toFixed(1)} ms</td></tr>`).join('')}</tbody></table></div>`;
}).catch(()=>{document.getElementById('benchmark-results').innerHTML='<p>Open the raw benchmark to inspect the recorded measurements.</p>';});
