/* Thin progress line at the top that grows as the page scrolls (one transform write per frame). */
(function(){
 if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 var b=document.createElement('div');b.className='sb-line';b.setAttribute('aria-hidden','true');document.body.appendChild(b);
 var raf=0;
 function paint(){raf=0;var m=document.documentElement.scrollHeight-innerHeight;b.style.transform='scaleX('+(m>0?Math.min(1,Math.max(0,scrollY/m)):0)+')';}
 function q(){if(!raf)raf=requestAnimationFrame(paint);}
 addEventListener('scroll',q,{passive:true});addEventListener('resize',q);paint();
})();
