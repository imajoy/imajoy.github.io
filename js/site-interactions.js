/* A cursor-lit surface, shared across product, maker and legal pages. */
if(matchMedia('(hover:hover) and (pointer:fine)').matches&&!matchMedia('(prefers-reduced-motion:reduce)').matches){
 const selector='.btn,.trial-banner,.offer-inline,.policy-highlights article,.s-card,.s-contact-card,.s-slot,.s-point,.tool-trial';
 let pending=false,target=null,x=0,y=0;
 document.addEventListener('pointermove',event=>{
  const surface=event.target.closest(selector);if(!surface)return;
  target=surface;x=event.clientX;y=event.clientY;
  if(pending)return;pending=true;
  requestAnimationFrame(()=>{pending=false;const rect=target.getBoundingClientRect();target.style.setProperty('--hover-x',`${x-rect.left}px`);target.style.setProperty('--hover-y',`${y-rect.top}px`);});
 },{passive:true});
}
