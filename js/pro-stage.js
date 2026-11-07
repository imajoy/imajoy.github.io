/* Pointer lean + light for the Wrapline Pro hero stage. Writes only CSS variables on one element, one rAF at a time. */
(function(){
 var st=document.querySelector('.pro-stage');if(!st)return;
 var dev=st.querySelector('.pro-device'),fig=st.querySelector('.tool-visual');
 if(!dev||matchMedia('(prefers-reduced-motion: reduce)').matches||!matchMedia('(hover:hover) and (pointer:fine)').matches)return;
 var f=0,ex=0,ey=0,on=false;
 function frame(){f=0;var r=st.getBoundingClientRect(),x=(ex-r.left)/r.width,y=(ey-r.top)/r.height;
  var nx=Math.max(-1,Math.min(1,(x-.5)*2)),ny=Math.max(-1,Math.min(1,(y-.5)*2));
  dev.style.setProperty('--ry',(-6+nx*7).toFixed(2)+'deg');dev.style.setProperty('--rx',(-ny*5).toFixed(2)+'deg');
  fig.style.setProperty('--gx',(x*100).toFixed(1)+'%');fig.style.setProperty('--gy',(y*100).toFixed(1)+'%');}
 window.addEventListener('pointermove',function(e){ex=e.clientX;ey=e.clientY;if(!f)f=requestAnimationFrame(frame);},{passive:true});
 st.addEventListener('pointerenter',function(){dev.classList.add('is-live');});
 st.addEventListener('pointerleave',function(){dev.classList.remove('is-live');dev.style.removeProperty('--rx');dev.style.removeProperty('--ry');});
})();
