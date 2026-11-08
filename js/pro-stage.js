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

/* Pinned hero. On wider and taller screens the dark stage sticks to the top while you scroll through the ten tools: every
   short stretch of scrolling switches to the next tool (the demo plays, the dock follows), the stage edges draw in a little, and
   after the last tool the page carries on. Only transform / translate / scale are written, one write per frame.
   Off with reduced motion, and off when the stage would not fit on the screen. */
(function(){var hero=document.querySelector('.hero.hv');if(!hero)return;
 if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 var root=document.documentElement,track=hero.querySelector('[data-hv-track]'),portal=hero.querySelector('.hv-portal'),
  l1=hero.querySelector('.ln:nth-child(1)'),l2=hero.querySelector('.ln:nth-child(2)'),shell=hero.querySelector('.hv-shell'),stage=hero.querySelector('.hv-stage'),
  sl=hero.querySelector('.hv-l b'),sr=hero.querySelector('.hv-r b'),dock=hero.querySelector('.pro-dock'),fig=hero.querySelector('.hv-stage .tool-visual');
 if(!track||!portal||!shell||!stage||!fig)return;
 var bar=document.createElement('div');bar.className='hv-pinbar';bar.setAttribute('aria-hidden','true');bar.innerHTML='<b>01</b><i></i><span>10</span>';portal.appendChild(bar);
 var num=bar.querySelector('b'),N=10,pinTop=76,extra=0,pinned=false,tick=0,lastP=-1,lastIx=-1,jt=0,vis=true;
 function measure(){
  var room=innerHeight-pinTop-10;stage.style.maxWidth='';portal.style.zoom='';
  var ph=portal.offsetHeight;
  /* a little too tall for the screen: narrow the demo window (its height follows its width) until the stage fits */
  for(var pass=0;pass<3&&ph>room&&ph-room<ph*.38&&stage.offsetWidth>340;pass++){stage.style.maxWidth=Math.max(340,Math.floor(stage.offsetWidth-(ph-room)/1.05-6))+'px';ph=portal.offsetHeight;}
  if(ph>room&&room/ph>=.66&&'zoom' in portal.style){portal.style.zoom=(room/ph).toFixed(3);ph=portal.getBoundingClientRect().height;}
  var want=ph<=room+1&&innerHeight>=480;
  if(want!==pinned){pinned=want;root.classList.toggle('hv-pin',pinned);}
  if(pinned){var list=(fig.dataset.explainer||'').split(',').length;N=Math.max(2,list);extra=Math.round(N*innerHeight*(innerWidth>980?.3:.26));track.style.setProperty('--pin-extra',extra+'px');track.style.setProperty('--pin-top',pinTop+'px');bar.lastElementChild.textContent=(N<10?'0':'')+N;}
 }
 function setTool(ix){
  var pl=fig.__player;if(!pl||!pl.list||ix>=pl.list.length)return;
  clearTimeout(jt);jt=setTimeout(function(){pl.manual=true;pl.jump(ix);},110);
 }
 function paint(){tick=0;if(!vis)return;
  var h=Math.max(hero.offsetHeight,1),sy=scrollY,
   /* headline lines part while the page first moves */
   a=Math.min(1,Math.max(0,sy/(h*.45))),ea=a*a*(3-2*a),k=innerWidth>980?1:.55;
  l1.style.transform='translate3d('+(-ea*7*k).toFixed(2)+'vw,0,0)';l2.style.transform='translate3d('+(ea*7*k).toFixed(2)+'vw,0,0)';
  var p=0;
  if(pinned&&extra>0){var r=track.getBoundingClientRect();p=Math.min(1,Math.max(0,(pinTop-r.top)/extra));}
  else{var pr=portal.getBoundingClientRect();p=Math.min(1,Math.max(0,(innerHeight*.9-pr.top)/(innerHeight*.9+pr.height)))*.6;}
  p=Math.round(p*500)/500;if(p===lastP)return;lastP=p;
  var e=p*p*(3-2*p);
  shell.style.scale=(1-e*.05).toFixed(4);
  stage.style.scale=(1+e*.04).toFixed(4);
  if(sl)sl.style.translate=(-e*4).toFixed(2)+'vw '+(e*26).toFixed(1)+'px';if(sr)sr.style.translate=(e*4).toFixed(2)+'vw '+(-e*20).toFixed(1)+'px';
  if(dock)dock.style.translate='0 '+(-e*6).toFixed(1)+'px';
  if(pinned&&extra>0){
   bar.style.setProperty('--pp',p.toFixed(3));
   var ix=Math.min(N-1,Math.floor(p*N));
   if(p>0&&p<1||ix!==lastIx){if(ix!==lastIx){lastIx=ix;num.textContent=(ix+1<10?'0':'')+(ix+1);setTool(ix);}}
   var pl=fig.__player;if(pl)pl.manual=p>0;
  }
 }
 function req(){if(!tick)tick=requestAnimationFrame(paint);}
 addEventListener('scroll',req,{passive:true});
 addEventListener('resize',function(){measure();lastP=-1;req();});
 addEventListener('load',function(){measure();lastP=-1;req();});
 if('ResizeObserver' in window)new ResizeObserver(function(){measure();lastP=-1;req();}).observe(portal);
 if('IntersectionObserver' in window)new IntersectionObserver(function(es){vis=es[0].isIntersecting;if(vis){lastP=-1;req();}},{rootMargin:'200px 0px'}).observe(hero);
 measure();paint();})();
