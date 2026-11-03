/* Drives the decorative "get it" stage on the free Wrapline page (css/free-stage.css): sign in, download, drag into Maya,
   menu and shelf appear. Loops only while it is on screen; the three step cards below light up in sync.
   With reduced motion it leaves the stage on its finished scene. */
const stage=document.getElementById('free-stage');
if(stage&&!matchMedia('(prefers-reduced-motion: reduce)').matches&&'IntersectionObserver' in window){
 const LENGTH=[4800,3500,3400,4600];           // how long each scene plays (ms)
 const cards=[...document.querySelectorAll('.ft-steps li')];
 const STEP_CARD=[0,1,2,2];                       // scene -> card to highlight
 let step=0,timer=0,visible=false;
 const show=n=>{
  stage.dataset.step='';void stage.offsetWidth;  // restart the scene's animations
  stage.dataset.step=String(n);
  cards.forEach((c,i)=>c.classList.toggle('fs-on',i===STEP_CARD[n]));
 };
 const next=()=>{clearTimeout(timer);if(!visible)return;show(step);timer=setTimeout(()=>{step=(step+1)%LENGTH.length;next();},LENGTH[step]);};
 new IntersectionObserver(es=>{
  for(const e of es){visible=e.isIntersecting;if(visible){step=0;next();}else{clearTimeout(timer);cards.forEach(c=>c.classList.remove('fs-on'));}}
 },{threshold:.35}).observe(stage);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)clearTimeout(timer);else if(visible)next();});
}
