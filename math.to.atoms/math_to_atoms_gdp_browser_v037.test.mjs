import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.MTA_PLAYWRIGHT_PACKAGE||'C:/Users/campbell/AppData/Local/hermes/hermes-agent/venv/Lib/site-packages/playwright/driver/package');
const base=process.env.MTA_SITE_URL||'http://127.0.0.1:8765/math.to.atoms/';
const out=path.join(process.env.TEMP,'math-to-atoms-qa-v037');fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'C:/Users/campbell/AppData/Local/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-win64/chrome-headless-shell.exe'});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1100},reducedMotion:'reduce',acceptDownloads:true});
 const errors=[],missing=[];page.on('pageerror',e=>errors.push(String(e)));page.on('response',r=>{if(r.status()>=400&&r.url().startsWith(base))missing.push(r.url());});
 await page.goto(base,{waitUntil:'networkidle'});await page.waitForSelector('[data-cover-controls]:not([disabled])');
 const panel=page.locator('[data-cover-gdp-paths]'),worth=page.locator('[data-cover-worth]');
 assert.equal(await panel.locator('[data-gdp-percent]').innerText(),'+0.75% above the current trend in 2046');
 assert.equal(await worth.locator('[data-worth-total]').innerText(),'$3.84T/yr');
 assert.equal(await page.locator('[data-cover-charts] [data-master-axis="economy"] .outlook-scenario').count(),1);
 assert.ok(await page.evaluate(()=>document.querySelector('[data-cover-worth]').compareDocumentPosition(document.querySelector('[data-cover-charts]'))&Node.DOCUMENT_POSITION_PRECEDING));
 const curve=()=>panel.locator('.gdp-plot-wide [data-gdp-with]').getAttribute('d');
 const before=await curve();
 const range=page.locator('[data-cover-input="reach"]'),handle=await range.elementHandle();await range.focus();
 await range.evaluate(e=>{e.value='100';e.dispatchEvent(new Event('input',{bubbles:true}));});
 assert.equal(await panel.locator('[data-gdp-percent]').innerText(),'+3% above the current trend in 2046');
 assert.notEqual(await curve(),before);assert.ok(await handle.evaluate(e=>e.isConnected&&document.activeElement===e));await range.dispatchEvent('change');
 assert.equal(await worth.locator('[data-worth-total]').innerText(),'$15.4T/yr');
 await panel.locator('[data-gdp-window="future"]').click();assert.ok((await panel.locator('.gdp-path-unit').innerText()).includes('vertical axis starts above zero'));
 assert.equal(await panel.locator('.gdp-plot-wide svg').getAttribute('data-gdp-view'),'future');
 await worth.locator('.worth-prices>summary').click();let capital=worth.locator('[data-worth-price="capital"]');await capital.fill('2');await capital.press('Enter');
 assert.equal(await panel.locator('[data-gdp-percent]').innerText(),'+4% above the current trend in 2046');
 await panel.locator('details>summary').click();await page.waitForFunction(()=>document.querySelector('[data-cover-gdp-paths] details').open);await capital.fill('1.5');await capital.press('Enter');assert.ok(await panel.locator('details').evaluate(e=>e.open),'GDP calculation stays open');
 for(const years of [1,20,50,100]){
  await page.locator('[data-cover-input="years"]').evaluate((e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));},String(years));
  assert.equal(await panel.locator('.gdp-plot-wide svg').getAttribute('data-end-year'),String(2026+years));
  const frames=await page.locator('[data-cover-charts] svg[data-period-end]').evaluateAll(es=>es.map(s=>({end:s.dataset.periodEnd,guide:s.querySelector('[data-chart-end]')?.dataset.chartEnd,ends:[...s.querySelectorAll('.outlook-baseline,.outlook-scenario,.delta-line')].map(p=>p.getPointAtLength(p.getTotalLength()).x)})));
  assert.equal(frames.length,10);for(const f of frames){assert.equal(f.end,String(2026+years));assert.equal(f.guide,f.end);for(const x of f.ends)assert.ok(Math.abs(x-308)<.01);}
  for(const css of ['.gdp-plot-wide','.gdp-plot-narrow']){
   const endpoints=await panel.locator(css+' svg').evaluate(s=>[...s.querySelectorAll('[data-gdp-baseline],[data-gdp-with]')].map(p=>p.getPointAtLength(p.getTotalLength()).x));
   assert.ok(Math.abs(endpoints[0]-endpoints[1])<.01);
  }
 }
 await page.locator('[data-cover-reset]').click();
 for(const width of [320,400,768,1100,1440,1920]){
  await page.setViewportSize({width,height:1100});await page.evaluate(()=>document.fonts.ready);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),String(width));
  if([400,1440].includes(width)){await panel.screenshot({path:path.join(out,`gdp-${width}.png`)});await page.locator('.published-case').screenshot({path:path.join(out,`case-${width}.png`)});}
 }
 // Zero scenario converges with baseline. Health pricing cannot change GDP.
 await range.evaluate(e=>{e.value='0';e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));});
 assert.equal(await panel.locator('.gdp-plot-wide [data-gdp-baseline]').getAttribute('d'),await curve());
 await page.locator('[data-cover-reset]').click();
 const link=await page.locator('a[data-cover-model]').first().getAttribute('href');await page.goto(link);await page.waitForSelector('#graph .node');
 const model=page.locator('[data-model-gdp-paths]');
 assert.equal(await model.locator('[data-gdp-percent]').innerText(),'+0.75% above the current trend in 2046');
 assert.ok(await page.evaluate(()=>document.querySelector('[data-model-worth]').compareDocumentPosition(document.querySelector('[data-master-cards]'))&Node.DOCUMENT_POSITION_PRECEDING));
 await page.locator('[data-model-worth] [data-worth-preset="all-half"]').click();assert.equal(await model.locator('[data-gdp-percent]').innerText(),'+3% above the current trend in 2046');
 await page.locator('#undo').click();assert.equal(await model.locator('[data-gdp-percent]').innerText(),'+0.75% above the current trend in 2046');
 assert.equal(await page.locator('#graph .node').count(),88);
 for(const width of [320,400,1440]){await page.setViewportSize({width,height:1100});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
 console.log(JSON.stringify({passed:true,twoGDPPaths:true,liveSliders:true,chartsAboveValuation:true,capitalResponse:true,zeroConvergence:true,years:[1,20,50,100],mobileAndDesktop:true,fullModelAndUndo:true,errors,missing}));
}finally{await browser.close();}
