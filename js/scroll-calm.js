/* While the page is scrolling, endless decorative loops rest (they resume right after), so scrolling only has to move pixels.
   Only animations that never end are touched; entrances and one-time transitions keep running. */
(function(){
 if(!document.getAnimations)return;
 var paused=[],on=false,t=0;
 function rest(){
  paused=document.getAnimations().filter(function(a){try{return a.playState==='running'&&a.effect&&a.effect.getTiming().iterations===Infinity&&!(a.effect.target&&a.effect.target.closest&&a.effect.target.closest('[data-keep-anim]'));}catch(e){return false;}});
  paused.forEach(function(a){try{a.pause();}catch(e){}});
 }
 function wake(){paused.forEach(function(a){try{if(a.playState==='paused')a.play();}catch(e){}});paused=[];}
 addEventListener('scroll',function(){
  if(!on){on=true;rest();}
  clearTimeout(t);t=setTimeout(function(){on=false;wake();},140);
 },{passive:true});
})();
