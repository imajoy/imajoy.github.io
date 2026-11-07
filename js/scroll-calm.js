/* While the page is scrolling, a few endless decorative loops rest through CSS (html.is-scrolling), then resume.
   Deliberately light: it only flips one class. It never queries or pauses animations itself, because that forced a full
   style recalculation at the start and end of every scroll (a visible hitch). */
(function(){
 var on=false,t=0,root=document.documentElement;
 addEventListener('scroll',function(){
  if(!on){on=true;root.classList.add('is-scrolling');}
  clearTimeout(t);t=setTimeout(function(){on=false;root.classList.remove('is-scrolling');},160);
 },{passive:true});
})();
