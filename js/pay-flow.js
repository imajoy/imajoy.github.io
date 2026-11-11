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
  let deal=null,seq=0,timer=0;
  const F=form.elements,keyNow=()=>[F.plan.value,F.billing.value,F.seats.value,F.country.value].join('|');
  const rowHide=()=>{const r=document.getElementById('coupon-summary-row');if(r)r.hidden=true;};
  const say=(t,k)=>{msg.textContent=t;msg.dataset.kind=k||'';};
  const show=()=>{const c=read();if(c){input.value=c;input.readOnly=true;apply.hidden=true;rm.hidden=false;if(deal&&deal.code===c&&deal.key===keyNow()){const d=deal.p.discount;say(c+' applied: '+d.percent+'% off '+(d.payments>1?'your first '+d.payments+' payments':'your first payment')+'.','ok');}else if(!msg.dataset.kind||msg.dataset.kind==='error')say('Checking '+c+'…','');}else{input.readOnly=false;apply.hidden=false;rm.hidden=true;}};
  const paintDeal=async()=>{
   if(!deal||deal.key!==keyNow()){rowHide();if(read()&&(!deal||deal.key!==keyNow())){clearTimeout(timer);timer=setTimeout(()=>check(read(),true),350);}return;}
   const {setMoney}=await import('./currency-display.js?v=20261020-local1'),p=deal.p,d=p.discount,country=F.country.value;
   const row=document.getElementById('coupon-summary-row');if(row)row.hidden=false;
   setMoney(document.getElementById('summary-coupon'),-(p.unitAmount-d.unitAmount)*p.seats*d.payments,p.currency,country);
   setMoney(document.getElementById('summary-total'),p.total,p.currency,country);
   show();
  };
  async function check(code,quiet){
   const mine=++seq,url=window.AJOY_CONFIG?.razorpayUrl;
   const {getAccountSession,openAccount}=await import('./account-session.js?v=20261023-p7');const session=getAccountSession();
   if(!session){if(!quiet){say('Sign in or register first, then apply your coupon.','error');openAccount({purpose:'checkout'});}else say(code+' is saved. Sign in and we apply it to your price.','ok');return;}
   if(!url){say(code+' is saved. We check it with your price on the next page.','ok');return;}
   apply.disabled=true;if(!quiet||!msg.textContent)say('Checking '+code+'…','');
   try{
    const key=keyNow(),res=await fetch(url+'/quote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({plan:F.plan.value,billing:F.billing.value,seats:Number(F.seats.value),country:F.country.value,offer:'standard',coupon:code,accountToken:session.token}),signal:AbortSignal.timeout(30000)});
    const data=await res.json().catch(()=>null);if(mine!==seq)return;
    if(!res.ok||!data?.ok||!data.pricing?.discount?.coupon){if(mine!==seq)return;write('');deal=null;rowHide();input.readOnly=false;apply.hidden=false;rm.hidden=true;say(data?.message||'This coupon cannot be applied to this order.','error');document.dispatchEvent(new CustomEvent('ajoy:quote-rendered'));return;}
    write(code);deal={code,p:data.pricing,key};show();await paintDeal();
   }catch{if(mine===seq)say(code+' is saved. We check it again on the next page.','ok');}
   finally{if(mine===seq)apply.disabled=false;}
  }
  const go=()=>{const code=input.value.trim().toUpperCase();input.value=code;if(!OK.test(code)){say('Enter a valid coupon code (letters, numbers or hyphens).','error');input.focus();return;}check(code,false);};
  apply.addEventListener('click',go);
  input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();go();}});
  rm.addEventListener('click',()=>{seq++;write('');deal=null;input.value='';say('','');rowHide();show();form.elements.seats.dispatchEvent(new Event('change',{bubbles:true}));});
  document.addEventListener('ajoy:quote-rendered',()=>{paintDeal();});
  const pending=read();if(pending){show();check(pending,true);}
  if(!pending)show();
 }
 document.addEventListener('ajoy:checkout-draft',e=>{const c=read();if(c)e.detail.coupon=c;else delete e.detail.coupon;});
}
/* Payment page: only show the coupon result (applied or not) under the total. */
document.addEventListener('ajoy:payment-complete',()=>{try{sessionStorage.removeItem('ajoy.coupon-pending');}catch{}});
