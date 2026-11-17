"""Show today's GDP beside both outcomes for the selected time window."""
from pathlib import Path
import re
ROOT=Path(__file__).resolve().parent
def read(n):return (ROOT/n).read_text(encoding='utf-8')
def write(n,s):(ROOT/n).write_text(s,encoding='utf-8')
gdp=read('math_to_atoms_gdp_paths_v037.mjs')
old=" const end=f.targetYear,relative="
assert old in gdp
gdp=gdp.replace(old," const today=f.points.find(p=>p.year===f.startYear)?.baseline;\n const end=f.targetYear,relative=",1)
gdp=gdp.replace('Two GDP paths · ${f.startYear}–${end}',"Next ${end-f.startYear} ${end-f.startYear===1?'year':'years'} · ${f.startYear}–${end}")
gdp=gdp.replace('<p class="gdp-path-kicker">','<p class="gdp-path-kicker" data-gdp-timeline>')
gdp=gdp.replace('<div class="gdp-path-readouts"><div><span>Current trend · ${end}</span>', '<div class="gdp-path-readouts"><div class="gdp-readout-today"><span>Today · ${f.startYear} estimate</span><strong data-gdp-today>${real(today)}/yr</strong></div><div><span>Without added math · ${end}</span>')
gdp=gdp.replace('<i class="baseline"></i>Current trend','<i class="baseline"></i>Without added math')
gdp=gdp.replace('World GDP: current trend and with added math','World GDP: today, without added math and with added math')
needle=" return svg+'</svg>';"
marker=""" const today=f.points.find(p=>p.year===f.startYear)?.baseline;
 if(today!==undefined){
  svg+=`<line class="gdp-today-guide" data-gdp-today-year="${f.startYear}" x1="${x(f.startYear)}" x2="${x(f.startYear)}" y1="${T}" y2="${height-B}"/><circle class="gdp-today-dot" cx="${x(f.startYear)}" cy="${y(today)}" r="3.5"/><text class="gdp-today-label" x="${x(f.startYear)}" y="13" text-anchor="${future?'start':'end'}">Today · ${f.startYear}</text>`;
 }
"""
assert needle in gdp;gdp=gdp.replace(needle,marker+needle)
write('math_to_atoms_gdp_paths_v040.mjs',gdp)
css=""".gdp-path-readouts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:22px;max-width:850px}.gdp-path-readouts .gdp-readout-today strong{color:#d6e5f1}.gdp-today-guide{stroke:#8ea7ba;stroke-width:1;stroke-dasharray:3 4;opacity:.7}.gdp-today-dot{fill:#d5e5f2;stroke:#8ea7ba;stroke-width:1}.gdp-today-label{font:12px Barlow,Arial,sans-serif;fill:#c4d9e9}@media(max-width:600px){.gdp-path-readouts{gap:12px}.gdp-path-readouts strong{font-size:clamp(14px,4vw,18px);white-space:nowrap}.gdp-path-readouts span{min-height:3em;font-size:11px;line-height:1.5}}
"""
write('math_to_atoms_gdp_paths_v040.css',css)
for kind,old in [('cover','039'),('model','038')]:
 write(f'math_to_atoms_{kind}_v040.css',f"@import url('./math_to_atoms_{kind}_v{old}.css');\n@import url('./math_to_atoms_gdp_paths_v040.css');\n")
write('math_to_atoms_cover_v040.mjs',read('math_to_atoms_cover_v039.mjs').replace('gdp_paths_v037','gdp_paths_v040'))
write('math_to_atoms_app_v040.mjs',read('math_to_atoms_app_v038.mjs').replace('gdp_paths_v037','gdp_paths_v040'))
cover=read('math_to_atoms_cover_v039.html').replace('cover_v039','cover_v040').replace('Math to Atoms · v039','Math to Atoms · v040')
fallback=read('math_to_atoms_gdp_paths_fallback_v040.html')
cover=re.sub(r'<section class="gdp-paths" data-cover-gdp-paths.*?</section>',lambda m:fallback,cover,count=1,flags=re.S)
write('math_to_atoms_cover_v040.html',cover)
write('math_to_atoms_ledger_v040.html',read('math_to_atoms_ledger_v038.html').replace('app_v038','app_v040').replace('model_v038','model_v040').replace('· v038','· v040'))
test=read('math_to_atoms_gdp_browser_v039.test.mjs').replace('qa-v039','qa-v040')
needle=" assert.equal(await worth.locator('[data-worth-total]').innerText(),'$3.84T/yr');"
test=test.replace(needle,needle+"\n assert.equal(await panel.locator('[data-gdp-today]').innerText(),'Int$186T/yr');\n assert.equal(await panel.locator('[data-gdp-timeline]').innerText(),'Next 20 years · 2026–2046');\n assert.ok((await panel.locator('.gdp-path-readouts').innerText()).includes('Without added math · 2046'));\n")
needle="  assert.equal(await panel.locator('.gdp-plot-wide svg').getAttribute('data-end-year'),String(2026+years));"
test=test.replace(needle,needle+"\n  assert.equal(await panel.locator('[data-gdp-timeline]').innerText(),`Next ${years} ${years===1?'year':'years'} · 2026–${2026+years}`);\n  assert.equal(await panel.locator('[data-gdp-today]').innerText(),'Int$186T/yr');\n  assert.equal(await panel.locator('.gdp-plot-wide [data-gdp-today-year]').getAttribute('data-gdp-today-year'),'2026');")
write('math_to_atoms_gdp_browser_v040.test.mjs',test)
print('Built v040: today, selected timeline, without/with added math.')
