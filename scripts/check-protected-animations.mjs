/* Browser regression check for the two animations the user asked to preserve.
   Run against a local static server; external service requests are blocked. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
let chromium;
try{({chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'));}
catch{throw new Error('Playwright is required. Install playwright or set PLAYWRIGHT_MODULE to an existing installation.');}
const base=new URL(process.argv[2]||'http://127.0.0.1:8793/');
const browser=await chromium.launch({
 executablePath:process.env.CHROMIUM_PATH||undefined,
 args:typeof process.getuid==='function'&&process.getuid()===0?['--no-sandbox']:[]
});
async function open(width,mode='normal'){
 const context=await browser.newContext({viewport:{width,height:900},javaScriptEnabled:mode!=='no-js',reducedMotion:mode==='reduce'?'reduce':'no-preference'});
 await context.route('**/*',route=>new URL(route.request().url()).origin===base.origin?route.continue():route.abort());
 const page=await context.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto(base.href);
 return {context,page,errors};
}
async function visibleTools(page){
 const rows=page.locator('#tools .tl li');
 assert.equal(await rows.count(),13,'Every tool must remain in its category.');
 assert(await rows.evaluateAll(elements=>elements.every(row=>
  Number(getComputedStyle(row).opacity)>=.5&&getComputedStyle(row.closest('.tile')).opacity==='1'&&
  row.getBoundingClientRect().height>20&&row.querySelector('.ic')&&
  row.querySelector('.tl-link')?.textContent.trim()&&row.querySelector('div>span')?.textContent.trim()
 )),'Tool icons, names and descriptions must remain visible, even without scripts.');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'No horizontal overflow.');
}
async function moveTo(page,selector){
 await page.locator(selector).evaluate(element=>element.scrollIntoView({behavior:'instant',block:'start'}));
}
try{
 for(const width of [1280,390]){
  const {context,page,errors}=await open(width);
  await moveTo(page,'#tools');
  await page.waitForFunction(()=>document.getAnimations().some(animation=>animation.id==='tool-row-entry'));
  await visibleTools(page);
  await page.waitForFunction(()=>!document.getAnimations().some(animation=>animation.id==='tool-row-entry'));
  await page.waitForFunction(()=>document.querySelector('#tools .tile').hasAttribute('data-tool-active'));
  assert.equal(await page.locator('#tools .ic').first().evaluate(element=>getComputedStyle(element).animationPlayState),'running');
  await page.locator('#tools .tl-link').first().focus();
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('#tools .tl li>div')).transform!=='none');
  await page.evaluate(()=>document.activeElement.blur());

  await moveTo(page,'#stage-install');
  // The illustration is fully visible when centered, including on narrow screens.
  await page.locator('#stage-install').evaluate(element=>element.scrollIntoView({behavior:'instant',block:'center'}));
  await page.waitForFunction(()=>!document.querySelector('#stage-install').hasAttribute('data-install-paused'));
  await page.waitForFunction(()=>document.querySelector('#stage-install').dataset.step==='1');
  await page.waitForFunction(()=>document.querySelector('#stage-install').dataset.step==='2');
  await page.waitForFunction(()=>{const length=document.querySelector('#code').textContent.length;return length>0&&length<16;});
  assert.notEqual(await page.locator('.caret').evaluate(element=>getComputedStyle(element).animationName),'none');
  await page.waitForFunction(()=>document.querySelector('#stage-install').dataset.step==='3');
  await page.waitForFunction(()=>document.querySelector('.win-bar i').getBoundingClientRect().width>10);
  await page.waitForFunction(()=>document.querySelector('#go').textContent==='Done');
  assert(await page.locator('#fc2').evaluate(element=>element.classList.contains('show')));
  await page.waitForFunction(()=>document.querySelector('#stage-install').dataset.step==='0');
  assert.equal(await page.locator('#code').textContent(),'','The completed installer must start another loop.');

  await moveTo(page,'.hero');
  await page.waitForFunction(()=>document.querySelector('#stage-install').hasAttribute('data-install-paused'));
  const stopped=await page.locator('#stage-install').getAttribute('data-step');
  await page.waitForTimeout(3500);
  assert.equal(await page.locator('#stage-install').getAttribute('data-step'),stopped,'Offscreen installer must pause.');
  assert(await page.locator('#tools .ic').evaluateAll(elements=>elements.every(element=>getComputedStyle(element).animationPlayState==='paused')));
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.waitForFunction(()=>document.querySelector('#go').textContent==='Done');
  assert.equal(await page.locator('.caret').evaluate(element=>getComputedStyle(element).animationName),'none');
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.locator('#stage-install').evaluate(element=>element.scrollIntoView({behavior:'instant',block:'center'}));
  await page.waitForFunction(()=>!document.querySelector('#stage-install').hasAttribute('data-install-paused'));
  assert.deepEqual(errors,[]);
  console.log(`${width}px: visible tools, entrances, icon/focus motion, complete setup loop, pause and preference changes passed.`);
  await context.close();
 }
 for(const mode of ['reduce','no-js']){
  const {context,page,errors}=await open(390,mode);
  await moveTo(page,'#tools');await visibleTools(page);
  if(mode==='reduce'){
   assert(await page.locator('#tools .ic').evaluateAll(elements=>elements.every(element=>getComputedStyle(element).animationName==='none')));
   await page.waitForFunction(()=>document.querySelector('#go').textContent==='Done');
  }
  assert.deepEqual(errors,[]);console.log(`${mode}: readable tool content and static fallback passed.`);await context.close();
 }
}finally{await browser.close();}
