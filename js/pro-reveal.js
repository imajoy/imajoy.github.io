/* One light reveal for the Pro page: each block animates in as it arrives, from the side you scroll from, and plays again when you scroll back. */
(function(){
 if(!('IntersectionObserver' in window))return;
 var sel='#workflows .head h2,#workflows .head .sub,#install .steps li,#faq details,#workflows .head,#workflows .workflow-panel,#trial .trial-stage,#tools .head h2,#tools .head,#tools .tile,#install .inst-copy,#install .inst-stage,#pricing .head h2,#pricing .head,#pricing .plan,#faq .faq-wrap>*,.closing .frame-inner';
 var items=[].slice.call(document.querySelectorAll(sel));
 var timers=new WeakMap();
 var io=new IntersectionObserver(function(es){es.forEach(function(e){var el=e.target;if(e.isIntersecting&&!el.classList.contains('pr-in')){el.classList.add('pr-in');var d=(parseFloat(el.style.getPropertyValue('--pr-i'))||0)*70+1300;timers.set(el,setTimeout(function(){el.classList.add('pr-set');},d));}});},{rootMargin:'0px 0px -6% 0px',threshold:.04});
 /* fully off screen: rewind so the block plays again when you scroll back to it (from the side it left) */
 var rewind=new IntersectionObserver(function(es){es.forEach(function(e){var el=e.target;if(e.isIntersecting||!el.classList.contains('pr-in'))return;clearTimeout(timers.get(el));el.style.setProperty('--pr-d',e.boundingClientRect.top<0?'-1':'1');el.classList.remove('pr-in','pr-set');});},{rootMargin:'35% 0px 35% 0px',threshold:0});
 var kinds=[['h2','clip'],['.workflow-panel','open'],['.tile','tile'],['.plan','zoom'],['.frame-inner','zoom'],['.trial-stage','open']];
 items.forEach(function(el){var sibs=el.parentElement?[].slice.call(el.parentElement.children).filter(function(s){return s.hasAttribute('data-pr')||items.indexOf(s)>-1;}):[el];var kind='';kinds.forEach(function(k){if(!kind&&el.matches(k[0]))kind=k[1];});if(kind==='tile'){var ix=[].slice.call(document.querySelectorAll('#tools .tile')).indexOf(el);kind=ix%2?'right':'left';}el.setAttribute('data-pr',kind);el.style.setProperty('--pr-i',String(Math.min(sibs.indexOf(el),4)));io.observe(el);rewind.observe(el);});

 /* section headings arrive word by word (the same feel as the landing page) */
 (function(){
  var n=0;
  function split(node){[].slice.call(node.childNodes).forEach(function(c){
   if(c.nodeType===3){var f=document.createDocumentFragment();c.nodeValue.split(/(\s+)/).forEach(function(t){if(!t)return;if(/^\s+$/.test(t)){f.appendChild(document.createTextNode(' '));return;}var w=document.createElement('span'),i=document.createElement('span');w.className='pw';i.textContent=t;i.style.setProperty('--wi',String(n++));w.appendChild(i);f.appendChild(w);});c.parentNode.replaceChild(f,c);}
   else if(c.nodeType===1&&!c.classList.contains('pw'))split(c);});}
  [].slice.call(document.querySelectorAll('#workflows .head h2,#tools .head h2,#pricing .head h2,#faq .faq-wrap .head h2,#install h2,#trial h2,.closing h2')).forEach(function(h){if(h.closest('[hidden]'))return;n=0;h.setAttribute('aria-label',h.textContent.replace(/\s+/g,' ').trim());split(h);h.classList.add('pp-words');if(items.indexOf(h)<0){h.setAttribute('data-pr','clip');io.observe(h);rewind.observe(h);}});
 })();
 requestAnimationFrame(function(){document.documentElement.classList.add('pr-on');});
})();
