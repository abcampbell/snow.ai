import os,json,pathlib
from playwright.sync_api import sync_playwright
URL=os.environ.get('MTA_TEST_URL','http://127.0.0.1:8765/math.to.atoms/model.html')
OUT=pathlib.Path(os.environ['TEMP'])/'math-to-atoms-qa-v032';OUT.mkdir(exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='C:/Users/campbell/AppData/Local/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-win64/chrome-headless-shell.exe')
 page=b.new_page(viewport={'width':1440,'height':1100});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(URL);page.wait_for_selector('[data-worked-calculation]')
 case=page.locator('[data-worked-id="aviation"]');calc=case.locator('[data-worked-calculation]')
 def slider(key,value):
  f=page.locator(f'#master-outlook input[type=range][data-macro="{key}"]')
  f.evaluate('(e,v)=>{e.value=v;e.dispatchEvent(new Event("input",{bubbles:true}));e.dispatchEvent(new Event("change",{bubbles:true}))}',str(value))
 slider('capturePercent',62)
 page.locator('#master-outlook .projection-assumptions>summary').click()
 adoption=page.locator('#master-outlook input[type=number][data-macro="adoptionPercent"]');adoption.fill('52');adoption.press('Enter')
 assert '$81.2M/yr'==case.locator('[data-worked-value]').inner_text()
 assert calc.locator('tbody tr').count()==5
 assert calc.locator('tbody tr td:last-child').all_text_contents()==['$252B/yr','$25.2B/yr','$15.6B/yr','$8.12B/yr','$81.2M/yr']
 for text in ('$2.52B/yr','3.22%','10% of the fuel bill is assumed eligible','extra savings from better math are unmeasured'):assert text in calc.inner_text(),text
 assert not case.locator('[data-worked-details]').evaluate('e=>e.open')
 # Inputs update the arithmetic while preserving the active field and its focus.
 case.locator('[data-worked-details]>summary').click()
 f=case.locator('[data-worked-field="eligiblePercent"]');handle=f.element_handle();f.fill('100');f.press('Enter')
 assert '$812M/yr' in calc.inner_text();assert '32.2%' in calc.inner_text();assert handle.evaluate('e=>e.isConnected')
 page.locator('#undo').click();assert '$81.2M/yr'==case.locator('[data-worked-value]').inner_text()
 case.locator('[data-worked-improvement="2"]').click();assert '$162M/yr'==case.locator('[data-worked-value]').inner_text();assert '$5.04B/yr' in calc.inner_text()
 page.locator('#undo').click()
 # Live dragging updates the caption, trace and headline before persistence.
 s=page.locator('#master-outlook input[type=range][data-macro="capturePercent"]')
 s.evaluate('e=>{e.value=80;e.dispatchEvent(new Event("input",{bubbles:true}))}')
 assert '$105M/yr'==case.locator('[data-worked-value]').inner_text();assert '80% reached' in case.locator('.worked-caption').inner_text();assert '$105M/yr' in calc.inner_text()
 s.dispatch_event('change');page.locator('#undo').click();page.reload();page.wait_for_selector('[data-worked-calculation]');assert '$81.2M/yr'==case.locator('[data-worked-value]').inner_text()
 assert page.locator('[data-worked-calculation]').count()==3
 for width in (320,400,768,1100,1440,1920):
  page.set_viewport_size({'width':width,'height':1100})
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
  if width in (400,1440):
   page.evaluate('document.fonts.ready');case.scroll_into_view_if_needed();page.wait_for_timeout(350)
   case.screenshot(path=str(OUT/f'aviation-{width}.png'))
 assert not errors,errors
 print(json.dumps({'passed':True,'screenshot_81_2M_traced':True,'live_inputs_preserve_focus':True,'live_slider_trace':True,'all_three_examples':True,'mobile_layout':True,'errors':errors}))
 b.close()
