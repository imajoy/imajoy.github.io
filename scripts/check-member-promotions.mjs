/* Promotion text must follow account state, even when config requests finish later. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=new URL(process.argv[2]||'http://localhost:8803/');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
const subscription={plan:'online',billing:'monthly',status:'ACTIVE',renews:true,trial:false,seats:1,endsAt:new Date(Date.now()+30*864e5).toISOString(),provider:'paypal',ref:'I-EXAMPLE1234'};
try{
 for(const [path,width] of [['wrapline.html',390],['wrapline.html',1280],['tool-playblast.html',390]]){
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
  let session={token:'test-session-token-123456789',email:'buyer@example.com',expiresAt:Date.now()+864e5,subscriptions:[{...subscription,plan:'offline'}]};
  await context.addInitScript(value=>{localStorage.setItem('ajoy.acct',JSON.stringify(value));localStorage.setItem('ajoy.geo',JSON.stringify({country:'US',at:Date.now()}));},session);
  await context.route('**/*',async route=>{
   const url=route.request().url();if(new URL(url).origin===base.origin)return route.continue();
   if(url.includes('script.google.com'))return route.fulfill({json:{ok:true,...session}});
   if(url.includes('paypal-config'))return route.fulfill({json:{country:'US',clientId:'fixture',plans:{tiers:Object.fromEntries(['low','mid','high'].map(t=>[t,{onlineTrial:{monthly:true,yearly:true}}]))}}});
   if(url.includes('razorpay/config'))return route.fulfill({json:{ok:true,enabled:false}});
   if(url.includes('/quote?'))return route.fulfill({json:{currency:'USD',unitAmount:2200,annualSavings:0}});
   if(url.includes('api.country.is')||url.includes('get.geojs.io'))return route.fulfill({json:{country:'US'}});
   return route.abort();
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(new URL(path,base).href);
  const check=async label=>{
   await page.waitForFunction(label=>[...document.querySelectorAll('[data-trial-cta]')].every(a=>a.textContent===label),label);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  };
  const update=async subscriptions=>{session=subscriptions===false?null:{...session,token:'test-session-token-123456789',email:'buyer@example.com',expiresAt:Date.now()+864e5,subscriptions};await page.evaluate(async value=>(await import('./js/account-session.js?v=20261023-p7')).setAccountSession(value),session);};
  await check('Manage my subscription');
  if(path==='wrapline.html'){
   assert(await page.locator('.hero-trial-summary').isHidden());
   assert.match(await page.locator('.trial-banner').getAttribute('aria-label'),/Manage my subscription/);
   await page.waitForFunction(()=>document.querySelector('[data-buy=online]').textContent==='Subscribe now');
   assert(!/free trial/i.test(await page.locator('[data-note=online]').textContent()));
   await page.screenshot({path:'/tmp/member-promotions-'+width+'.png'});
  }
  await page.locator('[data-trial-cta]').first().click();await page.locator('dialog[open]').waitFor();await page.keyboard.press('Escape');
  await update([{...subscription,status:'APPROVED',trial:true}]);await check('Manage my trial');
  await update([{...subscription,status:'CANCELLED',renews:false}]);await check('Manage my subscription');
  await update([{...subscription,status:'EXPIRED',endsAt:new Date(Date.now()-864e5).toISOString(),trial:true}]);await check('Explore plans');
  assert.match(await page.locator('[data-trial-cta]').first().getAttribute('href'),/#pricing$/);
  await update(null);await check('View my account');
  await update([]);await check('Start my 4-day free trial');
  if(path==='wrapline.html')await page.waitForFunction(()=>document.querySelector('[data-buy=online]').textContent==='Start 4-day free trial');
  await update(false);await check('Start my 4-day free trial');
  assert.deepEqual(errors,[]);await context.close();
 }
 console.log('Member promotions passed: Premium/Basic, approved trial, cancellation with remaining access, expired trial, pending details, new account, sign-out, account action, phone and desktop.');
}finally{await browser.close();}
