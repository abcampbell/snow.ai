"""Rename the three comparison buttons without changing their assumptions."""
from pathlib import Path
ROOT=Path(__file__).resolve().parent
def read(n):return (ROOT/n).read_text(encoding='utf-8')
def write(n,s):(ROOT/n).write_text(s,encoding='utf-8')
s=read('math_to_atoms_welfare_v042.mjs')
s=s.replace("name:'25% reached · half used'","name:'Bear case',detail:'25% reached · 50% used'").replace("name:'All reached · half used'","name:'Base case',detail:'100% reached · 50% used'").replace("name:'All reached · fully used'","name:'Bull case',detail:'100% reached · 100% used'")
s=s.replace('<span>${c.name}</span>','<span class="worth-case-name">${c.name}</span><small class="worth-case-assumptions">${c.detail}</small>')
s=s.replace('“All reached” assumes','Full reach assumes')
write('math_to_atoms_welfare_v044.mjs',s)
write('math_to_atoms_welfare_v044.css',""".worth-cases .worth-case-name{font-size:16px;font-weight:500;color:#e0eef8}.worth-case-assumptions{font:12px/1.5 Barlow,Arial,sans-serif;color:#9eb8cc}.worth-cases .worth-case-bar{display:flex;width:100%;height:7px;max-width:none;gap:0;background:#243442;margin-top:3px;overflow:hidden}.worth-case-bar i{display:block;height:100%;flex-shrink:0}.worth-case-bar .resources{background:#4c9edb}.worth-case-bar .health{background:#acd9f6}@media(max-width:600px){.worth-cases button,.cover-synthesis .worth-cases button{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:5px 12px}.worth-cases .worth-case-name{grid-column:1;grid-row:1;max-width:none}.worth-case-assumptions{grid-column:1;grid-row:2;font-size:11px}.worth-cases button>strong{grid-column:2;grid-row:1/span 2;align-self:center}.worth-cases .worth-case-bar{grid-column:1/-1;grid-row:3;margin-top:7px}}
""")
write('math_to_atoms_cover_v044.mjs',read('math_to_atoms_cover_v043.mjs').replace('welfare_v042','welfare_v044'))
write('math_to_atoms_app_v044.mjs',read('math_to_atoms_app_v042.mjs').replace('welfare_v042','welfare_v044'))
for kind,old in [('cover','043'),('model','042')]:
 write(f'math_to_atoms_{kind}_v044.css',f"@import url('./math_to_atoms_{kind}_v{old}.css');\n@import url('./math_to_atoms_welfare_v044.css');\n")
html=read('math_to_atoms_cover_v043.html').replace('cover_v043','cover_v044').replace('Math to Atoms · v043','Math to Atoms · v044')
html=html.replace('All reached, half used: $15.4T/year; fully used: $30.7T/year.','Bear case: $3.84T/year; Base case: $15.4T/year; Bull case: $30.7T/year.')
write('math_to_atoms_cover_v044.html',html)
write('math_to_atoms_ledger_v044.html',read('math_to_atoms_ledger_v042.html').replace('app_v042','app_v044').replace('model_v042','model_v044').replace('· v042','· v044'))
print('Built v044: Bear case, Base case, Bull case.')
