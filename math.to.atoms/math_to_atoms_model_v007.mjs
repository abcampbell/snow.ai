export const DEFAULT_WEIGHTS = Object.freeze({b:3, alpha:1, lambda:1, kappa:0.5});
export const WEIGHT_LIMITS = Object.freeze({b:[1.5,10],alpha:[0.25,3],lambda:[0,3],kappa:[0,2]});
export const copy = value => JSON.parse(JSON.stringify(value));
export const ladder = (value,b) => value > 0 ? 3 + Math.log(value)/Math.log(b) : null;
const rank = rows => [...rows].sort((a,b)=>b.score-a.score);
export function score(data, weights=DEFAULT_WEIGHTS, scope='all') {
  const w=s=>weights.b**(s-3);
  const problems=data.problems.filter(p=>scope!=='core'||p.src==='core').map(p=>{
    const value=w(p.I)**weights.alpha/(w(p.M)**weights.lambda*w(p.C)**weights.kappa);
    return {...p,score:value,ladder:ladder(value,weights.b)};
  });
  const byProblem=new Map(problems.map(p=>[p.n,p]));
  const maths=data.math.filter(m=>scope!=='core'||m.src==='core').map(m=>{
    const contributions=Object.entries(m.links).filter(([n,s])=>s>0&&byProblem.has(+n)).map(([n,s])=>{
      const p=byProblem.get(+n);
      return {id:p.n,name:p.name,strength:s,value:s/3*w(p.I)*w(p.C)**(-weights.kappa)};
    }).sort((a,b)=>b.value-a.value);
    const total=contributions.reduce((s,c)=>s+c.value,0);
    const value=total**weights.alpha/w(m.diff)**weights.lambda;
    return {...m,contributions,total,score:value,ladder:ladder(value,weights.b)};
  });
  const outcomes=data.outcomes.map(o=>{
    const contributions=Object.entries(o.links).filter(([n,s])=>s>0&&byProblem.has(+n)).map(([n,s])=>{
      const p=byProblem.get(+n);
      return {id:p.n,name:p.name,strength:s,value:s/3*p.score};
    }).sort((a,b)=>b.value-a.value);
    const value=contributions.reduce((s,c)=>s+c.value,0);
    return {...o,contributions,score:value,ladder:ladder(value,weights.b)};
  });
  const priority=rank(problems),impact=[...problems].sort((a,b)=>b.I-a.I||b.score-a.score);
  priority.forEach((p,i)=>{p.priorityRank=i+1;p.impactRank=impact.indexOf(p)+1;p.delta=p.priorityRank-p.impactRank;});
  return {problems:priority,math:rank(maths),outcomes:rank(outcomes)};
}
export const entityKey = (type,row) => `${type}:${type==='problems'?row.n:row.id}`;
export function sensitivity(data,weights,scope) {
  const current=score(data,weights,scope), ranges={};
  for(const type of ['problems','math','outcomes']) current[type].forEach((p,i)=>ranges[entityKey(type,p)]={low:i+1,high:i+1});
  for(const key of Object.keys(WEIGHT_LIMITS)) for(const direction of [-1,1]) {
    const [min,max]=WEIGHT_LIMITS[key], step=key==='b'?0.5:0.25;
    const next={...weights,[key]:Math.max(min,Math.min(max,weights[key]+direction*step))};
    const result=score(data,next,scope);
    for(const type of ['problems','math','outcomes']) result[type].forEach((p,i)=>{
      const r=ranges[entityKey(type,p)];r.low=Math.min(r.low,i+1);r.high=Math.max(r.high,i+1);
    });
  }
  return ranges;
}
function assert(ok,message){if(!ok)throw new Error(message);}
function finiteRange(value,min,max){return typeof value==='number'&&Number.isFinite(value)&&value>=min&&value<=max;}
function text(value,max){return typeof value==='string'&&value.length<=max;}
export function validateWorkspace(input,base) {
  assert(input&&typeof input==='object','This file does not contain a workspace.');
  const {data,weights,annotations={}}=input;
  assert(data&&data.schema_version===1,'Unsupported dataset version.');
  assert(weights&&Object.entries(WEIGHT_LIMITS).every(([k,[lo,hi]])=>finiteRange(weights[k],lo,hi)),'Weights are outside the supported ranges.');
  assert(input.scope==='all'||input.scope==='core','Invalid scope.');
  const problemIds=new Set(base.problems.map(p=>String(p.n)));
  for(const [type,idKey] of [['problems','n'],['math','id'],['outcomes','id']]) {
    assert(Array.isArray(data[type])&&data[type].length===base[type].length,`The ${type} list must retain the original nodes.`);
    const expected=new Set(base[type].map(p=>String(p[idKey]))),seen=new Set();
    for(const row of data[type]) {
      const id=String(row[idKey]);
      assert(expected.has(id)&&!seen.has(id),`Invalid or duplicate ${type} ID.`);seen.add(id);
      for(const field of type==='problems'?['name','short','real_world','src']:type==='math'?['name','s','src']:['s','unit','today']) assert(text(row[field],2000),`Invalid ${type} text.`);
      if(type==='problems')for(const k of ['I','M','C'])assert(finiteRange(row[k],1,10),'Problem scores must be between 1 and 10.');
      if(type==='math')assert(finiteRange(row.diff,1,10),'Math difficulty must be between 1 and 10.');
      if(type!=='outcomes')assert(['core','A','B','S','+'].includes(row.src),'Invalid origin tag.');
      if(type!=='problems'){
        assert(row.links&&typeof row.links==='object'&&!Array.isArray(row.links),'Invalid links.');
        for(const [n,s] of Object.entries(row.links))assert(problemIds.has(n)&&Number.isInteger(s)&&s>=0&&s<=3,'Links must join existing nodes with strengths 0–3.');
      }
    }
  }
  assert(annotations&&typeof annotations==='object'&&!Array.isArray(annotations),'Invalid annotations.');
  const keys=new Set(['problems','math','outcomes'].flatMap(t=>data[t].map(r=>entityKey(t,r))));
  for(const [key,note] of Object.entries(annotations)){
    assert(keys.has(key)&&note&&typeof note==='object','Invalid annotation node.');
    assert(text(note.note??'',4000)&&text(note.source??'',2000)&&text(note.date??'',10),'Invalid annotation text.');
    assert(['judgment','sourced'].includes(note.kind??'judgment'),'Invalid evidence type.');
    assert(!note.date||/^\d{4}-\d{2}-\d{2}$/.test(note.date),'Invalid source date.');
    if(note.source){let url;try{url=new URL(note.source);}catch{throw new Error('Sources must use a full https:// or http:// URL.');}assert(['https:','http:'].includes(url.protocol),'Sources must use https:// or http://.');}
    assert(note.kind!=='sourced'||note.source,'A sourced annotation needs a source URL.');
  }
  return copy({data,weights,scope:input.scope,annotations});
}
