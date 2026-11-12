import os,json,pathlib
from playwright.sync_api import sync_playwright
URL=os.environ.get('MTA_TEST_URL','http://127.0.0.1:8765/math_to_atoms_ledger_v029.html')
OUT=pathlib.Path(os.environ['TEMP'])/'math-to-atoms-qa-v029';OUT.mkdir(exist_ok=True)
def stored(page):return page.evaluate("JSON.parse(localStorage.getItem('mta-ledger-v7')).workspace")
def node(page,id):
 if page.locator('#quick-editor').is_visible():page.locator('[data-close-quick]').click()
 page.locator(f'#graph [data-id="{id}"]').click()
with sync_playwright()as p:
 b=p.chromium.launch(headless=True,executable_path='C:/Users/campbell/AppData/Local/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-win64/chrome-headless-shell.exe')
 page=b.new_page(viewport={'width':1440,'height':1100},accept_downloads=True);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(URL);page.wait_for_selector('#graph .node');assert page.locator('#graph .node').count()==88
 node(page,'B15');panel=page.locator('#quick-editor')
 assert panel.locator('h2').inner_text()=='Finding causes in messy data'
 assert 'started healthier' in panel.locator('.node-example').inner_text()
 assert 'cannot settle the question' in panel.locator('.node-intro').inner_text()
 assert not panel.locator('[data-quick-score-field]').first.is_visible()
 assert not panel.locator('select[data-edge-type]').first.is_visible()
 assert panel.locator('.payoff-readout').count()==0
 assert 'No active payoff cases' not in panel.inner_text()
 assert 'ladder' not in panel.inner_text().lower()
 assert panel.locator('.node-application:visible').count()==3
 assert panel.locator('.node-application[data-select-id="46"]').is_visible()
 assert 'unmeasured differences' in panel.locator('.node-application[data-select-id="46"]').inner_text()
 panel.screenshot(path=str(OUT/'causal-desktop.png'))
 panel.locator('.node-technical>summary').click()
 assert 'Confounding' in panel.locator('.node-technical').inner_text()
 assert 'nonresponse' in panel.locator('.node-technical').inner_text().lower()
 assert panel.locator('.node-definition-sources a').count()==2
 panel.locator('.node-technical>summary').click()
 # Controls remain one disclosure away and preserve focus/undo.
 panel.locator('.node-editing>summary').click()
 f=panel.locator('[data-quick-score-field="diff"]');f.fill('6');f.press('Enter')
 assert stored(page)['data']['math'][14]['diff']==6
 assert panel.locator('.node-editing').evaluate('el=>el.open')
 edge=panel.locator('[data-edge-type="math"][data-problem="7"]');edge.select_option('3')
 assert stored(page)['data']['math'][14]['links']['7']==3
 assert panel.locator('.node-editing').evaluate('el=>el.open')
 panel.locator('[data-quick-undo]').click();assert stored(page)['data']['math'][14]['links']['7']==1
 # Same-node re-open starts at the explanation, not an old scrolled form.
 node(page,'B15')
 assert not panel.locator('.node-editing').evaluate('el=>el.open')
 assert panel.locator('.quick-editor-body').evaluate('el=>el.scrollTop')==0
 panel.locator('.node-application[data-select-id="46"]').click()
 assert panel.locator('h2').inner_text()=='Setting safer pollution limits'
 assert 'income, smoking or job conditions' in panel.locator('.node-example').inner_text()
 assert panel.locator('.node-application').count()>=1
 # All 88 nodes explain themselves and technical controls start closed.
 ids=page.locator('#graph .node').evaluate_all('els=>els.map(el=>el.dataset.id)')
 for id in ids:
  node(page,id)
  assert panel.locator('.node-meaning').inner_text().strip(),id
  assert panel.locator('.node-example p').inner_text().strip(),id
  assert not panel.locator('.node-editing').evaluate('el=>el.open'),id
 # Financial edits remain live, including the read-only result above the controls.
 node(page,'a1');panel.locator('.node-editing>summary').click()
 f=panel.locator('[data-payoff-id="O2"][data-payoff-field="adoptionPercent"]');f.fill('50');f.press('Enter')
 assert '$600B/yr' in panel.locator('[data-node-benefit]').inner_text()
 assert '$600B/yr' in page.locator('#graph [data-id="O2"] .outcome-value').text_content()
 node(page,'O2');panel.locator('.node-editing>summary').click()
 f=panel.locator('[data-value-path="markets.O2.priceCutPercent"]');f.fill('20');f.press('Enter')
 assert '$2.4T/yr' in panel.locator('.node-current-result').inner_text()
 # Full details preserve original editable names and include the explanation.
 node(page,'B15');panel.locator('[data-full-details]').click()
 assert page.locator('#inspector .node-meaning').is_visible()
 original='Causal and selection inference (confounding bounds, nonresponse)'
 assert page.locator('#node-name').input_value()==original
 page.locator('#node-name').fill('My causal question');page.locator('#node-form button[type=submit]').click()
 node(page,'B15');assert panel.locator('h2').inner_text()=='My causal question'
 assert 'started healthier' in panel.locator('.node-example').inner_text()
 # Rank expansion explains the application first; its score and link edits are collapsed too.
 panel.locator('[data-close-quick]').click();page.locator('.advanced-panel>summary').click();page.locator('#search').fill('Exposure limits')
 page.locator('[data-expand-math="46"]').click()
 inline=page.locator('#top-math-46');assert inline.locator('.node-meaning').is_visible()
 assert not inline.locator('[data-quick-score-field]').first.is_visible()
 assert inline.locator('.top-math-link').count()<=3
 inline.locator('.inline-editing>summary').click();assert inline.locator('[data-quick-score-field]').first.is_visible()
 # Save/export/reload keep the scoring model and user names, not curated titles.
 with page.expect_download()as d:page.locator('#export').click()
 exported=json.loads(pathlib.Path(d.value.path()).read_text(encoding='utf-8'))
 assert exported['version']==19
 assert exported['workspace']['data']['math'][14]['name']=='My causal question'
 assert exported['workspace']['data']['math'][14]['diff']==6
 page.reload();page.wait_for_selector('#graph .node')
 for width in (320,400,768,1440):
  page.set_viewport_size({'width':width,'height':1100});page.wait_for_timeout(200)
  node(page,'B15');assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
  assert panel.locator('.node-meaning').is_visible()
  if width==400:panel.screenshot(path=str(OUT/'causal-phone.png'))
  panel.locator('.node-editing>summary').click()
  assert panel.locator('[data-quick-score-field="diff"]').is_visible()
 assert not errors,errors
 print(json.dumps({'passed':True,'nodes_explained':88,'editor_preserved':True,'payoffs_live':True,'custom_names_preserved':True,'widths':[320,400,768,1440],'errors':errors}))
 b.close()
