/* Browser-only fixtures; never contacts PayPal or creates a real payment. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=new URL(process.argv[2]||'http://localhost:8799/');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
try{
 for(const width of [390,1280]){
  let failures=1,calls=0,hold=false,release;
  const context=await browser.newContext({viewport:{width,height:950},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await context.addInitScript(()=>localStorage.setItem('ajoy.acct',JSON.stringify({token:'signed-account-fixture-token',email:'buyer@example.com',expiresAt:Date.now()+864e5,subscriptions:[]})));
  await context.route('**/*',async route=>{
   const r=route.request(),url=r.url();if(new URL(url).origin===base.origin)return route.continue();
   if(url.includes('/paypal-config'))return route.fulfill({json:{mode:'live',clientId:'fixture',country:'US',plans:{tiers:{high:{online:{monthly:true,yearly:true},onlineTrial:{monthly:true,yearly:true},offline:{monthly:true,yearly:true}}}}}});
   if(url.includes('/razorpay/config'))return route.fulfill({json:{ok:true,enabled:false}});
   if(url.includes('/commerce/eligibility'))return route.fulfill({json:{ok:true,rewardsVersion:1,eligible:true,reason:'eligible'}});
   if(url.includes('/commerce/rewards')){
    calls++;if(failures-->0)return route.fulfill({status:503,json:{ok:false,error:'unavailable',message:'Fixture: price service temporarily unavailable.'}});
    if(hold)await new Promise(resolve=>release=resolve);
    const c=JSON.parse(r.postData()),unitAmount=c.billing==='yearly'?21522:2244,percent=c.coupon?10:5;
    return route.fulfill({json:{ok:true,pricing:{currency:'USD',unitAmount,total:Math.round(unitAmount*c.seats*(1-percent/100)),discountAmount:Math.round(unitAmount*c.seats*percent/100),percent,seats:c.seats,billing:c.billing,rewardPayments:1,...(c.coupon?{coupon:{code:c.coupon,percent}}:{})}}});
   }
   if(url.includes('www.paypal.com/sdk/js'))return route.fulfill({contentType:'text/javascript',body:'window.paypal={Buttons(options){window.fixturePayPal=options;return {render(selector){document.querySelector(selector).innerHTML="<button type=button data-fixture-paypal>PayPal Subscribe</button>";return Promise.resolve();}}}};'});
   return route.abort();
  });
  await page.goto(new URL('checkout.html',base).href);
  await page.waitForFunction(()=>document.querySelector('#country').value==='US');
  assert.equal(await page.locator('#paypal-buttons').isVisible(),false);
  await page.waitForFunction(()=>document.querySelector('#loyalty-status').textContent.includes('Fixture:'));
  await page.locator('#name').fill('Example buyer');await page.locator('#address').fill('Example street');await page.locator('#city').fill('Example city');await page.locator('#terms').check();
  failures=1;await page.locator('[data-continue-payment]').click();await page.waitForURL('**/payment.html');

  await page.locator('[data-fixture-paypal]').waitFor();
  await page.waitForFunction(()=>document.querySelector('#loyalty-status').textContent.includes('Fixture:'));
  await page.evaluate(()=>window.fixturePayPal.onCancel());
  await page.locator('[name="checkout-offer"][value="standard"]').check();
  await page.locator('[data-fixture-paypal]').waitFor({state:'visible',timeout:5000});
  assert.match(await page.locator('#summary-total').textContent(),/21\.32/);
  assert.doesNotMatch(await page.locator('.paypal-note').textContent(),/Checkout cancelled/);
  assert(calls>=2,'selecting Standard must recover a missing/failed verified price');
  await page.locator('[name="checkout-offer"][value="trial"]').check();await page.locator('[data-fixture-paypal]').waitFor();
  await page.locator('#coupon-code').fill('OFFER10');await page.locator('#coupon-apply').click();
  await page.waitForFunction(()=>document.querySelector('#summary-total').textContent.includes('20.20'));await page.locator('[data-fixture-paypal]').waitFor();
  hold=true;await page.locator('#coupon-remove').click();
  await page.waitForFunction(()=>document.querySelector('[data-payment-price-status]')?.textContent.includes('Confirming'));
  assert.equal(await page.locator('[data-fixture-paypal]').isVisible(),false);
  await page.waitForFunction(()=>document.querySelector('#loyalty-status').textContent.includes('Checking'));const deadline=Date.now()+5000;while(!release&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,20));assert(release,'the pending quote must reach the fixture service');release();hold=false;
  await page.locator('[data-fixture-paypal]').waitFor();assert.match(await page.locator('#summary-total').textContent(),/21\.32/);
  await page.getByRole('link',{name:'Edit billing details',exact:true}).first().click();await page.waitForURL('**/checkout.html');
  await page.waitForFunction(()=>document.documentElement.dataset.billingBlocked==='false');
  await page.selectOption('#billing','yearly');
  await page.waitForFunction(()=>document.querySelector('#summary-total').textContent.includes('204.46'));
  failures=1;await page.locator('[data-continue-payment]').click();await page.waitForURL('**/payment.html');
  await page.locator('[data-payment-price-retry]').waitFor({state:'visible'});await page.locator('[data-payment-price-retry]').click();
  await page.locator('[data-fixture-paypal]').waitFor();assert.match(await page.locator('#summary-total').textContent(),/204\.46/);
  assert.deepEqual(errors,[]);await context.close();console.log(`${width}px: Standard recovery, cancelled trial, coupon apply/remove, pending price and retry passed`);
 }
}finally{await browser.close();}
