/* Isolated two-step checkout checks: no real account, provider or payment requests. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=new URL(process.argv[2]||'http://localhost:8799/');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
try{
 for(const width of [390,1280]){
  const context=await browser.newContext({viewport:{width,height:950},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];let sdkCalls=0;
  page.on('pageerror',error=>errors.push(error.message));
  await context.addInitScript(()=>{if(!localStorage.getItem('ajoy.acct'))localStorage.setItem('ajoy.acct',JSON.stringify({token:'fixture-account-session',email:'buyer@example.com',expiresAt:Date.now()+864e5,subscriptions:[]}));});
  await context.route('**/*',async route=>{
   const r=route.request(),url=r.url();if(new URL(url).origin===base.origin)return route.continue();
   if(url.includes('/paypal-config'))return route.fulfill({json:{mode:'live',billingPolicyEnabled:true,country:'US',clientId:'fixture',plans:{tiers:{high:{online:{monthly:true,yearly:true},onlineTrial:{monthly:true,yearly:true}}}}}});
   if(url.includes('/commerce/billing-context'))return route.fulfill({json:{ok:true,country:'US',canEditCountry:false,blocked:false}});
   if(url.includes('/commerce/eligibility'))return route.fulfill({json:{ok:true,rewardsVersion:1,eligible:true,reason:'eligible'}});
   if(url.includes('/commerce/rewards'))return route.fulfill({json:{ok:true,pricing:{total:2244,unitAmount:2244,discountAmount:0,percent:0,seats:1,billing:'monthly',rewardPayments:0}}});
   if(url.includes('/commerce/confirm'))return route.fulfill({json:{ok:true,accepted:false}});
   if(url.includes('/razorpay/config'))return route.fulfill({json:{ok:true,enabled:false}});
   if(url.includes('www.paypal.com/sdk/js')){sdkCalls++;return route.fulfill({contentType:'text/javascript',body:'window.paypal={Buttons(){return {render(selector){document.querySelector(selector).innerHTML="<button type=button data-fixture-paypal>PayPal Subscribe</button>";return Promise.resolve()}}}};'});}
   return route.abort();
  });
  await page.goto(new URL('payment.html',base).href);await page.waitForURL('**/checkout.html');
  await page.waitForFunction(()=>document.documentElement.dataset.billingBlocked==='false');
  assert.equal(sdkCalls,0);assert.equal(await page.locator('.payment-picker').isVisible(),false);
  await page.locator('[data-continue-payment]').click();assert.equal(new URL(page.url()).pathname,'/checkout.html');
  await page.locator('#name').fill('Private buyer');await page.locator('#address').fill('Private street 42');await page.locator('#city').fill('Private city');await page.locator('#terms').check();
  await page.locator('[name="checkout-offer"][value="standard"]').check();
  await page.locator('[data-continue-payment]').click();await page.waitForURL('**/payment.html');await page.locator('[data-fixture-paypal]').waitFor();
  assert.equal(new URL(page.url()).search,'');assert.equal(await page.locator('.billing-entry').isVisible(),false);assert(await page.locator('.payment-billing-summary').textContent().then(t=>t.includes('Private street 42')));
  assert(await page.locator('.payment-picker').isVisible());assert.equal(await page.locator('[value="razorpay"]').isVisible(),false);assert(await page.locator('[name="checkout-offer"][value="standard"]').isChecked());
  const draft=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('ajoy.billing-draft')));
  await page.evaluate(async()=>{const m=await import('./js/account-session.js?v=20261018-n1');m.setAccountSession({...m.getAccountSession(),subscriptions:[]});});
  assert.equal(await page.evaluate(()=>JSON.parse(sessionStorage.getItem('ajoy.billing-draft')).email),'buyer@example.com');

  assert.equal(draft.name,'Private buyer');assert.equal(draft.token,undefined);assert.equal(draft.terms,true);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.screenshot({path:`/tmp/payment-step-${width}.png`,fullPage:true});
  await page.getByRole('link',{name:'Edit billing details',exact:true}).first().click();await page.waitForURL('**/checkout.html');
  assert.equal(await page.locator('#address').inputValue(),'Private street 42');await page.locator('#city').fill('Updated city');
  await page.waitForFunction(()=>document.documentElement.dataset.billingBlocked==='false');await page.locator('[data-continue-payment]').click();await page.waitForURL('**/payment.html');await page.locator('[data-fixture-paypal]').waitFor();
  assert.match(await page.locator('.payment-billing-summary').textContent(),/Updated city/);
  await page.reload();await page.locator('[data-fixture-paypal]').waitFor();assert.match(await page.locator('.payment-billing-summary').textContent(),/Updated city/);
  await page.evaluate(()=>{const d=JSON.parse(sessionStorage.getItem('ajoy.billing-draft'));d.at=Date.now()-31*60*1000;sessionStorage.setItem('ajoy.billing-draft',JSON.stringify(d));});
  await page.reload();await page.waitForURL('**/checkout.html');assert.equal(await page.evaluate(()=>sessionStorage.getItem('ajoy.billing-draft')),null);
  await page.evaluate(draft=>{sessionStorage.setItem('ajoy.billing-draft',JSON.stringify({...draft,at:Date.now()}));localStorage.setItem('ajoy.acct',JSON.stringify({token:'another-fixture-session',email:'other@example.com',expiresAt:Date.now()+864e5,subscriptions:[]}));},draft);
  await page.goto(new URL('payment.html',base).href);await page.waitForURL('**/checkout.html');assert.equal(await page.evaluate(()=>sessionStorage.getItem('ajoy.billing-draft')),null);
  await page.goto(new URL('checkout.html?checkout=11111111-1111-4111-8111-111111111111',base).href);await page.waitForURL('**/payment.html?checkout=*');await page.locator('[data-confirm-retry]').waitFor();
  assert.deepEqual(errors,[]);await context.close();console.log(`${width}px: separate gateway page, private draft, Standard choice, edit/refresh, expiry and legacy PayPal return passed`);
 }
}finally{await browser.close();}
