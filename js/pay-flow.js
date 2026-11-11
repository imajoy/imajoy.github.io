/* Payment is two short steps: "payment" (order summary + billing details) and "pay" (only the payment methods).
   Both pages run the same payment code; this file only adds the small bridge between them. */
const body=document.body,view=body.dataset.payView,params=new URLSearchParams(location.search);
const returning=/^[-a-f0-9]{36}$/i.test(params.get('checkout')||'');
const form=document.querySelector('#billing-form');
const el=(tag,cls,html)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(html!=null)e.innerHTML=html;return e;};
const ARROW='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
/* Coming back from PayPal or Razorpay the result is shown on the payment methods themselves, so keep them visible there. */
if(view==='review'&&returning)body.classList.remove('pay-review');
if(view==='review'&&!returning&&form){
 const next=el('a','btn btn-blue btn-block pay-next','<span>Continue to payment</span>'+ARROW);
 next.href='pay.html';next.dataset.payNext='';
 const note=el('p','pay-next-note','Next: choose Cards, UPI, net banking or PayPal.');
 const wrap=el('div','pay-next-wrap');wrap.append(next,note);form.append(wrap);
}
if(view==='options'){
 const wrap=document.querySelector('main .wrap');
 if(wrap){const back=el('a','pay-back','<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"/></svg><span>Order summary</span>');back.href='payment.html';wrap.prepend(back);}
 if(form){
  const total=el('div','pay-total','<span>Total today</span><strong>—</strong>');
  const out=total.querySelector('strong'),src=document.querySelector('#summary-total');
  const sync=()=>{const t=(src?.textContent||'').trim();out.textContent=t||'—';};
  if(src)new MutationObserver(sync).observe(src,{childList:true,characterData:true,subtree:true});
  sync();form.prepend(total);
 }
}
