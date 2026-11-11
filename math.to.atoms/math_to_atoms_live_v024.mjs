import {historyPanel} from './math_to_atoms_history_v024.mjs';
import {periodReadout,periodCopy,periodValue} from './math_to_atoms_projection_v024.mjs';
import {energyOutlook,energyReadout,energyCurve} from './math_to_atoms_energy_v024.mjs';
import {fmt,money,pct} from './math_to_atoms_value_model_v013.mjs';

const labels={economy:'Economics',health:'Health',climate:'Climate',time:'Delivery'};
const notes={economy:'Savings shown against GDP for scale; 2021 purchasing-power dollars. The gap is not a GDP-growth forecast.',health:'Lifespan at birth, with the estimated gain from healthy years saved.',climate:'CO₂ from fossil fuels and industry. Lower is better.',time:'US output per hour, used to compare delivery speed.'};
export function renderLiveCharts(host,data,forecasts,scaleForecasts,impact,projection,maxImpact=impact){
  const view=host.dataset.curveWindow||'recent',energy=energyOutlook(impact,projection.horizonYears);
  const order=['economy','health','energy','climate','time'];
  const open=new Set([...host.querySelectorAll('[data-live-details][open]')].map(d=>d.dataset.liveDetails));
  host.querySelector('[data-master-cards]').innerHTML=order.map(axis=>{
    if(axis==='energy')return `<article data-master-axis="energy" class="live-chart"><header><h3>Energy</h3><p class="live-result" data-live-value="energy">${pct(energy.cutPercent)} cheaper <small>by ${energy.targetYear}</small></p><p class="live-compare">${energy.savings===null?'Set energy spending':money(energy.savings)+'/year saved'} · already counted in economics</p></header>${energyCurve(energy,maxImpact.effect*100)}<p class="live-yearly" data-live-annual>${energy.averageBuild===null?'Set energy spending.':`Yearly increase in savings: ${money(energy.averageBuild)} on average.`}</p><details data-live-details="energy"${open.has(axis)?' open':''}><summary>Numbers & method</summary>${energyReadout(energy)}</details></article>`;
    const f=forecasts[axis],c=periodCopy(f);
    const extra=axis==='economy'?c.gain+' in savings':axis==='health'?`+${fmt(f.delta)} years of life`:axis==='climate'?`${fmt(Math.abs(f.delta)/1e9)} Gt/year less CO₂`:f.delta===null?'No finite result at 100% time saved':`${pct(f.delta/f.baseline*100)} more work per hour`;
    return `<article data-master-axis="${axis}" class="live-chart"><header><h3>${labels[axis]}</h3><p class="live-result" data-live-value="${axis}">${periodValue(axis,f.withScenario)} <small>in ${f.targetYear}</small></p><p class="live-compare">${extra} · vs current trend</p></header>${historyPanel(axis,data,f.targetYear,f,view,{compact:true,scaleForecast:scaleForecasts[axis]})}<p class="live-yearly" data-live-annual>${c.annual}</p><p class="live-scope">${notes[axis]}</p><details data-live-details="${axis}"${open.has(axis)?' open':''}><summary>Numbers & method</summary>${periodReadout(f)}</details></article>`;
  }).join('');
  for(const b of host.querySelectorAll('[data-live-window]'))b.setAttribute('aria-pressed',b.dataset.liveWindow===view);
}
