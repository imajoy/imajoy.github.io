/* Real browser forms with a local Apps Script harness. No real verification emails are sent. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {service} from '../tests/helpers/apps-service.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=new URL(process.argv[2]||'http://127.0.0.1:8798/');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
try{
 for(const width of [320,390,1280])for(const theme of ['light','dark']){
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'}),app=service();
  await context.addInitScript(theme=>{localStorage.setItem('ajoy-theme',theme);localStorage.setItem('ajoy.guest.lastShown',String(Date.now()));},theme);
  await context.route('**/*',route=>{
   const req=route.request();if(new URL(req.url()).origin===base.origin)return route.continue();
   if(req.url().includes('script.google.com'))return route.fulfill({contentType:'application/json',body:app.ctx.doPost({postData:{contents:req.postData()}}).text});
   return route.abort();
  });
  const page=await context.newPage();await page.clock.install();await page.goto(new URL('index.html',base).href);
  assert.equal(await page.locator('.pillbar [data-account-button]').count(),1);
  assert.equal(await page.locator('[data-account-register]').count(),0);
  assert.equal(await page.locator('[data-account-button]').textContent(),'Register / Login');
  await page.locator('[data-account-button]').click();
  await page.locator('#acct-input').fill('new@example.com');await page.locator('.acct-form [type=submit]').click();
  await page.locator('[data-resend]').waitFor();assert.match(await page.locator('.acct-note').first().textContent(),/not registered yet/);
  assert.equal(await page.locator('#acct-input').getAttribute('autocomplete'),'one-time-code');
  assert.equal(await page.locator('#acct-countdown').textContent(),'Code expires in 2:00');
  assert(await page.locator('[data-resend]').isDisabled());assert.equal(app.sheets.has('Accounts'),false);
  await page.locator('#acct-input').fill('000000');await page.locator('.acct-form [type=submit]').click();
  await page.waitForFunction(()=>document.querySelector('#acct-message').textContent.includes('incorrect'));
  await page.clock.fastForward(121000);
  assert.equal(await page.locator('#acct-countdown').textContent(),'Code expired');assert(await page.locator('.acct-form [type=submit]').isDisabled());assert(await page.locator('[data-resend]').isEnabled());
  await page.locator('[data-resend]').click();await page.waitForFunction(()=>document.querySelector('#acct-countdown').textContent.includes('2:00'));
  assert.equal(app.mails.length,2);assert.equal(await page.locator('#acct-input').inputValue(),'');
  if(width===390)await page.screenshot({path:`/tmp/unified-account-${theme}.png`,animations:'disabled'});
  assert(await page.locator('#account-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
  const code=app.mails.at(-1).subject.match(/\d{6}/)[0];await page.locator('#acct-input').fill(code);await page.locator('.acct-form [type=submit]').click();
  await page.locator('[data-out]').waitFor();assert.equal(app.sheets.get('Accounts').rows.length,2);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('ajoy.acct')).email),'new@example.com');
  await page.locator('[data-out]').click();await page.locator('#acct-input').fill('buyer@example.com');await page.locator('.acct-form [type=submit]').click();
  await page.locator('[data-resend]').waitFor();assert.match(await page.locator('.acct-note').first().textContent(),/email is registered/);
  assert.equal(await page.evaluate(()=>localStorage.getItem('ajoy.acct')),null,'Knowing an email must not grant account access');
  const loginCode=app.mails.at(-1).subject.match(/\d{6}/)[0];await page.locator('#acct-input').fill(loginCode);await page.locator('.acct-form [type=submit]').click();await page.locator('[data-out]').waitFor();
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('ajoy.acct')).email),'buyer@example.com');
  await context.close();
 }
 const legacy=await browser.newContext({reducedMotion:'reduce'}),lp=await legacy.newPage();
 await legacy.route('**/*',route=>new URL(route.request().url()).origin===base.origin?route.continue():route.request().url().includes('script.google.com')?route.fulfill({json:{ok:true,registered:true,intent:'signin'}}):route.abort());
 await lp.goto(new URL('index.html',base).href);await lp.locator('[data-account-button]').click();await lp.locator('#acct-input').fill('buyer@example.com');await lp.locator('.acct-form [type=submit]').click();await lp.locator('[data-resend]').waitFor();
 assert.match(await lp.locator('#acct-countdown').textContent(),/Code expires in (10:00|9:59)/,'Do not claim a two-minute server deadline on an old deployment');await legacy.close();
 console.log('Unified account passed: one button, automatic registration/login detection, wrong-code errors, two-minute expiry, resend, verified session creation, existing-account protection and honest legacy compatibility; 3 sizes in light/dark.');
}finally{await browser.close();}
