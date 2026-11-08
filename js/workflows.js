/* Static workflow articles remain readable when JavaScript is unavailable. */
const showcase=document.querySelector('#workflows');
if(showcase){
 const choices=showcase.querySelector('.workflow-choices');
 const buttons=[...choices.querySelectorAll('button')];
 const panels=[...showcase.querySelectorAll('.workflow-panel')];
 const motion=matchMedia('(prefers-reduced-motion: reduce)');
 let animation;
 /* slide the pill under the active label (position and size measured from the button) */
 const place=(button,instant)=>{
  if(instant)choices.classList.add('no-anim');
  choices.style.setProperty('--tx',button.offsetLeft+'px');choices.style.setProperty('--tw',button.offsetWidth+'px');
  choices.classList.add('is-set');
  if(instant){choices.getBoundingClientRect();requestAnimationFrame(()=>choices.classList.remove('no-anim'));}
 };
 const show=(button,animate=true)=>{
  const active=button.getAttribute('aria-controls');
  animation?.cancel();
  place(button,!animate&&!choices.classList.contains('is-set'));
  buttons.forEach(item=>item.setAttribute('aria-pressed',String(item===button)));
  panels.forEach(panel=>{
   panel.hidden=panel.id!==active;
   panel.querySelector('.tool-visual').toggleAttribute('data-loop-idle',panel.hidden);
   if(!panel.hidden&&animate&&!motion.matches&&panel.animate)animation=panel.animate([
    {opacity:0,transform:'translateY(14px) scale(.992)'},{opacity:1,transform:'translateY(0) scale(1)'}
   ],{duration:480,easing:'cubic-bezier(.22,1,.36,1)'});
  });
 };
 buttons.forEach(button=>button.addEventListener('click',()=>show(button)));
 for(const link of document.querySelectorAll('[data-select-workflow]'))link.addEventListener('click',event=>{
  if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  const button=buttons.find(item=>item.getAttribute('aria-controls')===link.dataset.selectWorkflow);
  if(button)show(button,false);
 });
 choices.hidden=false;show(buttons[0],false);
 const resync=()=>place(buttons.find(b=>b.getAttribute('aria-pressed')==='true')||buttons[0],true);
 addEventListener('resize',resync);document.fonts?.ready.then(resync);
 motion.addEventListener('change',()=>{if(motion.matches)animation?.cancel();});
}
