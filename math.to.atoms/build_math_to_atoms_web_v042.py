"""Propagate explicit residual costs/time through scenarios and every chart."""
from pathlib import Path
import re
ROOT=Path(__file__).resolve().parent
def read(n):return (ROOT/n).read_text(encoding='utf-8')
def write(n,s):(ROOT/n).write_text(s,encoding='utf-8')
scenario="import {DEFAULT_MINIMUMS,validateMinimums,MINIMUM_KEYS} from './math_to_atoms_minimums_v042.mjs';\n"+read('math_to_atoms_scenario_v029.mjs')
scenario=scenario.replace('energy_v028','energy_v042').replace('projection_v029','projection_v042').replace('history_v029','history_v042')
scenario=scenario.replace('Object.freeze({capturePercent:25','Object.freeze({...DEFAULT_MINIMUMS,capturePercent:25')
scenario=scenario.replace('  return result;','  validateMinimums(Object.fromEntries(MINIMUM_KEYS.map(k=>[k,result[k]])));\n  return result;',1)
needle='  const effect=capturePercent/100*settings.adoptionPercent/100*settings.localGainPercent/100;'
replacement="""  const limits=validateMinimums(Object.fromEntries(MINIMUM_KEYS.map(k=>[k,settings[k]??DEFAULT_MINIMUMS[k]])));
  const coverage=capturePercent/100*settings.adoptionPercent/100;
  const effect=coverage*settings.localGainPercent/100;
  const energyEffect=coverage*Math.min(settings.localGainPercent,100-limits.energyCostFloorPercent)/100;
  const productionEffect=coverage*Math.min(settings.localGainPercent,100-limits.productionCostFloorPercent)/100;
  const deliveryEffect=coverage*Math.min(settings.localGainPercent,100-limits.deliveryTimeFloorPercent)/100;"""
