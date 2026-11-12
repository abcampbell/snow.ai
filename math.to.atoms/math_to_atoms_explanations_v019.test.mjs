import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {explanationFor,CAUSAL_APPLICATIONS,CAUSAL_TERMS,CAUSAL_SOURCES} from './math_to_atoms_explanations_v019.mjs';
const data=JSON.parse(fs.readFileSync(new URL('./math_to_atoms_data_v001.json',import.meta.url),'utf8'));
test('every existing graph node has a usable definition and concrete example',()=>{
 let count=0;
 for(const type of ['math','problems','outcomes'])for(const row of data[type]){
  const id=type==='problems'?row.n:row.id,e=explanationFor(type,id);assert.ok(e,`${type}:${id}`);
  assert.ok(e.title.length>5&&e.meaning.length>30&&e.example.length>30,`${type}:${id}`);count++;
 }
 assert.equal(count,88);
});
test('causal explanations map only to the five actual graph connections',()=>{
 const m=data.math.find(m=>m.id==='B15');assert.deepEqual(Object.keys(CAUSAL_APPLICATIONS).sort(),Object.keys(m.links).sort());
 assert.equal(explanationFor('math','B15').title,'Finding causes in messy data');
 assert.match(explanationFor('math','B15').frontier,/cannot settle the question/);
 assert.ok(CAUSAL_TERMS.some(([t])=>t==='Bounds'));
 for(const [,url]of CAUSAL_SOURCES)assert.match(url,/^https:\/\//);
});
test('clinical and statistics explanations do not promise impossible certainty',()=>{
 assert.match(explanationFor('problems',13).example,/do not remove the need for trials/);
 assert.match(explanationFor('problems',37).example,/clinical evidence/);
 assert.match(explanationFor('problems',47).meaning,/missing survey responses/);
 assert.match(explanationFor('outcomes','O1').example,/not a count of people/);
});
