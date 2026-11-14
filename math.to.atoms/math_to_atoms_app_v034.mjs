import {readCoverCase,coverMacro,clearCaseURL} from './math_to_atoms_cover_case_v034.mjs';
import {defaultWorked,validateWorked,renderWorked} from './math_to_atoms_worked_v032.mjs';
import {validateEnergyHistory} from './math_to_atoms_energy_v028.mjs';
import {renderLiveCharts} from './math_to_atoms_timeline_v031.mjs';
import {defaultProjection,validateProjection,projectAll,renderMaster} from './math_to_atoms_projection_v031.mjs';
import {validateHistory} from './math_to_atoms_history_v031.mjs';
import {DEFAULT_WEIGHTS,WEIGHT_LIMITS,copy,score,sensitivity,entityKey,validateWorkspace as validateLedger} from './math_to_atoms_model_v007.mjs';
import {validatePhysical,physicalLabels,formatQuantity} from './math_to_atoms_quantities_v027.mjs';
import {defaultValues,validateValues,marketValue,healthValue,MARKET_IDS,HEALTH_IDS,fmt,compact,money,pct} from './math_to_atoms_value_model_v027.mjs';
import {DEFAULT_SCENARIO,validateScenario,scenarioOutcomes,renderScenarioChart} from './math_to_atoms_scenario_v029.mjs';
import {canonicalOutcome,pathKey,blankPath,defaultPayoffs,validatePayoffs,linkedOutcomes,evaluatePath,payoffPaths} from './math_to_atoms_payoffs_v014.mjs';
import {explanationFor,CAUSAL_APPLICATIONS,CAUSAL_TERMS,CAUSAL_SOURCES} from './math_to_atoms_explanations_v019.mjs';

function plainTitle(type,row){
  const id=type==='problems'?row.n:row.id,explanation=explanationFor(type,id),original=base?.[type]?.find(r=>String(type==='problems'?r.n:r.id)===String(id));
  const custom=type==='outcomes'?original&&row.s!==original.s:original&&row.name!==original.name;
  return custom||!explanation?labelOf(row):explanation.title;
}
function nodeExplanation(type,row){
  const id=type==='problems'?row.n:row.id,e=explanationFor(type,id);if(!e)return '';
  return `<section class="node-intro" aria-label="Explanation"><p class="node-meaning">${escape(e.meaning)}</p><div class="node-example"><h3>For example</h3><p>${escape(e.example)}</p></div>${e.frontier?`<h3>What’s still hard</h3><p>${escape(e.frontier)}</p>`:''}</section>`;
}
function technicalWording(type,row){
  const causal=type==='math'&&row.id==='B15';
  return `<details class="node-technical"><summary>The technical wording</summary><p>${escape(labelOf(row))} · ${escape(type==='problems'?row.n:row.id)}</p>${causal?`<dl>${CAUSAL_TERMS.map(([term,meaning])=>`<dt>${escape(term)}</dt><dd>${escape(meaning)}</dd>`).join('')}</dl><p class="node-definition-sources">${CAUSAL_SOURCES.map(([name,url])=>`<a href="${url}" target="_blank" rel="noopener noreferrer">${escape(name)} ↗</a>`).join(' · ')}</p>`:''}</details>`;
}
function explanationLinks(type,row){
  const id=type==='problems'?row.n:row.id;
  let targets,heading;
  if(type==='math'||type==='outcomes'){
    targets=results.problems.filter(p=>row.links[p.n]>0).map(p=>({type:'problems',id:p.n,row:p,strength:row.links[p.n]})).sort((a,b)=>b.strength-a.strength||a.row.n-b.row.n);heading=type==='math'?'Where it could help':'Applications that could change this';
  }else{
    targets=results.math.filter(m=>m.links[id]>0).map(m=>({type:'math',id:m.id,row:m,strength:m.links[id]}));heading='Math that could help';
  }
  const card=t=>{
    const e=explanationFor(t.type,t.id),description=type==='math'&&id==='B15'?CAUSAL_APPLICATIONS[t.id]:(e?.meaning?e.meaning.split('. ')[0].replace(/[.!?]$/,'')+'.':'Open this application to see what it means.');
    return `<button class="node-application" data-select-type="${t.type}" data-select-id="${t.id}"><strong>${escape(plainTitle(t.type,t.row))}</strong><span>${escape(description||'Open this application to see what it means.')}</span></button>`;
  };
  const outcomes=type==='problems'?results.outcomes.filter(o=>o.links[id]>0):[];
  return `<section class="node-applications"><h3>${heading}</h3>${targets.length?targets.slice(0,3).map(card).join(''):'<p class="small">No connections have been added yet. You can add them under Edit assumptions.</p>'}${targets.length>3?`<details class="node-more-applications"><summary>${type==='problems'?'More math ideas':'More applications'} (${targets.length-3})</summary>${targets.slice(3).map(card).join('')}</details>`:''}${outcomes.length?`<h3 class="node-outcomes-title">What could change</h3><div class="node-outcome-links">${outcomes.map(o=>`<button data-select-type="outcomes" data-select-id="${o.id}">${escape(plainTitle('outcomes',o))}</button>`).join('')}</div>`:''}</section>`;
}
function nodeBenefit(type,row){
  if(type!=='outcomes')return payoffReadout(type,type==='problems'?row.n:row.id);
  const q=quantity(row.id);let text=q.main;
  if(row.id==='O1')text=`${compact(healthValue(state.valuation).averted)} healthy life-years gained per year`;
  if(row.id==='O9'){const h=healthValue(state.valuation);text=`Illustration: ${fmt(h.lifeYears)} extra life-years and ${fmt(h.healthyYears)} extra healthy years per newborn equivalent`;}
  return `<section class="node-current-result"><h3>Current example</h3><p>${escape(text)}</p><span>Uses the settings below.</span></section>`;
}

function payoffField(n,id,key,label,value,optional=false){return `<label class="value-field">${escape(label)}<input type="number" step="any" min="0" ${key==='annualValueBillion'?'':'max="100"'} data-payoff-n="${n}" data-payoff-id="${id}" data-payoff-field="${key}" value="${value??''}" ${optional?'placeholder="Not valued"':''} aria-label="${escape(label)}"></label>`;}
function payoffGlobal(key,label){return `<label class="value-field">${escape(label)}<input type="number" min="0" max="1000000000" step="any" data-payoff-global="${key}" value="${state.payoffs[key]??''}" placeholder="Not valued" aria-label="${escape(label)}"></label>`;}
function payoffResult(r){
  if(!r)return '<span class="small">Payoff not set. Enable this case and edit its assumptions.</span>';
  const main=r.annualValue===null?'Annual dollars not valued':`${money(r.annualValue)}/yr · ${pct(r.gdpPercent)} of global GDP`;
  let detail='';
  if(MARKET_IDS.includes(r.id))detail=`${r.spending===null?'Unset market base':money(r.spending)+'/yr market spending'} × ${pct(r.path.addressablePercent)} reached × ${pct(r.path.adoptionPercent)} adoption → ${pct(r.effectiveCutPercent)} less total market spending. Price −${pct(r.path.priceCutPercent)}; required quantity −${pct(r.path.quantityCutPercent)}.`;
  if(r.health)detail=`${compact(r.dalys)} DALYs/yr averted · LE +${pct(r.health.lifePercent)} · HALE +${pct(r.health.healthyPercent)} (approximate gains).`;
  if(r.id==='O5')detail=`${money(r.quantitySaved)}/yr avoided losses · same coverage as the loss reference.`;
  if(r.id==='O6')detail=`${money(r.capitalReleased)} capital released (stock)${r.path.carryingRatePercent===null?'':` × ${pct(r.path.carryingRatePercent)} annual capital cost`}.`;
  if(r.id==='O7')detail=`${fmt(r.quantitySaved)} years shorter after market reach and adoption. Annual value is a separate explicit assumption.`;
  if(r.id==='O10')detail=`${fmt(r.quantitySaved)} Gt CO₂/yr avoided · monetized only at your chosen $/tonne.`;
  return `<strong class="value-main">${main}</strong><span>${escape(detail)}</span>${r.missing?`<span class="small">${escape(r.missing)}</span>`:''}<span class="small">${escape(r.kind)} · GDP equivalent, before implementation costs${r.path.example?' · energy example':''}</span>`;
}
function payoffEditor(n){
  const outcomes=linkedOutcomes(state.data,n);
  return `<section class="payoff-editor"><h3>Savings & share of GDP</h3><p class="small">If this problem is solved, how much changes and how many people or businesses use it? Set those assumptions below. Connection strengths rank relevance; they do not multiply dollars.</p>${outcomes.map(o=>{
    const id=canonicalOutcome(o.id),key=pathKey(n,id),p=state.payoffs.paths[key]||blankPath(state.valuation,id),r=evaluatePath(state,quantities,n,id);
    let fields='';
    if(MARKET_IDS.includes(id))fields=`${payoffField(n,id,'priceCutPercent','Price reduction (%)',p.priceCutPercent)}${payoffField(n,id,'quantityCutPercent','Required quantity reduction (%)',p.quantityCutPercent)}`;
    else fields=payoffField(n,id,'reductionPercent',id==='O1'?'DALY burden reduction (%)':id==='O7'?'Time reduction (%)':'Reduction (%)',p.reductionPercent);
    if(id==='O1')fields+=`<label class="value-field">Health cause group<select data-payoff-n="${n}" data-payoff-id="${id}" data-payoff-field="healthGroup" aria-label="Health cause group">${[['all','All three groups'],...HEALTH_IDS.map(k=>[k,valueReferences.health.groups[k].name])].map(([k,name])=>`<option value="${k}"${p.healthGroup===k?' selected':''}>${escape(name)}</option>`).join('')}</select></label>${payoffGlobal('dollarPerDaly','Value per DALY ($, optional)')}`;
    if(id==='O6')fields+=payoffField(n,id,'carryingRatePercent','Annual capital carrying cost (%)',p.carryingRatePercent,true);
    if(id==='O7')fields+=payoffField(n,id,'annualValueBillion','Annual savings at this time cut, before adoption ($B)',p.annualValueBillion,true);
    if(id==='O10')fields+=payoffGlobal('carbonDollarPerTonne','Value per tonne CO₂ ($, optional)');
    const baseline=MARKET_IDS.includes(id)?marketValue(state.valuation,id).spending:null;
    const context=MARKET_IDS.includes(id)?`${baseline===null?'Annual spending is not set.':money(baseline)+'/yr market spending.'} Price and quantity changes apply to the reached and adopted share.`:id==='O1'?'Dollar valuation is optional. DALYs and expectancy describe the same benefit once.':id==='O6'?'Released capital is converted to an annual flow using your carrying-cost assumption.':id==='O10'?'A dollar valuation of avoided emissions is a GDP-sized comparison, not cash revenue.':id==='O7'?'Supply annual savings for the chosen time cut; then market reach and adoption scale that amount.':escape(quantities.outcomes[id].scope);
    return `<details class="payoff-case" data-payoff-case="${key}"${p.enabled?' open':''}><summary>${escape(id==='O1'?'Health · DALYs & expectancy':labelOf(o))}${p.enabled?' · active':''}</summary><label class="payoff-switch"><input type="checkbox" data-payoff-n="${n}" data-payoff-id="${id}" data-payoff-field="enabled"${p.enabled?' checked':''}> Use this estimate</label><div class="value-live" data-payoff-result="${key}">${payoffResult(r)}</div><div class="value-fields">${payoffField(n,id,'addressablePercent','Share of spending or illness reached (%)',p.addressablePercent)}${payoffField(n,id,'adoptionPercent','Share that uses the solution (%)',p.adoptionPercent)}${fields}</div><p class="small">${context}</p><button class="text-button" data-select-type="outcomes" data-select-id="${o.id}">Edit outcome baseline, GDP & sources ↗</button></details>`;
  }).join('')||'<p class="small">Connect this problem to an outcome to estimate its benefit.</p>'}</section>`;
}
function payoffRows(paths){return paths.length?`<div class="payoff-rows">${paths.map(r=>{const p=getRow('problems',r.n),o=getRow('outcomes',r.id);return `<div class="payoff-row"><div><button data-select-type="problems" data-select-id="${r.n}">${escape(plainTitle('problems',p))}</button><span class="small">→ ${escape(plainTitle('outcomes',o))}${r.path.example?' · example':''}</span></div><div class="payoff-number">${r.annualValue===null?(r.dalys!==undefined?compact(r.dalys)+' DALYs/yr':'Not valued'):money(r.annualValue)+'/yr'}<small>${r.gdpPercent===null?'Set dollar valuation':pct(r.gdpPercent)+' of global GDP'}</small></div></div>`;}).join('')}</div>`:'<p class="small">No estimate yet. Open a problem to add one.</p>';}
function payoffReadout(type,id){
  const paths=payoffPaths(state,quantities,{type,id});
  if(!paths.length)return '';
  return `<section class="payoff-readout"><h3>Estimated benefits</h3>${payoffRows(paths)}<p class="small">Separate estimates; benefits may overlap.</p></section>`;
}
function patchPayoffEditor(panel){for(const el of panel.querySelectorAll('[data-payoff-result]')){const [n,id]=el.dataset.payoffResult.split(':');el.innerHTML=payoffResult(evaluatePath(state,quantities,n,id));const summary=el.closest('.payoff-case')?.querySelector('summary');if(summary)summary.textContent=(id==='O1'?'Health · DALYs & expectancy':labelOf(getRow('outcomes',id)))+(state.payoffs.paths[pathKey(n,id)]?.enabled?' · active':'');}}
function payoffChange(target){
  if(!target.matches('[data-payoff-field],[data-payoff-global]'))return false;
  const next=copy(state.payoffs),global=target.dataset.payoffGlobal,key=target.dataset.payoffField,id=target.dataset.payoffId,n=target.dataset.payoffN;
  let previous,value;
  if(global){previous=next[global];value=target.value===''?null:Number(target.value);next[global]=value;}
  else{
    const path=pathKey(n,id);next.paths[path]??=blankPath(state.valuation,id);previous=next.paths[path][key];
    value=key==='enabled'?target.checked:key==='healthGroup'?target.value:target.value===''?(['annualValueBillion','carryingRatePercent'].includes(key)?null:NaN):Number(target.value);
    next.paths[path][key]=value;next.paths[path].example=false;
  }
  try{validatePayoffs(next,state.data,state.valuation);}catch(error){if(key==='enabled')target.checked=previous;else target.value=previous??'';notify(error.message);return true;}
  if(previous!==value)mutate(()=>state.payoffs=next,target);
  return true;
}
function renderPayoffSummary(){
  const paths=payoffPaths(state,quantities,selected),best=paths.find(r=>r.annualValue!==null),node=selected?getScored(selected.type,selected.id):null;
  $('payoff-summary').innerHTML=`<div class="panel-heading"><div><div class="eyebrow">Math → physical problem → annual value</div><h2>${node?escape(labelOf(node)):'Savings & share of GDP'}</h2></div>${selected?'<button data-show-all-payoffs>All active cases</button>':''}</div>${best?`<div class="payoff-headline"><strong>${money(best.annualValue)}/yr</strong><span>${pct(best.gdpPercent)} of ${money(best.gdp)} global GDP · largest single example</span></div>`:''}${payoffRows(paths)}<p class="small">Annual savings compared with GDP. Examples may overlap and are not added. The initial superconductors example assumes a 10% energy price cut.</p>`;
}
function graphQuantity(id){
  const q=quantity(id);if(!selected||selected.type==='outcomes')return q;
  const relevant=selected.type==='problems'?state.data.outcomes.some(o=>o.id===id&&o.links[selected.id]>0):state.data.outcomes.some(o=>o.id===id&&results.problems.some(p=>o.links[p.n]>0&&getRow('math',selected.id).links[p.n]>0));
  if(!relevant)return q;
  const paths=payoffPaths(state,quantities,selected).filter(r=>r.id===canonicalOutcome(id)),r=paths[0];
  if(!r)return {...q,macro:true,main:'Payoff not set',mobileMain:'Payoff not set',caseText:'Open a problem to set the benefit',scopeText:'Edit the starting values in the outcome editor'};
  const main=id==='O9'&&r.health?`LE +${pct(r.health.lifePercent)} · HALE +${pct(r.health.healthyPercent)}`:r.annualValue!==null?`${money(r.annualValue)}/yr · ${pct(r.gdpPercent)} GDP`:r.dalys!==undefined?`${compact(r.dalys)} DALYs/yr`:'Annual value not set';
  return {...q,macro:true,main,mobileMain:main,caseText:'Via '+getRow('problems',r.n).short,scopeText:'Separate benefit estimate'+(r.path.example?' · example':''),sourceDetail: r.missing||'Editable physical effect × market reach × adoption; gross annual value.'};
}

