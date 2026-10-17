/* Shared decorative motion. Billing data never leaves this module. */
const root=document.documentElement;
const media=matchMedia('(prefers-reduced-motion: reduce)');
let paused=media.matches;
try{const saved=localStorage.getItem('ajoy-motion-paused');if(saved!==null&&!media.matches)paused=saved==='true';}catch{}
const button=document.createElement('button');
button.type='button';button.className='ui-motion-toggle';
button.innerHTML='<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3v10M11 3v10"/></svg><span></span>';
document.body.append(button);
function sync(){
 root.setAttribute('data-ui-motion','');root.toggleAttribute('data-ui-paused',paused);
 button.querySelector('span').textContent=paused?'Play motion':'Pause motion';
 button.setAttribute('aria-pressed',String(paused));
 button.querySelector('path').setAttribute('d',paused?'M5 3l8 5-8 5V3z':'M5 3v10M11 3v10');
 document.dispatchEvent(new CustomEvent('ajoy:motion',{detail:{paused}}));
}
button.addEventListener('click',()=>{paused=!paused;try{localStorage.setItem('ajoy-motion-paused',String(paused));}catch{}sync();});
media.addEventListener('change',event=>{paused=event.matches;sync();});sync();
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
  document.querySelector('#pass-seats').textContent=Number.isInteger(seats)&&seats>0&&seats<=100?`${seats} computer${seats===1?'':'s'}`:'Choose computers';
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

/* Native view timelines where supported, one-shot observation elsewhere. */
const supportsViewTimeline=CSS.supports('(animation-timeline: view()) and (animation-range: entry)');
const candidates=[...document.querySelectorAll('.reveal,main .head,.inst-copy,.checkout-form fieldset,.faq details')];
let revealObserver;
if('IntersectionObserver' in window){
 if(!supportsViewTimeline)revealObserver=new IntersectionObserver(entries=>{
  for(const entry of entries)if(entry.isIntersecting){entry.target.removeAttribute('data-soft-pending');revealObserver.unobserve(entry.target);}
 },{threshold:.04,rootMargin:'0px 0px -20px 0px'});
 if(!paused&&!media.matches){
  candidates.forEach((element,index)=>{
   if(element.getBoundingClientRect().top<innerHeight*.92)return;
   element.classList.add('scroll-soft');
   if(!supportsViewTimeline){element.setAttribute('data-soft-pending','');element.style.setProperty('--reveal-delay',`${index%2*60}ms`);revealObserver.observe(element);}
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
