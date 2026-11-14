import os,json,pathlib
from urllib.parse import urljoin
from playwright.sync_api import sync_playwright
BASE=os.environ.get('MTA_SITE_URL','http://127.0.0.1:8765/math.to.atoms/').rstrip('/')+'/'
OUT=pathlib.Path(os.environ['TEMP'])/'math-to-atoms-qa-v034';OUT.mkdir(exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='C:/Users/campbell/AppData/Local/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-win64/chrome-headless-shell.exe')
 context=b.new_context(viewport={'width':1440,'height':1100},reduced_motion='reduce');page=context.new_page();errors=[];missing=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('response',lambda r:missing.append(r.url) if r.status>=400 and r.url.startswith(BASE) else None)
 def ready():page.wait_for_selector('[data-cover-controls]:not([disabled])')
 def value(axis):return page.locator(f'[data-cover-charts] [data-live-value="{axis}"]').inner_text()
 def setrange(key,n,commit=True):
  page.locator(f'[data-cover-input="{key}"]').evaluate('(e,v)=>{e.value=v;e.dispatchEvent(new Event("input",{bubbles:true}))}',str(n))
  if commit:page.locator(f'[data-cover-input="{key}"]').dispatch_event('change')
 def curves():return page.locator('[data-cover-charts] .delta-line').evaluate_all('es=>es.map(e=>e.getAttribute("d"))')
 page.goto(BASE,wait_until='networkidle');ready()
 assert page.locator('[data-cover-input]').count()==4;assert page.locator('.snapshot-card').count()==5
 assert value('economy')=='$1.81T/yr';assert value('health')=='140M/yr';assert value('energy')=='5% cheaper'
 assert page.evaluate('localStorage.getItem("mta-ledger-v7")') is None
 before=curves();history=page.locator('[data-cover-charts] .history-line').evaluate_all('es=>es.map(e=>e.getAttribute("d"))')
 domains=page.locator('[data-delta-curve]').evaluate_all('es=>es.map(e=>e.dataset.domainMax)')
 reach=page.locator('[data-cover-input="reach"]');handle=reach.element_handle();reach.focus();setrange('reach',50,False)
 assert value('economy')=='$3.62T/yr';assert all(a!=z for a,z in zip(before,curves()))
 assert page.locator('[data-cover-mini="economy"]').inner_text()=='$3.62T/yr'
 assert page.locator('[data-cover-mini="health"]').inner_text()=='280M/yr'
 assert page.locator('[data-cover-mini="energy"]').inner_text()=='10% cheaper'
 assert domains==page.locator('[data-delta-curve]').evaluate_all('es=>es.map(e=>e.dataset.domainMax)')
 assert history==page.locator('[data-cover-charts] .history-line').evaluate_all('es=>es.map(e=>e.getAttribute("d"))')
 assert handle.evaluate('e=>e.isConnected && document.activeElement===e')
 reach.dispatch_event('change');assert 'case_reach=50' in page.url
 page.locator('#assumptions>summary').click();assert '$50' in page.locator('[data-cover-example]').inner_text();assert '$10' in page.locator('[data-cover-example]').inner_text()
 before=curves();setrange('use',75,False);assert all(a!=z for a,z in zip(before,curves()));assert value('economy')=='$5.43T/yr';page.locator('[data-cover-input="use"]').dispatch_event('change')
 before=curves();setrange('gain',60,False);assert all(a!=z for a,z in zip(before,curves()));page.locator('[data-cover-input="gain"]').dispatch_event('change')
 domains=page.locator('[data-delta-curve]').evaluate_all('es=>es.map(e=>e.dataset.domainMax)');setrange('years',30)
 assert '2056' in page.locator('[data-cover-period]').inner_text();assert domains==page.locator('[data-delta-curve]').evaluate_all('es=>es.map(e=>e.dataset.domainMax)')
 setrange('reach',0)
 assert value('economy')=='$0/yr';assert value('energy')=='0% cheaper';assert value('health')=='0/yr'
 for key in ['reach','use','gain']:setrange(key,100)
 assert value('energy')=='100% cheaper';assert value('time')=='100% shorter';assert 'A ten-year project takes 0 years' in page.locator('[data-cover-explained]').inner_text()
 for years in [1,100]:
  setrange('years',years);assert str(2026+years) in page.locator('[data-cover-period]').inner_text()
 assert not page.locator('[data-cover-charts]').evaluate('e=>/NaN|Infinity/.test(e.innerHTML)')
 page.locator('[data-cover-reset]').click();assert value('economy')=='$1.81T/yr';assert 'case_' not in page.url
 # Keyboard and fractional shared cases remain usable.
 reach.focus();reach.press('ArrowRight');assert float(reach.input_value())>25
 page.goto(BASE+'?case_reach=25.5&case_use=50&case_gain=40&case_years=20');ready();assert float(reach.input_value())==25.5
 assert value('economy')=='$1.85T/yr'
 page.locator('[data-cover-reset]').click()
 for width in [320,400,768,1100,1440,1920]:
  page.set_viewport_size({'width':width,'height':1100});page.evaluate('document.fonts.ready');page.wait_for_timeout(120)
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
  if width>=1100:
   ys=page.locator('.snapshot-card').evaluate_all('es=>es.map(e=>e.getBoundingClientRect().top)');assert max(ys)-min(ys)<1
  if width<=600:assert page.locator('.cover-mobile-results').is_visible()
  if width in [400,1440]:
   page.evaluate('scrollTo(0,0)');page.wait_for_timeout(200);page.screenshot(path=str(OUT/f'cover-{width}.png'),full_page=True)
 # Visiting or moving the cover never overwrites a saved full-model workspace.
 other=context.new_page();other.goto(urljoin(BASE,'model.html'));other.wait_for_selector('#graph .node')
 other.evaluate('''()=>{const a=JSON.parse(localStorage.getItem('mta-ledger-v7'));a.workspace.valuation.gdpTrillion=130;a.workspace.data.problems[0].I=8.2;localStorage.setItem('mta-ledger-v7',JSON.stringify(a))}''')
 saved=page.evaluate('localStorage.getItem("mta-ledger-v7")');setrange('reach',75);setrange('years',30)
 assert page.evaluate('localStorage.getItem("mta-ledger-v7")')==saved
 page.locator('.cover-reading [data-cover-model]').click();page.wait_for_selector('#graph .node')
 state=page.evaluate('JSON.parse(localStorage.getItem("mta-ledger-v7")).workspace')
 assert state['macro']['capturePercent']==75 and state['projection']['horizonYears']==30
 assert state['valuation']['gdpTrillion']==130 and state['data']['problems'][0]['I']==8.2
 assert 'case_' not in page.url
 page.locator('#undo').click();state=page.evaluate('JSON.parse(localStorage.getItem("mta-ledger-v7")).workspace')
 assert state['macro']['capturePercent']==25 and state['projection']['horizonYears']==20
 assert state['valuation']['gdpTrillion']==130
 # References cannot load: the published case and navigation still work.
 fallback=context.new_page();fallback.route('**/math_to_atoms_history_v017.json',lambda r:r.abort())
 fallback.goto(BASE);fallback.wait_for_function('document.querySelector("[data-cover-interactive]").getAttribute("aria-busy")==="false"')
 assert fallback.locator('[data-cover-controls]').evaluate('e=>e.disabled');assert fallback.locator('.snapshot-card').count()==5;assert 'Reload' in fallback.locator('[data-cover-description]').inner_text()
 assert not errors,errors;assert not missing,missing
 print(json.dumps({'passed':True,'four_live_sliders':True,'five_outcomes':True,'fixed_history_and_drag_scales':True,'zero_and_full_cases':True,'keyboard_and_fractional_links':True,'years_1_to_100':True,'saved_model_preserved':True,'handoff_and_undo':True,'fallback':True,'widths':[320,400,768,1100,1440,1920],'errors':errors,'missing':missing}))
 b.close()
