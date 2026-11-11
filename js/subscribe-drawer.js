/* Plan drawer: pressing Subscribe slides a panel in from the right where the buyer picks the license, the billing period and the number of licenses.
   On the billing page the same panel is opened with "Change" and updates the order in place. Prices come from the same quote service as the pricing section. */
import {getQuote,previewPrice,money,apiBase} from './commerce.js?v=20261020-prices1';
import {localFormatter} from './fx.js?v=20261020-local1';
import {cachedGeo} from './geo.js?v=20261019-geo1';
import {getAccountSession} from './account-session.js';
import {animatePrice} from './price-motion.js';
import {YEARLY_PERCENT} from './regions.js?v=20261023-p7';
const reduce=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const onCheckout=!!document.querySelector('#billing-form');
const PLANS={online:{name:'Basic',line:'All 10 Pro tools, always the newest version',foot:'Needs internet each time Maya starts'},offline:{name:'Premium',line:'All 14 tools, runs without internet',foot:'You decide when to update'}};
const swap=(n,txt)=>{if(n.textContent===txt)return;n.textContent=txt;if(reduce()||!n.animate||!dlg?.open)return;n.animate([{opacity:0,transform:'translateY(6px)'},{opacity:1,transform:'none'}],{duration:380,easing:'cubic-bezier(.22,1,.36,1)'});};
const el=(tag,cls,html)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(html!=null)e.innerHTML=html;return e;};
const X='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
const cache=new Map();let dlg=null,state={plan:'online',billing:'monthly',seats:1},mode='new',rev=0,fmt=null,expanded=false;
const CHK='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',CHEV='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
function owned(plan){
 if(document.querySelector('[data-buy="'+plan+'"].is-covered'))return true;
 try{const subs=getAccountSession()?.subscriptions;return Array.isArray(subs)&&subs.some(x=>x&&x.plan===plan&&!x.trial&&x.status!=='UNKNOWN'&&x.endsAt&&new Date(x.endsAt).getTime()>Date.now());}catch{return false;}
}
async function quoteFor(plan,billing){
 const k=plan+'|'+billing;if(cache.has(k))return cache.get(k);
 const p=(async()=>{try{return apiBase?await getQuote(plan,billing):previewPrice(plan,billing);}catch{try{return previewPrice(plan,billing);}catch{return null;}}})();
 cache.set(k,p);const q=await p;if(!q)cache.delete(k);return q;
}
async function formatter(q){if(q?.currency==='USD'){if(fmt===null)fmt=await localFormatter(cachedGeo()).catch(()=>false);if(fmt)return c=>fmt(c);}return c=>money(c,q.currency);}
function build(){
 dlg=el('dialog','sd');dlg.setAttribute('aria-labelledby','sd-title');
 dlg.innerHTML='<div class="sd-panel"><header class="sd-head"><h2 id="sd-title">Choose your plan</h2><button type="button" class="sd-x" aria-label="Close">'+X+'</button></header>'+
 '<div class="sd-body">'+
 '<section class="sd-sec" aria-labelledby="sd-h1"><h3 id="sd-h1">License</h3><div class="sd-opts" role="radiogroup" aria-labelledby="sd-h1">'+
 ['online','offline'].map(p=>'<div class="sd-wrap" data-wrap="'+p+'"><div class="sd-cell"><label class="sd-opt" data-opt="'+p+'"><input type="radio" name="sd-plan" value="'+p+'"><span class="sd-ring">'+CHK+'</span><span class="sd-opt-t"><b>'+PLANS[p].name+'</b><small>'+PLANS[p].line+'</small></span><span class="sd-opt-p" data-p="'+p+'">—</span></label></div></div>').join('')+'</div><button type="button" class="sd-swap" aria-expanded="false"><span></span>'+CHEV+'</button></section>'+
 '<section class="sd-sec" aria-labelledby="sd-h2"><h3 id="sd-h2">Billing period</h3><div class="sd-seg" role="radiogroup" aria-labelledby="sd-h2">'+
 '<label><input type="radio" name="sd-bill" value="monthly"><span>Monthly</span></label><label><input type="radio" name="sd-bill" value="yearly"><span>Yearly <em data-save></em></span></label></div><p class="sd-note" data-bnote></p></section>'+
 '<section class="sd-sec" aria-labelledby="sd-h3"><h3 id="sd-h3">Number of licenses</h3><div class="sd-qty"><button type="button" data-q="-1" aria-label="Remove one license">−</button><input type="number" inputmode="numeric" min="1" max="100" step="1" value="1" aria-labelledby="sd-h3"><button type="button" data-q="1" aria-label="Add one license">+</button></div><p class="sd-note">One license covers one computer. Choose 1–100.</p></section>'+
 '</div><footer class="sd-foot"><div class="sd-sum"><strong data-total>—</strong><small data-sub>Subtotal</small></div><button type="button" class="sd-go"><span>Continue to checkout</span></button></footer></div>';
 document.body.append(dlg);
 const qty=dlg.querySelector('.sd-qty input');
 const clampQty=()=>{const n=Math.round(Number(qty.value));return Number.isFinite(n)?Math.min(100,Math.max(1,n)):1;};
 dlg.addEventListener('change',e=>{
  if(e.target.name==='sd-plan'){state.plan=e.target.value;expanded=false;}if(e.target.name==='sd-bill')state.billing=e.target.value;
  if(e.target===qty){state.seats=clampQty();qty.value=String(state.seats);}paint();
 });
 qty.addEventListener('input',()=>{const n=Math.round(Number(qty.value));if(qty.value!==''&&Number.isFinite(n)){state.seats=Math.min(100,Math.max(1,n));paint(true);}});
 for(const b of dlg.querySelectorAll('[data-q]'))b.addEventListener('click',()=>{state.seats=Math.min(100,Math.max(1,state.seats+Number(b.dataset.q)));qty.value=String(state.seats);paint();});
 dlg.querySelector('.sd-swap').addEventListener('click',()=>{expanded=!expanded;paint(true);});
 dlg.querySelector('.sd-x').addEventListener('click',close);
 dlg.addEventListener('cancel',e=>{e.preventDefault();close();});
 dlg.addEventListener('click',e=>{if(e.target===dlg)close();});
 dlg.querySelector('.sd-go').addEventListener('click',go);
 /* swipe right to close (phones) */
 let sx=0,sy=0,dx=0,live=false;const panel=dlg.querySelector('.sd-panel');
 panel.addEventListener('touchstart',e=>{if(e.touches.length!==1)return;sx=e.touches[0].clientX;sy=e.touches[0].clientY;dx=0;live=true;},{passive:true});
 panel.addEventListener('touchmove',e=>{if(!live)return;const mx=e.touches[0].clientX-sx,my=e.touches[0].clientY-sy;if(Math.abs(my)>Math.abs(mx)*.8&&dx<8){live=false;panel.style.transform='';return;}dx=Math.max(0,mx);if(dx>8)panel.style.transform='translateX('+dx+'px)';},{passive:true});
 panel.addEventListener('touchend',()=>{if(!live)return;live=false;if(dx>90){panel.style.transform='';close();}else{panel.style.transition='transform .3s cubic-bezier(.22,1,.36,1)';panel.style.transform='';setTimeout(()=>{panel.style.transition='';},320);}});
}
async function paint(quiet){
 const my=++rev,{plan,billing,seats}=state;
 for(const r of dlg.querySelectorAll('input[name=sd-plan]'))r.checked=r.value===plan;
 const other=plan==='online'?'offline':'online';
 for(const p of ['online','offline']){
  const own=owned(p),w=dlg.querySelector('[data-wrap="'+p+'"]'),o=w.querySelector('.sd-opt'),hide=p!==plan&&!expanded;
  w.toggleAttribute('data-hide',hide);w.inert=hide;o.toggleAttribute('data-owned',own);o.querySelector('input').disabled=own;
  const t=o.querySelector('.sd-opt-t'),tag=t.querySelector('.sd-tag');
  if(own&&!tag)t.append(el('span','sd-tag','Your current plan'));else if(!own&&tag)tag.remove();
 }
 const sw=dlg.querySelector('.sd-swap');sw.setAttribute('aria-expanded',String(expanded));sw.hidden=false;
 sw.firstElementChild.textContent=expanded?'Show only '+PLANS[plan].name:'Compare with '+PLANS[other].name;
 for(const r of dlg.querySelectorAll('input[name=sd-bill]'))r.checked=r.value===billing;
 dlg.querySelector('.sd-qty [data-q="-1"]').disabled=seats<=1;dlg.querySelector('.sd-qty [data-q="1"]').disabled=seats>=100;
 const per=billing==='yearly'?'year':'month';
 const qs=await Promise.all([['online','offline'].map(p=>quoteFor(p,billing)),quoteFor(plan,'yearly'),quoteFor(plan,'monthly')].flat());
 if(my!==rev)return;
 const [qo,qf,qy,qm]=qs;
 for(const [p,q] of [['online',qo],['offline',qf]]){
  const n=dlg.querySelector('[data-p="'+p+'"]');if(!q){n.textContent='—';continue;}
  const f=await formatter(q);if(my!==rev)return;const t=f(q.unitAmount)+'|'+per;if(n.dataset.k===t)continue;const fresh=n.dataset.k!==undefined;n.dataset.k=t;n.replaceChildren(el('b',null,f(q.unitAmount)),el('small',null,'per license / '+per));if(fresh&&!reduce()&&dlg.open)n.animate([{opacity:0,transform:'translateY(6px)'},{opacity:1,transform:'none'}],{duration:380,easing:'cubic-bezier(.22,1,.36,1)'});
 }
 const cur=plan==='online'?qo:qf;
 if(cur){
  const f=await formatter(cur);if(my!==rev)return;
  animatePrice(dlg.querySelector('[data-total]'),cur.unitAmount*seats,f,dlg.open);
  swap(dlg.querySelector('[data-sub]'),'Subtotal · '+seats+(seats===1?' license':' licenses')+' · billed '+(billing==='yearly'?'yearly':'monthly'));
 }else{dlg.querySelector('[data-total]').textContent='—';dlg.querySelector('[data-sub]').textContent='Price confirmed at checkout';}
 const pct=YEARLY_PERCENT?.[plan];
 dlg.querySelector('[data-save]').textContent=pct?'Save '+pct+'%':'';
 swap(dlg.querySelector('[data-bnote]'),billing==='yearly'?'Billed once a year. The first-year saving applies to your first yearly subscription of this license.':'Billed every month. Cancel renewal any time.');
 dlg.querySelector('.sd-go span').textContent=mode==='edit'?'Update order':'Continue to checkout';
}
function go(){
 const {plan,billing,seats}=state;
 if(mode==='edit'){
  const f=document.querySelector('#billing-form');
  if(f){
   const set=(name,val,ev)=>{const c=f.elements[name];if(!c||c.value===String(val))return;c.value=String(val);c.dispatchEvent(new Event(ev,{bubbles:true}));};
   set('plan',plan,'change');set('billing',billing,'change');set('seats',seats,'change');
   try{const u=new URL(location.href);u.searchParams.set('plan',plan);u.searchParams.set('billing',billing);u.searchParams.set('seats',String(seats));history.replaceState(null,'',u);}catch{}
   document.dispatchEvent(new CustomEvent('ajoy:plan-changed',{detail:{plan,billing,seats}}));
  }
  close();return;
 }
 location.assign('checkout.html?'+new URLSearchParams({plan,billing,seats:String(seats),v:'20261112-drawer1'}));
}
export function openPlanDrawer(opts={}){
 if(!dlg)build();
 state={plan:opts.plan==='offline'?'offline':'online',billing:opts.billing==='yearly'?'yearly':'monthly',seats:Math.min(100,Math.max(1,Math.round(Number(opts.seats))||1))};
 mode=opts.mode==='edit'?'edit':'new';expanded=false;
 if(owned(state.plan)&&!owned(state.plan==='online'?'offline':'online'))state.plan=state.plan==='online'?'offline':'online';
 dlg.querySelector('.sd-qty input').value=String(state.seats);
 dlg.querySelector('#sd-title').textContent=mode==='edit'?'Change your plan':'Choose your plan';
 dlg.removeAttribute('data-closing');
 if(!dlg.open)dlg.showModal();
 paint();
 const panel=dlg.querySelector('.sd-panel');
 if(!reduce())panel.animate([{transform:'translateX(100%)'},{transform:'none'}],{duration:480,easing:'cubic-bezier(.22,1,.36,1)'});
 requestAnimationFrame(()=>dlg.querySelector('input[name=sd-plan]:checked')?.focus({preventScroll:true}));
}
function close(){
 if(!dlg||!dlg.open)return;
 const panel=dlg.querySelector('.sd-panel');dlg.setAttribute('data-closing','');
 const done=()=>{dlg.removeAttribute('data-closing');if(dlg.open)dlg.close();};
 if(reduce())return done();
 panel.animate([{transform:'none'},{transform:'translateX(100%)'}],{duration:300,easing:'cubic-bezier(.4,0,.2,1)'}).finished.then(done,done);
}
/* Subscribe buttons (and renewal links) open the drawer instead of going straight to the billing page. */
if(!onCheckout){
 document.addEventListener('click',e=>{
  if(e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
  const a=e.target.closest?.('a[href*="checkout.html?"]');if(!a||a.classList.contains('is-owned')||a.closest('dialog'))return;
  let u;try{u=new URL(a.href,location.href);}catch{return;}
  if(!/checkout(\.html)?$/.test(u.pathname)||!u.searchParams.has('plan'))return;
  e.preventDefault();openPlanDrawer({plan:u.searchParams.get('plan'),billing:u.searchParams.get('billing'),seats:u.searchParams.get('seats')});
 });
}
/* Billing page: a small "Change" link in the order summary reopens the drawer. */
if(onCheckout&&document.documentElement.dataset.checkoutStep!=='payment'){
 const add=()=>{
  const h=document.querySelector('.order-summary h2');if(!h||document.querySelector('.sd-change'))return !!h;
  const b=el('button','sd-change','Change');b.type='button';b.addEventListener('click',()=>{const f=document.querySelector('#billing-form').elements;openPlanDrawer({mode:'edit',plan:f.plan.value,billing:f.billing.value,seats:f.seats.value});});
  h.after(b);return true;
 };
 add();
}
