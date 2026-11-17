from pathlib import Path
import re
ROOT=Path(__file__).resolve().parent
def read(n):return (ROOT/n).read_text(encoding='utf-8')
def write(n,s):(ROOT/n).write_text(s,encoding='utf-8')
shared="import {updateGDPPaths,wireGDPPaths} from './math_to_atoms_gdp_paths_v037.mjs';\n"
timeline="import {gdpPaths} from './math_to_atoms_gdp_paths_v037.mjs';\nimport {PRICE_DEFAULTS} from './math_to_atoms_welfare_v036.mjs';\n"+read('math_to_atoms_timeline_v036.mjs')
timeline=timeline.replace("open=new Set()}={})","open=new Set(),pricing=PRICE_DEFAULTS}={})")
timeline=timeline.replace('const f=forecasts[axis],s=','const f=axis===\'economy\'?gdpPaths(forecasts.economy,impact,pricing):forecasts[axis],s=')
timeline=timeline.replace('scaleForecast:scaleForecasts[axis]','scaleForecast:axis===\'economy\'?gdpPaths(scaleForecasts.economy,maxImpact,pricing):scaleForecasts[axis]')
timeline=timeline.replace('extra GDP not estimated','gross savings · GDP comparison above').replace('World GDP · Int$T, 2021 PPP · context','World GDP · Int$T, 2021 PPP · energy scenario').replace('GDP gives context. Savings are not added to GDP.','GDP paths use the energy productivity estimate above. Savings are not added directly to GDP.')
timeline=timeline.replace('settings={deliveryYears:10})','settings={deliveryYears:10},pricing=PRICE_DEFAULTS)')
timeline=timeline.replace('{view,open})','{view,open,pricing})')
write('math_to_atoms_timeline_v037.mjs',timeline)
cover=shared+read('math_to_atoms_cover_v036.mjs')
cover=cover.replace('timeline_v036','timeline_v037').replace('{snapshot:true}','{snapshot:true,pricing}')
cover=cover.replace(" updateWelfare(root.querySelector('[data-cover-worth]'),i,s,values,pricing,current.years);"," updateGDPPaths(root.querySelector('[data-cover-gdp-paths]'),projectAll(data,projection,i).economy,i,pricing);\n updateWelfare(root.querySelector('[data-cover-worth]'),i,s,values,pricing,current.years);")
cover=cover.replace("  mountWelfare(root.querySelector('[data-cover-worth]'),pricing);","  wireGDPPaths(root.querySelector('[data-cover-gdp-paths]'),render);\n  mountWelfare(root.querySelector('[data-cover-worth]'),pricing);")
write('math_to_atoms_cover_v037.mjs',cover)
app=shared+read('math_to_atoms_app_v036.mjs')
app=app.replace('timeline_v036','timeline_v037').replace('energyHistoryData,settings);','energyHistoryData,settings,state.welfare);')
app=app.replace("if(toolbar)toolbar.before(worth);else $('master-outlook').append(worth);","$('master-outlook').querySelector('[data-master-cards]').after(worth);")
needle="  updateWelfare(worth,impact,settings,state.valuation,state.welfare,projection.horizonYears);"
addition="""  let gdp=$('master-outlook').querySelector('[data-model-gdp-paths]');
  if(!gdp){gdp=document.createElement('section');gdp.className='gdp-paths';gdp.dataset.modelGdpPaths='';gdp.setAttribute('aria-label','GDP with and without added math');$('master-outlook').querySelector('.live-toolbar').before(gdp);wireGDPPaths(gdp,()=>renderMacroViews());}
  updateGDPPaths(gdp,forecasts.economy,impact,state.welfare);
"""
assert needle in app;app=app.replace(needle,addition+needle)
write('math_to_atoms_app_v037.mjs',app)
for kind in ['cover','model']:
 write(f'math_to_atoms_{kind}_v037.css',f"@import url('./math_to_atoms_{kind}_v036.css');\n@import url('./math_to_atoms_gdp_paths_v037.css');\n")
cover=read('math_to_atoms_cover_v036.html').replace('cover_v036','cover_v037').replace('Math to Atoms · v036','Math to Atoms · v037')
worth=re.search(r'<section class="worth-panel" data-cover-worth.*?</section>',cover,re.S).group()
cover=cover.replace(worth+'\n','',1)
# The five charts and the new GDP comparison all precede the dollar valuation.
cover=re.sub(r'(<p class="snapshot-note" data-cover-note>.*?</p>)',lambda m:m[1]+'\n'+worth,cover,count=1,flags=re.S)
gdp=read('math_to_atoms_gdp_paths_fallback_v037.html')
cover=cover.replace('<div class="cover-mobile-results"',gdp+'\n<div class="cover-mobile-results"',1)
charts=read('math_to_atoms_snapshot_v037.html')
cover=re.sub(r'(<div class="snapshot-grid" data-cover-charts>).*?(</div><p class="snapshot-note")',lambda m:m[1]+charts+m[2],cover,count=1,flags=re.S)
write('math_to_atoms_cover_v037.html',cover)
write('math_to_atoms_ledger_v037.html',read('math_to_atoms_ledger_v036.html').replace('app_v036','app_v037').replace('model_v036','model_v037').replace('· v036','· v037'))
print('Built v037: charts first, GDP comparison, then dollar valuation.')
