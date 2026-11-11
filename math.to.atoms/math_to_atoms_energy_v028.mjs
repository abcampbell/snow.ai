import {money,pct,fmt} from './math_to_atoms_value_model_v027.mjs';

// A fixed-reference price comparison, not a new measured energy series or a GDP addition.
export function energyOutlook(impact,years,startYear=2026){
  const base=impact.components.find(c=>c.id==='energy').base;
  const savings=base===null?null:base*impact.effect;
  return {years,startYear,targetYear:startYear+years,base,savings,
    after:base===null?null:base-savings,priceAfter:100*(1-impact.effect),
    cutPercent:impact.effect*100,gdp:impact.gdp,gdpPercent:savings===null?null:savings/impact.gdp*100,
    averageBuild:savings===null?null:savings/years,cumulative:savings===null?null:savings*years/2};
}
export function energyReadout(e){
  const annual=n=>n===null?'Set energy spending':money(n)+'/year';
  return `<div class="period-comparison" data-period-axis="energy"><div class="period-window">${e.startYear}–${e.targetYear} · ${e.years} years</div><p class="period-unit">Energy price for a fixed quantity; starting price = 100.</p><dl class="period-values"><div><dt>Today · ${e.startYear} starting point</dt><dd data-energy-today>100 price index</dd></div><div><dt>${e.targetYear} · without change</dt><dd data-energy-baseline>100 price index</dd></div><div class="period-with"><dt>${e.targetYear} · with change</dt><dd data-energy-with>${fmt(e.priceAfter)} price index · ${pct(e.cutPercent)} cheaper</dd></div></dl><p class="period-net">Annual energy bill: ${annual(e.base)} → ${annual(e.after)}. Starting spending and energy use are held fixed.</p><div class="period-impact"><span>Energy savings per year by ${e.targetYear}</span><strong data-energy-savings>${annual(e.savings)}</strong><p class="period-relative" data-energy-gdp>${e.gdpPercent===null?'Set an energy spending base.':`${pct(e.gdpPercent)} of the ${money(e.gdp)} GDP reference.`}</p><p data-energy-annual>${e.averageBuild===null?'Set energy spending to calculate savings.':`Yearly increase in savings: ${money(e.averageBuild)} on average.`}</p></div>${e.cumulative===null?'':`<p class="period-total" data-energy-total>${money(e.cumulative)} saved over ${e.years} years</p>`}<p class="energy-counted">Included in economics.</p><details class="period-calculation"><summary>Calculation</summary><p>Price reduction rises evenly from zero in ${e.startYear} to ${pct(e.cutPercent)} in ${e.targetYear}. Annual savings = spending × price reduction. Total savings = final annual saving × ${e.years} years ÷ 2.</p><p>Uses your current-dollar GDP and energy spending assumptions, held fixed. The economics chart uses 2021 purchasing-power dollars. Lower prices alone do not imply lower energy use or emissions. Costs and demand changes are excluded.</p><button data-select-type="outcomes" data-select-id="O2">Edit energy spending base</button></details></div>`;
}
export function energyCurve(e,maxCutPercent=null,minimal=false,history=null,window='recent',inspectYear=null){
  if(history)return historicalEnergyCurve(e,history,window,minimal,maxCutPercent,inspectYear);
  const W=minimal?320:470,H=minimal?180:170,L=minimal?42:48,R=minimal?12:20,T=22,B=minimal?31:32,top=105,bottom=Math.max(0,(maxCutPercent===null?e.priceAfter:100-maxCutPercent)-5),x=W-R;
  const y=v=>T+(top-v)/(top-bottom)*(H-T-B),end=y(e.priceAfter),base=y(100);
  return `<div class="energy-curve">${minimal?'':'<p class="macro-unit">Energy price · today = 100</p>'}<svg viewBox="0 0 ${W} ${H}" data-domain-min="${bottom}" data-domain-max="${top}" role="img" aria-label="Energy price comparison from ${e.startYear} to ${e.targetYear}: baseline 100, change ${fmt(e.priceAfter)}"><title>Assumed price change for the same amount of energy.</title><path d="M${L} ${base}H${x}L${x} ${end}Z" class="outlook-impact-band"/><path d="M${L} ${base}H${x}" class="outlook-baseline"/><path d="M${L} ${base}L${x} ${end}" class="outlook-scenario"/><text x="${L-8}" y="${base+4}" text-anchor="end" class="macro-axis">100</text><text x="${x}" y="${base-9}" text-anchor="end" class="macro-axis">Trend: 100</text><text x="${x}" y="${end+17}" text-anchor="end" class="outlook-delta-label">Your price: ${fmt(e.priceAfter)}</text><text x="${L}" y="${H-8}" class="macro-axis">${e.startYear}</text><text x="${x}" y="${H-8}" text-anchor="end" class="macro-axis">${e.targetYear}</text></svg>${minimal?'':'<p class="small">Same amount of energy. Lower is cheaper.</p>'}</div>`;
}

