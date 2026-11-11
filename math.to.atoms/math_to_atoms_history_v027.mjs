import {projectionValue,projectionDelta,periodReadout} from './math_to_atoms_projection_v027.mjs';
import {fmt,compact} from './math_to_atoms_value_model_v027.mjs';
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function validateHistory(data){
  if(data?.schema_version!==1||data.start_year!==1900||!Number.isInteger(data.end_year)||data.end_year<=1900||!Array.isArray(data.series)||data.series.length!==4)throw new Error('Invalid historical baseline bundle.');
  const axes=new Set();
  for(const s of data.series){
    if(!['economy','health','climate','time'].includes(s.axis)||axes.has(s.axis)||!Array.isArray(s.points)||!s.points.length||!(s.divisor>0))throw new Error('Invalid historical baseline series.');
    axes.add(s.axis);let previous=1899;
    for(const p of s.points){if(p.length!==2||!Number.isInteger(p[0])||p[0]<=previous||p[0]>data.end_year||!Number.isFinite(p[1])||p[1]<0)throw new Error('Invalid historical observations.');previous=p[0];}
    for(const key of ['source_url','data_url'])if(!/^https:\/\//.test(s[key]))throw new Error('Invalid historical source URL.');
  }
  return data;
}
export function observationAtOrBefore(series,year){
  let result=null;
  for(const point of series.points){if(point[0]>year)break;result=point;}
  return result;
}
const valueText=(s,value)=>fmt(value/s.divisor,s.id==='productivity'?1:2);
const niceMax=value=>{const p=10**Math.floor(Math.log10(value||1)),n=value/p;return (n<=1?1:n<=2?2:n<=5?5:10)*p;};
export function historyPanel(axis,data,year=data?.end_year,forecast=null,window='full',options={}){
  if(!data)return '';
  const s=data.series.find(s=>s.axis===axis);if(!s)return '';
  const observed=observationAtOrBefore(s,year),first=s.points[0],last=s.points.at(-1),endYear=forecast?.targetYear??data.end_year;
  const startYear=window==='recent'?(forecast?.startYear??data.end_year)-20:data.start_year;
  const sourcePoints=s.points.filter(p=>p[0]>=startYear),future=forecast?.points||[],futureInspection=future.find(p=>p.year===year&&year>last[0]);
  const W=options.minimal?320:470,H=options.minimal?180:205,left=52,right=options.minimal?12:16,top=22,bottom=31;
  const allValues=[...sourcePoints.map(p=>p[1]/s.divisor),...(options.scaleForecast?.points||future).flatMap(p=>[p.baseline/s.divisor,...(p.withScenario===null?[]:[p.withScenario/s.divisor])])];
  const lo=Math.min(...allValues),hi=Math.max(...allValues),span=hi-lo||Math.max(1,hi*.05);
  const minimum=window==='recent'?Math.max(0,lo-span*.15):0,maximum=window==='recent'?hi+span*.15:niceMax(hi*1.08);
  const x=y=>left+(y-startYear)/(endYear-startYear)*(W-left-right),y=v=>H-bottom-(v/s.divisor-minimum)/(maximum-minimum)*(H-top-bottom);
  let svg=`<svg viewBox="0 0 ${W} ${H}" data-domain-min="${minimum}" data-domain-max="${maximum}" role="img" aria-label="${escape(s.title)}: history, baseline and scenario impact through ${endYear}"><title>${escape(s.title)}. Recorded data, dashed future trend, and blue line with the change. Future values are estimates.</title>`;
  if(future.length)svg+=`<rect class="outlook-region" x="${x(last[0])}" y="${top}" width="${x(endYear)-x(last[0])}" height="${H-top-bottom}"/>`;
  for(const v of [minimum,(minimum+maximum)/2,maximum]){const yp=y(v*s.divisor);svg+=`<line class="macro-grid" x1="${left}" x2="${W-right}" y1="${yp}" y2="${yp}"/><text class="macro-axis" x="${left-7}" y="${yp+4}" text-anchor="end">${v>=1000?compact(v):fmt(v,maximum-minimum<20?1:0)}</text>`;}
  const ticks=window==='recent'?[startYear,Math.round((startYear+endYear)/2),endYear]:[1900,1950,2000,endYear];
  for(const t of [...new Set(ticks)])svg+=`<text class="macro-axis" x="${x(t)}" y="${H-8}" text-anchor="${t===startYear?'start':t===endYear?'end':'middle'}">${t}</text>`;
  for(let i=1;i<sourcePoints.length;i++){const a=sourcePoints[i-1],b=sourcePoints[i];svg+=`<path class="history-line${b[0]-a[0]>2?' sparse':''}" d="M${x(a[0])},${y(a[1])} L${x(b[0])},${y(b[1])}"/>`;}
  for(const p of sourcePoints)if(p===sourcePoints[0]||p===last||sourcePoints.length<50)svg+=`<circle class="history-dot" cx="${x(p[0])}" cy="${y(p[1])}" r="2"><title>Source ${p[0]}: ${valueText(s,p[1])} ${escape(s.display_unit)}</title></circle>`;
  if(future.length){
    const scenario=future.filter(p=>p.withScenario!==null),line=(rows,key)=>rows.map((p,i)=>`${i?'L':'M'}${x(p.year)},${y(p[key])}`).join(' ');
    if(scenario.length>1)svg+=`<path class="outlook-impact-band" d="${line(scenario,'withScenario')} ${[...scenario].reverse().map(p=>`L${x(p.year)},${y(p.baseline)}`).join(' ')} Z"/>`;
    svg+=`<path class="outlook-baseline" d="${line(future,'baseline')}"/>`;
    if(scenario.length)svg+=`<path class="outlook-scenario" d="${line(scenario,'withScenario')}"/>`;
    const end=future.at(-1);svg+=`<circle class="outlook-base-dot" cx="${x(end.year)}" cy="${y(end.baseline)}" r="3"/>`;
    if(end.withScenario!==null)svg+=`<circle class="outlook-scenario-dot" cx="${x(end.year)}" cy="${y(end.withScenario)}" r="3.5"/>`;
    svg+=`<text class="outlook-delta-label" x="${W-right}" y="13" text-anchor="end">Δ ${escape(projectionDelta(forecast))}</text>`;
  }
  if(year>=startYear){
    svg+=`<line class="history-inspect" x1="${x(year)}" x2="${x(year)}" y1="${top}" y2="${H-bottom}"/>`;
    if(futureInspection){svg+=`<circle class="outlook-base-dot" cx="${x(year)}" cy="${y(futureInspection.baseline)}" r="3"/>`;if(futureInspection.withScenario!==null)svg+=`<circle class="history-picked" cx="${x(year)}" cy="${y(futureInspection.withScenario)}" r="4"/>`;}
    else if(observed&&observed[0]>=startYear)svg+=`<circle class="history-picked" cx="${x(observed[0])}" cy="${y(observed[1])}" r="4"/>`;
  }
  svg+='</svg>';
  if(options.minimal)return `<div class="live-history" data-live-axis="${axis}" data-range-start="${startYear}" data-range-end="${endYear}">${svg}</div>`;
  if(options.compact)return `<div class="live-history" data-live-axis="${axis}">${svg}<p class="live-history-range">${startYear}–${endYear} <a href="${escape(s.source_url)}" target="_blank" rel="noopener noreferrer">Source</a></p></div>`;
  const credit={gdp:'Maddison / World Bank via OWID',life:'Riley / UN via OWID',co2:'Global Carbon Budget via OWID',productivity:'Bergeaud, Cette & Lecat · v2.7'}[s.id];
  const inspection=futureInspection?`<div class="history-observation" data-history-forecast="${year}"><strong>${projectionValue(axis,futureInspection.baseline)} <small>current trend</small></strong><span>${year} with change: ${projectionValue(axis,futureInspection.withScenario)} · estimated</span></div>`:`<div class="history-observation" data-history-observation="${observed?.[0]??''}"><strong>${observed?valueText(s,observed[1]):'No observation'} <small>${escape(s.display_unit)}</small></strong><span>${observed?`Source year ${observed[0]}${observed[0]!==year?` · latest available at or before ${year}`:''}`:`No source point at or before ${year}`}</span></div>`;
  const comparison=forecast?`<div class="history-forecast-summary" data-forecast-axis="${axis}">${periodReadout(forecast,true)}</div>`:'';
  return `<section class="history-panel" data-history-axis="${axis}"><div class="history-heading"><span>History & change</span><span>${startYear}–${endYear}</span></div><h4>${escape(s.title)}</h4>${inspection}<div class="outlook-legend"><span><i class="source"></i>Recorded data</span><span><i class="baseline"></i>Current trend</span><span><i class="scenario"></i>With change</span></div>${svg}${comparison}<details class="history-method"><summary>Sources & method</summary><p class="history-range">Recorded data ${first[0]}: ${valueText(s,first[1])} → ${last[0]}: ${valueText(s,last[1])} ${escape(s.display_unit)}</p><p class="small">${escape(s.note)}</p>${axis==='economy'?'<p class="small">Savings compared with GDP, in 2021 purchasing-power dollars. The bars use current-dollar spending assumptions. The gap is not added GDP.</p>':axis==='health'?'<p class="small">Lifespan gain estimated from healthy years saved; age-specific deaths and illness are not modeled.</p>':axis==='time'?'<p class="small">Output per hour ÷ (1 − time saved), using US data.</p>':''}${axis==='health'?`<p class="small">Comparable DALY series starts in 1990. <a href="${escape(data.health_gap.source_url)}" target="_blank" rel="noopener noreferrer">View DALY history at its source ↗</a></p>`:''}<p class="history-source"><a href="${escape(s.source_url)}" target="_blank" rel="noopener noreferrer">${escape(credit)} ↗</a> · retrieved ${data.retrieved_on}</p></details></section>`;
}
