/* Tool reviews end to end against the real Apps Script code with an in-memory Sheet; nothing remote is called. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {service} from '../tests/helpers/apps-service.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=new URL(process.argv[2]||'http://127.0.0.1:8793/');
const app=service();app.register('artist@example.com');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
const context=async({width=1280,token=null,dark=false}={})=>{
 const ctx=await browser.newContext({viewport:{width,height:900}});
 await ctx.route('**/*',async route=>{const url=route.request().url();
  if(url.includes('script.google.com')){const body=route.request().postData()||'';await new Promise(r=>setTimeout(r,150));return route.fulfill({contentType:'application/json',body:app.ctx.doPost({postData:{contents:body}}).text});}
  return new URL(url).origin===base.origin?route.continue():route.abort();});
 await ctx.addInitScript(({token,dark})=>{if(token&&!sessionStorage.getItem('seeded')){localStorage.setItem('ajoy.acct',JSON.stringify({token,email:'artist@example.com',expiresAt:Date.now()+864e5,subscriptions:[]}));sessionStorage.setItem('seeded','1');}if(dark)localStorage.setItem('ajoy-theme','dark');},{token,dark});
 return ctx;
};
const page=new URL('tool-rivet.html',base).href;
try{
 // Signed out: empty state, no badge, Write opens sign-in
 let ctx=await context(),p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(page);await p.locator('#reviews').scrollIntoViewIfNeeded();
 await p.waitForFunction(()=>document.querySelector('[data-reviews]').dataset.state==='ready');
 assert.match(await p.locator('.rv-score').textContent(),/No reviews yet/);assert.equal(await p.locator('[data-rating-badge]').isHidden(),true);
 await p.locator('.rv-write').click();await p.locator('#account-dialog[open]').waitFor();assert.deepEqual(errors,[]);await ctx.close();
 // Signed in: post, see it public, badge appears
 const token=app.ctx.makeSession_('artist@example.com');
 ctx=await context({token});p=await ctx.newPage();errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(page);await p.waitForFunction(()=>document.querySelector('[data-reviews]').dataset.state==='ready');
 await p.locator('.rv-write').click();await p.locator('.rv-form:not([hidden])').waitFor();
 await p.locator('.rv-submit').click();assert.match(await p.locator('.rv-status').textContent(),/Choose a star rating/);
 await p.locator('.rv-star[data-value="4"]').click();assert.equal(await p.locator('.rv-rating-text').textContent(),'Very good');
 await p.fill('#rv-name','Riya K');await p.fill('#rv-text','Pins props to animated meshes in seconds. Very handy for hands.');
 await p.locator('.rv-submit').click();
 await p.waitForFunction(()=>document.querySelector('.rv-submit').dataset.state==='sent');
 await p.waitForFunction(()=>document.querySelector('.rv-form').hidden&&document.querySelectorAll('.rv-card').length===1);
 assert.match(await p.locator('.rv-card').textContent(),/Riya K.*Your review.*Pins props/s);
 await p.waitForFunction(()=>document.querySelector('.rv-average')?.textContent==='4.0');/* after the count-up */
 await p.waitForFunction(()=>!document.querySelector('[data-rating-badge]').hidden);
 assert.match(await p.locator('[data-rating-badge]').textContent(),/4\.0.*1 review/);
 assert.equal(app.sheets.get('Reviews').rows[1][5],'artist@example.com');
 await p.screenshot({path:'/tmp/reviews-desktop.png',fullPage:false});
 // Edit, then remove
 await p.locator('.rv-write').click();assert.equal(await p.locator('#rv-name').inputValue(),'Riya K');
 await p.locator('.rv-star[data-value="5"]').click();await p.locator('.rv-submit').click();
 await p.waitForFunction(()=>document.querySelector('.rv-average')?.textContent==='5.0');assert.equal(app.sheets.get('Reviews').rows.length,2);
 await p.locator('.rv-write').click();await p.locator('.rv-remove').click();await p.locator('.rv-remove').click();
 await p.waitForFunction(()=>/No reviews yet/.test(document.querySelector('.rv-score').textContent));assert.equal(app.sheets.get('Reviews').rows.length,1);
 assert.deepEqual(errors,[]);await ctx.close();
 // Others' reviews are public to visitors; phone layout fits
 app.ctx.doPost({postData:{contents:JSON.stringify({type:'reviews',tool:'rivet',op:'save',rating:5,text:'Rock solid on our crowd shots, saved a day of work.',name:'Sam',accountToken:app.ctx.makeSession_('sam@example.com')})}});
 app.ctx.doPost({postData:{contents:JSON.stringify({type:'reviews',tool:'rivet',op:'save',rating:3,text:'Works, but I would like a bake option too.',name:'<b>Not bold</b>',accountToken:app.ctx.makeSession_('x@example.com')})}});
 ctx=await context({width:390,dark:true});p=await ctx.newPage();
 await p.goto(page);await p.waitForFunction(()=>document.querySelectorAll('.rv-card').length===2);
 assert.equal(await p.locator('.rv-card b',{hasText:'<b>Not bold</b>'}).count(),1,'names are shown as text, never HTML');
 await p.waitForFunction(()=>document.querySelector('.rv-average')?.textContent==='4.0');
 assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no sideways scrolling');
 await p.locator('#reviews').screenshot({path:'/tmp/reviews-phone.png'});await ctx.close();
}finally{await browser.close();}
console.log('Reviews passed: public list and badge, sign-in prompt, star picker, post, edit, remove, text-only rendering, phone layout.');
