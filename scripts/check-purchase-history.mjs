/* Account archive in the browser; payment and account services are mocked. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=new URL(process.argv[2]||'http://localhost:8803/'),browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
const ref='11111111-1111-4111-8111-111111111111',token='test-session-token-123456789';
const invoice={number:'WL-202610-0001',date:'2026-10-25T00:00:00Z',plan:'Wrapline Basic · Monthly',billing:'Monthly',seats:1,amount:899,currency:'INR',provider:'Razorpay',paymentId:'pay_sample',subscriptionId:'sub_sample'};
const sub={plan:'online',billing:'monthly',seats:1,status:'ACTIVE',endsAt:new Date(Date.now()+30*864e5).toISOString(),trial:false,renews:true,provider:'razorpay',ref};
try{
 for(const width of [390,1280]){
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:width===390?'reduce':'no-preference'});
  await context.addInitScript(({token,sub})=>localStorage.setItem('ajoy.acct',JSON.stringify({token,email:'buyer@example.com',expiresAt:Date.now()+864e5,subscriptions:[sub]})),{token,sub});
  let currentSub=sub,legacy=false;
  await context.route('**/*',route=>{
   const url=route.request().url();if(new URL(url).origin===base.origin)return route.continue();
   if(url.includes('script.google.com')){const step=JSON.parse(route.request().postData()||'{}').step;return route.fulfill({json:legacy&&step==='history'?{ok:false,error:'email'}:{ok:true,email:'buyer@example.com',subscriptions:[currentSub],...(legacy?{}:{invoices:[invoice]})}});}
   return route.abort();
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(new URL('wrapline.html',base).href);await page.locator('[data-account-button]').click();
  assert(await page.locator(`.acct-history[href="thank-you.html?subscription=${ref}"]`).isVisible());
  await page.locator('.acct-history').click();await page.waitForURL('**/thank-you.html?subscription=*');
  await page.getByText('Invoice WL-202610-0001').waitFor();assert.equal(await page.locator('.ty-main').getAttribute('data-ty-state'),'confirmed');
  assert.match(await page.locator('#ty-title').textContent(),/Welcome to Wrapline/);
  assert(await page.locator('.ty-timeline').isVisible());assert(await page.locator('#ty-key').isVisible());
  assert(await page.getByText('pay_sample').isVisible(),'first invoice is open by default');
  assert(await page.locator('.ty-print').isVisible());assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.waitForFunction(()=>[document.querySelector('.ty-pass'),...document.querySelectorAll('.ty-timeline li')].every(el=>Number(getComputedStyle(el).opacity)>.99));
  await page.screenshot({path:'/tmp/thank-you-restored-'+width+'.png',fullPage:true});
  await page.reload();await page.getByText('Invoice WL-202610-0001').waitFor();
  await page.getByRole('button',{name:'Refresh invoices',exact:true}).click();await page.getByRole('button',{name:'Refresh invoices',exact:true}).waitFor();
  assert.equal(await page.locator('.ty-invoice').count(),1,'refresh does not duplicate invoices');
  currentSub={...sub,plan:'offline'};
  await page.goto(new URL('thank-you.html?subscription='+ref,base).href);await page.getByText('Invoice WL-202610-0001').waitFor();
  assert.equal(await page.locator('#ty-plan').textContent(),'Premium plan');
  assert.equal(await page.locator('#ty-key').getAttribute('aria-label'),'Your license key details');
  assert.match(await page.locator('#ty-step-key').textContent(),/key sent to your verified email/);
  currentSub=sub;
  await page.goto(new URL('thank-you.html?provider=razorpay&plan=online&billing=monthly',base).href);await page.getByText('Invoice WL-202610-0001').waitFor();
  assert(await page.locator('.ty-timeline').isVisible(),'normal checkout keeps original design and loads invoices');
  currentSub={...sub,status:'EXPIRED',endsAt:new Date(Date.now()-864e5).toISOString()};
  await page.goto(new URL('thank-you.html?subscription='+ref,base).href);await page.getByText('Invoice WL-202610-0001').waitFor();
  assert(await page.locator('.ty-side').isHidden(),'confirmation ends with subscription, invoice remains');
  currentSub=sub;legacy=true;await page.goto(new URL('thank-you.html?subscription='+ref,base).href);
  await page.getByText('Online invoices are being connected.',{exact:false}).waitFor();
  assert.equal(await page.locator('.ty-main').getAttribute('data-ty-state'),'confirmed','older service still reopens a verified confirmation');
  assert.deepEqual(errors.filter(error=>!error.includes('ViewTransition opt-in disabled')),[]);
  await context.close();
 }
 const context=await browser.newContext(),page=await context.newPage();await context.route('**/*',route=>new URL(route.request().url()).origin===base.origin?route.continue():route.abort());
 await page.goto(new URL('thank-you.html?history=1',base).href);assert.equal(await page.locator('.ty-main').getAttribute('data-ty-state'),'problem');
 assert.equal(await page.locator('.ty-invoice').count(),0);await context.close();
 console.log('Purchase history passed: account link, verified reopened confirmation, invoices, reload, phone/desktop, and signed-out privacy.');
}finally{await browser.close();}
