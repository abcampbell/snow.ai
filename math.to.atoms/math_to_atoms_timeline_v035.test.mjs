import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {defaultValues} from './math_to_atoms_value_model_v027.mjs';
import {DEFAULT_SCENARIO,scenarioOutcomes} from './math_to_atoms_scenario_v029.mjs';
import {defaultProjection,projectAll} from './math_to_atoms_projection_v031.mjs';
import {trendCards,gdpExplanation,deltaCurve} from './math_to_atoms_timeline_v035.mjs';
const read=n=>JSON.parse(fs.readFileSync(new URL(n,import.meta.url),'utf8'));
const data=read('./math_to_atoms_history_v017.json'),energy=read('./math_to_atoms_energy_history_v028.json'),values=defaultValues(read('./math_to_atoms_values_v013.json'));
const impact=scenarioOutcomes(DEFAULT_SCENARIO,values),max=scenarioOutcomes(DEFAULT_SCENARIO,values,100);
test('all ten charts identify the same selected end year, with lower gains reaching that date',()=>{
 for(const years of [1,20,30,50,100]){
  const p={...defaultProjection(),horizonYears:years},end=2026+years;
  const html=trendCards(data,projectAll(data,p,impact),projectAll(data,p,max),impact,p,max,energy,DEFAULT_SCENARIO,{snapshot:true});
  assert.equal((html.match(new RegExp('data-period-end="'+end+'"','g'))||[]).length,10);
  assert.equal((html.match(new RegExp('data-chart-end="'+end+'"','g'))||[]).length,10);
  assert.equal((html.match(/class="delta-line" d="M52,78 L308,/g)||[]).length,5);
  assert.doesNotMatch(html,/NaN|Infinity/);
 }
});
test('gross savings accounting remains unchanged and makes the GDP gap and scope assumptions explicit',()=>{
 assert.equal(impact.economicValue,1.8112e12);
 const html=gdpExplanation(impact);
 for(const s of ['$12T/yr','$24T/yr','$224B/yr','$600B/yr','$1.2T/yr','$11.2B/yr','$1.81T/yr','$2.4T','2%','Extra GDP has not been estimated','shared costs across suppliers still need checking'])assert.ok(html.includes(s),s);
 const none=structuredClone(impact);none.components[0]={...none.components[0],base:null,value:null};none.economicValue=null;
 assert.match(gdpExplanation(none),/Set energy spending/);assert.doesNotMatch(gdpExplanation(none),/NaN|Infinity/);
});
test('100% shorter is disclosed as an unbounded output-per-hour conversion, while its time saving remains finite',()=>{
 const settings={...DEFAULT_SCENARIO,capturePercent:100,adoptionPercent:100,localGainPercent:100},full=scenarioOutcomes(settings,values),p=defaultProjection();
 const html=trendCards(data,projectAll(data,p,full),projectAll(data,p,full),full,p,full,energy,settings,{snapshot:true});
 assert.match(html,/output\/hour comparison has no finite endpoint/);assert.doesNotMatch(html,/NaN|Infinity/);
 assert.match(deltaCurve('time',full,full,p),/data-end-value="10"/);
});
