"""Lead the homepage with the synthesis immediately after the site title."""
from pathlib import Path
import re
ROOT=Path(__file__).resolve().parent
def read(n):return (ROOT/n).read_text(encoding='utf-8')
def write(n,s):(ROOT/n).write_text(s,encoding='utf-8')
cover=read('math_to_atoms_cover_v038.html').replace('cover_v038','cover_v039').replace('Math to Atoms · v038','Math to Atoms · v039')
def take(pattern):
 global cover
 m=re.search(pattern,cover,re.S);assert m,pattern
 cover=cover[:m.start()]+cover[m.end():];return m.group()
worth=take(r'<section class="worth-panel" data-cover-worth.*?</section>')
gdp=take(r'<section class="gdp-paths" data-cover-gdp-paths.*?</section>')
charts=take(r'<div class="snapshot-legend">.*?<p class="snapshot-note" data-cover-note>.*?</p>')
charts=charts.replace('GDP comparison above','GDP comparison below')
preface=take(r'<p class="cover-question">.*?<div class="cover-actions">.*?</div>')
# All live components keep one owner even though the controls are below them.
cover=cover.replace('<main id="main">','<main id="main" data-cover-interactive aria-busy="true">',1)
cover=cover.replace('aria-labelledby="case-title" data-cover-interactive aria-busy="true"','aria-labelledby="case-title"')
needle='</h1>'
synthesis='</section>\n<section class="cover-synthesis" aria-label="The synthesis" data-cover-synthesis>'+worth+'\n'+charts+'\n'+gdp+'</section>\n<section class="cover-preface">'+preface
cover=cover.replace(needle,needle+synthesis,1)
# The original hero closing tag now closes the moved introduction instead.
write('math_to_atoms_cover_v039.html',cover)
script=read('math_to_atoms_cover_v038.mjs').replace('welfare_v038','welfare_v039').replace('timeline_v037','timeline_v039')
write('math_to_atoms_cover_v039.mjs',script)
write('math_to_atoms_timeline_v039.mjs',read('math_to_atoms_timeline_v037.mjs').replace('GDP comparison above','GDP comparison below'))
welfare=read('math_to_atoms_welfare_v038.mjs')
welfare=welfare.replace('<strong>${cash(c.value.combined)}</strong></button>', '<strong>${cash(c.value.combined)}</strong><span class="worth-case-bar" aria-hidden="true"><i class="resources" style="width:${(c.impact.economicValue??0)/Math.max(1,...cases.map(x=>x.value.combined??0))*100}%"></i><i class="health" style="width:${c.value.health/Math.max(1,...cases.map(x=>x.value.combined??0))*100}%"></i></span></button>')
write('math_to_atoms_welfare_v039.mjs',welfare)
css="""@import url('./math_to_atoms_cover_v038.css');
.cover-hero{padding-bottom:0}.cover-hero h1{margin-bottom:16px}
.cover-synthesis{margin:0;padding:0;min-width:0}.cover-synthesis>.worth-panel{margin-top:0;border-top:0;padding-top:0}
.cover-preface{padding:26px 0 28px;max-width:950px}.cover-preface .cover-question{display:none}
.worth-cases .worth-case-bar{display:flex;width:100%;height:7px;max-width:none;gap:0;background:#243442;margin-top:3px;overflow:hidden}.worth-case-bar i{display:block;height:100%;flex-shrink:0}.worth-case-bar .resources{background:#4c9edb}.worth-case-bar .health{background:#acd9f6}
@media(max-width:600px){.cover-hero{padding-top:22px;padding-bottom:0}.cover-hero h1{margin-bottom:18px}.cover-synthesis .worth-cases button{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:9px}.worth-cases .worth-case-bar{grid-column:1/-1}.cover-synthesis .worth-cases span{max-width:none}.cover-preface{padding:22px 0}}
"""
write('math_to_atoms_cover_v039.css',css)
test=read('math_to_atoms_gdp_browser_v038.test.mjs').replace('qa-v038','qa-v039')
needle=" assert.equal(await worth.locator('[data-worth-total]').innerText(),'$3.84T/yr');"
assert needle in test
test=test.replace(needle,needle+"\n assert.ok(await page.evaluate(()=>{const title=document.querySelector('#cover-title'),s=document.querySelector('[data-cover-synthesis]'),controls=document.querySelector('[data-cover-controls]');return title.parentElement.nextElementSibling===s&&(s.compareDocumentPosition(controls)&Node.DOCUMENT_POSITION_FOLLOWING)&&s.contains(document.querySelector('[data-cover-worth]'))&&s.contains(document.querySelector('[data-cover-charts]'));}));\n await page.screenshot({path:path.join(out,'homepage-top-1440.png')});")
test=test.replace('valuationAboveCharts:true','synthesisDirectlyUnderTitle:true')
write('math_to_atoms_gdp_browser_v039.test.mjs',test)
print('Built v039: title, synthesis, introduction, then assumptions.')
