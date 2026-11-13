/* Draws the grey loading outline of every page from the page's real layout.
   For each page it opens the real page at desktop, tablet and phone size, records where the headings, text lines, cards, buttons and images sit
   in the first screen, and writes js/ph/<page>.js. skeleton.js shows that outline after the logo.
   Run:  node scripts/build-outlines.mjs [page-name ...]   (needs Playwright; run it again after a big layout change) */
import {createRequire} from 'node:module';import http from 'node:http';import fs from 'node:fs';import path from 'node:path';
const require=createRequire(import.meta.url);const {chromium}=require('playwright');
const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const only=process.argv.slice(2);
const tools=fs.readdirSync(root).filter(f=>/^tool-.*\.html$/.test(f)).map(f=>f.replace(/\.html$/,''));
const PAGES=[
 ['index','index.html'],['contact','contact.html'],['download','download.html'],['support','support.html'],['license','license.html'],['privacy','privacy.html'],['404','404.html'],
 ['wrapline','wrapline.html'],['wrapline-free','wrapline-free.html'],['account','account.html'],['checkout','checkout.html?plan=online&billing=monthly'],
 ['payment','payment.html?plan=online&billing=monthly'],['thank-you','thank-you.html?plan=online&billing=monthly&seats=1&provider=razorpay'],
 ...tools.map(t=>[t,t+'.html'])
].filter(([n])=>!only.length||only.includes(n));
const SIZES=[['a',1440,900],['b',1024,768],['c',390,844]];
const mime={'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.woff2':'font/woff2','.json':'application/json'};
const srv=http.createServer((q,r)=>{let f=path.join(root,decodeURIComponent(q.url.split('?')[0]));if(!fs.existsSync(f)&&fs.existsSync(f+'.html'))f+='.html';if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.statusCode=404;return r.end('');}r.setHeader('content-type',mime[path.extname(f)]||'application/octet-stream');r.end(fs.readFileSync(f));});
await new Promise(r=>srv.listen(8172,r));
const J=o=>({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(o)});
const SUBS=[{plan:'online',billing:'yearly',status:'ACTIVE',endsAt:new Date(Date.now()+300*864e5).toISOString(),renews:false,ref:'sub_x',provider:'razorpay',seats:3}];
const collect=()=>{
 const vw=innerWidth,vh=innerHeight,out=[];
 const num=v=>parseFloat(v)||0;
 const alpha=c=>{const m=c.match(/rgba?\(([^)]+)\)/);if(!m)return c==='transparent'?0:1;const p=m[1].split(/[ ,/]+/).filter(Boolean);return p.length>3?num(p[3]):1;};
 const ok=el=>{try{return el.checkVisibility({opacityProperty:true,visibilityProperty:true});}catch{return true;}};
 const skipArea='script,style,noscript,#pg-skel,#pg-ph,#lx-ph,#lx-intro,#lx-scene,.lx-scene,.pg-ring,dialog:not([open]),[hidden],.cl-dlg,[class*="toast"],[class*="cookie"],[class*="coffee"],.sr-only,[class*="visually-hidden"]';
 const isPill=el=>el.matches('button,input:not([type=checkbox]):not([type=radio]):not([type=hidden]),select,textarea')||(el.tagName==='A'&&(alpha(getComputedStyle(el).backgroundColor)>.15||(num(getComputedStyle(el).borderTopWidth)>0&&alpha(getComputedStyle(el).borderTopColor)>.15)));
 const R=r=>({x:r.left,y:r.top,w:r.width,h:r.height});
 const rgb=c=>{const m=c.match(/rgba?\(([^)]+)\)/);if(!m)return null;const p=m[1].split(/[ ,/]+/).filter(Boolean).map(parseFloat);return {r:p[0],g:p[1],b:p[2],a:p.length>3?p[3]:1};};
 const lum=c=>{const f=v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4);};return .2126*f(c.r)+.7152*f(c.g)+.0722*f(c.b);};
 /* can the text be read at all? colour against the first solid background behind it */
 const readable=el=>{const tc=rgb(getComputedStyle(el).color);if(!tc||tc.a<.15)return false;let bg=null;for(let n=el;n;n=n.parentElement){const c=rgb(getComputedStyle(n).backgroundColor);if(c&&c.a>.5){bg=c;break;}}if(!bg)return true;const a=lum(tc)+.05,b=lum(bg)+.05;return Math.max(a,b)/Math.min(a,b)>=1.35;};
 let seq=0;const zOf=el=>{let z=0;for(let n=el;n&&n!==document.body;n=n.parentElement){const c=getComputedStyle(n);if(c.position!=='static'&&c.zIndex!=='auto')z=Math.max(z,+c.zIndex||0);}return z;};
 /* a piece also remembers where it sits in the page, so it is drawn above or below its neighbours exactly like the real page */
 const push=(a,el)=>{a.seq=seq;a.z=zOf(el);out.push(a);};
 const inView=r=>r.w>=4&&r.h>=4&&r.y<vh-2&&r.x<vw-2&&r.x+r.w>2&&r.y+r.h>2;
 const radius=(cs,h,w)=>Math.min(Math.max(num(cs.borderTopLeftRadius),num(cs.borderTopRightRadius)),h/2,w/2);
 for(const el of document.body.querySelectorAll('*')){
  seq++;
  if(el.closest(skipArea)||!ok(el))continue;
  const cs=getComputedStyle(el),r=R(el.getBoundingClientRect());
  const clipText=(cs.webkitBackgroundClip||cs.backgroundClip)==='text';
  if(el.tagName==='SVG'||el.tagName==='svg'){if(inView(r)&&r.w>=36&&r.h>=36&&!el.closest('button,a,.pillbar,[class*=btn]'))push(['m',r.x,r.y,r.w,r.h,Math.min(14,r.h/2)],el);continue;}
  if(el.closest('svg'))continue;
  if(/^(IMG|VIDEO|CANVAS|IFRAME|PICTURE)$/.test(el.tagName)){if(inView(r)&&r.w>=24&&r.h>=24)push(['m',r.x,r.y,r.w,r.h,radius(cs,r.h,r.w)||10],el);continue;}
  if(!inView(r))continue;
  if(el.tagName==='FIGURE'&&r.w>=120&&r.h>=100&&!(r.w>=vw*.97)){push(['m',r.x,r.y,r.w,r.h,radius(cs,r.h,r.w)||16],el);continue;}
  if(isPill(el)){if(r.w>=28&&r.h>=18&&!(el.tagName==='INPUT'&&el.type==='file'))push(['p',r.x,r.y,r.w,r.h,Math.max(radius(cs,r.h,r.w),el.matches('input,select,textarea')?10:0)||8],el);continue;}
  /* a panel: a visible fill, border or shadow around other things */
  const bg=alpha(cs.backgroundColor),bimg=cs.backgroundImage!=='none'&&!clipText,bord=num(cs.borderTopWidth)>0&&alpha(cs.borderTopColor)>.12,shad=cs.boxShadow!=='none';
  if((bg>.5||bimg||bord||shad)&&r.w>=72&&r.h>=34&&!(r.w>=vw*.97&&r.h>=vh*.45)&&el.children.length+el.childNodes.length>0&&!el.matches('body,html,main,section,article')){
   const rr=radius(cs,r.h,r.w),edge=r.w>=vw*.97,soft=edge?rr:Math.max(rr,Math.min(12,r.h/2));
   if(bimg&&!el.children.length)push(['m',r.x,r.y,r.w,r.h,soft],el);
   else if(bg>.5||bord||shad)push(['c',r.x,r.y,r.w,r.h,soft],el);
  }
  /* text: one bar per line */
  if(el.closest('button,select,textarea,label:has(input[type=checkbox]),label:has(input[type=radio]),[class*=btn]'))continue;
  if(!clipText&&!readable(el))continue;
  const own=[...el.childNodes].filter(n=>n.nodeType===3&&n.nodeValue.trim());
  if(!own.length)continue;
  const fs=num(cs.fontSize),rg=document.createRange(),lines=[];
  for(const n of own){rg.selectNodeContents(n);for(const q of rg.getClientRects()){if(q.width<4||q.height<4)continue;const L=lines.find(l=>Math.abs(l.cy-(q.top+q.height/2))<fs*.4&&q.left<=l.x+l.w+fs*1.2&&q.left+q.width>=l.x-fs*1.2);if(L){const nx=Math.min(L.x,q.left),ex=Math.max(L.x+L.w,q.left+q.width);L.x=nx;L.w=ex-nx;}else lines.push({x:q.left,w:q.width,cy:q.top+q.height/2});}}
  const bh=Math.max(6,Math.min(fs*.62,34));
  /* a line is only drawn where it is really visible: inside the screen and inside any clipping box around it (a scrolling strip of text, a carousel) */
  let cl=0,cr=vw;for(let n=el.parentElement;n&&n!==document.body;n=n.parentElement){const o=getComputedStyle(n);if(/hidden|clip|auto|scroll/.test(o.overflowX)){const q=n.getBoundingClientRect();cl=Math.max(cl,q.left);cr=Math.min(cr,q.right);}}
  for(const l of lines){const x1=Math.max(l.x,cl),x2=Math.min(l.x+l.w,cr),t=l.cy-bh/2;if(!(t<vh-2&&t+bh>2&&x1<vw-2&&x2-x1>=8))continue;
   /* text that sits behind a picture, video, canvas or solid panel is not seen on the real page, so it gets no bar */
   const top=document.elementFromPoint(Math.min(vw-1,Math.max(1,(x1+x2)/2)),Math.min(vh-1,Math.max(1,t+bh/2)));
   if(top&&top!==el&&!el.contains(top)&&!top.contains(el)){const covers=n=>n.closest('img,video,canvas,iframe,picture,svg')||alpha(getComputedStyle(n).backgroundColor)>.8||getComputedStyle(n).backgroundImage!=='none';let c=false;for(let n=top;n&&n!==document.body;n=n.parentElement){if(n.contains(el))break;if(covers(n)){c=true;break;}}if(c)continue;}
   push(['t',x1,t,x2-x1,bh,bh/2],el);}
 }
 /* join neighbouring pieces of one line (a word in italics next to plain text) */
 const texts=out.filter(o=>o[0]==='t').sort((a,b)=>a[2]-b[2]||a[1]-b[1]);const merged=[];const cp=(t)=>{const c=t.slice();c.seq=t.seq;c.z=t.z;return c;};
 for(const t of texts){const m=merged.find(q=>Math.abs((q[2]+q[4]/2)-(t[2]+t[4]/2))<4&&t[1]-(q[1]+q[3])<14&&t[1]>=q[1]-2);if(m){m[3]=Math.max(m[3],t[1]+t[3]-m[1]);m[4]=Math.max(m[4],t[4]);m.seq=Math.min(m.seq,t.seq);}else merged.push(cp(t));}
 const rest=out.filter(o=>o[0]!=='t');
 /* the same box found twice, or a box that is only a thin rule */
 const keep=[];for(const o of rest){if(o[0]==='c'&&(o[4]<34))continue;if(keep.some(k=>k[0]===o[0]&&Math.abs(k[1]-o[1])<3&&Math.abs(k[2]-o[2])<3&&Math.abs(k[3]-o[3])<6&&Math.abs(k[4]-o[4])<6))continue;keep.push(o);}
 /* drawn in the same stacking order as the real page: higher z-index on top, then later in the page on top */
 const all=[...keep,...merged].sort((a,b)=>(a.z||0)-(b.z||0)||a.seq-b.seq);
 return all.map(o=>[o[0],...o.slice(1).map(v=>Math.round(v*10)/10)]);
};
const html=(items,vw,mode)=>items.map(([k,x,y,w,h,r])=>{
 const left=mode==='a'?(d=>`calc(50% ${d<0?'-':'+'} ${Math.abs(d)}px)`)(Math.round(x-vw/2)):(Math.round(x/vw*10000)/100)+'%',width=mode==='a'?Math.round(w)+'px':(Math.round(w/vw*10000)/100)+'%';
 return `<i class="${k==='c'?'c':'b'}" style="left:${left};top:${Math.round(y)}px;width:${width};height:${Math.round(h)}px;border-radius:${Math.round(r)}px"></i>`;}).join('');
