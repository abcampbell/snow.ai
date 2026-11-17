import {gdpPaths} from './math_to_atoms_gdp_paths_v037.mjs';
import {PRICE_DEFAULTS} from './math_to_atoms_welfare_v036.mjs';
import {historyPanel} from './math_to_atoms_history_v031.mjs';
import {benefitSeries,benefitCurve,benefitReadout} from './math_to_atoms_public_v029.mjs';
import {energyOutlook,energyCurve,energyReadout,energyHistoryDetails} from './math_to_atoms_energy_v028.mjs';
import {fmt,money,pct,compact} from './math_to_atoms_value_model_v027.mjs';

const axes=['economy','health','energy','climate','time'];
const labels={economy:'Gross savings',health:'Health',energy:'Energy',climate:'Climate',time:'Delivery'};
const contextLabels={economy:'World GDP · Int$T, 2021 PPP · energy scenario',health:'Lifespan · years · context',energy:'Oil price · 2025 = 100',climate:'CO₂ · Gt/year',time:'US output/hour · 1900 = 100'};
const deltaLabels={economy:'Gross annual savings',health:'Healthy years saved / year',energy:'Annual energy savings',climate:'CO₂ avoided / year',time:'Project time saved'};

export function endFrame(markup,end,{delta=false}={}){
 const guide=`<line class="chart-end-guide" data-chart-end="${end}" x1="308" x2="308" y1="${delta?13:22}" y2="${delta?78:149}"/>`;
 return markup.replace('<svg ',`<svg data-period-end="${end}" `).replace(new RegExp('(<text class="macro-axis)"([^>]*>'+end+'</text>)'),'$1 forecast-end-label"$2').replace('</svg>',guide+'</svg>');
}
export function gdpExplanation(impact){
 const cash=v=>v===null?'Not set':money(v)+'/yr';
 const totalBase=impact.components.some(c=>c.base===null)?null:impact.components.reduce((n,c)=>n+c.base,0);
 const rows=impact.components.map(c=>`<tr><th scope="row">${c.name}</th><td>${cash(c.base)}</td><td>${cash(c.value)}</td></tr>`).join('');
 const energy=impact.components[0].base,example=energy===null?'Set energy spending to calculate the example.':`For example, a 20% cut in the ${money(energy)} energy bill saves ${money(energy*.2)} a year: ${pct(energy*.2/impact.gdp*100)} of the ${money(impact.gdp)} GDP reference. That measures a smaller bill; a conditional energy GDP benchmark is shown in the dollar calculation above.`;
 return `<div class="gdp-explanation"><p><strong>${cash(impact.economicValue)} is gross savings and avoided losses. Net GDP after transition costs has not been estimated.</strong></p><table class="gdp-breakdown"><caption>${pct(impact.effect*100)} reduction on these fixed starting amounts</caption><thead><tr><th>Counted here</th><th>Starting amount</th><th>Annual saving</th></tr></thead><tbody>${rows}<tr class="gdp-total"><th scope="row">Total</th><td>${cash(totalBase)}</td><td>${cash(impact.economicValue)}</td></tr></tbody></table><p>The energy share and other production-cost base are assumptions. The total treats them as separate; shared costs across suppliers still need checking. Implementation costs have not been deducted.</p><p>${example}</p><p>Cheaper energy could let us make more with the same workers and machines. To estimate how much, we need to know:</p><ul><li><strong>What physically gets saved.</strong> A cheaper price can shift income from sellers to buyers. Using fewer real resources for the same output is a different gain.</li><li><strong>What gets built next.</strong> How much new production the freed resources support, what new products become possible, and what the transition costs.</li><li><strong>What happens as use grows.</strong> More demand can raise output while using up some of the energy savings. Spending and population are held fixed here.</li></ul><p>GDP counts value added, rather than adding every supplier's sales together. Lower prices can also reduce money GDP even when the amount produced rises.</p><p class="gdp-sources"><a href="https://www.bea.gov/help/faq/1168" target="_blank" rel="noopener noreferrer">BEA: prices and real GDP ↗</a> · <a href="https://www.bea.gov/resources/guide-interactive-gdp-industry-accounts-tables" target="_blank" rel="noopener noreferrer">BEA: value added ↗</a> · <a href="https://www.iea.org/reports/economic-growth" target="_blank" rel="noopener noreferrer">IEA: energy and output ↗</a></p></div>`;
}

