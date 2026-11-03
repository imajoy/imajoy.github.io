/* Download page: pointer tilt on the tile and a magnetic pull on the main button. Decorative only. */
(()=>{
 if(matchMedia('(prefers-reduced-motion: reduce)').matches||!matchMedia('(hover: hover) and (pointer: fine)').matches)return;
 const tilt=document.querySelector('.dl-tilt'),stage=document.querySelector('.dl-stage'),main=document.querySelector('#dl');
 if(tilt&&main)main.addEventListener('pointermove',e=>{
  const r=stage.getBoundingClientRect(),x=(e.clientX-(r.left+r.width/2))/Math.max(300,innerWidth/2),y=(e.clientY-(r.top+r.height/2))/Math.max(300,innerHeight/2);
  tilt.style.setProperty('--ry',(Math.max(-1,Math.min(1,x))*22).toFixed(1)+'deg');tilt.style.setProperty('--rx',(Math.max(-1,Math.min(1,y))*-18).toFixed(1)+'deg');
 },{passive:true});
 if(main)main.addEventListener('pointerleave',()=>{tilt&&(tilt.style.setProperty('--rx','0deg'),tilt.style.setProperty('--ry','0deg'));});
 document.querySelectorAll('.dl-panel .btn-blue').forEach(b=>{
  b.addEventListener('pointermove',e=>{const r=b.getBoundingClientRect();b.style.setProperty('--mx',((e.clientX-r.left-r.width/2)*.12).toFixed(1)+'px');b.style.setProperty('--my',((e.clientY-r.top-r.height/2)*.22).toFixed(1)+'px');},{passive:true});
  b.addEventListener('pointerleave',()=>{b.style.removeProperty('--mx');b.style.removeProperty('--my');});
 });
})();