const cutLabel=n=>n?'\u2212'+pct(n):'0%';
function labelOf(row){if(row.id==='O1'&&row.s==='Lives saved')return 'DALYs averted';if(row.id==='O9'&&row.s==='Healthy years')return 'Lifespan illustration';return row.name||row.s;}
function isValueOutcome(id){return MARKET_IDS.includes(id)||id==='O1'||id==='O9';}
function outcomeScope(id){return id==='O1'||id==='O9'?'Global healthy years saved, grouped by cause, with an approximate lifespan gain':id==='O2'?'Global energy spending, using your GDP and spending assumptions':quantities.outcomes[id].scope;}
function valueLabels(id,q){
  if(MARKET_IDS.includes(id)){
    const m=marketValue(state.valuation,id),axis=id==='O8'?'Quantity':'Price',cut=id==='O8'?m.quantityCutPercent:m.priceCutPercent;
    const unitMetric=quantities.outcomes[id],referenceAfter=q.baseline*(1-cut/100),unitAfter=formatQuantity(referenceAfter,unitMetric.format);
    const basis=m.basis==='gdp'?`${pct(m.gdpSharePercent)} of ${money(m.gdp)} GDP`:m.basis==='spend'?`${money(m.spending)}/yr reference spending`:'Spending base not set';
    return {...q,macro:true,main:m.savings===null?`${axis} −${pct(cut)} · ${unitAfter}`:`${money(m.savings)}/yr · ${pct(m.gdpPercent)} GDP`,mobileMain:m.savings===null?`−${pct(cut)} ${axis.toLowerCase()} · ${unitAfter}`:`${money(m.savings)}/yr · ${pct(m.gdpPercent)} GDP`,caseText:`Price ${cutLabel(m.priceCutPercent)} · quantity ${cutLabel(m.quantityCutPercent)}`,scopeText:id==='O2'&&m.spending!==null?`${money(m.spending)}/yr energy spend · assumed`:m.basis==='unset'?unitMetric.short_scope:basis,sourceDetail:`${basis}. Gross spending reduction at unchanged useful output. ${valueReferences.economic_note}`};
  }
  if(id==='O1'||id==='O9'){
    const h=healthValue(state.valuation);
    return {...q,macro:true,main:id==='O1'?`${compact(h.averted)} DALYs/yr averted`:`LE +${pct(h.lifePercent)} · HALE +${pct(h.healthyPercent)}`,mobileMain:id==='O1'?`${compact(h.averted)} DALYs/yr`:`LE +${pct(h.lifePercent)} / HALE +${pct(h.healthyPercent)}`,caseText:id==='O1'?`${cutLabel(h.cutPercent)} burden · 3 separate groups`:`+${fmt(h.lifeYears)} life-yr · +${fmt(h.healthyYears)} healthy-yr`,scopeText:id==='O1'?'Global GBD 2023 · scenario':'Rough lifespan illustration',sourceDetail:valueReferences.health.method_note};
  }
  const axis={usd_stock:'capital quantity',years:'time',carbon:'emissions quantity'}[quantities.outcomes[id].format]||'quantity';
  return {...q,caseText:`−${pct(q.percent)} ${axis} case`};
}
function valueField(path,label,value,min=0,max=1e9){return `<label class="value-field">${escape(label)}<input type="number" step="any" min="${min}" max="${max}" data-value-path="${path}" value="${value}" aria-label="${escape(label)}"></label>`;}
function valueOutput(id){
  if(id==='O1'||id==='O9'){
    const h=healthValue(state.valuation);
    return `<strong class="value-main">${compact(h.averted)} DALYs/yr averted</strong><span>Rough lifespan equivalent <b>+${pct(h.lifePercent)}</b> · healthy life expectancy <b>+${pct(h.healthyPercent)}</b></span><span class="small">Approximate gains: +${fmt(h.lifeYears)} life-years and +${fmt(h.healthyYears)} healthy years per newborn.</span>`;
  }
  const m=marketValue(state.valuation,id);
  return m.savings===null?'<strong class="value-main">Set an annual spending base</strong><span class="small">Price and quantity changes are shown; annual dollar value needs a market spending base.</span>':`<strong class="value-main">${money(m.savings)}/yr gross savings</strong><span>${pct(m.gdpPercent)} of assumed global GDP · ${pct(m.combinedCutPercent)} less spending</span><span class="small">Price effect ${money(m.priceSavings)}/yr + quantity effect ${money(m.quantitySavings)}/yr.</span>`;
}
function valueEditor(id,location){
  if(id==='O1'||id==='O9'){
    const h=healthValue(state.valuation),ref=valueReferences.health;
    return `<section class="value-editor quick-physical"><h3>DALYs & life expectancy</h3><div class="value-live" data-live-value="${id}">${valueOutput(id)}</div><p class="small">DALYs = years lost to premature death (YLL) + disability (YLD). Each cause is counted once.</p><div class="daly-inputs">${HEALTH_IDS.map(key=>{const g=state.valuation.health.groups[key];return `<div class="daly-group"><strong>${escape(ref.groups[key].name)}</strong><div class="value-fields">${valueField(`health.groups.${key}.dalysMillion`,'DALYs / yr (millions)',g.dalysMillion,0,1e6)}${valueField(`health.groups.${key}.cutPercent`,'Burden reduction (%)',g.cutPercent,0,100)}</div><span class="small" data-daly-result="${key}">${compact(h.groups.find(g=>g.id===key).averted)} DALYs/yr averted</span></div>`;}).join('')}</div><details><summary>Expectancy conversion & sources</summary><div class="value-fields">${valueField('health.yllSharePercent','YLL share of averted DALYs (%)',h.yllSharePercent,0,100)}${valueField('health.birthsMillion','Annual births (millions)',h.birthsMillion,.001,10000)}${valueField('health.lifeExpectancy','Baseline life expectancy (years)',h.lifeExpectancy,1,150)}${valueField('health.healthyLifeExpectancy','Baseline healthy life expectancy (years)',h.healthyLifeExpectancy,1,150)}</div><p class="small">Sum saved DALYs × YLL share ÷ annual births = life-years per newborn, on average. Total saved DALYs ÷ annual births = healthy-years equivalent. Each gain ÷ its baseline expectancy gives the percentage. This is a rough population estimate, not a prediction for an individual.</p><p class="small">${escape(ref.burden_note)} Do not add the DALY and expectancy boxes together; they describe the same benefit.</p><p class="value-sources"><a href="${escape(ref.burden_source_url)}" target="_blank" rel="noopener noreferrer">GBD 2023 study ↗</a> · <a href="${escape(ref.expectancy_source_url)}" target="_blank" rel="noopener noreferrer">WHO life tables ↗</a> · <a href="${escape(ref.births_source_url)}" target="_blank" rel="noopener noreferrer">UN births ↗</a></p></details></section>`;
  }
  const m=marketValue(state.valuation,id),prefix=`markets.${id}`,metric=quantities.outcomes[id],q=physicalLabels(metric,state.physical?.[id],quantities.default_percent);
  return `<section class="value-editor quick-physical"><h3>Price, quantity & annual value</h3><div class="value-live" data-live-value="${id}">${valueOutput(id)}</div><div class="value-fields">${valueField('gdpTrillion','Global GDP ($T / yr)',state.valuation.gdpTrillion,.001,1e6)}<label class="value-field">Market spending base<select data-value-path="${prefix}.basis" aria-label="Market spending base"><option value="unset"${m.basis==='unset'?' selected':''}>Not set</option><option value="gdp"${m.basis==='gdp'?' selected':''}>Share of global GDP</option><option value="spend"${m.basis==='spend'?' selected':''}>Annual market spending</option></select></label>${m.basis==='gdp'?valueField(`${prefix}.gdpSharePercent`,'Sector spending (% of GDP)',m.gdpSharePercent,0,100):m.basis==='spend'?valueField(`${prefix}.spendBillion`,'Annual market spending ($B / yr)',m.spendBillion,0,1e9):''}${valueField(`${prefix}.priceCutPercent`,'Price reduction (%)',m.priceCutPercent,0,100)}${valueField(`${prefix}.quantityCutPercent`,'Required quantity reduction (%)',m.quantityCutPercent,0,100)}</div><p class="small">Quantity reduction means fewer inputs for the same output. Savings = spending × [1 − (1 − price cut) × (1 − quantity cut)]. Quantity savings use the reduced price.</p>${m.spending===null?'':`<p class="value-equation">${money(m.spending)}/yr spending − ${money(m.spendingAfter)}/yr after = ${money(m.savings)}/yr</p>`}<details><summary>Reference units & interpretation</summary><p class="small">${id==='O2'?'Starting assumptions: $120T global GDP and 10% spent on energy. ':''}${escape(valueReferences.economic_note)}</p><p class="small">Physical reference: ${escape(q.baselineText)} · ${escape(metric.period)} · ${escape(metric.scope)}. You choose the price and quantity changes; the priority score does not predict them.</p><p class="value-sources"><a href="${escape(metric.source_url)}" target="_blank" rel="noopener noreferrer">${escape(metric.source_name)} ↗</a></p></details></section>`;
}
function renderValueSummary(){
  const e=marketValue(state.valuation,'O2'),h=healthValue(state.valuation);
  $('value-summary').innerHTML=`<div class="value-summary-card"><div class="eyebrow">Energy · outcome reference case</div><h2>${e.savings===null?'Set spending base':money(e.savings)+'/yr'}</h2><p>${e.savings===null?'':pct(e.gdpPercent)+' of assumed global GDP · '}${pct(e.priceCutPercent)} price cut · ${pct(e.quantityCutPercent)} quantity cut</p><p class="small">${money(e.gdp)} GDP → ${e.spending===null?'unset':money(e.spending)+'/yr'} energy spend → ${e.savings===null?'unset':money(e.savings)+'/yr'} lower spending</p><button data-select-type="outcomes" data-select-id="O2">Edit price, quantity & GDP</button></div><div class="value-summary-card"><div class="eyebrow">Humans · outcome reference case</div><h2>${compact(h.averted)} DALYs/yr</h2><p>${pct(h.cutPercent)} of the reference healthy years lost</p><details><summary>Rough lifespan illustration</summary><p>Life +${pct(h.lifePercent)} · healthy life +${pct(h.healthyPercent)} under sustained gains; not a life-table forecast.</p></details><p class="small">Estimated healthy years saved. ${h.groups.map(g=>compact(g.averted)).join(' + ')} = ${compact(h.averted)} DALYs averted.</p><button data-select-type="outcomes" data-select-id="O1">Edit DALYs & conversion</button></div>`;
}
function valueChange(target){
  if(!target.matches('[data-value-path]'))return false;
  const path=target.dataset.valuePath.split('.'),next=copy(state.valuation);let object=next,current=state.valuation;
  for(const key of path.slice(0,-1)){object=object[key];current=current[key];}
  const key=path.at(-1),previous=current[key],value=target.tagName==='SELECT'?target.value:Number(target.value);
  if(target.value===''){target.value=previous;notify('Enter a value.');return true;}
  object[key]=value;
  try{validateValues(next,valueReferences,state.physical);}catch(error){target.value=previous;notify(error.message);return true;}
  if(previous!==value)mutate(()=>state.valuation=next,target.tagName==='SELECT'?null:target);
  return true;
}
function patchValueEditor(panel,id){
  for(const el of panel.querySelectorAll('[data-live-value]'))el.innerHTML=valueOutput(id);
  if(id==='O1'||id==='O9'){
    for(const g of healthValue(state.valuation).groups){const el=panel.querySelector(`[data-daly-result="${g.id}"]`);if(el)el.textContent=compact(g.averted)+' DALYs/yr averted';}
  }else{
    const m=marketValue(state.valuation,id),equation=panel.querySelector('.value-equation');
    if(equation)equation.textContent=`${money(m.spending)}/yr spending − ${money(m.spendingAfter)}/yr after = ${money(m.savings)}/yr`;
  }
}

