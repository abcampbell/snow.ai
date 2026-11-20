"""Bound the shared improvement slider to its visible engineering assumptions."""
from pathlib import Path
ROOT=Path(__file__).resolve().parent
def read(n):return (ROOT/n).read_text(encoding='utf-8')
def write(n,s):(ROOT/n).write_text(s,encoding='utf-8')
s=read('math_to_atoms_cover_v042.mjs')
needle='const settings=()=>'
helper="""const maximumGain=()=>Math.min(...MINIMUM_KEYS.map(k=>100-minimums[k]));
function normaliseGain(){current.gain=Math.min(current.gain,maximumGain());}
"""
assert needle in s;s=s.replace(needle,helper+needle,1)
s=s.replace("if(key!=='years')scale=impact({...current,[key]:100});","if(key!=='years')scale=impact({...current,[key]:key==='gain'?maximumGain():100});")
s=s.replace('function paintInputs(){','function paintInputs(){\n const gain=controls.querySelector(\'[data-cover-input="gain"]\');gain.max=maximumGain();gain.disabled=maximumGain()===0;\n document.querySelector(\'#cover-gain-hint\').textContent=`Maximum ${pct(maximumGain())} under the current minimum costs and build time.`;')
s=s.replace("((current[key]-Number(input.min))/(Number(input.max)-Number(input.min))*100)","(Number(input.max)>Number(input.min)?(current[key]-Number(input.min))/(Number(input.max)-Number(input.min))*100:0)")
s=s.replace('function render(){','function render(){\n normaliseGain();',1)
s=s.replace('Requested improvement: <strong>${effect}</strong> over <strong>${fmt(current.years)} years</strong>. Energy is ${pct(i.energyEffect*100)} cheaper; projects take ${pct(i.deliveryEffect*100)} less time after the limits.','At these settings: <strong>${effect} assumed overall improvement</strong>, built up over <strong>${fmt(current.years)} years</strong>.')
s=s.replace('[data,energy]=loaded;values=defaultValues(loaded[2]);scale=', '[data,energy]=loaded;values=defaultValues(loaded[2]);const originalGain=current.gain;normaliseGain();if(current.gain!==originalGain)history.replaceState(null,\'\',minimumsURL(pricingURL(caseURL(location.href,current),pricing),minimums));scale=')
s=s.replace('minimums=validateMinimums({...minimums,[key]:e.target.value===\'\'?NaN:Number(e.target.value)});scale=', 'minimums=validateMinimums({...minimums,[key]:e.target.value===\'\'?NaN:Number(e.target.value)});normaliseGain();scale=')
s=s.replace("Math.min(100,key==='years'?Math.round(n):n)","Math.min(key==='gain'?maximumGain():100,key==='years'?Math.round(n):n)")
write('math_to_atoms_cover_v043.mjs',s)
html=read('math_to_atoms_cover_v042.html').replace('cover_v042','cover_v043').replace('Math to Atoms · v042','Math to Atoms · v043')
html=html.replace('id="cover-gain" data-cover-input="gain" type="range" min="0" max="100"','id="cover-gain" data-cover-input="gain" type="range" min="0" max="80"')
html=html.replace('<small id="cover-gain-hint">Improvement where a solution is used.</small>','<small id="cover-gain-hint">Maximum 80% under the current minimum costs and build time.</small>')
write('math_to_atoms_cover_v043.html',html)
write('math_to_atoms_cover_v043.css',"@import url('./math_to_atoms_cover_v042.css');\n")
print('Built v043: reach/use 0–100%, shared improvement bounded by minimums.')
