/* Deterministic screenshot animation. Run against a local static server; never opens Maya. */
import {createRequire} from 'node:module';
import {mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=new URL(process.argv[2]||'http://localhost:8801/'),directory='/tmp/playblast-click-frames',fps=20,seconds=16;
mkdirSync(directory,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:540,height:870},deviceScaleFactor:1});
 await page.goto(new URL('scripts/media/playblast-clicks.html',base).href);await page.waitForFunction(()=>document.getElementById('base').complete);
 for(let frame=0;frame<fps*seconds;frame++){await page.evaluate(t=>window.renderFrame(t),frame/fps);await page.screenshot({path:directory+'/'+String(frame).padStart(4,'0')+'.png'});}
}finally{await browser.close();}
execFileSync('ffmpeg',['-y','-v','error','-framerate',String(fps),'-i',directory+'/%04d.png','-filter_complex','[0:v]split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=sierra2_4a:diff_mode=rectangle','-loop','0','assets/playblast-loop.gif'],{stdio:'inherit'});
execFileSync('ffmpeg',['-y','-v','error','-i',directory+'/0000.png','-c:v','libwebp','-quality','92','-frames:v','1','assets/playblast-poster.webp'],{stdio:'inherit'});
console.log(`Built ${seconds}s Playblast GIF at ${fps}fps: Load → SH_000 → Maya Cam View → Export → OK.`);
