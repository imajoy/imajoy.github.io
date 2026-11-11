/* Checkout motion: gold-ink press on the main buttons, a staggered rise for each block once the loader lifts, and a soft tick when a price changes. */
(()=>{
const calm=matchMedia('(prefers-reduced-motion: reduce)');
const EASE='cubic-bezier(.22,1,.36,1)';
/* 1. Gold ink: a ring of ink spreads from the exact point pressed, then the button springs back. */
const INK='.sd-go,.sd-pbtn,[data-continue-payment],.rzp-pay,.m-total button,.sum-coupon .btn,.offer-action,[data-review-billing]';
addEventListener('pointerdown',e=>{
 if(calm.matches||e.button>0)return;const b=e.target.closest?.(INK);if(!b||b.disabled)return;
 const r=b.getBoundingClientRect(),size=Math.hypot(Math.max(e.clientX-r.left,r.right-e.clientX),Math.max(e.clientY-r.top,r.bottom-e.clientY))*2;
 const ink=document.createElement('i');ink.className='mf-ink';ink.setAttribute('aria-hidden','true');
 ink.style.cssText='left:'+(e.clientX-r.left)+'px;top:'+(e.clientY-r.top)+'px;width:'+size+'px;height:'+size+'px';
 b.classList.add('mf-host');b.append(ink);
 ink.animate([{transform:'translate(-50%,-50%) scale(0)',opacity:.85},{transform:'translate(-50%,-50%) scale(1)',opacity:0}],{duration:720,easing:EASE}).finished.then(()=>ink.remove(),()=>ink.remove());
},{passive:true});
addEventListener('pointerup',e=>{
 if(calm.matches)return;const b=e.target.closest?.(INK);if(!b||b.disabled)return;
 b.animate([{transform:'scale(.965)'},{transform:'scale(1.018)',offset:.55},{transform:'scale(1)'}],{duration:520,easing:EASE});
},{passive:true});
/* 2. Blocks rise in one after another when the loader lifts; anything further down rises as it scrolls into view. */
const main=document.querySelector('.commerce-main');
if(main&&!calm.matches&&'IntersectionObserver' in window){
 const pick=()=>[...main.querySelectorAll(':scope h1,.checkout-progress,.order-summary,.checkout-form>fieldset,.checkout-form>section,.checkout-form>.payment-picker,.checkout-form>label,.checkout-form>.offer-checkout,.loyalty-panel,.offer-checkout')].filter(n=>!n.classList.contains('mf')&&!n.closest('.mf'));
 let live=false,batch=0,t0=0;
 const io=new IntersectionObserver(es=>{for(const x of es){if(!x.isIntersecting)continue;io.unobserve(x.target);const now=performance.now();if(now-t0>260)batch=0;t0=now;x.target.style.setProperty('--mf-d',(batch++*80)+'ms');x.target.classList.add('mf-in');setTimeout(()=>x.target.classList.remove('mf','mf-in'),1600+batch*80);}},{rootMargin:'0px 0px -6% 0px'});
 const arm=()=>{for(const n of pick()){n.classList.add('mf');if(live)io.observe(n);}};
 const go=()=>{if(live)return;live=true;arm();for(const n of main.querySelectorAll('.mf'))io.observe(n);};
 arm();
 const sk=document.getElementById('pg-skel');
 if(!sk)requestAnimationFrame(go);else{new MutationObserver((_,m)=>{if(sk.classList.contains('done')||!sk.isConnected){m.disconnect();go();}}).observe(sk,{attributes:true,attributeFilter:['class']});setTimeout(go,11000);}
}
/* 3. A changed amount ticks into place instead of swapping. */
if(!calm.matches){
 const watch=id=>{const n=document.getElementById(id);if(!n)return;let last=n.textContent;new MutationObserver(()=>{const t=n.textContent;if(t===last||t==='—'||last==='—'){last=t;return;}last=t;n.animate([{opacity:.25,transform:'translateY(8px)',filter:'blur(3px)'},{opacity:1,transform:'none',filter:'blur(0)'}],{duration:520,easing:EASE});}).observe(n,{childList:true,characterData:true,subtree:true});};
 for(const id of ['summary-total','summary-unit','summary-subtotal','summary-coupon'])watch(id);
}
})();
