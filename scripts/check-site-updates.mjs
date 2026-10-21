/* Browser regressions with local services: no real emails, customer records or uploads. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {service} from '../tests/helpers/apps-service.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=new URL(process.argv[2]||'http://127.0.0.1:8798/');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64');
async function context(options={}){
 const ctx=await browser.newContext(options);
 await ctx.route('**/*',route=>{
  const url=route.request().url();
  if(new URL(url).origin===base.origin)return route.continue();
  if(url.includes('paypal-config'))return route.fulfill({json:{country:'US',plans:{},closedCountries:[]}});
  return route.abort();
 });
 return ctx;
}
async function fill(page){
 await page.locator('#contact-name').fill('Maya artist');await page.locator('#contact-email').fill('artist@example.com');
 await page.locator('#contact-message').fill('Please help me with a studio installation.');await page.locator('#contact-consent').check();
}
try{
 for(const width of [320,390,768,1280])for(const theme of ['light','dark']){
  const ctx=await context({viewport:{width,height:900}});await ctx.addInitScript(theme=>localStorage.setItem('ajoy-theme',theme),theme);
  const page=await ctx.newPage();await page.goto(new URL('contact.html',base).href);
  assert.equal(await page.locator('#contact-email').getAttribute('readonly'),null);
  assert.equal(await page.locator('.required-star').count(),5);await fill(page);
  assert.equal(await page.locator('#contact-draft-progress').evaluate(el=>el.value),4);
  await page.locator('#contact-file').setInputFiles({name:'scene.png',mimeType:'image/png',buffer:png});
  await page.locator('#attachment-preview').waitFor({state:'visible'});
  assert.equal(await page.locator('#contact-file').evaluate(el=>el.files.length),1);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal overflow');
  if([390,1280].includes(width))await page.screenshot({path:`/tmp/contact-${width}-${theme}.png`,fullPage:true});
  await page.locator('#attachment-remove').click();assert.equal(await page.locator('#contact-file').inputValue(),'');
  await ctx.close();
 }
 const ctx=await context({viewport:{width:1280,height:900}}),page=await ctx.newPage(),app=service({registered:false});
 app.values.set('CONTACT_GITHUB_TOKEN','test-only-private-token');
 await ctx.route('https://script.google.com/**',async route=>{
  await new Promise(resolve=>setTimeout(resolve,350));
  const result=app.ctx.doPost({postData:{contents:route.request().postData()}});
  await route.fulfill({contentType:'application/json',body:result.text});
 });
 await page.goto(new URL('contact.html',base).href);await fill(page);
 await page.locator('#contact-file').setInputFiles({name:'scene.png',mimeType:'image/png',buffer:png});
 await page.locator('#attachment-preview').waitFor({state:'visible'});await page.locator('#contact-form [type=submit]').click();
 await page.waitForFunction(()=>document.querySelector('.contact-art').dataset.state==='sending'&&!document.querySelector('#attachment-progress').hasAttribute('value'));
 await page.waitForFunction(()=>document.querySelector('#contact-status').textContent.includes('Message received'));
 assert.equal(app.github.uploads,1);assert.equal(app.sheets.get('Contacts').rows.length,2);assert.equal(app.mails.length,0);assert(!app.sheets.has('Accounts'));
 assert.equal(await page.locator('#contact-draft-progress').evaluate(el=>el.value),0);
 // A guest can send a text-only message without an account or repository credentials.
 app.values.delete('CONTACT_GITHUB_TOKEN');await fill(page);await page.locator('#contact-message').fill('A second text-only question for the maker.');
 await page.locator('#contact-form [type=submit]').click();await page.waitForFunction(()=>document.querySelector('#contact-status').textContent.includes('Message received'));
 assert.equal(app.sheets.get('Contacts').rows.length,3);assert.equal(app.github.uploads,1);
 // Price changes visibly interpolate, settle exactly and survive rapid toggles.
 await page.goto(new URL('wrapline.html',base).href);await page.locator('[data-amt=online]').scrollIntoViewIfNeeded();
 await page.waitForFunction(()=>document.querySelector('[data-amt=online]').textContent.includes('22'));
 await page.locator('[data-bill=yearly]').click();await page.waitForFunction(()=>document.querySelector('[data-amt=online] span[aria-hidden]'));
 await page.waitForFunction(()=>document.querySelector('[data-amt=online]').textContent.includes('215.22'));
 await page.locator('[data-bill=monthly]').click();await page.locator('[data-bill=yearly]').click();await page.locator('[data-bill=monthly]').click();
 await page.waitForFunction(()=>document.querySelector('[data-amt=online]').textContent==='$22.44');
 // License illustration resumes on entry, pauses offscreen, and respects motion preferences.
 await page.locator('.card-stage').scrollIntoViewIfNeeded();await page.waitForFunction(()=>document.querySelector('.card-stage').hasAttribute('data-license-active'));
 assert.equal(await page.locator('.license-seat').count(),3);
 assert.equal(await page.locator('.license-float').evaluate(el=>getComputedStyle(el).animationPlayState),'running');
 await page.screenshot({path:'/tmp/license-illustration.png',fullPage:false});
 await page.evaluate(()=>scrollTo(0,0));await page.waitForFunction(()=>!document.querySelector('.card-stage').hasAttribute('data-license-active'));
 await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('.license-float').evaluate(el=>getComputedStyle(el).animationName),'none');
 await ctx.close();
 // Use the actual browser detection module to exercise the secondary provider and regional UI.
 const regional=await context(),regionPage=await regional.newPage(),lookups=[];
 await regional.route('**/*',route=>{
  const url=route.request().url();
  if(new URL(url).origin===base.origin)return route.continue();
  if(url.includes('paypal-config'))return route.fulfill({json:{country:'',plans:{},closedCountries:[]}});
  if(url.includes('api.country.is')){lookups.push('country.is');return route.fulfill({status:503,body:'unavailable'});}
  if(url.includes('get.geojs.io')){lookups.push('GeoJS');return route.fulfill({json:{country:'IN'}});}
  return route.abort();
 });
 await regionPage.goto(new URL('wrapline.html',base).href);
 await regionPage.waitForFunction(()=>sessionStorage.getItem('ajoy.geo')==='IN'&&document.querySelector('[data-amt=online]').textContent.includes('916.98'));
 assert(lookups.includes('country.is')&&lookups.includes('GeoJS'));
 assert.match(await regionPage.locator('[data-buy=online]').getAttribute('href'),/^checkout\.html\?plan=online/,'India buys through checkout (Razorpay), not a contact form');await regional.close();
 // Forced preview is discoverable, uses real account actions and does not consume the cooldown.
 const guest=await context({viewport:{width:390,height:844}}),gp=await guest.newPage();
 await gp.goto(new URL('index.html?preview=registration',base).href);await gp.locator('.guest-prompt').waitFor({state:'visible'});
 assert.equal(await gp.evaluate(()=>localStorage.getItem('ajoy.guest.lastShown')),null);
 await gp.locator('[data-guest-register]').click();await gp.locator('#account-dialog').waitFor({state:'visible'});
 assert.match(await gp.locator('#acct-title').textContent(),/Your email. One account/);await guest.close();
 // Actual sign-out, without reloading, samples the guest invitation again.
 const returning=await context(),rp=await returning.newPage();
 await returning.addInitScript(()=>{Math.random=()=>.1;localStorage.setItem('ajoy.acct',JSON.stringify({token:'mock-returning-account-token',email:'buyer@example.com',expiresAt:Date.now()+864e5,subscriptions:[]}));});
 await rp.goto(new URL('index.html',base).href);await rp.locator('.acct-btn').click();await rp.locator('[data-out]').click();await rp.keyboard.press('Escape');
 await rp.locator('.guest-prompt').waitFor({state:'visible',timeout:16000});await returning.close();
 // Random maker entrances run on an eligible visit, then respect their cooldown.
 const maker=await context(),mp=await maker.newPage();await maker.addInitScript(()=>{Math.random=()=>.1;});
 await mp.goto(new URL('index.html',base).href);assert.equal(await mp.locator('html').getAttribute('data-maker-motion'),'play');
 await mp.reload();assert.equal(await mp.locator('html').getAttribute('data-maker-motion'),'play','plays on every visit');await maker.close();
 console.log('Site updates passed: 8 contact layouts, real form-to-mocked-Sheets/private-GitHub flow, text-only guest, exact animated prices, license pause/reduced motion, invitation preview, sign-out resampling and maker cooldown.');
}finally{await browser.close();}
