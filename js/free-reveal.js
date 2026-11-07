/* One light reveal for the Wrapline (free) page: blocks fade up once as they arrive. */
(function(){
 if(!('IntersectionObserver' in window)||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 var sel='#tools .head,#tools .ft-card,#workflows .head,#workflows .workflow-panel,#get .head,#get .ft-steps li,#get .ft-get-cta,#coffee .ft-coffee-card,#coffee .ft-rights li,#pro .free-pro,#faq .faq-wrap>*';
 var items=[].slice.call(document.querySelectorAll(sel)),io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('pr-in');io.unobserve(e.target);}});},{rootMargin:'0px 0px -6% 0px',threshold:.04});
 items.forEach(function(el){var i=el.parentElement?[].slice.call(el.parentElement.children).indexOf(el):0;el.classList.remove('reveal');el.setAttribute('data-pr','');el.style.setProperty('--pr-i',String(Math.min(i,4)));io.observe(el);});
 requestAnimationFrame(function(){document.documentElement.classList.add('pr-on');});
})();
