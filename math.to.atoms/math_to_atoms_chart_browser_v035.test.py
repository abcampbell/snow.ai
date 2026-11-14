import os,json,pathlib
from urllib.parse import urljoin
from playwright.sync_api import sync_playwright
BASE=os.environ.get('MTA_SITE_URL','http://127.0.0.1:8765/math.to.atoms/').rstrip('/')+'/'
OUT=pathlib.Path(os.environ['TEMP'])/'math-to-atoms-qa-v035';OUT.mkdir(exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='C:/Users/campbell/AppData/Local/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-win64/chrome-headless-shell.exe')
 page=b.new_page(viewport={'width':1440,'height':1200},reduced_motion='reduce');errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 def coverready():page.wait_for_selector('[data-cover-controls]:not([disabled])')
 def setrange(key,n):page.locator(f'[data-cover-input="{key}"]').evaluate('(e,v)=>{e.value=v;e.dispatchEvent(new Event("input",{bubbles:true}));e.dispatchEvent(new Event("change",{bubbles:true}))}',str(n))
 def geometry(root,year,rows=False):
  cards=page.locator(root+' [data-master-axis]').evaluate_all('''es=>es.map(e=>{
   const svgs=[...e.querySelectorAll(':scope > .live-history svg,:scope > .energy-curve svg,:scope > .live-delta svg')];
   return {axis:e.dataset.masterAxis,plots:svgs.map(s=>{
    const g=s.querySelector('[data-chart-end]'),m=s.getScreenCTM(),end=new DOMPoint(308,0).matrixTransform(m);
    const curves=[...s.querySelectorAll('.outlook-baseline,.outlook-scenario,.delta-line')].map(p=>({cls:p.getAttribute('class'),x:p.getPointAtLength(p.getTotalLength()).matrixTransform(m).x}));
    const box=s.getBoundingClientRect();return {width:box.width,y:box.y,end:end.x,guide:g?.dataset.chartEnd,period:s.dataset.periodEnd,curves};
   })};
  })''')
  assert len(cards)==5,cards
  for c in cards:
   assert len(c['plots'])==2,c
   a,z=c['plots'];assert abs(a['width']-z['width'])<.2,c
   assert abs(a['end']-z['end'])<.2,c
   for plot in c['plots']:
    assert plot['guide']==str(year) and plot['period']==str(year),c
    for line in plot['curves']:assert abs(line['x']-plot['end'])<.3,(c,line)
  if rows:
   for i in [0,1]:
    widths=[c['plots'][i]['width'] for c in cards];ys=[c['plots'][i]['y'] for c in cards]
    assert max(widths)-min(widths)<1,widths
    assert max(ys)-min(ys)<1,ys
 page.goto(BASE,wait_until='networkidle');coverready()
 assert page.locator('[data-cover-charts] [data-master-axis="economy"] h3').inner_text()=='Gross savings'
 assert 'extra GDP not estimated' in page.locator('[data-cover-charts] [data-master-axis="economy"] .live-compare').inner_text()
 for years in [1,20,50,100]:setrange('years',years);geometry('[data-cover-charts]',2026+years,True)
 page.locator('[data-cover-reset]').click()
 page.locator('#gdp-explanation>summary').click();gdp=page.locator('[data-cover-gdp]')
 assert gdp.locator('tbody tr').count()==4
 for text in ['$12T/yr','$24T/yr','$224B/yr','$600B/yr','$1.2T/yr','$11.2B/yr','$2.4T','Extra GDP has not been estimated']:assert text in gdp.inner_text(),text
 setrange('reach',50);assert '$3.62T/yr' in gdp.inner_text();assert gdp.is_visible();assert 'shared costs across suppliers' in gdp.inner_text()
 page.locator('[data-cover-reset]').click();page.locator('#gdp-explanation>summary').click()
 for width in [320,400,768,1100,1440,1920]:
  page.set_viewport_size({'width':width,'height':1200});page.evaluate('document.fonts.ready');page.wait_for_timeout(100)
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
  geometry('[data-cover-charts]',2046,width>=1100)
  if width in [400,1440]:
   page.locator('[data-cover-charts]').scroll_into_view_if_needed();page.wait_for_timeout(200);page.locator('[data-cover-charts]').screenshot(path=str(OUT/f'charts-{width}.png'))
 page.set_viewport_size({'width':400,'height':1200});page.locator('#gdp-explanation>summary').click();page.locator('[data-cover-gdp]').scroll_into_view_if_needed();page.wait_for_timeout(200)
 assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 page.locator('[data-cover-gdp]').screenshot(path=str(OUT/'gdp-400.png'));page.locator('#gdp-explanation>summary').click()
 # Check the exact same framing and accounting in the full model.
 page.set_viewport_size({'width':1440,'height':1200});page.goto(urljoin(BASE,'model.html'));page.wait_for_selector('#graph .node')
 geometry('#master-outlook',2046,True)
 horizon=page.locator('#master-outlook input[type=number][data-projection="horizonYears"]');horizon.fill('50');horizon.press('Enter');geometry('#master-outlook',2076,True)
 economy=page.locator('#master-outlook [data-master-axis="economy"]');economy.locator('[data-live-details]>summary').click();assert '$600B/yr' in economy.locator('.gdp-explanation').inner_text()
 assert not errors,errors
 print(json.dumps({'passed':True,'line_endpoints_match_dates':True,'aligned_plot_widths_and_rows':True,'years':[1,20,50,100],'phone_tablet_desktop':True,'live_GDP_breakdown':True,'shared_full_model_fix':True,'errors':errors}))
 b.close()
