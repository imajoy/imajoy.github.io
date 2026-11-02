/* Free Wrapline download: free for everyone, but people sign in (or register) with their email first.
   The file comes from the same signed download service as Wrapline Pro (product "free"): Wrapline_Setup.py. */
import {getAccountSession,onAccountChange,openAccount} from './account-session.js?v=20261023-p7';
import {secureCommerce} from './commerce-gateway.js?v=20261020-country1';
const url=window.AJOY_CONFIG?.freeDownloadUrl||'';
const buttons=[...document.querySelectorAll('[data-free-download]')];
const notes=[...document.querySelectorAll('[data-free-download-note]')];
let pending=false;
function paint(){
 const signed=!!getAccountSession()?.email;
 // The email is never printed on the page; a friendly line is enough.
 for(const note of notes)note.textContent=signed?'You’re all set ✨ One click and the free toolkit is yours. No card, ever.':'Free for everyone. Sign in or register with your email to download.';
 for(const b of buttons)b.dataset.signedIn=String(signed);
}
/* The status box next to the button that was clicked (hero or the "Get it" section). */
const boxFor=button=>button?.closest('.hero-copy,.ft-get-cta')?.querySelector('[data-free-download-status]')||document.querySelector('[data-free-download-status]');
const make=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;};
/* While the private link is prepared (a few seconds), show what is happening so nobody wonders if the click worked. */
const STEPS=['Checking your free account…','Packing your 4 free tools…','Making a private download link…','Almost there, hang tight…'];
let timer=0;
function progress(button){
 const box=boxFor(button);if(!box)return;
 clearInterval(timer);box.hidden=false;box.dataset.state='working';box.replaceChildren();
 const head=make('div','fd-head'),orb=make('span','fd-orb'),title=make('b','fd-title','Getting your download ready');
 orb.setAttribute('aria-hidden','true');orb.append(make('i'),make('i'),make('i'));head.append(orb,title);
 const line=make('p','fd-line',STEPS[0]),bar=make('span','fd-bar'),fill=make('i');bar.setAttribute('aria-hidden','true');bar.append(fill);
 box.append(head,line,bar,make('p','fd-hint','This takes a few seconds. Keep this tab open.'));
 let i=0;timer=setInterval(()=>{if(i<STEPS.length-1){i++;line.classList.remove('is-swap');void line.offsetWidth;line.textContent=STEPS[i];line.classList.add('is-swap');}},1500);
}
function finished(button,href){
 const box=boxFor(button);clearInterval(timer);if(!box)return;
 box.hidden=false;box.dataset.state='done';box.replaceChildren();
 const head=make('div','fd-head'),tick=make('span','fd-tick');tick.setAttribute('aria-hidden','true');
 tick.innerHTML='<svg viewBox="0 0 24 24"><path d="M5 12.5l4.2 4.2L19 7"/></svg>';
 head.append(tick,make('b','fd-title','Your download is starting 🎉'));
 const again=make('a','fd-again','Click here');again.href=href;again.download='Wrapline_Setup.py';again.rel='noopener';
 const retry=make('p','fd-hint');retry.append('Nothing yet? ',again,' (the link works for one minute).');
 box.append(head,make('p','fd-line','Drag Wrapline_Setup.py into the Maya viewport (Maya 2023 or newer). No sign-in needed in Maya.'),retry);
 burst(button);
}
function failed(button,title,text){
 const box=boxFor(button);clearInterval(timer);if(!box)return;
 box.hidden=false;box.dataset.state=title==='queued'?'queued':'error';box.replaceChildren();
 const head=make('div','fd-head');head.append(make('b','fd-title',title==='queued'?'You’re on the list.':title));
 box.append(head,make('p','fd-line',text));
}
/* A small confetti pop from the button once the file is on its way. */
function burst(button){
 if(!button||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 const colors=['#9C8CFF','#FF9F82','#2FB583','#FFB46B','#6B5CFF'];
 for(let i=0;i<14;i++){const s=make('span','fd-confetti');const a=Math.random()*Math.PI*2,d=40+Math.random()*50;
  s.style.setProperty('--x',(Math.cos(a)*d).toFixed(0)+'px');s.style.setProperty('--y',(Math.sin(a)*d-30).toFixed(0)+'px');s.style.setProperty('--r',(Math.random()*360).toFixed(0)+'deg');
  s.style.background=colors[i%colors.length];s.style.animationDelay=(i*12)+'ms';s.setAttribute('aria-hidden','true');button.append(s);setTimeout(()=>s.remove(),1200);}
}
let busy=false;
function setBusy(button,on){
 for(const b of buttons){b.classList.toggle('is-busy',on&&b===button);if(on&&b===button)b.setAttribute('aria-busy','true');else b.removeAttribute('aria-busy');}
 const label=button?.querySelector('.fd-label');if(label)label.textContent=on?'Preparing…':'Download Wrapline';
}
async function go(button){
 if(url){location.href=url;return;}
 if(busy)return;busy=true;setBusy(button,true);progress(button);
 try{
  const result=await secureCommerce('download',{product:'free'});
  const parsed=new URL(result.url),configured=new URL(window.AJOY_CONFIG.commerceUrl);
  if(parsed.protocol!=='https:'||parsed.origin!==configured.origin)throw new Error('The download link could not be verified.');
  const link=document.createElement('a');link.href=parsed.href;link.download='Wrapline_Setup.py';link.rel='noopener';document.body.append(link);link.click();link.remove();
  finished(button,parsed.href);button?.classList.add('is-done');setTimeout(()=>button?.classList.remove('is-done'),2600);
 }catch(error){
  if(error.code==='free_not_ready')failed(button,'queued','The free Wrapline download opens very soon. We’ll email you as soon as it’s ready.');
  else if(getAccountSession())failed(button,'Download could not start.',error.message||'Please try again in a moment.');
  else{clearInterval(timer);const box=boxFor(button);if(box)box.hidden=true;}
 }finally{busy=false;setBusy(button,false);}
}
/* Wrap the button text so it can change while the file is prepared. */
for(const b of buttons){const text=[...b.childNodes].find(n=>n.nodeType===3&&n.textContent.trim());if(text){const span=make('span','fd-label',text.textContent.trim());text.replaceWith(span);}
 const spin=make('span','fd-spin');spin.setAttribute('aria-hidden','true');b.append(spin);}
let last;
/* Capture phase, so the page's smooth-scroll for "#get" links never runs: the progress card must stay next to the clicked button. */
for(const button of buttons)button.addEventListener('click',event=>{
 event.preventDefault();event.stopImmediatePropagation();last=button;
 if(!getAccountSession()){pending=true;openAccount({purpose:'free-download'});return;}
 go(button);
},{capture:true});
onAccountChange(()=>{paint();if(pending&&getAccountSession()){pending=false;go(last);}});
paint();
