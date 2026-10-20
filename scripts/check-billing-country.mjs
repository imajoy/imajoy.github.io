/* Isolated browser fixtures: no real accounts, email, payments or reputation requests. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {service} from '../tests/helpers/apps-service.mjs';
import {handleCommerceRequest} from '../supabase/functions/commerce/handler.js';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=new URL(process.argv[2]||'http://localhost:8798/');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
try{
 for(const width of [390,1280]){
  const app=service();app.values.set('BILLING_POLICY_ENABLED','true');app.register('contactmy3dart@gmail.com');
  const buyer=app.ctx.makeSession_('buyer@example.com'),owner=app.ctx.makeSession_('contactmy3dart@gmail.com');
  let status='clear';const errors=[];
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'}),page=await context.newPage();
  page.on('pageerror',error=>errors.push(error.message));
  const env=k=>({ALLOWED_ORIGINS:base.origin,BILLING_POLICY_ENABLED:'true',SHEET_WEB_APP_URL:'https://script.google.com/macros/s/FIXTURE/exec'}[k]||app.values.get(k));
  await context.route('**/*',async route=>{
   const r=route.request(),url=r.url();
   if(new URL(url).origin===base.origin)return route.continue();
   if(url.includes('/paypal-config'))return route.fulfill({json:{billingPolicyEnabled:true,country:'US',mode:'live',clientId:'fixture',plans:{tiers:{high:{online:{monthly:true,yearly:true}}}}}});
   if(url.includes('/commerce/billing-context')){
    const response=await handleCommerceRequest(new Request(url,{method:'POST',headers:r.headers(),body:r.postData()}),env,async(u,o)=>Response.json(JSON.parse(app.ctx.doPost({postData:{contents:o.body}}).text)),async()=>({country:'US',status}));
    return route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:await response.text()});
   }
   if(url.includes('/razorpay/config'))return route.fulfill({json:{ok:true,enabled:false}});
   if(url.includes('/commerce/eligibility'))return route.fulfill({json:{ok:true,eligible:false,reason:'trial_used'}});
   if(url.includes('/commerce/rewards'))return route.fulfill({json:{ok:true}});
   if(url.includes('www.paypal.com/sdk/js'))return route.fulfill({contentType:'text/javascript',body:'window.paypal={Buttons(){return {render(){return Promise.resolve()}}}}'});
   return route.abort();
  });
  await page.goto(new URL('checkout.html',base).href);
  const ready=()=>page.waitForFunction(()=>document.documentElement.dataset.billingBlocked==='false');
  await ready();assert.equal(await page.locator('#country').inputValue(),'US');assert(await page.locator('#country').isDisabled());
  await page.evaluate(()=>{const f=document.querySelector('#country');f.disabled=false;f.value='CA';f.dispatchEvent(new Event('change',{bubbles:true}));});
  assert.equal(await page.locator('#country').inputValue(),'US');
  async function account(token,email){await page.evaluate(async({token,email})=>{const m=await import('./js/account-session.js?v=20261018-n1');if(token){localStorage.setItem('ajoy.acct',JSON.stringify({token,email,expiresAt:Date.now()+864e5,subscriptions:[]}));location.reload();}else m.clearAccountSession();},{token,email});if(token)await page.waitForLoadState('load');}
  status='vpn';await page.reload();await page.getByRole('heading',{name:'Turn off your VPN to continue'}).waitFor();
  assert.equal(await page.locator('.checkout-grid').isVisible(),false);
  await page.evaluate(()=>scrollTo(0,500));assert.equal(await page.locator('.m-total.on').count(),0);
  await page.locator('[data-network-signin]').click();await page.locator('#account-dialog[open]').waitFor();
  // Reload closes the local account dialog; seed a real signed owner session.
  await account(owner,'contactmy3dart@gmail.com');await ready();assert.equal(await page.locator('#country').isDisabled(),false);
  await page.selectOption('#country','CA');assert.equal(await page.locator('#country').inputValue(),'CA');
  await account(null);await page.getByRole('heading',{name:'Turn off your VPN to continue'}).waitFor();assert(await page.locator('#country').isDisabled());
  status='unavailable';await page.locator('[data-network-retry]').click();await page.getByText('We could not complete the network check.',{exact:false}).waitFor();
  assert.equal(await page.getByRole('heading',{name:'Turn off your VPN to continue'}).count(),0);
  status='clear';await page.locator('[data-network-retry]').click();await ready();assert(await page.locator('.checkout-grid').isVisible());
  await account(buyer,'contactmy3dart@gmail.com');await ready();assert(await page.locator('#country').isDisabled());
  assert.deepEqual(errors,[]);await context.close();console.log(`${width}px: server country, tampering, VPN gate, login access, verified tester, logout and retry passed`);
 }
}finally{await browser.close();}
