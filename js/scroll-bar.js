/* Thin progress line at the top that grows as the page scrolls (one transform write per frame). */
(function(){
 if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 var b=document.createElement('div');b.className='sb-line';b.setAttribute('aria-hidden','true');document.body.appendChild(b);
 var raf=0,mx=0,calc=function(){mx=Math.max(0,document.documentElement.scrollHeight-innerHeight)};calc();
 if('ResizeObserver' in window)new ResizeObserver(calc).observe(document.body);addEventListener('load',calc);
 function paint(){raf=0;var m=mx;b.style.transform='scaleX('+(m>0?Math.min(1,Math.max(0,scrollY/m)):0)+')';}
 function q(){if(!raf)raf=requestAnimationFrame(paint);}
 addEventListener('scroll',q,{passive:true});addEventListener('resize',function(){calc();q();});paint();
})();
