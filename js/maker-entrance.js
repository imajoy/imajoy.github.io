/* Maker-home entrance on every visit (skipped only when the visitor asks for reduced motion).
   The page stays readable without it. */
(function(){
 var root=document.documentElement,enabled=!matchMedia('(prefers-reduced-motion:reduce)').matches;
 root.dataset.makerMotion=enabled?'play':'skip';
 if(enabled){
  root.classList.add('maker-enter');
  document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>root.classList.remove('maker-enter'),1800),{once:true});
 }
})();
