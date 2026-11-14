import test from 'node:test';
import assert from 'node:assert/strict';
import {COVER_DEFAULTS,readCoverCase,caseURL,clearCaseURL,coverMacro} from './math_to_atoms_cover_case_v034.mjs';
test('the four physical-benefit assumptions share and round-trip without graph scores',()=>{
 for(const c of [COVER_DEFAULTS,{reach:0,use:0,gain:0,years:1},{reach:100,use:100,gain:100,years:100},{reach:25.5,use:52.2,gain:40.3,years:30}]){
  const url=caseURL('https://snow.ai/math.to.atoms/model.html?keep=yes#master-outlook',c);
  assert.deepEqual(readCoverCase(url.search),c);assert.equal(url.searchParams.get('keep'),'yes');assert.equal(url.hash,'#master-outlook');
  const clean=clearCaseURL(url);assert.equal(clean.search,'?keep=yes');assert.equal(clean.hash,url.hash);
 }
 assert.deepEqual(coverMacro(COVER_DEFAULTS),{capturePercent:25,adoptionPercent:50,localGainPercent:40});
});
test('absent, partial, nonfinite, negative and out-of-range query values cannot enter the model',()=>{
 assert.equal(readCoverCase(''),null);
 assert.equal(readCoverCase('?case_reach=25'),null);
 for(const k of Object.keys(COVER_DEFAULTS))for(const v of ['', 'NaN','Infinity','-1','101','<script>']){
  const url=caseURL('https://snow.ai/math.to.atoms/',COVER_DEFAULTS);url.searchParams.set('case_'+k,v);assert.equal(readCoverCase(url.search),null);
 }
 for(const v of ['0','1.5']){
  const url=caseURL('https://snow.ai/math.to.atoms/',COVER_DEFAULTS);url.searchParams.set('case_years',v);assert.equal(readCoverCase(url.search),null);
 }
});
