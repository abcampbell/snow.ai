const number=(value,digits=2)=>Number(value.toFixed(digits)).toLocaleString('en-US',{maximumFractionDigits:digits});
const compact=value=>{
  for(const [scale,suffix] of [[1e12,'T'],[1e9,'B'],[1e6,'M'],[1e3,'k']])if(Math.abs(value)>=scale)return number(value/scale,2)+suffix;
  return number(value,2);
};
export function validatePhysical(input={}){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Invalid physical scenarios.');
  const output={};
  for(const [id,fields] of Object.entries(input)){
    if(!/^O(?:[1-9]|10)$/.test(id)||!fields||typeof fields!=='object'||Array.isArray(fields))throw new Error('Invalid physical scenario node.');
    const next={};
    for(const key of ['baseline','percent'])if(fields[key]!==undefined){
      const value=fields[key],max=key==='percent'?100:1e15;
      if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>max)throw new Error(key==='percent'?'Scenario percentages must be between 0 and 100.':'Physical baselines must be nonnegative finite numbers.');
      next[key]=value;
    }
    output[id]=next;
  }
  return output;
}
export function physicalCase(metric,override={},defaultPercent=10){
  const baseline=override.baseline??metric.baseline,percent=override.percent??defaultPercent;
  const delta=baseline*percent/100,after=baseline+(metric.direction==='up'?delta:-delta);
  return {baseline,percent,delta,after,customBaseline:baseline!==metric.baseline};
}
export function formatQuantity(value,format){
  switch(format){
    case 'people':return compact(value)+' lives/yr';
    case 'usd_mwh':return '$'+number(value,2)+'/MWh';
    case 'usd_t':return '$'+number(value,2)+'/t';
    case 'usd_annual':return '$'+compact(value)+'/yr';
    case 'usd_stock':return '$'+compact(value);
    case 'years':return number(value,2)+' years';
    case 'steel_energy':return number(value,2)+' GJ/t';
    case 'healthy_years':return number(value,2)+' years';
    case 'carbon':return number(value,2)+' Gt/yr';
    default:throw new Error('Unsupported physical quantity format.');
  }
}
export function physicalLabels(metric,override={},defaultPercent=10){
  const c=physicalCase(metric,override,defaultPercent),value=x=>formatQuantity(x,metric.format);
  const transition=(()=>{
    const b=number(c.baseline,2),a=number(c.after,2);
    if(metric.format==='usd_mwh')return `$${b} → $${a}/MWh`;
    if(metric.format==='usd_t')return `$${b} → $${a}/t`;
    if(metric.format==='steel_energy')return `${b} → ${a} GJ/t`;
    return `${b} → ${a} years`;
  })();
  const benefitSuffix=metric.format==='people'?' saved':metric.format==='usd_stock'?' released':metric.format==='carbon'?' avoided':' saved';
  return {...c,main:metric.mode==='transition'?transition:value(c.delta)+benefitSuffix,baselineText:metric.format==='people'?compact(c.baseline)+' AMR deaths/yr':value(c.baseline),afterText:metric.format==='people'?compact(c.after)+' AMR deaths/yr':value(c.after),deltaText:value(c.delta),caseText:`${number(c.percent)}% ${metric.direction==='up'?'gain':'cut'} case`,scopeText:c.customBaseline?'User baseline · '+metric.short_scope:metric.short_scope};
}
