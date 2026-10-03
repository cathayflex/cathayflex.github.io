import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareExample,commitExample,reconcileExample,staleExample,walletSummary,bookSnapshot,act} from '../technology/lab.mjs';

test('the exported platform engine reserves and settles a complete fixed quote',()=>{
  const example=prepareExample();
  assert.deepEqual(walletSummary(example.state),{balance:400,reserved:360,available:40});
  assert(example.chosen);
  assert.equal(example.chosen.credits.A,-360);
  assert.equal(example.chosen.blocked.length,0);
  assert(example.candidates.some(c=>c.blocked.some(reason=>reason.includes('all requested changes'))));
  const settled=commitExample(example);
  assert.equal(settled.contract.status,'SETTLED');
  assert.deepEqual(walletSummary(settled.state),{balance:40,reserved:0,available:40});
  assert(settled.checks.every(c=>c.ok));
  assert.equal(example.state.wallets.A,400);
  assert.equal(settled.state.ledger.filter(l=>l.contract===settled.contract.contractId).length,1);
  const repeated=act(settled.state,{action:'execute',contractId:settled.contract.contractId});
  assert.equal(repeated.ledger.length,settled.state.ledger.length);
});
test('unavailable inventory preserves the complete request and fixed price',()=>{
  const example=prepareExample('bag-full');
  assert.equal(example.chosen,undefined);
  assert.equal(example.request.authorization.quote.debit,360);
  assert.deepEqual(walletSummary(example.state),{balance:400,reserved:360,available:40});
});
test('expiry releases the request reservation without an unauthorized change',()=>{
  const example=prepareExample('expired');
  assert.equal(example.chosen,undefined);
  assert.equal(example.authorization.status,'expired');
  assert.deepEqual(walletSummary(example.state),{balance:400,reserved:0,available:400});
  assert.equal(example.state.allocations.find(a=>a.key==='A-seat-tokyo').resource,'hnd-34C');
});
test('an unchanged companion remains a checked booking dependency',()=>{
  assert(staleExample(prepareExample()).length>0);
});
test('lost acknowledgement keeps funds held until authoritative reconciliation',()=>{
  const partial=commitExample(prepareExample(),'after_write');
  assert.equal(partial.contract.status,'RECONCILING');
  assert.deepEqual(walletSummary(partial.state),{balance:400,reserved:360,available:40});
  assert.equal(partial.state.ledger.filter(l=>l.contract===partial.contract.contractId).length,0);
  const recovered=reconcileExample(partial);
  assert.equal(recovered.contract.status,'SETTLED');
  assert.equal(recovered.state.wallets.A,40);
  assert(recovered.checks.every(c=>c.ok));
});
test('the public request book follows actual authority and settlement state',()=>{
  const example=prepareExample();
  const before=bookSnapshot(example.state);
  const request=before.requests.find(entry=>entry.source.person==='A');
  assert.equal(request.status,'open');
  assert.equal(request.firm,true);
  assert.equal(request.funding.reserved,360);
  assert(before.permissions.every(entry=>entry.firm===false&&entry.authority==='none'));
  const settled=commitExample(example);
  const after=bookSnapshot(settled.state);
  const filled=after.requests.find(entry=>entry.source.person==='A');
  assert.equal(filled.status,'settled');
  assert.equal(filled.firm,false);
  assert.equal(filled.funding.reserved,0);
  assert.equal(after.contracts.find(entry=>entry.contractId===settled.contract.contractId).status,'settled');
  const expired=bookSnapshot(prepareExample('expired').state).requests.find(entry=>entry.source.person==='A');
  assert.equal(expired.status,'expired');
  assert.equal(expired.firm,false);
});
