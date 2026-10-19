/* Loop only the folder highlights; the actual instructions and file list stay readable. */
const illustration=document.querySelector('[data-ffmpeg-visual]');
if(illustration){
 const preference=matchMedia('(prefers-reduced-motion: reduce)');
 let visible=false,timer,phase=0;
 const stop=()=>{clearTimeout(timer);illustration.removeAttribute('data-ff-active');};
 const schedule=()=>{
  stop();
  if(!visible||document.hidden||preference.matches)return;
  illustration.setAttribute('data-ff-active','');
  timer=setTimeout(()=>{
   phase=1-phase;illustration.dataset.ffPhase=String(phase);schedule();
  },3200);
 };
 if('IntersectionObserver'in window){
  new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;schedule();},{threshold:.1}).observe(illustration);
 }
 document.addEventListener('visibilitychange',schedule);
 preference.addEventListener('change',()=>{
  if(preference.matches){phase=0;illustration.dataset.ffPhase='0';}
  schedule();
 });
}