assert needle in scenario;scenario=scenario.replace(needle,replacement)
scenario=scenario.replace('value:energyBase===null?null:energyBase*effect','value:energyBase===null?null:energyBase*energyEffect').replace('base:otherBase,value:otherBase*effect','base:otherBase,value:otherBase*productionEffect')
scenario=scenario.replace('return {effect,gdp,','return {effect,energyEffect,productionEffect,deliveryEffect,limits,gdp,').replace('deliverySaved:settings.deliveryYears*effect,deliveryAfter:settings.deliveryYears*(1-effect)','deliverySaved:settings.deliveryYears*deliveryEffect,deliveryAfter:settings.deliveryYears*(1-deliveryEffect)')
scenario=scenario.replace('${pct(r.effect*100)} cheaper','${pct(r.energyEffect*100)} cheaper').replace('value:r=>r.effect*100,format:n=>pct(n)','value:r=>r.deliveryEffect*100,format:n=>pct(n)').replace('${pct(r.effect*100)} shorter','${pct(r.deliveryEffect*100)} shorter')
scenario=scenario.replace('overall improvement</strong>','requested improvement before limits</strong>').replace('Solved share × use × improvement = overall effect.','Reach × use × requested improvement, subject to the minimum costs and build time.')
scenario=scenario.replace("unit:'Annual energy savings ($T)'","unit:'Annual energy savings ($T)'")
write('math_to_atoms_scenario_v042.mjs',scenario)
energy=read('math_to_atoms_energy_v028.mjs').replace('base*impact.effect','base*(impact.energyEffect??impact.effect)').replace('100*(1-impact.effect)','100*(1-(impact.energyEffect??impact.effect))').replace('cutPercent:impact.effect*100','cutPercent:(impact.energyEffect??impact.effect)*100')
write('math_to_atoms_energy_v042.mjs',energy)
projection=read('math_to_atoms_projection_v031.mjs').replace('impact.effect*progress','(impact.deliveryEffect??impact.effect)*progress')
projection=projection.replace('assumed effect by','requested effect before limits by')
write('math_to_atoms_projection_v042.mjs',projection)
write('math_to_atoms_history_v042.mjs',read('math_to_atoms_history_v031.mjs').replace('projection_v031','projection_v042'))
public=read('math_to_atoms_public_v029.mjs').replace('energy_v028','energy_v042').replace('projection_v029','projection_v042').replace('history_v029','history_v042')
public=public.replace('energy:-impact.effect*100','energy:-(impact.energyEffect??impact.effect)*100').replace('energy:pct(impact.effect*100)','energy:pct((impact.energyEffect??impact.effect)*100)').replace('time:pct(impact.effect*100)','time:pct((impact.deliveryEffect??impact.effect)*100)')
write('math_to_atoms_public_v042.mjs',public)
welfare=read('math_to_atoms_welfare_v039.mjs').replace('scenario_v029','scenario_v042')
welfare=welfare.replace('These cases keep your ${pct(settings.localGainPercent)} improvement','These cases keep your ${pct(settings.localGainPercent)} requested improvement, the minimum costs/time,')
welfare=welfare.replace('the minimum costs/time, and','the minimum costs and build time, and')
write('math_to_atoms_welfare_v042.mjs',welfare)
timeline=read('math_to_atoms_timeline_v041.mjs').replace('history_v031','history_v042').replace('public_v029','public_v042').replace('energy_v028','energy_v042')
timeline=timeline.replace("energy:pct(impact.effect*100)","energy:pct(impact.energyEffect*100)").replace("time:pct(impact.effect*100)","time:pct(impact.deliveryEffect*100)")
timeline=timeline.replace('pct(impact.effect*100)+\' = \'+money(energy.savings)',"pct(impact.energyEffect*100)+' = '+money(energy.savings)")
timeline=timeline.replace('${pct(impact.effect*100)} reduction on these fixed starting amounts','${pct(impact.effect*100)} requested gain before cost/time limits')
note="${axis==='energy'?`<p class=\"limit-note\" data-energy-floor-note>At least ${pct(impact.limits.energyCostFloorPercent)} of the cost remains where used. Your annual bill: ${energy.after===null?'not set':money(energy.after)+'/yr'}.</p>`:axis==='time'?`<p class=\"limit-note\" data-time-floor-note>At least ${pct(impact.limits.deliveryTimeFloorPercent)} of project time remains where used.</p>`:''}"
timeline=timeline.replace('${limit}${yearly}',note+'${limit}${yearly}')
write('math_to_atoms_timeline_v042.mjs',timeline)
shared="import {DEFAULT_MINIMUMS,MINIMUM_KEYS,validateMinimums,readMinimums,minimumsURL,clearMinimumsURL,minimumsHTML,paintMinimums} from './math_to_atoms_minimums_v042.mjs';\n"
cover=shared+read('math_to_atoms_cover_v041.mjs')
cover=cover.replace('welfare_v039','welfare_v042').replace('scenario_v029','scenario_v042').replace('projection_v031','projection_v042').replace('timeline_v041','timeline_v042')
cover=cover.replace('let pricing=','let minimums=readMinimums(location.search)||{...DEFAULT_MINIMUMS};\nlet pricing=',1)
cover=cover.replace('...coverMacro(current)}','...coverMacro(current),...minimums}').replace('...coverMacro(c)}','...coverMacro(c),...minimums}')
cover=cover.replace(" updateWelfare(root.querySelector('[data-cover-worth]'),i,s,values,pricing,current.years);"," updateWelfare(root.querySelector('[data-cover-worth]'),i,s,values,pricing,current.years);\n paintMinimums(root.querySelector('[data-cover-minimums]'),minimums);")
cover=cover.replace('At these settings, the overall change is','The requested change before cost/time limits is')
cover=cover.replace("energy:effect+' cheaper'","energy:pct(i.energyEffect*100)+' cheaper'").replace("time:effect+' shorter'","time:pct(i.deliveryEffect*100)+' shorter'")
cover=cover.replace('and we save ${money(i.effect*100)} out of the original $100.','before the minimum-cost limits. Actual energy saving: ${money(i.energyEffect*100)} per original $100; other production: ${money(i.productionEffect*100)}.')
cover=cover.replace('This example uses the same ${effect} change for costs, lost healthy years, emissions and project times.','The requested ${effect} gain is limited separately for energy costs, other production costs and build time.')
cover=cover.replace('The requested change before cost/time limits is <strong>${effect}</strong>, built up over <strong>${fmt(current.years)} years</strong>.','Requested improvement: <strong>${effect}</strong> over <strong>${fmt(current.years)} years</strong>. Energy is ${pct(i.energyEffect*100)} cheaper; projects take ${pct(i.deliveryEffect*100)} less time after the limits.')
cover=cover.replace('Cut those costs by ${pct(current.gain)}, before the minimum-cost limits.','Request a ${pct(current.gain)} saving where used. After the minimum costs,')
cover=cover.replace('pricingURL(caseURL(a.href,current),pricing).href','minimumsURL(pricingURL(caseURL(a.href,current),pricing),minimums).href').replace('pricingURL(caseURL(location.href,current),pricing));','minimumsURL(pricingURL(caseURL(location.href,current),pricing),minimums));')
cover=cover.replace('pricing={...PRICE_DEFAULTS};activeKey=null;','pricing={...PRICE_DEFAULTS};minimums={...DEFAULT_MINIMUMS};activeKey=null;')
cover=cover.replace('clearPricingURL(clearCaseURL(location.href))','clearMinimumsURL(clearPricingURL(clearCaseURL(location.href)))')
cover=cover.replace("  wireGDPPaths(root.querySelector('[data-cover-gdp-paths]'),render);","""  root.querySelector('[data-cover-minimums]').innerHTML=minimumsHTML(minimums);
  root.querySelector('[data-cover-minimums]').addEventListener('change',e=>{const key=e.target.dataset.minimum;if(!key)return;try{minimums=validateMinimums({...minimums,[key]:e.target.value===''?NaN:Number(e.target.value)});scale=impact({...current,reach:100});render();commit();}catch(error){e.target.value=minimums[key];document.querySelector('[data-cover-status]').textContent=error.message;}});
  root.querySelector('[data-cover-minimums]').addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.matches('[data-minimum]')){e.preventDefault();e.target.blur();}});
  wireGDPPaths(root.querySelector('[data-cover-gdp-paths]'),render);""")
