import {scenarioOutcomes} from './math_to_atoms_scenario_v029.mjs';
import {fmt,money,pct,compact} from './math_to_atoms_value_model_v027.mjs';
export const PRICE_DEFAULTS=Object.freeze({daly:14500,capital:1.5,carbon:100,investmentT:10,finance:5});
const limits={daly:1e6,capital:5,carbon:1e4,investmentT:1e4,finance:100};
export function validatePricing(input=PRICE_DEFAULTS){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!Object.hasOwn(limits,k)))throw new Error('Invalid value assumptions.');
 const p={...PRICE_DEFAULTS,...input};
 for(const[k,v]of Object.entries(p))if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>limits[k])throw new Error('Enter a valid nonnegative value assumption.');
 return p;
}
export function readPricingCase(search){
 const q=new URLSearchParams(search);if(!Object.keys(limits).some(k=>q.has('value_'+k)))return null;
 const p={};for(const k of Object.keys(limits)){const raw=q.get('value_'+k);if(raw===null||raw.trim()==='')return null;p[k]=Number(raw);}
 try{return validatePricing(p);}catch{return null;}
}
export function pricingURL(url,p){const u=new URL(url);for(const k of Object.keys(limits))u.searchParams.set('value_'+k,String(p[k]));return u;}
export function clearPricingURL(url){const u=new URL(url);for(const k of Object.keys(limits))u.searchParams.delete('value_'+k);return u;}
export function welfareValue(i,p,years=20){
 const health=i.health.averted*p.daly,combined=i.economicValue===null?null:i.economicValue+health;
 const energyGDP=i.components[0].value===null?null:i.components[0].value*p.capital;
 const released=p.investmentT*1e12*i.deliverySaved/2;
 return {health,combined,energyGDP,energyGDPPercent:energyGDP===null?null:energyGDP/i.gdp*100,climate:i.carbonAvoided*1e9*p.carbon,released,delivery:released*p.finance/100,globalHealth:i.health.baseline*p.daly,cumulative:combined===null?null:combined*years/2};
}
export function opportunityCases(settings,values,pricing,years=20){
 return [{id:'published',name:'25% reached · half used',reach:25,use:50},{id:'all-half',name:'All reached · half used',reach:100,use:50},{id:'all-used',name:'All reached · fully used',reach:100,use:100}].map(c=>{
  const s={...settings,capturePercent:c.reach,adoptionPercent:c.use},impact=scenarioOutcomes(s,values);
  return {...c,impact,value:welfareValue(impact,pricing,years)};
 });
}
const cash=(v,suffix='/yr')=>v===null?'Not set':money(v)+suffix;
export function welfareHTML(i,settings,values,p,years){
 const w=welfareValue(i,p,years),cases=opportunityCases(settings,values,p,years),end=2026+years;
 const rows=[['Resource savings',cash(i.economicValue),'Included'],['Health value',cash(w.health),'Included'],['Energy GDP benchmark',cash(w.energyGDP),'Alternative measure'],['Climate value',cash(w.climate),'Separate · overlap'],['Faster delivery',cash(w.delivery),'Separate · overlap']];
 return `<div class="worth-head"><div><h3 class="worth-title">Estimated consumer benefits</h3><p class="worth-label">Gross annual value · by ${end}</p><p class="worth-total" data-worth-total>${cash(w.combined)}</p><p class="worth-addition">${cash(i.economicValue)} resources + ${cash(w.health)} health value</p></div><p class="worth-scope">Resource savings plus a chosen value for healthier lives. Before costs; not GDP or cash income.</p></div><div class="worth-cases" aria-label="Compare mathematical reach and deployment">${cases.map(c=>`<button type="button" data-worth-preset="${c.id}" aria-pressed="${settings.capturePercent===c.reach&&settings.adoptionPercent===c.use}"><span>${c.name}</span><strong>${cash(c.value.combined)}</strong></button>`).join('')}</div><p class="worth-case-note">These cases keep your ${pct(settings.localGainPercent)} improvement and ${years}-year rollout. “All reached” assumes solving the relevant math unlocks all the selected opportunity; it does not make deployment automatic.</p><details class="worth-work"><summary>Show the dollar calculation</summary><table class="worth-table"><thead><tr><th>Outcome</th><th>Annual value</th><th>In the total?</th></tr></thead><tbody>${rows.map(r=>`<tr>${r.map((v,j)=>j===0?`<th scope="row">${v}</th>`:`<td>${v}</td>`).join('')}</tr>`).join('')}</tbody></table><p>This is a broad benefit estimate, not a measured consumer-surplus total. It includes resource savings and the chosen value of health gains.</p><p><strong>Health:</strong> the reference burden is ${compact(i.health.baseline)} DALYs a year. At ${money(p.daly)} per DALY averted, the whole burden has a benchmark value of ${cash(w.globalHealth)}. Your ${pct(i.effect*100)} reduction saves ${compact(i.health.averted)} DALYs × ${money(p.daly)} = ${cash(w.health)}. A DALY is one healthy year lost to illness, disability or early death.</p><p>${money(p.daly)} is a uniform value judgment per healthy year, roughly annual world output per person at the default. It values health itself, rather than adding lost wages or medical bills again. It is not an accepted treatment threshold, a measured willingness to pay, or money received by patients.</p><p><strong>Energy and GDP:</strong> ${cash(i.components[0].value)} energy saving × ${fmt(p.capital)} capital response = ${cash(w.energyGDP)}, ${w.energyGDPPercent===null?'not set':pct(w.energyGDPPercent)} of reference GDP. This is an illustrative long-run GDP-level interpretation of the same energy benefit, not another amount to add. It assumes genuine productivity gains and an appropriate energy-output weight. It does not establish net GDP after all transition costs or a permanent increase in growth.</p><p><strong>Climate:</strong> ${fmt(i.carbonAvoided)} billion tonnes × ${money(p.carbon)}/tonne = ${cash(w.climate)}. This is an assumed avoided-damage valuation. It can overlap the health and disaster benefits, so it is shown separately.</p><p><strong>Delivery:</strong> assume ${cash(p.investmentT*1e12)} in project spending, spending spread evenly during construction, and a ${pct(p.finance)} annual capital charge. Shortening projects by ${fmt(i.deliverySaved)} years releases ${money(w.released)} of capital; its annual financing value is ${cash(w.delivery)}. This can overlap production savings and the capital response, so it is shown separately.</p><p><strong>Over the transition:</strong> an even build-up gives ${cash(w.cumulative,'')} of undiscounted gross resource and health value over ${years} years. The full annual amount arrives in ${end}; it is not received from year one. Starting spending, burden and value per DALY are held fixed.</p><p class="worth-sources"><a href="https://doi.org/10.1016/S0140-6736(25)01637-X" target="_blank" rel="noopener noreferrer">GBD burden ↗</a> · <a href="https://link.springer.com/article/10.1007/s40258-023-00802-y" target="_blank" rel="noopener noreferrer">DALY valuation benchmark ↗</a> · <a href="https://www.imf.org/-/media/files/publications/cr/2024/english/1chlea2024002.pdf#page=8" target="_blank" rel="noopener noreferrer">IMF electricity and GDP ↗</a></p></details>`;
}
export function mountWelfare(host,p){
 if(host.querySelector('[data-worth-dynamic]'))return;
 const fields=[['daly','Value per healthy year ($)'],['capital','Energy capital response (×)'],['carbon','Climate damage value ($/tonne)'],['investmentT','Annual project spending ($T)'],['finance','Annual capital charge (%)']];
 host.innerHTML='<div data-worth-dynamic></div><details class="worth-prices"><summary>Change the dollar assumptions</summary><div class="worth-inputs">'+fields.map(([k,label])=>`<label>${label}<input type="number" min="0" max="${limits[k]}" step="any" data-worth-price="${k}" value="${p[k]}"></label>`).join('')+'</div><button type="button" data-worth-reset>Reset dollar assumptions</button><p>Only resources and health are added. GDP, climate and delivery are shown separately to avoid counting the same benefit twice.</p></details>';
}
export function updateWelfare(host,i,settings,values,p,years){
 const open=host.querySelector('.worth-work')?.open;
 mountWelfare(host,p);host.querySelector('[data-worth-dynamic]').innerHTML=welfareHTML(i,settings,values,p,years);
 if(open)host.querySelector('.worth-work').open=true;
 for(const input of host.querySelectorAll('[data-worth-price]'))if(input!==document.activeElement)input.value=p[input.dataset.worthPrice];
}
export function wireWelfare(host,{getPricing,onPricing,onPreset,onError=()=>{}}){
 host.addEventListener('change',e=>{const key=e.target.dataset.worthPrice;if(!key)return;const p={...getPricing(),[key]:e.target.value===''?NaN:Number(e.target.value)};try{validatePricing(p);onPricing(p);}catch(error){e.target.value=getPricing()[key];onError(error.message);}});
 host.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.matches('[data-worth-price]')){e.preventDefault();e.target.blur();}});
 host.addEventListener('click',e=>{const preset=e.target.closest('[data-worth-preset]');if(preset)onPreset(preset.dataset.worthPreset);if(e.target.closest('[data-worth-reset]'))onPricing({...PRICE_DEFAULTS});});
}
