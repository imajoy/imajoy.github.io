import {api,apiBase,mountTurnstile} from './commerce.js';
const status=document.querySelector('#download-status'),retry=document.querySelector('#retry'),again=document.querySelector('#download-again'),close=document.querySelector('#close-tab');
const verification=document.querySelector('#verification'),support=document.querySelector('#download-support');
let direct=false,widget,blobURL,working=false,connecting=false,closeTimer;
function unavailable(){
 /* No verification service is configured: hand over the public installer directly. */
 verification.hidden=true;retry.hidden=true;support.hidden=true;direct=true;
 document.querySelector('.download-main h1').textContent='Your download is starting.';
 document.querySelector('.download-main .sub').textContent='If nothing happens, use the button below.';
 document.querySelector('.download-step').textContent='01 / DOWNLOAD · 02 / DRAG INTO MAYA · 03 / CREATE';
 document.querySelector('.download-fine').textContent='The installer is free to download. Installing the tools requires an active license.';
 again.hidden=false;again.textContent='Download again';close.hidden=true;
 message('Starting your download…');
 setTimeout(()=>{directDownload();message('Done. Check your Downloads folder, then drag AjoyTools_Setup.py into the Maya viewport.');},700);
}
function directDownload(){
 const link=document.createElement('a');link.href='downloads/AjoyTools_Setup.py';link.download='AjoyTools_Setup.py';document.body.append(link);link.click();link.remove();
}
function message(text,error=false){status.textContent=text;status.dataset.error=String(error);}
function handoff(){
 clearTimeout(closeTimer);
 const link=document.createElement('a');link.href=blobURL;link.download='AjoyTools_Setup.py';document.body.append(link);link.click();link.remove();
 message('Verified. The download has been sent to your browser. Check your downloads, then drag the setup file into Maya.');
 close.hidden=false;again.hidden=false;
 closeTimer=setTimeout(()=>window.close(),5000);
}
async function verified(token){
 if(!token||working)return;working=true;retry.hidden=true;message('Human check complete. Preparing your installer…');
 try{
  const result=await api('/download',{method:'POST',body:JSON.stringify({token})});
  const url=new URL(result.url);
  if(url.protocol!=='https:')throw new Error('The download service returned an invalid link.');
  const response=await fetch(url.href,{signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw new Error('The installer could not be downloaded. Please verify again.');
  const blob=await response.blob();
  if(!blob.size||blob.size>5*1024*1024)throw new Error('The installer response was invalid. Please try again.');
  if(blobURL)URL.revokeObjectURL(blobURL);blobURL=URL.createObjectURL(blob);handoff();
  const currentURL=blobURL;
  setTimeout(()=>{URL.revokeObjectURL(currentURL);if(blobURL===currentURL){blobURL=null;again.hidden=true;}},60000);
 }catch(e){message(e.message,true);retry.hidden=false;}finally{working=false;}
}
async function init(){
 if(connecting)return;connecting=true;retry.disabled=true;
 retry.hidden=true;support.hidden=true;verification.hidden=true;message('Connecting to human verification…');
 if(!apiBase){unavailable();connecting=false;retry.disabled=false;return;}
 try{
  const config=await api('/config');
  if(!config.downloadsEnabled||!config.turnstileSiteKey){unavailable();return;}
  if(widget!==undefined&&window.turnstile)window.turnstile.remove(widget);
  document.querySelector('#verification').replaceChildren();
  verification.hidden=false;
  message('Complete the human check below. Your download will start automatically.');
  widget=await mountTurnstile('#verification',config.turnstileSiteKey,verified,text=>{message(text,true);retry.hidden=false;},'download');
 }catch(e){message(e.message,true);retry.hidden=false;}finally{connecting=false;retry.disabled=false;}
}
retry.addEventListener('click',init);again.addEventListener('click',()=>{if(direct){directDownload();return;}clearTimeout(closeTimer);if(blobURL)handoff();else init();});close.addEventListener('click',()=>window.close());
init();
