/* The real location request is held locally; no provider/account requests or payments. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=new URL(process.argv[2]||'http://localhost:8801/');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
try{
 for(const [width,reduced,theme] of [[320,false,'light'],[390,false,'light'],[1280,false,'dark'],[390,true,'light']]){
  const context=await browser.newContext({viewport:{width,height:950},reducedMotion:reduced?'reduce':'no-preference'}),page=await context.newPage(),errors=[];let release;
  page.on('pageerror',error=>errors.push(error.message));
  await context.addInitScript(theme=>localStorage.setItem('ajoy-theme',theme),theme);
  await context.route('**/*',async route=>{
   const url=route.request().url();if(new URL(url).origin===base.origin)return route.continue();
   if(url.includes('/paypal-config'))return route.fulfill({json:{mode:'live',country:'IN',clientId:'fixture',plans:{tiers:{}},billingPolicyEnabled:true}});
   if(url.includes('/billing-context')){const response=await new Promise(resolve=>release=resolve);return route.fulfill(response||{status:503,json:{ok:false}});}
   if(url.includes('/razorpay/config'))return route.fulfill({json:{ok:true,enabled:false}});
   return route.abort();
  });
  await page.goto(new URL('checkout.html',base).href);const gate=page.locator('.billing-network-gate');await gate.waitFor();await gate.scrollIntoViewIfNeeded();assert.equal(await page.locator('html').getAttribute('data-theme'),theme);
  const waitRequest=async()=>{const deadline=Date.now()+5000;while(!release&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,20));assert(release);};await waitRequest();
  assert.equal(await gate.getAttribute('data-state'),'checking');assert.equal(await gate.getAttribute('aria-busy'),'true');assert(await page.locator('[data-network-retry]').isDisabled());
  await page.waitForFunction(()=>document.querySelector('.billing-network-gate').dataset.motionPaused==='false');
  const running=()=>gate.evaluate(el=>el.getAnimations({subtree:true}).filter(a=>a.playState==='running'&&a.animationName?.startsWith('network-')).length);
  assert.equal((await running())>0,!reduced);
  if(!reduced){
   await page.locator('[data-network-motion]').click();assert.equal(await running(),0);
   await page.locator('[data-network-motion]').click();assert((await running())>0);
   // Motion pauses when the panel is outside the viewport.
   await gate.evaluate(el=>{const spacer=document.createElement('div');spacer.id='fixture-spacer';spacer.style.height='1800px';el.before(spacer);});await page.evaluate(()=>scrollTo(0,0));
   await page.waitForFunction(()=>document.querySelector('.billing-network-gate').dataset.motionPaused==='true');
   await page.locator('#fixture-spacer').evaluate(el=>el.remove());await gate.scrollIntoViewIfNeeded();
   await page.waitForFunction(()=>document.querySelector('.billing-network-gate').dataset.motionPaused==='false');
  }
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow');
  await gate.screenshot({path:`/tmp/billing-network-${width}-${reduced?'reduced':theme}.png`});
  release();release=null;await page.waitForFunction(()=>document.querySelector('.billing-network-gate').dataset.state==='error');
  assert.equal(await running(),0);assert.equal(await gate.getAttribute('aria-busy'),'false');assert(await page.locator('[data-network-retry]').isEnabled());
  await page.locator('[data-network-retry]').click();await waitRequest();assert.equal(await gate.getAttribute('data-state'),'checking');
  release({json:{ok:true,country:'IN',canEditCountry:false,blocked:false}});
  await gate.waitFor({state:'hidden'});assert.equal(await page.locator('#country').inputValue(),'IN');assert(await page.locator('#country').isDisabled());
  assert.deepEqual(errors,[]);await context.close();console.log(`${width}px ${theme}${reduced?' reduced motion':''}: animation, pause, error, retry and immediate verified handoff passed`);
 }
}finally{await browser.close();}
