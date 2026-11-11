import {fmt,money,pct,compact} from './math_to_atoms_value_model_v013.mjs';
export const PROJECTION_START_YEAR=2026;
export const DEFAULT_PROJECTION=Object.freeze({horizonYears:20,trendWindowYears:10,rates:{economy:null,health:null,climate:null,time:null}});
export function defaultProjection(){return structuredClone(DEFAULT_PROJECTION);}
export function validateProjection(input){
  if(input===undefined)return defaultProjection();
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Invalid outlook assumptions.');
  const result={...defaultProjection(),...input,rates:{...DEFAULT_PROJECTION.rates,...input.rates}};
  if(!Number.isInteger(result.horizonYears)||result.horizonYears<1||result.horizonYears>100)throw new Error('Choose a whole-year horizon from 1 to 100.');
  if(!Number.isInteger(result.trendWindowYears)||result.trendWindowYears<5||result.trendWindowYears>30)throw new Error('Trend window must be 5–30 whole years.');
  if(input.rates!==undefined&&(!input.rates||typeof input.rates!=='object'||Array.isArray(input.rates)))throw new Error('Invalid baseline rates.');
  for(const [axis,v]of Object.entries(result.rates)){
    if(!['economy','health','climate','time'].includes(axis))throw new Error('Unknown baseline axis.');
    const limit=axis==='health'?1:20;
    if(v!==null&&(typeof v!=='number'||!Number.isFinite(v)||v< -limit||v>limit))throw new Error(axis==='health'?'Life-expectancy trend must be between −1 and +1 years per year.':'Baseline annual growth must be between −20% and +20%.');
  }
  return result;
}
export function recentTrend(series,windowYears=10){
  const last=series.points.at(-1),first=series.points.filter(p=>p[0]<=last[0]-windowYears).at(-1)||series.points[0],span=last[0]-first[0];
  const rate=span?series.axis==='health'?(last[1]-first[1])/span:((last[1]/first[1])**(1/span)-1)*100:0;
  return {rate,from:first[0],to:last[0],kind:series.axis==='health'?'years/year':'%/year'};
}
export function projectAll(data,projection,impact){
  const result={};if(!data)return result;
  const targetYear=PROJECTION_START_YEAR+projection.horizonYears;
  for(const s of data.series){
    const trend=recentTrend(s,projection.trendWindowYears),override=projection.rates[s.axis],rate=override??trend.rate,last=s.points.at(-1);
    const points=[];
    for(let year=last[0];year<=targetYear;year++){
      const elapsed=year-last[0],baseline=Math.max(0,s.axis==='health'?last[1]+rate*elapsed:last[1]*(1+rate/100)**elapsed);
      const progress=Math.max(0,Math.min(1,(year-PROJECTION_START_YEAR)/projection.horizonYears));
      let withScenario=baseline;
      if(s.axis==='economy')withScenario=impact.gdpPercent===null?null:baseline*(1+impact.gdpPercent/100*progress);
      if(s.axis==='health')withScenario=baseline+impact.health.lifeYears*progress;
      if(s.axis==='climate')withScenario=Math.max(0,baseline-impact.carbonAvoided*1e9*progress);
      if(s.axis==='time')withScenario=1-impact.effect*progress<=1e-12?null:baseline/(1-impact.effect*progress);
      points.push({year,baseline,withScenario,progress});
    }
    const end=points.at(-1);
    const f={axis:s.axis,series:s,trend,rate,override:override!==null,startYear:PROJECTION_START_YEAR,targetYear,points,baseline:end.baseline,withScenario:end.withScenario,delta:end.withScenario===null?null:end.withScenario-end.baseline};
    f.period=periodSummary(f,impact);result[s.axis]=f;
  }
  return result;
}
export function periodSummary(f,impact){
  const years=f.targetYear-f.startYear,today=f.points.find(p=>p.year===f.startYear).baseline,periodPoints=f.points.filter(p=>p.year>=f.startYear);
  let cumulative=null;
  if(['economy','climate'].includes(f.axis)&&periodPoints.every(p=>p.withScenario!==null)){
    cumulative=0;
    for(let i=1;i<periodPoints.length;i++){const a=periodPoints[i-1],b=periodPoints[i];cumulative+=((a.withScenario-a.baseline)+(b.withScenario-b.baseline))/2*(b.year-a.year);}
  }
  return {years,today,baselineChange:f.baseline-today,totalChange:f.withScenario===null?null:f.withScenario-today,transitionChange:f.delta,
    averageBaselinePerYear:(f.baseline-today)/years,averageTotalPerYear:f.withScenario===null?null:(f.withScenario-today)/years,averageExtraPerYear:f.delta===null?null:f.delta/years,
    cumulative,cumulativeDalys:f.axis==='health'?impact.health.averted*years/2:null,lastSourceYear:f.series.points.at(-1)[0],lastSourceValue:f.series.points.at(-1)[1]};
}
const signed=(value,text)=>value===null?'Not available':`${value>0?'+':value<0?'−':''}${text(Math.abs(value))}`;
export function periodValue(axis,value){
  if(value===null)return 'Not available';
  return axis==='economy'?money(value)+'/year':axis==='health'?fmt(value)+' years':axis==='climate'?fmt(value/1e9)+' Gt/year':fmt(value,1)+' points';
}
export function periodCopy(f){
  const p=f.period;
  const gain=signed(f.delta,v=>periodValue(f.axis,v));
  let annual,total=null,unit;
  if(f.axis==='economy'){
    annual=p.averageExtraPerYear===null?'Set the energy spending base to calculate an annual change.':`The annual benefit builds by about ${money(Math.abs(p.averageExtraPerYear))} each year, on average.`;
    total=p.cumulative===null?null:`${money(p.cumulative)} extra resources across all ${p.years} years`;
    unit='Annual resources in constant 2021 purchasing-power dollars.';
  }else if(f.axis==='health'){
    annual=`Average extra gain: ${fmt(p.averageExtraPerYear*365.25,1)} days of life expectancy per calendar year.`;
    total=`${compact(p.cumulativeDalys)} healthy life-years gained across ${p.years} years`;
    unit='Average life expectancy at birth. The extra years are a rough population comparison.';
  }else if(f.axis==='climate'){
    annual=`The annual emissions saving builds by about ${compact(Math.abs(p.averageExtraPerYear))} tonnes each year, on average.`;
    total=p.cumulative===null?null:`${fmt(Math.abs(p.cumulative)/1e9)} Gt CO₂ avoided across ${p.years} years`;
    unit='Annual fossil and industrial CO₂ emissions; lower is better.';
  }else{
    annual=p.averageExtraPerYear===null?'A 100% time saving has no finite output-per-hour comparison.':`Average extra gain: ${fmt(p.averageExtraPerYear,1)} index points per calendar year.`;
    unit='US work per hour (1900 = 100), used here to illustrate time savings.';
  }
  const relative=f.delta===null||!f.baseline?null:f.axis==='economy'?`Equivalent to ${pct(f.delta/f.baseline*100)} of the ${f.targetYear} baseline GDP.`:f.axis==='health'?`${pct(f.delta/f.baseline*100)} above the ${f.targetYear} lifespan baseline.`:f.axis==='climate'?`${pct(-f.delta/f.baseline*100)} below the ${f.targetYear} emissions baseline.`:`${pct(f.delta/f.baseline*100)} more output per hour than the ${f.targetYear} baseline.`;
  return {gain,annual,total,unit,relative};
}
export function periodReadout(f,compactView=false){
  const p=f.period,c=periodCopy(f);
  const average=f.axis==='health'?`${fmt(p.averageExtraPerYear,4)} years of life expectancy (${fmt(p.averageExtraPerYear*365.25,1)} days) per calendar year`:f.axis==='climate'?`${compact(Math.abs(p.averageExtraPerYear))} tonnes/year of additional annual emissions saving per calendar year`:f.axis==='time'?`${p.averageExtraPerYear===null?'Not available':fmt(p.averageExtraPerYear,1)} index points per calendar year`:`${p.averageExtraPerYear===null?'Not available':money(p.averageExtraPerYear)+'/year'} added to the annual resources level per calendar year`;
  return `<div class="period-comparison" data-period-axis="${f.axis}"><div class="period-window">${f.startYear}–${f.targetYear} · ${p.years} years</div><p class="period-unit">${c.unit}</p><dl class="period-values"><div><dt>Today · ${f.startYear} estimate</dt><dd data-period-today>${periodValue(f.axis,p.today)}</dd></div><div><dt>${f.targetYear} · without transition</dt><dd data-period-baseline>${periodValue(f.axis,f.baseline)}</dd></div><div class="period-with"><dt>${f.targetYear} · with transition</dt><dd data-period-with>${periodValue(f.axis,f.withScenario)}</dd></div></dl><p class="period-net" data-period-net>Change from today: <b>${signed(p.totalChange,v=>periodValue(f.axis,v))}</b>, including the normal trend.</p><div class="period-impact"><span>Transition’s extra change by ${f.targetYear}</span><strong data-period-impact>${c.gain}</strong>${c.relative?`<p class="period-relative" data-period-relative>${c.relative}</p>`:''}<p data-period-annual>${c.annual}</p></div>${c.total&&!compactView?`<p class="period-total" data-period-total>${c.total}</p>`:''}${compactView?'':`<details class="period-calculation"><summary>How the years add up</summary><p>All comparisons use ${f.startYear}–${f.targetYear}: ${p.years} years. The transition starts with no added effect and builds to the end-year amount.</p><dl><dt>Change from today, including the normal trend</dt><dd>${signed(p.totalChange,v=>periodValue(f.axis,v))}</dd><dt>Of that, the transition adds</dt><dd>${c.gain}</dd><dt>Average baseline change per calendar year</dt><dd>${signed(p.averageBaselinePerYear,v=>periodValue(f.axis,v))}</dd><dt>Average overall change per calendar year, with the transition</dt><dd>${signed(p.averageTotalPerYear,v=>periodValue(f.axis,v))}</dd><dt>Transition change ÷ ${p.years} years</dt><dd>${average}</dd><dt>Latest source observation</dt><dd>${p.lastSourceYear}: ${periodValue(f.axis,p.lastSourceValue)}</dd></dl><p>“Today” is the ${f.startYear} model estimate, carried forward from that source observation. Without-transition values extend the chosen baseline trend. These are assumptions, not measured future outcomes.</p>${f.axis==='economy'?'<p>The yearly figure is an annual benefit at the end of the transition. The period total adds the area between the two curves, using yearly trapezoids. It is not the end-year annual benefit multiplied by the number of years. Amounts are real purchasing-power equivalents, not nominal cash or additional GDP output; implementation costs are not deducted.</p>':f.axis==='health'?'<p>The period total adds saved healthy life-years as the annual DALY benefit ramps up, keeping the reference disease burden fixed. It does not multiply the lifespan comparison by the number of years, and it is not a count of people.</p>':f.axis==='climate'?'<p>The period total adds each year’s avoided emissions. The end-year reduction is tonnes per year; the accumulated period total is tonnes. Emissions cannot fall below zero.</p>':'<p>Index points measure output per hour. They cannot be added into a cumulative project-time total. This remains a US productivity comparison, not a forecast of global project duration.</p>'}</details>`}</div>`;
}
export function projectionValue(axis,value){if(value===null)return axis==='time'?'Undefined':'Not valued';return axis==='economy'?fmt(value/1e12)+'T int.-$':axis==='climate'?fmt(value/1e9)+' Gt/yr':axis==='health'?fmt(value)+' yr':fmt(value,0)+' index';}
export function projectionDelta(f){if(f.delta===null)return f.axis==='time'?'Undefined at 100% time reduction':'Set the energy spending base';return `${f.delta>=0?'+':'−'}${projectionValue(f.axis,Math.abs(f.delta))}`;}
export function renderMaster(host,macro,projection,forecasts,impact,source=null){
  if(!host.dataset.initialized){
    host.innerHTML=`<div class="master-heading"><div><div class="eyebrow">One master slider · four outcome indicators</div><h2 data-master-period-title>What changes over 20 years?</h2></div><a class="text-button" href="#macro-scenario">View charts ↓</a></div><p class="master-window" data-master-window></p><div class="master-controls"><label class="master-capture"><span>Opportunity reached <output data-master-capture></output></span><input type="range" min="0" max="100" step="1" data-macro="capturePercent" aria-label="Master opportunity reached"><input type="number" min="0" max="100" step="any" data-macro="capturePercent" aria-label="Master opportunity percentage"></label><label class="master-horizon"><span>Time window (years) <output data-master-horizon></output></span><input type="range" min="1" max="100" step="1" data-projection="horizonYears" aria-label="Outlook horizon in years"><input type="number" min="1" max="100" step="1" data-projection="horizonYears" aria-label="Outlook years Y"></label></div><div class="master-cards" data-master-cards aria-live="polite"></div><p class="master-note" data-master-note></p><details class="projection-assumptions"><summary>Baseline expectations & deployment assumptions</summary><p>The baseline extends the source trend window (10 years by default), separately for each metric. It is an editable extrapolation, not an official forecast. The scenario impact ramps from zero in 2026 to full modeled adoption at the end of Y years. Blank rates use the source trend.</p><div class="projection-rates">${[['economy','Real GDP growth (% / yr)'],['health','Life-expectancy gain (years / yr)'],['climate','Fossil CO₂ growth (% / yr)'],['time','US productivity growth (% / yr)']].map(([axis,label])=>`<label>${label}<input type="number" step="any" data-projection-rate="${axis}" aria-label="${label}"><small data-rate-source="${axis}"></small></label>`).join('')}</div><div class="master-adoption"><label>Deployment (%)<input type="number" min="0" max="100" step="any" data-macro="adoptionPercent" aria-label="Master deployment percentage"></label><label>Local improvement (%)<input type="number" min="0" max="100" step="any" data-macro="localGainPercent" aria-label="Master local improvement percentage"></label></div><p>Economy: the upper curve adds the modeled GDP-equivalent resource value to projected real GDP for scale; it is not additional GDP output or a nominal-dollar conversion. Health: the increment is a stationary lifespan equivalent, not a life-table forecast. Climate: subtracts the current-reference avoided CO₂ amount from the projected fossil/industry baseline. Delivery: converts the assumed time saving into an equivalent US output-per-hour proxy; it is not a global project-duration forecast.</p><button data-reset-projection>Reset outlook assumptions</button></details>`;
    host.dataset.initialized='true';
  }
  for(const el of host.querySelectorAll('[data-macro]'))if(el!==source&&document.activeElement!==el)el.value=macro[el.dataset.macro];
  for(const el of host.querySelectorAll('[data-projection]'))if(el!==source&&document.activeElement!==el)el.value=projection[el.dataset.projection];
  host.querySelector('[data-master-capture]').textContent=pct(macro.capturePercent);
  host.querySelector('[data-master-horizon]').textContent=projection.horizonYears;
  for(const input of host.querySelectorAll('[data-projection-rate]')){
    const axis=input.dataset.projectionRate,f=forecasts[axis];if(input!==source&&document.activeElement!==input)input.value=projection.rates[axis]??'';
    input.placeholder=fmt(f.trend.rate,3);host.querySelector(`[data-rate-source="${axis}"]`).textContent=`Auto ${fmt(f.trend.rate,3)} ${f.trend.kind} · ${f.trend.from}–${f.trend.to}`;
  }
  const labels={economy:'Economic resources',health:'Human health',climate:'Climate',time:'Time / work per hour'};
  host.querySelector('[data-master-period-title]').textContent=`${PROJECTION_START_YEAR} → ${PROJECTION_START_YEAR+projection.horizonYears}: a ${projection.horizonYears}-year transition`;
  host.querySelector('[data-master-window]').textContent=`Start in ${PROJECTION_START_YEAR}, build the change over ${projection.horizonYears} years, and reach the full effect in ${PROJECTION_START_YEAR+projection.horizonYears}. “Today” is a ${PROJECTION_START_YEAR} estimate based on each source’s latest recorded data.`;
  host.querySelector('[data-master-cards]').innerHTML=Object.values(forecasts).map(f=>`<article data-master-axis="${f.axis}"><div class="eyebrow">${labels[f.axis]}</div>${periodReadout(f)}</article>`).join('');
  host.querySelector('[data-master-note]').textContent=`${pct(macro.capturePercent)} reached × ${pct(macro.adoptionPercent)} deployed × ${pct(macro.localGainPercent)} local improvement = ${pct(impact.effect*100)} reference effect at the end of the transition. The extra effect starts at zero; the full end-year benefit is not received from day one.`;
}
