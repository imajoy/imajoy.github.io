/* "Buy me a coffee" pop-up for the download, thank-you and tool pages (never the landing page).
   Clicking it opens our own support page (support.html), where people give any amount in USD (PayPal) or INR (Razorpay, India).
   It appears after a few seconds or once the visitor has scrolled a little, and stays away for a day after it is closed. */
const KEY='ajoy.coffee';
const target='support.html';

const quiet=()=>{try{if(sessionStorage.getItem(KEY))return true;const v=JSON.parse(localStorage.getItem(KEY)||'null');return !!v&&Date.now()<v.until;}catch{return false;}};
/* days=0: only for this visit (new visit = shows again). days>0: stay away that long. */
const rest=days=>{try{if(days>0)localStorage.setItem(KEY,JSON.stringify({until:Date.now()+days*864e5}));else sessionStorage.setItem(KEY,'1');}catch{}};
const calm=matchMedia('(prefers-reduced-motion: reduce)').matches;

if(!quiet()&&!document.querySelector('.coffee'))setup();

function setup(){
 const root=document.createElement('aside');
 root.className='coffee';root.dataset.state='hidden';root.setAttribute('aria-label','Support Wrapline');
 root.innerHTML=`<div class="coffee-x"><div class="coffee-y"><div class="coffee-float"><div class="coffee-card">
  <a class="coffee-mug" data-coffee-link aria-label="Buy me a coffee" tabindex="-1"><svg viewBox="0 0 64 64" aria-hidden="true">
   <g class="cf-steam"><path d="M25 17c-3-3 3-5 0-9"/><path d="M33 16c-3-3 3-5 0-9"/><path d="M41 17c-3-3 3-5 0-9"/></g>
   <ellipse cx="32" cy="57" rx="22" ry="4" fill="#ffcf8a" opacity=".55"/>
   <path d="M47 27h3a7 7 0 0 1 0 14h-4" fill="none" stroke="#e58a3e" stroke-width="4" stroke-linecap="round"/>
   <path d="M13 22h36v18a15 15 0 0 1-15 15h-6A15 15 0 0 1 13 40Z" fill="#fff7ec" stroke="#e58a3e" stroke-width="3" stroke-linejoin="round"/>
   <path d="M15 26h32" stroke="#a8643a" stroke-width="5" stroke-linecap="round" opacity=".9"/>
   <ellipse class="cf-eye" cx="25" cy="38" rx="2" ry="2.6" fill="#3a1d05"/><ellipse class="cf-eye" cx="39" cy="38" rx="2" ry="2.6" fill="#3a1d05"/>
   <path d="M28 44q4 4 8 0" fill="none" stroke="#3a1d05" stroke-width="2.2" stroke-linecap="round"/>
   <ellipse cx="20" cy="43" rx="3.2" ry="2" fill="#ff8fa3" opacity=".7"/><ellipse cx="44" cy="43" rx="3.2" ry="2" fill="#ff8fa3" opacity=".7"/>
  </svg></a>
  <div class="coffee-copy"><b>Enjoying Wrapline?</b><span>Say thanks with a coffee. Give as much or as little as you like.</span>
   <a class="coffee-go" data-coffee-link>Buy me a coffee <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a></div>
  <button class="coffee-x-btn" type="button" aria-label="Close this message"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
 </div></div></div></div>`;
 for(const a of root.querySelectorAll('[data-coffee-link]')){a.href=target;}
 const card=root.querySelector('.coffee-card');
 let hearts,shown=false,gone=false;

 function heart(){
  if(calm||document.hidden||root.dataset.state!=='idle')return;
  const h=document.createElement('span');h.className='cf-heart';
  h.style.setProperty('--dx',(Math.random()*34-12).toFixed(0)+'px');h.style.setProperty('--rot',(Math.random()*40-20).toFixed(0)+'deg');
  h.style.left=(26+Math.random()*18).toFixed(0)+'px';
  h.innerHTML='<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.5 2.7 5 6 5c2.1 0 3.4 1.1 4.2 2.3L12 9.6l1.8-2.3C14.6 6.1 15.9 5 18 5c3.3 0 5.1 3.5 3.6 6.8C19.5 16.4 12 21 12 21Z"/></svg>';
  card.append(h);setTimeout(()=>h.remove(),2700);
 }

 function show(){
  if(shown||gone)return;shown=true;
  document.body.append(root);
  void root.offsetWidth;
  root.dataset.state='in';
  setTimeout(()=>{if(!gone){root.dataset.state='idle';heart();hearts=setInterval(heart,4200);}},calm?0:1500);
 }
 function leave(days){
  if(gone)return;gone=true;rest(days);clearInterval(hearts);
  root.dataset.state='out';setTimeout(()=>root.remove(),calm?0:1000);
  removeEventListener('scroll',onScroll);clearTimeout(timer);
 }
 root.querySelector('.coffee-x-btn').addEventListener('click',()=>leave(1));
 for(const a of root.querySelectorAll('[data-coffee-link]'))a.addEventListener('click',()=>setTimeout(()=>leave(3),400));
 addEventListener('keydown',e=>{if(e.key==='Escape'&&shown&&!gone&&!document.querySelector('dialog[open]'))leave(1);});

 const onScroll=()=>{if(scrollY>Math.max(240,innerHeight*0.2))show();};
 addEventListener('scroll',onScroll,{passive:true});
 const timer=setTimeout(()=>{if(!document.querySelector('dialog[open]'))show();else setTimeout(show,6000);},4000);
}
