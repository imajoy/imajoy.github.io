/* Swap back to a still when animation is unnecessary, including reduced-motion users. */
for(const image of document.querySelectorAll('[data-playblast-gif]')){
 const still=image.getAttribute('src'),gif=image.dataset.playblastGif,preference=matchMedia('(prefers-reduced-motion: reduce)');
 let visible=false;
 const sync=()=>{
  const play=visible&&!document.hidden&&!preference.matches,next=play?gif:still;
  if(image.getAttribute('src')!==next)image.setAttribute('src',next);
  image.dataset.playing=String(play);
 };
 if('IntersectionObserver' in window)new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;sync();},{threshold:.12}).observe(image);
 else{visible=true;sync();}
 document.addEventListener('visibilitychange',sync);preference.addEventListener('change',sync);
 image.addEventListener('error',()=>{if(image.getAttribute('src')!==still){image.setAttribute('src',still);image.dataset.playing='false';}});
}
