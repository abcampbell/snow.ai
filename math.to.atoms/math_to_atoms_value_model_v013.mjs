export const MARKET_IDS=['O2','O3','O4','O8'];
export const HEALTH_IDS=['cmnn','ncd','injury'];
export const fmt=(n,digits=2)=>Number(n.toFixed(digits)).toLocaleString('en-US',{maximumFractionDigits:digits});
export function compact(n){for(const [scale,suffix]of[[1e12,'T'],[1e9,'B'],[1e6,'M'],[1e3,'k']])if(Math.abs(n)>=scale)return fmt(n/scale)+suffix;return fmt(n);}
export const money=n=>'$'+compact(n);
export const pct=n=>fmt(n,Math.abs(n)>0&&Math.abs(n)<.1?3:2)+'%';
export function defaultValues(ref,physical={}){
  const cut=id=>physical[id]?.percent??10;
  return {gdpTrillion:ref.gdp_trillion_default,markets:{
    O2:{basis:'gdp',gdpSharePercent:ref.energy_gdp_share_percent_default,spendBillion:0,priceCutPercent:cut('O2'),quantityCutPercent:0},
    O3:{basis:'unset',gdpSharePercent:0,spendBillion:0,priceCutPercent:cut('O3'),quantityCutPercent:0},
    O4:{basis:'spend',gdpSharePercent:0,spendBillion:physical.O4?.baseline!==undefined?physical.O4.baseline/1e9:252,priceCutPercent:cut('O4'),quantityCutPercent:0},
    O8:{basis:'unset',gdpSharePercent:0,spendBillion:0,priceCutPercent:0,quantityCutPercent:cut('O8')}
  },health:{birthsMillion:ref.health.births_million_per_year,lifeExpectancy:ref.health.life_expectancy_years,healthyLifeExpectancy:ref.health.healthy_life_expectancy_years,yllSharePercent:ref.health.yll_share_percent,groups:Object.fromEntries(HEALTH_IDS.map(id=>[id,{dalysMillion:ref.health.groups[id].dalysMillion,cutPercent:ref.health.default_cut_percent}]))}};
}
const valid=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
const assert=(test,message)=>{if(!test)throw new Error(message);};
export function validateValues(input,ref,physical={}){
  const defaults=defaultValues(ref,physical);
  if(input===undefined)return defaults;
  assert(input&&typeof input==='object'&&!Array.isArray(input),'Invalid value assumptions.');
  const value=structuredClone(defaults);
  if(input.gdpTrillion!==undefined)value.gdpTrillion=input.gdpTrillion;
  assert(valid(value.gdpTrillion,.001,1e6),'GDP must be positive, in trillions of dollars per year.');
  if(input.markets!==undefined){assert(input.markets&&typeof input.markets==='object'&&!Array.isArray(input.markets),'Invalid markets.');for(const [id,m]of Object.entries(input.markets)){
    assert(MARKET_IDS.includes(id)&&m&&typeof m==='object'&&!Array.isArray(m),'Unknown value market.');
    value.markets[id]={...value.markets[id],...m};
  }}
  for(const m of Object.values(value.markets)){
    assert(['unset','gdp','spend'].includes(m.basis),'Invalid spending basis.');
    for(const key of ['gdpSharePercent','priceCutPercent','quantityCutPercent'])assert(valid(m[key],0,100),'Shares and reductions must be between 0 and 100 percent.');
    assert(valid(m.spendBillion,0,1e9),'Annual spending must be nonnegative, in billions of dollars.');
  }
  if(input.health!==undefined){const h=input.health;assert(h&&typeof h==='object'&&!Array.isArray(h),'Invalid health assumptions.');
    for(const key of ['birthsMillion','lifeExpectancy','healthyLifeExpectancy','yllSharePercent'])if(h[key]!==undefined)value.health[key]=h[key];
    if(h.groups!==undefined){assert(h.groups&&typeof h.groups==='object'&&!Array.isArray(h.groups),'Invalid DALY groups.');for(const[id,g]of Object.entries(h.groups)){assert(HEALTH_IDS.includes(id)&&g&&typeof g==='object'&&!Array.isArray(g),'Unknown DALY group.');value.health.groups[id]={...value.health.groups[id],...g};}}
  }
  const h=value.health;
  assert(valid(h.birthsMillion,.001,10000),'Annual births must be positive, in millions.');
  assert(valid(h.lifeExpectancy,1,150)&&valid(h.healthyLifeExpectancy,1,h.lifeExpectancy),'Healthy life expectancy must be positive and no greater than life expectancy.');
  assert(valid(h.yllSharePercent,0,100),'YLL share must be between 0 and 100 percent.');
  for(const g of Object.values(h.groups))assert(valid(g.dalysMillion,0,1e6)&&valid(g.cutPercent,0,100),'DALY burdens must be nonnegative and reductions between 0 and 100 percent.');
  return value;
}
export function marketValue(values,id){
  const m=values.markets[id],gdp=values.gdpTrillion*1e12;
  const spending=m.basis==='gdp'?gdp*m.gdpSharePercent/100:m.basis==='spend'?m.spendBillion*1e9:null;
  const p=m.priceCutPercent/100,q=m.quantityCutPercent/100;
  const priceSavings=spending===null?null:spending*p;
  const quantitySavings=spending===null?null:spending*(1-p)*q;
  const savings=spending===null?null:priceSavings+quantitySavings;
  return {...m,gdp,spending,priceSavings,quantitySavings,savings,spendingAfter:spending===null?null:spending-savings,gdpPercent:savings===null?null:savings/gdp*100,combinedCutPercent:(1-(1-p)*(1-q))*100};
}
export function healthValue(values){
  const h=values.health,groups=HEALTH_IDS.map(id=>({id,...h.groups[id],averted:h.groups[id].dalysMillion*1e6*h.groups[id].cutPercent/100}));
  const baseline=groups.reduce((sum,g)=>sum+g.dalysMillion*1e6,0),averted=groups.reduce((sum,g)=>sum+g.averted,0);
  const yllAverted=averted*h.yllSharePercent/100,yldAverted=averted-yllAverted,births=h.birthsMillion*1e6;
  const lifeYears=yllAverted/births,healthyYears=averted/births;
  return {...h,groups,baseline,averted,yllAverted,yldAverted,lifeYears,healthyYears,lifePercent:lifeYears/h.lifeExpectancy*100,healthyPercent:healthyYears/h.healthyLifeExpectancy*100,lifeAfter:h.lifeExpectancy+lifeYears,healthyAfter:h.healthyLifeExpectancy+healthyYears,cutPercent:baseline?averted/baseline*100:0};
}
