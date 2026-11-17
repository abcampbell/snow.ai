"""Distinguish the all-energy spending base from the scenario saving."""
from pathlib import Path
import re
ROOT=Path(__file__).resolve().parent
def read(n):return (ROOT/n).read_text(encoding='utf-8')
def write(n,s):(ROOT/n).write_text(s,encoding='utf-8')
timeline=read('math_to_atoms_timeline_v039.mjs').replace('GDP comparison below','see GDP comparison')
old="energy:energy.savings===null?'Set energy spending':money(energy.savings)+'/yr saved · included in gross savings'"
new="energy:energy.savings===null?'Set energy spending':'Bill '+money(energy.base)+'/yr × '+pct(impact.effect*100)+' = '+money(energy.savings)+'/yr saved'"
assert old in timeline;timeline=timeline.replace(old,new)
source='https://iea.blob.core.windows.net/assets/86f2ba8c-f44b-494a-95cc-e75863cebf95/StrategiesforAffordableandFairCleanEnergyTransitions.pdf'
reference='<p class="energy-bill-reference" data-energy-bill-reference>All-energy consumer bill assumption, held fixed over the rollout. <a href="'+source+'" target="_blank" rel="noopener noreferrer">IEA benchmark: about $9T/yr</a>, 2019–23 average in 2023 USD. Electricity includes its fuel inputs; the oil history above is a price proxy.</p>'
timeline=timeline.replace('${limit}${yearly}${details}',"${limit}${yearly}${axis==='energy'?`"+reference+"`:''}${details}")
write('math_to_atoms_timeline_v041.mjs',timeline)
write('math_to_atoms_cover_v041.mjs',read('math_to_atoms_cover_v040.mjs').replace('timeline_v039','timeline_v041'))
write('math_to_atoms_app_v041.mjs',read('math_to_atoms_app_v040.mjs').replace('timeline_v037','timeline_v041'))
css='.energy-bill-reference{font:11px/1.65 Barlow,Arial,sans-serif;color:#96adc0;margin:12px 0 0}.energy-bill-reference a{color:#a2cfee;text-underline-offset:3px}\n'
write('math_to_atoms_energy_reference_v041.css',css)
for kind in ['cover','model']:
 write(f'math_to_atoms_{kind}_v041.css',f"@import url('./math_to_atoms_{kind}_v040.css');\n@import url('./math_to_atoms_energy_reference_v041.css');\n")
cover=read('math_to_atoms_cover_v040.html').replace('cover_v040','cover_v041').replace('Math to Atoms · v040','Math to Atoms · v041')
charts=read('math_to_atoms_snapshot_v041.html')
cover=re.sub(r'(<div class="snapshot-grid" data-cover-charts>).*?(</div><p class="snapshot-note")',lambda m:m[1]+charts+m[2],cover,count=1,flags=re.S)
write('math_to_atoms_cover_v041.html',cover)
write('math_to_atoms_ledger_v041.html',read('math_to_atoms_ledger_v040.html').replace('app_v040','app_v041').replace('model_v040','model_v041').replace('· v040','· v041'))
test=read('math_to_atoms_gdp_browser_v040.test.mjs').replace('qa-v040','qa-v041')
needle=" assert.equal(await worth.locator('[data-worth-total]').innerText(),'$3.84T/yr');"
test=test.replace(needle,needle+"\n assert.equal(await page.locator('[data-cover-charts] [data-master-axis=energy] .live-compare').innerText(),'Bill $12T/yr × 5% = $600B/yr saved');\n assert.ok((await page.locator('[data-cover-charts] [data-energy-bill-reference]').innerText()).includes('2019–23 average in 2023 USD'));\n")
write('math_to_atoms_gdp_browser_v041.test.mjs',test)
print('Built v041: explicit energy bill, saving, scope and historical benchmark.')
