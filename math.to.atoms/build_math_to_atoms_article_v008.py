"""Integrate the valuation and energy-GDP research into the existing article."""
from pathlib import Path
from copy import deepcopy
import json
from docx import Document
from docx.shared import Inches,Pt,RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
ROOT=Path(__file__).resolve().parent
calc=json.loads((ROOT/'math_to_atoms_valuation_v036.json').read_text())
assert abs(calc['cases'][1]['value']['combined']-15.3561e12)<1
doc=Document(ROOT/'math_to_atoms_v007_20261111.docx')
original=list(doc.paragraphs)
def text(i,s):
 p=original[i];p.clear();p.add_run(s);return p
def after(p,s,style='Normal'):
 new=OxmlElement('w:p');p._p.addnext(new)
 from docx.text.paragraph import Paragraph
 out=Paragraph(new,p._parent);out.style=next(x for x in doc.styles if x.name==style);run=out.add_run(s)
 if style=='Heading 2':run.bold=True;run.font.size=Pt(12);out.paragraph_format.keep_with_next=True
 return out
text(2,'15 November 2026 · v008')
text(47,'My working answer is about $15T a year of gross value if the relevant mathematics is solved and half of the resulting improvements are deployed over twenty years. Full use takes that to about $30T. Those figures combine cheaper useful output with a stated value for healthier lives. They are not GDP forecasts or a market price for every unsolved theorem.')
text(48,'Here is what I am pricing.')
text(62,'At the starting settings, the case saves about 140 million healthy life-years a year against the reference burden. The gross resource saving is $1.81T a year. Put $14,500 on a saved healthy year and the health benefit is worth $2.03T, giving $3.84T a year of combined gross value. The $120T economy is a nominal-dollar yardstick I chose, not a forecast of world GDP in 2046. None of these figures deducts the cost of making the changes.')
text(64,'Undiscounted totals under an even phase-in and fixed references. The final annual saving is not received from year one. These charts keep physical health units separate from dollars; the combined valuation below prices those same healthy years once. Energy is included in resource savings once.')
text(65,'For the all-math case I set the share reached to 100%, keep half deployed, and keep the assumed 40% improvement where used. That produces a 20% overall reduction in the selected costs and health burden. It assumes solving the relevant math unlocks that whole opportunity. A solved theorem does not, by itself, establish that assumption or build the equipment.')
text(74,'There is a useful GDP framework, though. An IMF study of cheaper electricity in Chile estimates that replacing coal generation with solar and wind cuts generation costs by 28%. Weight that change by the electricity generation industry’s 2.9% share of gross output relative to GDP and the first-order aggregate productivity gain is about 0.8%. Allow capital investment to adjust, using a capital share of one third, and their 1.5 capital multiplier gives about 1.2% higher long-run GDP. The production-network effect is already inside the first calculation. [15]')
p=after(original[74],'Applied illustratively to my all-reached, half-used energy case, a 20% cut in a $12T energy bill saves $2.4T a year. A 1.5 long-run capital response would turn a real productivity gain of that scale into about $3.6T of extra annual output, or 3% of the $120T reference economy. This is my first-pass scenario, not a published global forecast. It needs an appropriate energy cost weight, real resource savings rather than a price transfer, and an allowance for transition costs.')
p=after(p,'I do not add that $3.6T to the $2.4T energy saving: they describe the same underlying benefit in different ways. Nor is a 3% higher level of output three percentage points of extra growth forever. Spread over twenty years it is roughly 0.15 percentage points of extra annual growth during that transition. The speed of capital adjustment is another assumption, not a date established by the Chile study.')
text(89,'Solving the selected mathematical gaps does not put every application into use. In the all-reached case, half adoption produces $7.24T a year of resource savings and $8.11T of health value. Together that is $15.4T a year by 2046. Full adoption doubles it to $30.7T. The calculation values some existing activities and health losses; it does not put a ceiling on mathematics or price entirely new industries.')
text(94,'Energy is a third of the resource-saving line, and that is my doing. I gave it a $12T spending base against $24T for other production and logistics. At the starting 5% reduction, that gives $600B and $1.20T a year, plus $11.2B in avoided disaster losses. I have assumed these cost buckets are separate. Shared inputs across suppliers still need checking.')
text(98,'Health needs a dollar assumption if it is going into the combined answer. The reference burden is about 2.80 billion DALYs a year: healthy years lost to illness, disability or early death. At $14,500 each, that whole burden has a benchmark value of $40.6T a year. This does not mean mathematics can eliminate every disease or injury. It also does not directly predict life expectancy, which needs age-specific mortality and disability calculations. [14]')
text(99,'I choose $14,500 per DALY averted, roughly one year of output per person using the $120T yardstick and about 8.3 billion people. Research has used GDP per person as a simple DALY valuation benchmark, while explicitly warning that it is not a measured willingness to pay or an accepted treatment threshold. Here it is a uniform value for health itself, rather than another count of medical bills or lost wages. [16]')
p=after(original[99],'The all-reached, half-used case averts about 559 million DALYs a year. At my chosen price, that is $8.11T of health value. Add $7.24T of resource savings and the answer is $15.4T a year. Those are welfare-equivalent dollars, not an extra $15.4T of GDP or a cheque somebody receives.')
p=after(p,'The annual value under three deployment cases','Heading 2')
table=doc.add_table(rows=1,cols=4)
pr=table._tbl.tblPr
borders=OxmlElement('w:tblBorders')
for edge in ['top','bottom','insideH']:
 el=OxmlElement('w:'+edge);el.set(qn('w:val'),'single');el.set(qn('w:sz'),'4');el.set(qn('w:color'),'B8C4CF');borders.append(el)
