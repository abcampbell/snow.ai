import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateEnergyHistory,energyHistorySeries,energyCurve,energyOutlook} from './math_to_atoms_energy_v028.mjs';
const history=JSON.parse(fs.readFileSync(new URL('./math_to_atoms_energy_history_v028.json',import.meta.url),'utf8'));
const impact={gdp:120e12,effect:.2,components:[{id:'energy',base:12e12}]};
const e=energyOutlook(impact,20);
test('the published source has one real observation for every year from 1900 to 2025',()=>{
 assert.equal(validateEnergyHistory(history),history);assert.equal(history.points.length,126);
 assert.deepEqual(history.points[0],[1900,297.15207]);assert.deepEqual(history.points.at(-1),[2025,434.62518]);
 const invalid=structuredClone(history);invalid.points.splice(10,1);assert.throws(()=>validateEnergyHistory(invalid));
 const invalidBase=structuredClone(history);invalidBase.base_value=1;assert.throws(()=>validateEnergyHistory(invalidBase));
});
test('the history toggle changes the same visible period as the other charts',()=>{
 const full=energyHistorySeries(e,history,'full'),recent=energyHistorySeries(e,history,'recent');
 assert.equal(full.startYear,1900);assert.equal(full.observations.length,126);assert.equal(full.endYear,2046);
 assert.equal(recent.startYear,2006);assert.equal(recent.observations[0].year,2006);assert.equal(recent.observations.length,20);
 assert.equal(full.observations.at(-1).value,100);assert.ok(Math.abs(full.observations[0].value-297.15207/434.62518*100)<1e-12);
});
test('source observations stay fixed and the assumed change only starts in 2026',()=>{
 const full=energyHistorySeries(e,history,'full'),none=energyHistorySeries({...e,cutPercent:0},history,'full');
 assert.deepEqual(full.observations,none.observations);
 assert.deepEqual(full.future[0],{year:2025,baseline:100,withScenario:100});
 assert.deepEqual(full.future[1],{year:2026,baseline:100,withScenario:100});
 assert.equal(full.future.find(p=>p.year===2036).withScenario,90);assert.equal(full.future.at(-1).withScenario,80);
 assert.ok(none.future.every(p=>p.baseline===p.withScenario));
});
test('changing the horizon keeps the source base and percent reduction while moving the endpoint',()=>{
 const longer=energyHistorySeries(energyOutlook(impact,30),history,'full');
 assert.equal(longer.endYear,2056);assert.equal(longer.future.at(-1).withScenario,80);
 assert.equal(energyOutlook(impact,30).savings,2.4e12);
 const svg=energyCurve(e,20,true,history,'full');assert.match(svg,/data-range-start="1900"/);assert.match(svg,/data-observations="126"/);assert.doesNotMatch(svg,/NaN|Infinity/);
});
