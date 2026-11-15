"""Versioned integration of the common dollar valuation into summary and model."""
from pathlib import Path
import re
ROOT=Path(__file__).resolve().parent
def read(n):return (ROOT/n).read_text(encoding='utf-8')
def write(n,s):(ROOT/n).write_text(s,encoding='utf-8')
timeline=read('math_to_atoms_timeline_v035.mjs').replace('Extra GDP has not been estimated.','Net GDP after transition costs has not been estimated.').replace('the extra GDP still needs estimating.','a conditional energy GDP benchmark is shown in the dollar calculation above.')
write('math_to_atoms_timeline_v036.mjs',timeline)
imports="import {PRICE_DEFAULTS,validatePricing,readPricingCase,pricingURL,clearPricingURL,mountWelfare,updateWelfare,wireWelfare} from './math_to_atoms_welfare_v036.mjs';\n"
cover=imports+read('math_to_atoms_cover_v035.mjs').replace('timeline_v035','timeline_v036')
cover=cover.replace('let current=','let pricing=readPricingCase(location.search)||{...PRICE_DEFAULTS};\nlet current=',1)
cover=cover.replace('root.querySelector(\'[data-cover-gdp]\').innerHTML=gdpExplanation(i);',"root.querySelector('[data-cover-gdp]').innerHTML=gdpExplanation(i);\n updateWelfare(root.querySelector('[data-cover-worth]'),i,s,values,pricing,current.years);")
cover=cover.replace('a.href=caseURL(a.href,current).href','a.href=pricingURL(caseURL(a.href,current),pricing).href')
cover=cover.replace("caseURL(location.href,current));","pricingURL(caseURL(location.href,current),pricing));")
cover=cover.replace('render();controls.disabled=false;',"mountWelfare(root.querySelector('[data-cover-worth]'),pricing);\n  wireWelfare(root.querySelector('[data-cover-worth]'),{getPricing:()=>pricing,onPricing:p=>{pricing=p;render();commit();},onPreset:id=>{current.reach=id==='published'?25:100;current.use=id==='all-used'?100:50;scale=impact({...current,reach:100});render();commit();},onError:message=>{document.querySelector('[data-cover-status]').textContent=message;}});\n  render();controls.disabled=false;")
cover=cover.replace('current={...COVER_DEFAULTS};activeKey=null;','current={...COVER_DEFAULTS};pricing={...PRICE_DEFAULTS};activeKey=null;')
cover=cover.replace('clearCaseURL(location.href)','clearPricingURL(clearCaseURL(location.href))')
cover=cover.replace("current=readCoverCase(location.search)||{...COVER_DEFAULTS};activeKey=null;","current=readCoverCase(location.search)||{...COVER_DEFAULTS};pricing=readPricingCase(location.search)||{...PRICE_DEFAULTS};activeKey=null;")
write('math_to_atoms_cover_v036.mjs',cover)
write('math_to_atoms_cover_v036.css',"@import url('./math_to_atoms_cover_v035.css');\n@import url('./math_to_atoms_welfare_v036.css');\n")
write('math_to_atoms_model_v036.css',"@import url('./math_to_atoms_model_v035.css');\n@import url('./math_to_atoms_welfare_v036.css');\n")
cover=read('math_to_atoms_cover_v035.html').replace('cover_v035','cover_v036').replace('Math to Atoms · v035','Math to Atoms · v036')
cover=cover.replace('<div class="cover-mobile-results"','<section class="worth-panel" data-cover-worth aria-label="Dollar value of the outcomes"><p>At the published settings: $1.81T resource savings + $2.03T health value = <strong>$3.84T/year</strong> by 2046. All reached, half used: $15.4T/year; fully used: $30.7T/year. Health is valued at $14,500 per healthy year saved. Before costs; this is not GDP.</p></section>\n<div class="cover-mobile-results"',1)
cover=cover.replace('Health is counted separately.','Health is priced in the combined total above.').replace('Extra GDP has not yet been estimated.','The energy GDP benchmark is an alternative interpretation; it is not added to the total.').replace('Extra GDP has not been estimated.','Net GDP after transition costs has not been estimated.').replace('What is missing before we can estimate GDP?','Savings, GDP and what still needs checking').replace('the extra GDP still needs estimating.','the conditional energy GDP benchmark is shown above.')
write('math_to_atoms_cover_v036.html',cover)
app=imports+read('math_to_atoms_app_v035.mjs').replace('timeline_v035','timeline_v036')
app=app.replace('worked:validateWorked(input.worked)','welfare:validatePricing(input.welfare),worked:validateWorked(input.worked)')
app=app.replace('worked:defaultWorked()','welfare:{...PRICE_DEFAULTS},worked:defaultWorked()')
app=app.replace('function isDefault(){return ','function isDefault(){return JSON.stringify(state.welfare)===JSON.stringify(PRICE_DEFAULTS)&&')
needle="  const maxImpact=scenarioOutcomes(settings,state.valuation,100),scaleForecasts=projectAll(historicalData,projection,maxImpact);"
addition="""  let worth=$('master-outlook').querySelector('[data-model-worth]');
  if(!worth){worth=document.createElement('section');worth.className='worth-panel';worth.dataset.modelWorth='';worth.setAttribute('aria-label','Dollar value of the outcomes');const toolbar=$('master-outlook').querySelector('.live-toolbar');if(toolbar)toolbar.before(worth);else $('master-outlook').append(worth);mountWelfare(worth,state.welfare);wireWelfare(worth,{getPricing:()=>state.welfare,onPricing:p=>mutate(()=>state.welfare=p),onPreset:id=>mutate(()=>{state.macro.capturePercent=id==='published'?25:100;state.macro.adoptionPercent=id==='all-used'?100:50;}),onError:notify});}
  updateWelfare(worth,impact,settings,state.valuation,state.welfare,projection.horizonYears);
"""
assert needle in app
app=app.replace(needle,addition+needle)
app=app.replace("version:19,name","version:20,name").replace('[7,8,9,13,14,15,18,19]','[7,8,9,13,14,15,18,19,20]')
old="""    const sharedCase=readCoverCase(location.search);
    if(sharedCase){checkpoint();state.macro=validateScenario({...state.macro,...coverMacro(sharedCase)});state.projection=validateProjection({...state.projection,horizonYears:sharedCase.years});window.history.replaceState(null,'',clearCaseURL(location.href));}"""
