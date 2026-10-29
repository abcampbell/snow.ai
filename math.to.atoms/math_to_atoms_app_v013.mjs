import {DEFAULT_WEIGHTS,WEIGHT_LIMITS,copy,score,sensitivity,entityKey,validateWorkspace as validateLedger} from './math_to_atoms_model_v007.mjs';
import {validatePhysical,physicalLabels,formatQuantity} from './math_to_atoms_quantities_v009.mjs';
import {defaultValues,validateValues,marketValue,healthValue,MARKET_IDS,HEALTH_IDS,fmt,compact,money,pct} from './math_to_atoms_value_model_v013.mjs';

const cutLabel=n=>n?'\u2212'+pct(n):'0%';
function labelOf(row){if(row.id==='O1'&&row.s==='Lives saved')return 'DALYs averted';if(row.id==='O9'&&row.s==='Healthy years')return 'Life expectancy';return row.name||row.s;}
function isValueOutcome(id){return MARKET_IDS.includes(id)||id==='O1'||id==='O9';}
function outcomeScope(id){return id==='O1'||id==='O9'?'Global DALY scenario; non-overlapping disease groups and cohort-equivalent expectancy':id==='O2'?'Global energy expenditure scenario using editable GDP and spending-share assumptions':quantities.outcomes[id].scope;}
function valueLabels(id,q){
  if(MARKET_IDS.includes(id)){
    const m=marketValue(state.valuation,id),axis=id==='O8'?'Quantity':'Price',cut=id==='O8'?m.quantityCutPercent:m.priceCutPercent;
    const unitMetric=quantities.outcomes[id],referenceAfter=q.baseline*(1-cut/100),unitAfter=formatQuantity(referenceAfter,unitMetric.format);
    const basis=m.basis==='gdp'?`${pct(m.gdpSharePercent)} of ${money(m.gdp)} GDP`:m.basis==='spend'?`${money(m.spending)}/yr reference spending`:'Spending base not set';
    return {...q,macro:true,main:m.savings===null?`${axis} −${pct(cut)} · ${unitAfter}`:`${money(m.savings)}/yr · ${pct(m.gdpPercent)} GDP`,mobileMain:m.savings===null?`−${pct(cut)} ${axis.toLowerCase()} · ${unitAfter}`:`${money(m.savings)}/yr · ${pct(m.gdpPercent)} GDP`,caseText:`Price ${cutLabel(m.priceCutPercent)} · quantity ${cutLabel(m.quantityCutPercent)}`,scopeText:id==='O2'&&m.spending!==null?`${money(m.spending)}/yr energy spend · assumed`:m.basis==='unset'?unitMetric.short_scope:basis,sourceDetail:`${basis}. Gross spending reduction at unchanged useful output. ${valueReferences.economic_note}`};
  }
  if(id==='O1'||id==='O9'){
    const h=healthValue(state.valuation);
    return {...q,macro:true,main:id==='O1'?`${compact(h.averted)} DALYs/yr averted`:`LE +${pct(h.lifePercent)} · HALE +${pct(h.healthyPercent)}`,mobileMain:id==='O1'?`${compact(h.averted)} DALYs/yr`:`LE +${pct(h.lifePercent)} / HALE +${pct(h.healthyPercent)}`,caseText:id==='O1'?`${cutLabel(h.cutPercent)} burden · 3 disjoint groups`:`+${fmt(h.lifeYears)} life-yr · +${fmt(h.healthyYears)} healthy-yr`,scopeText:id==='O1'?'Global GBD 2023 · scenario':'Per-newborn cohort equivalent',sourceDetail:valueReferences.health.method_note};
  }
  const axis={usd_stock:'capital quantity',years:'time',carbon:'emissions quantity'}[quantities.outcomes[id].format]||'quantity';
  return {...q,caseText:`−${pct(q.percent)} ${axis} case`};
}
function valueField(path,label,value,min=0,max=1e9){return `<label class="value-field">${escape(label)}<input type="number" step="any" min="${min}" max="${max}" data-value-path="${path}" value="${value}" aria-label="${escape(label)}"></label>`;}
function valueOutput(id){
  if(id==='O1'||id==='O9'){
    const h=healthValue(state.valuation);
    return `<strong class="value-main">${compact(h.averted)} DALYs/yr averted</strong><span>Life expectancy <b>+${pct(h.lifePercent)}</b> · healthy life expectancy <b>+${pct(h.healthyPercent)}</b></span><span class="small">Cohort equivalents: +${fmt(h.lifeYears)} life-years and +${fmt(h.healthyYears)} healthy years per newborn.</span>`;
  }
  const m=marketValue(state.valuation,id);
  return m.savings===null?'<strong class="value-main">Set an annual spending base</strong><span class="small">Price and quantity changes are shown; annual dollar value needs a market spending base.</span>':`<strong class="value-main">${money(m.savings)}/yr gross savings</strong><span>${pct(m.gdpPercent)} of assumed global GDP · ${pct(m.combinedCutPercent)} less spending</span><span class="small">Price effect ${money(m.priceSavings)}/yr + quantity effect ${money(m.quantitySavings)}/yr.</span>`;
}
function valueEditor(id,location){
  if(id==='O1'||id==='O9'){
    const h=healthValue(state.valuation),ref=valueReferences.health;
    return `<section class="value-editor quick-physical"><h3>DALYs & life expectancy</h3><div class="value-live" data-live-value="${id}">${valueOutput(id)}</div><p class="small">DALYs = years lost to premature death (YLL) + disability (YLD). Three disjoint cause groups are added once.</p><div class="daly-inputs">${HEALTH_IDS.map(key=>{const g=state.valuation.health.groups[key];return `<div class="daly-group"><strong>${escape(ref.groups[key].name)}</strong><div class="value-fields">${valueField(`health.groups.${key}.dalysMillion`,'DALYs / yr (millions)',g.dalysMillion,0,1e6)}${valueField(`health.groups.${key}.cutPercent`,'Burden reduction (%)',g.cutPercent,0,100)}</div><span class="small" data-daly-result="${key}">${compact(h.groups.find(g=>g.id===key).averted)} DALYs/yr averted</span></div>`;}).join('')}</div><details><summary>Expectancy conversion & sources</summary><div class="value-fields">${valueField('health.yllSharePercent','YLL share of averted DALYs (%)',h.yllSharePercent,0,100)}${valueField('health.birthsMillion','Annual births (millions)',h.birthsMillion,.001,10000)}${valueField('health.lifeExpectancy','Baseline life expectancy (years)',h.lifeExpectancy,1,150)}${valueField('health.healthyLifeExpectancy','Baseline healthy life expectancy (years)',h.healthyLifeExpectancy,1,150)}</div><p class="small">Sum saved DALYs × YLL share ÷ annual births = life-years per newborn equivalent. Total saved DALYs ÷ annual births = healthy-years equivalent. Each gain ÷ its baseline expectancy gives the percentage. This steady-state approximation is not a life-table forecast or an individual prognosis.</p><p class="small">${escape(ref.burden_note)} Do not add the DALY and expectancy boxes together; they describe the same benefit.</p><p class="value-sources"><a href="${escape(ref.burden_source_url)}" target="_blank" rel="noopener noreferrer">GBD 2023 study ↗</a> · <a href="${escape(ref.expectancy_source_url)}" target="_blank" rel="noopener noreferrer">WHO life tables ↗</a> · <a href="${escape(ref.births_source_url)}" target="_blank" rel="noopener noreferrer">UN births ↗</a></p></details></section>`;
  }
  const m=marketValue(state.valuation,id),prefix=`markets.${id}`,metric=quantities.outcomes[id],q=physicalLabels(metric,state.physical?.[id],quantities.default_percent);
  return `<section class="value-editor quick-physical"><h3>Price, quantity & annual value</h3><div class="value-live" data-live-value="${id}">${valueOutput(id)}</div><div class="value-fields">${valueField('gdpTrillion','Global GDP ($T / yr)',state.valuation.gdpTrillion,.001,1e6)}<label class="value-field">Market spending base<select data-value-path="${prefix}.basis" aria-label="Market spending base"><option value="unset"${m.basis==='unset'?' selected':''}>Not set</option><option value="gdp"${m.basis==='gdp'?' selected':''}>Share of global GDP</option><option value="spend"${m.basis==='spend'?' selected':''}>Annual market spending</option></select></label>${m.basis==='gdp'?valueField(`${prefix}.gdpSharePercent`,'Sector spending (% of GDP)',m.gdpSharePercent,0,100):m.basis==='spend'?valueField(`${prefix}.spendBillion`,'Annual market spending ($B / yr)',m.spendBillion,0,1e9):''}${valueField(`${prefix}.priceCutPercent`,'Price reduction (%)',m.priceCutPercent,0,100)}${valueField(`${prefix}.quantityCutPercent`,'Required quantity reduction (%)',m.quantityCutPercent,0,100)}</div><p class="small">Quantity means less input needed for the same useful output. Savings = spending × [1 − (1 − price cut) × (1 − quantity cut)]. The quantity effect uses the reduced price, so the interaction is counted once.</p>${m.spending===null?'':`<p class="value-equation">${money(m.spending)}/yr spending − ${money(m.spendingAfter)}/yr after = ${money(m.savings)}/yr</p>`}<details><summary>Reference units & interpretation</summary><p class="small">${id==='O2'?'GDP $120T and energy share 10% start from Campbell’s illustrative example. They are editable assumptions. ':''}${escape(valueReferences.economic_note)}</p><p class="small">Physical reference: ${escape(q.baselineText)} · ${escape(metric.period)} · ${escape(metric.scope)}. The price/quantity percentages above are scenario assumptions, not predictions from the priority score.</p><p class="value-sources"><a href="${escape(metric.source_url)}" target="_blank" rel="noopener noreferrer">${escape(metric.source_name)} ↗</a></p></details></section>`;
}
function renderValueSummary(){
  const e=marketValue(state.valuation,'O2'),h=healthValue(state.valuation);
  $('value-summary').innerHTML=`<div class="value-summary-card"><div class="eyebrow">Energy · gross spending value</div><h2>${e.savings===null?'Set spending base':money(e.savings)+'/yr'}</h2><p>${e.savings===null?'':pct(e.gdpPercent)+' of assumed global GDP · '}${pct(e.priceCutPercent)} price cut · ${pct(e.quantityCutPercent)} quantity cut</p><p class="small">${money(e.gdp)} GDP → ${e.spending===null?'unset':money(e.spending)+'/yr'} energy spend → ${e.savings===null?'unset':money(e.savings)+'/yr'} lower spending</p><button data-select-type="outcomes" data-select-id="O2">Edit price, quantity & GDP</button></div><div class="value-summary-card"><div class="eyebrow">Humans · DALYs added once</div><h2>${compact(h.averted)} DALYs/yr</h2><p>Life expectancy +${pct(h.lifePercent)} · healthy life expectancy +${pct(h.healthyPercent)}</p><p class="small">Cohort equivalents. ${h.groups.map(g=>compact(g.averted)).join(' + ')} = ${compact(h.averted)} DALYs averted.</p><button data-select-type="outcomes" data-select-id="O1">Edit DALYs & conversion</button></div>`;
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

function validateWorkspace(input,base){const physical=validatePhysical(input.physical);return {...validateLedger(input,base),physical,valuation:validateValues(input.valuation,valueReferences,physical)};}
function quantity(id){return valueLabels(id,physicalLabels(quantities.outcomes[id],state.physical?.[id],quantities.default_percent));}
function snapshot(){const result=copy(state);result.physical=Object.fromEntries(Object.keys(quantities.outcomes).map(id=>{const q=quantity(id);return [id,{baseline:q.baseline,percent:q.percent}];}));return result;}
function physicalEditor(row){
  if(isValueOutcome(row.id))return `<section class="physical-editor">${valueEditor(row.id,'full')}</section>`;
  const metric=quantities.outcomes[row.id],q=quantity(row.id);
  return `<section class="physical-editor"><h3>Actual quantities</h3><p class="physical-result">${escape(q.main)}</p><p class="small">${escape(q.caseText)} · ${escape(q.scopeText)}</p><dl><dt>Published reference</dt><dd>${escape(formatQuantity(metric.baseline,metric.format))} · ${escape(metric.period)}</dd><dt>Metric</dt><dd>${escape(metric.metric)}</dd><dt>Coverage</dt><dd>${escape(metric.scope)}</dd><dt>Source</dt><dd><a href="${escape(metric.source_url)}" target="_blank" rel="noopener noreferrer">${escape(metric.source_name)} ↗</a><br>${escape(metric.source_date)} · checked ${escape(quantities.checked_on)}</dd></dl><form id="physical-form"><div class="physical-fields"><label class="field">Baseline · ${escape(metric.unit)}<input id="physical-baseline" type="number" min="0" max="1000000000000000" step="any" value="${q.baseline}" required></label><label class="field">Assumed ${metric.direction==='up'?'increase':'reduction'} (%)<input id="physical-percent" type="number" min="0" max="100" step="any" value="${q.percent}" required></label></div><button class="primary" type="submit">Apply quantity assumptions</button><button class="text-button" type="button" id="physical-reset">Use published baseline + 10% case</button></form><p class="small">${escape(metric.note)}</p><p class="small">The percentage is an illustrative assumption. Ranking weights and link strengths do not predict it. Gross changes exclude implementation costs; benefits may overlap. ${q.customBaseline?'This baseline is your override; the source documents the reference value above.':''}</p></section>`;
}

const $=id=>document.getElementById(id), KEY='mta-ledger-v7';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const f=value=>value===null?'—':Number(value.toFixed(2)).toString();
const f1=value=>value==null||!Number.isFinite(value)?'—':value.toFixed(1);
const amount=value=>value===0?'0':value>=10000||value<0.001?value.toExponential(2):Number(value.toPrecision(4)).toLocaleString('en-US');
const scoreStops=[[179,49,57],[40,52,71],[35,126,229]];
const scoreTint=(value,stops)=>{const t=Math.max(0,Math.min(1,Number.isFinite(value)?value:0)),i=t<.5?0:1,f=(t-i*.5)*2;return `rgb(${stops[i].map((v,k)=>Math.round(v+(stops[i+1][k]-v)*f)).join(' ')})`;};
const scoreColor=t=>scoreTint(t,scoreStops);
const scoreInk=t=>scoreTint(t,[[255,160,167],[206,212,222],[168,211,255]]);
const sourceNames={core:'Campbell + Claude','A':'Haiku · infrastructure','B':'Haiku · history and analogy','S':'Sonnet · blind spots','+':'Claude · added math field'};
const weightInfo={b:['Base b','Multiplier for each point',0.5],alpha:['Impact weight α','How strongly impact counts',0.25],lambda:['Difficulty penalty λ','How strongly math difficulty counts',0.25],kappa:['Capability drag κ','How strongly physical barriers count',0.25]};
let valueReferences,quantities,base,state,results,ranges,baseline,scenarios=Object.create(null),history=[],tab='problems',selected=null,order='fixed',expanded=false,openMathProblem=null,quickOpen=false,fullDetailsOpen=false,pendingRanking=false,storageOK=true,noticeTimer,rangeBefore=null,storageWarning='';

function notify(message){$('notice').textContent=message;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('notice').textContent='',5500);}
function fresh(){return {data:copy(base),weights:{...DEFAULT_WEIGHTS},scope:'all',annotations:{},physical:{},valuation:defaultValues(valueReferences)};}
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
function isDefault(){return JSON.stringify(state.data)===JSON.stringify(base)&&JSON.stringify(state.weights)===JSON.stringify(DEFAULT_WEIGHTS)&&!Object.keys(state.annotations).length&&!Object.keys(state.physical||{}).length&&JSON.stringify(state.valuation)===JSON.stringify(defaultValues(valueReferences));}
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
function selectNode(type,id){selected={type,id:String(id)};quickOpen=true;fullDetailsOpen=false;renderRank();renderInspector();renderGraph();renderQuickEditor();}

