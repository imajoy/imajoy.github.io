/* Drafts are tab-local form convenience, never proof of identity, country or price. */
import {getAccountSession,onAccountChange,openAccount} from './account-session.js?v=20261023-p7';
const key='ajoy.billing-draft',lifetime=30*60*1000;
export const paymentStep=document.documentElement.dataset.checkoutStep==='payment';
const fields={name:80,company:160,address:400,city:100,region:100,postal:24};
/* What the customer typed in each box (the fields above hold what is billed: the company's address when "studio or company" is on). */
const rawFields={rAddress:400,rCity:100,rRegion:100,rPostal:24,cName:160,cAddress:400,cPostal:24,cCity:100,cRegion:100};
export function readBillingDraft(){
 try{
  const draft=JSON.parse(sessionStorage.getItem(key)||'null'),session=getAccountSession();
  if(!draft||!session||draft.email!==session.email||!Number.isFinite(draft.at)||draft.at>Date.now()+60000||Date.now()-draft.at>lifetime){sessionStorage.removeItem(key);return null;}
  if(!['online','offline'].includes(draft.plan)||!['monthly','yearly'].includes(draft.billing)||!Number.isInteger(draft.seats)||draft.seats<1||draft.seats>100)return null;
  const clean={at:draft.at,email:session.email,plan:draft.plan,billing:draft.billing,seats:draft.seats,country:/^[A-Z]{2}$/.test(draft.country||'')?draft.country:'',terms:draft.terms===true,offer:['trial','standard'].includes(draft.offer)?draft.offer:'',rzpOffer:['trial','standard'].includes(draft.rzpOffer)?draft.rzpOffer:'',coupon:/^[A-Z0-9][A-Z0-9-]{2,31}$/.test(draft.coupon||'')?draft.coupon:'',provider:['paypal','razorpay'].includes(draft.provider)?draft.provider:''};
  for(const [name,max] of Object.entries(fields))clean[name]=typeof draft[name]==='string'?draft[name].slice(0,max):'';
  for(const [name,max] of Object.entries(rawFields))clean[name]=typeof draft[name]==='string'?draft[name].slice(0,max):undefined;
  clean.companyOn=draft.companyOn===true;clean.tester=draft.tester===true;
  return clean;
 }catch{return null;}
}
export function clearBillingDraft(){try{sessionStorage.removeItem(key);}catch{}}
function writeBillingDraft(form){
 const session=getAccountSession();if(!session)throw Error('Sign in before continuing.');
 const value={at:Date.now(),email:session.email,plan:form.elements.plan.value,billing:form.elements.billing.value,seats:Number(form.elements.seats.value),country:form.elements.country.value,terms:form.elements.terms.checked,provider:document.documentElement.dataset.paymentProvider,tester:document.documentElement.dataset.billingTester==='true'};
 const E=form.elements,previous=readBillingDraft(),val=(n,max)=>String(E[n]?.value||'').slice(0,max);
 for(const [name,max] of Object.entries(fields))value[name]=val(name,max);
 if(paymentStep&&previous){
  /* The payment page only shows the billed values; keep what was typed on the billing page so "Edit billing details" restores it. */
  for(const name of Object.keys(rawFields))if(previous[name]!==undefined)value[name]=previous[name];
  value.companyOn=previous.companyOn;
 }else{
  const on=E.companyOn?.checked===true;
  Object.assign(value,{rAddress:val('address',400),rCity:val('city',100),rRegion:val('region',100),rPostal:val('postal',24),cName:val('company',160),cAddress:val('companyAddress',400),cPostal:val('companyPostal',24),cCity:val('companyCity',100),cRegion:val('companyRegion',100),companyOn:on});
  if(on)Object.assign(value,{company:value.cName,address:value.cAddress,postal:value.cPostal,city:value.cCity,region:value.cRegion});
  else value.company='';
 }if(previous?.rzpOffer)value.rzpOffer=previous.rzpOffer;
 document.dispatchEvent(new CustomEvent('ajoy:checkout-draft',{detail:value}));sessionStorage.setItem(key,JSON.stringify(value));
}
export function initializeCheckoutSteps(form){
 const params=new URLSearchParams(location.search),draft=readBillingDraft(),returning=/^[-a-f0-9]{36}$/i.test(params.get('checkout')||'');
 if(!paymentStep&&returning){location.replace('payment.html?'+new URLSearchParams({checkout:params.get('checkout')}).toString());return;}
 if(paymentStep&&!returning&&(!draft||(!draft.tester&&(!draft.name.trim()||!draft.address.trim()))||!draft.terms)){
  document.documentElement.dataset.checkoutReady='false';location.replace('checkout.html');return;
 }
 if(draft){
  for(const name of Object.keys(fields))if(form.elements[name])form.elements[name].value=draft[name];
  if(!paymentStep){
   const E=form.elements,pick=(raw,eff)=>raw!==undefined?raw:eff;
   E.address.value=pick(draft.rAddress,draft.address);E.city.value=pick(draft.rCity,draft.city);E.region.value=pick(draft.rRegion,draft.region);E.postal.value=pick(draft.rPostal,draft.postal);
   E.company.value=pick(draft.cName,'');E.companyAddress.value=draft.cAddress||'';E.companyPostal.value=draft.cPostal||'';E.companyCity.value=draft.cCity||'';E.companyRegion.value=draft.cRegion||'';
   E.companyOn.checked=draft.companyOn;
  }
  for(const name of ['plan','billing'])if(!params.has(name))form.elements[name].value=draft[name];
  form.elements.seats.value=String(draft.seats);form.elements.terms.checked=draft.terms;
 }
 let restoredCountry=false;
 document.addEventListener('ajoy:billing-network',event=>{
  if(event.detail.blocked)return;
  if(draft&&!restoredCountry){restoredCountry=true;
   // Only the server-verified testing role can restore a chosen country.
   if(event.detail.canEdit&&draft.country){const sel=form.elements.country;if(![...sel.options].some(o=>o.value===draft.country)){try{sel.add(new Option(new Intl.DisplayNames([navigator.language||'en'],{type:'region'}).of(draft.country)||draft.country,draft.country));}catch{sel.add(new Option(draft.country,draft.country));}}sel.value=draft.country;form.elements.country.dispatchEvent(new Event('change',{bubbles:true}));}
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
  next.innerHTML='<button type="button" class="btn btn-blue btn-block" data-continue-payment>Continue to checkout <span aria-hidden="true">→</span></button><p class="form-hint">Choose from the payment methods available for your country on the next page.</p><p class="form-status" data-payment-step-status role="status" aria-live="polite"></p>';
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
