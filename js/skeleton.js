/* Removes the loading skeleton once the page has finished loading (it only appears if loading is slow). */
(()=>{const s=document.getElementById('pg-skel');if(!s)return;
const done=()=>{s.classList.add('done');setTimeout(()=>s.remove(),500);};
/* A page that marks its loader data-hold keeps it up until the page says it is ready (ajoy:page-ready), so nothing shows half-loaded. */
if(s.hasAttribute('data-hold')){const settle=()=>{let t;const mo=new MutationObserver(()=>{clearTimeout(t);t=setTimeout(fin,320);});const fin=()=>{mo.disconnect();clearTimeout(cap);requestAnimationFrame(done);};const cap=setTimeout(fin,2500);mo.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true});t=setTimeout(fin,320);};
const ready=()=>{(document.fonts?.ready||Promise.resolve()).then(settle);};document.addEventListener('ajoy:page-ready',ready,{once:true});setTimeout(done,10000);}
else if(document.readyState==='complete')done();else{addEventListener('load',done,{once:true});setTimeout(done,9000);}})();
