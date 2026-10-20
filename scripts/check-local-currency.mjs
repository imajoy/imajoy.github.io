/* Fixed exchange-rate fixtures; provider amounts are inspected without real payments. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=new URL(process.argv[2]||'http://localhost:8799/'),rates={USD:1,CAD:1.4,EUR:.9,JPY:150,INR:84,KWD:.3};
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
try{
 for(const [country,width,fail,main,usd] of [['CA',390,false,/29\.85/,/21\.32/],['CA',1280,false,/29\.85/,/21\.32/],['DE',390,false,/20\.20/,/22\.44/],['JP',390,false,/3,198/,/21\.32/],['KW',1280,false,/6\.396/,/21\.32/],['IN',390,false,/916\.98/,/10\.92/],['US',390,false,/21\.32/,null],['CA',390,true,/21\.32/,null]]){
  const context=await browser.newContext({viewport:{width,height:950},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];let rateCalls=0,checkoutBody;
  page.on('pageerror',error=>errors.push(error.message));
  await context.addInitScript(()=>localStorage.setItem('ajoy.acct',JSON.stringify({token:'fixture-account-session',email:'buyer@example.com',expiresAt:Date.now()+864e5,subscriptions:[]})));
  await context.route('**/*',async route=>{
   const r=route.request(),url=r.url();if(new URL(url).origin===base.origin)return route.continue();
   if(url.includes('open.er-api.com')){rateCalls++;return fail?route.fulfill({status:503,body:''}):route.fulfill({json:{result:'success',rates}});}
   if(url.includes('/paypal-config'))return route.fulfill({json:{country,mode:'live',clientId:'fixture',billingPolicyEnabled:true,plans:{tiers:{high:{online:{monthly:true,yearly:true},onlineTrial:{monthly:true,yearly:true}}}}}});
   if(url.includes('/billing-context'))return route.fulfill({json:{ok:true,country,canEditCountry:false,blocked:false}});
   if(url.includes('/razorpay/config'))return route.fulfill({json:{ok:true,enabled:country==='IN',countries:['IN'],mode:'test',keyId:''}});
   if(url.includes('/commerce/eligibility'))return route.fulfill({json:{ok:true,eligible:true,rewardsVersion:1,reason:'eligible'}});
   if(url.includes('/commerce/rewards')){const c=JSON.parse(r.postData()),unit=c.billing==='yearly'?21522:2244;return route.fulfill({json:{ok:true,pricing:{total:Math.round(unit*c.seats*.95),unitAmount:unit,discountAmount:Math.round(unit*c.seats*.05),percent:5,seats:c.seats,billing:c.billing,rewardPayments:1}}});}
   if(url.includes('/razorpay/quote')){const c=JSON.parse(r.postData());return route.fulfill({json:{ok:true,pricing:{total:91698*c.seats,unitAmount:91698,compareAtUnitAmount:91698,billing:c.billing,seats:c.seats}}});}
   if(url.includes('/commerce/checkout')){checkoutBody=JSON.parse(r.postData());return route.fulfill({json:{ok:true,checkoutId:'11111111-1111-4111-8111-111111111111',subscriptionId:'I-FIXTURE1',offer:'standard'}});}
   if(url.includes('www.paypal.com/sdk/js'))return route.fulfill({contentType:'text/javascript',body:'window.paypal={Buttons(options){window.fixturePayPal=options;return {render(selector){document.querySelector(selector).innerHTML="<button type=button data-fixture-paypal>PayPal Subscribe</button>";return Promise.resolve()}}}};'});
   return route.abort();
  });
  await page.goto(new URL('checkout.html',base).href);await page.waitForFunction(()=>document.documentElement.dataset.billingBlocked==='false');
  if(!['IN','DE'].includes(country))await page.locator('[name="checkout-offer"][value="standard"]').check();
  await page.waitForFunction(({main})=>new RegExp(main).test(document.querySelector('#summary-total').textContent),{main:main.source});
  if(usd)await page.waitForFunction(({usd})=>new RegExp(usd).test(document.querySelector('#local-total')?.textContent||''),{usd:usd.source});
  else assert.equal(await page.locator('#local-total').textContent(),'');
  if(fail){await page.locator('#currency-fallback').waitFor({state:'visible'});assert.match(await page.locator('#currency-fallback').textContent(),/shown in USD/);}
  if(country==='CA'&&!fail){
   assert.match(await page.locator('#summary-unit').textContent(),/31\.42/);assert.match(await page.locator('#summary-subtotal').textContent(),/31\.42/);assert.match(await page.locator('#summary-loyalty').textContent(),/1\.57/);
   await page.locator('[name="checkout-offer"][value="trial"]').check();assert.match(await page.locator('#summary-total').textContent(),/0\.00/);assert.match(await page.locator('#local-total').textContent(),/0\.00/);
   await page.locator('[name="checkout-offer"][value="standard"]').check();await page.waitForFunction(()=>document.querySelector('#summary-total').textContent.includes('29.85'));
  }
  await page.locator('#name').fill('Currency fixture');await page.locator('#address').fill('Example street');await page.locator('#city').fill('Example city');await page.locator('#terms').check();
  await page.locator('[data-continue-payment]').click();await page.waitForURL('**/payment.html');
  await page.waitForFunction(({main})=>new RegExp(main).test(document.querySelector('#summary-total').textContent),{main:main.source});
  if(country==='CA'&&!fail){await page.locator('[data-fixture-paypal]').waitFor();await page.evaluate(()=>window.fixturePayPal.createSubscription());assert.equal(checkoutBody.expectedTotal,2132);assert.equal(checkoutBody.expectedRewardPercent,5);assert.equal(checkoutBody.country,'CA');}
  assert.equal(await page.locator('#summary-total').getAttribute('data-money-currency'),country==='IN'?'INR':'USD');
  assert(rateCalls<=(fail?2:1),'shared FX fetches; failed rates retry after navigation');assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
  if(country==='CA'&&!fail)await page.screenshot({path:`/tmp/local-currency-${width}.png`,fullPage:true});
  await context.close();console.log(`${country} ${width}px${fail?' FX unavailable':''}: local rows, USD secondary, trials and unchanged charge units passed`);
 }
 // A delayed rate response must format the current provider/country, not an old quote.
 {
  const context=await browser.newContext(),page=await context.newPage();let release,requests=0;
  await context.route('**/*',async route=>{
   const url=route.request().url();
   if(url.includes('currency-fixture'))return route.fulfill({contentType:'text/html',body:'<form id="billing-form"><select name="country"><option value="CA">Canada</option><option value="IN">India</option><option value="JP">Japan</option></select></form><div><strong id="summary-total"></strong></div><p id="quote-note"></p><script type="module">import {setMoney} from "./js/currency-display.js?v=20261020-local1";window.fixtureSetMoney=setMoney;setMoney(document.querySelector("#summary-total"),2244,"USD","CA");</script>'});
   if(url.includes('open.er-api.com')){requests++;await new Promise(resolve=>release=resolve);return route.fulfill({json:{rates}});}
   return route.continue();
  });
  await page.goto(new URL('currency-fixture',base).href);
  await page.waitForFunction(()=>typeof window.fixtureSetMoney==='function');
  const deadline=Date.now()+5000;while(!release&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,20));assert(release);
  await page.evaluate(()=>window.fixtureSetMoney(document.querySelector('#summary-total'),91698,'INR','IN'));release();
  await page.waitForFunction(()=>document.querySelector('#local-total').textContent.includes('10.92'));
  assert.match(await page.locator('#summary-total').textContent(),/916\.98/);assert.equal(await page.locator('#summary-total').getAttribute('data-money-currency'),'INR');
  await page.evaluate(()=>window.fixtureSetMoney(document.querySelector('#summary-total'),2132,'USD','JP'));
  assert.match(await page.locator('#summary-total').textContent(),/3,198/);assert.match(await page.locator('#local-total').textContent(),/21\.32/);assert.equal(requests,1);
  await context.close();console.log('Delayed FX: latest provider amount/country wins, with one shared request');
 }
}finally{await browser.close();}
