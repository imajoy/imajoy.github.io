/* Decorative loops only run while they are on screen. A block marked data-rest (the hero stage, the install scene) is watched; when it is
   scrolled out of view it gets data-away and its endless animations rest (CSS), then carry on from the same spot when it returns.
   Nothing is removed or restyled: it only stops the browser recalculating invisible animations on every frame, which is what made scrolling heavy on phones. */
(function(){
 if(!('IntersectionObserver' in window))return;
 var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting)e.target.removeAttribute('data-away');else e.target.setAttribute('data-away','');});},{rootMargin:'120px 0px'});
 document.querySelectorAll('[data-rest]').forEach(function(n){io.observe(n);});
})();
