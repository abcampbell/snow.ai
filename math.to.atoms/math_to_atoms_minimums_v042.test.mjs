import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DEFAULT_SCENARIO,validateScenario,scenarioOutcomes} from './math_to_atoms_scenario_v042.mjs';
import {defaultValues} from './math_to_atoms_value_model_v027.mjs';
import {DEFAULT_MINIMUMS,validateMinimums,readMinimums,minimumsURL} from './math_to_atoms_minimums_v042.mjs';
import {energyOutlook,energyHistorySeries} from './math_to_atoms_energy_v042.mjs';
import {benefitSeries} from './math_to_atoms_public_v042.mjs';
import {defaultProjection,projectAll} from './math_to_atoms_projection_v042.mjs';
import {welfareValue,PRICE_DEFAULTS} from './math_to_atoms_welfare_v042.mjs';
const read=n=>JSON.parse(fs.readFileSync(new URL(n,import.meta.url),'utf8'));
const values=defaultValues(read('./math_to_atoms_values_v013.json')),history=read('./math_to_atoms_history_v017.json'),oil=read('./math_to_atoms_energy_history_v028.json');
const full={...DEFAULT_SCENARIO,capturePercent:100,adoptionPercent:100,localGainPercent:100};
const near=(a,b)=>assert.ok(Math.abs(a-b)<Math.max(1,Math.abs(b))*1e-12,`${a} != ${b}`);
test('published 40%-improvement cases retain their values',()=>{
 const r=scenarioOutcomes(DEFAULT_SCENARIO,values);near(r.economicValue,1.8112e12);near(r.health.averted,139.85e6);near(r.deliverySaved,.5);near(r.energyEffect,.05);
 const w=welfareValue(r,PRICE_DEFAULTS);near(w.combined,3.839025e12);
});
test('full reach and adoption cannot erase retained costs or construction time',()=>{
 const r=scenarioOutcomes(full,values),e=energyOutlook(r,20),p=defaultProjection(),f=projectAll(history,p,r);
 near(r.energyEffect,.8);near(r.productionEffect,.8);near(r.deliveryEffect,.8);near(e.savings,9.6e12);near(e.after,2.4e12);near(e.priceAfter,20);near(r.deliveryAfter,2);near(r.economicValue,29.024e12);
 near(f.time.withScenario/f.time.baseline,5);assert.ok(f.time.points.every(p=>Number.isFinite(p.withScenario)));
 near(benefitSeries('energy',r,full,p).end,20);near(benefitSeries('time',r,full,p).end,2);near(energyHistorySeries(e,oil).future.at(-1).withScenario,20);
 near(welfareValue(r,PRICE_DEFAULTS).energyGDP,14.4e12);
});
test('limits apply locally before partial deployment and each minimum stays independent',()=>{
 const r=scenarioOutcomes({...full,capturePercent:25,adoptionPercent:50},values);near(r.energyEffect,.1);near(r.deliveryEffect,.1);near(r.deliveryAfter,9);
 const changed=scenarioOutcomes({...full,energyCostFloorPercent:35},values);near(changed.energyEffect,.65);near(changed.productionEffect,.8);near(changed.deliveryEffect,.8);
 const zero=scenarioOutcomes({...full,capturePercent:0},values);near(zero.energyEffect,0);near(zero.economicValue,0);near(zero.deliveryAfter,10);
 near(scenarioOutcomes({...full,energyCostFloorPercent:100},values).energyEffect,0);
});
test('legacy cases receive defaults; positive floors are validated and shareable',()=>{
 const legacy=validateScenario({capturePercent:100,adoptionPercent:100,localGainPercent:100});assert.equal(legacy.energyCostFloorPercent,20);
 for(const bad of [0,-1,101,NaN,'20'])assert.throws(()=>validateMinimums({...DEFAULT_MINIMUMS,energyCostFloorPercent:bad}));
 assert.throws(()=>validateScenario({...full,deliveryTimeFloorPercent:0}));
 const m={...DEFAULT_MINIMUMS,energyCostFloorPercent:35},url=minimumsURL('https://example.test/?case_reach=100#case',m);assert.deepEqual(readMinimums(url.search),m);assert.equal(url.hash,'#case');
 assert.equal(readMinimums('?limit_energyCostFloorPercent=0'),null);
});
