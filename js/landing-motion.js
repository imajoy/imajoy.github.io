/* The static hero content paints before the optional 3D illustration is loaded. */
const canvas=document.querySelector('.home-page #stage');
if(canvas){
 let queued=false;
 const load=()=>{
  if(queued)return;queued=true;
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
   const start=()=>import('./scene.js?v=20261019-s1').catch(()=>canvas.setAttribute('data-scene-unavailable',''));
   if('requestIdleCallback'in window)requestIdleCallback(start,{timeout:1500});
   else setTimeout(start,0);
  }));
 };
 if('IntersectionObserver'in window){
  const observer=new IntersectionObserver(entries=>{
   if(entries.some(entry=>entry.isIntersecting)){observer.disconnect();load();}
  },{rootMargin:'100px'});
  observer.observe(canvas);
 }else load();
}

// Float only while the promotion is visible and the browser tab is active.
const banner=document.querySelector('.home-page .trial-banner');
if(banner){
 let visible=true;
 const sync=()=>banner.toggleAttribute('data-float-active',visible&&!document.hidden);
 if('IntersectionObserver'in window){new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;sync();}).observe(banner);}
 document.addEventListener('visibilitychange',sync);
 sync();
}
