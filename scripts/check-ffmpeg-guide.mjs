/* Local animated-documentation checks; no downloads or Windows settings are changed. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=new URL(process.argv[2]||'http://localhost:8801/');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
try{
 for(const [width,theme,reduced] of [[1280,'light',false],[390,'dark',false],[320,'light',true]]){
  const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:reduced?'reduce':'no-preference'}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await context.addInitScript(theme=>localStorage.setItem('ajoy-theme',theme),theme);
  await context.route('**/*',route=>new URL(route.request().url()).origin===base.origin?route.continue():route.abort());
  await page.goto(new URL('tool-audio-exporter.html#ffmpeg-install',base).href);
  const demo=page.locator('.ff-install-demo');await demo.scrollIntoViewIfNeeded();
  assert.equal(await page.locator('[data-ff-install-step]').count(),6);
  assert.equal(await page.locator('[data-ff-install-panel]:visible').count(),1);
  assert.equal(await page.locator('html').getAttribute('data-theme'),theme);
  if(width===1280){
   // Verify a complete unattended loop before testing manual navigation.
   await page.waitForFunction(()=>document.querySelector('.ff-install-demo').hasAttribute('data-playing'));
   for(const phase of [1,2,3,4,5,0])await page.waitForFunction(phase=>document.querySelector('.ff-install-demo').dataset.step===String(phase),phase,{timeout:10000});
   // No timers or animation continue when the walkthrough is offscreen.
   await page.evaluate(()=>scrollTo(0,0));await page.waitForFunction(()=>!document.querySelector('.ff-install-demo').hasAttribute('data-playing'));
   await demo.scrollIntoViewIfNeeded();await page.waitForFunction(()=>document.querySelector('.ff-install-demo').hasAttribute('data-playing'));
  }
  for(let step=0;step<6;step++){
   await page.locator(`[data-ff-install-step="${step}"]`).click();
   await page.waitForFunction(step=>document.querySelector('.ff-install-demo').dataset.step===String(step),step);
   assert.equal(await page.locator('[data-ff-install-panel]:visible').count(),1);
   assert.equal(await page.locator(`[data-ff-install-step="${step}"]`).getAttribute('aria-pressed'),'true');
   await demo.scrollIntoViewIfNeeded();
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no page overflow');
   assert(await page.locator(`[data-ff-install-panel="${step}"]`).evaluate(el=>el.scrollWidth<=el.clientWidth+1&&el.scrollHeight<=el.clientHeight+1),'no dialog overflow');
   const window=page.locator(`[data-ff-install-panel="${step}"] .ff-demo-window`);if(await window.count())assert(await window.evaluate(el=>el.scrollHeight<=el.clientHeight+1),'no clipped dialog controls');
   await demo.screenshot({path:`/tmp/ffmpeg-${width}-${theme}-step${step+1}.png`});
  }
  assert.match(await page.locator('[data-ff-install-panel="5"]').textContent(),/ffmpeg -version/);
  assert.match(await page.locator('#ffmpeg-install .ffmpeg-next').textContent(),/C:\\FFmpeg\\bin/);
  assert(!/C:\\Users\\AJOY/.test(await page.locator('#ffmpeg-install').textContent()),'no personal directory names');
  assert.equal(await demo.getAttribute('data-playing'),null,'manual step stays still for the user to follow');
  if(reduced)assert.equal(await demo.evaluate(el=>el.getAnimations({subtree:true}).length),0);
  assert.deepEqual(errors,[]);await context.close();console.log(`${width}px ${theme}${reduced?' reduced motion':''}: illustrated steps, Path instructions, terminal and navigation passed`);
 }
 const context=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:1000}}),page=await context.newPage();
 await page.goto(new URL('tool-audio-exporter.html#ffmpeg-install',base).href);
 assert.equal(await page.locator('.ff-install-steps li:visible').count(),6);assert.equal(await page.locator('[data-ff-install-panel]:visible').count(),6);
 assert.match(await page.locator('#ffmpeg-install').textContent(),/ffmpeg -version/);
 await context.close();console.log('No JavaScript: all six instructions and illustrated dialogs remain readable');
}finally{await browser.close();}
