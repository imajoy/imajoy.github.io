/* The Wrapline logo loader covers a page until it has really finished: files, fonts, and anything the page asked the server for. */
(()=>{const s=document.getElementById('pg-skel');if(!s)return;
let over=false;
const done=()=>{if(over)return;over=true;s.classList.add('done');document.documentElement.classList.add('pg-ready');document.dispatchEvent(new Event('ajoy:page-shown'));setTimeout(()=>s.remove(),600);};
/* Wait until the page stops changing (nothing added or rewritten for a moment), so it is never shown half built. */
const settle=(quiet,cap,busy)=>{let t;const mo=new MutationObserver(()=>{clearTimeout(t);t=setTimeout(check,quiet);});const fin=()=>{mo.disconnect();clearTimeout(t);clearTimeout(c);requestAnimationFrame(done);};const check=()=>{if(busy&&busy()){t=setTimeout(check,120);return;}fin();};const c=setTimeout(fin,cap);mo.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true});t=setTimeout(check,quiet);};
const fonts=()=>document.fonts?.ready||Promise.resolve();
/* A page that marks its loader data-hold keeps it up until the page itself says it is ready (ajoy:page-ready). */
if(s.hasAttribute('data-hold')){document.addEventListener('ajoy:page-ready',()=>fonts().then(()=>settle(320,2500)),{once:true});setTimeout(done,10000);return;}
if(s.hasAttribute('data-logo')){
 /* Count the server requests the page starts while loading; the loader lifts only when they have all answered. */
 let open=0;const native=window.fetch;
 if(native){window.fetch=function(...a){if(over)return native.apply(this,a);open++;const p=native.apply(this,a);const end=()=>{open=Math.max(0,open-1);};p.then(end,end);return p;};}
 /* Ready = files and fonts in, and every server request answered (page animations do not hold it back). */
 const go=()=>fonts().then(()=>{const t=performance.now();const poll=()=>{if(open>0&&performance.now()-t<3500){setTimeout(poll,80);return;}requestAnimationFrame(done);};setTimeout(poll,120);});
 if(document.readyState==='complete')go();else addEventListener('load',go,{once:true});setTimeout(done,9000);return;}
if(document.readyState==='complete')done();else{addEventListener('load',done,{once:true});setTimeout(done,9000);}})();