new="""    const sharedCase=readCoverCase(location.search),sharedPricing=readPricingCase(location.search);
    if(sharedCase||sharedPricing){checkpoint();if(sharedCase){state.macro=validateScenario({...state.macro,...coverMacro(sharedCase)});state.projection=validateProjection({...state.projection,horizonYears:sharedCase.years});}if(sharedPricing)state.welfare=sharedPricing;window.history.replaceState(null,'',clearPricingURL(clearCaseURL(location.href)));}"""
assert old in app
app=app.replace(old,new).replace("else if(sharedCase)notify('Applied the four summary settings. Your other assumptions are unchanged. Undo restores your previous case.');","else if(sharedCase||sharedPricing)notify('Applied the summary and dollar settings. Your other assumptions are unchanged. Undo restores your previous case.');")
write('math_to_atoms_app_v036.mjs',app)
write('math_to_atoms_ledger_v036.html',read('math_to_atoms_ledger_v035.html').replace('v035','v036'))
# Reuse the tested Word-to-HTML conversion, without its old summary/model builders.
source=read('build_math_to_atoms_web_v031.py')
builder=source[:source.index("cover=head(")]+source[source.index('doc=Document(SOURCE)'):source.index("model=(ROOT/")]
builder=builder.replace('math_to_atoms_v007_20261111.docx','math_to_atoms_v008_20261115.docx').replace('math_to_atoms_essay_assets_v030','math_to_atoms_essay_assets_v036').replace('figure_{figures:02d}_v030','figure_{figures:02d}_v036').replace('range(1,15)','range(1,17)').replace('11 November 2026 · v007','15 November 2026 · v008').replace('11 November 2026 · draft v007','15 November 2026 · draft v008').replace('math_to_atoms_essay_v031.html','math_to_atoms_essay_v036.html').replace('Math to Atoms · v031','Math to Atoms · v036')
# Heading 2 in the new comparison section uses native semantics too.
builder=builder.replace("if p.style.name=='Heading 1':","if p.style.name in ['Heading 1','Heading 2']:")
write('build_math_to_atoms_essay_v036.py',builder)
print('Built v036 summary/model and essay converter.')
