import {fmt,money,pct,compact} from './math_to_atoms_value_model_v027.mjs';
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const WORKED_CASES=Object.freeze([
 {id:'aviation',title:'Turbulence → less aircraft drag',math:'B2',problem:4,outcome:'O4',mathLabel:'Turbulence models',problemLabel:'Wall turbulence',outcomeLabel:'Fuel savings',
  baseline:252e9,baselineLabel:'Airline fuel bill ($B/yr)',scale:1e9,unit:'dollars',eligiblePercent:10,improvementPercent:1,low:.5,high:2,pricePerGJ:null,
  baselineEvidence:'IATA reports a $252B global airline fuel bill for 2025.',baselineSource:'https://www.iata.org/en/pressroom/2026-releases/06-07-middle-east-disruptions-high-fuel-prices-halve-airline-industry-profitability/',
  evidence:'Lufthansa reports about 1% fuel savings on aircraft fitted with AeroSHARK riblet film. Fleet-wide reach and future improvements remain assumptions.',source:'https://www.lufthansagroup.com/en/responsibility/climate-and-environment/operational-efficiency.html',
  scope:'The assumed eligible share limits this example to suitable aircraft and operations. Fuel prices and traffic stay fixed. The 2% high case is a target, not the reported result.',
  gap:'Better turbulence models could improve drag-reduction designs. Existing riblets do not establish that a new theorem is required.'},
 {id:'ammonia',title:'Molecular prediction → lower process energy',math:'B1',problem:3,outcome:'O2',mathLabel:'Interacting electrons',problemLabel:'Catalyst design',outcomeLabel:'Energy saved',
  baseline:8.6,baselineLabel:'Ammonia energy input (EJ/yr)',scale:1,unit:'EJ',eligiblePercent:10,improvementPercent:10,low:5,high:15,pricePerGJ:10,
  baselineEvidence:'IEA reports 8.6 EJ of ammonia-sector energy input in 2020, including feedstock.',baselineSource:'https://www.iea.org/reports/ammonia-technology-roadmap/executive-summary',
  evidence:'IEA distinguishes feedstock from process energy and reports substantial differences in plant efficiency. It does not estimate the effect of a future mathematics breakthrough.',source:'https://www.iea.org/reports/ammonia-technology-roadmap/executive-summary',
  scope:'Only the assumed eligible share is affected. This excludes treating all feedstock energy as removable by a catalyst. The 5–15% improvement and $10/GJ valuation are assumptions.',
  gap:'Better molecular calculations could improve catalyst screening. Converting that into a plant energy saving requires engineering evidence.'},
 {id:'maintenance',title:'Failure prediction → lower maintenance cost',math:'B14',problem:25,outcome:'O5',mathLabel:'Degradation models',problemLabel:'Transformer life',outcomeLabel:'Infrastructure costs',
  baseline:10e6,baselineLabel:'One operator’s maintenance budget ($M/yr)',scale:1e6,unit:'dollars',eligiblePercent:100,improvementPercent:10,low:8,high:12,pricePerGJ:null,
  baselineEvidence:'The $10M annual operator budget is an example assumption, not a measured global total.',baselineSource:null,
  evidence:'DOE’s 2010 guide cites estimated 8–12% savings for predictive versus preventive maintenance. That range is not a transformer-specific measured effect.',source:'https://www.energy.gov/sites/default/files/2020/04/f74/omguide_complete_w-eo-disclaimer.pdf',
  scope:'One operator’s budget only. Maintenance savings are distinct from the global disaster-loss reference. Applicability and deployment must be checked for the selected equipment.',
  gap:'A better life model can help schedule maintenance. Savings depend on inspections, intervention choices and implementation costs.'}
]);
export function defaultWorked(){return Object.fromEntries(WORKED_CASES.map(c=>[c.id,{baseline:c.baseline,eligiblePercent:c.eligiblePercent,improvementPercent:c.improvementPercent,pricePerGJ:c.pricePerGJ,annualCost:null}]));}
export function validateWorked(input){
 const result=defaultWorked();if(input===undefined)return result;
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(id=>!Object.hasOwn(result,id)))throw new Error('Invalid worked examples.');
 for(const[id,v]of Object.entries(input)){
  if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!Object.hasOwn(result[id],k)))throw new Error('Invalid example settings.');
  result[id]={...result[id],...v};
  for(const[k,n]of Object.entries(result[id])){
   if(['annualCost','pricePerGJ'].includes(k)&&n===null)continue;
   const max=k.endsWith('Percent')?100:k==='pricePerGJ'?10000:1e16;
   if(typeof n!=='number'||!Number.isFinite(n)||n<0||n>max)throw new Error('Enter a valid nonnegative example value; percentages run from 0 to 100.');
  }
 }
 return result;
}
export function workedResult(def,settings,data,capturePercent=100,adoptionPercent=100,improvement=settings.improvementPercent){
 const math=data.math.find(m=>m.id===def.math),outcome=data.outcomes.find(o=>o.id===def.outcome);
 const active=(math?.links[def.problem]??0)>0&&(outcome?.links[def.problem]??0)>0;
 const fraction=settings.eligiblePercent/100*capturePercent/100*adoptionPercent/100*improvement/100;
 const physical=active?settings.baseline*fraction:null;
 const gross=physical===null?null:def.unit==='EJ'?(settings.pricePerGJ===null?null:physical*1e9*settings.pricePerGJ):physical;
 return {active,fraction,physical,gross,net:gross===null||settings.annualCost===null?null:gross-settings.annualCost,annualCost:settings.annualCost};
}
function caseField(c,key,label,value,scale=1,optional=false){return `<label>${label}<input type="number" min="0" step="any"${key.endsWith('Percent')?' max="100"':''} data-worked-case="${c.id}" data-worked-field="${key}" data-worked-scale="${scale}" value="${value===null?'':value/scale}"${optional?' placeholder="Not set"':''}></label>`;}
export function renderWorked(host,settings,data,macro,source=null){
 const open=new Set([...host.querySelectorAll('[data-worked-details][open]')].map(d=>d.dataset.workedDetails));
 const outputs=WORKED_CASES.map(c=>{
  const s=settings[c.id],r=workedResult(c,s,data,macro.capturePercent,macro.adoptionPercent);
  const main=!r.active?'Path disconnected':r.gross===null?'Set energy value':money(r.gross)+'/yr';
  const chain=`<button data-select-type="math" data-select-id="${c.math}">${c.mathLabel}</button><span>→</span><button data-select-type="problems" data-select-id="${c.problem}">${c.problemLabel}</button><span>→</span><button data-select-type="outcomes" data-select-id="${c.outcome}">${c.outcomeLabel}</button>`;
  const range=[['Low',c.low],['Base',c.improvementPercent],['High',c.high]].map(([name,v])=>{const x=workedResult(c,s,data,macro.capturePercent,macro.adoptionPercent,v);return `<button data-worked-preset="${c.id}" data-worked-improvement="${v}" aria-pressed="${s.improvementPercent===v}"><span>${name} · ${pct(v)}</span><b>${x.gross===null?'—':money(x.gross)+'/yr'}</b></button>`;}).join('');
  const baselineTag=c.baselineSource?'Data':'Assumption';
  const fields=caseField(c,'baseline',c.baselineLabel,s.baseline,c.scale)+caseField(c,'eligiblePercent','Eligible share (%)',s.eligiblePercent)+caseField(c,'improvementPercent','Improvement where used (%)',s.improvementPercent)+(c.unit==='EJ'?caseField(c,'pricePerGJ','Energy value ($/GJ)',s.pricePerGJ,1,true):'')+caseField(c,'annualCost','Annual program cost at this deployment ($M)',s.annualCost,1e6,true);
  return `<article class="worked-case" data-worked-id="${c.id}"><h3>${c.title}</h3><div class="worked-chain">${chain}</div><p class="worked-value" data-worked-value>${main}</p><p class="worked-caption">Gross savings · ${pct(macro.capturePercent)} reached × ${pct(macro.adoptionPercent)} used</p><div class="worked-range">${range}</div><details data-worked-details="${c.id}"${open.has(c.id)?' open':''}><summary>Evidence & inputs</summary><p><span class="evidence-tag">${baselineTag}</span> ${escape(c.baselineEvidence)}${c.baselineSource?` <a href="${c.baselineSource}" target="_blank" rel="noopener noreferrer">Source ↗</a>`:''}</p><p><span class="evidence-tag">Data</span> ${escape(c.evidence)} <a href="${c.source}" target="_blank" rel="noopener noreferrer">Source ↗</a></p><p><span class="evidence-tag assumption">Assumption</span> ${escape(c.gap)} ${escape(c.scope)}</p><div class="worked-fields">${fields}</div><div class="worked-net" data-worked-net>${r.net===null?'Net benefit: enter annual program cost.':`Net after entered program cost: ${money(r.net)}/yr`}</div>${c.unit==='EJ'?`<p data-worked-physical>${r.physical===null?'—':fmt(r.physical)+' EJ/yr'} saved · ${r.physical===null?'—':fmt(r.physical*277.7777778)+' TWh/yr'}</p>`:''}<p class="worked-equation">${c.unit==='EJ'?'Energy input':'Budget'} × eligible share × reached × used × improvement${c.unit==='EJ'?' × assumed $/GJ':''}. Costs are deducted only when entered. Low/base/high are scenarios, not confidence intervals. Graph links switch a path on or off; scores and weights do not multiply its benefits.</p></details></article>`;
 });
 const html=`<div class="panel-heading"><div><div class="eyebrow">Math → application → benefit</div><h2>Three worked paths</h2></div><span class="evidence-tag assumption">Scenarios</span></div><p class="worked-intro">Sources support baselines or existing technologies. The math link and deployment remain hypotheses. These examples are separate and are not added to the headline totals.</p><div class="worked-grid">${outputs.join('')}</div>`;
 if(source&&host.contains(source)){
  for(const node of host.querySelectorAll('[data-worked-id]')){
   const holder=document.createElement('div');holder.innerHTML=outputs[WORKED_CASES.findIndex(c=>c.id===node.dataset.workedId)];
   for(const selector of ['[data-worked-value]','.worked-range','[data-worked-net]','[data-worked-physical]']){const a=node.querySelector(selector),b=holder.querySelector(selector);if(a&&b)a.replaceWith(b);}
  }
 }else host.innerHTML=html;
}
