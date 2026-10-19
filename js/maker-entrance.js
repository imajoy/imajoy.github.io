/* Occasional maker-home entrances; the default document always remains readable. */
(function(){
 var root=document.documentElement,enabled=false;
 if(!matchMedia('(prefers-reduced-motion:reduce)').matches)try{
  enabled=new URLSearchParams(location.search).get('preview')==='motion'||(Date.now()-Number(localStorage.getItem('ajoy.maker.motion')||0)>3600000&&Math.random()<.35);
  if(enabled)localStorage.setItem('ajoy.maker.motion',String(Date.now()));
 }catch{}
 root.dataset.makerMotion=enabled?'play':'skip';
 if(enabled){
  root.classList.add('maker-enter');
  document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>root.classList.remove('maker-enter'),1800),{once:true});
 }
})();
