import os,json,pathlib
from urllib.parse import urljoin
from playwright.sync_api import sync_playwright
BASE=os.environ.get('MTA_SITE_URL','http://127.0.0.1:8765/math.to.atoms/').rstrip('/')+'/'
OUT=pathlib.Path(os.environ['TEMP'])/'math-to-atoms-qa-v036';OUT.mkdir(exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='C:/Users/campbell/AppData/Local/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-win64/chrome-headless-shell.exe')
 page=b.new_page(viewport={'width':1440,'height':1200},accept_downloads=True);errors=[];missing=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('response',lambda r:missing.append(r.url) if r.status>=400 and r.url.startswith(BASE) else None)
 page.goto(BASE,wait_until='networkidle');page.wait_for_selector('[data-cover-controls]:not([disabled])')
 panel=page.locator('[data-cover-worth]');total=lambda:panel.locator('[data-worth-total]').inner_text()
 assert total()=='$3.84T/yr',total()
 panel.locator('[data-worth-preset="all-half"]').click();assert total()=='$15.4T/yr'
 assert page.locator('[data-cover-output="reach"]').inner_text()=='100%'
 assert page.locator('[data-cover-output="gain"]').inner_text()=='40%'
 panel.locator('.worth-work>summary').click()
 assert '$8.11T/yr' in panel.locator('.worth-table').inner_text()
 assert '$3.6T/yr' in panel.locator('.worth-table').inner_text()
 assert '$768B/yr' in panel.locator('.worth-table').inner_text()
 assert '$500B/yr' in panel.locator('.worth-table').inner_text()
 panel.locator('[data-worth-preset="all-used"]').click();assert total()=='$30.7T/yr'
 panel.locator('[data-worth-preset="all-half"]').click()
 panel.locator('.worth-prices>summary').click();price=panel.locator('[data-worth-price="daly"]');handle=price.element_handle()
 price.fill('5000');price.press('Enter');assert total()=='$10T/yr'
 assert handle.evaluate('e=>e.isConnected')
 assert panel.locator('.worth-prices').evaluate('e=>e.open')
 price.fill('50000');price.press('Enter');assert total()=='$35.2T/yr'
 price.fill('14500');price.press('Enter');assert total()=='$15.4T/yr'
 assert 'value_daly=14500' in page.url
 # Invalid inputs leave the saved value intact.
 price.fill('-1');price.press('Enter');assert price.input_value()=='14500';assert total()=='$15.4T/yr'
 assert page.evaluate('localStorage.getItem("mta-ledger-v7")') is None
 for width in [320,400,768,1440,1920]:
  page.set_viewport_size({'width':width,'height':1200});page.wait_for_timeout(100)
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
  if width in [400,1440]:panel.screenshot(path=str(OUT/f'valuation-{width}.png'))
 page.set_viewport_size({'width':1440,'height':1200})
 share=page.locator('a[data-cover-model]').first.get_attribute('href')
 page.goto(urljoin(BASE,share));page.wait_for_selector('#graph .node')
 model=page.locator('[data-model-worth]');assert model.locator('[data-worth-total]').inner_text()=='$15.4T/yr'
 state=lambda:page.evaluate("JSON.parse(localStorage.getItem('mta-ledger-v7')).workspace")
 assert state()['macro']['capturePercent']==100 and state()['welfare']['daly']==14500
 page.locator('#undo').click();assert state()['macro']['capturePercent']==25
 assert model.locator('[data-worth-total]').inner_text()=='$3.84T/yr'
 model.locator('.worth-prices>summary').click();f=model.locator('[data-worth-price="daly"]');f.fill('50000');f.press('Enter')
 assert state()['welfare']['daly']==50000
 with page.expect_download() as info:page.locator('#export').click()
 exported=json.loads(pathlib.Path(info.value.path()).read_text(encoding='utf-8'))
 assert exported['version']==20 and exported['workspace']['welfare']['daly']==50000
 legacy=json.loads(json.dumps(exported));legacy['version']=19;del legacy['workspace']['welfare']
 page.locator('#import-file').set_input_files({'name':'legacy_v019.json','mimeType':'application/json','buffer':json.dumps(legacy).encode()})
 page.wait_for_timeout(100);assert state()['welfare']['daly']==14500
 page.locator('#undo').click();assert state()['welfare']['daly']==50000
 page.reload();page.wait_for_selector('#graph .node');assert state()['welfare']['daly']==50000
 page.goto(urljoin(BASE,'essay.html'),wait_until='networkidle')
 assert page.locator('.article-figure img').count()==13
 assert page.locator('#ref-16').count()==1 and page.locator('#ref-15 a').count()==1
 assert '$15.4T' in page.locator('.article-body').inner_text()
 assert 'math_to_atoms_v008_20261115.docx' in page.locator('a[download]').get_attribute('href')
 for width in [320,400,1440]:
  page.set_viewport_size({'width':width,'height':1200});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 assert not errors,errors
 assert not missing,missing
 print(json.dumps({'passed':True,'cases':['3.84T','15.4T','30.7T'],'DALY_sensitivity':True,'alternative_values_not_added':True,'pricing_focus_and_validation':True,'query_handoff_and_undo':True,'export20_import19':True,'old_graph_retained':True,'essay_and_download_updated':True,'phone_desktop_no_overflow':True}))
 b.close()
