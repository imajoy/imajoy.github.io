/* Browser + private Apps Script fixtures. Never contacts a payment provider or sends email. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {service} from '../tests/helpers/apps-service.mjs';
import {createRazorpayHandler} from '../supabase/functions/razorpay/handler.js';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=new URL(process.argv[2]||'http://localhost:8798/');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
try{
 for(const [country,enabled,width,theme,legacy] of [['IN',true,390,'light'],['IN',true,1280,'dark'],['US',true,390,'dark'],['US',true,1280,'light'],['GB',true,390,'light'],['IN',false,390,'light'],['US',false,1280,'light'],['PK',true,390,'light'],['IN',true,390,'light',true]]){
  const app=service(),token=app.ctx.makeSession_('buyer@example.com');
  for(const [k,v] of Object.entries({RAZORPAY_MODE:'test',RAZORPAY_ENABLED:String(enabled),RAZORPAY_KEY_ID:'rzp_test_fixture',RAZORPAY_KEY_SECRET:'private-razorpay-test-secret',RAZORPAY_WEBHOOK_SECRET:'private-webhook-test-secret',RAZORPAY_ALLOWED_COUNTRIES:'ALL'}))app.values.set(k,v);
  app.ctx.Logger={log(){}};app.ctx.setupRazorpayPlans();
  const handler=createRazorpayHandler({env:k=>({ALLOWED_ORIGINS:base.origin,SHEET_WEB_APP_URL:'https://script.google.com/macros/s/FIXTURE/exec',COMMERCE_CLIENT_IP_HEADER:'cf-connecting-ip'}[k]||app.values.get(k)),request:async(url,options)=>url.startsWith('https://api.country.is/')?Response.json({country}):Response.json(JSON.parse(app.ctx.doPost({postData:{contents:options.body}}).text))});
  const context=await browser.newContext({viewport:{width,height:950},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
  page.on('pageerror',error=>{errors.push(error.message);if(process.env.DEBUG_ERRORS)console.log('PAGEERROR',error.message);});
  await context.addInitScript(({token,country,theme})=>{if(!sessionStorage.getItem('fixture.accountSeeded')){localStorage.setItem('ajoy.acct',JSON.stringify({token,email:'buyer@example.com',expiresAt:Date.now()+864e5,subscriptions:[]}));sessionStorage.setItem('fixture.accountSeeded','1');}localStorage.setItem('ajoy-theme',theme);localStorage.setItem('ajoy.geo',JSON.stringify({country,at:Date.now()}));}, {token,country,theme});
  await context.route('**/*',async route=>{
   const req=route.request(),url=req.url();
   if(new URL(url).origin===base.origin)return route.continue();
   if(url.includes('/functions/v1/razorpay/')){
    const response=await handler(new Request(url,{method:req.method(),headers:{...req.headers(),'cf-connecting-ip':'8.8.8.8'},...(req.postData()?{body:req.postData()}:{})}));
    let body=await response.text();if(legacy&&url.endsWith('/config')){const data=JSON.parse(body);delete data.trialCheckPaise;body=JSON.stringify(data);}
    return route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body});
   }
   if(url.includes('/functions/v1/paypal-config'))return route.fulfill({json:{mode:'live',clientId:'fixture',country,plans:{tiers:Object.fromEntries(['low','mid','high'].map(t=>[t,{online:{monthly:true,yearly:true},offline:{monthly:true,yearly:true},onlineTrial:{monthly:true,yearly:true}}]))}}});
   if(url.includes('/functions/v1/commerce/eligibility'))return route.fulfill({json:{ok:true,rewardsVersion:1,eligible:true,reason:'eligible'}});
   if(url.includes('/functions/v1/commerce/rewards')){const body=JSON.parse(req.postData());return route.fulfill({json:{ok:true,pricing:{currency:'USD',unitAmount:2200,total:2200*body.seats,seats:body.seats,percent:0,rewardPayments:0,billing:body.billing}}});}
   if(url.includes('www.paypal.com/sdk/js'))return route.fulfill({contentType:'text/javascript',body:'window.paypal={Buttons:function(){return {render:function(selector){document.querySelector(selector).innerHTML="<button type=button>PayPal Subscribe</button>";return Promise.resolve();}}}};'});
   if(url.includes('script.google.com'))return route.fulfill({contentType:'application/json',body:app.ctx.doPost({postData:{contents:req.postData()}}).text});
   if(url.includes('api.country.is'))return route.fulfill({json:{country}});
   if(url.includes('get.geojs.io'))return route.fulfill({json:{country}});
   if(url.startsWith('https://checkout.razorpay.com/v1/checkout.js'))return route.fulfill({contentType:'text/javascript',body:'window.Razorpay=function(options){var r=window.__rzp=window.__rzp||{opened:0};r.options=options;r.events={};this.on=function(n,f){r.events[n]=f;};this.open=function(){r.opened++;};};'});
   if(url.startsWith('https://rzp.io/'))return route.fulfill({contentType:'text/html',body:'<h1>Fixture hosted checkout</h1>'});
   return route.abort();
  });
  await page.goto(new URL('checkout.html?plan=online&billing=monthly',base).href);
  await page.waitForFunction(country=>document.querySelector('#country').value===country,country);
  assert.equal(await page.locator('#country').isDisabled(),true);
  assert.equal(await page.locator('.payment-picker').isVisible(),false);
  assert.equal(await page.locator('#paypal-buttons').isVisible(),false);
  assert.equal(await page.locator('.razorpay-panel').isVisible(),false);
  await page.locator('#name').fill('Example buyer');await page.locator('#address').fill('Example street');await page.locator('#city').fill('Example city');await page.locator('#terms').check();
  await page.locator('[data-continue-payment]').click();await page.waitForURL('**/payment.html');
  await page.waitForFunction(country=>document.querySelector('#country').value===country,country);
  assert.equal(await page.locator('.billing-entry').isVisible(),false);

  if(enabled&&country==='PK'){
   // No PayPal in this country: Razorpay is the only option, charged in INR by card.
   await page.locator('.razorpay-panel').waitFor({state:'visible'});
   await page.waitForFunction(()=>document.querySelector('.razorpay-status').textContent.includes('Price confirmed'));
   assert.equal(await page.getByRole('radio',{name:/PayPal/}).isVisible(),false);
   assert.equal(await page.locator('.paypal-box').isVisible(),false);
   assert.deepEqual(await page.locator('.rzp-methods li').allTextContents(),['International cards']);
   assert.equal(await page.locator('.rzp-offer').isVisible(),true,'the trial is offered through Razorpay');
   await page.screenshot({path:'/tmp/payment-pk-'+width+'.png',fullPage:true});
  }else if(enabled&&['IN','US'].includes(country)){
   await page.locator('.payment-picker').waitFor({state:'visible'});
   if(country==='US'){
    await page.getByRole('radio',{name:/Razorpay/}).check();
   }
   await page.waitForFunction(()=>document.querySelector('.razorpay-status').textContent.includes('Price confirmed'));
   {
    // Online plans offer the 2-day trial with Razorpay too (selected by default when eligible): nothing due today.
    await page.waitForFunction(()=>!document.querySelector('.rzp-offer').hidden&&document.querySelector('.rzp-offer [value=trial]').checked&&/(^|[^0-9,.])0\.00/.test(document.querySelector('#summary-total').textContent));
    assert.equal(await page.locator('[data-razorpay-start]').textContent(),'Start 2-day free trial');
    const check=await page.locator('.rzp-check').textContent();
    if(legacy){assert.match(check,/Review the exact amount/);assert(!check.includes('₹1'));assert(!check.includes('We refund'));}
    else assert.match(check,/₹1 payment-method check/);
    await page.screenshot({path:'/tmp/payment-trial-'+width+'.png',fullPage:true});
    // The rest of this run checks the paid path; the trial path is covered by the server tests.
    await page.locator('.rzp-offer [value=standard]').check();await page.waitForFunction(()=>document.querySelector('.razorpay-status').textContent.includes('Price confirmed')&&/916|2,038/.test(document.querySelector('#summary-total').textContent));
   }
   assert.equal(await page.locator('.paypal-box').isVisible(),false);
   assert.equal(await page.locator('#customer-verification').isVisible(),false);
   assert.equal(await page.locator('.checkout-form > .coupon-panel').isVisible(),false,'no coupon box at the top of the payment step');
   assert.equal(await page.locator('.razorpay-panel .rzp-coupon summary').isVisible(),true,'"Have a coupon?" inside the payment card');
   assert.equal(await page.evaluate(()=>document.querySelector('.razorpay-panel #terms')!==null&&document.querySelector('#terms').closest('.check-row').nextElementSibling===document.querySelector('[data-razorpay-start]')),true,'agreement sits just above the pay button');
   if(country==='IN'){
    app.ctx.couponSheet_();app.sheets.get('Coupons').appendRow(['SAVE10',10,1,new Date(Date.now()+30*864e5),'both','both','','',true,'','']);
    await page.locator('.rzp-offer [value=trial]').check();await page.waitForFunction(()=>document.querySelector('.razorpay-status').textContent.includes('Price confirmed'));
    await page.locator('.razorpay-panel .rzp-coupon summary').click();await page.locator('.razorpay-panel .rzp-coupon input').fill('save10');await page.locator('.razorpay-panel [data-coupon-apply]').click();
    await page.waitForFunction(()=>/SAVE10 applied: 10% off/.test(document.querySelector('.rzp-coupon-msg').textContent));
    assert.match(await page.locator('.rzp-offer-note').textContent(),/can.t be combined with the free trial/);
    assert.equal(await page.locator('.rzp-offer [value=standard]').isChecked(),true);
    assert.match(await page.locator('#summary-total').textContent(),/825\.28/);
    assert.equal(await page.locator('#coupon-summary-row').isVisible(),true);
    await page.locator('.razorpay-panel [data-coupon-remove]').click();await page.waitForFunction(()=>/916\.98/.test(document.querySelector('#summary-total').textContent)&&document.querySelector('.razorpay-status').textContent.includes('Price confirmed'));
    assert.equal(await page.locator('.rzp-offer-note').isVisible(),false,'notice clears with the coupon');
   }
   assert.match(await page.locator('#summary-total').textContent(),country==='IN'?/916\.98/:/2,038\.98/);
   await page.getByRole('link',{name:'Edit billing details',exact:true}).first().click();await page.waitForURL('**/checkout.html');
   await page.locator('#customer-verification').waitFor({state:'visible'});
   await page.waitForFunction(()=>/reward/.test(document.querySelector('#loyalty-status').textContent));
   assert.equal(await page.locator('#loyalty-send').isVisible(),false);
   await page.selectOption('#billing','yearly');
   await page.waitForFunction(()=>document.documentElement.dataset.billingBlocked==='false');
   await page.locator('[data-continue-payment]').click();await page.waitForURL('**/payment.html');
   await page.waitForFunction(()=>document.querySelector('#summary-total').textContent.includes('8,803.01')||document.querySelector('#summary-total').textContent.includes('19,574.21'));
   assert.equal(await page.locator('#annual-summary-row').isVisible(),true);
   if(country==='IN'){
    await page.locator('.razorpay-panel').screenshot({path:'/tmp/razorpay-checkout-'+width+'.png'});
    const rzp=()=>page.evaluate(()=>window.__rzp?.opened||0),last=()=>[...app.razorpay.subscriptions.values()].at(-1);
    const fire=(name,arg)=>page.evaluate(([name,arg])=>{const r=window.__rzp;if(name==='dismiss')r.options.modal.ondismiss();else if(name==='paid')r.options.handler({razorpay_payment_id:'pay_browser'});else r.events[name](arg);},[name,arg]);
    // 1. Buyer closes the Razorpay window: message changes at once and the unpaid subscription is cancelled.
    await page.locator('[data-razorpay-start]').click();await page.waitForFunction(()=>window.__rzp?.opened===1);
    assert.equal(app.razorpay.subscriptions.size,1);assert.equal((await page.evaluate(()=>window.__rzp.options.key)),'rzp_test_fixture');
    await fire('dismiss');await page.waitForFunction(()=>document.querySelector('.razorpay-status').textContent.includes('Payment cancelled. No money was taken'));
    await page.waitForFunction(()=>!document.querySelector('[data-razorpay-check]').checkVisibility());
    for(let i=0;i<50&&last().status!=='cancelled';i++)await page.waitForTimeout(100);assert.equal(last().status,'cancelled');
    // 2. Payment fails, then the buyer closes the window.
    await page.locator('[data-razorpay-start]').click();await page.waitForFunction(()=>window.__rzp?.opened===2);
    assert.equal(app.razorpay.subscriptions.size,2);
    await fire('payment.failed',{error:{description:'Your card was declined'}});await page.waitForFunction(()=>document.querySelector('.razorpay-status').textContent.includes('Payment failed: Your card was declined.'));
    await fire('dismiss');await page.waitForFunction(()=>document.querySelector('.razorpay-status').textContent.includes('No money was taken'));
    for(let i=0;i<50&&last().status!=='cancelled';i++)await page.waitForTimeout(100);assert.equal(last().status,'cancelled');
    assert.equal(app.orders.rows.length,2);
    // 3. Successful payment goes straight to the thank-you page.
    await page.locator('[data-razorpay-start]').click();await page.waitForFunction(()=>window.__rzp?.opened===3);
    assert.equal(app.razorpay.subscriptions.size,3);
    const sub=last(),amount=app.razorpay.plans.get(sub.plan_id).item.amount;sub.status='active';sub.paid_count=1;
    const invoice={id:'inv_browser',subscription_id:sub.id,payment_id:'pay_browser',paid_at:Math.floor(Date.now()/1000),status:'paid',currency:'INR',amount_paid:amount};
    app.razorpay.invoices.set(invoice.id,invoice);app.razorpay.payments.set(invoice.payment_id,{id:invoice.payment_id,invoice_id:invoice.id,status:'captured',captured:true,currency:'INR',amount,amount_refunded:0});
    await fire('paid');await page.waitForURL('**/thank-you.html?**');await page.waitForFunction(()=>document.querySelector('.ty-main').dataset.tyState==='confirmed');
    assert.match(await page.locator('main').textContent(),/within 12 hours/);assert.match(await page.locator('main').textContent(),/starts when you activate/);
    assert.equal(await page.locator('#ty-provider').textContent(),'Razorpay');assert.equal(await page.locator('#ty-billing').textContent(),'Yearly');
    await page.waitForTimeout(1200);await page.screenshot({path:'/tmp/thank-you-'+width+'.png',fullPage:true});
    assert.equal(app.orders.rows.length,3);assert.equal(app.mails.length,2);
   }else{
    await page.getByRole('radio',{name:/PayPal/}).check();
    await page.locator('.paypal-box').waitFor({state:'visible'});assert.equal(await page.locator('.razorpay-panel').isVisible(),false);
    await page.waitForTimeout(600);await page.locator('.payment-picker').screenshot({path:'/tmp/picker-'+width+'.png'});await page.locator('.paypal-box').screenshot({path:'/tmp/paypal-card-'+width+'.png'});
   }
  }else{
   await page.waitForTimeout(700);assert.equal(await page.locator('.razorpay-panel').isVisible(),false);assert.equal(await page.locator('.payment-picker').isVisible(),country==='US');
   if(country!=='US'){
    await page.locator('.billing-review').waitFor({state:'visible'});assert.equal(await page.locator('.paypal-box').isVisible(),false);
    if(width<800)assert.equal(await page.locator('.m-total button').textContent(),'Review billing');
    await page.locator('[data-review-billing]').click();await page.waitForFunction(()=>document.querySelector('.billing-review-status').textContent.includes('not been submitted'));
    assert.equal(app.razorpay.subscriptions.size,0);assert.equal(app.mails.length,0);assert.equal(app.orders.rows.length,2);
   }else assert.equal(await page.locator('.billing-review').isVisible(),false);
  }
  if(country==='IN'){
   await page.evaluate(()=>localStorage.removeItem('ajoy.acct'));
   await page.goto(new URL('wrapline.html',base).href);
   try{await page.waitForFunction(enabled=>document.querySelector('[data-buy="online"]')?.textContent.includes(enabled?'Start 2-day free trial':'Review billing'),enabled,{timeout:10000});}
   catch(error){console.error({country,enabled,errors,cta:await page.locator('[data-buy="online"]').textContent(),href:await page.locator('[data-buy="online"]').getAttribute('href')});throw error;}
   assert.match(await page.locator('[data-buy="online"]').getAttribute('href'),/checkout\.html/);
   if(enabled){await page.locator('[data-bill="yearly"]').click();await page.waitForFunction(()=>document.querySelector('[data-amt="online"]').textContent.includes('8,803.01'));}
  }
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
  console.log(`${country}, Razorpay ${enabled?'enabled':'disabled'}, ${width}px ${theme}${legacy?' legacy config':''}: provider gates and checkout passed`);
  await context.close();
 }
 console.log('Payment-provider browser checks passed with local payment fixtures only.');
}finally{await browser.close();}
