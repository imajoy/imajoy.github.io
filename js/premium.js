/* Ambient pointer light: one soft glow that trails the mouse with a little inertia. Mouse/pen only; off for reduced motion. */
(function(){
  if(!matchMedia('(hover:hover) and (pointer:fine)').matches||matchMedia('(prefers-reduced-motion:reduce)').matches)return;
  var el=document.createElement('div');el.className='px-light';el.setAttribute('aria-hidden','true');
  function mount(){document.body.prepend(el);}
  if(document.body)mount();else addEventListener('DOMContentLoaded',mount);
  var tx=innerWidth/2,ty=innerHeight/3,x=tx,y=ty,run=false,last=0;
  function tick(){
    x+=(tx-x)*.09;y+=(ty-y)*.09;
    el.style.transform='translate3d('+x.toFixed(1)+'px,'+y.toFixed(1)+'px,0)';
    if(Math.abs(tx-x)>.4||Math.abs(ty-y)>.4)requestAnimationFrame(tick);else run=false;
  }
  addEventListener('pointermove',function(e){
    if(e.pointerType==='touch')return;tx=e.clientX;ty=e.clientY;el.classList.add('on');
    if(!run){run=true;requestAnimationFrame(tick);}
  },{passive:true});
  document.addEventListener('pointerleave',function(){el.classList.remove('on');});
  document.addEventListener('visibilitychange',function(){if(document.hidden)el.classList.remove('on');});
})();
