"""Build the summary, latest essay, and retained full-model entry points.

Run with the Codex document Python runtime (python-docx and Pillow).
The output is static; do not copy the entire workspace into hosting.
"""
from pathlib import Path
from html import escape
from io import BytesIO
import re,json,hashlib
from docx import Document
from docx.text.paragraph import Paragraph
from docx.table import Table
from docx.oxml.ns import qn
from PIL import Image

ROOT=Path(__file__).resolve().parent
SOURCE=ROOT/'math_to_atoms_v007_20261111.docx'
ASSETS=ROOT/'math_to_atoms_essay_assets_v030'
ASSETS.mkdir(exist_ok=True)
nav=lambda current: '<nav class="site-nav" aria-label="Main navigation"><a class="site-brand" href="./index.html">Math to Atoms</a><div class="site-links">'+''.join(f'<a href="./{url}"'+(' aria-current="page"' if key==current else '')+f'>{label}</a>' for key,url,label in [('summary','index.html','Summary'),('essay','essay.html','Essay'),('model','model.html','Model')])+'</div></nav>'
def head(title,description,page,canonical):
    return f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#0b1019"><meta name="description" content="{escape(description,quote=True)}"><title>{escape(title)}</title><link rel="canonical" href="https://snow.ai/math.to.atoms/{canonical}"><link rel="stylesheet" href="./math_to_atoms_shell_v030.css"><script type="module" src="./math_to_atoms_navigation_v030.mjs"></script></head><body class="{'landing-page' if page=='summary' else 'reading-page'}" data-page="{page}"><a class="page-skip" href="#main">Skip to content</a><div class="site-wrap">{nav(page)}'''
def footer():
    return '<footer class="site-footer"><span>Campbell · Math to Atoms · v030</span><span><a href="./essay.html">Read the essay</a> · <a href="./model.html">Explore the model</a></span></footer></div></body></html>'

cover=head('Math to Atoms — what better math could change','A short summary of the Math-to-Atoms essay and one illustrative twenty-year case. Read the essay or explore the assumptions.','summary','')+'''
<main id="main">
<section class="cover-hero" aria-labelledby="cover-title">
<div class="cover-kicker">From mathematical progress to everyday outcomes</div>
<h1 id="cover-title">Math to Atoms</h1>
<p class="cover-question">What is better math worth?</p>
<p class="cover-intro">Better mathematics could lower costs and save healthy years. The question is how much we can turn into working technology.</p>
<div class="cover-actions"><a class="cover-button primary" href="./essay.html">Read the essay <span aria-hidden="true">→</span></a><a class="cover-button" href="./model.html">Try the dials <span aria-hidden="true">↗</span></a></div>
</section>
<section class="published-case" id="case" aria-labelledby="case-title">
<div class="case-heading"><h2 id="case-title">One case for 2026–2046</h2><p>Assumed benefits, reached over twenty years</p></div>
<div class="cover-metrics">
<article class="cover-metric"><h3>Annual savings by 2046</h3><p class="cover-number">$1.81T<small>/year</small></p><p>Gross, before costs. Equal to 1.51% of the assumed $120T GDP reference.</p></article>
<article class="cover-metric"><h3>Healthy years saved each year</h3><p class="cover-number">140M</p><p>By 2046, against the reference burden of illness and early death.</p></article>
<article class="cover-metric"><h3>Energy price</h3><p class="cover-number">5% lower</p><p>$600B/year saved by 2046, already included in the savings total.</p></article>
</div>
<details class="cover-method" id="assumptions"><summary>What is assumed?</summary><p>25% of the opportunity reached × 50% used × 40% improvement where used = 5% overall improvement. Benefits build evenly over twenty years on fixed spending and health references. The $1.81T includes energy, other production costs and avoided disaster losses. Health stays separate. <a href="./model.html#master-outlook">Change the assumptions in the model →</a></p></details>
</section>
<section class="cover-takeaway" aria-labelledby="takeaway-title"><h2 id="takeaway-title">The takeaway</h2><div><p>The largest possible payoffs can need years of engineering and testing. Some nearer-term opportunities sit in maintenance, logistics and risk prediction. The useful question is which mathematical advances can change something we can actually build or use.</p><p class="cover-boundary">The numbers above are one scenario, not a price for all mathematics or a GDP forecast. The graph ranks research priorities; the benefit estimates use separate assumptions.</p></div></section>
</main>'''+footer()
(ROOT/'math_to_atoms_cover_v030.html').write_text(cover,encoding='utf-8')

doc=Document(SOURCE)
source_rows=0;figures=0;chunks=[];details_open=False;section='body';sources_seen=set()
def inline(p):
    out=[]
    for child in p._p:
        if child.tag==qn('w:r'):
            txt=''.join(child.xpath('.//w:t/text()'))
            txt=escape(txt)
            if child.xpath('./w:rPr/w:b'):txt='<strong>'+txt+'</strong>'
            if child.xpath('./w:rPr/w:i'):txt='<em>'+txt+'</em>'
            out.append(txt)
        elif child.tag==qn('w:hyperlink'):
            rid=child.get(qn('r:id'));label=''.join(child.xpath('.//w:t/text()'))
            target=doc.part.rels[rid].target_ref if rid in doc.part.rels else ''
            if target.rstrip('/')=='https://snow.ai/math.to.atoms':target='./model.html'
            if target.startswith(('https://','http://','./')):out.append(f'<a href="{escape(target,quote=True)}">{escape(label)}</a>')
            else:out.append(escape(label))
    html=''.join(out)
    if section!='sources':html=re.sub(r'\[(\d+)\]',lambda m:f'<a class="footnote-link" href="#ref-{m[1]}" aria-label="Source {m[1]}">[{m[1]}]</a>',html)
    return html

