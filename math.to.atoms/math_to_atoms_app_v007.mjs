import {DEFAULT_WEIGHTS,WEIGHT_LIMITS,copy,score,sensitivity,entityKey,validateWorkspace} from './math_to_atoms_model_v007.mjs';

const $=id=>document.getElementById(id), KEY='mta-ledger-v7';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const f=value=>value===null?'—':Number(value.toFixed(2)).toString();
const f1=value=>value===null?'—':value.toFixed(1);
const amount=value=>value===0?'0':value>=10000||value<0.001?value.toExponential(2):Number(value.toPrecision(4)).toLocaleString('en-US');
const blue=t=>`hsl(212 ${58+24*t}% ${17+35*t}%)`;
const sourceNames={core:'Campbell + Claude','A':'Haiku · infrastructure','B':'Haiku · history and analogy','S':'Sonnet · blind spots','+':'Claude · added math field'};
const weightInfo={b:['Base b','Multiplier for each point',0.5],alpha:['Impact weight α','How strongly impact counts',0.25],lambda:['Difficulty penalty λ','How strongly math difficulty counts',0.25],kappa:['Capability drag κ','How strongly physical barriers count',0.25]};
let base,state,results,ranges,baseline,scenarios=Object.create(null),history=[],tab='problems',selected=null,order='score',expanded=false,storageOK=true,noticeTimer,rangeBefore=null,storageWarning='';

