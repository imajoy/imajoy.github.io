/* Actual GIF/media checks; all remote account/payment requests stay blocked. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
const metadata=execFileSync('identify',['-format','%wx%h %T\n','assets/playblast-loop.gif'],{encoding:'utf8'}).trim().split('\n');
assert.deepEqual(metadata,['540x718 250','540x718 160','540x718 180','540x718 280']);
assert.match(execFileSync('identify',['-verbose','assets/playblast-loop.gif'],{encoding:'utf8'}),/Iterations: 0/);
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=new URL(process.argv[2]||'http://localhost:8801/');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
try{
 for(const [width,reduced,fail] of [[1280,false,false],[390,false,false],[320,true,false],[390,false,true]]){
  const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:reduced?'reduce':'no-preference'}),page=await context.newPage(),errors=[];let gifRequests=0;
  page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/*',route=>{const url=route.request().url();if(new URL(url).origin!==base.origin)return route.abort();if(url.endsWith('playblast-loop.gif')){gifRequests++;if(fail)return route.fulfill({status:404,body:''});}return route.continue();});
  await page.goto(new URL('tool-playblast.html',base).href);const img=page.locator('[data-playblast-gif]');await img.scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>{const img=document.querySelector('[data-playblast-gif]');return img.complete&&img.naturalWidth===540;});
  if(!reduced&&!fail)await page.waitForFunction(()=>document.querySelector('[data-playblast-gif]').dataset.playing==='true');
  else if(fail)await page.waitForFunction(()=>document.querySelector('[data-playblast-gif]').dataset.playing==='false');
  assert.equal(await page.locator('.diagram-playblast').count(),0);
  assert.equal(await page.locator('.playblast-screen-steps li').count(),3);
  assert.equal(await page.locator('.playblast-screens figcaption a').getAttribute('href'),'assets/playblast-loop.gif');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow');
  if(reduced){assert.equal(gifRequests,0);assert.match(await img.getAttribute('src'),/poster\.webp$/);}
  if(!reduced&&!fail){
   const bounds=await img.boundingBox();await page.evaluate(()=>scrollTo(0,document.body.scrollHeight));
   await page.waitForFunction(()=>document.querySelector('[data-playblast-gif]').dataset.playing==='false');assert.match(await img.getAttribute('src'),/poster\.webp$/);
   await img.scrollIntoViewIfNeeded();await page.waitForFunction(()=>document.querySelector('[data-playblast-gif]').dataset.playing==='true');
   assert.equal((await img.boundingBox()).height,bounds.height);
   await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>document.querySelector('[data-playblast-gif]').dataset.playing==='false');
  }
  await page.locator('.playblast-screens').screenshot({path:`/tmp/playblast-gif-${width}${fail?'-fallback':''}.png`});
  assert.deepEqual(errors,[]);await context.close();console.log(`${width}px${reduced?' reduced motion':''}${fail?' GIF unavailable':''}: loop, poster fallback, fixed dimensions and readable layout passed`);
 }
 const context=await browser.newContext({javaScriptEnabled:false}),page=await context.newPage();await page.goto(new URL('tool-playblast.html',base).href);await page.waitForFunction(()=>document.querySelector('.playblast-screen').complete);
 assert.match(await page.locator('.playblast-screen').getAttribute('src'),/poster\.webp$/);assert(await page.locator('.playblast-screen').isVisible());await context.close();
 console.log('GIF: four timed frames, infinite loop, direct viewing link, and no-JavaScript still verified');
}finally{await browser.close();}