cover=cover.replace("current=readCoverCase(location.search)||{...COVER_DEFAULTS};pricing=", "current=readCoverCase(location.search)||{...COVER_DEFAULTS};minimums=readMinimums(location.search)||{...DEFAULT_MINIMUMS};pricing=")
write('math_to_atoms_cover_v042.mjs',cover)
app=shared+read('math_to_atoms_app_v041.mjs')
for old,new in [('welfare_v038','welfare_v042'),('scenario_v029','scenario_v042'),('projection_v031','projection_v042'),('history_v031','history_v042'),('timeline_v041','timeline_v042'),('energy_v028','energy_v042')]:app=app.replace(old,new)
needle="  renderMaster($('master-outlook'),settings,projection,forecasts,impact,source);"
addition="""
  let limits=$('master-outlook').querySelector('[data-model-minimums]');
  if(!limits){limits=document.createElement('details');limits.className='physical-minimums';limits.dataset.modelMinimums='';limits.innerHTML=minimumsHTML(state.macro,{macro:true});$('master-outlook').querySelector('.projection-assumptions').before(limits);}
  for(const input of limits.querySelectorAll('[data-macro]'))if(input!==source&&input!==document.activeElement)input.value=settings[input.dataset.macro];
"""
assert needle in app;app=app.replace(needle,needle+addition)
app=app.replace('version:20,name','version:21,name').replace('[7,8,9,13,14,15,18,19,20]','[7,8,9,13,14,15,18,19,20,21]')
app=app.replace('sharedPricing=readPricingCase(location.search);','sharedPricing=readPricingCase(location.search),sharedMinimums=readMinimums(location.search);').replace('if(sharedCase||sharedPricing){','if(sharedCase||sharedPricing||sharedMinimums){').replace("if(sharedPricing)state.welfare=sharedPricing;window.history", "if(sharedPricing)state.welfare=sharedPricing;if(sharedMinimums)state.macro=validateScenario({...state.macro,...sharedMinimums});window.history").replace('clearPricingURL(clearCaseURL(location.href))','clearMinimumsURL(clearPricingURL(clearCaseURL(location.href)))').replace('else if(sharedCase||sharedPricing)notify','else if(sharedCase||sharedPricing||sharedMinimums)notify')
write('math_to_atoms_app_v042.mjs',app)
for kind in ['cover','model']:
 write(f'math_to_atoms_{kind}_v042.css',f"@import url('./math_to_atoms_{kind}_v041.css');\n@import url('./math_to_atoms_minimums_v042.css');\n")
html=read('math_to_atoms_cover_v041.html').replace('cover_v041','cover_v042').replace('Math to Atoms · v041','Math to Atoms · v042')
html=html.replace('<fieldset class="cover-controls"','<details class="physical-minimums" data-cover-minimums><summary>Minimum costs & build time</summary><p>Default: 20% of energy and production costs and project time remains. Editable assumptions.</p></details>\n<fieldset class="cover-controls"',1)
charts=read('math_to_atoms_snapshot_v042.html')
html=re.sub(r'(<div class="snapshot-grid" data-cover-charts>).*?(</div><p class="snapshot-note")',lambda m:m[1]+charts+m[2],html,count=1,flags=re.S)
write('math_to_atoms_cover_v042.html',html)
write('math_to_atoms_ledger_v042.html',read('math_to_atoms_ledger_v041.html').replace('app_v041','app_v042').replace('model_v041','model_v042').replace('· v041','· v042'))
print('Built v042: positive residual costs/time with coherent bounded savings and GDP.')
