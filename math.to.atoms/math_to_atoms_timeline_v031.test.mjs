import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {defaultValues} from './math_to_atoms_value_model_v027.mjs';
import {DEFAULT_SCENARIO,scenarioOutcomes} from './math_to_atoms_scenario_v029.mjs';
import {defaultProjection,projectAll} from './math_to_atoms_projection_v031.mjs';
import {deltaValue,deltaCurve,trendCards} from './math_to_atoms_timeline_v031.mjs';
const read=n=>JSON.parse(fs.readFileSync(new URL(n,import.meta.url),'utf8'));
const history=read('./math_to_atoms_history_v017.json'),energy=read('./math_to_atoms_energy_history_v028.json');
const values=defaultValues(read('./math_to_atoms_values_v013.json')),settings={...DEFAULT_SCENARIO},projection=defaultProjection();
const impact=scenarioOutcomes(settings,values),max=scenarioOutcomes(settings,values,100),axes=['economy','health','energy','climate','time'];
const cards=(r=impact,options={})=>trendCards(history,projectAll(history,projection,r),projectAll(history,projection,max),r,projection,max,energy,settings,options);
test('deltas preserve annual units, energy inclusion, and the reference project duration',()=>{
 const want=[1.8112e12,139.85e6,600e9,1.92,.5];
 axes.forEach((a,i)=>assert.ok(Math.abs(deltaValue(a,impact)-want[i])<Math.max(1,Math.abs(want[i]))*1e-12));
});
test('historical GDP and lifespan keep their own units while blue benefit deltas move',()=>{
 const html=cards();
 for(const axis of ['economy','health']){
  const card=html.match(new RegExp('<article data-master-axis="'+axis+'"[\\s\\S]*?</article>'))[0];
  assert.match(card,/data-range-start="1900"/);assert.match(card,/class="delta-line"/);assert.doesNotMatch(card,/class="outlook-scenario"/);
 }
 assert.equal((html.match(/data-delta-curve=/g)||[]).length,5);
});
test('dragging changes all five deltas without changing their scales',()=>{
 const high=scenarioOutcomes({...settings,capturePercent:80},values);
 for(const axis of axes){
  const a=deltaCurve(axis,impact,max,projection),b=deltaCurve(axis,high,max,projection);
  assert.notEqual(a,b);assert.equal(a.match(/data-domain-max="([^"]+)"/)[1],b.match(/data-domain-max="([^"]+)"/)[1]);
 }
});
test('the published snapshot uses the same charts but no editors or detail disclosures',()=>{
 const snapshot=cards(impact,{snapshot:true});
 assert.equal((snapshot.match(/class="delta-line"/g)||[]).length,5);assert.doesNotMatch(snapshot,/<input|<details/);
 assert.match(snapshot,/\$1.81T\/yr/);assert.match(snapshot,/140M\/yr/);assert.match(snapshot,/data-observations="126"/);
});
test('zero, full and unknown market values do not fabricate a benefit or break the SVG',()=>{
 for(const n of [0,100]){
  const s={...settings,capturePercent:n,adoptionPercent:100,localGainPercent:100},r=scenarioOutcomes(s,values);
  const html=trendCards(history,projectAll(history,projection,r),projectAll(history,projection,r),r,projection,r,energy,s);
  assert.doesNotMatch(html,/NaN|Infinity/);
 }
 const v=structuredClone(values);v.markets.O2.basis='unset';const r=scenarioOutcomes(settings,v);
 assert.equal(deltaValue('economy',r),null);assert.doesNotMatch(deltaCurve('economy',r,max,projection),/class="delta-line"/);
});
