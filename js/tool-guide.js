/* A small illustrated step viewer. No scene code, media downloads or tracking. */
const preference=matchMedia('(prefers-reduced-motion: reduce)');
for(const figure of document.querySelectorAll('[data-tool-motion]')){
 const buttons=[...figure.querySelectorAll('[data-tool-step]')];
 let phase=0,timer,visible=false,manualUntil=0;
 const show=index=>{phase=index;figure.dataset.phase=String(index);buttons.forEach((button,i)=>button.setAttribute('aria-pressed',String(i===index)));};
 const stop=()=>{clearTimeout(timer);};
 const schedule=()=>{
  stop();if(!visible||preference.matches||document.hidden)return;
  timer=setTimeout(()=>{if(Date.now()>=manualUntil&&!figure.contains(document.activeElement))show((phase+1)%buttons.length);schedule();},2800);
 };
 buttons.forEach((button,index)=>{button.disabled=false;button.addEventListener('click',()=>{show(index);manualUntil=Date.now()+9000;schedule();});});
 if('IntersectionObserver'in window){new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;figure.toggleAttribute('data-loop-idle',!visible);schedule();},{threshold:.18}).observe(figure);}
 else{visible=true;schedule();}
 preference.addEventListener('change',schedule);document.addEventListener('visibilitychange',schedule);
}