export function deltaValue(axis,impact){return {economy:impact.economicValue,health:impact.health.averted,energy:impact.components[0].value,climate:impact.carbonAvoided,time:impact.deliverySaved}[axis];}
export function deltaText(axis,value){if(value===null)return 'Not set';return axis==='economy'||axis==='energy'?money(value)+'/yr':axis==='health'?compact(value)+'/yr':axis==='climate'?fmt(value)+' Gt/yr':fmt(value)+' years';}
export function deltaCurve(axis,impact,maxImpact,projection){
 const value=deltaValue(axis,impact),max=Math.max(1,deltaValue(axis,maxImpact)??0)*1.12;
 const W=320,H=102,L=52,R=12,T=13,B=24,start=2026,end=start+projection.horizonYears;
 const y=n=>H-B-n/max*(H-T-B),x=t=>L+t*(W-L-R);
 let svg=`<svg viewBox="0 0 ${W} ${H}" data-delta-curve="${axis}" data-end-value="${value??''}" data-domain-max="${max}" role="img" aria-label="${deltaLabels[axis]}, phased in from ${start} to ${end}"><title>Additional benefit under your assumptions, in its own units. Separate from the historical series above.</title><line class="delta-zero" x1="${L}" x2="${W-R}" y1="${y(0)}" y2="${y(0)}"/>`;
 if(value!==null)svg+=`<path class="delta-fill" d="M${x(0)},${y(0)} L${x(1)},${y(value)} L${x(1)},${y(0)} Z"/><path class="delta-line" d="M${x(0)},${y(0)} L${x(1)},${y(value)}"/><circle class="delta-dot" cx="${x(1)}" cy="${y(value)}" r="3"/>`;
 const ceiling=axis==='economy'||axis==='energy'?money(max):axis==='health'?compact(max):fmt(max)+(axis==='climate'?' Gt':' yr');
 svg+=`<line class="delta-ceiling" x1="${L}" x2="${W-R}" y1="${T}" y2="${T}"/><text class="delta-scale" x="${L-7}" y="${T+4}" text-anchor="end">${ceiling}</text><text class="delta-scale" x="${L-7}" y="82" text-anchor="end">0</text><text class="delta-axis" x="${L}" y="${H-5}">${start}</text><text class="delta-axis forecast-end-label" x="${W-R}" y="${H-5}" text-anchor="end">${end}</text></svg>`;
 return `<section class="live-delta" aria-label="${deltaLabels[axis]}"><p class="delta-heading"><span>${deltaLabels[axis]}</span><strong data-delta-value="${axis}">${value===null?'': '+'}${deltaText(axis,value)}</strong></p>${endFrame(svg,end,{delta:true})}</section>`;
}