function validateWorkspace(input,base){const physical=validatePhysical(input.physical);const ledger=validateLedger(input,base),valuation=validateValues(input.valuation,valueReferences,physical);return {...ledger,physical,valuation,payoffs:validatePayoffs(input.payoffs,ledger.data,valuation),macro:validateScenario(input.macro),projection:validateProjection(input.projection),worked:validateWorked(input.worked)};}
function quantity(id){return valueLabels(id,physicalLabels(quantities.outcomes[id],state.physical?.[id],quantities.default_percent));}
function snapshot(){const result=copy(state);result.physical=Object.fromEntries(Object.keys(quantities.outcomes).map(id=>{const q=quantity(id);return [id,{baseline:q.baseline,percent:q.percent}];}));return result;}
function physicalEditor(row){
  if(isValueOutcome(row.id))return `<section class="physical-editor">${valueEditor(row.id,'full')}</section>`;
  const metric=quantities.outcomes[row.id],q=quantity(row.id);
  return `<section class="physical-editor"><h3>Actual quantities</h3><p class="physical-result">${escape(q.main)}</p><p class="small">${escape(q.caseText)} · ${escape(q.scopeText)}</p><dl><dt>Published reference</dt><dd>${escape(formatQuantity(metric.baseline,metric.format))} · ${escape(metric.period)}</dd><dt>Metric</dt><dd>${escape(metric.metric)}</dd><dt>Coverage</dt><dd>${escape(metric.scope)}</dd><dt>Source</dt><dd><a href="${escape(metric.source_url)}" target="_blank" rel="noopener noreferrer">${escape(metric.source_name)} ↗</a><br>${escape(metric.source_date)} · checked ${escape(quantities.checked_on)}</dd></dl><form id="physical-form"><div class="physical-fields"><label class="field">Baseline · ${escape(metric.unit)}<input id="physical-baseline" type="number" min="0" max="1000000000000000" step="any" value="${q.baseline}" required></label><label class="field">Assumed ${metric.direction==='up'?'increase':'reduction'} (%)<input id="physical-percent" type="number" min="0" max="100" step="any" value="${q.percent}" required></label></div><button class="primary" type="submit">Apply quantity assumptions</button><button class="text-button" type="button" id="physical-reset">Use published baseline + 10% case</button></form><p class="small">${escape(metric.note)}</p><p class="small">Percentage set by you. Costs are excluded; benefits may overlap. ${q.customBaseline?'This baseline is your override; the source documents the reference value above.':''}</p></section>`;
}

const $=id=>document.getElementById(id), KEY='mta-ledger-v7';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const f=value=>value===null?'—':fmt(value);
const f1=value=>value==null||!Number.isFinite(value)?'—':fmt(value,1);
const amount=value=>value===0?'0':value>=10000||value<0.001?value.toExponential(2):Number(value.toPrecision(3)).toLocaleString('en-US');
const scoreStops=[[179,49,57],[40,52,71],[35,126,229]];
const scoreTint=(value,stops)=>{const t=Math.max(0,Math.min(1,Number.isFinite(value)?value:0)),i=t<.5?0:1,f=(t-i*.5)*2;return `rgb(${stops[i].map((v,k)=>Math.round(v+(stops[i+1][k]-v)*f)).join(' ')})`;};
const scoreColor=t=>scoreTint(t,scoreStops);
const scoreInk=t=>scoreTint(t,[[255,160,167],[206,212,222],[168,211,255]]);
const sourceNames={core:'Campbell + Claude','A':'Haiku · infrastructure','B':'Haiku · history and analogy','S':'Sonnet · blind spots','+':'Claude · added math field'};
const weightInfo={b:['Base b','Multiplier for each point',0.5],alpha:['Impact weight α','How strongly impact counts',0.25],lambda:['Difficulty penalty λ','How strongly math difficulty counts',0.25],kappa:['Capability drag κ','How strongly physical barriers count',0.25]};
let energyHistoryData,historicalData,valueReferences,quantities,base,state,results,ranges,baseline,scenarios=Object.create(null),history=[],tab='problems',selected=null,order='fixed',expanded=false,openMathProblem=null,quickOpen=false,fullDetailsOpen=false,pendingRanking=false,storageOK=true,noticeTimer,rangeBefore=null,storageWarning='';

function notify(message){$('notice').textContent=message;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('notice').textContent='',5500);}
function fresh(){return {data:copy(base),weights:{...DEFAULT_WEIGHTS},scope:'all',annotations:{},physical:{},valuation:defaultValues(valueReferences),payoffs:defaultPayoffs(defaultValues(valueReferences)),macro:{...DEFAULT_SCENARIO},projection:defaultProjection(),worked:defaultWorked()};}
function checkpoint(value=state){history.push(copy(value));if(history.length>40)history.shift();}
function mutate(change,source=null){checkpoint();change();refresh(true,source);}
function persist(){
  try{localStorage.setItem(KEY,JSON.stringify({workspace:state,scenarios}));storageOK=true;}
  catch{storageOK=false;}
  $('save-status').textContent=storageOK?'Saved in this browser':'Browser save unavailable · export JSON';
  $('save-status').classList.toggle('save-error',!storageOK);
  $('undo').disabled=!history.length;
  if($('quick-save-state'))$('quick-save-state').textContent=storageOK?'Saved in this browser':'Export JSON to keep changes';
}
function isDefault(){return JSON.stringify(state.data)===JSON.stringify(base)&&JSON.stringify(state.weights)===JSON.stringify(DEFAULT_WEIGHTS)&&!Object.keys(state.annotations).length&&!Object.keys(state.physical||{}).length&&JSON.stringify(state.valuation)===JSON.stringify(defaultValues(valueReferences))&&JSON.stringify(state.payoffs)===JSON.stringify(defaultPayoffs(defaultValues(valueReferences)))&&JSON.stringify(state.macro)===JSON.stringify(DEFAULT_SCENARIO)&&JSON.stringify(state.projection)===JSON.stringify(defaultProjection())&&JSON.stringify(state.worked)===JSON.stringify(defaultWorked());}
function load(){
  state=fresh();
  try{
    const saved=JSON.parse(localStorage.getItem(KEY)||'null');
    if(saved){
      state=validateWorkspace(saved.workspace,base);
      for(const [name,workspace] of Object.entries(saved.scenarios||{}))if(name.length<=80){try{scenarios[name]=validateWorkspace(workspace,base);}catch{storageWarning='A damaged saved scenario was skipped.';}}
      return;
    }
    const legacy=JSON.parse(localStorage.getItem('mta-ledger-v6')||'null');
    if(legacy){
      const migrated=fresh();migrated.weights={...DEFAULT_WEIGHTS,...legacy.P};migrated.scope=legacy.scope==='core'?'core':'all';
      migrated.data.problems.forEach(p=>{const a=legacy.apps?.[p.n];if(a){p.I=a.impact;p.M=a.math;p.C=a.cap;}});
      migrated.data.math.forEach(m=>{const old=legacy.maths?.[m.id];if(old){m.diff=old.diff;m.links=old.links;}});
      migrated.data.outcomes.forEach(o=>{if(legacy.outs?.[o.id])o.links=legacy.outs[o.id].links;});
      state=validateWorkspace(migrated,base);storageWarning='Your v006 edits have been copied into the current ledger.';
    }
  }catch{
    try{const damaged=localStorage.getItem(KEY);if(damaged)localStorage.setItem(KEY+'-recovery',damaged);}catch{}
    storageWarning='Stored edits could not be read. Defaults loaded; a recovery copy was attempted in this browser.';
  }
}
function renderScenarios(){
  const el=$('scenario-select'),value=el.value;
  el.innerHTML='<option value="">Load a saved scenario…</option>'+Object.keys(scenarios).sort().map(name=>`<option value="${escape(name)}">${escape(name)}</option>`).join('');el.value=value;
}
function renderWeights(){
  $('weights').innerHTML=Object.entries(weightInfo).map(([k,[label,hint,step]])=>`<div class="weight"><label for="weight-${k}">${label}<output id="value-${k}" for="weight-${k}">${f(state.weights[k])}</output></label><p class="hint">${hint}</p><input type="range" id="weight-${k}" data-weight="${k}" min="${WEIGHT_LIMITS[k][0]}" max="${WEIGHT_LIMITS[k][1]}" step="${step}" value="${state.weights[k]}"></div>`).join('');
  for(const input of $('weights').querySelectorAll('input')){
    input.addEventListener('input',()=>{if(!rangeBefore)rangeBefore=copy(state);state.weights[input.dataset.weight]=Number(input.value);$('value-'+input.dataset.weight).textContent=f(Number(input.value));refresh(false);});
    input.addEventListener('change',()=>{if(rangeBefore){checkpoint(rangeBefore);rangeBefore=null;persist();}});
  }
  renderScale();
}
function renderScale(){const b=state.weights.b;$('base-inline').textContent=f(b)+'×';$('scale-example').innerHTML=[3,5,7].map(s=>`<span>Score ${s}<strong>${amount(b**(s-3))}× today</strong></span>`).join('');}
function rows(){return results[tab];}
function getRow(type,id,data=state.data){return data[type].find(r=>String(type==='problems'?r.n:r.id)===String(id));}
function getScored(type,id){return results[type].find(r=>String(type==='problems'?r.n:r.id)===String(id));}
function selectionKey(){return selected?`${selected.type}:${selected.id}`:'';}
function selectNode(type,id){selected={type,id:String(id)};quickOpen=true;fullDetailsOpen=false;renderRank();renderInspector();renderGraph();renderQuickEditor();renderPayoffSummary();}

