/* Play the landscape capture only while visible; a still works without JS/media. */
for(const depth of document.querySelectorAll('[data-playblast-depth]')){
 const video=depth.querySelector('[data-playblast-video]'),preference=matchMedia('(prefers-reduced-motion: reduce)'),pointer=matchMedia('(hover: hover) and (pointer: fine)');
 const figure=depth.closest('figure'),steps=[...figure.querySelectorAll('.playblast-screen-steps li')];
 let visible=false,failed=false,frame=0,generation=0,entered=false,entering=false;
 const resetTilt=()=>{cancelAnimationFrame(frame);frame=0;depth.style.removeProperty('--tilt-x');depth.style.removeProperty('--tilt-y');};
 const showStep=()=>{const t=video.currentTime,step=t<2.7?0:t<7.2?1:t<11.25?2:3;steps.forEach((el,i)=>i===step?el.setAttribute('aria-current','step'):el.removeAttribute('aria-current'));};
 const sync=()=>{
  const active=visible&&!document.hidden&&!preference.matches;
  figure.dataset.previewActive=String(active);
  if(active&&!entered){entered=true;figure.dataset.previewEntered='true';entering=getComputedStyle(depth.querySelector('.playblast-arrival')).animationName==='playblast-unfold';}
  if(preference.matches){entering=false;delete figure.dataset.previewEntered;}
  // Fetch during the brief entrance, but start playback after it settles.
  if(active&&!failed&&!video.getAttribute('src')){video.muted=true;video.preload='auto';video.src=video.dataset.src;}
  const play=active&&!failed&&!entering,token=++generation;
  if(!play){video.pause();depth.dataset.playing='false';resetTilt();return;}
  video.play().then(()=>{if(token===generation&&visible&&!document.hidden&&!preference.matches&&!failed){depth.dataset.playing='true';showStep();}else if(token===generation){video.pause();}}).catch(()=>{if(token===generation)depth.dataset.playing='false';});
 };
 const finishEntrance=event=>{
  if(event.target!==depth.querySelector('.playblast-arrival')||event.animationName!=='playblast-unfold'||!entering)return;
  entering=false;sync();
 };
 depth.addEventListener('animationend',finishEntrance);
 depth.addEventListener('animationcancel',finishEntrance);
 if('IntersectionObserver' in window)new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;sync();},{threshold:.12}).observe(depth);
 else{visible=true;sync();}
 document.addEventListener('visibilitychange',sync);preference.addEventListener('change',sync);
 video.addEventListener('error',()=>{failed=true;sync();});video.addEventListener('timeupdate',showStep);
 depth.addEventListener('pointermove',event=>{
  if(!pointer.matches||preference.matches||!visible||document.hidden||entering||frame)return;
  const {clientX,clientY}=event;
  frame=requestAnimationFrame(()=>{frame=0;const box=depth.getBoundingClientRect(),x=Math.max(-.5,Math.min(.5,(clientX-box.left)/box.width-.5)),y=Math.max(-.5,Math.min(.5,(clientY-box.top)/box.height-.5));depth.style.setProperty('--tilt-x',`${-y*5}deg`);depth.style.setProperty('--tilt-y',`${x*7}deg`);});
 });
 depth.addEventListener('pointerleave',resetTilt);
}
