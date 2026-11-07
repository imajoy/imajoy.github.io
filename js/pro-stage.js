/* Wrapline Pro hero stage: eased pointer lean (no jumps), and a dock that follows whichever tool the demo is showing.
   Writes only CSS variables on two elements; the loop runs only while the pointer is near the stage and the page is visible. */
(function(){
 var st=document.querySelector('.pro-stage');if(!st)return;
 var reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
 var dock=st.querySelector('.pro-dock'),chips=dock?[].slice.call(dock.querySelectorAll('span')):[],now=dock&&dock.querySelector('.pro-now');
 /* ---- dock: macOS-style magnification around the active tool ---- */
 function show(ix,title){
  chips.forEach(function(c,i){var d=i-ix;c.style.setProperty('--d',String(Math.abs(d)));c.classList.toggle('on',d===0);});
  if(now&&title){now.classList.remove('sw');void now.offsetWidth;now.textContent=title;now.classList.add('sw');}
  st.classList.remove('is-swap');void st.offsetWidth;st.classList.add('is-swap');
 }
 st.addEventListener('xp-tool',function(e){show(e.detail.ix,e.detail.title);});
 chips.forEach(function(c){c.style.setProperty('--d','9');});
 /* ---- lean: one eased loop, small angles ---- */
 var dev=st.querySelector('.pro-device'),fig=st.querySelector('.tool-visual');
 if(!dev||reduce||!matchMedia('(hover:hover) and (pointer:fine)').matches)return;
 var tx=0,ty=0,cx=0,cy=0,run=0,near=false,vis=true;
 function frame(){
  run=0;cx+=(tx-cx)*.08;cy+=(ty-cy)*.08;
  dev.style.setProperty('--ry',(-6+cx*4.5).toFixed(2)+'deg');dev.style.setProperty('--rx',(-cy*3).toFixed(2)+'deg');
  fig.style.setProperty('--gx',(50+cx*50).toFixed(1)+'%');fig.style.setProperty('--gy',(50+cy*50).toFixed(1)+'%');
  if((near||Math.abs(tx-cx)>.002||Math.abs(ty-cy)>.002)&&vis&&!document.hidden)run=requestAnimationFrame(frame);
 }
 function kick(){if(!run)run=requestAnimationFrame(frame);}
 window.addEventListener('pointermove',function(e){var r=st.getBoundingClientRect(),x=(e.clientX-(r.left+r.width/2))/Math.max(r.width,1),y=(e.clientY-(r.top+r.height/2))/Math.max(r.height,1);
  near=Math.abs(x)<1.1&&Math.abs(y)<1.1;tx=near?Math.max(-1,Math.min(1,x*2)):0;ty=near?Math.max(-1,Math.min(1,y*2)):0;kick();},{passive:true});
 if('IntersectionObserver' in window)new IntersectionObserver(function(es){vis=es[0].isIntersecting;if(vis)kick();}).observe(st);
})();
/* mark scrolling so endless decorative loops can rest (CSS: html.is-scrolling) */
(function(){var t=0,on=false,root=document.documentElement;
 addEventListener('scroll',function(){if(!on){on=true;root.classList.add('is-scrolling');}clearTimeout(t);t=setTimeout(function(){on=false;root.classList.remove('is-scrolling');},160);},{passive:true});})();
