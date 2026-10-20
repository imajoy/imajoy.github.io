import {readBillingDraft} from './checkout-steps.js?v=20261020-steps1';
/* Hosted payment selection: provider visibility is configuration, never payment authorization. */
import {availability,countryCheck,tierFor} from './regions.js?v=20261020-ps1';
import {getAccountSession,onAccountChange,openAccount} from './account-session.js?v=20261020-ps1';
import {loadRazorpayConfig,razorpayAvailable} from './razorpay-config.js?v=20261020-rz1';
const form=document.querySelector('#billing-form'),paypal=document.querySelector('[data-payment-provider="paypal"]'),url=window.AJOY_CONFIG?.razorpayUrl;
if(form&&paypal&&url){
 const picker=document.createElement('fieldset');picker.className='payment-picker';picker.hidden=true;
 picker.innerHTML='<legend>Choose a payment method</legend><label hidden><input type="radio" name="payment-provider" value="paypal" checked><span><b>PayPal</b><small>USD · subscriptions and eligible Online trials</small></span></label><label hidden><input type="radio" name="payment-provider" value="razorpay"><span><b>Razorpay</b><small>INR · payment methods available for your account</small></span></label>';
 const panel=document.createElement('section');panel.className='razorpay-panel';panel.hidden=true;
 const review=document.createElement('section');review.className='billing-review';
 review.innerHTML='<h3>Review your billing details</h3><p data-billing-availability>Checking payment availability…</p><button type="button" class="btn btn-light btn-block" data-review-billing>Review billing details</button><p class="billing-review-status" role="status" aria-live="polite"></p>';
 panel.innerHTML='<p class="razorpay-mode" hidden><b>Test mode.</b> No real money moves.</p><p class="razorpay-status" role="status" aria-live="polite"></p><p class="razorpay-terms">Paid recurring subscription in INR. The 20% yearly saving is included. The 2-day trial, coupons and returning-subscriber offers are currently available through PayPal only. Monthly plans authorize up to 100 charges; yearly plans up to 10, then billing stops.</p><p class="razorpay-amount"></p><button type="button" class="btn btn-blue btn-block" data-razorpay-start>Continue with Razorpay</button><button type="button" class="btn btn-light btn-block" data-razorpay-check hidden>Check payment status</button><a class="text-link" data-razorpay-open hidden target="_blank" rel="noopener">Open secure Razorpay checkout</a><button type="button" class="razorpay-cancel" data-razorpay-cancel hidden>Cancel this checkout</button>';
 paypal.before(picker);paypal.after(panel,review);
 const status=panel.querySelector('.razorpay-status'),start=panel.querySelector('[data-razorpay-start]'),check=panel.querySelector('[data-razorpay-check]'),link=panel.querySelector('[data-razorpay-open]'),cancelBtn=panel.querySelector('[data-razorpay-cancel]');
 let config=null,paypalConfig=null,provider='review',quote=null,pending=null,busy=false,revision=0,timer,creating=false;
 document.documentElement.dataset.paymentProvider='review';paypal.hidden=true;
 document.querySelector('#customer-verification').hidden=true;document.querySelector('.coupon-panel').hidden=true;
 const draft=readBillingDraft();let restoredProvider=false;
 let requestId=crypto.randomUUID();
 const choice=()=>({plan:form.elements.plan.value,billing:form.elements.billing.value,seats:Number(form.elements.seats.value),country:form.elements.country.value});
 const key=()=>JSON.stringify(choice());
 const money=value=>new Intl.NumberFormat(navigator.language||'en',{style:'currency',currency:'INR'}).format(value/100);
 const say=(text,kind='')=>{status.textContent=text;status.dataset.kind=kind;};
 let usingPopup=false,rzpScript=null;
 const thankYou=(r,plan,billing,seats)=>'thank-you.html?'+new URLSearchParams({provider:'razorpay',plan:r?.plan||plan,billing:r?.billing||billing,seats:String(r?.seats||seats)}).toString();
 const clearPending=()=>{pending=null;requestId=crypto.randomUUID();check.hidden=true;link.hidden=true;try{sessionStorage.removeItem('ajoy.razorpay.pending');}catch{}};
 function loadCheckout(){
  if(window.Razorpay)return Promise.resolve();
  if(!rzpScript)rzpScript=new Promise((resolve,reject)=>{const tag=document.createElement('script');tag.src='https://checkout.razorpay.com/v1/checkout.js';tag.onload=()=>window.Razorpay?resolve():reject(Error('Razorpay could not load.'));tag.onerror=()=>{rzpScript=null;reject(Error('Razorpay could not load. Check your connection and try again.'));};document.head.append(tag);});
  return rzpScript;
 }
 /* After Razorpay reports success, the server still verifies the captured payment before access is granted. */
 async function finishPaid(checkoutId,sel){
  busy=true;say('Payment received. Confirming it with Razorpay…');paint();
  for(let attempt=0;attempt<8;attempt++){
   try{const result=await api('confirm',{checkoutId});if(result.accepted){clearPending();say('Payment confirmed. Taking you to your confirmation page…','ok');location.href=thankYou(result,sel.plan,sel.billing,sel.seats);return;}}catch(error){if(attempt===7){busy=false;paint();say(error.message,'error');return;}}
   await new Promise(r=>setTimeout(r,4000));
  }
  busy=false;check.hidden=false;paint();
  say('Your payment was received, but confirmation is taking longer than usual. You will get a confirmation email shortly. You can also press "Check payment status".','warn');
 }
 /* Buyer closed the window or the payment failed: end the unpaid checkout so nothing is left waiting. */
 function abandon(checkoutId,reason){
  clearPending();busy=false;paint();
  say(reason?'Payment failed: '+reason+' No money was taken. You can try again.':'Payment cancelled. No money was taken. You can start again whenever you are ready.',reason?'error':'warn');
  api('cancel',{checkoutId}).catch(()=>{});
 }
 function selected(next){
  provider=next;document.documentElement.dataset.paymentProvider=provider;
  for(const radio of picker.querySelectorAll('input'))radio.checked=radio.value===provider;
  panel.hidden=provider!=='razorpay';paypal.hidden=provider!=='paypal';
  review.hidden=provider!=='review';
  const promos=document.querySelector('#customer-verification');if(promos)promos.hidden=provider!=='paypal';
  document.querySelector('.coupon-panel').hidden=provider!=='paypal';
  document.dispatchEvent(new CustomEvent('ajoy:provider-change',{detail:{provider}}));
  if(provider==='razorpay')refresh();
  else form.elements.billing.dispatchEvent(new Event('change',{bubbles:true}));
 }
 function sync(){
  if(document.documentElement.dataset.billingBlocked==='true'){picker.hidden=true;paypal.hidden=true;panel.hidden=true;review.hidden=true;return;}
  const c=choice(),country=c.country,canRazorpay=razorpayAvailable(config,country),canPaypal=!!paypalConfig?.clientId&&/^[A-Z]{2}$/.test(country)&&availability(country,paypalConfig.closedCountries||[]).open&&(document.documentElement.dataset.billingTester==='true'||countryCheck(country,paypalConfig.mode==='live'?paypalConfig.country:'').ok)&&!!paypalConfig.plans?.tiers?.[tierFor(country)]?.[c.plan]?.[c.billing];
  if(!restoredProvider&&(canRazorpay||canPaypal)){restoredProvider=true;if(draft?.provider==='razorpay'&&canRazorpay)selected('razorpay');}
  picker.hidden=!canRazorpay&&!canPaypal;picker.querySelector('[value="razorpay"]').parentElement.hidden=!canRazorpay;picker.querySelector('[value="paypal"]').parentElement.hidden=!canPaypal;
  if(!canRazorpay&&!canPaypal&&provider!=='review')selected('review');
  else if(canRazorpay&&!canPaypal&&provider!=='razorpay')selected('razorpay');
  else if(canPaypal&&(provider==='review'||provider==='razorpay'&&!canRazorpay))selected('paypal');
  if(provider==='review'){
   paypal.hidden=true;panel.hidden=true;review.hidden=false;
   document.querySelector('#customer-verification').hidden=true;document.querySelector('.coupon-panel').hidden=true;
   review.querySelector('[data-billing-availability]').textContent='You can review your plan and billing details. Payment options will appear when available for your country.';
   reviewSummary();
  }
  if(provider==='paypal')paypal.hidden=false;
  if(provider==='razorpay'){panel.hidden=false;panel.querySelector('.razorpay-mode').hidden=config.mode==='live';paint();}
 }
 function reviewSummary(){
  document.querySelector('#trial-line')?.setAttribute('hidden','');document.querySelector('.order-total')?.classList.remove('is-trial');
  for(const id of ['loyalty-summary-row','loyalty-summary','coupon-summary-row'])document.getElementById(id).hidden=true;
  document.querySelector('#availability').textContent='Review your plan and billing details. Payments are not available for this selection yet.';
  document.querySelector('#quote-note').textContent='Estimated plan price for billing review. No payment will be collected until an available payment method is shown and you approve it.';
 }
 function reviewDetails(){
  if(!form.reportValidity())return;
  review.querySelector('.billing-review-status').textContent='Your billing details are ready for review. They have not been submitted, and no subscription or charge has been created.';
 }
 review.querySelector('[data-review-billing]').onclick=reviewDetails;
 form.addEventListener('submit',event=>{if(provider==='review'){event.preventDefault();event.stopImmediatePropagation();reviewDetails();}},true);
 function paint(){
  if(provider!=='razorpay')return;
  document.querySelector('#trial-line')?.setAttribute('hidden','');document.querySelector('.order-total')?.classList.remove('is-trial');
  for(const id of ['loyalty-summary-row','loyalty-summary','coupon-summary-row'])document.getElementById(id).hidden=true;
  const session=getAccountSession(),ownsPending=pending?.email===session?.email;start.disabled=busy||!session||!quote||ownsPending;start.textContent=!session?'Register / Login to continue':creating?'Preparing Razorpay checkout…':ownsPending?'Check your existing checkout below':'Continue with Razorpay';
  if(!ownsPending){check.hidden=true;link.hidden=true;}
  cancelBtn.hidden=check.hidden||busy;
  if(!session)start.disabled=false;
  const amount=quote?money(quote.total):'—';document.getElementById('summary-total').textContent=amount;panel.querySelector('.razorpay-amount').textContent=quote?amount+' per '+(quote.billing==='yearly'?'year':'month')+' for '+quote.seats+' license(s)':'';
  if(!quote){for(const id of ['summary-unit','summary-subtotal'])document.getElementById(id).textContent='—';document.querySelector('#annual-summary-row').hidden=true;document.querySelector('#annual-summary').hidden=true;return;}
  document.querySelector('#summary-unit').textContent=money(quote.unitAmount);
  document.querySelector('#summary-subtotal').textContent=money(quote.compareAtUnitAmount*quote.seats);
  const savings=(quote.compareAtUnitAmount-quote.unitAmount)*quote.seats;
  document.querySelector('#annual-summary-row').hidden=quote.billing!=='yearly';document.querySelector('#summary-annual').textContent='−'+money(savings);
  const annual=document.querySelector('#annual-summary');annual.hidden=quote.billing!=='yearly';annual.textContent='20% off yearly · '+money(quote.unitAmount/12)+' per license/month, billed annually.';
  document.querySelector('#local-total')?.replaceChildren();
  document.querySelector('#quote-note').textContent='Charged in INR by Razorpay. Review the recurring amount and billing schedule before authorizing. No tax is added by this checkout.';
  document.querySelector('#availability').textContent='Review your billing details, then authorize securely with Razorpay.';
 }
 async function api(operation,body={}){
  const session=getAccountSession();if(!session){openAccount({purpose:'checkout'});throw Error('Sign in or register to continue.');}
  const response=await fetch(url+'/'+operation,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,accountToken:session.token}),signal:AbortSignal.timeout(60000)});
  let data;try{data=await response.json();}catch{throw Error('Razorpay could not respond. Please try again later.');}
  if(!response.ok||!data.ok){document.dispatchEvent(new CustomEvent('ajoy:billing-denied',{detail:{code:data.error}}));throw Error(data.message||'Razorpay checkout is temporarily unavailable.');}return data;
 }
 function refresh(){
  clearTimeout(timer);const operation=++revision;quote=null;requestId=crypto.randomUUID();paint();
  if(provider!=='razorpay'||!getAccountSession()||document.documentElement.dataset.billingBlocked==='true')return;
  const c=choice(),selection=key(),token=getAccountSession().token;
  if(!Number.isInteger(c.seats)||c.seats<1||c.seats>100)return;
  busy=true;say('Confirming your Razorpay price…');paint();
  timer=setTimeout(async()=>{try{const data=await api('quote',c);if(operation!==revision||key()!==selection||getAccountSession()?.token!==token)return;quote=data.pricing;say('Price confirmed. Review the total before continuing.');}catch(error){if(operation===revision)say(error.message);}finally{if(operation===revision){busy=false;paint();}}},180);
 }
 async function confirm(){
  if(!pending||busy||getAccountSession()?.email!==pending.email)return;
  busy=true;say('Verifying payment directly with Razorpay…');paint();check.disabled=true;
  try{const result=await api('confirm',{checkoutId:pending.id});
   if(result.accepted){say('Payment confirmed. Taking you to your confirmation page…','ok');setTimeout(()=>{location.href=thankYou(result,result.plan,result.billing,result.seats);},800);panel.dataset.paymentComplete='';document.dispatchEvent(new Event('ajoy:payment-complete'));check.hidden=true;link.hidden=true;start.hidden=true;try{sessionStorage.removeItem('ajoy.razorpay.pending');}catch{}pending=null;}
   else if(['cancelled','expired','completed'].includes(result.status)){clearPending();say('The unpaid checkout has ended. You can start a new subscription.','warn');}
   else say('Payment is not confirmed yet. If you closed the Razorpay window without paying, press "Cancel this checkout" or simply start again.','warn');
  }catch(error){say(error.message);}finally{busy=false;check.disabled=false;paint();}
 }
 start.onclick=async()=>{
  if(!getAccountSession()){openAccount({purpose:'checkout'});return;}
  if(!form.reportValidity()||!quote||busy)return;
  const selection=key(),price=quote,token=getAccountSession().token,sel=choice();
  usingPopup=!config?.keyId;
  const popup=usingPopup?window.open('about:blank','_blank'):null;if(popup){popup.opener=null;popup.document.body.textContent='Preparing secure Razorpay checkout…';}
  busy=true;creating=true;say('Opening secure Razorpay checkout…');paint();
  try{
   if(!usingPopup)await loadCheckout();
   const result=await api('checkout',{...sel,requestId,expectedTotal:price.total,name:form.elements.name.value,company:form.elements.company.value});
   if(getAccountSession()?.token!==token||key()!==selection){popup?.close();throw Error('Your account or selection changed. Review checkout before continuing.');}
   pending={id:result.checkoutId,email:getAccountSession().email};try{sessionStorage.setItem('ajoy.razorpay.pending',JSON.stringify(pending));}catch{}
   if(usingPopup){
    const destination=new URL(result.url);if(destination.protocol!=='https:'||!['rzp.io','rzp.co'].includes(destination.hostname))throw Error('Invalid Razorpay checkout destination.');
    link.href=destination.href;link.hidden=false;check.hidden=false;say('Complete payment in the secure Razorpay window, then check its status here.');
    if(popup)popup.location.replace(destination.href);else link.focus();
    return;
   }
   if(!/^sub_[A-Za-z0-9]+$/.test(result.subscriptionId||''))throw Error('Razorpay did not return a subscription.');
   let paid=false,failure='';
   const rzp=new window.Razorpay({key:config.keyId,subscription_id:result.subscriptionId,name:'Wrapline by Ajoy Tools',
    description:'Wrapline '+(sel.plan==='offline'?'Offline':'Online')+' · '+sel.billing+' · '+sel.seats+' license(s)',
    prefill:{email:getAccountSession().email,name:form.elements.name.value},theme:{color:'#2A64E8'},
    handler:()=>{paid=true;finishPaid(result.checkoutId,sel);},
    modal:{escape:true,confirm_close:true,ondismiss:()=>{if(!paid)abandon(result.checkoutId,failure);}}});
   rzp.on('payment.failed',event=>{failure=(event?.error?.description||'The bank declined the payment.').replace(/\.?$/,'.');say('Payment failed: '+failure+' Try another card or method in the Razorpay window, or close it to cancel.','error');});
   creating=false;busy=false;paint();say('Complete the payment in the Razorpay window. Closing it cancels this checkout.');
   rzp.open();
  }catch(error){popup?.close();if(pending&&!usingPopup)clearPending();say(error.message,'error');}finally{busy=false;creating=false;paint();}
 };
 check.onclick=confirm;
 cancelBtn.onclick=()=>{if(pending&&!busy)abandon(pending.id,'');};
 window.addEventListener('focus',()=>{if(provider==='razorpay'&&pending&&usingPopup)confirm();});
 for(const radio of picker.querySelectorAll('input'))radio.onchange=()=>selected(radio.value);
 for(const name of ['plan','billing','seats','country'])form.elements[name].addEventListener('change',()=>{sync();if(provider==='razorpay')refresh();});
 form.elements.seats.addEventListener('input',()=>{if(provider==='razorpay')refresh();});
 document.addEventListener('ajoy:quote-rendered',()=>{if(provider==='razorpay')paint();else if(provider==='review')reviewSummary();});
 onAccountChange(()=>{if(provider==='razorpay')refresh();});
 document.addEventListener('ajoy:billing-network',()=>{sync();if(provider==='razorpay')refresh();});
 Promise.all([loadRazorpayConfig(),fetch(window.AJOY_CONFIG.paypalConfigUrl,{cache:'no-store',signal:AbortSignal.timeout(10000)}).then(r=>r.ok?r.json():null).catch(()=>null)]).then(([rzp,pp])=>{config=rzp;paypalConfig=pp;sync();});
 try{const saved=JSON.parse(sessionStorage.getItem('ajoy.razorpay.pending')||'null');if(saved?.email===getAccountSession()?.email&&/^[-a-f0-9]{36}$/i.test(saved.id)){pending=saved;check.hidden=false;}}catch{}
}
