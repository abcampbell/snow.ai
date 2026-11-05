import {MARKET_IDS,HEALTH_IDS,marketValue,healthValue} from './math_to_atoms_value_model_v013.mjs';

export const canonicalOutcome=id=>id==='O9'?'O1':id;
export const pathKey=(problem,id)=>`${problem}:${canonicalOutcome(id)}`;
export function blankPath(values,id){
  const m=values.markets[id];
  return {enabled:false,example:false,addressablePercent:100,adoptionPercent:100,
    priceCutPercent:m?.priceCutPercent??10,quantityCutPercent:m?.quantityCutPercent??0,
    reductionPercent:10,healthGroup:'all',annualValueBillion:null,carryingRatePercent:null};
}
export function defaultPayoffs(values){
  return {dollarPerDaly:null,carbonDollarPerTonne:null,paths:{'1:O2':{...blankPath(values,'O2'),enabled:true,example:true,priceCutPercent:10,quantityCutPercent:0}}};
}
const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
const number=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
function check(test,message){if(!test)throw new Error(message);}
export function validatePayoffs(input,data,values){
  if(input===undefined)return defaultPayoffs(values);
  check(object(input)&&object(input.paths),'Invalid problem payoffs.');
  const result={dollarPerDaly:input.dollarPerDaly??null,carbonDollarPerTonne:input.carbonDollarPerTonne??null,paths:{}};
  for(const key of ['dollarPerDaly','carbonDollarPerTonne'])check(result[key]===null||number(result[key],0,1e9),'Dollar valuations must be nonnegative or blank.');
  for(const [key,value]of Object.entries(input.paths)){
    const [n,id]=key.split(':');
    check(key===pathKey(n,id)&&data.problems.some(p=>String(p.n)===n)&&data.outcomes.some(o=>o.id===id),'Unknown problem-to-outcome payoff.');
    check(object(value),'Invalid payoff path.');
    const next={...blankPath(values,id),...value};
    check(typeof next.enabled==='boolean'&&typeof next.example==='boolean','Invalid payoff switch.');
    for(const field of ['addressablePercent','adoptionPercent','priceCutPercent','quantityCutPercent','reductionPercent'])check(number(next[field],0,100),'Payoff percentages must be between 0 and 100.');
    check(['all',...HEALTH_IDS].includes(next.healthGroup),'Unknown health cause group.');
    check(next.annualValueBillion===null||number(next.annualValueBillion,0,1e9),'Annual value must be nonnegative or blank.');
    check(next.carryingRatePercent===null||number(next.carryingRatePercent,0,100),'Annual capital cost must be between 0 and 100, or blank.');
    result.paths[key]=next;
  }
  return result;
}
export function linkedOutcomes(data,n){
  const seen=new Set();
  return data.outcomes.filter(o=>{
    if(!(o.links[n]>0))return false;
    const key=canonicalOutcome(o.id);if(seen.has(key))return false;seen.add(key);return true;
  });
}
export function evaluatePath(state,refs,n,outcomeId){
  const id=canonicalOutcome(outcomeId),p=state.payoffs.paths[pathKey(n,id)];
  const linked=state.data.outcomes.some(o=>canonicalOutcome(o.id)===id&&o.links[n]>0);
  if(!linked||!p?.enabled)return null;
  const reach=p.addressablePercent/100*p.adoptionPercent/100,gdp=state.valuation.gdpTrillion*1e12;
  const result={n:Number(n),id,path:p,reach,gdp,annualValue:null,kind:'gross savings',priceSavings:null,quantitySavings:null};
  if(MARKET_IDS.includes(id)){
    const m=marketValue(state.valuation,id),price=p.priceCutPercent/100,quantity=p.quantityCutPercent/100;
    Object.assign(result,{spending:m.spending,effectiveSpending:m.spending===null?null:m.spending*reach,
      priceSavings:m.spending===null?null:m.spending*reach*price,
      quantitySavings:m.spending===null?null:m.spending*reach*(1-price)*quantity,
      effectiveCutPercent:reach*(1-(1-price)*(1-quantity))*100});
    result.annualValue=m.spending===null?null:result.priceSavings+result.quantitySavings;
    result.missing=m.spending===null?'Set annual market spending in the outcome editor.':'';
  }else if(id==='O1'){
    const values=structuredClone(state.valuation);
    for(const [key,g]of Object.entries(values.health.groups))g.cutPercent=(p.healthGroup==='all'||p.healthGroup===key)?p.reductionPercent*reach:0;
    result.health=healthValue(values);result.dalys=result.health.averted;
    result.annualValue=state.payoffs.dollarPerDaly===null?null:result.dalys*state.payoffs.dollarPerDaly;
    result.kind='valued health benefit';result.missing=result.annualValue===null?'Set a dollar value per DALY to compare health benefits with GDP.':'';
  }else{
    const baseline=state.physical?.[id]?.baseline??refs.outcomes[id].baseline,cut=p.reductionPercent/100;
    result.quantitySaved=baseline*cut*reach;
    if(id==='O5')result.annualValue=result.quantitySaved;
    if(id==='O6'){
      result.capitalReleased=result.quantitySaved;
      result.annualValue=p.carryingRatePercent===null?null:result.capitalReleased*p.carryingRatePercent/100;
      result.missing=result.annualValue===null?'Set an annual capital carrying cost; released capital is a stock.':'';
    }
    if(id==='O7'){
      result.annualValue=p.annualValueBillion===null?null:p.annualValueBillion*1e9*reach*(cut>0?1:0);
      result.missing=result.annualValue===null?'Enter annual savings at this time reduction before adoption.':'';
    }
    if(id==='O10'){
      result.annualValue=state.payoffs.carbonDollarPerTonne===null?null:result.quantitySaved*1e9*state.payoffs.carbonDollarPerTonne;
      result.kind='valued carbon benefit';result.missing=result.annualValue===null?'Set a value per tonne of CO₂ to compare with GDP.':'';
    }
  }
  result.gdpPercent=result.annualValue===null?null:result.annualValue/gdp*100;
  return result;
}
export function payoffPaths(state,refs,selection=null){
  let problems=state.data.problems.filter(p=>state.scope!=='core'||p.src==='core');
  if(selection?.type==='problems')problems=problems.filter(p=>String(p.n)===String(selection.id));
  if(selection?.type==='math'){
    const m=state.data.math.find(m=>m.id===selection.id);problems=problems.filter(p=>m?.links[p.n]>0);
  }
  const paths=[];
  for(const p of problems)for(const o of linkedOutcomes(state.data,p.n)){
    if(selection?.type==='outcomes'&&canonicalOutcome(o.id)!==canonicalOutcome(selection.id))continue;
    const value=evaluatePath(state,refs,p.n,o.id);if(value)paths.push(value);
  }
  return paths.sort((a,b)=>(b.annualValue??-1)-(a.annualValue??-1)||(b.dalys??0)-(a.dalys??0)||a.n-b.n||a.id.localeCompare(b.id));
}
