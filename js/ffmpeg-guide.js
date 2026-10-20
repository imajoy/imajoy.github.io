/* Step selection is optional: every written instruction remains visible. */
for(const walkthrough of document.querySelectorAll('[data-ff-install]')){
 const demo=walkthrough.querySelector('.ff-install-demo'),buttons=[...walkthrough.querySelectorAll('[data-ff-install-step]')],panels=[...walkthrough.querySelectorAll('[data-ff-install-panel]')],progress=[...demo.querySelectorAll('.ff-demo-progress>span')];
 const preference=matchMedia('(prefers-reduced-motion: reduce)');
 let step=0,visible=false,timer,manual=false;
 const duration=()=>step===panels.length-1?6800:4800;
 const stop=()=>{clearTimeout(timer);demo.removeAttribute('data-playing');};
 const show=index=>{
  step=index;demo.dataset.step=String(step);
  panels.forEach((panel,i)=>panel.hidden=i!==step);
  buttons.forEach((button,i)=>{button.disabled=false;button.setAttribute('aria-pressed',String(i===step));button.closest('li').toggleAttribute('data-current',i===step);});
  progress.forEach((segment,i)=>segment.toggleAttribute('data-current',i===step));
  demo.querySelector('[data-ff-install-count]').textContent=String(step+1).padStart(2,'0')+' / '+String(panels.length).padStart(2,'0');
  demo.style.setProperty('--ff-step-time',duration()+'ms');
 };
 const schedule=()=>{
  stop();if(!visible||document.hidden||preference.matches||manual||walkthrough.contains(document.activeElement))return;
  demo.setAttribute('data-playing','');
  timer=setTimeout(()=>{show((step+1)%panels.length);schedule();},duration());
 };
 demo.setAttribute('data-enhanced','');show(location.hash==='#ffmpeg-install'?3:0);
 buttons.forEach((button,index)=>button.addEventListener('click',()=>{manual=true;stop();show(index);if(!visible)demo.scrollIntoView({block:'nearest',behavior:preference.matches?'auto':'smooth'});}));
 // A deliberate step choice stays in place while the visitor follows it in Windows.
 if('IntersectionObserver' in window)new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;schedule();},{threshold:.18}).observe(demo);
 else{visible=true;schedule();}
 document.addEventListener('visibilitychange',schedule);preference.addEventListener('change',schedule);
 walkthrough.addEventListener('focusin',()=>{stop();});walkthrough.addEventListener('focusout',()=>{queueMicrotask(schedule);});
}
