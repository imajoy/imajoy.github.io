/* Drafts are tab-local form convenience, never proof of identity, country or price. */
import {getAccountSession,onAccountChange,openAccount} from './account-session.js?v=20261020-ps1';
const key='ajoy.billing-draft',lifetime=30*60*1000;
export const paymentStep=document.documentElement.dataset.checkoutStep==='payment';
const fields={name:80,company:160,address:400,city:100,region:100,postal:24,taxId:40};
export function readBillingDraft(){
 try{
  const draft=JSON.parse(sessionStorage.getItem(key)||'null'),session=getAccountSession();
  if(!draft||!session||draft.email!==session.email||!Number.isFinite(draft.at)||draft.at>Date.now()+60000||Date.now()-draft.at>lifetime){sessionStorage.removeItem(key);return null;}
  if(!['online','offline'].includes(draft.plan)||!['monthly','yearly'].includes(draft.billing)||!Number.isInteger(draft.seats)||draft.seats<1||draft.seats>100)return null;
  const clean={at:draft.at,email:session.email,plan:draft.plan,billing:draft.billing,seats:draft.seats,country:/^[A-Z]{2}$/.test(draft.country||'')?draft.country:'',terms:draft.terms===true,offer:['trial','standard'].includes(draft.offer)?draft.offer:'',coupon:/^[A-Z0-9][A-Z0-9-]{2,31}$/.test(draft.coupon||'')?draft.coupon:'',provider:['paypal','razorpay'].includes(draft.provider)?draft.provider:''};
  for(const [name,max] of Object.entries(fields))clean[name]=typeof draft[name]==='string'?draft[name].slice(0,max):'';
  return clean;
 }catch{return null;}
}
export function clearBillingDraft(){try{sessionStorage.removeItem(key);}catch{}}
function writeBillingDraft(form){
 const session=getAccountSession();if(!session)throw Error('Sign in before continuing.');
 const value={at:Date.now(),email:session.email,plan:form.elements.plan.value,billing:form.elements.billing.value,seats:Number(form.elements.seats.value),country:form.elements.country.value,terms:form.elements.terms.checked,provider:document.documentElement.dataset.paymentProvider};
 for(const [name,max] of Object.entries(fields))value[name]=form.elements[name].value.slice(0,max);
 document.dispatchEvent(new CustomEvent('ajoy:checkout-draft',{detail:value}));sessionStorage.setItem(key,JSON.stringify(value));
}
export function initializeCheckoutSteps(form){
 const params=new URLSearchParams(location.search),draft=readBillingDraft(),returning=/^[-a-f0-9]{36}$/i.test(params.get('checkout')||'');
 if(!paymentStep&&returning){location.replace('payment.html?'+new URLSearchParams({checkout:params.get('checkout')}).toString());return;}
 if(paymentStep&&!returning&&(!draft||!draft.name.trim()||!draft.address.trim()||!draft.city.trim()||!draft.terms)){
  document.documentElement.dataset.checkoutReady='false';location.replace('checkout.html');return;
 }
 if(draft){
  for(const name of Object.keys(fields))form.elements[name].value=draft[name];
  for(const name of ['plan','billing'])if(!params.has(name))form.elements[name].value=draft[name];
  form.elements.seats.value=String(draft.seats);form.elements.terms.checked=draft.terms;
 }
 let restoredCountry=false;
 document.addEventListener('ajoy:billing-network',event=>{
  if(event.detail.blocked)return;
  if(draft&&!restoredCountry){restoredCountry=true;
   // Only the server-verified testing role can restore a chosen country.
   if(event.detail.canEdit&&draft.country){form.elements.country.value=draft.country;form.elements.country.dispatchEvent(new Event('change',{bubbles:true}));}
  }
  const label=document.querySelector('[data-payment-country]');if(label)label.textContent='Billing country: '+(form.elements.country.selectedOptions[0]?.textContent||'');
 });
 if(paymentStep){
  const review=document.createElement('section');review.className='payment-billing-summary';
  const heading=document.createElement('h2');heading.textContent='Your billing details';review.append(heading);
  const text=document.createElement('p');text.textContent=draft?[draft.name,draft.email,draft.address,[draft.city,draft.region,draft.postal].filter(Boolean).join(', ')].filter(Boolean).join(' · '):'Confirming your existing subscription…';review.append(text);
  const countryLabel=document.createElement('p');countryLabel.dataset.paymentCountry='';review.append(countryLabel);
  const edit=document.createElement('a');edit.className='text-link';edit.href='checkout.html';edit.textContent='Edit billing details';review.append(edit);form.prepend(review);
  for(const link of document.querySelectorAll('a[href="checkout.html"]'))link.addEventListener('click',()=>{try{writeBillingDraft(form);}catch{}});
 }else{
  const next=document.createElement('section');next.className='checkout-continue';
  next.innerHTML='<button type="button" class="btn btn-blue btn-block" data-continue-payment>Continue to payment <span aria-hidden="true">→</span></button><p class="form-hint">Choose from the payment methods available for your country on the next page.</p><p class="form-status" data-payment-step-status role="status" aria-live="polite"></p>';
  form.append(next);
  function continueToPayment(){
   const notice=next.querySelector('[data-payment-step-status]'),session=getAccountSession();notice.textContent='';
   if(document.documentElement.dataset.billingBlocked==='true'){notice.textContent='Confirm your billing country before continuing.';return;}
   if(!session){openAccount({purpose:'checkout'});return;}
   if(!form.reportValidity())return;
   try{writeBillingDraft(form);}catch{notice.textContent='Allow storage for this tab so your billing details can continue securely.';return;}
   location.assign('payment.html');
  }
  next.querySelector('button').onclick=continueToPayment;
  form.addEventListener('submit',event=>{event.preventDefault();event.stopImmediatePropagation();continueToPayment();},true);
 }
 let accountEmail=getAccountSession()?.email;
 onAccountChange(()=>{const next=getAccountSession()?.email;if(next===accountEmail)return;accountEmail=next;clearBillingDraft();if(paymentStep)location.replace('checkout.html');});
 document.addEventListener('ajoy:payment-complete',clearBillingDraft);
}
