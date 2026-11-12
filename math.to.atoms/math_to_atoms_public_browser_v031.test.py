import os,json,pathlib
from playwright.sync_api import sync_playwright
URL=os.environ.get('MTA_TEST_URL','http://127.0.0.1:8765/math.to.atoms/model.html')
OUT=pathlib.Path(os.environ['TEMP'])/'math-to-atoms-qa-v031';OUT.mkdir(exist_ok=True)
def state(page):return page.evaluate("JSON.parse(localStorage.getItem('mta-ledger-v7')).workspace")
def number(page,selector,value):
 f=page.locator(selector);f.fill(str(value));f.press('Enter')
def main(page,axis):return page.locator(f'#master-outlook [data-live-value="{axis}"]').inner_text()
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='C:/Users/campbell/AppData/Local/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-win64/chrome-headless-shell.exe')
 page=b.new_page(viewport={'width':1440,'height':1100},accept_downloads=True);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(URL);page.wait_for_selector('#graph .node');page.locator('[data-live-window="impact"]').click();page.wait_for_selector('[data-benefit-curve]')
 assert '$1.81T/yr'==main(page,'economy');assert '140M/yr'==main(page,'health');assert '5% shorter'==main(page,'time')
 assert page.locator('#master-outlook [data-benefit-curve]').count()==5
 assert page.locator('#master-outlook .evidence-tag.assumption:visible').count()==5
 assert 'separate assumptions' in page.locator('.model-boundary').inner_text()
 assert page.locator('#worked-paths .worked-case').count()==3
 case=lambda id:page.locator(f'[data-worked-id="{id}"]')
 assert '$31.5M/yr' in case('aviation').locator('[data-worked-value]').inner_text()
 assert '$108M/yr' in case('ammonia').locator('[data-worked-value]').inner_text()
 assert '$125k/yr' in case('maintenance').locator('[data-worked-value]').inner_text()
 paths=lambda:page.locator('#master-outlook .outlook-scenario').evaluate_all('es=>es.map(e=>e.getAttribute("d"))')
 before=paths();domains=page.locator('[data-benefit-curve]').evaluate_all('es=>es.map(e=>[e.dataset.domainMin,e.dataset.domainMax])')
 slider=page.locator('#master-outlook input[type=range][data-macro="capturePercent"]')
 slider.evaluate("e=>{e.value='80';e.dispatchEvent(new Event('input',{bubbles:true}))}")
 assert all(a!=z for a,z in zip(before,paths()))
 assert state(page)['macro']['capturePercent']==25
 assert page.locator('[data-benefit-curve]').evaluate_all('es=>es.map(e=>[e.dataset.domainMin,e.dataset.domainMax])')==domains
 assert '$101M/yr' in case('aviation').locator('[data-worked-value]').inner_text()
 slider.dispatch_event('change');page.locator('#undo').click();assert main(page,'economy')=='$1.81T/yr'
 # GDP and life expectancy remain historical context, not benefit projections.
 page.locator('[data-live-window="full"]').click()
 for axis in ('economy','health'):
  card=page.locator(f'#master-outlook [data-master-axis="{axis}"]')
  assert card.locator('.outlook-scenario').count()==0
  assert card.locator(':scope > .live-history[data-range-start="1900"]').count()==1
 assert page.locator('#master-outlook .energy-history-line').get_attribute('data-observations')=='126'
 assert 'US output/hour' in page.locator('#master-outlook [data-master-axis="time"]').inner_text()
 page.locator('[data-live-window="impact"]').click()
 # Net and cumulative quantities use the same units and common horizon.
 econ=page.locator('#master-outlook [data-master-axis="economy"]')
 econ.locator('[data-live-details]>summary').click();assert '$18.1T resources freed' in econ.inner_text()
 number(page,'#master-outlook input[type=number][data-projection="horizonYears"]',10)
 assert '$9.06T resources freed' in econ.inner_text();assert main(page,'economy')=='$1.81T/yr'
 page.locator('#undo').click();econ.locator('[data-live-details]>summary').click()
 # Presets and cost edits affect their case, not the aggregate or the graph scores.
 case('aviation').locator('[data-worked-improvement="2"]').click()
 assert '$63M/yr' in case('aviation').locator('[data-worked-value]').inner_text();assert main(page,'economy')=='$1.81T/yr'
 page.locator('#undo').click()
 case('aviation').locator('[data-worked-details]>summary').click()
 f=case('aviation').locator('[data-worked-field="annualCost"]');handle=f.element_handle();f.fill('10');f.press('Enter')
 assert state(page)['worked']['aviation']['annualCost']==10e6
 assert handle.evaluate('e=>e.isConnected')
 assert '$21.5M/yr' in case('aviation').locator('[data-worked-net]').inner_text()
 assert case('aviation').locator('[data-worked-details]').evaluate('e=>e.open')
 # The graph's actual links gate each worked path; the ladder is not a dollar multiplier.
 case('aviation').locator('[data-select-type="math"]').click()
 panel=page.locator('#quick-editor');panel.locator('.node-editing>summary').click()
 edge=panel.locator('[data-edge-type="math"][data-problem="4"]');edge.select_option('0')
 assert case('aviation').locator('[data-worked-value]').inner_text()=='Path disconnected'
 assert main(page,'economy')=='$1.81T/yr'
 panel.locator('[data-close-quick]').click();page.locator('#undo').click()
 assert '$31.5M/yr' in case('aviation').locator('[data-worked-value]').inner_text()
 # JSON exports include the examples; old v018 exports load with defaults.
 with page.expect_download() as info:page.locator('#export').click()
 exported=json.loads(pathlib.Path(info.value.path()).read_text(encoding='utf-8'))
 assert exported['version']==19;assert exported['workspace']['worked']['aviation']['annualCost']==10e6
 legacy=json.loads(json.dumps(exported));legacy['version']=18;del legacy['workspace']['worked'];legacy['workspace']['macro']['capturePercent']=15
 page.locator('#import-file').set_input_files({'name':'legacy_v018.json','mimeType':'application/json','buffer':json.dumps(legacy).encode()})
 page.wait_for_timeout(150);assert state(page)['macro']['capturePercent']==15;assert state(page)['worked']['aviation']['annualCost'] is None
 page.locator('#undo').click();assert state(page)['worked']['aviation']['annualCost']==10e6
 page.reload();page.wait_for_selector('[data-delta-curve]');assert state(page)['worked']['aviation']['annualCost']==10e6
 # No narrow-layout overflow; five cards still share a desktop row.
 for width in (320,400,768,1100,1440,1920):
  page.set_viewport_size({'width':width,'height':1100});page.wait_for_timeout(180)
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
  if width>=1100:
   ys=page.locator('#master-outlook .live-chart').evaluate_all('es=>es.map(e=>e.getBoundingClientRect().top)');assert max(ys)-min(ys)<1
  if width in (400,1440):
   page.evaluate('scrollTo(0,0)');page.screenshot(path=str(OUT/f'public-top-{width}.png'))
   page.locator('#worked-paths').screenshot(path=str(OUT/f'worked-{width}.png'))
 assert page.locator('#graph .node').count()==88;assert not errors,errors
 print(json.dumps({'passed':True,'headline_units':True,'GDP_and_lifespan_context_only':True,'live_dragging':True,'three_graph_linked_examples':True,'costs_and_presets':True,'export_v019_import_v018':True,'widths':[320,400,768,1100,1440,1920],'errors':errors}))
 b.close()
