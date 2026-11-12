/* Button motion for the whole site. Every button gets a motion that fits what it does, so the same kind of button moves the same way everywhere:
     go   (opens something)      the label rolls upward and the arrow shoots through
     get  (download / install)   the label rolls downward, the icon drops, a progress line runs along the bottom
     pay  (plans, subscribe)     a band of light crosses the button and the label rolls slowly
     send (contact, support)     the label slides sideways and the arrow flies off like a sent message
     key  (login, register)      the label flips over like a card
   Pressing any of them spreads ink from the point touched. Helpers are laid over the button and never take part in its layout,
   so a button can no longer stretch or jump. On touch screens the motion plays once on tap. Reduced motion turns it all off. */
(()=>{
const calm=matchMedia('(prefers-reduced-motion: reduce)');
const EASE='cubic-bezier(.22,1,.36,1)';
const BTN='.btn,.lx-btn,.acct-btn,.sd-go,.sd-pbtn,[data-continue-payment],.rzp-pay,.m-total button,.offer-action,[data-review-billing],.o-ae-go,.pay-next,.qp-go,.bc-save,button.primary';
const GOLD='.sd-go,.sd-pbtn,[data-continue-payment],.rzp-pay,.m-total button,.sum-coupon .btn,.offer-action,[data-review-billing],.btn-gold,.lx-btn-gold';
/* these already have their own designed animation: they only get the ink */
const OWN='[data-continue-payment],.rzp-pay,.sd-go,.sd-pbtn,.m-total button,[data-bm-off]';
const pick=t=>{const b=t?.closest?.(BTN);return b&&!b.disabled&&b.getAttribute('aria-disabled')!=='true'?b:null;};
function kindOf(b){
 const t=(b.textContent||'').trim().toLowerCase(),h=(b.getAttribute('href')||'').toLowerCase();
 if(b.hasAttribute('download')||/download|install|get wrapline|get the/.test(t)||/download|wrapline-free/.test(h))return 'get';
 if(/\b(send|message|contact|say hello|email|reply)\b/.test(t))return 'send';
 if(b.matches('.btn-gold,.lx-btn-gold,.offer-action')||/\b(pay|subscribe|buy|premium|upgrade|trial|checkout|basic|pricing|plans?)\b/.test(t))return 'pay';
 if(/\b(send|message|contact|hello|support|email|reply)\b/.test(t)||/contact|support|mailto:/.test(h))return 'send';
 if(/log ?in|sign ?in|sign ?up|register|account/.test(t))return 'key';
 return 'go';
}
function roll(node,b){
 const text=node.textContent;if(!text||text.trim().length<2||text.length>44||/\n\s*\S/.test(text.trim()))return;
 let host;
 if(node.nodeType===3){host=document.createElement('span');const tail=/\s$/.test(text),lead=/^\s/.test(text);node.replaceWith(host);if(lead)host.before(' ');if(tail)host.after(' ');}else{host=node;host.textContent='';}
 host.classList.add('bm-t');host.dataset.t=text.trim();
 const l=document.createElement('span');l.className='bm-l';l.textContent=node.nodeType===3?text.trim():text;host.append(l);
}
function dress(b){
 if(b.dataset.bm)return;
 if(b.matches(OWN)){b.dataset.bm='own';return;}
 b.dataset.bm=kindOf(b);
 if(getComputedStyle(b).position==='static')b.classList.add('bm-rel');
 if(b.querySelector('.bm-t,input,select,textarea,img'))return;
 for(const n of [...b.childNodes]){
  if(n.nodeType===3&&n.textContent.trim().length>1){roll(n,b);break;}
  if(n.nodeType===1&&n.tagName==='SPAN'&&!n.className&&!n.children.length&&!n.hasAttribute('aria-hidden')&&n.textContent.trim().length>1){roll(n,b);break;}
 }
 if(b.dataset.bm==='pay'||b.dataset.bm==='get'){const fx=document.createElement('i');fx.className='bm-fx';fx.setAttribute('aria-hidden','true');b.append(fx);}
}
const dressAll=r=>{for(const b of (r||document).querySelectorAll(BTN))dress(b);};
/* the rolling copy always shows the label as it reads now (after a language change or a script update) */
const sync=b=>{const t=b.querySelector('.bm-t');if(t){const l=t.querySelector('.bm-l');if(l)t.dataset.t=l.textContent.trim();else{t.classList.remove('bm-t');}}};
function ink(b,x,y){
 if(!b.animate)return;
 const r=b.getBoundingClientRect();if(!r.width||!r.height)return;
 let box=b.querySelector(':scope>.bm-box');
 if(!box){box=document.createElement('i');box.className='bm-box';box.setAttribute('aria-hidden','true');if(getComputedStyle(b).position==='static')b.classList.add('bm-rel');b.append(box);}
 const size=Math.hypot(Math.max(x-r.left,r.right-x),Math.max(y-r.top,r.bottom-y))*2;
 const i=document.createElement('i');i.className='bm-ink'+(b.matches(GOLD)?' bm-gold':'');
 i.style.cssText='left:'+(x-r.left)+'px;top:'+(y-r.top)+'px;width:'+size+'px;height:'+size+'px';
 box.append(i);
 const end=()=>{i.remove();if(!box.childElementCount)box.remove();};
 i.animate([{transform:'translate(-50%,-50%) scale(0)',opacity:.9},{transform:'translate(-50%,-50%) scale(1)',opacity:0}],{duration:820,easing:EASE}).finished.then(end,end);
}
/* touch screens have no hover: the button's motion plays once when it is tapped */
const run=b=>{if(!b.dataset.bm||b.dataset.bm==='own')return;b.classList.remove('bm-run');void b.offsetWidth;b.classList.add('bm-run');clearTimeout(b._bm);b._bm=setTimeout(()=>b.classList.remove('bm-run'),900);};
addEventListener('pointerdown',e=>{if(calm.matches||e.button>0)return;const b=pick(e.target);if(!b)return;dress(b);ink(b,e.clientX,e.clientY);if(e.pointerType!=='mouse'){sync(b);run(b);}},{passive:true});
addEventListener('pointerover',e=>{const b=pick(e.target);if(b&&!b.contains(e.relatedTarget)){dress(b);sync(b);}},{passive:true});
addEventListener('keydown',e=>{if(calm.matches||e.repeat||(e.key!=='Enter'&&e.key!==' '))return;const b=pick(e.target);if(!b)return;const r=b.getBoundingClientRect();ink(b,r.left+r.width/2,r.top+r.height/2);run(b);});
const start=()=>{dressAll();let q=0;new MutationObserver(()=>{if(q)return;q=setTimeout(()=>{q=0;dressAll();},300);}).observe(document.body,{childList:true,subtree:true});};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
