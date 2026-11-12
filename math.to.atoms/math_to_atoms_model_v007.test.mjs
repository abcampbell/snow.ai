import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {DEFAULT_WEIGHTS,copy,score,sensitivity,validateWorkspace} from './math_to_atoms_model_v007.mjs';
const base=JSON.parse(fs.readFileSync(new URL('./math_to_atoms_data_v001.json',import.meta.url),'utf8'));
const workspace=()=>({data:copy(base),weights:{...DEFAULT_WEIGHTS},scope:'all',annotations:{}});
const near=(a,b)=>assert.ok(Math.abs(a-b)<=Math.max(1,Math.abs(a))*1e-12,`${a} ≠ ${b}`);

test('default scores reproduce every v006 score',()=>{
  const html=fs.readFileSync(new URL('./math_to_atoms_ledger_v006.html',import.meta.url),'utf8');
  let script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
  script=script.slice(0,script.indexOf('document.getElementById("sc-core").addEventListener'))+'load(); compute(); globalThis.audit={apps,maths,outs};})();';
  const context={localStorage:{getItem(){return null;}}};vm.createContext(context);vm.runInContext(script,context);
  const next=score(base);
  for(const[type,old,id]of[['problems',context.audit.apps,'n'],['math',context.audit.maths,'id'],['outcomes',context.audit.outs,'id']])for(const row of next[type]){
    const previous=old.find(r=>r[id]===row[id]);near(row.score,previous.score);near(row.ladder,previous.lad);
  }
});
test('formula agrees at changed weights, including zero penalties',()=>{
  for(const weights of [{b:1.5,alpha:.25,lambda:0,kappa:0},{b:10,alpha:3,lambda:3,kappa:2},{b:4,alpha:2,lambda:.75,kappa:1.25}]){
    const result=score(base,weights);
    for(const row of result.problems)near(row.ladder,3+weights.alpha*(row.I-3)-weights.lambda*(row.M-3)-weights.kappa*(row.C-3));
    for(const type of ['problems','math','outcomes'])assert.ok(result[type].every(r=>Number.isFinite(r.score)&&Number.isFinite(r.ladder)));
  }
});
test('core scope recalculates every layer from exactly 20 core problems',()=>{
  const core=score(base,DEFAULT_WEIGHTS,'core');assert.equal(core.problems.length,20);assert.equal(core.math.length,10);assert.equal(core.outcomes.length,10);
  assert.ok(core.math.every(m=>m.contributions.every(c=>c.id<=20)));assert.ok(core.outcomes.every(o=>o.contributions.every(c=>c.id<=20)));
  const reduced=copy(base);reduced.problems=reduced.problems.filter(p=>p.src==='core');reduced.math=reduced.math.filter(m=>m.src==='core');
  const independent=score(reduced);for(const type of ['problems','math','outcomes'])for(let i=0;i<core[type].length;i++)near(core[type][i].score,independent[type][i].score);
});
test('delta is priority rank minus impact rank',()=>{
  const r=score(base);for(const p of r.problems)assert.equal(p.delta,p.priorityRank-p.impactRank);
});
test('removing all links produces zero indices and an undefined ladder',()=>{
  const data=copy(base);data.math.forEach(m=>m.links={});data.outcomes.forEach(o=>o.links={});
  const r=score(data);for(const x of [...r.math,...r.outcomes]){assert.equal(x.score,0);assert.equal(x.ladder,null);}
});
test('reported contributions sum to their scoring inputs',()=>{
  const r=score(base);for(const m of r.math)near(m.contributions.reduce((sum,c)=>sum+c.value,0),m.total);
  for(const o of r.outcomes)near(o.contributions.reduce((sum,c)=>sum+c.value,0),o.score);
});
test('sensitivity ranges contain the current rank and honor boundary weights',()=>{
  for(const weights of [DEFAULT_WEIGHTS,{b:1.5,alpha:.25,lambda:0,kappa:0},{b:10,alpha:3,lambda:3,kappa:2}]){
    const r=score(base,weights),ranges=sensitivity(base,weights,'all');for(const type of ['problems','math','outcomes'])r[type].forEach((row,i)=>{const range=ranges[`${type}:${type==='problems'?row.n:row.id}`];assert.ok(range.low<=i+1&&range.high>=i+1);assert.ok(range.low>=1&&range.high<=r[type].length);});
  }
});
test('valid exported workspace round trips without references to the input',()=>{
  const w=workspace();w.data.problems[0].I=8.7;w.annotations['problems:1']={kind:'sourced',source:'https://example.org/paper',date:'2026-10-28',note:'A working reference.'};
  const imported=validateWorkspace(JSON.parse(JSON.stringify(w)),base);assert.deepEqual(imported,w);imported.data.problems[0].I=1;assert.equal(w.data.problems[0].I,8.7);
});
test('imports reject invalid weights, scores, links, duplicates, and unsafe URLs',()=>{
  const invalid=[w=>w.weights.b=1,w=>w.data.problems[0].I=11,w=>w.data.math[0].links[999]=3,w=>w.data.math[0].links[1]=1.5,w=>w.data.problems[1].n=1,w=>w.annotations['problems:1']={kind:'sourced',source:'javascript:alert(1)'},w=>w.annotations['problems:1']={kind:'sourced',source:''}];
  for(const change of invalid){const w=workspace();change(w);assert.throws(()=>validateWorkspace(w,base));}
});
