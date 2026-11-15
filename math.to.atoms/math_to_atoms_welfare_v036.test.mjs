import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {defaultValues} from './math_to_atoms_value_model_v027.mjs';import {DEFAULT_SCENARIO,scenarioOutcomes} from './math_to_atoms_scenario_v029.mjs';
import {PRICE_DEFAULTS,validatePricing,readPricingCase,pricingURL,clearPricingURL,welfareValue,opportunityCases} from './math_to_atoms_welfare_v036.mjs';
const ref=JSON.parse(fs.readFileSync(new URL('./math_to_atoms_values_v013.json',import.meta.url),'utf8')),values=defaultValues(ref),p=PRICE_DEFAULTS;
const near=(a,b)=>assert.ok(Math.abs(a-b)<Math.max(1e-9,Math.abs(b)*1e-12),`${a} != ${b}`);
test('the three opportunity cases combine resources and health once, excluding alternative/overlapping measures',()=>{
 const c=opportunityCases(DEFAULT_SCENARIO,values,p);const totals=[3.839025e12,15.3561e12,30.7122e12];
 c.forEach((x,j)=>{near(x.value.combined,totals[j]);near(x.value.combined,x.impact.economicValue+x.value.health);});
 near(c[1].value.health,8.1113e12);near(c[1].value.energyGDP,3.6e12);near(c[1].value.climate,768e9);near(c[1].value.delivery,500e9);near(c[1].value.globalHealth,40.5565e12);near(c[1].value.cumulative,153.561e12);
 near(opportunityCases(DEFAULT_SCENARIO,values,{...p,daly:5000})[1].value.combined,10.0418e12);
 near(opportunityCases(DEFAULT_SCENARIO,values,{...p,daly:50000})[1].value.combined,35.2148e12);
});
test('pricing sensitivity, missing spending, zero outcomes and time stocks keep correct units',()=>{
 const i=scenarioOutcomes(DEFAULT_SCENARIO,values),a=welfareValue(i,p,20),z=welfareValue(scenarioOutcomes({...DEFAULT_SCENARIO,capturePercent:0},values),p);
 near(welfareValue(i,{...p,capital:3}).combined,a.combined);near(welfareValue(i,{...p,carbon:1000}).combined,a.combined);
 near(welfareValue(i,{...p,finance:10}).delivery,2*a.delivery);near(a.released,2.5e12);near(a.delivery,125e9);
 assert.equal(z.combined,0);const missing=structuredClone(i);missing.economicValue=null;missing.components[0].value=null;assert.equal(welfareValue(missing,p).combined,null);assert.equal(welfareValue(missing,p).energyGDP,null);
});
test('price assumptions are bounded and shared URLs preserve case controls and unrelated parameters',()=>{
 const u=pricingURL('https://snow.ai/math.to.atoms/?case_reach=25#case',p);assert.deepEqual(readPricingCase(u.search),p);assert.equal(clearPricingURL(u).search,'?case_reach=25');
 assert.equal(readPricingCase('?value_daly=100'),null);assert.throws(()=>validatePricing({daly:-1}));assert.throws(()=>validatePricing({daly:NaN}));assert.throws(()=>validatePricing({other:1}));assert.deepEqual(validatePricing(),p);
});
