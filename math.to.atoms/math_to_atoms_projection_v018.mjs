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
    result[s.axis]={axis:s.axis,series:s,trend,rate,override:override!==null,startYear:PROJECTION_START_YEAR,targetYear,points,baseline:end.baseline,withScenario:end.withScenario,delta:end.withScenario===null?null:end.withScenario-end.baseline};
  }
  return result;
}
export function projectionValue(axis,value){if(value===null)return axis==='time'?'Undefined':'Not valued';return axis==='economy'?fmt(value/1e12)+'T int.-$':axis==='climate'?fmt(value/1e9)+' Gt/yr':axis==='health'?fmt(value)+' yr':fmt(value,0)+' index';}
export function projectionDelta(f){if(f.delta===null)return f.axis==='time'?'Undefined at 100% time reduction':'Set the energy spending base';return `${f.delta>=0?'+':'−'}${projectionValue(f.axis,Math.abs(f.delta))}`;}
export function renderMaster(host,macro,projection,forecasts,impact,source=null){
  if(!host.dataset.initialized){
    host.innerHTML=`<div class="master-heading"><div><div class="eyebrow">One master slider · four outcome indicators</div><h2>What changes over the next Y years?</h2></div><a class="text-button" href="#macro-scenario">View charts ↓</a></div><div class="master-controls"><label class="master-capture"><span>Opportunity reached <output data-master-capture></output></span><input type="range" min="0" max="100" step="1" data-macro="capturePercent" aria-label="Master opportunity reached"><input type="number" min="0" max="100" step="any" data-macro="capturePercent" aria-label="Master opportunity percentage"></label><label class="master-horizon"><span>Next <output data-master-horizon></output> years</span><input type="range" min="1" max="100" step="1" data-projection="horizonYears" aria-label="Outlook horizon in years"><input type="number" min="1" max="100" step="1" data-projection="horizonYears" aria-label="Outlook years Y"></label></div><div class="master-cards" data-master-cards aria-live="polite"></div><p class="master-note" data-master-note></p><details class="projection-assumptions"><summary>Baseline expectations & deployment assumptions</summary><p>The baseline extends the source trend window (10 years by default), separately for each metric. It is an editable extrapolation, not an official forecast. The scenario impact ramps from zero in 2026 to full modeled adoption at the end of Y years. Blank rates use the source trend.</p><div class="projection-rates">${[['economy','Real GDP growth (% / yr)'],['health','Life-expectancy gain (years / yr)'],['climate','Fossil CO₂ growth (% / yr)'],['time','US productivity growth (% / yr)']].map(([axis,label])=>`<label>${label}<input type="number" step="any" data-projection-rate="${axis}" aria-label="${label}"><small data-rate-source="${axis}"></small></label>`).join('')}</div><div class="master-adoption"><label>Deployment (%)<input type="number" min="0" max="100" step="any" data-macro="adoptionPercent" aria-label="Master deployment percentage"></label><label>Local improvement (%)<input type="number" min="0" max="100" step="any" data-macro="localGainPercent" aria-label="Master local improvement percentage"></label></div><p>Economy: the upper curve adds the modeled GDP-equivalent resource value to projected real GDP for scale; it is not additional GDP output or a nominal-dollar conversion. Health: the increment is a stationary lifespan equivalent, not a life-table forecast. Climate: subtracts the current-reference avoided CO₂ amount from the projected fossil/industry baseline. Delivery: converts the assumed time saving into an equivalent US output-per-hour proxy; it is not a global project-duration forecast.</p><button data-reset-projection>Reset outlook assumptions</button></details>`;
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
  const labels={economy:'Economic resources',health:'Human health',climate:'Climate',time:'Delivery / productivity proxy'};
  const notes={economy:impact.economicValue===null?'Annual reference savings not valued':`${money(impact.economicValue)}/yr at current nominal reference · ${pct(impact.gdpPercent)} GDP-value equivalent; not a GDP-output forecast`,health:`${compact(impact.health.averted)} DALYs/yr averted · lifespan equivalent`,climate:`${fmt(impact.carbonAvoided)} Gt/yr reference potential · capped at baseline`,time:`${pct(impact.effect*100)} less required time · US proxy only`};
  host.querySelector('[data-master-cards]').innerHTML=Object.values(forecasts).map(f=>`<article data-master-axis="${f.axis}"><div class="eyebrow">${labels[f.axis]}</div><div class="master-target">${f.targetYear} · ${f.axis==='economy'?'2021 PPP · resources equivalent':'baseline → with scenario'}</div><div class="master-pair"><span>${projectionValue(f.axis,f.baseline)}</span><b>→</b><strong>${projectionValue(f.axis,f.withScenario)}</strong></div><div class="master-delta">${projectionDelta(f)}</div><p>${notes[f.axis]}</p></article>`).join('');
  host.querySelector('[data-master-note]').textContent=`${pct(macro.capturePercent)} reached × ${pct(macro.adoptionPercent)} deployed × ${pct(macro.localGainPercent)} local improvement = ${pct(impact.effect*100)} reference effect, phased in through ${PROJECTION_START_YEAR+projection.horizonYears}. Historical estimates stay unchanged. Baseline rates and horizon are assumptions.`;
}