export function validateEnergyHistory(data){
  if(data?.schema_version!==1||data.start_year!==1900||!Number.isInteger(data.end_year)||data.base_year!==data.end_year||!Array.isArray(data.points)||data.points.length!==data.end_year-1899)throw new Error('Invalid energy-price history.');
  for(let i=0;i<data.points.length;i++){const p=data.points[i];if(!Array.isArray(p)||p.length!==2||p[0]!==1900+i||!Number.isFinite(p[1])||p[1]<=0)throw new Error('Invalid energy-price observation.');}
  if(data.base_value!==data.points.at(-1)[1]||!/^https:\/\//.test(data.source_url))throw new Error('Invalid energy-price base.');
  return data;
}
export function energyHistorySeries(e,history,window='recent'){
  const startYear=window==='full'?1900:e.startYear-20;
  const observations=history.points.filter(p=>p[0]>=startYear).map(([year,value])=>({year,value:value/history.base_value*100}));
  const future=[];
  for(let year=history.end_year;year<=e.targetYear;year++){
    const progress=Math.max(0,Math.min(1,(year-e.startYear)/e.years));
    future.push({year,baseline:100,withScenario:100-e.cutPercent*progress});
  }
  return {startYear,endYear:e.targetYear,observations,future};
}
export function energyHistoryDetails(history){
  return `<p class="live-scope">History uses inflation-adjusted crude oil prices, indexed to ${history.base_year} = 100. Oil is a proxy for energy prices, not an all-energy price index. The future baseline holds the last price fixed; the blue line applies your assumed reduction from 2026. The savings estimate uses your separate energy-spending base.</p><p class="live-scope"><a class="live-source" href="${history.source_url}" target="_blank" rel="noopener noreferrer">Energy Institute / Our World in Data</a> · ${history.start_year}–${history.end_year} · ${history.points.length} annual observations</p>`;
}
function historicalEnergyCurve(e,history,window,minimal,maxCutPercent,inspectYear){
  const s=energyHistorySeries(e,history,window),W=minimal?320:470,H=minimal?180:205,L=52,R=minimal?12:16,T=22,B=31;
  const values=s.observations.map(p=>p.value).concat([100,100-(maxCutPercent??e.cutPercent)]),lo=Math.min(...values),hi=Math.max(...values),span=hi-lo||10;
  const minimum=window==='full'?0:Math.max(0,lo-span*.1),maximum=hi+span*.1;
  const x=year=>L+(year-s.startYear)/(s.endYear-s.startYear)*(W-L-R),y=value=>H-B-(value-minimum)/(maximum-minimum)*(H-T-B);
  const line=(points,key)=>points.map((p,i)=>`${i?'L':'M'}${x(p.year)},${y(p[key])}`).join(' ');
  let svg=`<svg viewBox="0 0 ${W} ${H}" data-domain-min="${minimum}" data-domain-max="${maximum}" role="img" aria-label="Inflation-adjusted oil price history ${s.startYear} to ${history.end_year}, with assumed energy price change through ${s.endYear}"><title>Oil price history, ${history.base_year} = 100. Future price held flat without the change.</title><rect class="outlook-region" x="${x(history.end_year)}" y="${T}" width="${x(s.endYear)-x(history.end_year)}" height="${H-T-B}"/><text class="energy-history-label" x="${L}" y="12">Oil · ${history.base_year} = 100</text>`;
  for(const value of [minimum,(minimum+maximum)/2,maximum])svg+=`<line class="macro-grid" x1="${L}" x2="${W-R}" y1="${y(value)}" y2="${y(value)}"/><text class="macro-axis" x="${L-7}" y="${y(value)+4}" text-anchor="end">${fmt(value)}</text>`;
  const ticks=window==='full'?[1900,1950,2000,s.endYear]:[s.startYear,e.startYear,s.endYear];
  for(const year of [...new Set(ticks)])svg+=`<text class="macro-axis" x="${x(year)}" y="${H-8}" text-anchor="${year===s.startYear?'start':year===s.endYear?'end':'middle'}">${year}</text>`;
  svg+=`<path class="history-line energy-history-line" data-observations="${s.observations.length}" d="${line(s.observations,'value')}"/>`;
  svg+=`<path class="outlook-impact-band" d="${line(s.future,'withScenario')} ${[...s.future].reverse().map(p=>`L${x(p.year)},${y(p.baseline)}`).join(' ')} Z"/><path class="outlook-baseline" d="${line(s.future,'baseline')}"/><path class="outlook-scenario" d="${line(s.future,'withScenario')}"/>`;
  const end=s.future.at(-1);svg+=`<circle class="outlook-base-dot" cx="${x(end.year)}" cy="${y(end.baseline)}" r="3"/><circle class="outlook-scenario-dot" cx="${x(end.year)}" cy="${y(end.withScenario)}" r="3.5"/>`;
  if(inspectYear!==null&&inspectYear>=s.startYear&&inspectYear<=s.endYear)svg+=`<line class="history-inspect" x1="${x(inspectYear)}" x2="${x(inspectYear)}" y1="${T}" y2="${H-B}"/>`;
  svg+='</svg>';
  return `<div class="energy-curve" data-energy-history data-range-start="${s.startYear}" data-range-end="${s.endYear}">${svg}</div>`;
}
