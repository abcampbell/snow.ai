import fs from 'node:fs';
import {defaultValues} from './math_to_atoms_value_model_v027.mjs';
import {DEFAULT_SCENARIO} from './math_to_atoms_scenario_v029.mjs';
import {PRICE_DEFAULTS,opportunityCases} from './math_to_atoms_welfare_v036.mjs';
const refs=JSON.parse(fs.readFileSync(new URL('./math_to_atoms_values_v013.json',import.meta.url),'utf8')),values=defaultValues(refs);
const cases=opportunityCases(DEFAULT_SCENARIO,values,PRICE_DEFAULTS,20);
fs.writeFileSync(new URL('./math_to_atoms_valuation_v036.json',import.meta.url),JSON.stringify({schema_version:1,referenceYear:2026,endYear:2046,years:20,prices:PRICE_DEFAULTS,cases,sensitivity:[5000,14500,50000].map(daly=>({daly,allHalf:opportunityCases(DEFAULT_SCENARIO,values,{...PRICE_DEFAULTS,daly},20)[1].value.combined}))},null,2));
console.log('Built valuation references from the live calculation.');
