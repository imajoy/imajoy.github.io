/* CSS does the drawing. Observe once per section instead of running an idle JavaScript render loop. */
const stage=document.querySelector('.card-stage');
if(stage){
 const preference=matchMedia('(prefers-reduced-motion:reduce)');let visible=false;
 const sync=()=>stage.toggleAttribute('data-license-active',visible&&!document.hidden&&!preference.matches);
 if('IntersectionObserver'in window)new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;sync();},{threshold:.15}).observe(stage);
 preference.addEventListener('change',sync);document.addEventListener('visibilitychange',sync);sync();
}
