/* Show short, clean addresses: wrapline.in/pro, /free, /fbx-exporter, /pricing … instead of /wrapline.html, /tool-fbx-exporter.html or /wrapline#pricing.
   Every short address is a real tiny page (made by scripts/make-aliases.mjs) that forwards to the real page, so links, refresh and
   sharing all work; this script only rewrites the address bar. Keep PAGES and SECTIONS identical to that script (a test checks it).
   The real path stays available as window.__realPath for scripts that look at the page name. */
(function(){
 try{
  var h=location.hostname;
  if(!/(^|\.)wrapline\.in$|\.github\.io$/.test(h))return;
  var PAGES={'wrapline':'pro','wrapline-free':'free','tool-advanced-ik-fk-switch':'advanced-ik-fk-switch','tool-alembic-exporter':'alembic-exporter','tool-audio-exporter':'audio-exporter','tool-drag-drop':'drag-drop','tool-fbx-exporter':'fbx-exporter','tool-hotkey-manager':'hotkey-manager','tool-ik-fk-snap':'ik-fk-snap','tool-layer-prefix-remover':'layer-prefix-remover','tool-multi-swapper':'multi-swapper','tool-playblast':'playblast','tool-rebake-ik-space':'rebake-ik-space','tool-revert-to-last-saved':'revert-to-last-saved','tool-rivet':'rivet','tool-udim-preview':'udim-preview'};
  var SECTIONS={'pricing':1,'tools':1,'install':1,'faq':1};
  var SEC={"wrapline":["pricing","tools","install","faq","trial","workflows","reviews"],"wrapline-free":["tools","get","faq","reviews"]};
  var p=location.pathname,n=p.replace(/(^|\/)index\.html$/,'$1').replace(/\.html$/,'');
  if(!n)n='/';
  var real=n.replace(/^\//,'');
  // A visitor who arrived on a short address (e.g. /pro) is sent to the real page first; map it back to the real name.
  window.__realPath=n;
  // Sections of the Pro and Free pages live under the page's short name: /pro/tools, /pro/pricing, /free/get ...
  function section(hash){var l=SEC[real];return l&&l.indexOf(hash)>-1;}
  // A deeper address (/pro/tools) would make the page's relative links and files resolve under /pro/, so they are pointed at the site root.
  var fixing=false,ATTRS=['href','data-href','data-mp4','data-webm','data-src','data-poster'];
  function abs(v){return v&&!/^([a-z][a-z0-9+.-]*:|\/|#|\?)/i.test(v)?'/'+v:v;}
  function fixOne(e){if(e.nodeType!==1||e.tagName==='LINK')return;for(var i=0;i<ATTRS.length;i++){var v=e.getAttribute(ATTRS[i]),w=abs(v);if(w!==v)e.setAttribute(ATTRS[i],w);}}
  function fixAll(r){fixOne(r);if(r.querySelectorAll)[].forEach.call(r.querySelectorAll('[href],[data-href],[data-mp4],[data-webm],[data-src],[data-poster]'),fixOne);}
  function startFixing(){if(fixing)return;fixing=true;fixAll(document.documentElement);new MutationObserver(function(ms){ms.forEach(function(m){if(m.type==='attributes')fixOne(m.target);else[].forEach.call(m.addedNodes,fixAll);});}).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:ATTRS});}
  function update(){
   var hash=location.hash.replace(/^#/,'');
   var base=PAGES[real]?'/'+PAGES[real]:n;
   var sec=section(hash);
   var path=sec?base+'/'+hash:base;
   var keep=sec?'':location.hash;
   var next=path+location.search+keep;
   if(next!==location.pathname+location.search+location.hash)history.replaceState(history.state,'',next);
   if(SEC[real]&&location.pathname.split('/').length>2)startFixing();
  }
  window.__cleanUrl=function(){try{update();}catch(e){}};
  // On arrival at a section (/pro/pricing), let the browser scroll there first; changing the address earlier would cancel that scroll.
  var first=section(location.hash.replace(/^#/,'')),waited=0;
  (function start(){if(first&&!scrollY&&++waited<50){setTimeout(start,100);return;}if(n!==p||PAGES[real]||SEC[real])update();})();
  addEventListener('hashchange',function(){try{if(SEC[real])update();}catch(e){}});
 }catch(e){}
})();
