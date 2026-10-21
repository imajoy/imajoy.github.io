/* The recorded IK/FK Switch walkthrough on its tool page; never calls remote account/payment services. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
for(const extension of ['mp4','webm']){
 const stream=JSON.parse(execFileSync('ffprobe',['-v','error','-count_frames','-show_entries','stream=width,height,nb_read_frames,r_frame_rate','-of','json',`assets/ikfk-switch-loop.${extension}`],{encoding:'utf8'})).streams[0];
 assert.equal(stream.width,1152);assert.equal(stream.height,720);assert.equal(stream.r_frame_rate,'60/1');assert.equal(Number(stream.nb_read_frames),1050,'17.5s at 60fps');
}
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=new URL(process.argv[2]||'http://localhost:8801/');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
try{
 const source=await browser.newPage({viewport:{width:720,height:450}});await source.goto(new URL('scripts/media/ikfk-switch-walkthrough.html',base).href);
 for(const [t,badge,mode,text] of [[.3,'01','frame',/Select any arm or leg/],[2.3,'01','frame',/^Switch$/],[8.2,'02','range',/Smart Bake/],[12.1,'03','range',/Shift \+ drag/],[14.8,'03','range',/39 frames/],[16.3,'04','timeline',/Timeline/]]){
  await source.evaluate(t=>renderFrame(t,true),t);/* captions only: source frames exist just during a build */
  assert.equal(await source.locator('#badge').textContent(),badge);assert.match(await source.locator('#headline').textContent(),text);
  assert.equal(await source.locator('[data-mode].on').getAttribute('data-mode'),mode);
 }
 await source.close();
 for(const [width,reduced,dark] of [[1280,false,false],[390,false,true],[320,true,false]]){
  const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:reduced?'reduce':'no-preference'}),page=await context.newPage(),errors=[];
  await context.route('**/*',route=>new URL(route.request().url()).origin===base.origin?route.continue():route.abort());
  if(dark)await context.addInitScript(()=>localStorage.setItem('ajoy-theme','dark'));
  await context.addInitScript(()=>{window.preEntry=[];const watch=()=>{const f=document.querySelector('.playblast-screens');if(f&&!f.dataset.previewEntered)window.preEntry.push(getComputedStyle(f.querySelector('.playblast-arrival')).opacity);if(!f||!f.dataset.previewEntered)requestAnimationFrame(watch);};requestAnimationFrame(watch);});
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(new URL('tool-advanced-ik-fk-switch.html',base).href);
  const depth=page.locator('[data-playblast-depth]');await depth.scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>{const img=document.querySelector('.playblast-screen');return img.complete&&img.naturalWidth===1152;});
  assert.equal(await page.locator('.diagram-advanced-ik-fk-switch').count(),0,'old diagram replaced');
  assert.deepEqual(await page.locator('.playblast-screen-steps li').allTextContents(),['01Frame','02Smart Bake','03Range','04Timeline']);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow');
  const media=await page.locator('.playblast-media').evaluate(el=>({w:el.offsetWidth,h:el.offsetHeight}));assert(Math.abs(media.w/media.h-1.6)<.02,'landscape aspect ratio');
  if(reduced){assert.equal(await page.locator('[data-playblast-video]').getAttribute('src'),null,'reduced motion keeps the still');}
  else{
   assert(await page.evaluate(()=>window.preEntry.length>0&&window.preEntry.every(o=>o==='0')),'no flash before the entrance');
   await page.waitForFunction(()=>document.querySelector('[data-playblast-depth]').dataset.playing==='true');
   assert.match(await page.locator('[data-playblast-video]').evaluate(el=>el.currentSrc),/ikfk-switch-loop\.webm/);
   await page.waitForFunction(()=>document.querySelector('.playblast-screen-steps li[aria-current="step"]')?.textContent==='02Smart Bake',null,{timeout:20000});
   assert(await page.locator('[data-playblast-video]').evaluate(el=>el.currentTime>=4.55&&el.currentTime<11.35),'steps follow the video');
  }
  await page.locator('.playblast-screens').screenshot({path:`/tmp/ikfk-preview-${width}${reduced?'-reduce':''}.png`});
  assert.deepEqual(errors,[]);await context.close();console.log(`${width}px${dark?' dark':''}${reduced?' reduced motion':''}: IK/FK walkthrough passed`);
 }
}finally{await browser.close();}
console.log('Frame → Smart Bake → Range → Timeline walkthrough verified at 60fps (MP4 + WebM).');
