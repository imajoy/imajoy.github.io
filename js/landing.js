/* Landing page: runs the Wrapline intro until the page is truly ready, then hands over to the hero, the scroll reveals and the 3D scene (js/landing-scene.js). The page reads fine without this file. */
(()=>{
const root=document.documentElement,cl=root.classList,intro=document.getElementById('lx-intro');
const calm=cl.contains('lx-calm'),seen=cl.contains('lx-seen');
const t0=performance.now(),MIN=calm?0:seen?1150:2050;
let sceneReady=Promise.resolve();
/* ---- 3D scene: loaded while the intro plays, so it is already drawn when the curtain lifts ---- */
const canvas=document.getElementById('lx-scene');
const lite=navigator.connection?.saveData===true;
if(canvas&&!calm&&!lite){
 sceneReady=import('./landing-scene.js?v=lx1').then(m=>m.start(canvas)).then(ok=>{if(ok)cl.add('lx-3d');}).catch(()=>{});
}
/* ---- intro ---- */
let left=false;
function leave(){
 if(left)return;left=true;
 try{sessionStorage.setItem('lx.seen','1');}catch{}
 cl.remove('lx-intro-on');
 if(!intro){cl.add('lx-go');return;}
 intro.classList.add('out');
 setTimeout(()=>cl.add('lx-go'),calm?0:260);
 setTimeout(()=>intro.remove(),1400);
}
const loaded=new Promise(r=>{if(document.readyState==='complete')r();else addEventListener('load',r,{once:true});});
const fonts=document.fonts?.ready||Promise.resolve();
const wait=ms=>new Promise(r=>setTimeout(r,ms));
Promise.all([loaded,fonts,Promise.race([sceneReady,wait(2600)])]).then(()=>setTimeout(leave,Math.max(0,MIN-(performance.now()-t0))));
setTimeout(leave,6500);
addEventListener('pageshow',e=>{if(e.persisted)leave();});
/* ---- reveals ---- */
const io='IntersectionObserver' in window?new IntersectionObserver(es=>{for(const e of es)if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}},{rootMargin:'0px 0px -8% 0px',threshold:.06}):null;
for(const n of document.querySelectorAll('[data-lx-r]')){if(io&&!calm)io.observe(n);else n.classList.add('in');}
/* ---- scroll-linked planes and drawn curves: each gets --p from 0 (entering) to 1 (in place) ---- */
const linked=[...document.querySelectorAll('[data-lx-tilt],[data-lx-draw]')].map(n=>({n,draw:n.hasAttribute('data-lx-draw'),last:-1}));
let queued=false;
function measure(){
 queued=false;const vh=innerHeight;
 for(const it of linked){
  const r=it.n.getBoundingClientRect();if(r.bottom<-200||r.top>vh+200)continue;
  let p=it.draw?(vh*.82-r.top)/(vh*.5):(vh-r.top)/(vh*.7);
  p=Math.max(0,Math.min(1,p));p=Math.round(p*1000)/1000;
  if(p!==it.last){it.last=p;it.n.style.setProperty('--p',p);}
 }
}
const ask=()=>{if(!queued){queued=true;requestAnimationFrame(measure);}};
if(!calm&&linked.length){addEventListener('scroll',ask,{passive:true});addEventListener('resize',ask,{passive:true});measure();}
/* ---- tool cards lean toward the pointer (mouse only; nothing follows the cursor) ---- */
if(!calm&&matchMedia('(hover:hover) and (pointer:fine)').matches){
 for(const c of document.querySelectorAll('.lx-tool')){
  c.addEventListener('pointermove',e=>{const r=c.getBoundingClientRect();c.style.setProperty('--ry',(((e.clientX-r.left)/r.width-.5)*10).toFixed(2)+'deg');c.style.setProperty('--rx',((.5-(e.clientY-r.top)/r.height)*10).toFixed(2)+'deg');},{passive:true});
  c.addEventListener('pointerleave',()=>{c.style.setProperty('--rx','0deg');c.style.setProperty('--ry','0deg');});
 }
}
const y=document.getElementById('year');if(y)y.textContent=new Date().getFullYear();
})();
