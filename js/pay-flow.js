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
/* Order summary: a coupon box under the total. It drives the page's own coupon controls, so prices, checks and messages stay exactly the same. */
if(view==='review'&&!returning&&form){
 const side=document.querySelector('.order-summary'),total=side?.querySelector('.order-total'),orig={input:document.querySelector('#coupon-code'),apply:document.querySelector('#coupon-apply'),status:document.querySelector('#coupon-status'),remove:document.querySelector('#coupon-remove')};
 if(total&&orig.input&&orig.apply&&orig.status&&orig.remove){
  const box=el('div','sum-coupon','<p class="sum-coupon-t">Have a coupon code?</p><div class="sum-coupon-row"><input type="text" maxlength="32" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="Coupon code"><button type="button" class="btn btn-light">Apply</button></div><p class="sum-coupon-msg" role="status" aria-live="polite"></p><button type="button" class="text-link sum-coupon-remove" hidden>Remove coupon</button>');
  const input=box.querySelector('input'),apply=box.querySelector('.btn'),msg=box.querySelector('.sum-coupon-msg'),rm=box.querySelector('.sum-coupon-remove');
  total.after(box);
  const sync=()=>{
   const applied=!orig.remove.hidden,flag=orig.status.dataset.error,text=(orig.status.textContent||'').trim();
   const show=applied||flag==='true'||(flag==='false'&&!!text&&!/^(Sign in, then|Enter your code and choose Apply)/.test(text));
   msg.textContent=show?text:'';msg.dataset.kind=flag==='true'?'error':applied?'ok':'';
   rm.hidden=!applied;apply.hidden=applied;
   if(applied&&orig.input.value){input.value=orig.input.value;input.readOnly=true;}else input.readOnly=false;
  };
  const go=()=>{const code=input.value.trim().toUpperCase();input.value=code;orig.input.value=code;orig.input.dispatchEvent(new Event('input',{bubbles:true}));orig.apply.click();};
  apply.addEventListener('click',go);
  input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();go();}});
  rm.addEventListener('click',()=>{orig.remove.click();input.value='';});
  const watch=new MutationObserver(sync);watch.observe(orig.status,{childList:true,characterData:true,subtree:true,attributes:true});watch.observe(orig.remove,{attributes:true,attributeFilter:['hidden']});
  sync();
 }
}
/* Going on to the payment methods: remember the coupon with the saved checkout details so the next page prices it the same way. */
document.querySelector('[data-pay-next]')?.addEventListener('click',()=>{
 try{
  const draft=JSON.parse(sessionStorage.getItem('ajoy.billing-draft')||'null'),applied=document.querySelector('#coupon-remove'),code=String(document.querySelector('#coupon-code')?.value||'').trim().toUpperCase();
  if(!draft)return;
  if(applied&&!applied.hidden&&/^[A-Z0-9][A-Z0-9-]{2,31}$/.test(code))draft.coupon=code;else delete draft.coupon;
  sessionStorage.setItem('ajoy.billing-draft',JSON.stringify(draft));
 }catch{}
});
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
