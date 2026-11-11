/* Wrapline Pro hero "showcase": the tool window is the one object on stage.
   Behind it: a colour field that changes with the tool, the tool's name passing by in very large outlined type, a thin ring and fine vertical rules.
   In the corner the next tool waits as a small card; when the tool changes the current window shrinks away up and out,
   and the next one swings in from that corner. Only transform / opacity are animated (Web Animations), nothing here causes layout. */
(function(){
 var hero=document.querySelector('.hero.hv'),portal=hero&&hero.querySelector('.hv-portal'),st=hero&&hero.querySelector('.hv-stage'),dv=st&&st.querySelector('.pro-device');
 if(!portal||!dv)return;
 var reduce=matchMedia('(prefers-reduced-motion: reduce)').matches,phone=matchMedia('(max-width:767px)').matches;
 var T=['Advanced IK FK Switch','FBX Exporter','Rivet','Rebake IK Space','Playblast','Drag & Drop','Alembic Exporter','Hotkey Manager','Audio Exporter','Revert to Last Saved'],
  A=['IK','FBX','RVT','RBK','PB','D&D','ABC','HK','AUD','REV'],H=[212,28,168,262,352,44,190,286,330,140],N=T.length;
 var back=document.createElement('div');back.className='psh-back';back.setAttribute('aria-hidden','true');
 back.innerHTML='<i class="psh-lines"></i><div class="psh-mq"><div class="psh-mq-run"><span></span><span></span></div></div>'+(phone?'':'<i class="psh-ring"><b></b></i>');
 portal.insertBefore(back,portal.firstChild.nextSibling);
 var next=document.createElement('button');next.type='button';next.className='psh-next';
 next.innerHTML='<span class="psh-next-k">Next</span><span class="psh-next-card"><i></i><b></b></span><span class="psh-next-t"><em></em><strong></strong></span>';
 portal.appendChild(next);hero.classList.add('has-psh');
 var mq=back.querySelectorAll('.psh-mq-run span'),run=back.querySelector('.psh-mq-run'),ring=back.querySelector('.psh-ring')||{animate:function(){}},
  nCard=next.querySelector('.psh-next-card'),nAb=nCard.querySelector('b'),nNo=next.querySelector('em'),nNm=next.querySelector('strong'),cur=-1;
 var E='cubic-bezier(.22,1,.36,1)';
 function setNext(ix){var n=(ix+1)%N;nAb.textContent=A[n];nNo.textContent=(n+1<10?'0':'')+(n+1);nNm.textContent=T[n];next.style.setProperty('--nh',H[n]);next.dataset.i=n;next.setAttribute('aria-label','Next tool: '+T[n]);}
 function setWords(ix){var w=(T[ix]+' · ').toUpperCase();mq[0].textContent=w+w;mq[1].textContent=w+w;}
 function show(ix){
  if(ix===cur)return;var first=cur<0;cur=ix;
  hero.style.setProperty('--sh',H[ix]);
  if(first||reduce||!run.animate){setWords(ix);setNext(ix);return;}
  run.parentNode.animate([{opacity:1},{opacity:0}],{duration:180,easing:'ease-out',fill:'forwards'}).onfinish=function(){setWords(ix);run.parentNode.animate([{opacity:0,transform:'translate3d(0,4%,0)'},{opacity:1,transform:'none'}],{duration:700,easing:E,fill:'forwards'});};
  ring.animate([{scale:.93,opacity:.4},{scale:1,opacity:1}],{duration:900,easing:E});
  next.animate([{opacity:1,translate:'0 0'},{opacity:0,translate:'-22px -18px'}],{duration:200,easing:'cubic-bezier(.4,0,1,1)',fill:'forwards'}).onfinish=function(){setNext(ix);next.animate([{opacity:0,translate:'26px 22px'},{opacity:1,translate:'0 0'}],{duration:620,delay:260,easing:E,fill:'both'});};
 }
 /* the event's own index follows the old dock order, so look the tool up by name */
 st.addEventListener('xp-tool',function(e){var i=T.indexOf(e.detail.title);if(i>=0)show(i);});
 /* the pin controller (js/pro-stage.js) asks for these two moves around a tool change */
 if(!reduce&&dv.animate){
  window.__hvLeave=function(dir,done){
   if(phone){var pa=dv.animate([{opacity:1,scale:1},{opacity:0,scale:.97}],{duration:160,easing:'ease-out',fill:'forwards'});pa.onfinish=function(){done();pa.cancel();};return;}
   var an=dv.animate([{translate:'0 0',scale:1,rotate:'0deg',opacity:1},{translate:(-dir*16)+'vw -9vh',scale:.5,rotate:(-dir*7)+'deg',opacity:0}],{duration:300,easing:'cubic-bezier(.5,0,.8,.3)',fill:'forwards'});
   an.onfinish=function(){done();an.cancel();};};
  window.__hvEnter=function(dir){
   if(phone){dv.animate([{opacity:0,scale:.97},{opacity:1,scale:1}],{duration:420,easing:E});return;}
   dv.animate([{translate:(dir*24)+'vw 20vh',scale:.34,rotate:(dir*9)+'deg',opacity:0},{opacity:1,offset:.35},{translate:'0 0',scale:1,rotate:'0deg',opacity:1}],{duration:820,easing:E});};
 }
 /* the corner card is a shortcut to the next tool */
 next.addEventListener('click',function(){var ix=+next.dataset.i||0,track=hero.querySelector('[data-hv-track]');
  if(document.documentElement.classList.contains('hv-pin')&&track){var extra=parseFloat(track.style.getPropertyValue('--pin-extra'))||0,top=parseFloat(track.style.getPropertyValue('--pin-top'))||0;
   scrollTo({top:scrollY+track.getBoundingClientRect().top-top+extra*((ix+.5)/N),behavior:reduce?'auto':'smooth'});}
  else{var fig=st.querySelector('.tool-visual'),pl=fig&&fig.__player;if(pl&&pl.jump){pl.manual=true;pl.jump(ix);}}});
 show(0);
})();
