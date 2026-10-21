/* Builds the Wrapline hero: a tree-shaken 3D bundle for mouse devices and a still image for touch screens.
   Run against a local static server: node scripts/build-scene.mjs http://127.0.0.1:8793/ */
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
const require=createRequire(import.meta.url);
const esbuild=process.env.ESBUILD||'/opt/npm-tools/node_modules/esbuild/bin/esbuild';
execFileSync(esbuild,['js/scene.js','--bundle','--minify','--format=esm','--target=es2020','--legal-comments=eof','--outfile=js/scene.bundle.js'],{stdio:'inherit'});
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=new URL(process.argv[2]||'http://127.0.0.1:8793/');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2.4}) /* portrait window: the scene uses its phone framing */;
 await page.goto(new URL('scripts/media/scene-still.html',base).href);await page.waitForSelector('body[data-ready]');
 await page.locator('#stage').screenshot({path:'/tmp/scene-still.png',omitBackground:true});
}finally{await browser.close();}
execFileSync('ffmpeg',['-y','-v','error','-i','/tmp/scene-still.png','-c:v','libwebp','-lossless','0','-quality','86','assets/scene-still.webp'],{stdio:'inherit'});
console.log('Built js/scene.bundle.js and assets/scene-still.webp');
