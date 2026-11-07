/* Phones and tablets: shrink a button's text a little (never below 11px) when it would not fit on one line.
   Runs only on load, resize and when a button's own label changes. It never runs on laptops and never while scrolling. */
(function(){
 var mq=window.matchMedia('(max-width:1024px)'),touched=false,t,mo;
 function one(b){
  if(b.style.fontSize)b.style.removeProperty('font-size');
  if(!b.offsetWidth)return;
  var fs=parseFloat(getComputedStyle(b).fontSize),n=0;
  while(b.scrollWidth>b.clientWidth+1&&fs>11&&n++<12){fs-=.5;b.style.fontSize=fs+'px';touched=true;}
 }
 function fit(){
  if(!mq.matches){if(touched){[].forEach.call(document.querySelectorAll('.btn'),function(b){b.style.removeProperty('font-size');});touched=false;}return;}
  [].forEach.call(document.querySelectorAll('.btn'),one);
 }
 function later(){clearTimeout(t);t=setTimeout(function(){if(document.documentElement.classList.contains('is-scrolling')){later();return;}fit();},200);}
 window.addEventListener('resize',later);window.addEventListener('orientationchange',later);
 if(document.fonts&&document.fonts.ready)document.fonts.ready.then(fit);
 window.addEventListener('load',function(){fit();setTimeout(fit,2500);});
 if(mq.matches&&'MutationObserver' in window){mo=new MutationObserver(function(m){later();});[].forEach.call(document.querySelectorAll('.btn'),function(b){mo.observe(b,{childList:true,characterData:true,subtree:true});});}
})();