function notify(message){$('notice').textContent=message;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('notice').textContent='',5500);}
function fresh(){return {data:copy(base),weights:{...DEFAULT_WEIGHTS},scope:'all',annotations:{}};}
function checkpoint(value=state){history.push(copy(value));if(history.length>40)history.shift();}
function mutate(change){checkpoint();change();refresh();}
function persist(){
  try{localStorage.setItem(KEY,JSON.stringify({workspace:state,scenarios}));storageOK=true;}
  catch{storageOK=false;}
  $('save-status').textContent=storageOK?'Saved in this browser':'Browser save unavailable · export JSON';
  $('save-status').classList.toggle('save-error',!storageOK);
  $('undo').disabled=!history.length;
}
function isDefault(){return JSON.stringify(state.data)===JSON.stringify(base)&&JSON.stringify(state.weights)===JSON.stringify(DEFAULT_WEIGHTS)&&!Object.keys(state.annotations).length;}
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
      state=validateWorkspace(migrated,base);storageWarning='Your v006 edits have been copied into v007.';
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
function selectNode(type,id,scroll=false){selected={type,id:String(id)};renderRank();renderInspector();if($('graph-details').open)renderGraph();if(scroll&&matchMedia('(max-width:760px)').matches)$('inspector').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth',block:'start'});}
function renderRank(){
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
    return `<button class="rank-row${selectionKey()===key?' selected':''}" data-select-type="${tab}" data-select-id="${id}" aria-pressed="${selectionKey()===key}" aria-label="${escape(r.name||r.s)}, priority rank ${rank}, ladder ${f1(r.ladder)}, edit"><span class="rank-number">${tab==='problems'&&$('sort').value==='impact'?r.impactRank:rank}</span><span><span class="rank-name">${escape(r.name||r.s)}${origin}</span><span class="rank-desc">${escape(description)} · default #${defaultRank}</span></span><span class="rank-range" title="Best to worst rank across nearby weights">${range.low===range.high?'#'+range.low:range.low+'–'+range.high}</span><span class="rank-score">${f1(r.ladder)}<span class="score-bar"><i style="width:${Math.max(0,Math.min(100,r.score/max*100))}%"></i></span></span></button>`;
  }).join('')||'<p class="empty">No matches. Try another name.</p>';
  $('show-more').hidden=!!query||list.length<=8;$('show-more').textContent=expanded?'Show top 8':`Show all ${list.length}`;
  const prefix=tab==='outcomes'?'Outcome scores are priority indices, not predicted quantities in the listed units. ':tab==='math'?'Fields earn points for every contributing problem; breadth is shown beside the score. ': 'Δ = priority rank − impact rank; negative means higher priority than impact alone. ';
  $('ranking-foot').textContent=prefix+'Rank range: change one weight at a time by ±0.25 (base ±0.5). These are local sensitivity checks, not confidence intervals. Default rank uses the original data and weights in this scope.';
  $('sort-wrap').hidden=tab!=='problems';
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
function renderInspector(){
  if(!selected||!getScored(selected.type,selected.id))selected={type:tab,id:String(tab==='problems'?rows()[0].n:rows()[0].id)};
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
  $('inspector').innerHTML=`<div class="eyebrow">Selected ${label.toLowerCase()} · ${escape(id)}</div><div class="inspector-header"><div><h2 id="inspector-title">${escape(row.name||row.s)}</h2><p>${escape(type==='problems'?row.real_world:type==='outcomes'?row.unit:'Missing theory, closure, bound, or algorithm')}</p></div><div class="inspector-score">${f1(row.ladder)}<small>LADDER</small></div></div><div class="inspector-grid"><div><h3>Edit the assumptions</h3><form id="node-form">${inputs}<label class="field">Name<input id="node-name" value="${escape(row.name||row.s)}" maxlength="300" required></label>${type==='problems'?`<label class="field">Short map label<input id="node-short" value="${escape(row.short)}" maxlength="100" required></label><label class="field">Physical application<textarea id="node-application" maxlength="2000">${escape(row.real_world)}</textarea></label>`:type==='math'?`<label class="field">Short map label<input id="node-short" value="${escape(row.s)}" maxlength="100" required></label>`:`<label class="field">Unit<input id="node-unit" value="${escape(row.unit)}" maxlength="100" required></label><label class="field">Today’s anchor · unverified until sourced<textarea id="node-anchor" maxlength="2000">${escape(row.today)}</textarea></label>`}<div class="inspector-actions"><button class="primary" type="submit">Apply changes</button><span>Changes update the whole ledger.</span></div></form><div class="provenance"><h3>Evidence & notes</h3><p>${type==='outcomes'?'The anchor is rough and unverified. The unit is context for the outcome; the score does not estimate it.':`Origin: ${escape(sourceNames[row.src]||'Imported judgment')}. Scores and edges start as judgments.`}</p><div class="evidence-line">${source}</div><form id="evidence-form"><label class="field">Evidence status<select id="evidence-kind"><option value="judgment"${note.kind!=='sourced'?' selected':''}>Judgment / working hypothesis</option><option value="sourced"${note.kind==='sourced'?' selected':''}>Source attached · review notes</option></select></label><div class="field-row"><label class="field">Source URL<input type="url" id="evidence-source" value="${escape(note.source)}" placeholder="https://…" maxlength="2000"></label><label class="field">Source date<input type="date" id="evidence-date" value="${escape(note.date)}"></label></div><label class="field">Reasoning, uncertainty, or evidence for individual links<textarea id="evidence-note" maxlength="4000">${escape(note.note)}</textarea></label><button type="submit">Save evidence & notes</button></form></div></div><div><h3>Why it ranks here</h3>${explanation}${type==='problems'?`<p class="small">Local rank range: <b>${range.low===range.high?'#'+range.low:range.low+'–'+range.high}</b>. The math and capability scores are requirements, not probabilities of success.</p>`:`<p class="small" style="margin-top:14px">${type==='math'?'Each link contributes (strength/3) × impact multiplier × capability discount, before the field’s impact weight and difficulty penalty.':'Each contribution is (strength/3) × problem index. These contributions may overlap; this is not a total of physical benefits.'}</p>`}<div class="node-connections"><h3>Edit connected paths</h3><p class="small">0 none · 1 weak · 2 plausible · 3 direct. Link strengths are judgments.</p>${type==='problems'?`<details open><summary>Math → this problem</summary>${connections('math',type,id)}</details><details><summary>This problem → outcomes</summary>${connections('outcomes',type,id)}</details>`:`<details open><summary>${type==='math'?'This field → physical problems':'Physical problems → this outcome'}</summary>${connections('problems',type,id)}</details>`}</div></div></div>`;
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
function setEdge(type,id,n,strength){mutate(()=>{const links=getRow(type,id).links;if(strength)links[n]=strength;else delete links[n];});}
function graphSets(){
  const sets={math:new Set(),problems:new Set(),outcomes:new Set()};
  if(!selected)return sets;
  const {type,id}=selected,row=getScored(type,id);if(!row)return sets;
  if(type==='problems'){
    sets.problems.add(String(id));for(const m of results.math)if(m.links[id])sets.math.add(m.id);for(const o of results.outcomes)if(o.links[id])sets.outcomes.add(o.id);
  }else{
    sets[type].add(id);for(const [n,s] of Object.entries(row.links))if(s&&getScored('problems',n)){
      sets.problems.add(n);const other=type==='math'?'outcomes':'math';for(const node of results[other])if(node.links[n])sets[other].add(node.id);
    }
  }
  return sets;
}
function renderGraph(){
  const sets=graphSets(),picked=!!selected,W=1120,rowHeight=27,H=50+results.problems.length*rowHeight;
  const cols=[['math','Math fields',18,260],['problems','Physical problems',425,280],['outcomes','Outcomes',870,232]],positions={},lists={};
  const trunc=(text,max)=>text.length>max?text.slice(0,max-1)+'…':text;
  for(const [type,,x,width]of cols){
    const list=order==='score'?results[type]:state.data[type].map(r=>getScored(type,type==='problems'?r.n:r.id)).filter(Boolean);lists[type]=list;
    list.forEach((r,i)=>positions[entityKey(type,r)]={x,y:32+(i+.5)*(H-45)/list.length,width});
  }
  let svg=`<svg viewBox="0 0 ${W} ${H}" class="desktop-map" aria-label="Math to physical problems to outcomes connection graph">`;
  for(const [type,label,x]of cols)svg+=`<text class="column-title" x="${x}" y="17">${label.toUpperCase()} · ${lists[type].length}</text>`;
  function edge(from,to,strength,active){const a=positions[from],b=positions[to];if(!a||!b)return;const start=a.x+a.width,end=b.x,gap=(end-start)*.45;svg+=`<path class="edge" stroke-width="${.6+strength*.45}" opacity="${picked?(active?.78:.035):.07+strength*.08}" d="M${start},${a.y} C${start+gap},${a.y} ${end-gap},${b.y} ${end},${b.y}"/>`;}
  for(const m of results.math)for(const[n,s]of Object.entries(m.links))if(s)edge('math:'+m.id,'problems:'+n,s,sets.math.has(m.id)&&sets.problems.has(n));
  for(const o of results.outcomes)for(const[n,s]of Object.entries(o.links))if(s)edge('problems:'+n,'outcomes:'+o.id,s,sets.problems.has(n)&&sets.outcomes.has(o.id));
  for(const[type]of cols){
    const values=results[type].map(r=>r.ladder).filter(r=>r!==null),lo=Math.min(...values),hi=Math.max(...values);
    for(const r of lists[type]){
      const key=entityKey(type,r),id=type==='problems'?String(r.n):r.id,pos=positions[key],active=sets[type].has(id),tone=r.ladder===null?0:(r.ladder-lo)/(hi-lo||1),label=r.short||r.s;
      svg+=`<g class="node${selectionKey()===key?' picked':''}" data-select-type="${type}" data-select-id="${id}" tabindex="0" role="button" aria-label="${escape(r.name||r.s)}, ladder ${f1(r.ladder)}" opacity="${picked&&!active?.22:1}"><title>${escape(r.name||r.s)} · ${f1(r.ladder)}</title><rect x="${pos.x}" y="${pos.y-10.5}" width="${pos.width}" height="21" rx="4" fill="${blue(tone)}"/><text class="node-label" x="${pos.x+8}" y="${pos.y+4}">${escape(trunc(label,Math.floor((pos.width-55)/6.5)))}</text><text class="node-score" x="${pos.x+pos.width-8}" y="${pos.y+4}" text-anchor="end">${f1(r.ladder)}</text></g>`;
    }
  }
  svg+='</svg>';
  const mobile=`<div class="mobile-map"><p class="map-hint">${selected?'Showing the selected path. Tap any node to explore another.':'Top 6 in each layer. Select a node to trace its path.'}</p>${cols.map(([type,label],index)=>`${index?'<div class="map-arrow">↓</div>':''}<div class="map-column"><h3>${label}</h3>${(picked?results[type].filter(r=>sets[type].has(String(type==='problems'?r.n:r.id))):results[type].slice(0,6)).map(r=>`<button class="map-node" data-select-type="${type}" data-select-id="${type==='problems'?r.n:r.id}" aria-pressed="${selectionKey()===entityKey(type,r)}"><span>${escape(r.short||r.s)}</span><b>${f1(r.ladder)}</b></button>`).join('')||'<p class="small">No connections in this scope.</p>'}</div>`).join('')}</div>`;
  $('graph').innerHTML=svg+mobile;
}
function renderMatrices(){
  const problems=[...results.problems].sort((a,b)=>a.n-b.n);
  for(const type of ['math','outcomes']){
    let html='<thead><tr><th class="row-head" scope="col">'+(type==='math'?'Math':'Outcome')+' ↓ problem →</th>'+problems.map(p=>`<th scope="col" title="${escape(p.name)}">${p.n}</th>`).join('')+'</tr></thead><tbody>';
    for(const r of results[type])html+=`<tr><th class="row-head" scope="row" title="${escape(r.name||r.s)}">${escape(r.id)} ${escape(r.s)}</th>${problems.map(p=>{const strength=r.links[p.n]||0;return `<td><button class="matrix-cell" data-matrix-type="${type}" data-edge-id="${r.id}" data-problem="${p.n}" data-strength="${strength}" aria-label="${escape(r.name||r.s)} to ${escape(p.name)}: ${strength}; tap to cycle">${strength||'·'}</button></td>`;}).join('')}</tr>`;
    $('matrix-'+type).innerHTML=html+'</tbody>';
  }
}
function refresh(weights=true){
  results=score(state.data,state.weights,state.scope);ranges=sensitivity(state.data,state.weights,state.scope);baseline=score(base,DEFAULT_WEIGHTS,state.scope);
  if(weights)renderWeights();else renderScale();
  for(const button of document.querySelectorAll('[data-scope]'))button.setAttribute('aria-pressed',button.dataset.scope===state.scope);
  $('scope-count').textContent=`${results.math.length} / ${results.problems.length} / ${results.outcomes.length} nodes`;
  if(!selected||!getScored(selected.type,selected.id))selected={type:'problems',id:String(results.problems[0].n)};
  renderRank();renderInspector();if($('graph-details').open)renderGraph();if($('matrix-details').open)renderMatrices();persist();
}
async function confirmChange(title,message){
  const dialog=$('confirm-dialog');$('confirm-title').textContent=title;$('confirm-message').textContent=message;dialog.returnValue='';dialog.showModal();
  return new Promise(resolve=>dialog.addEventListener('close',()=>resolve(dialog.returnValue==='confirm'),{once:true}));
}
function wire(){
  document.addEventListener('click',event=>{
    const target=event.target.closest('[data-select-type]');if(target){selectNode(target.dataset.selectType,target.dataset.selectId,true);return;}
    const cell=event.target.closest('[data-matrix-type]');if(cell){setEdge(cell.dataset.matrixType,cell.dataset.edgeId,cell.dataset.problem,(Number(cell.dataset.strength)+1)%4);}
  });
  document.addEventListener('keydown',event=>{const target=event.target.closest('g[data-select-type]');if(target&&(event.key==='Enter'||event.key===' ')){event.preventDefault();selectNode(target.dataset.selectType,target.dataset.selectId);}});
  document.addEventListener('change',event=>{const target=event.target;if(target.matches('[data-edge-type]'))setEdge(target.dataset.edgeType,target.dataset.edgeId,target.dataset.problem,Number(target.value));});
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
    scenarios[name]=copy(state);persist();renderScenarios();$('scenario-select').value=name;notify(storageOK?'Scenario saved in this browser.':'Scenario held in memory. Export JSON to keep it.');
  });
  $('scenario-select').addEventListener('change',()=>{const name=$('scenario-select').value;if(scenarios[name]){mutate(()=>state=copy(scenarios[name]));$('scenario-name').value=name;notify('Scenario loaded.');}});
  $('export').addEventListener('click',()=>{
    const name=$('scenario-name').value.trim()||'untitled',exported={format:'math-to-atoms-workspace',version:7,name,workspace:state};
    const url=URL.createObjectURL(new Blob([JSON.stringify(exported,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download=`math_to_atoms_${name.replace(/[^a-z0-9_-]+/gi,'_').slice(0,60)||'scenario'}_v007.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notify('Scenario exported, including scores, links, and notes.');
  });
  $('import').addEventListener('click',()=>$('import-file').click());
  $('import-file').addEventListener('change',async event=>{
    const file=event.target.files[0];if(!file)return;
    try{
      if(file.size>2_000_000)throw new Error('Import a workspace JSON smaller than 2 MB.');
      const imported=JSON.parse(await file.text());if(imported.format!=='math-to-atoms-workspace'||imported.version!==7)throw new Error('Choose a v007 workspace export.');
      const next=validateWorkspace(imported.workspace,base);mutate(()=>state=next);$('scenario-name').value=typeof imported.name==='string'?imported.name.slice(0,80):'';$('scenario-select').value='';notify('Workspace imported. Undo restores the previous workspace.');
    }catch(error){notify('Import failed: '+error.message);}finally{event.target.value='';}
  });
  $('restore-defaults').addEventListener('click',async()=>{if(!await confirmChange('Restore the original ledger?','This resets scores, links, notes, scope, and weights. Saved scenarios remain available. You can undo this change.'))return;mutate(()=>state=fresh());$('scenario-name').value='';$('scenario-select').value='';notify('Original defaults restored.');});
  for(const button of document.querySelectorAll('[data-order]'))button.addEventListener('click',()=>{order=button.dataset.order;for(const b of document.querySelectorAll('[data-order]'))b.setAttribute('aria-pressed',b===button);renderGraph();});
  $('clear-path').addEventListener('click',()=>{selected=null;renderGraph();renderRank();});
  $('graph-details').addEventListener('toggle',()=>{if($('graph-details').open)renderGraph();});
  $('matrix-details').addEventListener('toggle',()=>{if($('matrix-details').open)renderMatrices();});
  window.addEventListener('beforeunload',event=>{const dirty=$('node-form')?.dataset.dirty==='true'||$('evidence-form')?.dataset.dirty==='true';if(!storageOK||dirty){event.preventDefault();event.returnValue='';}});
  document.addEventListener('input',event=>{const form=event.target.closest('#node-form,#evidence-form');if(form)form.dataset.dirty='true';});
}
async function boot(){
  try{
    const response=await fetch(new URL('./math_to_atoms_data_v001.json',import.meta.url));if(!response.ok)throw new Error(`Dataset returned HTTP ${response.status}.`);base=await response.json();
    validateWorkspace({data:base,weights:{...DEFAULT_WEIGHTS},scope:'all',annotations:{}},base);load();
    $('loading').hidden=true;$('app').hidden=false;wire();renderScenarios();refresh();
    if(storageWarning)notify(storageWarning);else if(isDefault()&&storageOK)$('save-status').textContent='Defaults · saved in this browser';
  }catch(error){$('loading').textContent=`The ledger could not load: ${error.message} Serve this folder over HTTP so the JSON and modules can load, or reload the hosted page.`;}
}
boot();
