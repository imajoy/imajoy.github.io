/* Show clean addresses (wrapline.in/contact) instead of /contact.html. GitHub Pages serves both. */
(function(){
 try{
  var h=location.hostname;
  if(!/(^|\.)wrapline\.in$|\.github\.io$/.test(h))return;
  var p=location.pathname,n=p.replace(/(^|\/)index\.html$/,'$1').replace(/\.html$/,'');
  if(n===p)return;
  if(!n)n='/';
  history.replaceState(history.state,'',n+location.search+location.hash);
 }catch(e){}
})();