function quickScoreInputs(type,row,location='drawer'){
  if(type==='outcomes')return '<p class="small">This priority score is calculated from incoming weighted problems. Edit those weights below.</p>';
  const fields=type==='math'?[['diff','D · Difficulty']]:[['I','I · Impact'],['M','M · Math needed'],['C','C · Capability']];
  return `<div class="quick-score-inputs">${fields.map(([key,label])=>`<label>${label}<input type="number" min="1" max="10" step="0.1" inputmode="decimal" data-quick-score-type="${type}" data-quick-score-id="${type==='problems'?row.n:row.id}" data-quick-score-field="${key}" data-score-location="${location}" aria-label="${escape(labelOf(row))}, ${label}" value="${row[key]}" style="background:${inputScoreColor(row[key])}"></label>`).join('')}</div>`;
}
function weightSelect(ownerType,ownerId,problemId,location='drawer'){
  const owner=getRow(ownerType,ownerId),strength=owner.links[problemId]||0,problem=getRow('problems',problemId);
  return `<select data-edge-type="${ownerType}" data-edge-id="${ownerId}" data-problem="${problemId}" data-edge-location="${location}" aria-label="${escape(owner.name||owner.s)} ${ownerType==='math'?'to':'from'} ${escape(problem.name)} weight">${['0 · Off','1 · Weak','2 · Plausible','3 · Direct'].map((label,i)=>`<option value="${i}"${strength===i?' selected':''}>${label}</option>`).join('')}</select>`;
}
function quickLinkGroup(ownerType,problemId,title){
  const owners=results[ownerType],linked=owners.filter(row=>(row.links[problemId]||0)>0),available=owners.filter(row=>!row.links[problemId]);
  return `<section class="quick-link-group"><h3>${title}</h3><div class="quick-link-list">${linked.map(row=>`<div class="quick-link-row"><button data-select-type="${ownerType}" data-select-id="${row.id}" title="Edit ${escape(labelOf(row))}">${escape(labelOf(row))}</button>${weightSelect(ownerType,row.id,problemId)}</div>`).join('')||'<p class="small">No active links.</p>'}</div>${available.length?`<div class="quick-add-link"><select data-add-owner-type="${ownerType}" data-add-problem="${problemId}" aria-label="Add ${ownerType==='math'?'incoming math':'outgoing outcome'} link"><option value="">Add a connection…</option>${available.map(row=>`<option value="${row.id}">${escape(labelOf(row))}</option>`).join('')}</select><button data-add-owner-type="${ownerType}" data-add-problem="${problemId}" title="Add the selected connection at weight 2">Add</button></div>`:''}</section>`;
}
function quickProblemLinks(type,id,title){
  const row=getRow(type,id),problems=[...results.problems].sort((a,b)=>a.n-b.n),linked=problems.filter(p=>(row.links[p.n]||0)>0),available=problems.filter(p=>!row.links[p.n]);
  return `<section class="quick-link-group"><h3>${title}</h3><div class="quick-link-list">${linked.map(problem=>`<div class="quick-link-row"><button data-select-type="problems" data-select-id="${problem.n}" title="Edit ${escape(problem.name)}">${escape(problem.name)}</button>${weightSelect(type,id,problem.n)}</div>`).join('')||'<p class="small">No active links.</p>'}</div>${available.length?`<div class="quick-add-link"><select data-add-problem-type="${type}" data-add-owner="${id}" aria-label="Add ${type==='math'?'outgoing':'incoming'} problem link"><option value="">Add a connection…</option>${available.map(p=>`<option value="${p.n}">${escape(p.name)}</option>`).join('')}</select><button data-add-problem-type="${type}" data-add-owner="${id}" title="Add the selected connection at weight 2">Add</button></div>`:''}</section>`;
}
function renderQuickEditor(source=null){
  const panel=$('quick-editor'),scroll=panel.querySelector('.quick-editor-body')?.scrollTop||0;
  if(!quickOpen||!selected||!getScored(selected.type,selected.id)){panel.hidden=true;return;}
  const {type,id}=selected,row=getScored(type,id),color=scoreInk(norm(results[type],'ladder')(row.ladder));
  panel.hidden=false;panel.classList.toggle('quick-editor-left',type==='outcomes');
  if(source&&panel.contains(source)&&panel.dataset.nodeKey===selectionKey()){
    const score=panel.querySelector('.quick-score-heading>span');score.style.color=color;score.innerHTML=`${f1(row.ladder)} <small>ladder</small>`;
    for(const input of panel.querySelectorAll('[data-quick-score-field]')){const key=input.dataset.quickScoreField;input.style.background=inputScoreColor(row[key]);}
    if(type==='outcomes'){if(isValueOutcome(id))patchValueEditor(panel,id);else{const q=quantity(id),p=panel.querySelector('.quick-physical>p');if(p)p.textContent=q.main;}}
    panel.querySelector('[data-quick-undo]').disabled=!history.length;return;
  }
  panel.dataset.nodeKey=selectionKey();
  const physical=type==='outcomes'?(()=>{if(isValueOutcome(id))return valueEditor(id,'quick');const q=quantity(id),metric=quantities.outcomes[id];return `<section class="quick-physical"><h3>Quantity assumptions</h3><p>${escape(q.main)}</p><div class="quick-physical-fields"><label>Baseline · ${escape(metric.unit)}<input type="number" min="0" max="1000000000000000" step="any" data-quick-physical="baseline" value="${q.baseline}" aria-label="Physical baseline"></label><label>Improvement (%)<input type="number" min="0" max="100" step="any" data-quick-physical="percent" value="${q.percent}" aria-label="Physical improvement percentage"></label></div><p class="small">${escape(metric.short_scope)} · illustrative case</p></section>`;})():'';
  const links=type==='problems'?quickLinkGroup('math',id,'Incoming weights · math → problem')+quickLinkGroup('outcomes',id,'Outgoing weights · problem → outcomes'):type==='math'?quickProblemLinks(type,id,'Outgoing weights · math → problems'):quickProblemLinks(type,id,'Incoming weights · problems → outcome');
  panel.innerHTML=`<header class="quick-editor-heading"><div><div class="eyebrow">${type==='math'?'Math field':type==='problems'?'Physical problem':'Outcome'} · ${escape(id)}</div><h2 id="quick-editor-title">${escape(labelOf(row))}</h2></div><button data-close-quick aria-label="Close node editor">×</button></header><div class="quick-editor-body"><div class="quick-score-heading"><h3>Score inputs</h3><span style="color:${color}">${f1(row.ladder)} <small>ladder</small></span></div>${quickScoreInputs(type,row)}${physical}<p class="quick-save-note">Scores 1–10: Enter or leave the field to save. Weights 0–3 save immediately.</p>${links}</div><footer class="quick-editor-footer"><button data-quick-undo${history.length?'':' disabled'}>↶ Undo</button><button data-full-details>More details & sources</button><span id="quick-save-state">${storageOK?'Saved in this browser':'Export JSON to keep changes'}</span></footer>`;
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
  const countNote=linked.length<3?`${linked.length} linked ${linked.length===1?'field':'fields'} in this scope.`:`Top 3 of ${linked.length} linked fields.`;
  return `<section class="top-math-panel" id="top-math-${problem.n}" aria-labelledby="top-math-title-${problem.n}"><div class="inline-score-editor"><h3>Score inputs</h3>${quickScoreInputs('problems',problem,'inline')}</div><div class="top-math-heading"><h3 id="top-math-title-${problem.n}">Top linked math problems</h3><span class="small">${countNote}</span></div><p class="small">Ranked by current math priority score.</p>${top.length?`<ol class="top-math-list">${top.map((m,i)=>`<li class="editable-top-math"><button class="top-math-link" data-open-linked-math="${m.id}" aria-label="Open ${escape(m.name)} details"><span class="top-math-number">${i+1}</span><span class="top-math-label"><strong>${escape(m.name)}</strong><span>${escape(m.id)} · D ${m.diff} · link ${m.links[problem.n]}/3 (${['none','weak','plausible','direct'][m.links[problem.n]]})</span></span><span class="top-math-score" style="color:${scoreInk(norm(results.math,'ladder')(m.ladder))}">${f1(m.ladder)}<small>ladder ↗</small></span></button>${weightSelect('math',m.id,problem.n,'inline')}</li>`).join('')}</ol>`:'<p class="top-math-empty">No math fields are linked to this problem yet.</p>'}<details class="inline-outgoing" data-problem="${problem.n}"><summary>Outgoing weights to outcomes</summary>${quickLinkGroup('outcomes',problem.n,'Problem \u2192 outcomes')}</details><button class="text-button" data-select-type="problems" data-select-id="${problem.n}">All scores &amp; incoming / outgoing weights</button></section>`;
}
function renderRank(){
  pendingRanking=false;
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
  const source=note.source?`<a href="${escape(note.source)}" target="_blank" rel="noopener noreferrer">Source reference ↗</a>${note.date?' · '+escape(note.date):''}`:'Judgment · no verified source attached';
  $('inspector').innerHTML=`<div class="eyebrow">Selected ${label.toLowerCase()} · ${escape(id)}</div><div class="inspector-header"><div><h2 id="inspector-title">${escape(labelOf(row))}</h2><p>${escape(type==='problems'?row.real_world:type==='outcomes'?outcomeScope(row.id):'Missing theory, closure, bound, or algorithm')}</p></div><div class="inspector-score" style="color:${scoreInk(norm(results[type],'ladder')(row.ladder))}">${f1(row.ladder)}<small>LADDER</small></div></div><div class="inspector-grid"><div>${type==='outcomes'?physicalEditor(row):''}<h3>Edit the assumptions</h3><form id="node-form">${inputs}<label class="field">Name<input id="node-name" value="${escape(labelOf(row))}" maxlength="300" required></label>${type==='problems'?`<label class="field">Short map label<input id="node-short" value="${escape(row.short)}" maxlength="100" required></label><label class="field">Physical application<textarea id="node-application" maxlength="2000">${escape(row.real_world)}</textarea></label>`:type==='math'?`<label class="field">Short map label<input id="node-short" value="${escape(row.s)}" maxlength="100" required></label>`:`<label class="field">Unit<input id="node-unit" value="${escape(row.unit)}" maxlength="100" required></label><label class="field">Legacy context note<textarea id="node-anchor" maxlength="2000">${escape(row.today)}</textarea></label>`}<div class="inspector-actions"><button class="primary" type="submit">Apply changes</button><span>Changes update the whole ledger.</span></div></form><div class="provenance"><h3>Evidence & notes</h3><p>${type==='outcomes'?'The physical reference above has its own dated source. Notes below document the ranking and links.':`Origin: ${escape(sourceNames[row.src]||'Imported judgment')}. Scores and edges start as judgments.`}</p><div class="evidence-line">${source}</div><form id="evidence-form"><label class="field">Evidence status<select id="evidence-kind"><option value="judgment"${note.kind!=='sourced'?' selected':''}>Judgment / working hypothesis</option><option value="sourced"${note.kind==='sourced'?' selected':''}>Source attached · review notes</option></select></label><div class="field-row"><label class="field">Source URL<input type="url" id="evidence-source" value="${escape(note.source)}" placeholder="https://…" maxlength="2000"></label><label class="field">Source date<input type="date" id="evidence-date" value="${escape(note.date)}"></label></div><label class="field">Reasoning, uncertainty, or evidence for individual links<textarea id="evidence-note" maxlength="4000">${escape(note.note)}</textarea></label><button type="submit">Save evidence & notes</button></form></div></div><div><h3>Why it ranks here</h3>${explanation}${type==='problems'?`<p class="small">Local rank range: <b>${range.low===range.high?'#'+range.low:range.low+'–'+range.high}</b>. The math and capability scores are requirements, not probabilities of success.</p>`:`<p class="small" style="margin-top:14px">${type==='math'?'Each link contributes (strength/3) × impact multiplier × capability discount, before the field’s impact weight and difficulty penalty.':'Each contribution is (strength/3) × problem index. These contributions may overlap; this is not a total of physical benefits.'}</p>`}<div class="node-connections"><h3>Edit connected paths</h3><p class="small">0 none · 1 weak · 2 plausible · 3 direct. Link strengths are judgments.</p>${type==='problems'?`<details open><summary>Math → this problem</summary>${connections('math',type,id)}</details><details><summary>This problem → outcomes</summary>${connections('outcomes',type,id)}</details>`:`<details open><summary>${type==='math'?'This field → physical problems':'Physical problems → this outcome'}</summary>${connections('problems',type,id)}</details>`}</div></div></div>`;
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
    const y=yo[o.id]-obh/2,q=quantity(o.id),metric=quantities.outcomes[o.id],right=W-pad-8;
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
  host.querySelectorAll(".node").forEach(g=>{const h=()=>{const next=g.dataset.id;fullDetailsOpen=false;if(picked===next&&quickOpen){selected=null;quickOpen=false;}else{selected={type:next[0]==="a"?"problems":next[0]==="O"?"outcomes":"math",id:next[0]==="a"?next.slice(1):next};quickOpen=true;}renderGraph();renderRank();renderInspector();renderQuickEditor();}; g.addEventListener("click",h); g.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();h();}});});
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
  renderValueSummary();renderClassic();
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
function wire(){
  document.addEventListener('click',event=>{
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
    const target=event.target.closest('[data-select-type]');if(target){selectNode(target.dataset.selectType,target.dataset.selectId,true);return;}
    const cell=event.target.closest('[data-matrix-type]');if(cell){setEdge(cell.dataset.matrixType,cell.dataset.edgeId,cell.dataset.problem,(Number(cell.dataset.strength)+1)%4);}
  });
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&quickOpen){quickOpen=false;renderQuickEditor();return;}if(event.key==='Enter'&&event.target.matches('[data-quick-score-type],[data-quick-physical],[data-value-path]')){event.preventDefault();event.target.blur();if(pendingRanking)renderRank();return;}const target=event.target.closest('g[data-select-type]');if(target&&(event.key==='Enter'||event.key===' ')){event.preventDefault();selectNode(target.dataset.selectType,target.dataset.selectId);}});
  document.addEventListener('click',event=>{if(pendingRanking&&!event.target.closest('.inline-score-editor')&&!event.target.matches('select,input'))renderRank();});
  document.addEventListener('change',event=>{const target=event.target;if(valueChange(target)||quickChange(target))return;if(target.matches('[data-bulk-type]')){const value=Number(target.value);if(!target.value||!Number.isFinite(value)||value<1||value>10){target.value=getRow(target.dataset.bulkType,target.dataset.bulkId)[target.dataset.bulkField];notify('Scores must be between 1 and 10.');return;}if(getRow(target.dataset.bulkType,target.dataset.bulkId)[target.dataset.bulkField]===value)return;mutate(()=>getRow(target.dataset.bulkType,target.dataset.bulkId)[target.dataset.bulkField]=value);return;}if(target.matches('[data-edge-type]'))setEdge(target.dataset.edgeType,target.dataset.edgeId,target.dataset.problem,Number(target.value));});
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
    const name=$('scenario-name').value.trim()||'untitled',exported={format:'math-to-atoms-workspace',version:13,name,workspace:snapshot()};
    const url=URL.createObjectURL(new Blob([JSON.stringify(exported,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download=`math_to_atoms_${name.replace(/[^a-z0-9_-]+/gi,'_').slice(0,60)||'scenario'}_v013.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notify('Scenario exported, including scores, links, and notes.');
  });
  $('import').addEventListener('click',()=>$('import-file').click());
  $('import-file').addEventListener('change',async event=>{
    const file=event.target.files[0];if(!file)return;
    try{
      if(file.size>2_000_000)throw new Error('Import a workspace JSON smaller than 2 MB.');
      const imported=JSON.parse(await file.text());if(imported.format!=='math-to-atoms-workspace'||![7,8,9,13].includes(imported.version))throw new Error('Choose a compatible Math-to-Atoms workspace export.');
      const next=validateWorkspace(imported.workspace,base);mutate(()=>state=next);$('scenario-name').value=typeof imported.name==='string'?imported.name.slice(0,80):'';$('scenario-select').value='';notify('Workspace imported. Undo restores the previous workspace.');
    }catch(error){notify('Import failed: '+error.message);}finally{event.target.value='';}
  });
  $('restore-defaults').addEventListener('click',async()=>{if(!await confirmChange('Restore the original ledger?','This resets scores, links, notes, scope, and weights. Saved scenarios remain available. You can undo this change.'))return;mutate(()=>state=fresh());$('scenario-name').value='';$('scenario-select').value='';notify('Original defaults restored.');});
  for(const button of document.querySelectorAll('[data-order]'))button.addEventListener('click',()=>{order=button.dataset.order;for(const b of document.querySelectorAll('[data-order]'))b.setAttribute('aria-pressed',b===button);renderGraph();});
  $('clear-path').addEventListener('click',()=>{selected=null;quickOpen=false;renderGraph();renderRank();renderInspector();renderQuickEditor();});
  $('edit-selected').addEventListener('click',()=>{if(selected){quickOpen=true;renderQuickEditor();}});
  let graphResize;window.addEventListener('resize',()=>{clearTimeout(graphResize);graphResize=setTimeout(renderGraph,120);});
  $('graph-details').addEventListener('toggle',()=>{renderGraph();});
  $('matrix-details').addEventListener('toggle',()=>{if($('matrix-details').open)renderMatrices();});
  window.addEventListener('beforeunload',event=>{const dirty=$('node-form')?.dataset.dirty==='true'||$('evidence-form')?.dataset.dirty==='true'||$('physical-form')?.dataset.dirty==='true';if(!storageOK||dirty){event.preventDefault();event.returnValue='';}});
  document.addEventListener('input',event=>{const form=event.target.closest('#node-form,#evidence-form,#physical-form');if(form)form.dataset.dirty='true';});
}
async function boot(){
  try{
    const responses=await Promise.all(['math_to_atoms_data_v001.json','math_to_atoms_quantities_v009.json','math_to_atoms_values_v013.json'].map(name=>fetch(new URL('./'+name,import.meta.url))));
    if(responses.some(response=>!response.ok))throw new Error('The dataset or physical reference file could not load.');
    [base,quantities,valueReferences]=await Promise.all(responses.map(response=>response.json()));
    validateWorkspace({data:base,weights:{...DEFAULT_WEIGHTS},scope:'all',annotations:{}},base);load();
    $('loading').hidden=true;$('app').hidden=false;wire();renderScenarios();refresh();
    if(storageWarning)notify(storageWarning);else if(isDefault()&&storageOK)$('save-status').textContent='Defaults · saved in this browser';
  }catch(error){$('loading').textContent=`The ledger could not load: ${error.message} Serve this folder over HTTP so the JSON and modules can load, or reload the hosted page.`;}
}
boot();