pr.append(borders)
for cell,s in zip(table.rows[0].cells,['Case','Resources per year','Health value per year','Combined per year']):cell.text=s
for row in [ ['25% reached, half used','$1.81T','$2.03T','$3.84T'],['All reached, half used','$7.24T','$8.11T','$15.4T'],['All reached, fully used','$14.5T','$16.2T','$30.7T'] ]:
 for cell,s in zip(table.add_row().cells,row):cell.text=s
table.autofit=False
for row in table.rows:
 for cell,width in zip(row.cells,[2.0,1.25,1.25,1.25]):
  cell.width=Inches(width)
  for cp in cell.paragraphs:
   cp.paragraph_format.space_after=Pt(5);cp.paragraph_format.space_before=Pt(5)
   for r in cp.runs:r.font.size=Pt(10);r.font.color.rgb=RGBColor(0,0,0)
for cell in table.rows[0].cells:
 for r in cell.paragraphs[0].runs:r.bold=True
 shade=OxmlElement('w:shd');shade.set(qn('w:fill'),'E8EDF2');cell._tc.get_or_add_tcPr().append(shade)
hdr=OxmlElement('w:tblHeader');table.rows[0]._tr.get_or_add_trPr().append(hdr)
p._p.addnext(table._tbl)
from docx.text.paragraph import Paragraph
note=OxmlElement('w:p');table._tbl.addnext(note);p=Paragraph(note,doc._body);p.add_run('Annual amounts by 2046, before implementation costs, with 40% improvement where used and $14,500 per DALY averted. The starting case reaches 25%; the other two assume all the selected opportunity is reached. Only resources and health are added.');p.paragraph_format.space_after=Pt(8)
p=after(p,'Change the health price to $5,000 and the all-reached, half-used answer falls to $10.0T a year. At $50,000 it rises to $35.2T. That is sensitivity to a value judgment, not a confidence interval. With an even build-up, the central case produces about $154T of undiscounted gross resource and health value over the twenty-year transition. The final $15.4T annual value is not received from year one.')
p=after(p,'For the same all-reached, half-used settings, avoided emissions of 7.68 billion tonnes a year are worth $768B at an assumed $100 per tonne. Two years saved on a ten-year project gives $500B a year of financing value if annual project spending is $10T, spending is even during construction, and the annual capital charge is 5%. Both are shown separately: climate damages can overlap health and disaster losses, while financing gains can overlap production savings and the capital response. I do not add them to the $15.4T headline.')
p=after(p,'So my answer is tens of trillions a year of potential gross value under these assumptions, with roughly $15T as the half-deployed case. It is not a measured price for all leading-edge mathematics. The biggest empirical task is still showing which mathematical advances deliver these physical improvements beyond what ordinary progress would have delivered anyway.')
text(101,'Mine came back faster: about fifteen trillion dollars a year, with the assumptions attached. It still does not build the planet for me.')
original[89].paragraph_format.keep_together=True
original[99].paragraph_format.keep_together=True
# Append new evidence before the existing chronology-source section.
heading=next(p for p in doc.paragraphs if p.text=='Chronology sources')
for s in [
 '15. Guo (2024), Renewable Energy—An Attempt to Estimate the GDP Impact. IMF, Chile: Selected Issues, pp. 5–7. Capital response: 1.5; grid and storage costs need allowance.',
 '16. Franklin, Angus, Welte et al. (2023), How Much Should be Invested in Lung Care? Applied Health Economics and Health Policy. GDP per person is a valuation benchmark, not a treatment threshold.',
]:
 p=heading.insert_paragraph_before(s)
 from docx.opc.constants import RELATIONSHIP_TYPE as RT
 url='https://www.imf.org/-/media/files/publications/cr/2024/english/1chlea2024002.pdf' if s.startswith('15.') else 'https://link.springer.com/article/10.1007/s40258-023-00802-y'
 h=OxmlElement('w:hyperlink');h.set(qn('r:id'),doc.part.relate_to(url,RT.HYPERLINK,is_external=True));r=OxmlElement('w:r');pr=OxmlElement('w:rPr');style=OxmlElement('w:rStyle');style.set(qn('w:val'),'Hyperlink');pr.append(style);r.append(pr);t=OxmlElement('w:t');t.set(qn('xml:space'),'preserve');t.text=' Read the study';r.append(t);h.append(r);p._p.append(h)
 p.paragraph_format.keep_together=True
for name in ['Title','Heading 1','Heading 2']:
 next(s for s in doc.styles if s.name==name).font.color.rgb=RGBColor(0,0,0)
assert len(doc.inline_shapes)==13 and len(doc.tables)==6
# A separate page-break paragraph can occupy a blank page when the essay fills
# the preceding sheet. Put the break on the next heading instead.
for p in list(doc.paragraphs):
 if not p.text and p._p.xpath('.//w:br[@w:type="page"]'):
  following=p._p.getnext()
  if following is not None and following.tag==qn('w:p'):
   from docx.text.paragraph import Paragraph
   Paragraph(following,p._parent).paragraph_format.page_break_before=True
   p._p.getparent().remove(p._p)
out=ROOT/'math_to_atoms_v008_20261115.docx';doc.save(out)
print(json.dumps({'output':str(out),'images':len(doc.inline_shapes),'tables':len(doc.tables)}))
