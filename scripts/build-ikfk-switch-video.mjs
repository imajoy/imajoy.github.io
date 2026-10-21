/* Composes the real IK/FK Switch recordings into the guided page loop. Run against a local static server. */
import {createRequire} from 'node:module';
import {mkdirSync,rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=new URL(process.argv[2]||'http://localhost:8801/'),out='/tmp/ikfk-switch-frames',fps=60,frames='scripts/media/.ikfk-frames';
rmSync(out,{recursive:true,force:true});mkdirSync(out,{recursive:true});
for(const [name,file] of [['frame','scripts/media/ikfk-source-frame.mp4'],['range','scripts/media/ikfk-source-range.mp4']]){
 mkdirSync(`${frames}/${name}`,{recursive:true});
 execFileSync('ffmpeg',['-y','-v','error','-i',file,'-vf','fps=30','-q:v','2',`${frames}/${name}/%04d.jpg`],{stdio:'inherit'});
}
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:720,height:450},deviceScaleFactor:1.6});
 await page.goto(new URL('scripts/media/ikfk-switch-walkthrough.html',base).href);
 const seconds=await page.evaluate(()=>window.DURATION),total=Math.round(seconds*fps);
 for(let frame=0;frame<total;frame++){await page.evaluate(t=>window.renderFrame(t),frame/fps);await page.screenshot({path:`${out}/${String(frame).padStart(4,'0')}.png`});}
}finally{await browser.close();rmSync(frames,{recursive:true,force:true});}
execFileSync('ffmpeg',['-y','-v','error','-framerate',String(fps),'-i',out+'/%04d.png','-c:v','libx264','-preset','slow','-crf','22','-g','120','-pix_fmt','yuv420p','-movflags','+faststart','-an','assets/ikfk-switch-loop.mp4'],{stdio:'inherit'});
execFileSync('ffmpeg',['-y','-v','error','-framerate',String(fps),'-i',out+'/%04d.png','-c:v','libvpx-vp9','-crf','33','-b:v','0','-row-mt','1','-deadline','good','-cpu-used','2','-g','120','-pix_fmt','yuv420p','-an','assets/ikfk-switch-loop.webm'],{stdio:'inherit'});
execFileSync('ffmpeg',['-y','-v','error','-i',out+'/0000.png','-c:v','libwebp','-quality','90','-frames:v','1','assets/ikfk-switch-poster.webp'],{stdio:'inherit'});
console.log('Built the IK/FK Switch walkthrough: Frame → Range + Smart Bake → Range Switch → Timeline, 60fps MP4 + WebM + poster.');
