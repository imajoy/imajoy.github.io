/* Free Wrapline download: free for everyone, but people sign in (or register) with their email first.
   The file comes from the same signed download service as Wrapline Pro (product "free"): Wrapline_Setup.py. */
import {getAccountSession,onAccountChange,openAccount} from './account-session.js?v=20261023-p7';
import {secureCommerce} from './commerce-gateway.js?v=20261020-country1';
const url=window.AJOY_CONFIG?.freeDownloadUrl||'';
const buttons=[...document.querySelectorAll('[data-free-download]')];
const notes=[...document.querySelectorAll('[data-free-download-note]')];
let pending=false;
function paint(){
 const who=getAccountSession()?.email;
 for(const note of notes){
  note.replaceChildren();
  if(who){note.append('Signed in as ');const b=document.createElement('b');b.textContent=who;note.append(b,'. Free, no card needed.');}
  else note.textContent='Free for everyone. Sign in or register with your email to download.';
 }
 for(const b of buttons)b.dataset.signedIn=String(!!who);
}
function queued(button,who){
 const box=document.querySelector('[data-free-download-status]');
 if(box){box.hidden=false;box.replaceChildren();const t=document.createElement('b');t.textContent='You’re on the list.';box.append(t,' The free Wrapline download opens very soon. We’ll email ');const e=document.createElement('span');e.textContent=who||'you';box.append(e,' as soon as it’s ready.');box.focus?.();}
 button?.classList.add('is-queued');
}
function said(text,good){
 const box=document.querySelector('[data-free-download-status]');
 if(!box)return;box.hidden=false;box.replaceChildren();const t=document.createElement('b');t.textContent=good?'Your download is starting.':'Download could not start.';box.append(t,' '+text);
}
let busy=false;
async function go(button){
 const who=getAccountSession()?.email;
 if(url){location.href=url;return;}
 if(busy)return;busy=true;button?.classList.add('is-busy');button?.setAttribute('aria-busy','true');
 try{
  const result=await secureCommerce('download',{product:'free'});
  const parsed=new URL(result.url),configured=new URL(window.AJOY_CONFIG.commerceUrl);
  if(parsed.protocol!=='https:'||parsed.origin!==configured.origin)throw new Error('The download link could not be verified.');
  const link=document.createElement('a');link.href=parsed.href;link.download='Wrapline_Setup.py';link.rel='noopener';document.body.append(link);link.click();link.remove();
  said('Drag Wrapline_Setup.py into the Maya viewport (Maya 2023 or newer). No sign-in needed in Maya.',true);
 }catch(error){
  if(error.code==='free_not_ready')queued(button,who);
  else if(getAccountSession())said(error.message||'Please try again in a moment.',false);
 }finally{busy=false;button?.classList.remove('is-busy');button?.removeAttribute('aria-busy');}
}
let last;
for(const button of buttons)button.addEventListener('click',event=>{
 event.preventDefault();last=button;
 if(!getAccountSession()){pending=true;openAccount({purpose:'free-download'});return;}
 go(button);
});
onAccountChange(()=>{paint();if(pending&&getAccountSession()){pending=false;go(last);}});
paint();
