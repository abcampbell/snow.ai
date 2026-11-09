import {fmt} from './math_to_atoms_value_model_v013.mjs';
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
export function historyPanel(axis,data,year=data?.end_year){
  if(!data)return '';
  const s=data.series.find(s=>s.axis===axis);if(!s)return '';
  const observed=observationAtOrBefore(s,year),first=s.points[0],last=s.points.at(-1);
  const W=470,H=170,left=52,right=14,top=15,bottom=29;
  const maximum=niceMax(Math.max(...s.points.map(p=>p[1]/s.divisor))*1.08),x=y=>left+(y-data.start_year)/(data.end_year-data.start_year)*(W-left-right),y=v=>H-bottom-v/s.divisor/maximum*(H-top-bottom);
  let svg=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${escape(s.title)}, ${first[0]} to ${last[0]}, ${escape(s.display_unit)}"><title>${escape(s.title)}. Reported points only; dashed segments connect sparse historical benchmarks.</title>`;
  for(const v of [0,maximum/2,maximum]){const yp=y(v*s.divisor);svg+=`<line class="macro-grid" x1="${left}" x2="${W-right}" y1="${yp}" y2="${yp}"/><text class="macro-axis" x="${left-7}" y="${yp+4}" text-anchor="end">${fmt(v,v<10?1:0)}</text>`;}
  for(const yearTick of [1900,1950,2000,data.end_year])svg+=`<text class="macro-axis" x="${x(yearTick)}" y="${H-7}" text-anchor="${yearTick===1900?'start':yearTick===data.end_year?'end':'middle'}">${yearTick}</text>`;
  for(let i=1;i<s.points.length;i++){
    const a=s.points[i-1],b=s.points[i];svg+=`<path class="history-line${b[0]-a[0]>2?' sparse':''}" d="M${x(a[0])},${y(a[1])} L${x(b[0])},${y(b[1])}"/>`;
  }
  for(let i=0;i<s.points.length;i++){
    const p=s.points[i];if(i===0||i===s.points.length-1||i>0&&p[0]-s.points[i-1][0]>2)svg+=`<circle class="history-dot" cx="${x(p[0])}" cy="${y(p[1])}" r="2.5"><title>${p[0]}: ${valueText(s,p[1])} ${escape(s.display_unit)}</title></circle>`;
  }
  svg+=`<line class="history-inspect" x1="${x(year)}" x2="${x(year)}" y1="${top}" y2="${H-bottom}"/>`;
  if(observed)svg+=`<circle class="history-picked" cx="${x(observed[0])}" cy="${y(observed[1])}" r="4"><title>Source year ${observed[0]}: ${valueText(s,observed[1])} ${escape(s.display_unit)}</title></circle>`;
  svg+='</svg>';
  const credit={gdp:'Maddison / World Bank via OWID',life:'Riley / UN via OWID',co2:'Global Carbon Budget via OWID',productivity:'Bergeaud, Cette & Lecat · v2.7'}[s.id];
  return `<section class="history-panel" data-history-axis="${axis}"><div class="history-heading"><span>Historical baseline</span><span>${first[0]}–${last[0]}</span></div><h4>${escape(s.title)}</h4><div class="history-observation" data-history-observation="${observed?.[0]??''}"><strong>${observed?valueText(s,observed[1]):'No observation'} <small>${escape(s.display_unit)}</small></strong><span>${observed?`Source year ${observed[0]}${observed[0]!==year?` · latest available at or before ${year}`:''}`:`No source point at or before ${year}`}</span></div>${svg}<p class="history-range">${first[0]}: ${valueText(s,first[1])} → ${last[0]}: ${valueText(s,last[1])} ${escape(s.display_unit)}</p><p class="small">${escape(s.note)}</p>${axis==='health'?`<p class="small">Comparable DALY series starts in 1990. <a href="${escape(data.health_gap.source_url)}" target="_blank" rel="noopener noreferrer">View DALY history at its source ↗</a></p>`:''}<p class="history-source"><a href="${escape(s.source_url)}" target="_blank" rel="noopener noreferrer">${escape(credit)} ↗</a> · retrieved ${data.retrieved_on}</p></section>`;
}
