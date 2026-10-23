/* The static hero content paints before the optional 3D illustration is loaded.
   Touch screens get a still render of the same scene: the 3D only moves with a mouse,
   so phones would download and build it just to draw one frame. */
const canvas=document.querySelector('.home-page #stage');
const touchOnly=matchMedia('(hover: none) and (pointer: coarse)').matches;
if(canvas&&touchOnly)canvas.setAttribute('data-scene-still','');
else if(canvas){
 /* Preparing the 3D graphics briefly freezes the page, so it waits until the visitor first moves,
    scrolls or types, or until 5s after the page has loaded, whichever comes first. */
 let queued=false,ready=false,inView=!('IntersectionObserver'in window);
 const start=()=>import('./scene.bundle.js?v=20261023-fit1').catch(()=>canvas.setAttribute('data-scene-unavailable',''));
 const load=()=>{
  if(queued||!ready||!inView)return;queued=true;
  for(const type of wake)removeEventListener(type,go,true);
  if('requestIdleCallback'in window)requestIdleCallback(start,{timeout:800});else setTimeout(start,0);
 };
 const go=()=>{ready=true;load();};
 const wake=['pointermove','pointerdown','keydown','wheel','touchstart']; /* real input only: browsers can fire scroll on their own */
 for(const type of wake)addEventListener(type,go,{capture:true,passive:true});
 const later=()=>setTimeout(go,5000);
 if(document.readyState==='complete')later();else addEventListener('load',later,{once:true});
 if(!inView){
  const observer=new IntersectionObserver(entries=>{
   if(entries.some(entry=>entry.isIntersecting)){observer.disconnect();inView=true;load();}
  },{rootMargin:'100px'});
  observer.observe(canvas);
 }
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
