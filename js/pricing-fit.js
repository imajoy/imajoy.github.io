/* Makes the Basic / Premium cards fit one screen on laptops and desktops.
   Scales the card row to the window height (never below 70%, never above 115%). Phones/tablets are untouched. */
(()=>{
const row=document.querySelector('#pricing .plans');if(!row)return;
const wide=matchMedia('(min-width:900px)'),MIN=.8,MAX=1.15,TOP=96,BOTTOM=28;
let raf=0,last=0;
const fit=()=>{
  raf=0;
  if(!wide.matches){row.style.zoom='';last=0;return;}
  row.style.zoom='1';
  const natural=row.getBoundingClientRect().height;
  if(!natural)return;
  const avail=innerHeight-TOP-BOTTOM;
  let z=Math.max(MIN,Math.min(MAX,avail/natural));
  z=Math.round(z*100)/100;
  if(z>=.98&&z<=1.02)z=1;
  row.style.zoom=z===1?'':String(z);last=z;
};
const queue=()=>{if(!raf)raf=requestAnimationFrame(fit)};
addEventListener('resize',queue,{passive:true});
wide.addEventListener?.('change',queue);
new MutationObserver(queue).observe(row,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['hidden','data-state']});
document.fonts?.ready.then(queue);addEventListener('load',queue);queue();
})();
