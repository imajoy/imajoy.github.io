/* Wrapline hero: touch screens get the still render (no 3D download); mouse devices load the 3D after
   the first interaction or once the page has settled, never during the initial load. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=new URL(process.argv[2]||'http://127.0.0.1:8793/');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader']});
const scene=page=>page.evaluate(()=>performance.getEntriesByType('resource').filter(e=>/scene\.bundle|three\./.test(e.name)).length);
try{
 const phone=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),pp=await phone.newPage();
 await phone.route('**/*',r=>new URL(r.request().url()).origin===base.origin?r.continue():r.abort());
 await pp.goto(new URL('wrapline.html',base).href);await pp.waitForTimeout(4000);
 assert(await pp.locator('#stage').evaluate(el=>el.hasAttribute('data-scene-still')&&/scene-still\.webp/.test(getComputedStyle(el).backgroundImage)),'touch screens show the still render');
 assert.equal(await scene(pp),0,'no 3D download on touch screens');await phone.close();
 const desk=await browser.newContext({viewport:{width:1350,height:900}}),dp=await desk.newPage();
 await desk.route('**/*',r=>new URL(r.request().url()).origin===base.origin?r.continue():r.abort());
 await dp.goto(new URL('wrapline.html',base).href,{waitUntil:'load'});await dp.waitForTimeout(800);
 assert.equal(await scene(dp),0,'3D waits until the page has settled');
 await dp.mouse.move(400,300);await dp.mouse.move(600,320);
 await dp.waitForFunction(()=>performance.getEntriesByType('resource').some(e=>/scene\.bundle/.test(e.name)),null,{timeout:5000});
 assert.equal(await dp.locator('#stage').getAttribute('data-scene-unavailable'),null);await desk.close();
 const idle=await browser.newContext({viewport:{width:1350,height:900}}),ip=await idle.newPage();
 await idle.route('**/*',r=>new URL(r.request().url()).origin===base.origin?r.continue():r.abort());
 await ip.goto(new URL('wrapline.html',base).href,{waitUntil:'load'});
 await ip.waitForFunction(()=>performance.getEntriesByType('resource').some(e=>/scene\.bundle/.test(e.name)),null,{timeout:9000});await idle.close();
}finally{await browser.close();}
console.log('Hero scene passed: touch still (no 3D download), mouse loads on first move, idle loads after the page settles.');
