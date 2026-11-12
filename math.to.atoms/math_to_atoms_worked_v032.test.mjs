import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {WORKED_CASES,defaultWorked,workedResult,workedSteps,workedCalculation} from './math_to_atoms_worked_v032.mjs';
const data=JSON.parse(fs.readFileSync(new URL('./math_to_atoms_data_v001.json',import.meta.url),'utf8'));
const defaults=defaultWorked(),aviation=WORKED_CASES[0];
const near=(a,b)=>assert.ok(Math.abs(a-b)<Math.max(1e-10,Math.abs(b)*1e-12),`${a} != ${b}`);
test('the screenshot traces $252B to $81.2448M without rounding intermediate arithmetic',()=>{
 const rows=workedSteps(aviation,defaults.aviation,62,52);
 const expected=[252e9,25.2e9,15.624e9,8.12448e9,81.2448e6];
 rows.forEach((r,i)=>near(r.amount,expected[i]));
 near(rows.at(-1).amount,workedResult(aviation,defaults.aviation,data,62,52).gross);
 const html=workedCalculation(aviation,defaults.aviation,workedResult(aviation,defaults.aviation,data,62,52),{capturePercent:62,adoptionPercent:52});
 for(const text of ['$81.2M/yr','$2.52B/yr','3.22%','10% of the fuel bill is assumed eligible','extra savings from better math are unmeasured'])assert.ok(html.includes(text),text);
});
test('removing eligibility and deployment limits exposes the full $2.52B at 1%',()=>{
 const s={...defaults.aviation,eligiblePercent:100};
 near(workedSteps(aviation,s,62,52).at(-1).amount,812.448e6);
 near(workedSteps(aviation,s,100,100).at(-1).amount,2.52e9);
 near(workedSteps(aviation,{...s,improvementPercent:10},100,100).at(-1).amount,25.2e9);
});
test('all traces match results over scopes and gains, including EJ conversion and unset valuation',()=>{
 for(const c of WORKED_CASES)for(const capture of [0,25,62,100])for(const adoption of [0,52,100])for(const eligible of [0,10,100]){
  const s={...defaults[c.id],eligiblePercent:eligible,improvementPercent:2.75};
  near(workedSteps(c,s,capture,adoption).at(-1).amount,workedResult(c,s,data,capture,adoption).gross);
 }
 const c=WORKED_CASES[1],s={...defaults.ammonia,pricePerGJ:null};
 assert.equal(workedSteps(c,s,62,52).at(-1).amount,null);
 assert.equal(workedResult(c,s,data,62,52).gross,null);
});
test('disconnected paths disclose that their arithmetic is not counted',()=>{
 const copy=structuredClone(data);copy.math.find(m=>m.id===aviation.math).links[aviation.problem]=0;
 const r=workedResult(aviation,defaults.aviation,copy,62,52);
 assert.equal(r.gross,null);
 assert.match(workedCalculation(aviation,defaults.aviation,r,{capturePercent:62,adoptionPercent:52}),/arithmetic above is not counted/);
});