for child in doc.element.body:
    if child.tag==qn('w:p'):
        p=Paragraph(child,doc);text=p.text.strip()
        if p.style.name=='Title' or text in ['I tried to put a price on solving math','11 November 2026 · v007']:continue
        if child.xpath('.//w:br[@w:type="page"]') and not text:continue
        if p.style.name=='Heading 1':
            if text in ['Model size and release year','Timeline of results and announcements','Sources']:
                if details_open:chunks.append('</div></details>')
                labels={'Model size and release year':('size-appendix','More charts: model size and release year'),'Timeline of results and announcements':('timeline','Timeline: 37 results and announcements'),'Sources':('sources','Sources and references')}
                ident,label=labels[text];section='sources' if text=='Sources' else 'appendix'
                chunks.append(f'<details class="article-appendix" id="{ident}"><summary>{label}</summary><div class="appendix-body'+(' article-sources' if section=='sources' else '')+'">');details_open=True
            else:
                slug=re.sub(r'[^a-z0-9]+','-',text.lower()).strip('-')
                chunks.append(f'<h{3 if text=="Chronology sources" else 2} id="{slug}">{escape(text)}</h{3 if text=="Chronology sources" else 2}>')
            continue
        ids=child.xpath('.//a:blip/@r:embed')
        if ids:
            for rid in ids:
                figures+=1;part=doc.part.related_parts[rid];ext=part.partname.ext
                name=f'figure_{figures:02d}_v030.{ext}';(ASSETS/name).write_bytes(part.blob)
                with Image.open(BytesIO(part.blob)) as im:w,h=im.size
                widths=child.xpath('.//wp:extent/@cx');narrow=bool(widths and int(widths[0])/914400<5)
                chunks.append(f'<figure class="article-figure'+(' narrow' if narrow else '')+f'"><img src="./{ASSETS.name}/{name}" alt="" width="{w}" height="{h}" loading="lazy" decoding="async">')
            continue
        if not text:continue
        if chunks and chunks[-1].startswith('<figure'):
            caption=inline(p);alt=re.sub(r'<[^>]*>','',caption)
            chunks[-1]=chunks[-1].replace('alt=""',f'alt="{escape(alt,quote=True)}"')
            chunks.append(f'<figcaption>{caption}</figcaption></figure>');continue
        attrs=''
        if section=='sources':
            match=re.match(r'^(\d+)\.',text)
            if match and match[1] not in sources_seen:attrs=f' id="ref-{match[1]}"';sources_seen.add(match[1])
        is_note=text.startswith(('Undiscounted totals','Snapshots checked'))
        chunks.append(f'<p{attrs}'+(' class="table-note"' if is_note else '')+'>'+inline(p)+'</p>')
    elif child.tag==qn('w:tbl'):
        t=Table(child,doc);rows=[[c.text for c in r.cells] for r in t.rows]
        if len(rows)==38:source_rows=37
        headrow='<thead><tr>'+''.join(f'<th scope="col">{escape(x)}</th>' for x in rows[0])+'</tr></thead>'
        tbody='<tbody>'+''.join('<tr>'+''.join('<td>'+escape(x)+'</td>' for x in row)+'</tr>' for row in rows[1:])+'</tbody>'
        chunks.append('<div class="table-scroll" tabindex="0" role="region" aria-label="'+escape(rows[0][0],quote=True)+'"><table'+(' class="numeric"' if len(rows[0])==2 else '')+'>'+headrow+tbody+'</table></div>')
if details_open:chunks.append('</div></details>')
assert figures==13 and source_rows==37 and sources_seen=={str(n) for n in range(1,15)}
essay=head('Math to Atoms — the essay','Campbell on mathematical progress, engineering, and one illustrative twenty-year case for savings and healthy years. Latest revised essay.','essay','essay.html')+'''
<main id="main"><header class="essay-header"><div class="cover-kicker">The essay</div><h1>Math to Atoms</h1><p class="essay-subtitle">I tried to put a price on solving math</p><div class="essay-meta"><span>Campbell · 11 November 2026 · draft v007</span><a href="./math_to_atoms_v007_20261111.docx" download>Download Word draft ↓</a><a href="./model.html">Try the model ↗</a></div></header><article class="article-body" aria-label="Math to Atoms essay">'''+ '\n'.join(chunks)+'''<div class="article-end-actions"><p>Want to challenge the numbers?</p><a class="cover-button primary" href="./model.html">Try the dials →</a></div></article></main>'''+footer()
(ROOT/'math_to_atoms_essay_v030.html').write_text(essay,encoding='utf-8')

model=(ROOT/'math_to_atoms_ledger_v029.html').read_text(encoding='utf-8')
model=model.replace('<title>Math-to-Atoms Ledger v029</title>','<title>Math-to-Atoms — full model v030</title>')
model=model.replace('<body>','<body class="model-page">').replace('<div class="wrap">','<div class="wrap">'+nav('model'),1)
model=model.replace('  <script type="module" src="./math_to_atoms_app_v029.mjs"></script>','  <link rel="stylesheet" href="./math_to_atoms_shell_v030.css">\n  <script type="module" src="./math_to_atoms_app_v029.mjs"></script>')
model=model.replace('Math-to-Atoms Ledger · v029','Math-to-Atoms Ledger · v030')
(ROOT/'math_to_atoms_ledger_v030.html').write_text(model,encoding='utf-8')
print(json.dumps({'built':['summary','essay','model'],'essay_figures':figures,'timeline_rows':source_rows,'source_sha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest()}))
