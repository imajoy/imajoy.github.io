/* The rendered workflow and responsive 3D frame; never call remote account/payment services. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
for(const extension of ['mp4','webm','gif']){
 const stream=JSON.parse(execFileSync('ffprobe',['-v','error','-count_frames','-show_entries','stream=width,height,nb_read_frames,duration','-of','json',`assets/playblast-loop.${extension}`],{encoding:'utf8'})).streams[0];
 const video=extension!=='gif';assert.equal(stream.width,video?1152:576);assert.equal(stream.height,video?720:360);assert.equal(Number(stream.nb_read_frames),video?960:320,'60fps video, 20fps GIF');if(extension==='mp4')assert(Number(stream.duration)>=15&&Number(stream.duration)<=17);
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
 await source.evaluate(()=>renderFrame(7.6));box=await source.locator('#cursor').boundingBox();assert(box.y>370&&box.y+box.height<=450,'Export click remains inside the crop');
 await source.evaluate(()=>renderFrame(0));box=await source.locator('.app').boundingBox();assert(box.y>=-20,'top Presets section is not clipped');
 await source.evaluate(()=>renderFrame(9));assert(await source.locator('#progress').isVisible());assert.match(await source.locator('#headline').textContent(),/Export/);
 await source.evaluate(()=>renderFrame(12.7));const ok=await source.locator('.ok').boundingBox(),cursor=await source.locator('#cursor').boundingBox();assert(cursor.x>=ok.x&&cursor.x<ok.x+ok.width&&cursor.y>=ok.y&&cursor.y<ok.y+ok.height,'cursor clicks inside OK');
 await source.evaluate(()=>renderFrame(13.3));assert.equal(await source.locator('#success').isVisible(),false);assert.match(await source.locator('#headline').textContent(),/Preview saved/);await source.close();
 for(const [width,reduced,fail,dark] of [[1280,false,false,false],[768,false,false,false],[390,false,false,true],[320,false,false,false],[320,true,false,false],[390,false,true,false]]){
  const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:reduced?'reduce':'no-preference'}),page=await context.newPage(),errors=[];let mediaRequests=0;
  await context.addInitScript(()=>{window.previewVideoStarts=[];document.addEventListener('playing',event=>{if(event.target.matches('[data-playblast-video]'))window.previewVideoStarts.push(document.querySelector('.playblast-arrival').getAnimations().some(animation=>animation.playState==='running'));},true);window.previewEntrances=[];window.previewPreEntryOpacity=[];const watch=()=>{const f=document.querySelector('.playblast-screens');if(f&&!f.dataset.previewEntered)window.previewPreEntryOpacity.push(getComputedStyle(f.querySelector('.playblast-arrival')).opacity);if(!f||!f.dataset.previewEntered)requestAnimationFrame(watch);};requestAnimationFrame(watch);document.addEventListener('animationstart',event=>{if(event.animationName.startsWith('playblast-')&&event.animationName!=='playblast-hover')window.previewEntrances.push(event.animationName);});});
  if(width===1280){const client=await context.newCDPSession(page);await client.send('Emulation.setCPUThrottlingRate',{rate:4});}
  if(dark)await context.addInitScript(()=>localStorage.setItem('ajoy-theme','dark'));
  page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/*',route=>{const url=route.request().url();if(new URL(url).origin!==base.origin)return route.abort();if(/playblast-loop\.(mp4|webm)/.test(url)){mediaRequests++;if(fail)return route.fulfill({status:404,body:''});}return route.continue();});
  await page.goto(new URL('tool-playblast.html',base).href);const depth=page.locator('[data-playblast-depth]'),video=page.locator('[data-playblast-video]');await depth.scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>{const img=document.querySelector('.playblast-screen');return img.complete&&img.naturalWidth===1152;});
  if(!reduced&&!fail)await page.waitForFunction(()=>document.querySelector('[data-playblast-depth]').dataset.playing==='true');
  else if(fail)await page.waitForFunction(()=>document.querySelector('[data-playblast-video]').error);
  if(!reduced){
   await page.waitForFunction(()=>window.previewEntrances.filter(name=>name==='playblast-step-in').length===4);
   assert.equal(await page.locator('.playblast-screens').getAttribute('data-preview-entered'),'true');
   assert(await page.evaluate(()=>window.previewPreEntryOpacity.length>0&&window.previewPreEntryOpacity.every(o=>o==='0')),'no visible flash before the entrance fade');
   assert.equal(await page.evaluate(()=>window.previewEntrances.filter(name=>name==='playblast-unfold').length),1,'one 3D entrance per page load');
   assert.deepEqual(await page.locator('.playblast-screen-steps li').evaluateAll(elements=>elements.map(el=>getComputedStyle(el).animationDelay)),['0.06s','0.1s','0.14s','0.18s']);
   await page.waitForFunction(()=>document.querySelector('.playblast-arrival').getAnimations().every(animation=>animation.playState==='finished'));
  }else{assert.equal(await page.locator('.playblast-screens').getAttribute('data-preview-entered'),null);assert.deepEqual(await page.evaluate(()=>window.previewEntrances),[]);}
  assert.equal(await page.locator('.diagram-playblast').count(),0);assert.equal(await page.locator('.playblast-screen-steps li').count(),4);
  assert.match(await page.locator('.guide-steps').textContent(),/Only names starting with SH_ or Shot_ are detected/);
  assert.equal(await page.locator('.playblast-screens figcaption').count(),0);
  assert.deepEqual(await page.locator('.playblast-screens').evaluate(el=>{const s=getComputedStyle(el);return [s.backgroundColor,s.backgroundImage,s.borderTopWidth,s.boxShadow];}),['rgba(0, 0, 0, 0)','none','0px','none'],'no background panel');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow');
  const media=await page.locator('.playblast-media').evaluate(el=>({w:el.offsetWidth,h:el.offsetHeight}));assert(Math.abs(media.w/media.h-1.6)<.02,'landscape aspect ratio');
  const bounds=await depth.boundingBox();assert(bounds.height<450&&bounds.height<width*.9,'compact stage fits every viewport');
  const matrix=await page.locator('.playblast-device').evaluate(el=>getComputedStyle(el).transform);assert(!/matrix3d/.test(matrix)||/^matrix3d\(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0,/.test(matrix),'flat window keeps UI text sharp');
  if(!fail)assert.match(await video.evaluate(el=>el.src||el.dataset.webm),/playblast-loop\.webm/,'WebM preferred where supported');
  if(reduced){assert.equal(mediaRequests,0);assert.equal(await video.getAttribute('src'),null);}
  if(!reduced&&!fail){
   assert(await page.evaluate(()=>window.previewVideoStarts.length>0&&window.previewVideoStarts.every(running=>!running)),'walkthrough begins after entrance settles');
   await page.waitForFunction(()=>getComputedStyle(document.querySelector('[data-playblast-video]')).opacity==='1');/* soft crossfade, then the video fully covers the poster */
   if(width===1280){await depth.hover({position:{x:30,y:30}});await page.waitForTimeout(200);assert.match(await depth.evaluate(el=>el.style.getPropertyValue('--tilt-x-px')),/^-?\d+px$/,'whole-pixel hover parallax');}
   if(width===1280){await page.waitForFunction(()=>document.querySelector('.playblast-screen-steps li[aria-current="step"]')?.textContent==='03Export');assert(await video.evaluate(el=>el.currentTime>=7.4&&el.currentTime<11.4));}
   await page.evaluate(()=>scrollTo(0,document.body.scrollHeight));await page.waitForFunction(()=>document.querySelector('[data-playblast-video]').paused);assert.equal(await depth.getAttribute('data-playing'),'false');
   await depth.scrollIntoViewIfNeeded();await page.waitForFunction(()=>document.querySelector('[data-playblast-depth]').dataset.playing==='true');assert(Math.abs((await depth.boundingBox()).height-bounds.height)<1,'stable layout');
  }
  if(!reduced&&!fail){assert.equal(await page.evaluate(()=>window.previewEntrances.filter(name=>name==='playblast-unfold').length),1,'scrolling back does not repeat entrance');}
  await page.locator('.playblast-screens').screenshot({path:`/tmp/playblast-3d-${width}${reduced?'-reduce':''}${fail?'-fallback':''}.png`});
  if(!reduced&&!fail&&(width===1280||dark)){
   await page.reload();await depth.scrollIntoViewIfNeeded();
   await page.waitForFunction(()=>window.previewEntrances.filter(name=>name==='playblast-unfold').length===1);
   await page.waitForFunction(()=>document.querySelector('.playblast-arrival').getAnimations().every(animation=>animation.playState==='finished'));
   assert.equal(await page.locator('.playblast-arrival').evaluate(el=>getComputedStyle(el).opacity),'1','fully visible after reload entrance');
  }
  if(!reduced&&!fail){await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>document.querySelector('[data-playblast-video]').paused);assert.equal(await depth.getAttribute('data-playing'),'false');}
  assert.deepEqual(errors,[]);await context.close();console.log(`${width}px${dark?' dark':''}${reduced?' reduced motion':''}${fail?' media fallback':''}: compact landscape, perspective, overflow and playback passed`);
 }
 const context=await browser.newContext({javaScriptEnabled:false}),page=await context.newPage();await page.goto(new URL('tool-playblast.html',base).href);await page.waitForFunction(()=>document.querySelector('.playblast-screen').complete);
 assert(await page.locator('.playblast-screen').isVisible());assert.equal(await page.locator('video').getAttribute('src'),null);await context.close();
 console.log('Load → camera → Export → OK verified; 60fps video (MP4 + WebM), looping GIF and no-JavaScript still available.');
}finally{await browser.close();}
