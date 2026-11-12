import os,json,pathlib,hashlib
from urllib.parse import urljoin
from playwright.sync_api import sync_playwright
BASE=os.environ.get('MTA_SITE_URL','http://127.0.0.1:8765/math.to.atoms/').rstrip('/')+'/'
OUT=pathlib.Path(os.environ['TEMP'])/'math-to-atoms-qa-v031';OUT.mkdir(exist_ok=True)
SOURCE=pathlib.Path(__file__).with_name('math_to_atoms_v007_20261111.docx')
def snapshot(page,root):return page.locator(root+' [data-delta-curve]').evaluate_all('es=>es.map(e=>e.outerHTML)')
def history(page):return page.locator('#master-outlook .history-line').evaluate_all('es=>es.map(e=>e.getAttribute("d"))')
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='C:/Users/campbell/AppData/Local/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-win64/chrome-headless-shell.exe')
 page=b.new_page(viewport={'width':1440,'height':1200},accept_downloads=True);errors=[];missing=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('response',lambda r:missing.append(r.url) if r.status>=400 and r.url.startswith(BASE) else None)
 page.goto(BASE,wait_until='networkidle')
 assert page.locator('.snapshot-card').count()==5 and page.locator('input').count()==0
 assert page.locator('.cover-actions a[href="./model.html"]').inner_text().startswith('Explore the model')
 assert 'Try the dials' not in page.content() and 'Explore the model ?' not in page.content()
 fixed=snapshot(page,'.snapshot-grid');assert len(fixed)==5
 assert all('data-range-start="1900"' in page.locator(f'.snapshot-card[data-master-axis="{a}"]').inner_html() for a in ['economy','health','climate','time'])
 assert page.locator('.snapshot-grid .energy-history-line').get_attribute('data-observations')=='126'
 page.screenshot(path=str(OUT/'summary-1440.png'),full_page=True)
 page.locator('.cover-actions a[href="./model.html"]').click();page.wait_for_selector('#graph .node')
 assert page.locator('#graph .node').count()==88
 assert page.locator('[data-live-window="full"]').get_attribute('aria-pressed')=='true'
 assert snapshot(page,'#master-outlook')==fixed
 assert len(set(page.locator('#master-outlook [data-master-axis]').evaluate_all('es=>es.map(e=>Math.round(e.getBoundingClientRect().y))')))==1
 for a in ['economy','health']:
  card=page.locator(f'#master-outlook [data-master-axis="{a}"]');assert card.locator('.outlook-scenario').count()==0;assert card.locator('.delta-line').count()==1
 before=snapshot(page,'#master-outlook');gray=history(page)
 domains=page.locator('#master-outlook [data-delta-curve]').evaluate_all('es=>es.map(e=>e.dataset.domainMax)')
 slider=page.locator('#master-outlook input[type=range][data-macro="capturePercent"]')
 slider.evaluate("el=>{el.value='80';el.dispatchEvent(new Event('input',{bubbles:true}));}")
 after=snapshot(page,'#master-outlook');assert all(a!=z for a,z in zip(before,after))
 assert history(page)==gray
 assert page.locator('#master-outlook [data-delta-curve]').evaluate_all('es=>es.map(e=>e.dataset.domainMax)')==domains
 assert page.evaluate("JSON.parse(localStorage.getItem('mta-ledger-v7')).workspace.macro.capturePercent")==25
 slider.dispatch_event('change');page.locator('#undo').click();assert snapshot(page,'#master-outlook')==fixed
 horizon=page.locator('#master-outlook input[type=number][data-projection="horizonYears"]');horizon.fill('30');horizon.press('Enter')
 assert page.locator('#master-outlook [data-delta-curve]').first.locator('text').last.text_content()=='2056'
 assert page.locator('#master-outlook [data-master-axis="economy"] [data-range-end]').get_attribute('data-range-end')=='2056'
 page.locator('#undo').click()
 page.locator('[data-live-window="recent"]').click();assert page.locator('#master-outlook [data-live-axis="economy"]').get_attribute('data-range-start')=='2006'
 page.locator('[data-live-window="impact"]').click();assert page.locator('#master-outlook [data-benefit-curve]').count()==5
 page.locator('[data-live-window="full"]').click();assert snapshot(page,'#master-outlook')==fixed
 page.screenshot(path=str(OUT/'model-1440.png'))
 slider=page.locator('#master-outlook input[type=range][data-macro="capturePercent"]')
 slider.evaluate("el=>{el.value='50';el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));}")
 stored=page.evaluate("localStorage.getItem('mta-ledger-v7')")
 page.locator('.site-links').get_by_text('Summary',exact=True).click()
 assert snapshot(page,'.snapshot-grid')==fixed and page.evaluate("localStorage.getItem('mta-ledger-v7')")==stored
 page.locator('.cover-actions a[href="./model.html"]').click();page.wait_for_selector('#graph .node')
 assert page.locator('#master-outlook [data-live-value="economy"]').inner_text()=='$3.62T/yr'
 page.goto(urljoin(BASE,'essay.html'),wait_until='networkidle')
 assert page.locator('.article-figure').count()==13
 page.locator('a.footnote-link[href="#ref-9"]').first.click();assert page.locator('#sources').evaluate('el=>el.open')
 page.locator('#timeline>summary').click();assert page.locator('#timeline tbody tr').count()==37
 with page.expect_download() as event:page.get_by_role('link',name='Download Word draft').click()
 assert hashlib.sha256(pathlib.Path(event.value.path()).read_bytes()).digest()==hashlib.sha256(SOURCE.read_bytes()).digest()
 page.goto(BASE+'#graph-details');page.wait_for_url('**/model.html#graph-details');page.wait_for_selector('#graph .node')
 for width in [320,400,768,1100,1440,1920]:
  page.set_viewport_size({'width':width,'height':1200})
  for route in ['','essay.html','model.html']:
   page.goto(urljoin(BASE,route),wait_until='networkidle')
   if route=='model.html':page.wait_for_selector('#graph .node')
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(width,route)
   if width==400 and route in ['', 'model.html']:page.screenshot(path=str(OUT/('summary-400.png' if route=='' else 'model-400.png')),full_page=route=='')
 assert not errors,errors
 assert not missing,missing
 print(json.dumps({'passed':True,'snapshot_matches_model':True,'five_history_and_delta_charts':True,'live_dragging':True,'fixed_history_and_scales':True,'horizon_and_views':True,'state_and_undo':True,'essay_and_download':True,'widths':[320,400,768,1100,1440,1920],'errors':errors,'missing':missing}))
 b.close()
