/* One press feel for every button on the site: ink spreads from the exact point touched, then the button springs back.
   Keyboard presses spread from the centre. Nothing here follows the pointer around, and reduced-motion turns it off. */
(()=>{
const calm=matchMedia('(prefers-reduced-motion: reduce)');
const EASE='cubic-bezier(.22,1,.36,1)';
const BTN='.btn,.lx-btn,.acct-btn,.sd-go,.sd-pbtn,[data-continue-payment],.rzp-pay,.m-total button,.offer-action,[data-review-billing],.o-ae-go,.pay-next,.qp-go,.bc-save,button.primary';
const GOLD='.sd-go,.sd-pbtn,[data-continue-payment],.rzp-pay,.m-total button,.sum-coupon .btn,.offer-action,[data-review-billing],.btn-gold,.lx-btn-gold';
const pick=t=>{const b=t?.closest?.(BTN);return b&&!b.disabled&&b.getAttribute('aria-disabled')!=='true'?b:null;};
function ink(b,x,y){
 if(!b.animate)return;
 const r=b.getBoundingClientRect();if(!r.width||!r.height)return;
 const size=Math.hypot(Math.max(x-r.left,r.right-x),Math.max(y-r.top,r.bottom-y))*2;
 const i=document.createElement('i');i.className='bm-ink'+(b.matches(GOLD)?' bm-gold':'');i.setAttribute('aria-hidden','true');
 i.style.cssText='left:'+(x-r.left)+'px;top:'+(y-r.top)+'px;width:'+size+'px;height:'+size+'px';
 const fixed=getComputedStyle(b).position==='static';
 b.classList.add('bm-host');if(fixed)b.classList.add('bm-rel');b.append(i);
 const end=()=>{i.remove();if(!b.querySelector('.bm-ink'))b.classList.remove('bm-host','bm-rel');};
 i.animate([{transform:'translate(-50%,-50%) scale(0)',opacity:.9},{transform:'translate(-50%,-50%) scale(1)',opacity:0}],{duration:760,easing:EASE}).finished.then(end,end);
}
const spring=b=>b.animate?.([{transform:'scale(.962)'},{transform:'scale(1.02)',offset:.5},{transform:'scale(.996)',offset:.78},{transform:'scale(1)'}],{duration:620,easing:EASE});
addEventListener('pointerdown',e=>{if(calm.matches||e.button>0)return;const b=pick(e.target);if(b)ink(b,e.clientX,e.clientY);},{passive:true});
addEventListener('pointerup',e=>{if(calm.matches)return;const b=pick(e.target);if(b)spring(b);},{passive:true});
addEventListener('keydown',e=>{if(calm.matches||e.repeat||(e.key!=='Enter'&&e.key!==' '))return;const b=pick(e.target);if(!b)return;const r=b.getBoundingClientRect();ink(b,r.left+r.width/2,r.top+r.height/2);spring(b);});
})();