function quickScoreInputs(type,row,location='drawer'){
  if(type==='outcomes')return '<p class="small">This priority score is calculated from the connected applications. Change those connections below to update it.</p>';
  const fields=type==='math'?[['diff','Math difficulty']]:[['I','Potential benefit'],['M','Math required'],['C','Engineering required']];
  return `<div class="quick-score-inputs">${fields.map(([key,label])=>`<label>${label}<input type="number" min="1" max="10" step="0.1" inputmode="decimal" data-quick-score-type="${type}" data-quick-score-id="${type==='problems'?row.n:row.id}" data-quick-score-field="${key}" data-score-location="${location}" aria-label="${escape(labelOf(row))}, ${label}" value="${row[key]}" style="background:${inputScoreColor(row[key])}"></label>`).join('')}</div>`;
}
function weightSelect(ownerType,ownerId,problemId,location='drawer'){
  const owner=getRow(ownerType,ownerId),strength=owner.links[problemId]||0,problem=getRow('problems',problemId);
  return `<select data-edge-type="${ownerType}" data-edge-id="${ownerId}" data-problem="${problemId}" data-edge-location="${location}" aria-label="${escape(owner.name||owner.s)} ${ownerType==='math'?'to':'from'} ${escape(problem.name)} weight">${['0 · None','1 · Tentative','2 · Relevant','3 · Direct'].map((label,i)=>`<option value="${i}"${strength===i?' selected':''}>${label}</option>`).join('')}</select>`;
}
function quickLinkGroup(ownerType,problemId,title){
  const owners=results[ownerType],linked=owners.filter(row=>(row.links[problemId]||0)>0),available=owners.filter(row=>!row.links[problemId]);
  return `<section class="quick-link-group"><h3>${title}</h3><div class="quick-link-list">${linked.map(row=>`<div class="quick-link-row"><button data-select-type="${ownerType}" data-select-id="${row.id}" title="Edit ${escape(labelOf(row))}">${escape(plainTitle(ownerType,row))}</button>${weightSelect(ownerType,row.id,problemId)}</div>`).join('')||'<p class="small">No active links.</p>'}</div>${available.length?`<div class="quick-add-link"><select data-add-owner-type="${ownerType}" data-add-problem="${problemId}" aria-label="Add ${ownerType==='math'?'incoming math':'outgoing outcome'} link"><option value="">Add a connection…</option>${available.map(row=>`<option value="${row.id}">${escape(labelOf(row))}</option>`).join('')}</select><button data-add-owner-type="${ownerType}" data-add-problem="${problemId}" title="Add the selected connection at weight 2">Add</button></div>`:''}</section>`;
}
function quickProblemLinks(type,id,title){
  const row=getRow(type,id),problems=[...results.problems].sort((a,b)=>a.n-b.n),linked=problems.filter(p=>(row.links[p.n]||0)>0),available=problems.filter(p=>!row.links[p.n]);
  return `<section class="quick-link-group"><h3>${title}</h3><div class="quick-link-list">${linked.map(problem=>`<div class="quick-link-row"><button data-select-type="problems" data-select-id="${problem.n}" title="Edit ${escape(problem.name)}">${escape(plainTitle('problems',problem))}</button>${weightSelect(type,id,problem.n)}</div>`).join('')||'<p class="small">No active links.</p>'}</div>${available.length?`<div class="quick-add-link"><select data-add-problem-type="${type}" data-add-owner="${id}" aria-label="Add ${type==='math'?'outgoing':'incoming'} problem link"><option value="">Add a connection…</option>${available.map(p=>`<option value="${p.n}">${escape(p.name)}</option>`).join('')}</select><button data-add-problem-type="${type}" data-add-owner="${id}" title="Add the selected connection at weight 2">Add</button></div>`:''}</section>`;
}
function renderQuickEditor(source=null){
  const panel=$('quick-editor'),sameNode=panel.dataset.nodeKey===selectionKey(),scroll=sameNode?(panel.querySelector('.quick-editor-body')?.scrollTop||0):0,editingOpen=sameNode&&panel.querySelector('.node-editing')?.open;
  if(!quickOpen||!selected||!getScored(selected.type,selected.id)){panel.hidden=true;panel.dataset.nodeKey='';return;}
  const {type,id}=selected,row=getScored(type,id),color=scoreInk(norm(results[type],'ladder')(row.ladder));
  panel.hidden=false;panel.classList.toggle('quick-editor-left',type==='outcomes');
  if(source&&panel.contains(source)&&panel.dataset.nodeKey===selectionKey()){
    const score=panel.querySelector('.quick-score-heading>span');score.style.color=color;score.innerHTML=`${f1(row.ladder)} <small>calculated</small>`;
    for(const input of panel.querySelectorAll('[data-quick-score-field]')){const key=input.dataset.quickScoreField;input.style.background=inputScoreColor(row[key]);}
    if(type==='outcomes'){if(isValueOutcome(id))patchValueEditor(panel,id);else{const q=quantity(id),p=panel.querySelector('.quick-physical>p');if(p)p.textContent=q.main;}}
    patchPayoffEditor(panel);
    const benefit=panel.querySelector('[data-node-benefit]');if(benefit)benefit.innerHTML=nodeBenefit(type,row);
    panel.querySelector('[data-quick-undo]').disabled=!history.length;return;
  }
  panel.dataset.nodeKey=selectionKey();
  const physical=type==='outcomes'?(()=>{if(isValueOutcome(id))return valueEditor(id,'quick');const q=quantity(id),metric=quantities.outcomes[id];return `<section class="quick-physical"><h3>Quantity assumptions</h3><p>${escape(q.main)}</p><div class="quick-physical-fields"><label>Baseline · ${escape(metric.unit)}<input type="number" min="0" max="1000000000000000" step="any" data-quick-physical="baseline" value="${q.baseline}" aria-label="Physical baseline"></label><label>Improvement (%)<input type="number" min="0" max="100" step="any" data-quick-physical="percent" value="${q.percent}" aria-label="Physical improvement percentage"></label></div><p class="small">${escape(metric.short_scope)} · example</p></section>`;})():'';
  const links=type==='problems'?quickLinkGroup('math',id,'Math connections')+quickLinkGroup('outcomes',id,'Outcome connections'):quickProblemLinks(type,id,'Application connections');
  panel.innerHTML=`<header class="quick-editor-heading"><div><div class="eyebrow">${type==='math'?'Math idea':type==='problems'?'Real-world application':'Outcome'}</div><h2 id="quick-editor-title">${escape(plainTitle(type,row))}</h2></div><button data-close-quick aria-label="Close node editor">×</button></header><div class="quick-editor-body">${nodeExplanation(type,row)}<div data-node-benefit>${nodeBenefit(type,row)}</div>${explanationLinks(type,row)}${technicalWording(type,row)}<details class="node-editing"${editingOpen?' open':''}><summary>Edit assumptions</summary><div class="quick-score-heading"><h3>Priority score</h3><span style="color:${color}">${f1(row.ladder)} <small>calculated</small></span></div><p class="node-score-help">Higher score = higher priority.</p>${quickScoreInputs(type,row)}<p class="node-score-help">Inputs: 1–10. Each step multiplies by ${fmt(state.weights.b)}. Today’s math and engineering = 3.</p>${physical}${type==='problems'?payoffEditor(id):''}${links}<p class="quick-save-note">Scores save on Enter or leaving the field. Connections save immediately.</p></details></div><footer class="quick-editor-footer"><button data-quick-undo${history.length?'':' disabled'}>↶ Undo</button><button data-full-details>Details & sources</button><span id="quick-save-state">${storageOK?'Saved in this browser':'Export JSON to keep changes'}</span></footer>`;
  panel.querySelector('.quick-editor-body').scrollTop=scroll;
}

function norm(list,key){const vs=list.map(x=>x[key]).filter(v=>v!==null&&!isNaN(v));const lo=Math.min(...vs),hi=Math.max(...vs);return v=>v===null||isNaN(v)?0:Math.max(.04,(v-lo)/((hi-lo)||1));}
function shorten(text,width,size){const limit=Math.max(3,Math.floor(width/(size*.49)));return text.length>limit?text.slice(0,limit-1)+'…':text;}
const inputScoreColor=value=>scoreColor(Math.max(0,Math.min(1,(value-1)/9)));
const tagOf=row=>row.src&&row.src!=="core"?`<span class="tag">${escape(row.src)}</span>`:"";
function rowLink(type,row,label){return `<button class="row-node" data-select-type="${type}" data-select-id="${type==='problems'?row.n:row.id}" title="${escape(labelOf(row))}">${label}</button>`;}
function renderClassic(){
  for(const [type,host] of [["outcomes","outrank"],["problems","prio"]]){
    const list=results[type],color=norm(list,"ladder");
    $(host).innerHTML=list.map((row,i)=>`<div class="rk"><span class="n num">${i+1}</span><span class="lab"><span class="t">${rowLink(type,row,`${tagOf(row)}${escape(labelOf(row))}${type==='outcomes'?` <span class="muted">· ${escape(quantity(row.id).main)}</span>`:''}`)}</span><span class="bar"><i style="width:${Math.round(color(row.ladder)*100)}%;background:${scoreColor(color(row.ladder))}"></i></span></span><span class="v num cf" style="background:${scoreColor(color(row.ladder))}">${f1(row.ladder)}</span></div>`).join("");
  }
  let table='<div class="r h"><span>#</span><span>Problem</span><span class="c">I</span><span class="c">M</span><span class="c">C</span><span class="rt">Δ</span></div>';
  for(const row of [...results.problems].sort((a,b)=>a.impactRank-b.impactRank))table+=`<div class="r"><span class="num muted">${row.impactRank}</span><span class="nm">${rowLink('problems',row,tagOf(row)+escape(row.name))}</span>${['I','M','C'].map(k=>`<span class="c num cf" style="background:${inputScoreColor(row[k])}">${row[k]}</span>`).join('')}<span class="rt num ${row.delta<0?'up':'dn'}">${row.delta>0?'+':''}${row.delta||'·'}</span></div>`;
  $('impact').innerHTML=table;
  for(const [type,host] of [['problems','ed-apps'],['math','ed-math']]){
    const problems=type==='problems',fields=problems?['I','M','C']:['diff'];
    const list=[...results[type]].sort((a,b)=>problems?a.n-b.n:Number(a.id.slice(1))-Number(b.id.slice(1)));
    $(host).innerHTML=`<div class="r ${problems?'ra':'rm'} h"><span>${problems?'#':'id'}</span><span>${problems?'Problem':'Math'}</span>${fields.map(k=>`<span class="c">${k==='diff'?'D':k}</span>`).join('')}</div>`+list.map(row=>`<div class="r ${problems?'ra':'rm'}"><span class="id">${problems?row.n:row.id}</span><span class="nm">${rowLink(type,row,tagOf(row)+escape(row.short||row.s))}</span>${fields.map(k=>`<span><input type="number" data-bulk-type="${type}" data-bulk-id="${problems?row.n:row.id}" data-bulk-field="${k}" min="1" max="10" step="0.1" value="${row[k]}" inputmode="decimal" aria-label="${escape(row.name)}, ${k==='diff'?'difficulty':k}" style="background:${inputScoreColor(row[k])}"></span>`).join('')}</div>`).join('');
  }
}

