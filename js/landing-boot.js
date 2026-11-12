/* Landing page: decides, before the first paint, how the Wrapline intro plays (full on the first visit of a session, brief afterwards, still for reduced motion). */
(function(){var d=document.documentElement,c=d.classList;c.add('lx-on','lx-intro-on');
try{if(sessionStorage.getItem('lx.seen'))c.add('lx-seen');}catch(e){}
if(matchMedia('(prefers-reduced-motion: reduce)').matches)c.add('lx-calm');})();
