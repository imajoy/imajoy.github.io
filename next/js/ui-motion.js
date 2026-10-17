/* Shared decorative motion. Billing data never leaves this module. */
const root=document.documentElement;
// Remove controls left by an older in-document render; motion now follows the device preference only.
document.querySelectorAll('.ui-motion-toggle, #motion-toggle').forEach(control=>control.remove());
const themeMeta=document.querySelector('meta[name="theme-color"]');
if(themeMeta)themeMeta.content=getComputedStyle(root).getPropertyValue('--bg').trim();
const media=matchMedia('(prefers-reduced-motion: reduce)');
let paused=media.matches;
function syncMotionPreference(){
 paused=media.matches;
 root.setAttribute('data-ui-motion','');
 root.toggleAttribute('data-ui-paused',paused);
 document.dispatchEvent(new CustomEvent('ajoy:motion',{detail:{paused}}));
}
media.addEventListener('change',syncMotionPreference);
syncMotionPreference();
/* Accumulated travel ignores trackpad jitter; focus always restores navigation. */
const header=document.querySelector('.site-header');
if(header){
 let previousY=Math.max(0,scrollY),travel=0,framePending=false;
 const updateHeader=()=>{
  framePending=false;
  const y=Math.max(0,Math.min(scrollY,document.documentElement.scrollHeight-innerHeight));
  const delta=y-previousY;
  previousY=y;
  if(y<100||header.querySelector(':focus-visible')){
   header.removeAttribute('data-scroll-hidden');travel=0;return;
  }
  if(!delta)return;
  if(Math.sign(delta)!==Math.sign(travel))travel=0;
  travel+=delta;
  if(travel>32){header.setAttribute('data-scroll-hidden','');travel=0;}
  else if(travel< -18){header.removeAttribute('data-scroll-hidden');travel=0;}
 };
 window.addEventListener('scroll',()=>{
  if(!framePending){framePending=true;requestAnimationFrame(updateHeader);}
 },{passive:true});
 header.addEventListener('focusin',()=>{header.removeAttribute('data-scroll-hidden');travel=0;});
}
const form=document.querySelector('#billing-form');
if(form){
 const preview=document.querySelector('.license-preview');
 const total=document.querySelector('#summary-total');
 let animation;
 const update=()=>{
  const fields=[...form.elements].filter(el=>el.required&&el.willValidate);
  const completed=fields.filter(el=>el.validity.valid).length;
  document.querySelector('.billing-completion').style.setProperty('--completion',String(fields.length?completed/fields.length:0));
  document.querySelector('#billing-completion-text').textContent=`${completed} of ${fields.length} required details complete`;
  document.querySelector('#pass-plan').textContent=form.elements.plan.value==='offline'?'Offline':'Online';
  const seats=Number(form.elements.seats.value);
  document.querySelector('#pass-seats').textContent=Number.isInteger(seats)&&seats>0&&seats<=100?`${seats} license${seats===1?'':'s'}`:'Choose quantity';
 };
 form.addEventListener('input',update);form.addEventListener('change',event=>{
  update();
  if(!paused&&!media.matches&&['plan','billing','seats'].includes(event.target.name)){
   animation?.cancel();animation=preview.animate([{opacity:.65,translate:'0 6px'},{opacity:1,translate:'0 0'}],{duration:450,easing:'cubic-bezier(.22,1,.36,1)'});
  }
 });
 let totalAnimation;
 new MutationObserver(()=>{
  if(paused||media.matches)return;
  totalAnimation?.cancel();totalAnimation=total.animate([{opacity:.35,translate:'0 4px'},{opacity:1,translate:'0 0'}],{duration:380,easing:'ease-out'});
 }).observe(total,{childList:true});
 // Country suggestions are populated by the billing module. Refresh progress
 // when its options arrive without observing or storing personal field values.
 new MutationObserver(update).observe(form.elements.country,{childList:true});update();
}

/* Reveal once on entry, then finish on a clock instead of scroll distance. */
const candidates=[...document.querySelectorAll('.reveal,main .head,.inst-copy,.faq details')];
let revealObserver;
if('IntersectionObserver' in window){
 revealObserver=new IntersectionObserver(entries=>{
  for(const entry of entries)if(entry.isIntersecting){entry.target.removeAttribute('data-soft-pending');revealObserver.unobserve(entry.target);}
 },{threshold:0,rootMargin:'0px 0px 24px 0px'});
 if(!paused&&!media.matches){
  candidates.forEach((element,index)=>{
   if(element.getBoundingClientRect().top<innerHeight*.92)return;
   element.classList.add('scroll-soft');
   element.setAttribute('data-soft-pending','');element.style.setProperty('--reveal-delay',`${index%2*40}ms`);revealObserver.observe(element);
  });
 }
 document.addEventListener('focusin',event=>{
  const panel=event.target.closest('.scroll-soft');
  if(panel){panel.removeAttribute('data-soft-pending');revealObserver?.unobserve(panel);}
 });
 document.addEventListener('ajoy:motion',event=>{
  if(event.detail.paused){document.querySelectorAll('[data-soft-pending]').forEach(element=>element.removeAttribute('data-soft-pending'));revealObserver?.disconnect();}
 });
 const loops=new IntersectionObserver(entries=>{
  for(const entry of entries)entry.target.toggleAttribute('data-loop-idle',!entry.isIntersecting);
 },{rootMargin:'60px'});
 document.querySelectorAll('.loop-graphic').forEach(element=>loops.observe(element));
}
