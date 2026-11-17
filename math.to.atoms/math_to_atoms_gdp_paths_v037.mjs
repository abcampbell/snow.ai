import {fmt,money,pct} from './math_to_atoms_value_model_v027.mjs';
import {PRICE_DEFAULTS,welfareValue} from './math_to_atoms_welfare_v036.mjs';

// Apply the existing energy-GDP benchmark as a relative output-level change.
// Never add nominal savings or monetized DALYs to the PPP historical series.
export function gdpPaths(forecast,impact,pricing=PRICE_DEFAULTS){
 const valuation=welfareValue(impact,pricing),ratio=valuation.energyGDP===null?null:valuation.energyGDP/impact.gdp;
 const points=forecast.points.map(p=>{const withMath=ratio===null?null:p.baseline*(1+ratio*p.progress);return {...p,withMath,withScenario:withMath};});
 const end=points.at(-1);
 return {...forecast,contextOnly:false,points,ratio,referenceGain:valuation.energyGDP,withScenario:end.withMath,withMath:end.withMath,delta:ratio===null?null:end.baseline*ratio};
}
const real=v=>v===null?'Not set':'Int'+money(v);
const niceMax=v=>{const p=10**Math.floor(Math.log10(v||1)),n=v/p;return (n<=1?1:n<=2?2:n<=5?5:10)*p;};
export function gdpPlot(f,{view='full',width=760,height=280}={}){
 const future=view==='future',start=future?f.startYear:1900,end=f.targetYear;
 const history=future?[]:f.series.points,projected=f.points.filter(p=>p.year>=start);
 const values=[...history.map(p=>p[1]),...projected.flatMap(p=>[p.baseline,p.withMath??p.baseline])];
 const low=Math.min(...values),high=Math.max(...values),span=high-low||Math.max(1,high*.05);
 const floor=future?Math.max(0,low-span*.12):0,ceiling=future?high+span*.15:niceMax(high*1.08);
 const L=54,R=18,T=22,B=34,x=t=>L+(t-start)/(end-start)*(width-L-R),y=v=>height-B-(v-floor)/(ceiling-floor)*(height-T-B);
 const line=(rows,year,value)=>rows.map((p,i)=>(i?'L':'M')+x(year(p))+','+y(value(p))).join(' ');
 let svg=`<svg viewBox="0 0 ${width} ${height}" data-gdp-plot="${width}" data-end-year="${end}" data-gdp-view="${view}" role="img" aria-label="World GDP: current trend and with added math, through ${end}"><title>Global real GDP in 2021 purchasing-power dollars. The added math path illustrates the energy productivity assumption only. ${future?'Vertical axis starts above zero.':'Historical data since 1900.'}</title>`;
 svg+=`<rect class="gdp-future-region" x="${x(Math.max(f.startYear,start))}" y="${T}" width="${x(end)-x(Math.max(f.startYear,start))}" height="${height-T-B}"/>`;
 for(const v of [floor,(floor+ceiling)/2,ceiling])svg+=`<line class="gdp-grid" x1="${L}" x2="${width-R}" y1="${y(v)}" y2="${y(v)}"/><text class="gdp-axis" x="${L-9}" y="${y(v)+4}" text-anchor="end">${fmt(v/1e12)}</text>`;
 const ticks=future?[start,Math.round((start+end)/2),end]:[1900,1950,2000,end];
 for(const t of new Set(ticks))svg+=`<text class="gdp-axis" x="${x(t)}" y="${height-8}" text-anchor="${t===start?'start':t===end?'end':'middle'}">${t}</text>`;
 for(let i=1;i<history.length;i++){const a=history[i-1],b=history[i];svg+=`<path class="gdp-history${b[0]-a[0]>2?' sparse':''}" d="M${x(a[0])},${y(a[1])} L${x(b[0])},${y(b[1])}"/>`;}
 const baseline=line(projected,p=>p.year,p=>p.baseline),scenario=f.ratio===null?null:line(projected,p=>p.year,p=>p.withMath);
 if(scenario)svg+=`<path class="gdp-band" d="${scenario} ${[...projected].reverse().map(p=>'L'+x(p.year)+','+y(p.baseline)).join(' ')} Z"/>`;
 svg+=`<path class="gdp-baseline" data-gdp-baseline d="${baseline}"/><circle class="gdp-base-dot" cx="${x(end)}" cy="${y(f.baseline)}" r="3"/>`;
 if(scenario)svg+=`<path class="gdp-with" data-gdp-with d="${scenario}"/><line class="gdp-end-gap" x1="${x(end)}" x2="${x(end)}" y1="${y(f.baseline)}" y2="${y(f.withMath)}"/><circle class="gdp-with-dot" cx="${x(end)}" cy="${y(f.withMath)}" r="4"/>`;
 return svg+'</svg>';
}
export function gdpPathsHTML(f,impact,pricing=PRICE_DEFAULTS,{view='full',open=false}={}){
 const end=f.targetYear,relative=f.ratio===null?'Not set':'+'+pct(f.ratio*100),gap=f.delta===null?'Set energy spending':'+'+real(f.delta)+'/yr';
 return `<div class="gdp-path-heading"><div><p class="gdp-path-kicker">Two GDP paths · ${f.startYear}–${end}</p><h3>What does the math add?</h3></div><div class="gdp-path-gap"><strong data-gdp-gap>${gap}</strong><span data-gdp-percent>${relative} above the current trend in ${end}</span></div></div><div class="gdp-path-readouts"><div><span>Current trend · ${end}</span><strong data-gdp-base>${real(f.baseline)}/yr</strong></div><div><span>With added math · ${end}</span><strong data-gdp-scenario>${f.withMath===null?'Not set':real(f.withMath)+'/yr'}</strong></div></div><div class="gdp-path-toolbar"><p class="gdp-path-legend"><span><i class="history"></i>History</span><span><i class="baseline"></i>Current trend</span><span><i class="with"></i>With added math</span></p><div role="group" aria-label="GDP chart period"><button type="button" data-gdp-window="full" aria-pressed="${view==='full'}">Since 1900</button><button type="button" data-gdp-window="future" aria-pressed="${view==='future'}">${f.startYear}–${end}</button></div></div><p class="gdp-path-unit">World GDP · Int$ trillions per year · 2021 purchasing power${view==='future'?' · vertical axis starts above zero':''}</p><div class="gdp-path-plot gdp-plot-wide">${gdpPlot(f,{view})}</div><div class="gdp-path-plot gdp-plot-narrow">${gdpPlot(f,{view,width:340,height:235})}</div><p class="gdp-path-note">Energy productivity estimate only. The gap builds over ${end-f.startYear} years; it is a higher GDP level, not this much extra growth every year.</p><details class="gdp-path-method"${open?' open':''}><summary>How the GDP gap is calculated</summary><p>${impact.components[0].value===null?'Set energy spending.':money(impact.components[0].value)+'/yr energy saving'} ÷ ${money(impact.gdp)} reference GDP × ${fmt(pricing.capital)} capital response = ${relative} at full deployment. The chart applies that percentage to the GDP trend, phased in from ${f.startYear}. Current trend continues the recent historical growth rate.</p><p>The dollar benchmark is ${f.referenceGain===null?'not set':money(f.referenceGain)+'/yr'} on the fixed reference economy. The curves use 2021 purchasing-power dollars: applying a percentage to future GDP is not a currency conversion. Health value and the other savings are not added to these GDP curves.</p><p>This assumes real productivity gains. Price transfers, transition costs and other sectors need separate estimates. The capital response follows an <a href="https://www.imf.org/-/media/files/publications/cr/2024/english/1chlea2024002.pdf#page=8" target="_blank" rel="noopener noreferrer">IMF electricity study</a>; this global application and its rollout time are assumptions.</p></details>`;
}
export function updateGDPPaths(host,forecast,impact,pricing=PRICE_DEFAULTS){
 const view=host.dataset.gdpWindow||'full',open=host.querySelector('details')?.open;
 host.innerHTML=gdpPathsHTML(gdpPaths(forecast,impact,pricing),impact,pricing,{view,open});
}
export function wireGDPPaths(host,render){
 host.addEventListener('click',event=>{const button=event.target.closest('button[data-gdp-window]');if(button){host.dataset.gdpWindow=button.dataset.gdpWindow;render();host.querySelector(`button[data-gdp-window="${button.dataset.gdpWindow}"]`)?.focus();}});
}
