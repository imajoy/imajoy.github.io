/* Native form validation feedback only; external account/payment requests are blocked. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=new URL(process.argv[2]||'http://localhost:8799/');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
try{
 for(const width of [390,1280]){
  const context=await browser.newContext({viewport:{width,height:950},reducedMotion:'reduce'}),page=await context.newPage();
  await context.route('**/*',route=>new URL(route.request().url()).origin===base.origin?route.continue():route.abort());
  await page.goto(new URL('checkout.html',base).href);
  // Only exercise field feedback. The intentionally blocked network gate is not this test's subject.
  await page.evaluate(()=>document.querySelector('.checkout-grid').hidden=false);
  assert.equal(await page.locator('#tax-id, [name=taxId]').count(),0);
  assert.equal(await page.locator('.order-summary').getByText('Tax',{exact:true}).count(),0);
  const tick=id=>page.locator('#'+id).evaluate(el=>getComputedStyle(el.closest('.form-field'),'::after').content==='""');
  for(const id of ['company','region','postal','name','address','city']){
   assert.equal(await tick(id),false,`${id}: an untouched empty field must not show a tick`);
   await page.locator('#'+id).fill('Example value');await page.locator('#'+id).blur();
   assert.equal(await tick(id),true,`${id}: a valid entered value gets its tick`);
   await page.locator('#'+id).fill('');await page.locator('#'+id).blur();
   assert.equal(await tick(id),false,`${id}: clearing must remove the tick immediately`);
   await page.locator('#'+id).fill('   ');await page.locator('#'+id).blur();
   assert.equal(await tick(id),false,`${id}: whitespace alone must not show success`);
  }
  await context.close();console.log(`${width}px: required/optional field ticks, clearing and whitespace passed`);
 }
}finally{await browser.close();}
