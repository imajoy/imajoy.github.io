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
  var p=location.pathname,n=p.replace(/(^|\/)index\.html$/,'$1').replace(/\.html$/,'');
  if(!n)n='/';
  var real=n.replace(/^\//,'');
  // A visitor who arrived on a short address (e.g. /pro) is sent to the real page first; map it back to the real name.
  window.__realPath=n;
  // Moving between sections on the Pro page: /pricing -> /tools -> /pro#reviews keeps the right short address.
  function update(){
   var hash=location.hash.replace(/^#/,'');
   var base=PAGES[real]?'/'+PAGES[real]:n;
   var path=real==='wrapline'&&SECTIONS[hash]?'/'+hash:base;
   var keep=real==='wrapline'&&SECTIONS[hash]?'':location.hash;
   var next=path+location.search+keep;
   if(next!==location.pathname+location.search+location.hash)history.replaceState(history.state,'',next);
  }
  // On arrival at a section (/pricing), let the browser scroll there first; changing the address earlier would cancel that scroll.
  var first=real==='wrapline'&&SECTIONS[location.hash.replace(/^#/,'')],waited=0;
  (function start(){if(first&&!scrollY&&++waited<50){setTimeout(start,100);return;}if(n!==p||PAGES[real]||real==='wrapline')update();})();
  window.__cleanUrl=function(){try{update();}catch(e){}};
  addEventListener('hashchange',function(){try{if(real==='wrapline')update();}catch(e){}});
 }catch(e){}
})();
