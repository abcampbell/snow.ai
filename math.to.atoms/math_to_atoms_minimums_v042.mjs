export const DEFAULT_MINIMUMS=Object.freeze({energyCostFloorPercent:20,productionCostFloorPercent:20,deliveryTimeFloorPercent:20});
export const MINIMUM_KEYS=Object.keys(DEFAULT_MINIMUMS);
export function validateMinimums(input={}){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!MINIMUM_KEYS.includes(k)))throw new Error('Invalid minimum-cost assumptions.');
 const value={...DEFAULT_MINIMUMS,...input};
 for(const n of Object.values(value))if(typeof n!=='number'||!Number.isFinite(n)||n<1||n>100)throw new Error('Minimum remaining cost or time must be 1–100% of the starting value.');
 return value;
}
export function readMinimums(search){
 const q=new URLSearchParams(search);if(!MINIMUM_KEYS.some(k=>q.has('limit_'+k)))return null;
 const value={};for(const k of MINIMUM_KEYS){const raw=q.get('limit_'+k);if(raw===null||raw.trim()==='')return null;value[k]=Number(raw);}
 try{return validateMinimums(value);}catch{return null;}
}
export function minimumsURL(url,value){const u=new URL(url);for(const k of MINIMUM_KEYS)u.searchParams.set('limit_'+k,String(value[k]));return u;}
export function clearMinimumsURL(url){const u=new URL(url);for(const k of MINIMUM_KEYS)u.searchParams.delete('limit_'+k);return u;}
const fields=[['energyCostFloorPercent','Energy cost that remains (%)'],['productionCostFloorPercent','Other production cost that remains (%)'],['deliveryTimeFloorPercent','Project time that remains (%)']];
export function minimumsHTML(value,{macro=false}={}){
 return `<summary>Minimum costs & build time</summary><div class="minimum-fields">${fields.map(([key,label])=>`<label>${label}<input type="number" min="1" max="100" step="any" ${macro?'data-macro':'data-minimum'}="${key}" value="${value[key]}" aria-label="${label}"></label>`).join('')}</div><p>Editable assumptions, not measured universal limits. A 20% minimum allows at most an 80% reduction where a solution is used. Reaching every opportunity does not remove equipment, materials, maintenance or construction time.</p><p>Minimums apply before reach and adoption. Health and emissions retain their separate illustrative reductions. <a href="https://atb.nrel.gov/electricity/2024b/equations_%26_variables" target="_blank" rel="noopener noreferrer">Energy cost components</a></p>`;
}
export function paintMinimums(host,value){
 for(const input of host.querySelectorAll('[data-minimum]'))if(input!==document.activeElement)input.value=value[input.dataset.minimum];
}
