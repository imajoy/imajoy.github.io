/* Landing page: runs the Wrapline intro until the page is truly ready, then hands over to the hero, the scroll reveals and the 3D scene (js/landing-scene.js). The page reads fine without this file. */
(()=>{
const root=document.documentElement,cl=root.classList,intro=document.getElementById('lx-intro');
/* pages that reuse this file without the home intro (Wrapline Free): the Wrapline loader covers them instead */
if(!cl.contains('lx-on')){cl.add('lx-on');if(matchMedia('(prefers-reduced-motion: reduce)').matches)cl.add('lx-calm');}
const calm=cl.contains('lx-calm'),seen=cl.contains('lx-seen');
let t0=performance.now();const MIN=!intro||calm?0:seen?2150:3350;
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
 if(intro)try{sessionStorage.setItem('lx.seen','1');}catch{}
 cl.remove('lx-intro-on');
 if(!intro){const sk=document.getElementById('pg-skel');if(sk&&!sk.classList.contains('done'))document.addEventListener('ajoy:page-shown',()=>setTimeout(()=>cl.add('lx-go'),120),{once:true});else cl.add('lx-go');setTimeout(()=>cl.add('lx-go'),9500);return;}
 intro.classList.add('out');
 setTimeout(()=>cl.add('lx-go'),calm?0:420);
 setTimeout(()=>intro.remove(),1600);
}
const loaded=new Promise(r=>{if(document.readyState==='complete')r();else addEventListener('load',r,{once:true});});
const fonts=document.fonts?.ready||Promise.resolve();
const wait=ms=>new Promise(r=>setTimeout(r,ms));
/* the intro only starts once the brand font is in, so the letters never change shape while they move */
const face=document.fonts?.load?document.fonts.load('600 96px Geist','Wrapline').catch(()=>{}):Promise.resolve();
if(intro)Promise.race([face,wait(1600)]).then(()=>requestAnimationFrame(()=>{t0=performance.now();cl.add('lx-play');}));else cl.add('lx-play');
Promise.all(intro?[loaded,fonts,Promise.race([sceneReady,wait(2600)])]:[]).then(()=>{const go=()=>{if(!cl.contains('lx-play')){setTimeout(go,60);return;}setTimeout(leave,Math.max(0,MIN-(performance.now()-t0)));};go();});
setTimeout(leave,8500);
addEventListener('pageshow',e=>{if(e.persisted)leave();});
/* ---- reveals ---- */
/* A block animates in each time it comes onto the screen, from whichever side it arrives: from below when scrolling down, from above
   when scrolling back up. It is only reset once it has left the screen completely, so nothing ever disappears while visible. */
const io='IntersectionObserver' in window?new IntersectionObserver(es=>{for(const e of es){const n=e.target;
 if(e.isIntersecting&&(e.intersectionRatio>=.1||e.intersectionRect.height>innerHeight*.25)){if(!n.classList.contains('in')){/* which side is it arriving from? set that first, so it starts from the right place */const from=e.boundingClientRect.top<0?'above':'below';if(n.dataset.from!==from){n.dataset.from=from;void n.offsetWidth;}n.classList.add('in');clearTimeout(n._d);n._d=setTimeout(()=>n.classList.add('lx-done'),1700);}}
 else if(!e.isIntersecting){clearTimeout(n._d);n.classList.remove('in','lx-done');n.dataset.from=e.boundingClientRect.top<0?'above':'below';}
}},{threshold:[0,.1,.25]}):null;
for(const n of document.querySelectorAll('[data-lx-r]')){if(io&&!calm)io.observe(n);else n.classList.add('in');}
/* ---- scroll-linked planes and drawn curves: each gets --p from 0 (entering) to 1 (in place) ---- */
const linked=[...document.querySelectorAll('[data-lx-tilt],[data-lx-draw]')].map(n=>({n,draw:n.hasAttribute('data-lx-draw'),last:-1,steps:n.classList.contains('lx-time')&&!n.classList.contains('lx-inst')?[...n.querySelectorAll('.lx-step')].map(el=>({el,at:parseFloat(el.style.getPropertyValue('--at'))||0})):null}));
/* ---- setup: the little Maya window plays on its own while it is on screen (download, drag in, install, ready), then starts over; the steps can also be clicked ---- */
const inst=document.querySelector('.lx-inst');
if(inst){
 const items=[...inst.querySelectorAll('.lx-is')],T=[300,2300,2600,2400];let k=0,timer=0,vis=false;
 const set=n=>{k=n;inst.dataset.step=String(n);items.forEach((el,i)=>{el.classList.toggle('is-on',i<n);el.classList.toggle('is-now',i===n-1);});};
 const arm=()=>{clearTimeout(timer);if(vis&&!document.hidden&&!calm)timer=setTimeout(()=>{set((k+1)%4);arm();},T[k]);};
 items.forEach((el,i)=>{el.style.cursor='pointer';el.addEventListener('click',()=>{set(i+1);arm();});});
 if(calm)set(3);
 else if('IntersectionObserver' in window)new IntersectionObserver(es=>{vis=es[es.length-1].isIntersecting;if(vis&&k===0)setTimeout(()=>{if(vis&&k===0){set(1);arm();}},150);arm();},{threshold:.35}).observe(inst);
 else{vis=true;set(1);arm();}
 document.addEventListener('visibilitychange',arm);
}
let queued=false;
function measure(){
 queued=false;const vh=innerHeight;extras(vh);
 for(const it of linked){
  const r=it.n.getBoundingClientRect();if(r.bottom<-200||r.top>vh+200)continue;
  let p=it.draw?(vh*.82-r.top)/(vh*.5):(vh-r.top)/(vh*.7);
  p=Math.max(0,Math.min(1,p));p=Math.round(p*1000)/1000;
  if(p!==it.last){it.last=p;it.n.style.setProperty('--p',p);if(it.steps){let on=0;for(const st of it.steps){const k=p>=st.at;st.el.classList.toggle('is-on',k);if(k)on++;}const cur=it.n.dataset.step;if(cur!==String(on))it.n.dataset.step=on;it.steps.forEach((st,i)=>st.el.classList.toggle('is-now',i===on-1));}}
 }
}
const band=document.querySelector('[data-lx-band]');let bandX=null;
const wordsEl=document.querySelector('[data-lx-words]');let words=null,wordsRaw='';
/* the about line is split into words only while the page is in English, so a translated page keeps whole sentences */
function splitWords(){if(!wordsEl||words||calm)return;if(/translated-/.test(root.className)||(root.lang&&!/^en/i.test(root.lang)))return;wordsRaw=wordsEl.textContent;wordsEl.textContent='';words=wordsRaw.trim().split(/\s+/).map((w,i,all)=>{const sp=document.createElement('span');sp.className='lx-w';sp.textContent=w;sp.style.setProperty('--o','0');wordsEl.append(sp);if(i<all.length-1)wordsEl.append(' ');return sp;});}
function joinWords(){if(!words)return;wordsEl.textContent=wordsRaw;words=null;}
if(wordsEl){splitWords();new MutationObserver(()=>{if(/translated-/.test(root.className))joinWords();}).observe(root,{attributes:true,attributeFilter:['class','lang']});}
let deckSee=null,deckEl=null;
/* depth: chosen blocks drift a little faster or slower than the page, so layers separate as you scroll (wide screens with a mouse only) */
const deep=(!calm&&matchMedia('(min-width:900px) and (hover:hover)').matches)?[...document.querySelectorAll('[data-lx-depth]')].map(n=>({n,k:parseFloat(n.dataset.lxDepth)||0,last:null})):[];
function extras(vh){
 for(const d of deep){const r=d.n.getBoundingClientRect();if(r.bottom<-150||r.top>vh+150)continue;const y=Math.round(((r.top+r.height/2-(d.last||0))-vh/2)*d.k);if(y!==d.last){d.n.style.setProperty('--dy',y);d.last=y;}}
 if(deckSee){const r=deckEl.getBoundingClientRect();deckSee(r.bottom>vh*.2&&r.top<vh*.8,r.top<vh+700&&r.bottom>-700);}
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
 /* a fresh order on every visit, so a different walkthrough leads each time */
 const order=cards.map((_,i)=>i);for(let i=order.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
 let at=0,visible=false,timer=0,xpAsked=false,prev=-1;
 /* each recording starts from a different moment on every visit */
 const loadVid=v=>{if(v.dataset.ready)return;v.dataset.ready='1';v.addEventListener('loadedmetadata',()=>{const d=v.duration;if(isFinite(d)&&d>4){try{v.currentTime=Math.random()*(d-3);}catch{}}},{once:true});for(const [k,t] of [['webm','video/webm'],['mp4','video/mp4']]){if(!v.dataset[k])continue;const so=document.createElement('source');so.src=v.dataset[k];so.type=t;v.append(so);}v.load();};
 /* the walkthrough players are only fetched when the deck is close to the screen */
 const loadXp=()=>{if(xpAsked)return;xpAsked=true;for(const f of stage.querySelectorAll('[data-lx-explainer]')){f.setAttribute('data-random-start','');f.setAttribute('data-explainer',f.dataset.lxExplainer);}import('./tool-explainer.js?v=xp10').then(()=>setTimeout(media,60)).catch(()=>{});};
 function media(){const cur=order[at];cards.forEach((c,i)=>{const on=i===cur&&visible&&!calm;const v=c.querySelector('video');if(v){if(on){loadVid(v);const pr=v.play();if(pr)pr.catch(()=>{});}else v.pause();}const pl=c.querySelector('.lx-xp')?.__player;if(pl){pl.visible=on;pl.sync?.();}});}
 function place(){const cur=order[at];order.forEach((ci,k)=>{const c=cards[ci],d=(k-at+n)%n;if(ci===prev&&d!==0){c.dataset.pos='out';c.style.setProperty('--d',0);setTimeout(()=>{if(c.dataset.pos==='out'){c.dataset.pos='far';}},1000);}else if(d<=2){c.dataset.pos=String(d);c.style.setProperty('--d',d);}else c.dataset.pos='far';c.setAttribute('aria-hidden',String(d!==0));});
  chips.forEach(ch=>{const on=+ch.dataset.lxGo===cur;ch.classList.remove('is-on','is-timed');if(on){void ch.offsetWidth;ch.classList.add('is-on');if(visible&&!calm)ch.classList.add('is-timed');ch.style.setProperty('--dur',DUR+'ms');}ch.setAttribute('aria-pressed',String(on));});}
 function tell(){const c=cards[order[at]];if(!now)return;now.classList.add('swap');setTimeout(()=>{field('cat').textContent=c.dataset.cat;field('name').textContent=c.dataset.name;field('desc').textContent=c.dataset.desc;field('link').setAttribute('href',c.dataset.href);now.classList.remove('swap');},260);}
 const arm=()=>{clearTimeout(timer);if(visible&&!calm&&n>1)timer=setTimeout(()=>go((at+1)%n),DUR);};
 function go(k){if(k===at)return;prev=order[at];at=k;place();tell();media();arm();}
 chips.forEach(ch=>ch.addEventListener('click',()=>go(order.indexOf(+ch.dataset.lxGo))));
 cards.forEach((c,i)=>c.addEventListener('click',()=>{if(c.dataset.pos!=='0')go(order.indexOf(i));}));
 place();
 /* the side text starts on whichever tool leads this visit */
 if(now){const c=cards[order[0]];field('cat').textContent=c.dataset.cat;field('name').textContent=c.dataset.name;field('desc').textContent=c.dataset.desc;field('link').setAttribute('href',c.dataset.href);}
 if('IntersectionObserver' in window){
  /* several notices can arrive together (a tab opened in the background): the newest one is the truth */
  new IntersectionObserver(es=>{if(es.some(e=>e.isIntersecting))loadXp();},{rootMargin:'700px 0px'}).observe(stage);
  new IntersectionObserver(es=>{visible=es[es.length-1].isIntersecting;place();media();arm();setTimeout(media,350);},{threshold:[0,.2]}).observe(stage);
 }else{visible=true;loadXp();media();arm();}
 document.addEventListener('visibilitychange',()=>{if(document.hidden){clearTimeout(timer);cards.forEach(c=>c.querySelector('video')?.pause());}else{media();arm();}});
 /* the scroll itself also reports where the deck is, so it starts even if the browser's own notice is late or missing */
 deckEl=stage;deckSee=(vis,near)=>{if(near)loadXp();if(vis!==visible){visible=vis;place();media();arm();setTimeout(media,350);}};
 setTimeout(measure,1200);setInterval(()=>{if(!document.hidden)measure();},2000);
}
const y=document.getElementById('year');if(y)y.textContent=new Date().getFullYear();
})();
