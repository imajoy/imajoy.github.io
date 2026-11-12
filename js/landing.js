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
 sceneReady=import('./landing-scene.js?v=lx3').then(m=>m.start(canvas)).then(ok=>{if(ok)cl.add('lx-3d');}).catch(()=>{});
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
const io='IntersectionObserver' in window?new IntersectionObserver(es=>{for(const e of es)if(e.isIntersecting){const n=e.target;n.classList.add('in');io.unobserve(n);setTimeout(()=>n.classList.add('lx-done'),1700);}},{rootMargin:'0px 0px -4% 0px',threshold:.04}):null;
for(const n of document.querySelectorAll('[data-lx-r]')){if(io&&!calm)io.observe(n);else n.classList.add('in');}
/* ---- scroll-linked planes and drawn curves: each gets --p from 0 (entering) to 1 (in place) ---- */
const linked=[...document.querySelectorAll('[data-lx-tilt],[data-lx-draw]')].map(n=>({n,draw:n.hasAttribute('data-lx-draw'),last:-1,steps:n.classList.contains('lx-time')?[...n.querySelectorAll('.lx-step')].map(el=>({el,at:parseFloat(el.style.getPropertyValue('--at'))||0})):null}));
let queued=false;
function measure(){
 queued=false;const vh=innerHeight;extras(vh);
 for(const it of linked){
  const r=it.n.getBoundingClientRect();if(r.bottom<-200||r.top>vh+200)continue;
  let p=it.draw?(vh*.82-r.top)/(vh*.5):(vh-r.top)/(vh*.7);
  p=Math.max(0,Math.min(1,p));p=Math.round(p*1000)/1000;
  if(p!==it.last){it.last=p;it.n.style.setProperty('--p',p);if(it.steps)for(const st of it.steps)st.el.classList.toggle('is-on',p>=st.at);}
 }
}
const band=document.querySelector('[data-lx-band]');let bandX=null;
const wordsEl=document.querySelector('[data-lx-words]');let words=null,wordsRaw='';
/* the about line is split into words only while the page is in English, so a translated page keeps whole sentences */
function splitWords(){if(!wordsEl||words||calm)return;if(/translated-/.test(root.className)||(root.lang&&!/^en/i.test(root.lang)))return;wordsRaw=wordsEl.textContent;wordsEl.textContent='';words=wordsRaw.trim().split(/\s+/).map((w,i,all)=>{const sp=document.createElement('span');sp.className='lx-w';sp.textContent=w;sp.style.setProperty('--o','0');wordsEl.append(sp);if(i<all.length-1)wordsEl.append(' ');return sp;});}
function joinWords(){if(!words)return;wordsEl.textContent=wordsRaw;words=null;}
if(wordsEl){splitWords();new MutationObserver(()=>{if(/translated-/.test(root.className))joinWords();}).observe(root,{attributes:true,attributeFilter:['class','lang']});}
function extras(vh){
 if(band){const r=band.getBoundingClientRect();if(r.bottom>-100&&r.top<vh+100){const x=Math.round((vh/2-(r.top+r.height/2))*.42);if(x!==bandX){bandX=x;band.style.setProperty('--x',x);}}}
 if(words){const r=wordsEl.getBoundingClientRect();if(r.bottom>-50&&r.top<vh+50){const t=Math.max(0,Math.min(1,(vh*.86-r.top)/(vh*.42)))*(words.length+3);for(let i=0;i<words.length;i++){const o=Math.max(0,Math.min(1,(t-i)/3)).toFixed(2);if(words[i]._o!==o){words[i]._o=o;words[i].style.setProperty('--o',o);}}}}
}
const ask=()=>{if(!queued){queued=true;requestAnimationFrame(measure);}};
if(!calm){addEventListener('scroll',ask,{passive:true});addEventListener('resize',ask,{passive:true});measure();}
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
/* ---- showcase: a 3D deck of screens. The front one plays; a new one swings forward every few seconds, in a fresh order each visit ---- */
const stage=document.querySelector('.lx-stage');
if(stage){
 const cards=[...stage.querySelectorAll('.lx-card3d')],chips=[...stage.querySelectorAll('[data-lx-go]')],now=stage.querySelector('.lx-now');
 const field=k=>stage.querySelector('[data-lx-now="'+k+'"]');
 const DUR=7000,n=cards.length;
 /* order: the first stays first, the rest are shuffled */
 const order=[0,...cards.slice(1).map((_,i)=>i+1).sort(()=>Math.random()-.5)];
 let at=0,visible=false,timer=0,xpAsked=false,prev=-1;
 const loadVid=v=>{if(v.dataset.ready)return;v.dataset.ready='1';for(const [k,t] of [['webm','video/webm'],['mp4','video/mp4']]){if(!v.dataset[k])continue;const so=document.createElement('source');so.src=v.dataset[k];so.type=t;v.append(so);}v.load();};
 /* the walkthrough players are only fetched when the deck is close to the screen */
 const loadXp=()=>{if(xpAsked)return;xpAsked=true;for(const f of stage.querySelectorAll('[data-lx-explainer]'))f.setAttribute('data-explainer',f.dataset.lxExplainer);import('./tool-explainer.js?v=xp9').then(()=>setTimeout(media,60)).catch(()=>{});};
 function media(){const cur=order[at];cards.forEach((c,i)=>{const on=i===cur&&visible&&!calm;const v=c.querySelector('video');if(v){if(on){loadVid(v);const pr=v.play();if(pr)pr.catch(()=>{});}else v.pause();}const pl=c.querySelector('.lx-xp')?.__player;if(pl){pl.visible=on;pl.sync?.();}});}
 function place(){const cur=order[at];order.forEach((ci,k)=>{const c=cards[ci],d=(k-at+n)%n;if(ci===prev&&d!==0){c.dataset.pos='out';c.style.setProperty('--d',0);setTimeout(()=>{if(c.dataset.pos==='out'){c.dataset.pos='far';}},1000);}else if(d<=2){c.dataset.pos=String(d);c.style.setProperty('--d',d);}else c.dataset.pos='far';c.setAttribute('aria-hidden',String(d!==0));});
  chips.forEach(ch=>{const on=+ch.dataset.lxGo===cur;ch.classList.remove('is-on','is-timed');if(on){void ch.offsetWidth;ch.classList.add('is-on');if(visible&&!calm)ch.classList.add('is-timed');ch.style.setProperty('--dur',DUR+'ms');}ch.setAttribute('aria-pressed',String(on));});}
 function tell(){const c=cards[order[at]];if(!now)return;now.classList.add('swap');setTimeout(()=>{field('cat').textContent=c.dataset.cat;field('name').textContent=c.dataset.name;field('desc').textContent=c.dataset.desc;field('link').setAttribute('href',c.dataset.href);now.classList.remove('swap');},260);}
 const arm=()=>{clearTimeout(timer);if(visible&&!calm&&n>1)timer=setTimeout(()=>go((at+1)%n),DUR);};
 function go(k){if(k===at)return;prev=order[at];at=k;place();tell();media();arm();}
 chips.forEach(ch=>ch.addEventListener('click',()=>go(order.indexOf(+ch.dataset.lxGo))));
 cards.forEach((c,i)=>c.addEventListener('click',()=>{if(c.dataset.pos!=='0')go(order.indexOf(i));}));
 place();
 if('IntersectionObserver' in window){
  new IntersectionObserver(es=>{if(es[0].isIntersecting)loadXp();},{rootMargin:'700px 0px'}).observe(stage);
  new IntersectionObserver(es=>{visible=es[0].isIntersecting;place();media();arm();setTimeout(media,350);},{threshold:.2}).observe(stage);
 }else{visible=true;loadXp();media();arm();}
 document.addEventListener('visibilitychange',()=>{if(document.hidden){clearTimeout(timer);cards.forEach(c=>c.querySelector('video')?.pause());}else{media();arm();}});
}
const y=document.getElementById('year');if(y)y.textContent=new Date().getFullYear();
})();
