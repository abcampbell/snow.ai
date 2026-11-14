import {COVER_DEFAULTS,COVER_KEYS,readCoverCase,caseURL,clearCaseURL,coverMacro} from './math_to_atoms_cover_case_v034.mjs';
import {defaultValues,fmt,money,pct,compact} from './math_to_atoms_value_model_v027.mjs';
import {DEFAULT_SCENARIO,scenarioOutcomes} from './math_to_atoms_scenario_v029.mjs';
import {defaultProjection,projectAll} from './math_to_atoms_projection_v031.mjs';
import {trendCards,deltaText} from './math_to_atoms_timeline_v031.mjs';

const root=document.querySelector('[data-cover-interactive]'),controls=document.querySelector('[data-cover-controls]');
let current=readCoverCase(location.search)||{...COVER_DEFAULTS},data,energy,values,scale,activeKey=null;
const settings=()=>({...DEFAULT_SCENARIO,...coverMacro(current)});
function impact(c=current){return scenarioOutcomes({...DEFAULT_SCENARIO,...coverMacro(c)},values);}
function setScale(key){
 activeKey=key;
 if(key!=='years')scale=impact({...current,[key]:100});
}
function paintInputs(){
 for(const key of COVER_KEYS){
  const input=controls.querySelector(`[data-cover-input="${key}"]`);
  input.value=current[key];
  input.style.setProperty('--fill',((current[key]-Number(input.min))/(Number(input.max)-Number(input.min))*100)+'%');
  input.setAttribute('aria-valuetext',key==='years'?fmt(current[key])+' years':pct(current[key]));
  controls.querySelector(`[data-cover-output="${key}"]`).textContent=key==='years'?fmt(current[key])+' years':pct(current[key]);
 }
}
function render(){
 const s=settings(),projection={...defaultProjection(),horizonYears:current.years},i=impact();
 root.querySelector('[data-cover-charts]').innerHTML=trendCards(data,projectAll(data,projection,i),projectAll(data,projection,scale),i,projection,scale,energy,s,{snapshot:true});
 for(const svg of root.querySelectorAll('[data-delta-curve]')){
  const label=document.createElementNS('http://www.w3.org/2000/svg','text');
  label.setAttribute('class','delta-scale');label.setAttribute('x','20');label.setAttribute('y','10');
  label.textContent=deltaText(svg.dataset.deltaCurve,Number(svg.dataset.domainMax));svg.append(label);
  const zero=label.cloneNode(false);zero.setAttribute('x','12');zero.setAttribute('y','82');zero.setAttribute('text-anchor','end');zero.textContent='0';svg.append(zero);
 }
 root.querySelector('[data-master-axis="health"] .live-compare').textContent='Healthy years saved each year';
 const end=2026+current.years,effect=pct(i.effect*100);
 document.querySelector('[data-cover-period]').textContent='What changes by '+end+'?';
 document.querySelector('[data-cover-description]').innerHTML=`At these settings, the overall change is <strong>${effect}</strong>, built up over <strong>${fmt(current.years)} years</strong>.`;
 const outputs={economy:money(i.economicValue)+'/yr',health:compact(i.health.averted)+'/yr',energy:effect+' cheaper',climate:fmt(i.carbonAvoided)+' Gt/yr',time:effect+' shorter'};
 for(const [axis,value]of Object.entries(outputs))document.querySelector(`[data-cover-mini="${axis}"]`).textContent=value;
 document.querySelector('[data-cover-note]').textContent=`The blue gains build from 2026 to ${end}. The full annual benefit arrives at the end; the early years deliver less.`;
 document.querySelector('[data-cover-example]').textContent=`Start with $100 of spending. Math helps us improve ${money(current.reach)} of it. The new solutions get used on ${money(current.reach*current.use/100)}. Cut those costs by ${pct(current.gain)}, and we save ${money(i.effect*100)} out of the original $100.`;
 document.querySelector('[data-cover-explained]').textContent=`By ${end}, that gives ${money(i.economicValue)} a year in savings and avoided losses, including ${money(i.components[0].value)} from energy. Separately, we save ${compact(i.health.averted)} healthy years of life each year and avoid ${fmt(i.carbonAvoided)} billion tonnes of CO₂ from energy. A ten-year project takes ${fmt(i.deliveryAfter)} years.`;
 document.querySelector('[data-cover-method-effect]').textContent=`This example uses the same ${effect} change for costs, lost healthy years, emissions and project times. The starting spending and health figures stay fixed. You choose how much useful improvement the math makes; the model shows what follows.`;
 for(const a of document.querySelectorAll('a[data-cover-model]'))a.href=caseURL(a.href,current).href;
 paintInputs();
}
function commit(){
 activeKey=null;
 history.replaceState(null,'',caseURL(location.href,current));
 document.querySelector('[data-cover-status]').textContent=document.querySelector('[data-cover-description]').textContent;
}
async function boot(){
 try{
  const files=['math_to_atoms_history_v017.json','math_to_atoms_energy_history_v028.json','math_to_atoms_values_v013.json'];
  const loaded=await Promise.all(files.map(async name=>{const r=await fetch(new URL('./'+name,import.meta.url));if(!r.ok)throw new Error('Reference data unavailable.');return r.json();}));
  [data,energy]=loaded;values=defaultValues(loaded[2]);scale=impact({...current,reach:100});
  render();controls.disabled=false;root.setAttribute('aria-busy','false');
  controls.addEventListener('pointerdown',e=>{const key=e.target.dataset.coverInput;if(key)setScale(key);});
  controls.addEventListener('input',e=>{
   const key=e.target.dataset.coverInput;if(!key)return;
   if(activeKey!==key)setScale(key);
   const n=Number(e.target.value);if(!Number.isFinite(n))return;
   current[key]=Math.max(key==='years'?1:0,Math.min(100,key==='years'?Math.round(n):n));
   render();
  });
  controls.addEventListener('change',e=>{if(e.target.dataset.coverInput)commit();});
  document.querySelector('[data-cover-reset]').addEventListener('click',()=>{
   current={...COVER_DEFAULTS};activeKey=null;scale=impact({...current,reach:100});render();
   history.replaceState(null,'',clearCaseURL(location.href));
   document.querySelector('[data-cover-status]').textContent='Published case restored.';
  });
  window.addEventListener('popstate',()=>{current=readCoverCase(location.search)||{...COVER_DEFAULTS};activeKey=null;scale=impact({...current,reach:100});render();});
 }catch{
  root.setAttribute('aria-busy','false');document.querySelector('[data-cover-description]').textContent='The published case is shown below. Reload to try the sliders.';
 }
}
boot();
