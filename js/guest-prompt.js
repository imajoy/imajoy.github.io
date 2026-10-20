import {getAccountSession,onAccountChange,openAccount} from './account-session.js?v=20261020-ps1';
import {canShowGuestPrompt,PROMO_DELAY} from './promotion-policy.js?v=20261019-contact1';
// Only the two discovery homepages: never interrupt checkout, support or legal reading.
if(window.AJOY_CONFIG?.accountOpen&&document.body.matches('.studio-page:not(.contact-page),.home-page')){
 let prompt=null,eligible=false,timer,deadline=0,wasSignedIn=!!getAccountSession();
 const preview=new URLSearchParams(location.search).get('preview')==='registration';
 const shownKey='ajoy.guest.lastShown',sessionKey='ajoy.discovery.nudge';
 function sample(){
  if(preview)return !getAccountSession();
  try{return canShowGuestPrompt({now:Date.now(),lastShown:Math.max(Number(localStorage.getItem(shownKey))||0,Number(localStorage.getItem('ajoy.promo.trial.lastShown'))||0),sessionSeen:sessionStorage.getItem(sessionKey)==='1'||sessionStorage.getItem('ajoy.promo.trial.seen')==='1',signedIn:!!getAccountSession(),random:Math.random()});}catch{return false;}
 }
 function schedule(delay=PROMO_DELAY){
  clearTimeout(timer);deadline=Date.now()+delay+60000;
  const attempt=()=>{show();if(eligible&&!document.hidden&&Date.now()<deadline)timer=setTimeout(attempt,1500);};
  timer=setTimeout(attempt,delay);
 }
 eligible=sample();
 const close=()=>{if(!prompt)return;const focused=prompt.contains(document.activeElement);if(typeof prompt.hidePopover==='function'&&prompt.matches(':popover-open'))prompt.hidePopover();prompt.hidden=true;if(focused&&!document.querySelector('dialog[open]'))document.querySelector('[data-account-button]')?.focus({preventScroll:true});};
 function show(){
  if(!eligible||getAccountSession()||document.hidden||!document.querySelector('#account-dialog'))return;
  if(document.querySelector('dialog[open],.trial-nudge:not([hidden])')||document.activeElement?.closest('input,textarea,select,[contenteditable=true]'))return;
  try{
   if(!preview&&(sessionStorage.getItem(sessionKey)==='1'||sessionStorage.getItem('ajoy.promo.trial.seen')==='1'||Date.now()-Number(localStorage.getItem(shownKey)||0)<7*864e5))return;
   if(!preview){sessionStorage.setItem(sessionKey,'1');localStorage.setItem(shownKey,String(Date.now()));}
  }catch{return;}
  eligible=false;clearTimeout(timer);prompt?.remove();prompt=document.createElement('aside');prompt.className='guest-prompt';prompt.setAttribute('aria-labelledby','guest-title');prompt.setAttribute('role','region');
  prompt.innerHTML='<button class="guest-close" type="button" aria-label="Dismiss account invitation">×</button><p class="guest-kicker">YOUR AJOY TOOLS ACCOUNT</p><h2 id="guest-title">A little less setup.<br>A little more creating.</h2><p>Register your email for downloads and subscriptions, or log in to see your existing plans.</p><div class="guest-actions"><button class="btn btn-dark" type="button" data-guest-register>Register / Login</button></div><button class="guest-later" type="button">Maybe later</button>';
  if(typeof prompt.showPopover==='function')prompt.setAttribute('popover','auto');document.body.append(prompt);
  prompt.querySelector('.guest-close').onclick=close;prompt.querySelector('.guest-later').onclick=close;
  prompt.querySelector('[data-guest-register]').onclick=()=>{close();openAccount({intent:'register'});};
  prompt.addEventListener('toggle',event=>{if(event.newState==='closed')prompt.hidden=true;});
  if(typeof prompt.showPopover==='function')prompt.showPopover();
  // No autofocus, scroll lock or backdrop. Escape and outside clicks dismiss it.
  document.addEventListener('keydown',event=>{if(event.key==='Escape')close();});
  document.addEventListener('pointerdown',event=>{if(!prompt.contains(event.target))close();},{capture:true});
  document.addEventListener('focusin',event=>{if(event.target.closest('input,textarea,select')&&!prompt.contains(event.target))close();});
 }
 if(eligible)schedule(preview?500:PROMO_DELAY);
 document.addEventListener('visibilitychange',()=>{if(eligible&&!document.hidden)schedule(1000);});
 onAccountChange(()=>{const signedIn=!!getAccountSession();if(signedIn){eligible=false;clearTimeout(timer);close();}else if(wasSignedIn){eligible=sample();if(eligible)schedule(preview?500:PROMO_DELAY);}wasSignedIn=signedIn;});
 document.addEventListener('ajoy-account-open',close);
 window.addEventListener('storage',event=>{if([shownKey,'ajoy.promo.trial.lastShown'].includes(event.key)){eligible=false;close();}});
}
