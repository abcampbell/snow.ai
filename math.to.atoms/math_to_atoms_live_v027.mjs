import {historyPanel} from './math_to_atoms_history_v027.mjs';
import {periodReadout,periodValue} from './math_to_atoms_projection_v027.mjs';
import {energyOutlook,energyReadout,energyCurve} from './math_to_atoms_energy_v027.mjs';
import {fmt,money,pppMoney,pct,compact} from './math_to_atoms_value_model_v027.mjs';

const labels={economy:'Economics',health:'Health',climate:'Climate',time:'Delivery'};
const notes={economy:'Savings shown against GDP for scale; 2021 purchasing-power dollars. The gap is not added GDP growth.',health:'Lifespan at birth, with the estimated gain from healthy years saved.',climate:'CO₂ from fossil fuels and industry. Lower is better.',time:'US output per hour (1900 = 100), used to compare delivery speed.'};
const signed=(n,format)=>n===null?'Not available':`${n>=0?'+':'−'}${format(Math.abs(n))}`;
export function renderLiveCharts(host,data,forecasts,scaleForecasts,impact,projection,maxImpact=impact){
  const view=host.dataset.curveWindow||'recent',energy=energyOutlook(impact,projection.horizonYears);
  const open=new Set([...host.querySelectorAll('[data-live-details][open]')].map(d=>d.dataset.liveDetails));
  host.querySelector('[data-master-cards]').innerHTML=['economy','health','energy','climate','time'].map(axis=>{
    if(axis==='energy')return `<article data-master-axis="energy" class="live-chart"><header><h3>Energy</h3><p class="live-result" data-live-value="energy">${pct(energy.cutPercent)} cheaper</p><p class="live-compare">${energy.savings===null?'Set energy spending':money(energy.savings)+'/year saved'}</p></header>${energyCurve(energy,maxImpact.effect*100,true)}<p class="live-yearly" data-live-annual><span>Added savings / yr</span><b>${energy.averageBuild===null?'—':money(energy.averageBuild)}</b></p><details data-live-details="energy"${open.has(axis)?' open':''}><summary>Details</summary>${energyReadout(energy)}</details></article>`;
    const f=forecasts[axis],p=f.period;
    const extra=axis==='economy'?f.delta===null?'Set energy spending':signed(f.delta,pppMoney)+'/yr saved':axis==='health'?signed(f.delta,v=>fmt(v)+' years'):axis==='climate'?`${fmt(Math.abs(f.delta)/1e9)} Gt/yr less CO₂`:f.delta===null?'Not available':`${pct(f.delta/f.baseline*100)} more/hour`;
    const yearly=axis==='economy'?(p.averageExtraPerYear===null?'—':pppMoney(p.averageExtraPerYear)):axis==='health'?fmt(p.averageExtraPerYear*365.25,1)+' days':axis==='climate'?compact(Math.abs(p.averageExtraPerYear))+' t':p.averageExtraPerYear===null?'—':fmt(p.averageExtraPerYear,1)+' points';
    const yearlyLabel={economy:'Added savings / yr',health:'Life added / yr',climate:'Added CO₂ savings / yr',time:'Added output / yr'}[axis];
    return `<article data-master-axis="${axis}" class="live-chart"><header><h3>${labels[axis]}</h3><p class="live-result" data-live-value="${axis}">${periodValue(axis,f.withScenario)}</p><p class="live-compare">${extra}</p></header>${historyPanel(axis,data,f.targetYear,f,view,{minimal:true,scaleForecast:scaleForecasts[axis]})}<p class="live-yearly" data-live-annual><span>${yearlyLabel}</span><b>${yearly}</b></p><details data-live-details="${axis}"${open.has(axis)?' open':''}><summary>Details</summary><p class="live-scope">${notes[axis]} Average additions are the final difference divided by ${p.years} years.</p>${axis==='economy'?`<p class="gdp-explanation">The USD calculations use your ${money(impact.gdp)} GDP assumption. <a href="https://data.worldbank.org/country/world" target="_blank" rel="noopener noreferrer">World Bank</a>: $118T nominal GDP in 2025. The curve uses international dollars adjusted for prices and purchasing power, projected to ${f.targetYear}; these are different units from current US dollars.</p>`:''}<a class="live-source" href="${f.series.source_url}" target="_blank" rel="noopener noreferrer">Source</a>${periodReadout(f)}</details></article>`;
  }).join('')+`<p class="live-unit-note" data-unit-note>Economics: 2021 PPP dollars. Spending basis: ${money(impact.gdp)} nominal GDP. Delivery index: 1900 = 100.</p>`;
  for(const b of host.querySelectorAll('[data-live-window]'))b.setAttribute('aria-pressed',b.dataset.liveWindow===view);
}