const browser=await chromium.launch();
fs.mkdirSync(path.join(root,'js/ph'),{recursive:true});
for(const [name,url] of PAGES){
 const groups=[];
 for(const [mode,w,h] of SIZES){
  const ctx=await browser.newContext({viewport:{width:w,height:h},locale:'en-IN',isMobile:mode==='c',hasTouch:mode==='c',deviceScaleFactor:1});
  await ctx.addInitScript(()=>{try{localStorage.setItem('ajoy-theme-pin','light');if(!sessionStorage.getItem('seeded')){sessionStorage.setItem('seeded','1');localStorage.setItem('ajoy.acct',JSON.stringify({token:'t'.repeat(40),email:'a@b.co',expiresAt:Date.now()+9e9,subscriptions:[]}));sessionStorage.setItem('ajoy.billing-draft',JSON.stringify({at:Date.now(),email:'a@b.co',plan:'online',billing:'monthly',seats:1,country:'IN',terms:true,provider:'razorpay',name:'Ajoy Pal',address:'12 Park Street',postal:'700016',city:'Kolkata',region:'WB'}));}}catch{}});
  const p=await ctx.newPage();
  await p.route(u=>/supabase\.co|script\.google|script\.googleusercontent|country\.is|geojs|er-api|zippopotam|postalpincode|razorpay\.com|paypal\.com|paypalobjects\.com|googleapis|gstatic|google\.com/.test(u.hostname),async r=>{const u=r.request().url();
   if(/razorpay\/config/.test(u))return r.fulfill(J({ok:true,enabled:true,mode:'live',keyId:'rzp_live_x',countries:['IN'],closedCountries:[]}));
   if(/quote/.test(u))return r.fulfill(J({ok:true,pricing:{unitAmount:189991,total:189991,seats:1,billing:'monthly',currency:'INR',recurringTotal:189991}}));
   if(/country\.is/.test(u))return r.fulfill(J({country:'IN'}));
   if(name==='account'&&/exec|functions/.test(u))return r.fulfill(J({ok:true,email:'a@b.co',subscriptions:SUBS}));
   if(/fonts|gstatic|googleapis\.com\/css/.test(u))return r.fulfill({status:200,contentType:'text/css',body:''});
   return r.fulfill(J({ok:false}));});
  await p.goto('http://localhost:8172/'+url,{waitUntil:'load'}).catch(()=>{});
  await p.waitForFunction(()=>document.documentElement.classList.contains('pg-ready')||(!document.getElementById('pg-skel')&&!document.getElementById('lx-intro')),null,{timeout:16000}).catch(()=>{});
  await p.waitForTimeout(2600);
  await p.evaluate(()=>{document.querySelectorAll('#pg-skel,#pg-ph,#lx-ph,#lx-intro,#lx-scene,.lx-scene,.pg-ring').forEach(e=>e.remove());scrollTo(0,0);});
  await p.waitForTimeout(400);
  const items=await p.evaluate(collect);
  groups.push(`<div class="ph-v ph-${mode}">${html(items,w,mode)}</div>`);
  console.log(name,mode,items.length,'blocks');
  await ctx.close();
 }
 fs.writeFileSync(path.join(root,'js/ph',name+'.js'),'window.__phLoad&&window.__phLoad('+JSON.stringify(name)+','+JSON.stringify(groups.join(''))+');\n');
}
await browser.close();srv.close();
