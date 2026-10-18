/* Static workflow articles remain readable when JavaScript is unavailable. */
const showcase=document.querySelector('#workflows');
if(showcase){
 const choices=showcase.querySelector('.workflow-choices');
 const buttons=[...choices.querySelectorAll('button')];
 const panels=[...showcase.querySelectorAll('.workflow-panel')];
 const motion=matchMedia('(prefers-reduced-motion: reduce)');
 let animation;
 const show=(button,animate=true)=>{
  const active=button.getAttribute('aria-controls');
  animation?.cancel();
  buttons.forEach(item=>item.setAttribute('aria-pressed',String(item===button)));
  panels.forEach(panel=>{
   panel.hidden=panel.id!==active;
   panel.querySelector('.tool-visual').toggleAttribute('data-loop-idle',panel.hidden);
   if(!panel.hidden&&animate&&!motion.matches&&panel.animate)animation=panel.animate([
    {opacity:.3,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}
   ],{duration:220,easing:'cubic-bezier(.2,.8,.2,1)'});
  });
 };
 buttons.forEach(button=>button.addEventListener('click',()=>show(button)));
 show(buttons[0],false);choices.hidden=false;
 motion.addEventListener('change',()=>{if(motion.matches)animation?.cancel();});
}
