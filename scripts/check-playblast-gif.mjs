/* The rendered workflow and responsive 3D frame; never call remote account/payment services. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
for(const extension of ['mp4','gif']){
 const stream=JSON.parse(execFileSync('ffprobe',['-v','error','-count_frames','-show_entries','stream=width,height,nb_read_frames,duration','-of','json',`assets/playblast-loop.${extension}`],{encoding:'utf8'})).streams[0];
 assert.equal(stream.width,extension==='mp4'?1152:576);assert.equal(stream.height,extension==='mp4'?720:360);assert.equal(Number(stream.nb_read_frames),extension==='mp4'?480:320);assert(Number(stream.duration)>=15&&Number(stream.duration)<=17);
}
assert.match(execFileSync('identify',['-verbose','assets/playblast-loop.gif[0]'],{encoding:'utf8'}),/Iterations: 0/);
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=new URL(process.argv[2]||'http://localhost:8801/');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
try{
 const source=await browser.newPage({viewport:{width:720,height:450}});await source.goto(new URL('scripts/media/playblast-clicks.html',base).href);
 await source.evaluate(()=>renderFrame(2.3));assert.match(await source.locator('#headline').textContent(),/Preset loaded: Review_1080p/);
 await source.evaluate(()=>renderFrame(4.4));assert(await source.locator('#menu').isVisible());assert.deepEqual(await source.locator('#menu>div').allTextContents(),['SH_000','Shot_000']);
 let box=await source.locator('#menu').boundingBox();assert(box.y>=60&&box.y+box.height<=450,'camera menu stays in the landscape crop');
 await source.evaluate(()=>renderFrame(5.3));assert.equal(await source.locator('#menu').isVisible(),false);assert.equal(await source.locator('#placeholder').evaluate(el=>getComputedStyle(el).opacity),'0');
 await source.evaluate(()=>renderFrame(6.3));assert.match(await source.locator('#view').getAttribute('class'),/clicked/);assert.match(await source.locator('#headline').textContent(),/Maya Cam View/);
 await source.evaluate(()=>renderFrame(7.2));box=await source.locator('#cursor').boundingBox();assert(box.y>370&&box.y+box.height<=450,'Export click remains inside the crop');
 await source.evaluate(()=>renderFrame(9));assert(await source.locator('#progress').isVisible());assert.match(await source.locator('#headline').textContent(),/Export/);
 await source.evaluate(()=>renderFrame(12.7));const ok=await source.locator('.ok').boundingBox(),cursor=await source.locator('#cursor').boundingBox();assert(cursor.x>=ok.x&&cursor.x<ok.x+ok.width&&cursor.y>=ok.y&&cursor.y<ok.y+ok.height,'cursor clicks inside OK');
 await source.evaluate(()=>renderFrame(13.3));assert.equal(await source.locator('#success').isVisible(),false);assert.match(await source.locator('#headline').textContent(),/Preview saved/);await source.close();
 for(const [width,reduced,fail,dark] of [[1280,false,false,false],[768,false,false,false],[390,false,false,true],[320,false,false,false],[320,true,false,false],[390,false,true,false]]){
  const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:reduced?'reduce':'no-preference'}),page=await context.newPage(),errors=[];let mediaRequests=0;
  if(dark)await context.addInitScript(()=>localStorage.setItem('ajoy-theme','dark'));
  page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/*',route=>{const url=route.request().url();if(new URL(url).origin!==base.origin)return route.abort();if(url.includes('playblast-loop.mp4')){mediaRequests++;if(fail)return route.fulfill({status:404,body:''});}return route.continue();});
  await page.goto(new URL('tool-playblast.html',base).href);const depth=page.locator('[data-playblast-depth]'),video=page.locator('[data-playblast-video]');await depth.scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>{const img=document.querySelector('.playblast-screen');return img.complete&&img.naturalWidth===1152;});
  if(!reduced&&!fail)await page.waitForFunction(()=>document.querySelector('[data-playblast-depth]').dataset.playing==='true');
  else if(fail)await page.waitForFunction(()=>document.querySelector('[data-playblast-video]').error);
  assert.equal(await page.locator('.diagram-playblast').count(),0);assert.equal(await page.locator('.playblast-screen-steps li').count(),4);
  assert.match(await page.locator('.guide-steps').textContent(),/Only names starting with SH_ or Shot_ are detected/);
  assert.equal(await page.locator('.playblast-screens figcaption').count(),0);
  assert.deepEqual(await page.locator('.playblast-screens').evaluate(el=>{const s=getComputedStyle(el);return [s.backgroundColor,s.backgroundImage,s.borderTopWidth,s.boxShadow];}),['rgba(0, 0, 0, 0)','none','0px','none'],'no background panel');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow');
  const media=await page.locator('.playblast-media').evaluate(el=>({w:el.offsetWidth,h:el.offsetHeight}));assert(Math.abs(media.w/media.h-1.6)<.02,'landscape aspect ratio');
  const bounds=await depth.boundingBox();assert(bounds.height<450&&bounds.height<width*.9,'compact stage fits every viewport');
  const matrix=await page.locator('.playblast-device').evaluate(el=>getComputedStyle(el).transform);assert.match(matrix,/matrix3d/,'actual perspective transform');
  if(reduced){assert.equal(mediaRequests,0);assert.equal(await video.getAttribute('src'),null);assert.equal(await page.locator('.playblast-float').evaluate(el=>getComputedStyle(el).animationName),'none');}
  if(!reduced&&!fail){
   assert.equal(await video.evaluate(el=>getComputedStyle(el).opacity),'1','video fully covers the poster without double images');
   if(width===1280){await depth.hover({position:{x:30,y:30}});await page.waitForTimeout(200);assert.notEqual(await depth.evaluate(el=>el.style.getPropertyValue('--tilt-x')),'');}
   if(width===1280){await page.waitForFunction(()=>document.querySelector('video').currentTime>=7.3);assert.equal(await page.locator('.playblast-screen-steps li[aria-current="step"]').textContent(),'03Export');}
   await page.evaluate(()=>scrollTo(0,document.body.scrollHeight));await page.waitForFunction(()=>document.querySelector('[data-playblast-video]').paused);assert.equal(await depth.getAttribute('data-playing'),'false');
   await depth.scrollIntoViewIfNeeded();await page.waitForFunction(()=>document.querySelector('[data-playblast-depth]').dataset.playing==='true');assert(Math.abs((await depth.boundingBox()).height-bounds.height)<1,'stable layout');
  }
  await page.locator('.playblast-screens').screenshot({path:`/tmp/playblast-3d-${width}${reduced?'-reduce':''}${fail?'-fallback':''}.png`});
  if(!reduced&&!fail){await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>document.querySelector('[data-playblast-video]').paused);assert.equal(await depth.getAttribute('data-playing'),'false');}
  assert.deepEqual(errors,[]);await context.close();console.log(`${width}px${dark?' dark':''}${reduced?' reduced motion':''}${fail?' media fallback':''}: compact landscape, perspective, overflow and playback passed`);
 }
 const context=await browser.newContext({javaScriptEnabled:false}),page=await context.newPage();await page.goto(new URL('tool-playblast.html',base).href);await page.waitForFunction(()=>document.querySelector('.playblast-screen').complete);
 assert(await page.locator('.playblast-screen').isVisible());assert.equal(await page.locator('video').getAttribute('src'),null);await context.close();
 console.log('Load → camera → Export → OK verified; 30fps video, looping GIF and no-JavaScript still available.');
}finally{await browser.close();}
