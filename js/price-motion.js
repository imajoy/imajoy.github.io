/* Only the displayed amount changes. Totals used for checkout never come from animation frames. */
const active=new Map(),last=new WeakMap(),preference=matchMedia('(prefers-reduced-motion: reduce)');
export function settlePrices(){for(const finish of [...active.values()])finish();}
export function animatePrice(element,value,format,enabled=true){
 active.get(element)?.();
 const from=last.get(element);last.set(element,value);
 const final=format(value);
 element.setAttribute('aria-label',final);
 if(!enabled||preference.matches||document.hidden||from===undefined||from===value){element.textContent=final;return;}
 const rect=element.getBoundingClientRect();
 if(rect.bottom<0||rect.top>innerHeight){element.textContent=final;return;}
 let frame,start;
 const finish=()=>{cancelAnimationFrame(frame);element.textContent=final;active.delete(element);};
 active.set(element,finish);
 const visual=document.createElement('span');visual.setAttribute('aria-hidden','true');element.replaceChildren(visual);
 function tick(now){
  start??=now;const progress=Math.min(1,(now-start)/420),eased=1-(1-progress)**3;
  visual.textContent=format(Math.round(from+(value-from)*eased));
  if(progress<1)frame=requestAnimationFrame(tick);else finish();
 }
 frame=requestAnimationFrame(tick);
}
document.addEventListener('visibilitychange',()=>{if(document.hidden)settlePrices();});
preference.addEventListener('change',()=>{if(preference.matches)settlePrices();});
