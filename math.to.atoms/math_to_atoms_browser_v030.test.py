import os,json,pathlib,hashlib
from urllib.parse import urljoin
from playwright.sync_api import sync_playwright

BASE=os.environ.get('MTA_SITE_URL','http://127.0.0.1:8765/')
if not BASE.endswith('/'):BASE+='/'
OUT=pathlib.Path(os.environ['TEMP'])/'math-to-atoms-qa-v030';OUT.mkdir(exist_ok=True)
SOURCE=pathlib.Path(__file__).with_name('math_to_atoms_v007_20261111.docx')

with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='C:/Users/campbell/AppData/Local/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-win64/chrome-headless-shell.exe')
 page=b.new_page(viewport={'width':1440,'height':1100},accept_downloads=True)
 errors=[];missing=[];requests=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('response',lambda r:missing.append(r.url) if r.status>=400 and r.url.startswith(BASE) else None)
 page.on('request',lambda r:requests.append(r.url))
 page.goto(BASE,wait_until='networkidle')
 assert page.locator('h1').inner_text()=='Math to Atoms'
 assert page.locator('.cover-metric').count()==3
 assert '$1.81T' in page.locator('.cover-metric').nth(0).inner_text()
 assert '140M' in page.locator('.cover-metric').nth(1).inner_text()
 assert '5% lower' in page.locator('.cover-metric').nth(2).inner_text()
 assert page.locator('input').count()==0
 assert not any('math_to_atoms_app_' in x for x in requests)
 assert page.locator('.site-links [aria-current=page]').inner_text()=='Summary'
 page.screenshot(path=str(OUT/'summary-1440.png'),full_page=True)
 page.locator('#assumptions>summary').click()
 assert '25%' in page.locator('#assumptions').inner_text()
 page.get_by_role('link',name='Read the essay',exact=False).first.click()
 page.wait_for_url('**/essay.html')
 assert 'draft v007' in page.locator('.essay-meta').inner_text()
 assert page.locator('.article-figure').count()==13
 assert page.locator('.article-appendix').count()==3
 assert page.locator('.article-appendix[open]').count()==0
 assert '31.5M' in page.locator('.article-body').inner_text()
 assert '[INSERT' not in page.content() and '[OPEN' not in page.content()
 page.locator('a.footnote-link[href="#ref-9"]').first.click()
 assert page.locator('#sources').evaluate('el=>el.open')
 assert page.locator('#ref-9').is_visible()
 page.locator('#timeline>summary').click()
 assert page.locator('#timeline tbody tr').count()==37
 assert page.locator('#timeline th').count()==4
 with page.expect_download() as event:
  page.get_by_role('link',name='Download Word draft').click()
 data=pathlib.Path(event.value.path()).read_bytes()
 assert hashlib.sha256(data).digest()==hashlib.sha256(SOURCE.read_bytes()).digest()
 page.goto(urljoin(BASE,'essay.html'),wait_until='networkidle')
 page.screenshot(path=str(OUT/'essay-1440.png'))
 page.locator('.site-links a').get_by_text('Model',exact=True).click()
 page.wait_for_selector('#graph .node')
 assert page.locator('#graph .node').count()==88
 assert page.locator('[data-live-value="economy"]').first.inner_text()=='$1.81T/yr'
 cards=page.locator('[data-master-axis]').evaluate_all('els=>els.map(e=>Math.round(e.getBoundingClientRect().y))')
 assert len(cards)==5 and len(set(cards))==1
 slider=page.locator('#master-outlook input[type=range][data-macro="capturePercent"]')
 slider.evaluate("el=>{el.value='50';el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));}")
 assert page.locator('[data-live-value="economy"]').first.inner_text()=='$3.62T/yr'
 before=page.evaluate("localStorage.getItem('mta-ledger-v7')")
 page.locator('.site-links a').get_by_text('Summary',exact=True).click()
 assert '$1.81T' in page.locator('.cover-metric').first.inner_text()
 assert page.evaluate("localStorage.getItem('mta-ledger-v7')")==before
 page.get_by_role('link',name='Try the dials').click()
 page.wait_for_selector('#graph .node')
 assert page.locator('#master-outlook input[type=number][data-macro="capturePercent"]').input_value()=='50'
 assert page.locator('[data-live-value="economy"]').first.inner_text()=='$3.62T/yr'
 page.goto(BASE+'#graph-details')
 page.wait_for_url('**/model.html#graph-details')
 page.wait_for_selector('#graph .node');assert page.locator('#graph .node').count()==88
 for width in (320,400,768,1100,1440,1920):
  page.set_viewport_size({'width':width,'height':1100})
  for route in ('','essay.html','model.html'):
   page.goto(urljoin(BASE,route),wait_until='networkidle')
   if route=='model.html':page.wait_for_selector('#graph .node')
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(width,route)
   if width==400 and not route:page.screenshot(path=str(OUT/'summary-400.png'),full_page=True)
   if width==400 and route=='essay.html':page.screenshot(path=str(OUT/'essay-400.png'))
 assert not errors,errors
 assert not missing,missing
 print(json.dumps({'passed':True,'summary_without_dials':True,'latest_essay':True,'essay_figures':13,'timeline_rows':37,'matching_Word_download':True,'source_links_open_details':True,'model_nodes':88,'saved_settings_preserved':True,'legacy_anchor':True,'widths':[320,400,768,1100,1440,1920],'errors':errors,'missing_assets':missing}))
 b.close()
