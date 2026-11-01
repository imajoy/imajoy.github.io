/* Free Wrapline download: free for everyone, but people sign in (or register) with their email first.
   Set AJOY_CONFIG.freeDownloadUrl in js/site-config.js once the free setup file is ready. */
import {getAccountSession,onAccountChange,openAccount} from './account-session.js?v=20261023-p7';
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
function go(button){
 const who=getAccountSession()?.email;
 if(url){location.href=url;return;}
 const box=document.querySelector('[data-free-download-status]');
 if(box){box.hidden=false;box.replaceChildren();const t=document.createElement('b');t.textContent='You’re on the list.';box.append(t,' The free Wrapline download opens very soon. We’ll email ');const e=document.createElement('span');e.textContent=who||'you';box.append(e,' as soon as it’s ready.');box.focus?.();}
 button?.classList.add('is-queued');
}
let last;
for(const button of buttons)button.addEventListener('click',event=>{
 event.preventDefault();last=button;
 if(!getAccountSession()){pending=true;openAccount({purpose:'free-download'});return;}
 go(button);
});
onAccountChange(()=>{paint();if(pending&&getAccountSession()){pending=false;go(last);}});
paint();
