/* Media guard: no "Save video as" from the right-click menu or long-press, no download button,
   no drag-out. Applies to every <video>, demo player and canvas, on every page. Text, links and
   form fields keep their normal right-click menu. (Browsers can never make playback 100% copy-proof;
   this stops the casual save.) */
(()=>{
  const SEL='video,canvas,.xp-frame,.xp-vp,.pro-device,[data-explainer],[data-no-save]';
  const hit=t=>t&&t.closest&&t.closest(SEL);
  const lock=v=>{try{v.setAttribute('controlslist','nodownload noremoteplayback');v.setAttribute('disablepictureinpicture','');v.setAttribute('disableremoteplayback','');v.draggable=false;}catch{}};
  document.addEventListener('contextmenu',e=>{if(hit(e.target))e.preventDefault();},true);
  document.addEventListener('dragstart',e=>{if(hit(e.target))e.preventDefault();},true);
  const scan=r=>{(r.querySelectorAll?r.querySelectorAll('video'):[]).forEach(lock);};
  scan(document);
  new MutationObserver(m=>m.forEach(x=>x.addedNodes.forEach(n=>{if(n.nodeType===1){if(n.tagName==='VIDEO')lock(n);scan(n);}}))).observe(document.documentElement,{childList:true,subtree:true});
})();
