/* Install window: pointer-driven 3D (tilt, layered depth, moving glare). Pointer devices only; sleeps when off screen or idle. */
(function(){
 var st=document.getElementById('stage-install');if(!st)return;
 var win=st.querySelector('.win');if(!win)return;
 if(!window.matchMedia('(hover:hover) and (pointer:fine)').matches||window.matchMedia('(prefers-reduced-motion:reduce)').matches)return;
 win.classList.remove('tilt');win.removeAttribute('data-tilt');
 var glare=document.createElement('i');glare.className='win-glare';glare.setAttribute('aria-hidden','true');win.appendChild(glare);
 var base=[-10,4],max=15,t={x:0,y:0,h:0},c={x:0,y:0,h:0},run=false,vis=true,raf=0;
 function frame(){
  raf=0;
  c.x+=(t.x-c.x)*.085;c.y+=(t.y-c.y)*.085;c.h+=(t.h-c.h)*.08;
  win.style.transform='perspective(1400px) rotateY('+(base[0]+c.x*max).toFixed(2)+'deg) rotateX('+(base[1]-c.y*max*.7).toFixed(2)+'deg) translate3d(0,'+(-c.h*10).toFixed(2)+'px,'+(c.h*40).toFixed(1)+'px)';
  win.style.setProperty('--gx',(50+c.x*45).toFixed(1)+'%');win.style.setProperty('--gy',(40+c.y*45).toFixed(1)+'%');
  win.style.setProperty('--sx',(-c.x*26).toFixed(1)+'px');win.style.setProperty('--sy',(34-c.y*18).toFixed(1)+'px');win.style.setProperty('--gh',c.h.toFixed(3));
  st.style.setProperty('--px',(c.x*-14).toFixed(1)+'px');st.style.setProperty('--py',(c.y*-10).toFixed(1)+'px');
  var settle=Math.abs(c.x-t.x)<.002&&Math.abs(c.y-t.y)<.002&&Math.abs(c.h-t.h)<.002;
  if(settle&&t.h===0){run=false;win.style.transform='';win.style.removeProperty('--gh');return;}
  raf=requestAnimationFrame(frame);
 }
 function go(){if(!run&&vis){run=true;raf=requestAnimationFrame(frame);}}
 st.addEventListener('pointermove',function(e){var r=st.getBoundingClientRect();t.x=Math.max(-1,Math.min(1,((e.clientX-r.left)/r.width-.5)*2));t.y=Math.max(-1,Math.min(1,((e.clientY-r.top)/r.height-.5)*2));t.h=1;go();});
 st.addEventListener('pointerleave',function(){t.x=0;t.y=0;t.h=0;go();});
 if('IntersectionObserver' in window)new IntersectionObserver(function(es){vis=es[0].isIntersecting;if(!vis&&raf){cancelAnimationFrame(raf);raf=0;run=false;}}).observe(st);
})();
