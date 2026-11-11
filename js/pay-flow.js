/* Payment page extras: a coupon box under the order total, and the secure-payment note under the pay button. */
const body=document.body,view=body.classList.contains('pay-single')?'single':'',params=new URLSearchParams(location.search);
const returning=/^[-a-f0-9]{36}$/i.test(params.get('checkout')||'');
const form=document.querySelector('#billing-form');
const el=(tag,cls,html)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(html!=null)e.innerHTML=html;return e;};
const ARROW='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
/* Coming back from PayPal or Razorpay the result is shown on the payment methods themselves, so keep them visible there. */
/* Order summary: a coupon box under the total. It drives the page's own coupon controls, so prices, checks and messages stay exactly the same. */
if(view==='single'&&!returning&&form){
 const side=document.querySelector('.order-summary'),total=side?.querySelector('.order-total'),orig={input:document.querySelector('#coupon-code'),apply:document.querySelector('#coupon-apply'),status:document.querySelector('#coupon-status'),remove:document.querySelector('#coupon-remove')};
 if(total&&orig.input&&orig.apply&&orig.status&&orig.remove){
  const box=el('div','sum-coupon','<p class="sum-coupon-t">Have a coupon code?</p><div class="sum-coupon-row"><input type="text" maxlength="32" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="Coupon code"><button type="button" class="btn btn-light">Apply</button></div><p class="sum-coupon-msg" role="status" aria-live="polite"></p><button type="button" class="text-link sum-coupon-remove" hidden>Remove coupon</button>');
  const input=box.querySelector('input'),apply=box.querySelector('.btn'),msg=box.querySelector('.sum-coupon-msg'),rm=box.querySelector('.sum-coupon-remove');
  total.after(box);
  const sync=()=>{
   const applied=!orig.remove.hidden,flag=orig.status.dataset.error,text=(orig.status.textContent||'').trim();
   const show=applied||flag==='true'||(flag==='false'&&!!text&&!/^(Sign in, then|Enter your code and choose Apply)/.test(text));
   const dflt=/^(Sign in, then|Enter your code and choose Apply)/.test(text);msg.textContent=show?(applied&&dflt?(orig.input.value||'Your code')+' is added to this order.':text):'';msg.dataset.kind=flag==='true'?'error':applied?'ok':'';
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
/* Under the pay button: a quiet secure-payment line and the agreement. The agreement checkbox was ticked on the billing page; it stays ticked in the form. */
if(view==='single'&&form){
 const LOCK='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8.5 10.5V7.8a3.5 3.5 0 0 1 7 0v2.7"/></svg>';
 const add=()=>{
  const btn=document.querySelector('.razorpay-panel [data-razorpay-start]');
  if(!btn||btn.parentElement.querySelector('.pay-secure'))return !!btn;
  const wrap=el('div','pay-note','<p class="pay-secure">'+LOCK+'<span>Encrypted and secure payments</span></p><p class="pay-agree">By paying you agree to the <a href="license.html" target="_blank" rel="noopener">license terms</a> and <a href="privacy.html" target="_blank" rel="noopener">privacy notice</a>, and understand this is a recurring subscription. You can cancel renewal at any time.</p>');
  btn.after(wrap);return true;
 };
 if(!add()){const mo=new MutationObserver(()=>{if(add())mo.disconnect();});mo.observe(form,{childList:true,subtree:true});}
}

/* Billing page: the coupon box lives under the order total. The code is kept with the billing details and checked on the payment page. */
if(document.documentElement.dataset.checkoutStep==='billing'&&form){
 const KEY='ajoy.coupon-pending',OK=/^[A-Z0-9][A-Z0-9-]{2,31}$/;
 const total=document.querySelector('.order-summary .order-total');
 const read=()=>{try{return sessionStorage.getItem(KEY)||'';}catch{return '';}};
 const write=v=>{try{if(v)sessionStorage.setItem(KEY,v);else sessionStorage.removeItem(KEY);}catch{}};
 try{const d=JSON.parse(sessionStorage.getItem('ajoy.billing-draft')||'null');if(d)write(OK.test(d.coupon||'')?d.coupon:'');}catch{}
 if(total){
  const box=el('div','sum-coupon','<p class="sum-coupon-t">Have a coupon code?</p><div class="sum-coupon-row"><input type="text" maxlength="32" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="Coupon code"><button type="button" class="btn btn-light">Apply</button></div><p class="sum-coupon-msg" role="status" aria-live="polite"></p><button type="button" class="text-link sum-coupon-remove" hidden>Remove coupon</button>');
  const input=box.querySelector('input'),apply=box.querySelector('.btn'),msg=box.querySelector('.sum-coupon-msg'),rm=box.querySelector('.sum-coupon-remove');
  total.after(box);
  const show=()=>{const c=read();if(c){input.value=c;input.readOnly=true;apply.hidden=true;rm.hidden=false;msg.textContent=c+' is saved. We check it with your price on the next page.';msg.dataset.kind='ok';}else{input.readOnly=false;apply.hidden=false;rm.hidden=true;}};
  const go=()=>{const code=input.value.trim().toUpperCase();input.value=code;if(!OK.test(code)){msg.textContent='Enter a valid coupon code (letters, numbers or hyphens).';msg.dataset.kind='error';input.focus();return;}write(code);show();};
  apply.addEventListener('click',go);
  input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();go();}});
  rm.addEventListener('click',()=>{write('');input.value='';msg.textContent='';msg.dataset.kind='';show();});
  show();
 }
 document.addEventListener('ajoy:checkout-draft',e=>{const c=read();if(c)e.detail.coupon=c;else delete e.detail.coupon;});
}
/* Payment page: only show the coupon result (applied or not) under the total. */
document.addEventListener('ajoy:payment-complete',()=>{try{sessionStorage.removeItem('ajoy.coupon-pending');}catch{}});
