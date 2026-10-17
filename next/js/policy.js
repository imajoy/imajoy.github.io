/* Keep long-form policy text readable; reveal once and track reading position. */
const motion=matchMedia('(prefers-reduced-motion: reduce)');
const panels=[...document.querySelectorAll('[data-policy-reveal]')];
let reveal;
if(!motion.matches&&'IntersectionObserver' in window){
 document.documentElement.setAttribute('data-policy-motion','');
 reveal=new IntersectionObserver(entries=>{
  for(const entry of entries)if(entry.isIntersecting){entry.target.setAttribute('data-policy-visible','');reveal.unobserve(entry.target);}
 },{rootMargin:'0px 0px 30px 0px',threshold:0});
 for(const panel of panels){
  if(panel.getBoundingClientRect().top<innerHeight)panel.setAttribute('data-policy-visible','');
  else reveal.observe(panel);
 }
}
motion.addEventListener('change',()=>{
 if(motion.matches){document.documentElement.removeAttribute('data-policy-motion');reveal?.disconnect();}
});
const links=[...document.querySelectorAll('.policy-index nav a')];
if('IntersectionObserver' in window){
 const reading=new IntersectionObserver(entries=>{
  for(const entry of entries)if(entry.isIntersecting){
   for(const link of links){
    if(new URL(link.href).hash==='#'+entry.target.id)link.setAttribute('aria-current','location');
    else link.removeAttribute('aria-current');
   }
  }
 },{rootMargin:'-12% 0px -65% 0px',threshold:0});
 document.querySelectorAll('.policy-section').forEach(section=>reading.observe(section));
}
document.addEventListener('focusin',event=>{
 const panel=event.target.closest('[data-policy-reveal]');
 if(panel){panel.setAttribute('data-policy-visible','');reveal?.unobserve(panel);}
});
