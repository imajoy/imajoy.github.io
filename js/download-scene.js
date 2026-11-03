/* Decorative install scene on the download page (same engine as the free page's "get it" stage):
   sign in -> download -> drag into Maya -> menu and shelf appear. Loops only while on screen; static finished scene for reduced motion. */
(()=>{
 const stage=document.getElementById('dl-scene');
 if(!stage||matchMedia('(prefers-reduced-motion: reduce)').matches||!('IntersectionObserver' in window))return;
 const LENGTH=[4800,3500,3400,5600],pills=[...document.querySelectorAll('.dl-steps4 li')];
 let step=0,timer=0,visible=false;
 const show=n=>{stage.dataset.step='';void stage.offsetWidth;stage.dataset.step=String(n);pills.forEach((p,i)=>p.classList.toggle('on',i===n));};
 const next=()=>{clearTimeout(timer);if(!visible)return;show(step);timer=setTimeout(()=>{step=(step+1)%LENGTH.length;next();},LENGTH[step]);};
 new IntersectionObserver(es=>{for(const e of es){visible=e.isIntersecting;if(visible){step=0;next();}else{clearTimeout(timer);pills.forEach(p=>p.classList.remove('on'));}}},{threshold:.35}).observe(stage);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)clearTimeout(timer);else if(visible)next();});
})();
