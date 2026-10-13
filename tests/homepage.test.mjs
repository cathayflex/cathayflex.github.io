import test from 'node:test';
import assert from 'node:assert/strict';
import {resources,journeyAt,nextJourney,previousJourney} from '../homepage-model.mjs';
test('the journey reward and later fulfilment settle once across back and replay',()=>{
  const balances=[0,1,2,3].map(i=>journeyAt(i).balance);
  assert.deepEqual(balances,[600,760,760,400]);
  assert.equal(journeyAt(2).cost,360);
  assert.equal(journeyAt(2).fulfilled,false);
  assert.equal(journeyAt(3).fulfilled,true);
  assert.equal(previousJourney(3).balance,760);
  assert.equal(nextJourney(3).balance,600);
  assert.equal(nextJourney(previousJourney(3).step).balance,400);
});
test('resource participation preserves the asymmetric earning rules',()=>{
  assert.equal(Object.keys(resources).length,8);
  assert.deepEqual(Object.keys(resources).filter(k=>resources[k].earn&&resources[k].use),['seat','flight','baggage']);
  assert(resources.meal.earn);assert.equal(resources.meal.use,null);
  for(const key of ['upgrade','neighbour','lounge','wifi']){assert.equal(resources[key].earn,null);assert(resources[key].use)}
});
