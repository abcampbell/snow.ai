import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/campbell/AppData/Local/hermes/hermes-agent/venv/Lib/site-packages/playwright/driver/package');
const base=process.env.MTA_SITE_URL||'http://127.0.0.1:8765/math.to.atoms/',out=path.join(process.env.TEMP,'math-to-atoms-qa-v043');fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'C:/Users/campbell/AppData/Local/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-win64/chrome-headless-shell.exe'});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1100},acceptDownloads:true,reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 const old=await browser.newPage();await old.goto(base+'?case_reach=100&case_use=100&case_gain=100&case_years=20');await old.waitForSelector('[data-cover-controls]:not([disabled])');assert.equal(await old.locator('[data-cover-input=gain]').inputValue(),'80');assert.ok(old.url().includes('case_gain=80'));await old.close();
 await page.goto(base,{waitUntil:'networkidle'});await page.waitForSelector('[data-cover-controls]:not([disabled])');
 const text=axis=>page.locator(`[data-cover-charts] [data-live-value="${axis}"]`).innerText();
 assert.equal(await text('economy'),'$1.81T/yr');assert.equal(await page.locator('[data-worth-total]').innerText(),'$3.84T/yr');
 const range=async(k,v)=>page.locator(`[data-cover-input="${k}"]`).evaluate((e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));},String(v));
 for(const k of ['reach','use','gain'])await range(k,100);
 assert.equal(await page.locator('[data-cover-input=gain]').getAttribute('max'),'80');assert.equal(await page.locator('[data-cover-input=gain]').inputValue(),'80');
 assert.equal(await text('energy'),'80% cheaper');assert.equal(await text('time'),'80% shorter');assert.equal(await text('economy'),'$29T/yr');
 assert.ok((await page.locator('[data-energy-floor-note]').innerText()).includes('$2.4T/yr'));assert.ok((await page.locator('[data-master-axis="time"] .live-compare').innerText()).includes('10 → 2 years'));
 assert.equal(await page.locator('[data-gdp-percent]').innerText(),'+12% above the current trend in 2046');
 await page.locator('[data-cover-minimums]>summary').click();const floor=page.locator('[data-minimum="energyCostFloorPercent"]');await floor.fill('35');await floor.press('Enter');assert.equal(await text('energy'),'65% cheaper');
 assert.equal(await text('time'),'65% shorter');assert.equal(await page.locator('[data-cover-input=gain]').inputValue(),'65');await floor.fill('0');await floor.press('Enter');assert.equal(await floor.inputValue(),'35');
 await floor.fill('100');await floor.press('Enter');assert.equal(await page.locator('[data-cover-input=gain]').inputValue(),'0');assert.ok(await page.locator('[data-cover-input=gain]').isDisabled());assert.equal(await text('economy'),'$0/yr');assert.ok(!(await page.content()).includes('--fill: NaN'));await floor.fill('35');await floor.press('Enter');await range('gain',65);
 const share=await page.locator('a[data-cover-model]').first().getAttribute('href');assert.ok(share.includes('limit_energyCostFloorPercent=35'));
 for(const width of [320,400,768,1440,1920]){await page.setViewportSize({width,height:1100});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));if([400,1440].includes(width))await page.locator('[data-cover-charts]').screenshot({path:path.join(out,`bounded-charts-${width}.png`)});}
 await page.goto(share);await page.waitForSelector('#graph .node');
 const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('mta-ledger-v7')).workspace);
 assert.equal((await state()).macro.energyCostFloorPercent,35);assert.equal(await page.locator('#master-outlook [data-live-value="energy"]').innerText(),'65% cheaper');
 await page.locator('#undo').click();assert.equal((await state()).macro.energyCostFloorPercent,20);assert.equal((await state()).macro.capturePercent,25);
 await page.locator('[data-model-minimums]>summary').click();const modelFloor=page.locator('[data-model-minimums] [data-macro="deliveryTimeFloorPercent"]');await modelFloor.fill('40');await modelFloor.press('Enter');
 assert.equal((await state()).macro.deliveryTimeFloorPercent,40);await page.locator('#undo').click();assert.equal((await state()).macro.deliveryTimeFloorPercent,20);
 const downloadPromise=page.waitForEvent('download');await page.locator('#export').click();const download=await downloadPromise,exported=JSON.parse(fs.readFileSync(await download.path(),'utf8'));assert.equal(exported.version,21);
 const legacy=structuredClone(exported);legacy.version=20;for(const k of ['energyCostFloorPercent','productionCostFloorPercent','deliveryTimeFloorPercent'])delete legacy.workspace.macro[k];Object.assign(legacy.workspace.macro,{capturePercent:100,adoptionPercent:100,localGainPercent:100});
 await page.locator('#import-file').setInputFiles({name:'old-v20.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(legacy))});
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('mta-ledger-v7')).workspace.macro.capturePercent===100);
 assert.equal(await page.locator('#master-outlook [data-live-value="energy"]').innerText(),'80% cheaper');assert.equal(await page.locator('#master-outlook [data-live-value="time"]').innerText(),'80% shorter');
 for(const view of ['impact','full','recent']){await page.locator(`[data-live-window="${view}"]`).click();assert.ok(!(await page.locator('#master-outlook').innerHTML()).includes('NaN'));}
 await page.reload();await page.waitForSelector('#graph .node');assert.equal((await state()).macro.energyCostFloorPercent,20);
 assert.equal(await page.locator('#graph .node').count(),88);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({passed:true,defaultCaseUnchanged:true,boundedSummarySlider:true,legacyURLNormalized:true,zeroGainRangeSafe:true,fullReachRetainsCostsAndTime:true,liveFloors:true,invalidZeroRejected:true,sharedLimitsAndUndo:true,legacy20Migration:true,export21:true,allChartViewsFinite:true,phoneDesktop:true,errors}));
}finally{await browser.close();}
