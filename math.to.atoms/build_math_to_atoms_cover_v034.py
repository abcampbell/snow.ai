"""Build the interactive cover, retaining the v031 charts as a no-JS fallback."""
from pathlib import Path
import re
ROOT=Path(__file__).resolve().parent
cover=(ROOT/'math_to_atoms_cover_v033.html').read_text(encoding='utf-8')
cover=cover.replace('math_to_atoms_cover_v033.css','math_to_atoms_cover_v034.css')
cover=cover.replace('Campbell · Math to Atoms · v033','Campbell · Math to Atoms · v034')
cover=cover.replace('<script type="module" src="./math_to_atoms_navigation_v031.mjs"></script>','<script type="module" src="./math_to_atoms_navigation_v031.mjs"></script><script type="module" src="./math_to_atoms_cover_v034.mjs"></script>')
cover=cover.replace('A short summary of the Math-to-Atoms essay and one illustrative twenty-year case. Read the essay or explore the assumptions.','Move the sliders to see how useful mathematical progress could change costs, health, energy, emissions and project times.')
cover=cover.replace('<div class="cover-kicker">From mathematical progress to everyday outcomes</div>','<div class="cover-kicker">Math → engineering → everyday outcomes</div>')
cover=re.sub(r'<div class="cover-actions">.*?</div>','<div class="cover-actions"><a class="cover-button" href="#case">Play with the assumptions <span aria-hidden="true">↓</span></a><a class="cover-essay-link" href="./essay.html">Read the essay <span aria-hidden="true">↗</span></a></div>',cover,count=1)
controls='''<div class="case-heading"><div><p class="case-label">Play with the assumptions</p><h2 id="case-title" data-cover-period>What changes by 2046?</h2></div><button class="cover-reset" data-cover-reset type="button">Reset</button></div>
<fieldset class="cover-controls" data-cover-controls disabled><legend class="visually-hidden">Change the physical-benefit assumptions</legend>
'''
for key,label,hint,value,minimum in [
    ('reach','How much can math help with?','Share of the costs and illness counted here.',25,0),
    ('use','How much gets used?','Of the improvements that become possible.',50,0),
    ('gain','How much better?','Improvement where a solution is used.',40,0),
    ('years','How long to spread?','Years until the full benefit is in place.',20,1),
]:
    unit=' years' if key=='years' else '%'
    step='1' if key=='years' else 'any'
    controls+=f'<label class="cover-control" for="cover-{key}"><span>{label}</span><output for="cover-{key}" data-cover-output="{key}">{value}{unit}</output><input id="cover-{key}" data-cover-input="{key}" type="range" min="{minimum}" max="100" step="{step}" value="{value}" aria-describedby="cover-{key}-hint"><small id="cover-{key}-hint">{hint}</small></label>\n'
controls+='''</fieldset><div class="cover-reading"><p data-cover-description>At these settings, the overall change is <strong>5%</strong>, built up over <strong>20 years</strong>.</p><a href="./model.html#master-outlook" data-cover-model>Explore the model <span aria-hidden="true">→</span></a></div>
<div class="cover-mobile-results" aria-label="Outcomes at your settings">
'''
for axis,label,value in [('economy','Annual savings','$1.81T/yr'),('health','Healthy years saved','140M/yr'),('energy','Energy','5% cheaper'),('climate','CO₂ avoided','1.92 Gt/yr'),('time','Project time','5% shorter')]:
    controls+=f'<div><span>{label}</span><strong data-cover-mini="{axis}">{value}</strong></div>'
controls+='</div><p class="visually-hidden" role="status" data-cover-status></p>'
cover=cover.replace('<section class="published-case" id="case" aria-labelledby="case-title">','<section class="published-case" id="case" aria-labelledby="case-title" data-cover-interactive aria-busy="true">')
cover=re.sub(r'<div class="case-heading">.*?<p class="cover-story".*?</p>',lambda _:controls,cover,count=1,flags=re.S)
cover=cover.replace('<div class="snapshot-grid" data-snapshot-case="25-50-40-20">','<div class="snapshot-grid" data-cover-charts>')
cover=re.sub(r'<p class="snapshot-note">.*?</p>','<p class="snapshot-note" data-cover-note>The blue gains build from 2026 to 2046. The full annual benefit arrives at the end; the early years deliver less.</p>',cover,count=1)
method='''<details class="cover-method" id="assumptions"><summary>How we get these numbers</summary>
<p data-cover-example>Start with $100 of spending. Math helps us improve $25 of it. The new solutions get used on $12.50. Cut those costs by 40%, and we save $5 out of the original $100.</p>
<p data-cover-method-effect>This example uses the same 5% change for costs, lost healthy years, emissions and project times. The starting spending and health figures stay fixed. You choose how much useful improvement the math makes; the model shows what follows.</p>
<p data-cover-explained>By 2046, that gives $1.81T a year in savings and avoided losses, including $600B from energy. Separately, we save 140M healthy years of life each year and avoid 1.92 billion tonnes of CO₂ from energy. A ten-year project takes 9.5 years.</p>
<p>Energy is included once in the savings total. Health is counted separately. GDP history uses 2021 purchasing-power dollars; savings use fixed reference spending, compared with an assumed $120T world economy. Energy history is an oil-price proxy, and delivery history is US output per hour. Neither is a global measure of all energy costs or project delivery times.</p>
<p>The full model keeps your four slider settings and any other assumptions you have already saved there. Its results may differ if you have changed the starting spending or health figures.</p>
<a href="./model.html#master-outlook" data-cover-model>Explore the model →</a></details>'''
cover=re.sub(r'<details class="cover-method".*?</details>',lambda _:method,cover,count=1,flags=re.S)
cover=cover.replace('If math helps us improve half of the area instead of a quarter, annual savings double to $3.62T. The other benefits double too.','Double the share that math helps with, and the benefits double.')
cover=cover.replace('If only a quarter gets used instead of half, the benefits halve. They also halve if the improvement is 20% rather than 40%.','Halve the share that gets used, or halve how much better it is, and the benefits halve.')
cover=cover.replace('Spread the same change over forty years and the full annual benefit arrives in 2066. It builds half as fast.','Double the rollout time and the same full annual benefit takes twice as long to arrive. It builds half as fast.')
# Every model link carries the visitor's four settings without touching stored work on the cover.
cover=re.sub(r'<a (?![^>]*data-cover-model)([^>]*href="\./model\.html[^\"]*"[^>]*)>',r'<a data-cover-model \1>',cover)
(ROOT/'math_to_atoms_cover_v034.html').write_text(cover,encoding='utf-8')
print('Built v034 interactive cover.')
