/* One light reveal for the Pro page: each block fades up once as it arrives (opacity + small translate). */
(function(){
 if(!('IntersectionObserver' in window)||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 var sel='#workflows .head h2,#workflows .head .sub,#install .steps li,#faq details,#workflows .head,#workflows .workflow-panel,#trial .trial-stage,#tools .head h2,#tools .head,#tools .tile,#install .inst-copy,#install .inst-stage,#pricing .head h2,#pricing .head,#pricing .plan,#faq .faq-wrap>*,.closing .frame-inner';
 var items=[].slice.call(document.querySelectorAll(sel)),io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('pr-in');io.unobserve(e.target);}});},{rootMargin:'0px 0px -6% 0px',threshold:.04});
 var kinds=[['h2','clip'],['.workflow-panel','open'],['.tile','tile'],['.plan','zoom'],['.frame-inner','zoom'],['.trial-stage','open']];
 items.forEach(function(el){var sibs=el.parentElement?[].slice.call(el.parentElement.children).filter(function(s){return s.hasAttribute('data-pr')||items.indexOf(s)>-1;}):[el];var kind='';kinds.forEach(function(k){if(!kind&&el.matches(k[0]))kind=k[1];});if(kind==='tile'){var ix=[].slice.call(document.querySelectorAll('#tools .tile')).indexOf(el);kind=ix%2?'right':'left';}el.setAttribute('data-pr',kind);el.style.setProperty('--pr-i',String(Math.min(sibs.indexOf(el),4)));io.observe(el);});
 requestAnimationFrame(function(){document.documentElement.classList.add('pr-on');});
})();
