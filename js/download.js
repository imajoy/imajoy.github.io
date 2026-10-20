/* Registration and server verification are required before a short-lived private installer link is issued. */
import {getAccountSession,onAccountChange,openAccount,bindAccountEmail} from './account-session.js?v=20261020-ps1';
import {secureCommerce} from './commerce-gateway.js?v=20261020-country1';
const root=document.querySelector('#dl'),form=document.querySelector('#dl-form'),input=document.querySelector('#dl-email'),hint=document.querySelector('#dl-hint');
const title=document.querySelector('#dl-title'),sub=document.querySelector('#dl-sub'),status=document.querySelector('#dl-status'),start=document.querySelector('#dl-start');
bindAccountEmail(input,hint);input.readOnly=true;
let busy=false,pending=false,countdown;
const state=value=>root.setAttribute('data-state',value);
function sync(){
 const session=getAccountSession();input.readOnly=true;
 start.textContent=session?'Download Setup':'Sign in or register to download';
 document.querySelector('.download-fine').textContent='Verify your email to register an account before downloading. Your email is used for account and service messages. See the privacy notice.';
 if(!session){state('idle');clearInterval(countdown);return;}
 if(pending){pending=false;state('email');title.textContent='Your registered email.';sub.textContent='Your setup download uses this verified account.';}
}
onAccountChange(sync);sync();
start.addEventListener('click',()=>{if(!getAccountSession()){pending=true;openAccount({purpose:'download'});return;}state('email');title.textContent='Your registered email.';sub.textContent='Continue to get your setup file.';});
document.querySelector('#dl-back').addEventListener('click',()=>{if(!busy)state('idle');});
async function download(){
 if(busy)return;if(!getAccountSession()){pending=true;openAccount({purpose:'download'});return;}
 busy=true;state('working');title.textContent='Preparing your installer.';sub.textContent='Verifying your registered account…';status.textContent='Checking your account…';
 try{
  const result=await secureCommerce('download');
  const parsed=new URL(result.url);const configured=new URL(window.AJOY_CONFIG.commerceUrl);
  if(parsed.protocol!=='https:'||parsed.origin!==configured.origin)throw new Error('The installer link could not be verified.');
  const link=document.createElement('a');link.href=parsed.href;link.download='Wrapline_Setup.py';link.rel='noopener';document.body.append(link);link.click();link.remove();
  state('done');title.textContent='Your download is starting.';sub.textContent='Your browser will handle the setup file.';
  let n=3;document.querySelector('#dl-count').textContent=String(n);countdown=setInterval(()=>{document.querySelector('#dl-count').textContent=String(Math.max(0,--n));if(n<=0){clearInterval(countdown);location.href='wrapline.html#pricing';}},1000);
 }catch(error){state('email');hint.textContent=error.message;input.setAttribute('aria-invalid','true');title.textContent='Download could not start.';sub.textContent='Please retry after checking your account connection.';}
 finally{busy=false;}
}
form.addEventListener('submit',event=>{event.preventDefault();download();});
document.querySelector('#dl-again').addEventListener('click',event=>{event.preventDefault();clearInterval(countdown);download();});
document.querySelector('#dl-go').addEventListener('click',()=>clearInterval(countdown));
