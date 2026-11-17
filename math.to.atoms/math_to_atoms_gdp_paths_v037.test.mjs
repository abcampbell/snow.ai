import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gdpPaths,gdpPlot,gdpPathsHTML} from './math_to_atoms_gdp_paths_v037.mjs';
import {defaultValues} from './math_to_atoms_value_model_v027.mjs';
import {DEFAULT_SCENARIO,scenarioOutcomes} from './math_to_atoms_scenario_v029.mjs';
import {defaultProjection,projectAll} from './math_to_atoms_projection_v031.mjs';
import {PRICE_DEFAULTS} from './math_to_atoms_welfare_v036.mjs';
const read=n=>JSON.parse(fs.readFileSync(new URL(n,import.meta.url),'utf8'));
const data=read('./math_to_atoms_history_v017.json'),values=defaultValues(read('./math_to_atoms_values_v013.json'));
const projection=defaultProjection(),impact=scenarioOutcomes(DEFAULT_SCENARIO,values);
const forecast=projectAll(data,projection,impact).economy;
test('GDP gap uses the energy output share, not nominal savings or health dollars added to PPP GDP',()=>{
 const f=gdpPaths(forecast,impact);
 assert.equal(f.ratio,.0075);assert.equal(f.referenceGain,900e9);
 assert.equal(f.withMath,f.baseline*1.0075);assert.equal(f.delta,f.baseline*.0075);
 assert.equal(f.points.find(p=>p.year===2026).withMath,f.points.find(p=>p.year===2026).baseline);
 const mid=f.points.find(p=>p.year===2036);assert.equal(mid.withMath,mid.baseline*1.00375);
 assert.deepEqual(gdpPaths(forecast,impact,{...PRICE_DEFAULTS,daly:50000}).points,f.points);
 assert.equal(gdpPaths(forecast,impact,{...PRICE_DEFAULTS,capital:2}).ratio,.01);
});
test('zero effects, unavailable spending, horizon and chart representations remain explicit',()=>{
 assert.equal(gdpPaths(forecast,{...impact,components:[{...impact.components[0],value:0}]}).delta,0);
 const missing=gdpPaths(forecast,{...impact,components:[{...impact.components[0],value:null}]});
 assert.equal(missing.withMath,null);assert.equal(missing.delta,null);assert.ok(!gdpPlot(missing).includes('data-gdp-with'));
 for(const years of [1,20,50,100]){
  const p={...projection,horizonYears:years},f=gdpPaths(projectAll(data,p,impact).economy,impact);
  for(const view of ['full','future'])for(const width of [340,760]){
   const svg=gdpPlot(f,{view,width});assert.ok(svg.includes(`data-end-year="${2026+years}"`));assert.ok(svg.includes('data-gdp-baseline'));assert.ok(svg.includes('data-gdp-with'));assert.ok(!svg.includes('NaN'));
  }
 }
 const html=gdpPathsHTML(gdpPaths(forecast,impact),impact);
 assert.ok(html.includes('Energy productivity estimate only'));assert.ok(html.includes('2021 purchasing power'));assert.ok(html.includes('not a currency conversion'));
});
