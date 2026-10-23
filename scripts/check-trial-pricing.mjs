import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=new URL(process.argv[2]||'http://localhost:8799/');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
const open=async(path,{used=false,reduced=false}={})=>{
 const context=await browser.newContext({viewport:{width:1280,height:900},timezoneId:'America/New_York',locale:'en-US',reducedMotion:reduced?'reduce':'no-preference'});
 if(used)await context.addInitScript(()=>localStorage.setItem('ajoy.acct',JSON.stringify({token:'x'.repeat(40),email:'buyer@example.com',expiresAt:Date.now()+864e5,subscriptions:[],premiumYearlyUsed:true})));
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(new URL(path,base).href);return {context,page,errors};
};
try{
 // Every trial button opens the pricing section, never the billing page.
 for(const path of ['wrapline.html','tool-playblast.html','tool-rivet.html','download.html']){
  const {context,page,errors}=await open(path);
  await page.waitForFunction(()=>document.querySelector('[data-trial-cta]')?.dataset.trialReady!==undefined,null,{timeout:15000}).catch(()=>{});
  await page.waitForTimeout(800);
  const links=await page.locator('[data-trial-cta]').evaluateAll(a=>a.map(x=>({href:x.getAttribute('href'),text:x.textContent.trim()})));
  assert(links.length>0,path+' has trial buttons');
  for(const l of links){assert(!/checkout\.html/.test(l.href),path+' trial button must not open billing: '+l.href+' / '+l.text);assert(/#pricing$/.test(l.href)||/#trial$/.test(l.href),path+' unexpected trial target '+l.href);}
  assert.deepEqual(errors,[],path);await context.close();
 }
 {
  const {context,page}=await open('tool-playblast.html');await page.waitForTimeout(800);
  const cta=page.locator('[data-trial-cta]').first();await cta.click();await page.waitForURL(/wrapline\.html#pricing/);
  assert(await page.locator('#pricing').isVisible());await context.close();
 }
 // Names: Basic and Premium.
 {
  const {context,page}=await open('wrapline.html');
  await page.locator('#pricing').scrollIntoViewIfNeeded();
  const names=await page.locator('.plans .plan h3').allTextContents();assert.deepEqual(names.map(s=>s.trim()),['Basic','Premium']);
  const body=await page.locator('body').innerText();assert(!/\bOnline plan\b|\bOffline plan\b/.test(body),'old plan names are gone');
  assert.equal(await page.locator('.plan-discount').count(),2);
  // First-time Premium yearly: 20% off, badge visible and animated.
  await page.locator('[data-bill=yearly]').click();
  await page.waitForFunction(()=>document.querySelector('[data-amt=offline]').textContent.includes('479.20'));
  await page.waitForFunction(()=>[...document.querySelectorAll('.plan-discount')].every(b=>b.dataset.live==='go'));
  const motion=await page.locator('.plan-discount b').first().evaluate(b=>({glow:getComputedStyle(b).animationName,sweep:getComputedStyle(b,'::after').animationName,letter:getComputedStyle(b.querySelector('.discount-typing span')).animationName}));
  assert.match(motion.glow,/plan-discount-glow/);assert.match(motion.sweep,/plan-discount-sweep/);assert.match(motion.letter,/plan-discount-pop/);
  await page.locator('.plans').screenshot({path:process.env.SHOT_DIR?process.env.SHOT_DIR+'/pricing-first.png':'/tmp/pricing-first.png'});
  await context.close();
 }
 // Second Premium yearly on the same account: no 20% badge, full price, Basic unchanged.
 {
  const {context,page}=await open('wrapline.html',{used:true});
  await page.locator('#pricing').scrollIntoViewIfNeeded();
  await page.locator('[data-bill=yearly]').click();
  await page.waitForFunction(()=>document.querySelector('[data-amt=offline]').textContent.includes('599'));
  assert.equal(await page.locator('[data-amt=online]').textContent().then(s=>s.includes('287.90')),true,'Basic yearly keeps 20%');
  const hidden=await page.locator('.plan-discount').evaluateAll(a=>a.map(x=>x.hidden));assert.deepEqual(hidden,[false,true],'only the Premium badge is gone');
  assert.equal(await page.locator('[data-annual=offline]').isHidden(),true);
  assert.match(await page.locator('[data-note=offline]').textContent(),/already been used/);
  await page.locator('[data-bill=monthly]').click();await page.waitForFunction(()=>document.querySelector('[data-amt=offline]').textContent.includes('49.92'));
  await context.close();
 }
 // Reduced motion: the badge text stays readable and static.
 {
  const {context,page}=await open('wrapline.html',{reduced:true});
  await page.locator('#pricing').scrollIntoViewIfNeeded();
  const state=await page.locator('.plan-discount b').first().evaluate(b=>({anim:getComputedStyle(b).animationName,op:getComputedStyle(b.querySelector('.discount-typing span')).opacity,text:b.textContent.replace(/\s+/g,'').includes('20%OFF')}));
  assert.equal(state.anim,'none');assert.equal(state.op,'1');assert.equal(state.text,true);await context.close();
 }
 console.log('Trial buttons open pricing; Basic/Premium names; first-time Premium yearly 20% (badge animation) and full price after use passed.');
}finally{await browser.close();}
