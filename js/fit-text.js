/* Phones and tablets: shrink a button's text a little (never below 11px) when it would not fit on one line. */
(function(){
 var SEL='.btn';
 function fit(){
  var small=window.matchMedia('(max-width:1024px)').matches;
  [].forEach.call(document.querySelectorAll(SEL),function(b){
   b.style.removeProperty('font-size');
   if(!small||!b.offsetWidth)return;
   var fs=parseFloat(getComputedStyle(b).fontSize),n=0;
   while(b.scrollWidth>b.clientWidth+1&&fs>11&&n++<12){fs-=.5;b.style.fontSize=fs+'px';}
  });
 }
 var t;function later(){clearTimeout(t);t=setTimeout(fit,120);}
 window.addEventListener('resize',later);window.addEventListener('orientationchange',later);
 if(document.fonts&&document.fonts.ready)document.fonts.ready.then(fit);
 window.addEventListener('load',fit);document.addEventListener('DOMContentLoaded',fit);
 new MutationObserver(later).observe(document.body,{childList:true,subtree:true,characterData:true});
})();
