import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {defaultValues} from './math_to_atoms_value_model_v027.mjs';
import {scenarioOutcomes,DEFAULT_SCENARIO} from './math_to_atoms_scenario_v029.mjs';
import {projectAll,defaultProjection} from './math_to_atoms_projection_v029.mjs';
import {historyPanel} from './math_to_atoms_history_v029.mjs';
import {benefitSeries,benefitReadout,benefitCurve} from './math_to_atoms_public_v029.mjs';
import {WORKED_CASES,defaultWorked,validateWorked,workedResult} from './math_to_atoms_worked_v029.mjs';
const read=f=>JSON.parse(fs.readFileSync(new URL(f,import.meta.url),'utf8'));
const data=read('./math_to_atoms_data_v001.json'),history=read('./math_to_atoms_history_v017.json'),values=defaultValues(read('./math_to_atoms_values_v013.json'));
const projection=defaultProjection(),impact=scenarioOutcomes(DEFAULT_SCENARIO,values),worked=defaultWorked();
const near=(a,b)=>assert.ok(Math.abs(a-b)<Math.max(1e-10,Math.abs(b)*1e-12),`${a} != ${b}`);
test('headline economics is annual nominal resources freed, with GDP only as a denominator',()=>{
 near(impact.economicValue,1.8112e12);near(impact.gdpPercent,1.5093333333333334);
 const s=benefitSeries('economy',impact,DEFAULT_SCENARIO,projection);assert.equal(s.baseline,0);near(s.end,impact.economicValue);
 assert.match(benefitReadout('economy',s,impact),/\$18.1T resources freed over 20 years/);
});
test('GDP and lifespan histories do not acquire scenario gains when the slider changes',()=>{
 const none=projectAll(history,projection,scenarioOutcomes({...DEFAULT_SCENARIO,capturePercent:0},values));
 const full=projectAll(history,projection,scenarioOutcomes({...DEFAULT_SCENARIO,capturePercent:100},values));
 for(const axis of ['economy','health']){assert.equal(full[axis].contextOnly,true);assert.deepEqual(full[axis].points,none[axis].points);assert.equal(full[axis].delta,0);assert.doesNotMatch(historyPanel(axis,history,2046,full[axis],'full'),/With change/);assert.doesNotMatch(historyPanel(axis,history,2046,full[axis],'full',{minimal:true}),/class="outlook-scenario"/);}
});
test('health reports saved healthy years rather than treating the birth conversion as a forecast',()=>{
 const s=benefitSeries('health',impact,DEFAULT_SCENARIO,projection);near(s.end,139.85e6);near(s.points[10].withScenario,69.925e6);
 const text=benefitReadout('health',s,impact);assert.match(text,/1.4B healthy years saved/);assert.match(text,/Rough lifespan illustration/);assert.match(text,/not a life-expectancy forecast/);
});
test('energy is included once, quantities do not sum into project years, and full time savings remain finite',()=>{
 near(impact.components.reduce((a,c)=>a+c.value,0),impact.economicValue);
 const full=scenarioOutcomes({...DEFAULT_SCENARIO,capturePercent:100,adoptionPercent:100,localGainPercent:100},values);
 const time=benefitSeries('time',full,DEFAULT_SCENARIO,projection);assert.equal(time.end,0);assert.doesNotMatch(benefitCurve(time,time),/NaN|Infinity/);assert.doesNotMatch(benefitReadout('time',time,full),/data-benefit-total/);
});
test('the three worked paths calculate independent scopes and correctly convert EJ to GJ',()=>{
 const results=WORKED_CASES.map(c=>workedResult(c,worked[c.id],data,25,50));
 near(results[0].gross,31.5e6);near(results[1].physical,.01075);near(results[1].gross,107.5e6);near(results[2].gross,125e3);
 for(const r of results){assert.equal(r.active,true);assert.equal(r.net,null);}
});
test('a graph link switches a worked path off, but link strength is not a benefit multiplier',()=>{
 const c=WORKED_CASES[0],copy=structuredClone(data),m=copy.math.find(m=>m.id===c.math);
 const base=workedResult(c,worked[c.id],copy,25,50).gross;m.links[c.problem]=1;assert.equal(workedResult(c,worked[c.id],copy,25,50).gross,base);
 m.links[c.problem]=0;assert.equal(workedResult(c,worked[c.id],copy,25,50).gross,null);
 m.links[c.problem]=3;copy.outcomes.find(o=>o.id===c.outcome).links[c.problem]=0;assert.equal(workedResult(c,worked[c.id],copy,25,50).active,false);
});
test('costs and unknown energy valuation stay explicit, and settings round-trip without losing precision',()=>{
 const s=structuredClone(worked);s.aviation.annualCost=10e6;near(workedResult(WORKED_CASES[0],s.aviation,data,25,50).net,21.5e6);
 s.ammonia.pricePerGJ=null;assert.equal(workedResult(WORKED_CASES[1],s.ammonia,data,25,50).gross,null);
 s.maintenance.baseline=12345678.901;assert.deepEqual(validateWorked(JSON.parse(JSON.stringify(s))),s);
 assert.throws(()=>validateWorked({aviation:{improvementPercent:101}}));assert.throws(()=>validateWorked(JSON.parse('{"__proto__":{}}')));assert.deepEqual(validateWorked(undefined),defaultWorked());
});
