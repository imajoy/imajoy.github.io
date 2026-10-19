/* Regression check: account layouts must not depend on product-only extras.css. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=new URL(process.argv[2]||'http://127.0.0.1:8793/');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
const subscriptions=Array.from({length:4},(_,i)=>({plan:i===3?'offline':'online',billing:i===2?'yearly':'monthly',status:'ACTIVE',seats:i===2?2:1,trial:i<2,endsAt:new Date(Date.now()+(i===2?364:30)*864e5).toISOString()}));
async function layout(page){
 const dialog=page.locator('.acct-dlg');
 assert(await dialog.isVisible());
 const rect=await dialog.boundingBox(),viewport=page.viewportSize();
 assert(Math.abs(rect.x+rect.width/2-viewport.width/2)<2,'Dialog centered horizontally');
 assert(Math.abs(rect.y+rect.height/2-viewport.height/2)<2,'Dialog centered vertically');
 assert(rect.x>=15&&rect.y>=15&&rect.x+rect.width<=viewport.width-15&&rect.y+rect.height<=viewport.height-15,'Dialog fits viewport');
 assert(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1),'No sideways scrolling');
 if(await page.locator('.acct-link').count())assert.equal(await page.locator('.acct-link').first().evaluate(el=>getComputedStyle(el).borderTopStyle),'none','Account links are styled, rather than browser-default buttons');
 else assert(await page.locator('.acct-form .btn').isVisible(),'Unified email form has a styled submit button');
 return dialog;
}
try{
 for(const [width,height] of [[320,640],[390,844],[1280,900],[640,400]]){
  for(const theme of ['light','dark']){
   const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});
   await context.addInitScript(({subscriptions,theme})=>{
    localStorage.setItem('ajoy-theme',theme);
    localStorage.setItem('ajoy.acct',JSON.stringify({token:'mock-dialog-check-token-0000',email:'a-very-long-verified-email-address@example.com',expiresAt:Date.now()+864e5,subscriptions}));
   },{subscriptions,theme});
   await context.route('**/*',route=>new URL(route.request().url()).origin===base.origin?route.continue():route.request().url().includes('script.google.com')?route.fulfill({json:{ok:true,subscriptions}}):route.abort());
   const page=await context.newPage();
   for(const file of ['index.html','contact.html','wrapline.html','checkout.html','download.html','tool-audio-exporter.html']){
    await page.goto(new URL(file,base).href);
    await page.locator('.acct-btn').click();
    const dialog=await layout(page);assert.equal(await page.locator('.acct-sub').count(),4);
    assert.equal(await page.locator('.acct-sub').first().evaluate(el=>getComputedStyle(el).display),'grid');
    assert.equal(await page.locator('.acct-sub').first().evaluate(el=>getComputedStyle(el).borderTopWidth),'1px');
    await dialog.evaluate(el=>el.scrollTop=el.scrollHeight);assert(await page.locator('[data-out]').isVisible());
    await page.keyboard.press('Escape');assert.equal(await dialog.isVisible(),false);
   }
   // Registration and code fields need the same complete styles on the maker page.
   await page.goto(new URL('index.html',base).href);await page.locator('.acct-btn').click();
   await page.locator('[data-out]').click();await layout(page);
   assert.equal(await page.locator('.acct-form input').evaluate(el=>getComputedStyle(el).borderTopWidth),'1px');
   await page.keyboard.press('Escape');await page.locator('[data-account-button]').click();await layout(page);
   assert.match(await page.locator('#acct-title').textContent(),/Your email. One account/);
   await context.close();
  }
 }
 console.log('Account dialog passed: 6 pages, 4 viewport sizes, light/dark, centered constrained layout, 4 subscription cards, internal scrolling, sign-out, login and register.');
}finally{await browser.close();}
