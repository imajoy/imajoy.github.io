/* Wrapline Pro hero: a Maya-style timeline under the tool window.
   Ten keyframes, one per tool. While the stage is pinned, scrolling scrubs the playhead (js/pro-stage.js reports the progress);
   where the stage is not pinned (phones, reduced motion) the playhead glides to each key as the demo moves on.
   Per frame it writes two transforms and one clip-path on small elements; nothing here causes layout. */
(function(){
 var hero=document.querySelector('.hero.hv'),st=hero&&hero.querySelector('.hv-stage'),dock=st&&st.querySelector('.pro-dock');if(!st||!dock)return;
 var reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
 var KEYS=['IK','FBX','RVT','RBK','PB','D&D','ABC','HK','AUD','REV'],N=KEYS.length,FRAMES=240;
 var names=['Advanced IK FK Switch','FBX Exporter','Rivet','Rebake IK Space','Playblast','Drag & Drop','Alembic Exporter','Hotkey Manager','Audio Exporter','Revert to Last Saved'];
 var el=document.createElement('div');el.className='ptl';el.setAttribute('role','group');el.setAttribute('aria-label','Tool timeline');
 /* graph-editor curve through the ten keys (alternating heights, eased tangents) */
 var W=1000,H=44,pts=[],d='';
 for(var i=0;i<N;i++)pts.push([(i+.5)/N*W,i%2?H*.26:H*.74]);
 d='M0 '+(H*.5)+' C'+(pts[0][0]*.5)+' '+(H*.5)+' '+(pts[0][0]*.5)+' '+pts[0][1]+' '+pts[0][0]+' '+pts[0][1];
 for(i=1;i<N;i++){var mx=(pts[i-1][0]+pts[i][0])/2;d+=' C'+mx+' '+pts[i-1][1]+' '+mx+' '+pts[i][1]+' '+pts[i][0]+' '+pts[i][1];}
 d+=' C'+((pts[N-1][0]+W)/2)+' '+pts[N-1][1]+' '+((pts[N-1][0]+W)/2)+' '+(H*.5)+' '+W+' '+(H*.5);
 var svg='<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" aria-hidden="true"><path d="'+d+'"/></svg>';
 var nums='';for(i=0;i<=10;i++)nums+='<i style="left:'+(i*10)+'%">'+(i===0?1:i*24)+'</i>';
 var keys='';for(i=0;i<N;i++)keys+='<button type="button" class="ptl-key" style="left:'+((i+.5)/N*100).toFixed(2)+'%" data-i="'+i+'" aria-label="'+names[i]+'" title="'+names[i]+'"><b></b><span>'+KEYS[i]+'</span></button>';
 el.innerHTML='<div class="ptl-top"><span class="ptl-name" aria-live="polite"></span><span class="ptl-frame"><small>FRAME</small><b>001</b><em>/ '+FRAMES+'</em></span></div>'+
  '<div class="ptl-lane"><div class="ptl-ruler" aria-hidden="true">'+nums+'</div><div class="ptl-curve">'+svg+'<div class="ptl-curve-on">'+svg+'</div></div>'+keys+
  '<div class="ptl-head" aria-hidden="true"><i></i></div></div>';
 dock.after(el);st.classList.add('has-ptl');
 var lane=el.querySelector('.ptl-lane'),head=el.querySelector('.ptl-head'),on=el.querySelector('.ptl-curve-on'),fr=el.querySelector('.ptl-frame b'),nm=el.querySelector('.ptl-name'),
  btns=[].slice.call(el.querySelectorAll('.ptl-key')),w=0,lastF=-1,lastK=-1,scrub=false;
 function size(){w=lane.clientWidth;}
 size();if('ResizeObserver' in window)new ResizeObserver(size).observe(lane);else addEventListener('resize',size);
 function draw(p){
  head.style.transform='translate3d('+(p*w).toFixed(1)+'px,0,0)';
  on.style.clipPath='inset(0 '+((1-p)*100).toFixed(2)+'% 0 0)';
  var f=1+Math.round(p*(FRAMES-1));if(f!==lastF){lastF=f;fr.textContent=(f<10?'00':f<100?'0':'')+f;}
 }
 function key(ix){
  if(ix===lastK)return;lastK=ix;nm.textContent=names[ix]||'';
  btns.forEach(function(b,i){b.classList.toggle('past',i<ix);b.classList.toggle('on',i===ix);});
  if(!reduce){var b=btns[ix];b.classList.remove('hit');void b.offsetWidth;b.classList.add('hit');nm.classList.remove('sw');void nm.offsetWidth;nm.classList.add('sw');}
 }
 /* pinned: js/pro-stage.js calls this every frame it moves */
 window.__hvTime=function(p,ix){scrub=true;el.classList.add('is-scrub');draw(p);key(ix);};
 /* not pinned: follow the demo */
 st.addEventListener('xp-tool',function(e){var ix=e.detail.ix;if(scrub&&document.documentElement.classList.contains('hv-pin')){key(ix);return;}
  el.classList.remove('is-scrub');draw((ix+.5)/N);key(ix);});
 /* a key is a shortcut: scroll the pinned stage to that tool, or jump the demo there */
 el.addEventListener('click',function(e){var b=e.target.closest('.ptl-key');if(!b)return;var ix=+b.dataset.i,track=hero.querySelector('[data-hv-track]');
  if(document.documentElement.classList.contains('hv-pin')&&track){var extra=parseFloat(track.style.getPropertyValue('--pin-extra'))||0,top=parseFloat(track.style.getPropertyValue('--pin-top'))||0;
   var y=scrollY+track.getBoundingClientRect().top-top+extra*((ix+.5)/N);scrollTo({top:y,behavior:reduce?'auto':'smooth'});}
  else{var fig=st.querySelector('.tool-visual'),pl=fig&&fig.__player;if(pl&&pl.jump){pl.manual=true;pl.jump(ix);}}});
 draw(.5/N);key(0);
})();
