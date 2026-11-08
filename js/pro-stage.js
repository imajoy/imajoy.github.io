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
  if((near||Math.abs(tx-cx)>.002||Math.abs(ty-cy)>.002)&&vis&&!document.hidden)run=requestAnimationFrame(frame);
 }
 function kick(){if(!run)run=requestAnimationFrame(frame);}
 window.addEventListener('pointermove',function(e){var r=st.getBoundingClientRect(),x=(e.clientX-(r.left+r.width/2))/Math.max(r.width,1),y=(e.clientY-(r.top+r.height/2))/Math.max(r.height,1);
  var n=Math.abs(x)<1.1&&Math.abs(y)<1.1;if(n!==near)st.classList.toggle('is-lean',n);near=n;tx=near?Math.max(-1,Math.min(1,x*2)):0;ty=near?Math.max(-1,Math.min(1,y*2)):0;kick();},{passive:true});
 if('IntersectionObserver' in window)new IntersectionObserver(function(es){vis=es[0].isIntersecting;if(vis)kick();}).observe(st);
})();
/* rest what you cannot see: ambient loops pause while their section is off screen (CSS: .ap-off) */
(function(){if(!('IntersectionObserver' in window))return;
 var io=new IntersectionObserver(function(es){es.forEach(function(e){e.target.classList.toggle('ap-off',!e.isIntersecting);});},{rootMargin:'160px 0px'});
 [].forEach.call(document.querySelectorAll('body.pro-page section, body.pro-page footer.site-footer'),function(s){io.observe(s);});})();

/* one-time entrance of the stage (CSS: .pro-stage:not(.is-in)) */
(function(){var st=document.querySelector('.pro-stage');if(!st)return;
 if(!('IntersectionObserver' in window)){st.classList.add('is-in');return;}
 var io=new IntersectionObserver(function(es){if(es[0].isIntersecting){st.classList.add('is-in');io.disconnect();}},{threshold:.06});io.observe(st);})();

/* hero scroll: as you scroll, the headline lines part, the dark stage pulls in from the screen edges into a rounded card,
   the demo window rises and grows a touch, the two big numbers drift outward and the dock trails behind. Everything is
   written with transform / translate / scale (compositor only), one write per frame, and only while the hero is on screen. */
(function(){var hero=document.querySelector('.hero.hv');if(!hero)return;
 if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 var l1=hero.querySelector('.ln:nth-child(1)'),l2=hero.querySelector('.ln:nth-child(2)'),shell=hero.querySelector('.hv-shell'),stage=hero.querySelector('.hv-stage'),
  sl=hero.querySelector('.hv-l b'),sr=hero.querySelector('.hv-r b'),dock=hero.querySelector('.pro-dock'),glow=hero.querySelector('.hv-glow'),meta=hero.querySelector('.hv-meta'),tick=0,last=-1,vis=true;
 if(!l1||!l2||!shell||!stage)return;
 function paint(){tick=0;if(!vis)return;
  var h=Math.max(hero.offsetHeight,1),p=Math.min(1,Math.max(0,scrollY/(h*.8)));p=Math.round(p*400)/400;if(p===last)return;last=p;
  var e=p*p*(3-2*p),wide=innerWidth>980,k=wide?1:.55;
  l1.style.transform='translate3d('+(-e*7*k).toFixed(2)+'vw,0,0)';l2.style.transform='translate3d('+(e*7*k).toFixed(2)+'vw,0,0)';
  shell.style.transform='scale('+(1-e*(wide?.07:.05)).toFixed(4)+')';
  stage.style.translate='0 '+(-e*(wide?46:26)).toFixed(1)+'px';stage.style.scale=(1+e*.035).toFixed(4);
  if(sl)sl.style.translate=(-e*5).toFixed(2)+'vw '+(e*30).toFixed(1)+'px';if(sr)sr.style.translate=(e*5).toFixed(2)+'vw '+(e*-24).toFixed(1)+'px';
  if(dock)dock.style.translate='0 '+(-e*8).toFixed(1)+'px';
  if(glow)glow.style.translate='0 '+(e*60).toFixed(1)+'px';
  if(meta)meta.style.translate='0 '+(-e*14).toFixed(1)+'px';}
 addEventListener('scroll',function(){if(!tick)tick=requestAnimationFrame(paint);},{passive:true});addEventListener('resize',function(){last=-1;if(!tick)tick=requestAnimationFrame(paint);});
 if('IntersectionObserver' in window)new IntersectionObserver(function(es){vis=es[0].isIntersecting;if(vis&&!tick){last=-1;tick=requestAnimationFrame(paint);}}).observe(hero);
 paint();})();