function topMathPanel(problem){
  const linked=results.math.filter(m=>(m.links[problem.n]||0)>0),top=linked.slice(0,3);
  const countNote=linked.length<3?`${linked.length} connected ${linked.length===1?'idea':'ideas'}.`:`Top 3 of ${linked.length} connected ideas.`;
  return `<section class="top-math-panel" id="top-math-${problem.n}" aria-labelledby="top-math-title-${problem.n}">${nodeExplanation('problems',problem)}${payoffReadout('problems',problem.n)}<div class="top-math-heading"><h3 id="top-math-title-${problem.n}">Math ideas that could help</h3><span class="small">${countNote}</span></div><p class="small">Ranked by your settings.</p>${top.length?`<ol class="top-math-list">${top.map((m,i)=>`<li class="editable-top-math"><button class="top-math-link" data-open-linked-math="${m.id}" aria-label="Explain ${escape(plainTitle('math',m))}"><span class="top-math-number">${i+1}</span><span class="top-math-label"><strong>${escape(plainTitle('math',m))}</strong><span>${escape(explanationFor('math',m.id).frontier)}</span></span></button></li>`).join('')}</ol>`:'<p class="top-math-empty">No math ideas are connected yet.</p>'}<details class="inline-editing" data-problem="${problem.n}"><summary>Edit assumptions</summary><div class="inline-score-editor"><h3>Priority inputs</h3>${quickScoreInputs('problems',problem,'inline')}</div><h3>Math connections</h3>${top.map(m=>`<div class="inline-connection-edit"><span>${escape(plainTitle('math',m))}</span>${weightSelect('math',m.id,problem.n,'inline')}</div>`).join('')}<details class="inline-outgoing" data-problem="${problem.n}"><summary>Outcome connections</summary>${quickLinkGroup('outcomes',problem.n,'What this application could change')}</details></details><button class="text-button" data-select-type="problems" data-select-id="${problem.n}">Explanation & benefits</button></section>`;
}
function renderRank(){
  pendingRanking=false;
  const inlineEdit=$('ranking').querySelector('.inline-editing'),inlineEditState=inlineEdit?{id:inlineEdit.dataset.problem,open:inlineEdit.open}:null;
  const outgoing=$('ranking').querySelector('.inline-outgoing'),outgoingState=outgoing?{id:outgoing.dataset.problem,open:outgoing.open}:null;
  let list=[...rows()];const query=$('search').value.toLowerCase().trim();
  if(tab==='problems'&&$('sort').value==='impact')list.sort((a,b)=>a.impactRank-b.impactRank);
  if(query)list=list.filter(r=>[r.name,r.short,r.s,r.real_world,r.unit].filter(Boolean).join(' ').toLowerCase().includes(query));
  const max=rows()[0]?.score||1,shown=expanded||query?list:list.slice(0,8);
  $('ranking').setAttribute('aria-label',`Ranked ${tab==='problems'?'physical problems':tab==='math'?'math fields':'outcomes'}`);
  $('ranking').innerHTML=shown.map(r=>{
    const id=tab==='problems'?r.n:r.id,key=entityKey(tab,r),rank=rows().indexOf(r)+1,range=ranges[key];
    const defaultRank=baseline[tab].findIndex(x=>String(tab==='problems'?x.n:x.id)===String(id))+1;
    const origin=r.src&&r.src!=='core'?`<span class="origin" title="${escape(sourceNames[r.src])}">${escape(r.src)}</span>`:'';
    const description=tab==='problems'?`I ${r.I} · M ${r.M} · C ${r.C} · Δ ${r.delta>0?'+':''}${r.delta}`:tab==='math'?`D ${r.diff} · ${r.contributions.length} contributing problems`:`${r.unit} · ${r.contributions.length} contributing problems`;
    const isProblem=tab==='problems',isOpen=isProblem&&String(openMathProblem)===String(id);
    const action=isProblem?`data-expand-math="${id}" aria-expanded="${isOpen}" aria-controls="top-math-${id}"`:`data-select-type="${tab}" data-select-id="${id}" aria-pressed="${selectionKey()===key}"`;
    const row=`<button class="rank-row${isOpen||selectionKey()===key?' selected':''}" ${action} aria-label="${escape(labelOf(r))}, priority rank ${rank}, ladder ${f1(r.ladder)}, ${isProblem?'show linked math problems':'edit'}"><span class="rank-number">${tab==='problems'&&$('sort').value==='impact'?r.impactRank:rank}</span><span><span class="rank-name">${escape(labelOf(r))}${origin}${isProblem?`<span class="math-disclosure" aria-hidden="true">${isOpen?'▾':'▸'}</span>`:''}</span><span class="rank-desc">${escape(description)} · default #${defaultRank}</span></span><span class="rank-range" title="Best to worst rank across nearby weights">${range.low===range.high?'#'+range.low:range.low+'–'+range.high}</span><span class="rank-score" style="color:${scoreInk(norm(rows(),'ladder')(r.ladder))}">${f1(r.ladder)}<span class="score-bar"><i style="width:${Math.max(0,Math.min(100,r.score/max*100))}%;background:${scoreColor(norm(rows(),'ladder')(r.ladder))}"></i></span></span></button>`;
    return `<div class="rank-item">${row}${isOpen?topMathPanel(r):isProblem?`<div id="top-math-${id}" hidden></div>`:''}</div>`;
  }).join('')||'<p class="empty">No matches. Try another name.</p>';
  const nextEdit=$('ranking').querySelector('.inline-editing');if(nextEdit&&inlineEditState&&nextEdit.dataset.problem===inlineEditState.id)nextEdit.open=inlineEditState.open;
  const nextOutgoing=$('ranking').querySelector('.inline-outgoing');if(nextOutgoing&&outgoingState&&nextOutgoing.dataset.problem===outgoingState.id)nextOutgoing.open=outgoingState.open;
  $('show-more').hidden=!!query||list.length<=8;$('show-more').textContent=expanded?'Show top 8':`Show all ${list.length}`;
  const prefix=tab==='outcomes'?'Outcome scores are priority indices, not predicted quantities in the listed units. ':tab==='math'?'Fields earn points for every contributing problem; breadth is shown beside the score. ': 'Tap a problem to see its top linked math problems. Δ = priority rank − impact rank; negative means higher priority than impact alone. ';
  $('ranking-foot').textContent=prefix+'Rank range: change one weight at a time by ±0.25 (base ±0.5). These are local sensitivity checks, not confidence intervals. Default rank uses the original data and weights in this scope.';
  $('sort-wrap').hidden=tab!=='problems';
  $('ranking-action').textContent=tab==='problems'?'RANK / TAP FOR MATH':'RANK / SELECT TO EDIT';
}
function noteFor(key){return state.annotations[key]||{kind:'judgment',source:'',date:'',note:''};}
function numberField(label,key,value){return `<label class="field">${label}<input data-score-field="${key}" type="number" min="1" max="10" step="0.1" inputmode="decimal" value="${value}" required></label>`;}
function contributionRows(row){
  if(!row.contributions?.length)return '<p class="small">No active links in this scope. Add a connection below.</p>';
  const total=row.contributions.reduce((sum,c)=>sum+c.value,0);
  return row.contributions.slice(0,6).map(c=>`<div class="contrib"><button data-select-type="problems" data-select-id="${c.id}">${escape(c.name)} <span class="small">· link ${c.strength}</span></button><span class="pct">${f(c.value/total*100)}%</span></div>`).join('')+(row.contributions.length>6?`<p class="small" style="margin-top:10px">Top 6 of ${row.contributions.length} contributions shown.</p>`:'');
}
function connections(group,type,id){
  const row=getRow(type,id),data=state.data;
  let targets;
  if(type==='problems')targets=group==='math'?data.math.filter(m=>state.scope!=='core'||m.src==='core'):data.outcomes;
  else targets=data.problems.filter(p=>state.scope!=='core'||p.src==='core');
  targets=[...targets].sort((a,b)=>{
    const strength=x=>type==='problems'?(x.links[id]||0):(row.links[x.n]||0);
    return strength(b)-strength(a);
  });
  return `<div class="connection-list">${targets.map(target=>{
    const targetType=type==='problems'?group:'problems',targetId=targetType==='problems'?target.n:target.id;
    const ownerType=type==='problems'?group:type,ownerId=type==='problems'?target.id:id,problemId=type==='problems'?id:target.n;
    const owner=getRow(ownerType,ownerId),strength=owner.links[problemId]||0;
    return `<div class="connection-row"><button data-select-type="${targetType}" data-select-id="${targetId}">${escape(target.name||target.s||target.short)}</button><select data-edge-type="${ownerType}" data-edge-id="${ownerId}" data-problem="${problemId}" aria-label="Link strength: ${escape(target.name||target.s||target.short)}">${['0 · None','1 · Weak','2 · Plausible','3 · Direct'].map((name,i)=>`<option value="${i}"${i===strength?' selected':''}>${name}</option>`).join('')}</select></div>`;
  }).join('')}</div>`;
}
function renderInspector(preserveSource=null){
  $('inspector').hidden=!selected||!fullDetailsOpen;
  if(!selected||!fullDetailsOpen)return;
  if(!getScored(selected.type,selected.id)){selected=null;$('inspector').hidden=true;return;}
  if(preserveSource&&$('inspector').contains(preserveSource)&&preserveSource.matches('[data-payoff-field],[data-payoff-global]')){patchPayoffEditor($('inspector'));return;}
  if(preserveSource&&$('inspector').contains(preserveSource)&&preserveSource.matches('[data-value-path]')){patchValueEditor($('inspector'),selected.id);return;}
  const {type,id}=selected,row=getScored(type,id),key=entityKey(type,row),note=noteFor(key),range=ranges[key],p=state.weights;
  const label=type==='problems'?'Physical problem':type==='math'?'Math field':'Outcome';
  let inputs='',explanation='';
  if(type==='problems'){
    inputs=`<div class="score-inputs">${numberField('I · Impact','I',row.I)}${numberField('M · Math needed','M',row.M)}${numberField('C · Capability','C',row.C)}</div><p class="field-help">1–10 log inputs · decimals allowed · today’s M and C = 3</p>`;
    const i=p.alpha*(row.I-3),m=p.lambda*(row.M-3),c=p.kappa*(row.C-3);
    explanation=`<div class="explain">Impact: ${f(p.alpha)} × (${row.I} − 3) = <strong>${f(i)}</strong><br>Math: ${f(p.lambda)} × (${row.M} − 3) = <strong>${f(m)}</strong><br>Capability: ${f(p.kappa)} × (${row.C} − 3) = <strong>${f(c)}</strong><div class="equation">Ladder = 3 + ${f(i)} − ${f(m)} − ${f(c)} = ${f(row.ladder)}</div><br>Priority index: <strong>${amount(row.score)}</strong><br>Priority #${row.priorityRank} · impact #${row.impactRank} · Δ ${row.delta>0?'+':''}${row.delta}</div>`;
  }else{
    if(type==='math')inputs=`<div class="score-inputs">${numberField('D · Math difficulty','diff',row.diff)}</div><p class="field-help">1–10 log input · applied once to this field</p>`;
    explanation=`<div class="breadth"><div><strong>${row.contributions.length}</strong><span>contributing problems</span></div><div><strong>${range.low===range.high?'#'+range.low:range.low+'–'+range.high}</strong><span>local rank range</span></div></div><div class="explain">${type==='math'?`Weighted contribution sum: <strong>${amount(row.total)}</strong><br>Index = ${amount(row.total)}^${f(p.alpha)} / ${amount(p.b**(row.diff-3))}^${f(p.lambda)}<br>`:'Index = sum of (link/3) × problem index<br>'}Priority index: <strong>${amount(row.score)}</strong><br>Ladder = <strong>${f(row.ladder)}</strong></div><h3>What drives this score</h3>${contributionRows(row)}`;
  }
  const source=note.source?`<a href="${escape(note.source)}" target="_blank" rel="noopener noreferrer">Source ↗</a>${note.date?' · '+escape(note.date):''}`:'Judgment · no verified source attached';
  $('inspector').innerHTML=`<div class="eyebrow">Selected ${label.toLowerCase()} · ${escape(id)}</div><div class="inspector-header"><div><h2 id="inspector-title">${escape(plainTitle(type,row))}</h2><p>${escape(type==='problems'?row.real_world:type==='outcomes'?outcomeScope(row.id):'Explanation, assumptions and sources')}</p></div><div class="inspector-score" style="color:${scoreInk(norm(results[type],'ladder')(row.ladder))}">${f1(row.ladder)}<small>LADDER</small></div></div>${nodeExplanation(type,row)}${technicalWording(type,row)}<div class="inspector-grid"><div>${type==='outcomes'?physicalEditor(row):''}${type==='problems'?payoffEditor(id):payoffReadout(type,id)}<h3>Edit the assumptions</h3><form id="node-form">${inputs}<label class="field">Name<input id="node-name" value="${escape(labelOf(row))}" maxlength="300" required></label>${type==='problems'?`<label class="field">Short map label<input id="node-short" value="${escape(row.short)}" maxlength="100" required></label><label class="field">Physical application<textarea id="node-application" maxlength="2000">${escape(row.real_world)}</textarea></label>`:type==='math'?`<label class="field">Short map label<input id="node-short" value="${escape(row.s)}" maxlength="100" required></label>`:`<label class="field">Unit<input id="node-unit" value="${escape(row.unit)}" maxlength="100" required></label><label class="field">Legacy context note<textarea id="node-anchor" maxlength="2000">${escape(row.today)}</textarea></label>`}<div class="inspector-actions"><button class="primary" type="submit">Apply changes</button><span>Changes update the whole ledger.</span></div></form><div class="provenance"><h3>Evidence & notes</h3><p>${type==='outcomes'?'The physical reference above has its own dated source. Notes below document the ranking and links.':`Origin: ${escape(sourceNames[row.src]||'Imported judgment')}. Scores and edges start as judgments.`}</p><div class="evidence-line">${source}</div><form id="evidence-form"><label class="field">Evidence status<select id="evidence-kind"><option value="judgment"${note.kind!=='sourced'?' selected':''}>Judgment</option><option value="sourced"${note.kind==='sourced'?' selected':''}>Source attached</option></select></label><div class="field-row"><label class="field">Source URL<input type="url" id="evidence-source" value="${escape(note.source)}" placeholder="https://…" maxlength="2000"></label><label class="field">Source date<input type="date" id="evidence-date" value="${escape(note.date)}"></label></div><label class="field">Reasoning, uncertainty, or evidence for individual links<textarea id="evidence-note" maxlength="4000">${escape(note.note)}</textarea></label><button type="submit">Save evidence & notes</button></form></div></div><div><h3>Why it ranks here</h3>${explanation}${type==='problems'?`<p class="small">Local rank range: <b>${range.low===range.high?'#'+range.low:range.low+'–'+range.high}</b>. The math and capability scores are requirements, not probabilities of success.</p>`:`<p class="small" style="margin-top:14px">${type==='math'?'Each link contributes (strength/3) × impact multiplier × capability discount, before the field’s impact weight and difficulty penalty.':'Each contribution is (strength/3) × problem index. These contributions may overlap; this is not a total of physical benefits.'}</p>`}<div class="node-connections"><h3>Edit connected paths</h3><p class="small">0 none · 1 weak · 2 plausible · 3 direct. Link strengths are judgments.</p>${type==='problems'?`<details open><summary>Math → this problem</summary>${connections('math',type,id)}</details><details><summary>This problem → outcomes</summary>${connections('outcomes',type,id)}</details>`:`<details open><summary>${type==='math'?'This field → physical problems':'Physical problems → this outcome'}</summary>${connections('problems',type,id)}</details>`}</div></div></div>`;
  if(type==='outcomes'&&$('physical-form')){
    $('physical-form').addEventListener('submit',event=>{
      event.preventDefault();
      const next={baseline:Number($('physical-baseline').value),percent:Number($('physical-percent').value)};
      try{validatePhysical({[id]:next});}catch(error){notify(error.message);return;}
      mutate(()=>{state.physical??={};state.physical[id]=next;});notify('Quantity assumptions updated. Ranking scores are unchanged.');
    });
    $('physical-reset').addEventListener('click',()=>mutate(()=>{if(state.physical)delete state.physical[id];}));
  }
  $('node-form').addEventListener('submit',event=>{
    event.preventDefault();const changes={};
    for(const input of $('node-form').querySelectorAll('[data-score-field]')){const value=Number(input.value);if(!Number.isFinite(value)||value<1||value>10){notify('Scores must be between 1 and 10.');return;}changes[input.dataset.scoreField]=value;}
    const name=$('node-name').value.trim();if(!name){notify('Enter a name.');return;}
    if(type==='outcomes'){changes.s=name;changes.unit=$('node-unit').value.trim();changes.today=$('node-anchor').value.trim();}
    else {changes.name=name;changes[type==='problems'?'short':'s']=$('node-short').value.trim();if(type==='problems')changes.real_world=$('node-application').value.trim();}
    mutate(()=>Object.assign(getRow(type,id),changes));notify('Node updated.');
  });
  $('evidence-form').addEventListener('submit',event=>{
    event.preventDefault();const next={kind:$('evidence-kind').value,source:$('evidence-source').value.trim(),date:$('evidence-date').value,note:$('evidence-note').value.trim()};
    const candidate=copy(state);candidate.annotations[key]=next;
    try{validateWorkspace(candidate,base);}catch(error){notify(error.message);return;}
    mutate(()=>state.annotations[key]=next);notify('Evidence and notes saved.');
  });
}
function setEdge(type,id,n,strength){const links=getRow(type,id).links;if((links[n]||0)===strength)return;mutate(()=>{if(strength)links[n]=strength;else delete links[n];});}
function quickChange(target){
  if(target.matches('[data-quick-score-type]')){
    const type=target.dataset.quickScoreType,id=target.dataset.quickScoreId,key=target.dataset.quickScoreField,row=getRow(type,id),value=Number(target.value);
    if(!target.value||!Number.isFinite(value)||value<1||value>10){target.value=row[key];notify('Scores must be between 1 and 10.');return true;}
    if(row[key]!==value)mutate(()=>row[key]=value,target);
    return true;
  }
  if(target.matches('[data-quick-physical]')){
    const key=target.dataset.quickPhysical,q=quantity(selected.id),value=Number(target.value);
    if(!target.value||!Number.isFinite(value)||value<0||value>(key==='percent'?100:1e15)){target.value=q[key];notify('Enter a valid baseline or a percentage from 0 to 100.');return true;}
    if(q[key]!==value)mutate(()=>{state.physical??={};state.physical[selected.id]={baseline:q.baseline,percent:q.percent,[key]:value};},target);
    return true;
  }
  return false;
}
function renderGraph(){
  const scope=state.scope;
  const apps=state.data.problems.filter(a=>scope!=="core"||a.src==="core").map(a=>{const r=getScored("problems",a.n);return {...a,s:a.short,app:a.real_world,impact:a.I,math:a.M,cap:a.C,score:r.score,lad:r.ladder??NaN};});
  const maths=state.data.math.filter(m=>scope!=="core"||m.src==="core").map(m=>{const r=getScored("math",m.id);return {...m,score:r.score,lad:r.ladder??NaN,n:r.contributions.length};});
  const outs=state.data.outcomes.map(o=>{const r=getScored("outcomes",o.id);return {...o,score:r.score,lad:r.ladder??NaN,n:r.contributions.length};});
  const picked=selected?(selected.type==="problems"?"a"+selected.id:selected.id):null;
  const host=document.getElementById("graph");
  const W=Math.max(280,host.clientWidth||360);
  const narrow=W<700;
  const rowH=scope==="core"?(narrow?38:42):(narrow?24:28), pad=6, top=20;
  const lw=Math.round(narrow?W*0.23:Math.min(200,W*0.19));
  const mw=Math.round(narrow?W*0.29:Math.min(220,W*0.21));
  const rw=Math.round(narrow?W*0.37:Math.min(260,W*0.26));
  const core=scope==="core";
  const mset=core?maths.filter(m=>m.src==="core"):maths, aset=core?apps.filter(a=>a.src==="core"):apps, oset=outs;
  const H=top+aset.length*rowH+pad;
  const ml=order==="score"?[...mset].sort((x,y)=>y.score-x.score):[...mset];
  const al=order==="score"?[...aset].sort((x,y)=>y.score-x.score):[...aset];
  const ol=order==="score"?[...oset].sort((x,y)=>y.score-x.score):[...oset];
  const span=aset.length*rowH, stepM=span/mset.length, stepO=span/oset.length;
  const ym={},ya={},yo={}; ml.forEach((m,i)=>ym[m.id]=top+(i+0.5)*stepM); al.forEach((a,i)=>ya[a.n]=top+(i+0.5)*rowH); ol.forEach((o,i)=>yo[o.id]=top+(i+0.5)*stepO);
  const gap=(W-2*pad-lw-mw-rw)/2;
  const xL=pad+lw, xM=xL+gap, xM2=xM+mw, xR=W-pad-rw;
  const bh=rowH-6, lbh=Math.min(stepM-6,bh+6), obh=Math.min(stepO-8,narrow?66:76);
  const nm=norm(mset,"lad"), na=norm(aset,"lad"), no=norm(oset,"lad");
  const fs=narrow?10.5:12;
  const aRight={}; apps.forEach(a=>aRight[a.n]=a);
  let s=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Graph of math problems, the problems they gate, and the tangible outcomes those feed" style="--graph-label-size:${fs}px">`;
  s+=`<text class="colh" x="${pad}" y="12">math · ${mset.length}</text><text class="colh" x="${xM+mw/2}" y="12" text-anchor="middle">problems · ${aset.length}</text><text class="colh" x="${W-pad}" y="12" text-anchor="end">outcomes · ${oset.length}</text>`;
  // highlight sets (two hops)
  const on=new Set(); let note="";
  if(picked){
    if(picked[0]==="a"){const k=picked.slice(1); on.add(picked); mset.forEach(m=>{if(m.links[k]) on.add(m.id);}); oset.forEach(o=>{if(o.links[k]) on.add(o.id);}); note=aRight[k]?aRight[k].name:"";}
    else if(picked[0]==="O"){const o=oset.find(x=>x.id===picked); if(o){on.add(o.id); for(const k in o.links){ if(o.links[k]&&ya[k]){ on.add("a"+k); mset.forEach(m=>{if(m.links[k]) on.add(m.id);}); } } note=labelOf(o);}}
    else {const m=mset.find(x=>x.id===picked); if(m){on.add(m.id); for(const k in m.links){ if(m.links[k]&&ya[k]){ on.add("a"+k); oset.forEach(o=>{if(o.links[k]) on.add(o.id);}); } } note=m.name;}}
  }
  const edgeOn=(a,b)=>picked&&on.has(a)&&on.has(b)?" on":"";
  mset.forEach(m=>{for(const k in m.links){const st=m.links[k]; if(!st||!ya[k]) continue;
    const y1=ym[m.id], y2=ya[k], c1=xL+gap*0.45, c2=xM-gap*0.45;
    s+=`<path class="edge s${st}${edgeOn(m.id,"a"+k)}" d="M${xL} ${y1} C${c1} ${y1} ${c2} ${y2} ${xM} ${y2}"><title>${m.id} → ${k}: ${st}</title></path>`;}});
  oset.forEach(o=>{for(const k in o.links){const st=o.links[k]; if(!st||!ya[k]) continue;
    const y1=ya[k], y2=yo[o.id], c1=xM2+gap*0.45, c2=xR-gap*0.45;
    s+=`<path class="edge s${st}${edgeOn("a"+k,o.id)}" d="M${xM2} ${y1} C${c1} ${y1} ${c2} ${y2} ${xR} ${y2}"><title>${k} → ${o.id}: ${st}</title></path>`;}});
  ml.forEach(m=>{const y=ym[m.id]-lbh/2; const cls=["node",on.has(m.id)?"on":"",picked===m.id?"picked":""].join(" ");
    s+=`<g class="${cls}" data-id="${m.id}" tabindex="0" role="button" aria-label="${escape(m.name)}, score ${f1(m.lad)}"><title>${m.id} ${escape(m.name)} · D ${m.diff} · ${m.n} edges · score ${f1(m.lad)}</title>
      <rect class="box" style="fill:${scoreColor(nm(m.lad))}" x="${pad}" y="${y}" width="${lw}" height="${lbh}" rx="6"/>
      <text x="${pad+7}" y="${y+lbh/2+4}">${m.src!=="core"?`<tspan class="tg">${m.src} </tspan>`:""}${escape(narrow?shorten(m.s,lw-42,10.5):m.s)}</text><text class="sc" x="${xL-6}" y="${y+lbh/2+4}" text-anchor="end">${f1(m.lad)}</text></g>`;});
  al.forEach(a=>{const y=ya[a.n]-bh/2; const id="a"+a.n; const cls=["node",on.has(id)?"on":"",picked===id?"picked":""].join(" ");
    s+=`<g class="${cls}" data-id="${id}" tabindex="0" role="button" aria-label="${escape(a.name)}, score ${f1(a.lad)}"><title>${a.n} ${escape(a.name)} · ${escape(a.app)} · I ${a.impact} M ${a.math} C ${a.cap} · score ${f1(a.lad)}</title>
      <rect class="box" style="fill:${scoreColor(na(a.lad))}" x="${xM}" y="${y}" width="${mw}" height="${bh}" rx="6"/>
      <text class="sc" x="${xM+6}" y="${y+bh/2+4}">${f1(a.lad)}</text><text x="${xM2-7}" y="${y+bh/2+4}" text-anchor="end">${escape(narrow?shorten(a.s,mw-47,10.5):a.s)}${a.src!=="core"?`<tspan class="tg"> ${a.src}</tspan>`:""}</text></g>`;});
  ol.forEach(o=>{
    const y=yo[o.id]-obh/2,q=graphQuantity(o.id),metric=quantities.outcomes[o.id],right=W-pad-8;
    const cls=['node','physical-node',on.has(o.id)?'on':'',picked===o.id?'picked':''].join(' ');
    const main=q.macro?(narrow?q.mobileMain||q.main:q.main):narrow&&metric.mode==='transition'?q.afterText+' case':q.main;
    const context=q.macro?q.caseText:narrow?'Now '+q.baselineText+' · '+q.percent+'%':q.caseText+' · from '+q.baselineText;
    const valueFont=narrow?10:13,contextFont=narrow?7.5:9;
    const fit=(text,size)=>text.length*size*.61>rw-16?` textLength="${rw-16}" lengthAdjust="spacingAndGlyphs"`:'';
    s+=`<g class="${cls}" data-id="${o.id}" tabindex="0" role="button" aria-label="${escape(labelOf(o))}: ${escape(q.main)}; ${escape(q.caseText)}; ${escape(outcomeScope(o.id))}; priority index ladder ${f1(o.lad)}"><title>${escape(labelOf(o))}: ${escape(q.main)}. ${escape(q.caseText)}. ${escape(q.macro?q.sourceDetail:`Published reference: ${formatQuantity(metric.baseline,metric.format)}, ${metric.period}. ${metric.scope}. ${metric.source_name}.`)} Illustrative arithmetic, not a prediction from the ranking. Ladder ${f1(o.lad)}.</title>
      <rect class="box" style="fill:${scoreColor(no(o.lad))}" x="${xR}" y="${y}" width="${rw}" height="${obh}" rx="6"/>
      ${narrow||rw<230?'':`<text class="outcome-index" x="${xR+8}" y="${y+14}">idx ${f1(o.lad)}</text>`}
      <text class="outcome-title" x="${right}" y="${y+(narrow?12:14)}" text-anchor="end">${escape(narrow?shorten(labelOf(o),rw-15,9):labelOf(o))}</text>
      <text class="outcome-value" style="font-size:${valueFont}px" x="${right}" y="${y+(narrow?29:34)}" text-anchor="end"${fit(main,valueFont)}>${escape(main)}</text>
      <text class="outcome-context" style="font-size:${contextFont}px" x="${right}" y="${y+(narrow?44:51)}" text-anchor="end"${fit(context,contextFont)}>${escape(context)}</text>
      <text class="outcome-source" x="${right}" y="${y+(narrow?58:66)}" text-anchor="end">${escape(narrow?shorten(q.scopeText,rw-15,7.5):q.scopeText)}</text>
    </g>`;
  });
  s+=`</svg>`;
  host.innerHTML=s;
  $("edit-selected").hidden=!selected;
  document.getElementById("graph-details").classList.toggle("sel",!!picked);
  document.getElementById("pick-note").textContent=picked?"Showing: "+note+" · tap again to clear":"";
  host.querySelectorAll(".node").forEach(g=>{const h=()=>{const next=g.dataset.id;fullDetailsOpen=false;if(picked===next&&quickOpen){selected=null;quickOpen=false;}else{selected={type:next[0]==="a"?"problems":next[0]==="O"?"outcomes":"math",id:next[0]==="a"?next.slice(1):next};quickOpen=true;}renderGraph();renderRank();renderInspector();renderQuickEditor();renderPayoffSummary();}; g.addEventListener("click",h); g.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();h();}});});
}

