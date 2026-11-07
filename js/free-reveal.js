/* One light reveal for the Wrapline (free) page: blocks animate in as they arrive, from the side you scroll from, and play again when you scroll back. */
(function(){
 if(!('IntersectionObserver' in window)||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 var sel='#tools .head,#tools .ft-card,#workflows .head,#workflows .workflow-panel,#get .head,#get .ft-steps li,#get .ft-get-cta,#coffee .ft-coffee-card,#coffee .ft-rights li,#pro .free-pro,#faq .faq-wrap>*';
 var items=[].slice.call(document.querySelectorAll(sel));
 var timers=new WeakMap();
 var io=new IntersectionObserver(function(es){es.forEach(function(e){var el=e.target;if(e.isIntersecting&&!el.classList.contains('pr-in')){el.classList.add('pr-in');var d=(parseFloat(el.style.getPropertyValue('--pr-i'))||0)*70+1300;timers.set(el,setTimeout(function(){el.classList.add('pr-set');},d));}});},{rootMargin:'0px 0px -6% 0px',threshold:.04});
 /* fully off screen: rewind so the block plays again when you scroll back to it (from the side it left) */
 var rewind=new IntersectionObserver(function(es){es.forEach(function(e){var el=e.target;if(e.isIntersecting||!el.classList.contains('pr-in'))return;clearTimeout(timers.get(el));el.style.setProperty('--pr-d',e.boundingClientRect.top<0?'-1':'1');el.classList.remove('pr-in','pr-set');});},{rootMargin:'35% 0px 35% 0px',threshold:0});
 items.forEach(function(el){var i=el.parentElement?[].slice.call(el.parentElement.children).indexOf(el):0;el.classList.remove('reveal');el.setAttribute('data-pr','');el.style.setProperty('--pr-i',String(Math.min(i,4)));io.observe(el);rewind.observe(el);});
 requestAnimationFrame(function(){document.documentElement.classList.add('pr-on');});
})();
