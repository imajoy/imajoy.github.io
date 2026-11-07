/* Tool pages: section headings arrive word by word and replay when you scroll back to them. */
(function(){
 if(!('IntersectionObserver' in window))return;
 var heads=[].slice.call(document.querySelectorAll('.tool-body h2,.tool-more h2,.tool-reviews h2,.guide-step-heading h2,.guide-intro h2,.ffmpeg-heading h2'));
 function split(node,c){[].slice.call(node.childNodes).forEach(function(n){
  if(n.nodeType===3){var f=document.createDocumentFragment();n.nodeValue.split(/(\s+)/).forEach(function(t){if(!t)return;if(/^\s+$/.test(t)){f.appendChild(document.createTextNode(' '));return;}var w=document.createElement('span'),i=document.createElement('span');w.className='tx-w';i.textContent=t;i.style.setProperty('--wi',String(c.n++));w.appendChild(i);f.appendChild(w);});n.parentNode.replaceChild(f,n);}
  else if(n.nodeType===1&&n.tagName!=='BR'&&!n.classList.contains('tx-w'))split(n,c);});}
 var seen=new WeakSet();
 heads=heads.filter(function(h){if(seen.has(h)||h.querySelector('.tx-w'))return false;seen.add(h);return true;});
 heads.forEach(function(h){h.setAttribute('aria-label',h.textContent.replace(/\s+/g,' ').trim());split(h,{n:0});h.classList.add('tx-h');});
 var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting)e.target.classList.add('tx-in');});},{threshold:.35,rootMargin:'0px 0px -4% 0px'});
 var back=new IntersectionObserver(function(es){es.forEach(function(e){if(!e.isIntersecting)e.target.classList.remove('tx-in');});},{threshold:0,rootMargin:'30% 0px 30% 0px'});
 heads.forEach(function(h){io.observe(h);back.observe(h);});
 requestAnimationFrame(function(){document.documentElement.classList.add('tx-on');});
})();
