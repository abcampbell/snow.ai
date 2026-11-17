"""Move the consumer-benefit estimate above the charts and clarify its title."""
from pathlib import Path
import re
ROOT=Path(__file__).resolve().parent
def read(n):return (ROOT/n).read_text(encoding='utf-8')
def write(n,s):(ROOT/n).write_text(s,encoding='utf-8')
welfare=read('math_to_atoms_welfare_v036.mjs')
welfare=welfare.replace('<p class="worth-label">Gross value at your settings · by ${end}</p>','<h3 class="worth-title">Estimated consumer benefits</h3><p class="worth-label">Gross annual value · by ${end}</p>')
welfare=welfare.replace('Savings plus a chosen dollar value for healthier lives. Before implementation costs. This total is not GDP or cash income.','Resource savings plus a chosen value for healthier lives. Before costs; not GDP or cash income.')
welfare=welfare.replace('<p><strong>Health:</strong>','<p>This is a broad benefit estimate, not a measured consumer-surplus total. It includes resource savings and the chosen value of health gains.</p><p><strong>Health:</strong>')
write('math_to_atoms_welfare_v038.mjs',welfare)
write('math_to_atoms_welfare_v038.css',".worth-panel .worth-title{font:500 26px/1.25 Barlow,Arial,sans-serif;letter-spacing:-.025em;color:#e3f0fa;margin:0 0 12px}.worth-panel .worth-label{margin-bottom:7px}@media(max-width:600px){.worth-panel .worth-title{font-size:24px}}\n")
for kind in ['cover','model']:
 write(f'math_to_atoms_{kind}_v038.css',f"@import url('./math_to_atoms_{kind}_v037.css');\n@import url('./math_to_atoms_welfare_v038.css');\n")
write('math_to_atoms_cover_v038.mjs',read('math_to_atoms_cover_v037.mjs').replace('welfare_v036','welfare_v038'))
app=read('math_to_atoms_app_v037.mjs').replace('welfare_v036','welfare_v038')
app=app.replace("$('master-outlook').querySelector('[data-master-cards]').after(worth);","toolbar.before(worth);")
write('math_to_atoms_app_v038.mjs',app)
cover=read('math_to_atoms_cover_v037.html').replace('cover_v037','cover_v038').replace('Math to Atoms · v037','Math to Atoms · v038')
worth=re.search(r'<section class="worth-panel" data-cover-worth.*?</section>',cover,re.S).group()
cover=cover.replace(worth,'',1)
worth=worth.replace('<p>At the published settings:','<h3 class="worth-title">Estimated consumer benefits</h3><p>At the published settings:')
cover=cover.replace('<section class="gdp-paths" data-cover-gdp-paths',worth+'\n<section class="gdp-paths" data-cover-gdp-paths',1)
write('math_to_atoms_cover_v038.html',cover)
write('math_to_atoms_ledger_v038.html',read('math_to_atoms_ledger_v037.html').replace('app_v037','app_v038').replace('model_v037','model_v038').replace('· v037','· v038'))
test=read('math_to_atoms_gdp_browser_v037.test.mjs').replace('qa-v037','qa-v038').replace('Node.DOCUMENT_POSITION_PRECEDING','Node.DOCUMENT_POSITION_FOLLOWING').replace('chartsAboveValuation:true','valuationAboveCharts:true')
write('math_to_atoms_gdp_browser_v038.test.mjs',test)
print('Built v038: consumer benefits directly below sliders, above the charts.')