function renderMatrices(){
  const problems=[...results.problems].sort((a,b)=>a.n-b.n);
  for(const type of ['math','outcomes']){
    let html='<thead><tr><th class="row-head" scope="col">'+(type==='math'?'Math':'Outcome')+' ↓ problem →</th>'+problems.map(p=>`<th scope="col" title="${escape(p.name)}">${p.n}</th>`).join('')+'</tr></thead><tbody>';
    for(const r of results[type])html+=`<tr><th class="row-head" scope="row" title="${escape(labelOf(r))}">${escape(r.id)} ${escape(r.s)}</th>${problems.map(p=>{const strength=r.links[p.n]||0;return `<td><button class="matrix-cell" data-matrix-type="${type}" data-edge-id="${r.id}" data-problem="${p.n}" data-strength="${strength}" aria-label="${escape(labelOf(r))} to ${escape(p.name)}: ${strength}; tap to cycle">${strength||'·'}</button></td>`;}).join('')}</tr>`;
    $('matrix-'+type).innerHTML=html+'</tbody>';
  }
}
function refresh(weights=true,source=null){
  results=score(state.data,state.weights,state.scope);ranges=sensitivity(state.data,state.weights,state.scope);baseline=score(base,DEFAULT_WEIGHTS,state.scope);
  if(weights)renderWeights();else renderScale();
  for(const button of document.querySelectorAll('[data-scope]'))button.setAttribute('aria-pressed',button.dataset.scope===state.scope);
  $('scope-count').textContent=`${results.math.length} / ${results.problems.length} / ${results.outcomes.length} nodes`;
  if(selected&&!getScored(selected.type,selected.id))selected=null;
  renderValueSummary();renderPayoffSummary();renderClassic();renderMacroViews(state.macro,source);
  if(source?.closest('.inline-score-editor')){
    pendingRanking=true;
    for(const input of $('ranking').querySelectorAll('[data-quick-score-field]')){const r=getRow(input.dataset.quickScoreType,input.dataset.quickScoreId);input.style.background=inputScoreColor(r[input.dataset.quickScoreField]);}
    for(const button of $('ranking').querySelectorAll('[data-expand-math]')){const r=getScored('problems',button.dataset.expandMath);if(!r)continue;const value=button.querySelector('.rank-score');value.firstChild.textContent=f1(r.ladder);value.style.color=scoreInk(norm(rows(),'ladder')(r.ladder));button.querySelector('.rank-number').textContent=$('sort').value==='impact'?r.impactRank:r.priorityRank;}
  }else renderRank();
  renderInspector(source);renderGraph();renderQuickEditor(source);if($('matrix-details').open)renderMatrices();persist();
}
async function confirmChange(title,message){
  const dialog=$('confirm-dialog');$('confirm-title').textContent=title;$('confirm-message').textContent=message;dialog.returnValue='';dialog.showModal();
  return new Promise(resolve=>dialog.addEventListener('close',()=>resolve(dialog.returnValue==='confirm'),{once:true}));
}
function renderMacroViews(settings=state.macro,source=null,projection=state.projection){
  const impact=scenarioOutcomes(settings,state.valuation),forecasts=projectAll(historicalData,projection,impact);
  renderMaster($('master-outlook'),settings,projection,forecasts,impact,source);
  const maxImpact=scenarioOutcomes(settings,state.valuation,100),scaleForecasts=projectAll(historicalData,projection,maxImpact);
  renderLiveCharts($('master-outlook'),historicalData,forecasts,scaleForecasts,impact,projection,maxImpact,energyHistoryData,settings);
  renderScenarioChart($('macro-scenario'),settings,state.valuation,source,historicalData,projection,energyHistoryData);
  renderWorked($('worked-paths'),state.worked,state.data,settings,source);
}
function projectionChange(target){
  if(!target.matches('[data-projection],[data-projection-rate]'))return false;
  const next=copy(state.projection),rate=target.dataset.projectionRate,key=target.dataset.projection,previous=rate?next.rates[rate]:next[key];
  const value=target.value===''?(rate?null:NaN):Number(target.value);if(rate)next.rates[rate]=value;else next[key]=value;
  try{validateProjection(next);}catch(error){target.value=previous??'';renderMacroViews(state.macro,target);notify(error.message);return true;}
  if(previous!==value)mutate(()=>state.projection=next,target);return true;
}
function macroChange(target){
  if(!target.matches('[data-macro]'))return false;
  const key=target.dataset.macro,value=target.value===''?NaN:Number(target.value),next={...state.macro,[key]:value};
  try{validateScenario(next);}catch(error){target.value=state.macro[key];renderMacroViews(state.macro,target);notify(error.message);return true;}
  if(state.macro[key]!==value)mutate(()=>state.macro=next,target);
  return true;
}
function workedChange(target){
  if(!target.matches('[data-worked-field]'))return false;
  const next=copy(state.worked),id=target.dataset.workedCase,key=target.dataset.workedField;
  const value=target.value===''?null:Number(target.value)*Number(target.dataset.workedScale||1),previous=next[id][key];
  next[id][key]=value;
  try{validateWorked(next);}catch(error){target.value=previous===null?'':previous/Number(target.dataset.workedScale||1);notify(error.message);return true;}
  if(previous!==value)mutate(()=>state.worked=next,target);return true;
}
function wire(){
  document.addEventListener('input',event=>{const target=event.target;if(target.matches('input[type=range][data-macro]'))renderMacroViews({...state.macro,[target.dataset.macro]:Number(target.value)},target);else if(target.matches('input[type=range][data-projection]'))renderMacroViews(state.macro,target,{...state.projection,[target.dataset.projection]:Number(target.value)});});
  $('macro-scenario').addEventListener('input',event=>{const target=event.target;if(target.matches('[data-history-year]')){const host=$('macro-scenario');host.dataset.inspectYear=target.value;if(Number(target.value)<2006)host.dataset.outlookWindow='full';renderMacroViews(state.macro,target);}});
  document.addEventListener('click',event=>{
    const workedPreset=event.target.closest('[data-worked-preset]');if(workedPreset){mutate(()=>state.worked[workedPreset.dataset.workedPreset].improvementPercent=Number(workedPreset.dataset.workedImprovement));return;}
    const liveView=event.target.closest('[data-live-window]');if(liveView){$('master-outlook').dataset.curveWindow=liveView.dataset.liveWindow;renderMacroViews();return;}
    const view=event.target.closest('[data-history-window]');if(view){const host=$('macro-scenario');host.dataset.outlookWindow=view.dataset.historyWindow;if(view.dataset.historyWindow==='recent'&&Number(host.dataset.inspectYear)<2006)delete host.dataset.inspectYear;renderMacroViews();return;}
    if(event.target.closest('[data-reset-projection]')){mutate(()=>state.projection=defaultProjection());return;}
    if(event.target.closest('[data-reset-macro]')){mutate(()=>state.macro={...DEFAULT_SCENARIO});return;}
    if(event.target.closest('[data-show-all-payoffs]')){selected=null;quickOpen=false;renderGraph();renderInspector();renderQuickEditor();renderRank();renderPayoffSummary();return;}
    if(event.target.closest('[data-close-quick]')){quickOpen=false;renderQuickEditor();return;}
    if(event.target.closest('[data-quick-undo]')){$('undo').click();return;}
    if(event.target.closest('[data-full-details]')){fullDetailsOpen=true;renderInspector();quickOpen=false;renderQuickEditor();$('inspector').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth',block:'start'});return;}
    const add=event.target.closest('.quick-add-link button');
    if(add){
      const choice=add.parentElement.querySelector('select');
      if(!choice.value){notify('Choose a connection to add.');return;}
      if(add.dataset.addOwnerType)setEdge(add.dataset.addOwnerType,choice.value,add.dataset.addProblem,2);
      else setEdge(add.dataset.addProblemType,add.dataset.addOwner,choice.value,2);
      return;
    }
    const disclosure=event.target.closest('[data-expand-math]');
    if(disclosure){
      const id=disclosure.dataset.expandMath,before=disclosure.getBoundingClientRect().top;
      quickOpen=false;renderQuickEditor();openMathProblem=String(openMathProblem)===id?null:id;renderRank();
      const replacement=$('ranking').querySelector(`[data-expand-math="${id}"]`);
      replacement.focus({preventScroll:true});
      const delta=replacement.getBoundingClientRect().top-before;if(Math.abs(delta)>1)window.scrollBy(0,delta);
      return;
    }
    const mathDetail=event.target.closest('[data-open-linked-math]');
    if(mathDetail){selectNode('math',mathDetail.dataset.openLinkedMath);return;}
    const target=event.target.closest('[data-select-type]');if(target){if(target.closest('#worked-paths')&&!getScored(target.dataset.selectType,target.dataset.selectId))mutate(()=>state.scope='all');selectNode(target.dataset.selectType,target.dataset.selectId,true);return;}
    const cell=event.target.closest('[data-matrix-type]');if(cell){setEdge(cell.dataset.matrixType,cell.dataset.edgeId,cell.dataset.problem,(Number(cell.dataset.strength)+1)%4);}
  });
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&quickOpen){quickOpen=false;renderQuickEditor();return;}if(event.key==='Enter'&&event.target.matches('[data-quick-score-type],[data-quick-physical],[data-value-path],[data-payoff-field],[data-payoff-global],[data-macro],[data-projection],[data-projection-rate],[data-worked-field]')){event.preventDefault();event.target.blur();if(pendingRanking)renderRank();return;}const target=event.target.closest('g[data-select-type]');if(target&&(event.key==='Enter'||event.key===' ')){event.preventDefault();selectNode(target.dataset.selectType,target.dataset.selectId);}});
  document.addEventListener('click',event=>{if(pendingRanking&&!event.target.closest('.inline-score-editor')&&!event.target.matches('select,input'))renderRank();});
  document.addEventListener('change',event=>{const target=event.target;if(workedChange(target)||projectionChange(target)||macroChange(target)||payoffChange(target)||valueChange(target)||quickChange(target))return;if(target.matches('[data-bulk-type]')){const value=Number(target.value);if(!target.value||!Number.isFinite(value)||value<1||value>10){target.value=getRow(target.dataset.bulkType,target.dataset.bulkId)[target.dataset.bulkField];notify('Scores must be between 1 and 10.');return;}if(getRow(target.dataset.bulkType,target.dataset.bulkId)[target.dataset.bulkField]===value)return;mutate(()=>getRow(target.dataset.bulkType,target.dataset.bulkId)[target.dataset.bulkField]=value);return;}if(target.matches('[data-edge-type]'))setEdge(target.dataset.edgeType,target.dataset.edgeId,target.dataset.problem,Number(target.value));});
  for(const button of document.querySelectorAll('[data-scope]'))button.addEventListener('click',()=>{if(state.scope!==button.dataset.scope)mutate(()=>{state.scope=button.dataset.scope;expanded=false;});});
  const tabButtons=[...document.querySelectorAll('[data-tab]')];
  function switchTab(button){tab=button.dataset.tab;expanded=false;$('search').value='';tabButtons.forEach(b=>{b.setAttribute('aria-selected',b===button);b.tabIndex=b===button?0:-1;});renderRank();}
  tabButtons.forEach((button,index)=>{button.addEventListener('click',()=>switchTab(button));button.addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?tabButtons.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabButtons.length)%tabButtons.length;switchTab(tabButtons[next]);tabButtons[next].focus();}});});
  $('search').addEventListener('input',renderRank);$('sort').addEventListener('change',renderRank);$('show-more').addEventListener('click',()=>{expanded=!expanded;renderRank();});
  $('undo').addEventListener('click',()=>{if(history.length){state=history.pop();rangeBefore=null;refresh();notify('Last workspace change undone.');}});
  $('reset-weights').addEventListener('click',()=>mutate(()=>state.weights={...DEFAULT_WEIGHTS}));
  $('save-scenario').addEventListener('click',async()=>{
    const name=$('scenario-name').value.trim();if(!name){notify('Give the scenario a name first.');$('scenario-name').focus();return;}
    if(scenarios[name]&&!await confirmChange('Replace saved scenario?',`Replace “${name}” with the current workspace? Export the old scenario first if you want both.`))return;
    scenarios[name]=snapshot();persist();renderScenarios();$('scenario-select').value=name;notify(storageOK?'Scenario saved in this browser.':'Scenario held in memory. Export JSON to keep it.');
  });
  $('scenario-select').addEventListener('change',()=>{const name=$('scenario-select').value;if(scenarios[name]){mutate(()=>state=copy(scenarios[name]));$('scenario-name').value=name;notify('Scenario loaded.');}});
  $('export').addEventListener('click',()=>{
    const name=$('scenario-name').value.trim()||'untitled',exported={format:'math-to-atoms-workspace',version:19,name,workspace:snapshot()};
    const url=URL.createObjectURL(new Blob([JSON.stringify(exported,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download=`math_to_atoms_${name.replace(/[^a-z0-9_-]+/gi,'_').slice(0,60)||'scenario'}_v019.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notify('Scenario exported, including scores, links, and notes.');
  });
  $('import').addEventListener('click',()=>$('import-file').click());
  $('import-file').addEventListener('change',async event=>{
    const file=event.target.files[0];if(!file)return;
    try{
      if(file.size>2_000_000)throw new Error('Import a workspace JSON smaller than 2 MB.');
      const imported=JSON.parse(await file.text());if(imported.format!=='math-to-atoms-workspace'||![7,8,9,13,14,15,18,19].includes(imported.version))throw new Error('Choose a compatible Math-to-Atoms workspace export.');
      const next=validateWorkspace(imported.workspace,base);mutate(()=>state=next);$('scenario-name').value=typeof imported.name==='string'?imported.name.slice(0,80):'';$('scenario-select').value='';notify('Workspace imported. Undo restores the previous workspace.');
    }catch(error){notify('Import failed: '+error.message);}finally{event.target.value='';}
  });
  $('restore-defaults').addEventListener('click',async()=>{if(!await confirmChange('Restore the original ledger?','This resets scores, links, notes, scope, and weights. Saved scenarios remain available. You can undo this change.'))return;mutate(()=>state=fresh());$('scenario-name').value='';$('scenario-select').value='';notify('Original defaults restored.');});
  for(const button of document.querySelectorAll('[data-order]'))button.addEventListener('click',()=>{order=button.dataset.order;for(const b of document.querySelectorAll('[data-order]'))b.setAttribute('aria-pressed',b===button);renderGraph();});
  $('clear-path').addEventListener('click',()=>{selected=null;quickOpen=false;renderGraph();renderRank();renderInspector();renderQuickEditor();renderPayoffSummary();});
  $('edit-selected').addEventListener('click',()=>{if(selected){quickOpen=true;renderQuickEditor();}});
  let graphResize;window.addEventListener('resize',()=>{clearTimeout(graphResize);graphResize=setTimeout(renderGraph,120);});
  $('graph-details').addEventListener('toggle',()=>{renderGraph();});
  $('matrix-details').addEventListener('toggle',()=>{if($('matrix-details').open)renderMatrices();});
  window.addEventListener('beforeunload',event=>{const dirty=$('node-form')?.dataset.dirty==='true'||$('evidence-form')?.dataset.dirty==='true'||$('physical-form')?.dataset.dirty==='true';if(!storageOK||dirty){event.preventDefault();event.returnValue='';}});
  document.addEventListener('input',event=>{const form=event.target.closest('#node-form,#evidence-form,#physical-form');if(form)form.dataset.dirty='true';});
}
async function boot(){
  try{
    const responses=await Promise.all(['math_to_atoms_data_v001.json','math_to_atoms_quantities_v009.json','math_to_atoms_values_v013.json','math_to_atoms_history_v017.json','math_to_atoms_energy_history_v028.json'].map(name=>fetch(new URL('./'+name,import.meta.url))));
    if(responses.some(response=>!response.ok))throw new Error('The dataset or physical reference file could not load.');
    [base,quantities,valueReferences,historicalData,energyHistoryData]=await Promise.all(responses.map(response=>response.json()));validateHistory(historicalData);validateEnergyHistory(energyHistoryData);
    validateWorkspace({data:base,weights:{...DEFAULT_WEIGHTS},scope:'all',annotations:{}},base);load();
    const sharedCase=readCoverCase(location.search);
    if(sharedCase){checkpoint();state.macro=validateScenario({...state.macro,...coverMacro(sharedCase)});state.projection=validateProjection({...state.projection,horizonYears:sharedCase.years});window.history.replaceState(null,'',clearCaseURL(location.href));}
    $('loading').hidden=true;$('app').hidden=false;wire();renderScenarios();refresh();
    if(storageWarning)notify(storageWarning);else if(sharedCase)notify('Applied the four summary settings. Your other assumptions are unchanged. Undo restores your previous case.');else if(isDefault()&&storageOK)$('save-status').textContent='Defaults · saved in this browser';
  }catch(error){$('loading').textContent=`The ledger could not load: ${error.message} Serve this folder over HTTP so the JSON and modules can load, or reload the hosted page.`;}
}
boot();