export function trendCards(data,forecasts,scaleForecasts,impact,projection,maxImpact,energyHistory,settings,{view='full',snapshot=false,open=new Set(),pricing=PRICE_DEFAULTS}={}){
 const energy=energyOutlook(impact,projection.horizonYears);
 return axes.map(axis=>{
  const f=axis==='economy'?gdpPaths(forecasts.economy,impact,pricing):forecasts[axis],s=benefitSeries(axis,impact,settings,projection),scale=benefitSeries(axis,maxImpact,settings,projection);
  const main={economy:impact.economicValue===null?'Set energy spending':money(impact.economicValue)+'/yr',health:compact(impact.health.averted)+'/yr',energy:pct(impact.effect*100)+' cheaper',climate:fmt(impact.carbonAvoided)+' Gt/yr',time:pct(impact.effect*100)+' shorter'}[axis];
  const sub={economy:impact.gdpPercent===null?'GDP effect not estimated':pct(impact.gdpPercent)+' of '+money(impact.gdp)+' reference GDP · gross savings · GDP comparison above',health:'Healthy years saved · DALYs',energy:energy.savings===null?'Set energy spending':money(energy.savings)+'/yr saved · included in gross savings',climate:'CO₂ avoided',time:fmt(settings.deliveryYears)+' → '+fmt(impact.deliveryAfter)+' years · assumed'}[axis];
  const proxy=['energy','time'].includes(axis);
  const history=endFrame(view==='impact'?benefitCurve(s,scale):axis==='energy'?energyCurve(energy,maxImpact.effect*100,true,energyHistory,view):historyPanel(axis,data,f.targetYear,f,view,{minimal:true,scaleForecast:axis==='economy'?gdpPaths(scaleForecasts.economy,maxImpact,pricing):scaleForecasts[axis]}),energy.targetYear);
  const limit=axis==='time'&&view!=='impact'&&f.withScenario===null?'<p class="curve-limit">A 100% time cut leaves zero duration. The output/hour comparison has no finite endpoint.</p>':'';
  const source={economy:'https://data.worldbank.org/country/world',health:'https://doi.org/10.1016/S0140-6736(25)01637-X',energy:energyHistory?.source_url,climate:'https://www.iea.org/reports/global-energy-review-2026/co2-emissions',time:'https://www.longtermproductivity.com/download.html'}[axis];
  const details=snapshot?'':`<details data-live-details="${axis}"${open.has(axis)?' open':''}><summary>Details</summary><p class="live-scope"><a class="live-source" href="${source}" target="_blank" rel="noopener noreferrer">Reference source ↗</a></p>${axis==='energy'?energyHistoryDetails(energyHistory)+energyReadout(energy):benefitReadout(axis,s,impact)}${axis==='economy'?gdpExplanation(impact):''}${['economy','health'].includes(axis)?`<p class="live-scope">${axis==='economy'?'GDP paths use the energy productivity estimate above. Savings are not added directly to GDP.':'Lifespan gives context. Saved healthy years are not a life-expectancy forecast.'}</p>`:''}</details>`;
  const added=deltaValue(axis,impact),annual=added===null?'Not set':deltaText(axis,added/projection.horizonYears);
  const yearly=snapshot?'':`<p class="live-yearly" data-live-annual><span>Added each year</span><b>${annual}</b></p>`;
  const tag=snapshot?'':`<span class="evidence-tag${proxy?' proxy':''}">${proxy?'Proxy':'Data'}</span> `;
  return `<article data-master-axis="${axis}" class="live-chart${snapshot?' snapshot-card':''}"><header><div class="metric-heading"><h3>${labels[axis]}</h3>${snapshot?'':'<span class="evidence-tag assumption">Assumption</span>'}</div><p class="live-result" data-live-value="${axis}">${main}</p><p class="live-compare">${sub}</p></header><div class="chart-unit">${view==='impact'?'Your change':tag+contextLabels[axis]}${snapshot&&proxy&&view!=='impact'?' <span class="proxy-mark">proxy</span>':''}</div>${history}${view==='impact'?'':deltaCurve(axis,impact,maxImpact,projection)}${limit}${yearly}${details}</article>`;
 }).join('');
}

export function renderLiveCharts(host,data,forecasts,scaleForecasts,impact,projection,maxImpact=impact,energyHistory=null,settings={deliveryYears:10},pricing=PRICE_DEFAULTS){
 const view=host.dataset.curveWindow||'full',open=new Set([...host.querySelectorAll('[data-live-details][open]')].map(d=>d.dataset.liveDetails));
 host.querySelector('[data-master-cards]').innerHTML=trendCards(data,forecasts,scaleForecasts,impact,projection,maxImpact,energyHistory,settings,{view,open,pricing})+'<p class="live-unit-note" data-unit-note>History is context. Blue deltas show the assumed benefits in their own units. GDP history: 2021 PPP. Energy: oil, 2025 = 100. Delivery history: US output/hour, 1900 = 100.</p>';
 for(const b of host.querySelectorAll('[data-live-window]'))b.setAttribute('aria-pressed',b.dataset.liveWindow===view);
}
