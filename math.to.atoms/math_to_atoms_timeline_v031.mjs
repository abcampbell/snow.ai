import {historyPanel} from './math_to_atoms_history_v031.mjs';
import {benefitSeries,benefitCurve,benefitReadout} from './math_to_atoms_public_v029.mjs';
import {energyOutlook,energyCurve,energyReadout,energyHistoryDetails} from './math_to_atoms_energy_v028.mjs';
import {fmt,money,pct,compact} from './math_to_atoms_value_model_v027.mjs';

const axes=['economy','health','energy','climate','time'];
const labels={economy:'Economics',health:'Health',energy:'Energy',climate:'Climate',time:'Delivery'};
const contextLabels={economy:'GDP · Int$T, 2021 PPP',health:'Lifespan · years',energy:'Oil price · 2025 = 100',climate:'CO₂ · Gt/year',time:'US output/hour · 1900 = 100'};
const deltaLabels={economy:'Annual savings',health:'Healthy years saved / year',energy:'Annual energy savings',climate:'CO₂ avoided / year',time:'Project time saved'};

export function deltaValue(axis,impact){return {economy:impact.economicValue,health:impact.health.averted,energy:impact.components[0].value,climate:impact.carbonAvoided,time:impact.deliverySaved}[axis];}
export function deltaText(axis,value){if(value===null)return 'Not set';return axis==='economy'||axis==='energy'?money(value)+'/yr':axis==='health'?compact(value)+'/yr':axis==='climate'?fmt(value)+' Gt/yr':fmt(value)+' years';}
export function deltaCurve(axis,impact,maxImpact,projection){
 const value=deltaValue(axis,impact),max=Math.max(1,deltaValue(axis,maxImpact)??0)*1.12;
 const W=320,H=102,L=20,R=12,T=13,B=24,start=2026,end=start+projection.horizonYears;
 const y=n=>H-B-n/max*(H-T-B),x=t=>L+t*(W-L-R);
 let svg=`<svg viewBox="0 0 ${W} ${H}" data-delta-curve="${axis}" data-end-value="${value??''}" data-domain-max="${max}" role="img" aria-label="${deltaLabels[axis]}, phased in from ${start} to ${end}"><title>Additional benefit under your assumptions, in its own units. Separate from the historical series above.</title><line class="delta-zero" x1="${L}" x2="${W-R}" y1="${y(0)}" y2="${y(0)}"/>`;
 if(value!==null)svg+=`<path class="delta-fill" d="M${x(0)},${y(0)} L${x(1)},${y(value)} L${x(1)},${y(0)} Z"/><path class="delta-line" d="M${x(0)},${y(0)} L${x(1)},${y(value)}"/><circle class="delta-dot" cx="${x(1)}" cy="${y(value)}" r="3"/>`;
 svg+=`<text class="delta-axis" x="${L}" y="${H-5}">${start}</text><text class="delta-axis" x="${W-R}" y="${H-5}" text-anchor="end">${end}</text></svg>`;
 return `<section class="live-delta" aria-label="${deltaLabels[axis]}"><p class="delta-heading"><span>${deltaLabels[axis]}</span><strong data-delta-value="${axis}">${value===null?'': '+'}${deltaText(axis,value)}</strong></p>${svg}</section>`;
}

export function trendCards(data,forecasts,scaleForecasts,impact,projection,maxImpact,energyHistory,settings,{view='full',snapshot=false,open=new Set()}={}){
 const energy=energyOutlook(impact,projection.horizonYears);
 return axes.map(axis=>{
  const f=forecasts[axis],s=benefitSeries(axis,impact,settings,projection),scale=benefitSeries(axis,maxImpact,settings,projection);
  const main={economy:impact.economicValue===null?'Set energy spending':money(impact.economicValue)+'/yr',health:compact(impact.health.averted)+'/yr',energy:pct(impact.effect*100)+' cheaper',climate:fmt(impact.carbonAvoided)+' Gt/yr',time:pct(impact.effect*100)+' shorter'}[axis];
  const sub={economy:impact.gdpPercent===null?'Savings':pct(impact.gdpPercent)+' of reference GDP · saved',health:'Healthy years saved · DALYs',energy:energy.savings===null?'Set energy spending':money(energy.savings)+'/yr saved · included in economics',climate:'CO₂ avoided',time:fmt(settings.deliveryYears)+' → '+fmt(impact.deliveryAfter)+' years · assumed'}[axis];
  const proxy=['energy','time'].includes(axis);
  const history=view==='impact'?benefitCurve(s,scale):axis==='energy'?energyCurve(energy,maxImpact.effect*100,true,energyHistory,view):historyPanel(axis,data,f.targetYear,f,view,{minimal:true,scaleForecast:scaleForecasts[axis]});
  const source={economy:'https://data.worldbank.org/country/world',health:'https://doi.org/10.1016/S0140-6736(25)01637-X',energy:energyHistory?.source_url,climate:'https://www.iea.org/reports/global-energy-review-2026/co2-emissions',time:'https://www.longtermproductivity.com/download.html'}[axis];
  const details=snapshot?'':`<details data-live-details="${axis}"${open.has(axis)?' open':''}><summary>Details</summary><p class="live-scope"><a class="live-source" href="${source}" target="_blank" rel="noopener noreferrer">Reference source ↗</a></p>${axis==='energy'?energyHistoryDetails(energyHistory)+energyReadout(energy):benefitReadout(axis,s,impact)}${['economy','health'].includes(axis)?`<p class="live-scope">${axis==='economy'?'GDP gives context. Savings are not added to GDP.':'Lifespan gives context. Saved healthy years are not a life-expectancy forecast.'}</p>`:''}</details>`;
  const added=deltaValue(axis,impact),annual=added===null?'Not set':deltaText(axis,added/projection.horizonYears);
  const yearly=snapshot?'':`<p class="live-yearly" data-live-annual><span>Added each year</span><b>${annual}</b></p>`;
  const tag=snapshot?'':`<span class="evidence-tag${proxy?' proxy':''}">${proxy?'Proxy':'Data'}</span> `;
  return `<article data-master-axis="${axis}" class="live-chart${snapshot?' snapshot-card':''}"><header><div class="metric-heading"><h3>${labels[axis]}</h3>${snapshot?'':'<span class="evidence-tag assumption">Assumption</span>'}</div><p class="live-result" data-live-value="${axis}">${main}</p><p class="live-compare">${sub}</p></header><div class="chart-unit">${view==='impact'?'Your change':tag+contextLabels[axis]}${snapshot&&proxy&&view!=='impact'?' <span class="proxy-mark">proxy</span>':''}</div>${history}${view==='impact'?'':deltaCurve(axis,impact,maxImpact,projection)}${yearly}${details}</article>`;
 }).join('');
}

export function renderLiveCharts(host,data,forecasts,scaleForecasts,impact,projection,maxImpact=impact,energyHistory=null,settings={deliveryYears:10}){
 const view=host.dataset.curveWindow||'full',open=new Set([...host.querySelectorAll('[data-live-details][open]')].map(d=>d.dataset.liveDetails));
 host.querySelector('[data-master-cards]').innerHTML=trendCards(data,forecasts,scaleForecasts,impact,projection,maxImpact,energyHistory,settings,{view,open})+'<p class="live-unit-note" data-unit-note>History is context. Blue deltas show the assumed benefits in their own units. GDP history: 2021 PPP. Energy: oil, 2025 = 100. Delivery history: US output/hour, 1900 = 100.</p>';
 for(const b of host.querySelectorAll('[data-live-window]'))b.setAttribute('aria-pressed',b.dataset.liveWindow===view);
}
