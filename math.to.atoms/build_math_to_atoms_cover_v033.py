"""Rewrite the cover explanation; preserve the published charts and v032 model."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent
cover = (ROOT / 'math_to_atoms_cover_v031.html').read_text(encoding='utf-8')
cover = cover.replace('math_to_atoms_shell_v031.css', 'math_to_atoms_cover_v033.css')
cover = cover.replace('Campbell · Math to Atoms · v031', 'Campbell · Math to Atoms · v033')
cover = cover.replace(
    'Better mathematics could lower costs and save healthy years. The question is how much we can turn into working technology.',
    'Better math can lead to better machines, treatments and decisions. The payoff comes when we build them and put them to use.'
)
cover = cover.replace(
    '<p>Snapshot: 25% reached · 50% used · 40% better where used</p></div>',
    '<p>Twenty years to put better math to work</p></div>'
    '<p class="cover-story" data-model-story>Suppose better math gives us a way to improve a quarter of the costs and health problems counted here. '
    'The new solutions get used in half of that area. Where they are used, things improve by 40%. '
    'Together, that means a 5% improvement across the whole amount we started with.</p>'
)
cover = re.sub(
    r'<p class="snapshot-note">.*?</p>',
    '<p class="snapshot-note">The charts show that change building from 2026 to 2046. '
    'By 2046, the full annual savings are in place; the early years deliver less.</p>',
    cover, count=1
)
method = '''<details class="cover-method" id="assumptions"><summary>How we get these numbers</summary>
<p>Think of $100 of spending. Better math helps us improve $25 of it. The new technology gets used on half of that: $12.50.
Cut that cost by 40%, and we save $5 out of the original $100.</p>
<p>We apply the same 5% reduction to the costs, lost healthy years, emissions and project times in this example.
That shared percentage is an assumption you can change.</p>
<p>By 2046, this gives $1.81T a year in savings and avoided losses, including $600B from energy.
Health is counted separately: about 140 million healthy years of life saved around the world each year.
These are annual amounts at the end of the twenty years, not amounts received every year from the start.</p>
<p>Energy costs 5% less. We avoid 1.92 billion tonnes of CO₂ from energy each year.
A project that would take ten years takes nine and a half.</p>
<p>The calculation keeps the starting spending and health figures fixed.
It compares savings with an assumed $120T world economy; it does not add those savings to GDP.
The historical lines give context.
<a href="./model.html#master-outlook">Explore the model →</a></p></details>'''
cover = re.sub(r'<details class="cover-method".*?</details>', lambda _: method, cover, count=1, flags=re.S)
takeaway = '''<section class="cover-takeaway" aria-labelledby="takeaway-title"><h2 id="takeaway-title">What changes the answer?</h2><div>
<ul class="cover-sensitivities">
<li><strong>Help with more problems.</strong> If math helps us improve half of the area instead of a quarter, annual savings double to $3.62T. The other benefits double too.</li>
<li><strong>Get the solutions used.</strong> If only a quarter gets used instead of half, the benefits halve. They also halve if the improvement is 20% rather than 40%.</li>
<li><strong>Take longer to build.</strong> Spread the same change over forty years and the full annual benefit arrives in 2066. It builds half as fast.</li>
</ul>
<p>A better turbulence model, for example, could help us design an aircraft that burns less fuel.
The saving arrives when that aircraft is built and flown. A better proof alone does not save the fuel.</p>
<p class="cover-boundary">The map helps you choose which math problems look most useful, taking account of how hard the math and engineering are.
It cannot yet tell us how much new math will produce a particular saving. You choose that step in the assumptions;
the charts show what would follow if it happens.</p>
</div></section>'''
cover = re.sub(r'<section class="cover-takeaway".*?</section>', lambda _: takeaway, cover, count=1, flags=re.S)
(ROOT / 'math_to_atoms_cover_v033.html').write_text(cover, encoding='utf-8')
print('Built v033 cover; historical charts, scenario numbers and model remain unchanged.')
