/* Landing page: runs the Wrapline intro until the page is truly ready, then hands over to the hero, the scroll reveals and the 3D scene (js/landing-scene.js). The page reads fine without this file. */
(()=>{
const root=document.documentElement,cl=root.classList,intro=document.getElementById('lx-intro');
const calm=cl.contains('lx-calm'),seen=cl.contains('lx-seen');
let t0=performance.now();const MIN=calm?0:seen?2150:3350;
let sceneReady=Promise.resolve();
/* ---- 3D scene: loaded while the intro plays, so it is already drawn when the curtain lifts ---- */
const canvas=document.getElementById('lx-scene');
const lite=navigator.connection?.saveData===true;
if(canvas&&!calm&&!lite){
 sceneReady=import('./landing-scene.js?v=lx2').then(m=>m.start(canvas)).then(ok=>{if(ok)cl.add('lx-3d');}).catch(()=>{});
}
/* ---- intro ---- */
let left=false;
function leave(){
 if(left)return;left=true;
 try{sessionStorage.setItem('lx.seen','1');}catch{}
 cl.remove('lx-intro-on');
 if(!intro){cl.add('lx-go');return;}
 intro.classList.add('out');
 setTimeout(()=>cl.add('lx-go'),calm?0:420);
 setTimeout(()=>intro.remove(),1600);
}
const loaded=new Promise(r=>{if(document.readyState==='complete')r();else addEventListener('load',r,{once:true});});
const fonts=document.fonts?.ready||Promise.resolve();
const wait=ms=>new Promise(r=>setTimeout(r,ms));
/* the intro only starts once the brand font is in, so the letters never change shape while they move */
const face=document.fonts?.load?document.fonts.load('600 96px Geist','Wrapline').catch(()=>{}):Promise.resolve();
Promise.race([face,wait(1600)]).then(()=>requestAnimationFrame(()=>{t0=performance.now();cl.add('lx-play');}));
Promise.all([loaded,fonts,Promise.race([sceneReady,wait(2600)])]).then(()=>{const go=()=>{if(!cl.contains('lx-play')){setTimeout(go,60);return;}setTimeout(leave,Math.max(0,MIN-(performance.now()-t0)));};go();});
setTimeout(leave,8500);
addEventListener('pageshow',e=>{if(e.persisted)leave();});
/* ---- reveals ---- */
const io='IntersectionObserver' in window?new IntersectionObserver(es=>{for(const e of es)if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}},{rootMargin:'0px 0px -8% 0px',threshold:.06}):null;
for(const n of document.querySelectorAll('[data-lx-r]')){if(io&&!calm)io.observe(n);else n.classList.add('in');}
/* ---- scroll-linked planes and drawn curves: each gets --p from 0 (entering) to 1 (in place) ---- */
const linked=[...document.querySelectorAll('[data-lx-tilt],[data-lx-draw]')].map(n=>({n,draw:n.hasAttribute('data-lx-draw'),last:-1,steps:n.classList.contains('lx-time')?[...n.querySelectorAll('.lx-step')].map(el=>({el,at:parseFloat(el.style.getPropertyValue('--at'))||0})):null}));
let queued=false;
function measure(){
 queued=false;const vh=innerHeight;
 for(const it of linked){
  const r=it.n.getBoundingClientRect();if(r.bottom<-200||r.top>vh+200)continue;
  let p=it.draw?(vh*.82-r.top)/(vh*.5):(vh-r.top)/(vh*.7);
  p=Math.max(0,Math.min(1,p));p=Math.round(p*1000)/1000;
  if(p!==it.last){it.last=p;it.n.style.setProperty('--p',p);if(it.steps)for(const st of it.steps)st.el.classList.toggle('is-on',p>=st.at);}
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
/* ---- hero drifts up and thins out as it is scrolled away (scrubbed by the scroll itself) ---- */
const heroIn=document.querySelector('.lx-hero-in');
if(heroIn&&!calm){let hq=false,hl=-1;const hs=()=>{hq=false;const v=Math.max(0,Math.min(1,scrollY/(innerHeight*.75)));if(v===hl)return;hl=v;heroIn.style.transform=v?'translate3d(0,'+(-v*70).toFixed(1)+'px,0)':'';heroIn.style.opacity=v?(1-v*.9).toFixed(3):'';};addEventListener('scroll',()=>{if(!hq){hq=true;requestAnimationFrame(hs);}},{passive:true});}
/* ---- showcase: real recordings; the clip in view plays, tabs switch clips and move on by themselves ---- */
const stage=document.querySelector('.lx-stage');
if(stage){
 const vids=[...stage.querySelectorAll('video[data-lx-clip]')],tabs=[...stage.querySelectorAll('[data-lx-tab]')],label=stage.querySelector('[data-lx-clip-name]');
 let cur=0,visible=false,timer=0,held=false;
 const load=v=>{if(v.dataset.ready)return;v.dataset.ready='1';for(const [k,t] of [['webm','video/webm'],['mp4','video/mp4']]){if(!v.dataset[k])continue;const so=document.createElement('source');so.src=v.dataset[k];so.type=t;v.append(so);}v.load();};
 const play=()=>{vids.forEach((v,i)=>{if(i===cur&&visible&&!calm){load(v);const pr=v.play();if(pr)pr.catch(()=>{});}else v.pause();});};
 const arm=()=>{clearTimeout(timer);if(visible&&!held&&!calm&&tabs.length>1)timer=setTimeout(()=>show((cur+1)%tabs.length),8000);};
 function show(i){cur=i;tabs.forEach((t,k)=>{const on=k===i;t.classList.remove('is-on');t.setAttribute('aria-selected',String(on));if(on){void t.offsetWidth;t.classList.add('is-on');}});vids.forEach((v,k)=>v.classList.toggle('is-on',k===i));if(label)label.textContent=tabs[i].dataset.name;play();arm();}
 tabs.forEach((t,i)=>t.addEventListener('click',()=>show(i)));
 stage.addEventListener('pointerenter',()=>{held=true;clearTimeout(timer);});stage.addEventListener('pointerleave',()=>{held=false;arm();});
 if('IntersectionObserver' in window)new IntersectionObserver(es=>{visible=es[0].isIntersecting;play();arm();},{rootMargin:'200px 0px',threshold:.15}).observe(stage);else{visible=true;play();}
 document.addEventListener('visibilitychange',()=>{if(document.hidden){vids.forEach(v=>v.pause());clearTimeout(timer);}else{play();arm();}});
}
const y=document.getElementById('year');if(y)y.textContent=new Date().getFullYear();
})();
