/* A refresh starts clean: the browser is not allowed to put back text, choices or ticks that were typed but never saved.
   This runs last, notes what the page itself filled in (saved details only), and restores exactly that once the browser has finished loading. */
(()=>{
let reloaded=false;try{reloaded=performance.getEntriesByType('navigation')[0]?.type==='reload';}catch{}
if(!reloaded)return;
const tick=el=>el.type==='checkbox'||el.type==='radio';
const snap=[...document.querySelectorAll('input:not([type=hidden]):not([type=file]),textarea,select')].map(el=>[el,tick(el)?el.checked:el.value]);
const touched=new WeakSet();
const mark=e=>{if(e.isTrusted)touched.add(e.target);};
addEventListener('input',mark,true);addEventListener('change',mark,true);
const put=()=>{for(const [el,v] of snap){if(touched.has(el)||!el.isConnected)continue;if(tick(el)){if(el.checked!==v)el.checked=v;}else if(el.value!==v)el.value=v;}};
document.addEventListener('DOMContentLoaded',put,{once:true});
addEventListener('pageshow',()=>{put();removeEventListener('input',mark,true);removeEventListener('change',mark,true);},{once:true});
})();
