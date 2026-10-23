import {initializeCheckoutSteps} from './checkout-steps.js?v=20261020-trial1';
import {displayMoney,setMoney} from './currency-display.js?v=20261020-local1';
import {initializeBillingCountry} from './billing-country.js?v=20261021-fast2';
import {premiumYearlyUsed} from './regions.js?v=20261023-p6';
import {api,apiBase,getQuote,getCouponQuote,previewPrice} from './commerce.js?v=20261020-prices1';
import {initializeCustomerVerification,customerHeaders,customerVerified,customerVersion,clearCustomer,showCustomerReward,showCustomerError} from './customer-verification.js?v=20261020-prices1';
const form=document.querySelector('#billing-form'),status=document.querySelector('#checkout-status'),pay=document.querySelector('#pay');
const params=new URLSearchParams(location.search);
form.elements.plan.value=['online','offline'].includes(params.get('plan'))?params.get('plan'):'online';
form.elements.billing.value=params.get('billing')==='yearly'?'yearly':'monthly';
const codes='AF AL DZ AD AO AG AR AM AU AT AZ BS BH BD BB BY BE BZ BJ BT BO BA BW BR BN BG BF BI CV KH CM CA CF TD CL CN CO KM CG CD CR CI HR CU CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FJ FI FR GA GM GE DE GH GR GD GT GN GW GY HT HN HU IS IN ID IR IQ IE IL IT JM JP JO KZ KE KI KP KR KW KG LA LV LB LS LR LY LI LT LU MG MW MY MV ML MT MH MR MU MX FM MD MC MN ME MA MZ MM NA NR NP NL NZ NI NE NG MK NO OM PK PW PS PA PG PY PE PH PL PT QA RO RU RW KN LC VC WS SM ST SA SN RS SC SL SG SK SI SB SO ZA SS ES LK SD SR SE CH SY TW TJ TZ TH TL TG TO TT TN TR TM TV UG UA AE GB US UY UZ VU VA VE VN YE ZM ZW'.split(' ');
const names=new Intl.DisplayNames([navigator.language||'en'],{type:'region'});
const countries=codes.map(code=>[code,names.of(code)]).sort((a,b)=>a[1].localeCompare(b[1]));
for(const [code,name] of countries){const o=new Option(name,code);form.elements.country.add(o);}
initializeCheckoutSteps(form);
initializeBillingCountry(form);
let config={paymentsEnabled:false},quote=null,quoteRevision=0;
const quantity=form.elements.seats,less=document.querySelector('#quantity-less'),more=document.querySelector('#quantity-more');
const couponInput=form.elements.couponCode,couponApply=document.querySelector('#coupon-apply'),couponRemove=document.querySelector('#coupon-remove'),couponStatus=document.querySelector('#coupon-status');
let quantityTimer,appliedCoupon='',couponBusy=false,couponOperation=0;
function couponMessage(text,error=false){couponStatus.textContent=text;couponStatus.dataset.error=String(error);}
function syncQuantity(){const value=Number(quantity.value),valid=quantity.value!==''&&quantity.validity.valid;less.disabled=valid&&value<=1;more.disabled=valid&&value>=100;}
function clearAmounts(){
 for(const id of ['summary-total','summary-subtotal','summary-unit'])setMoney(document.getElementById(id),null);
 for(const id of ['annual-summary-row','coupon-summary-row','annual-summary'])document.getElementById(id).hidden=true;
 document.querySelector('#yearly-upsell').hidden=true;
 document.querySelector('#loyalty-summary-row').hidden=true;document.querySelector('#loyalty-summary').hidden=true;
}
for(const [button,step] of [[less,-1],[more,1]])button.addEventListener('click',()=>{
 const current=Number(quantity.value);quantity.value=String(quantity.value!==''&&quantity.validity.valid?Math.min(100,Math.max(1,current+step)):1);
 quantity.dispatchEvent(new Event('input',{bubbles:true}));quantity.dispatchEvent(new Event('change',{bubbles:true}));
});
function selection(){return {plan:form.elements.plan.value,billing:form.elements.billing.value,seats:Number(quantity.value),country:form.elements.country.value};}
function updateButton(){pay.disabled=!config.paymentsEnabled||!quote||quote.preview||!quote.quoteToken||couponBusy||Boolean(quote?.customerId&&!customerVerified());pay.textContent=!config.paymentsEnabled?'Payments temporarily unavailable':'Continue to secure payment';}
const money=(amount,currency)=>displayMoney(amount,currency,form.elements.country.value);
const showAmount=(id,amount,currency)=>setMoney(document.getElementById(id),amount,currency,form.elements.country.value);
function showQuote(data){
 quote=data;
 const upsell=document.querySelector('#yearly-upsell');
 upsell.hidden=data.billing!=='monthly'||data.plan==='offline'&&premiumYearlyUsed();
 if(!upsell.hidden){
  const yearlySaving=(data.monthlyAmount*12-Math.round(data.monthlyAmount*12*.8))*data.seats;
  document.querySelector('#yearly-upsell-copy').textContent='Save '+money(yearlySaving,data.currency)+' across '+data.seats+' license'+(data.seats===1?'':'s')+' over a year, compared with 12 standard monthly payments. Annual billing.';
 }
 showAmount('summary-unit',data.unitAmount,data.currency);
 document.querySelector('#summary-subtotal-label').textContent=data.billing==='yearly'?'12 months at monthly price':'Subtotal';
 showAmount('summary-subtotal',data.billing==='yearly'?data.compareAtUnitAmount*data.seats:(data.baseSubtotal??data.subtotal),data.currency);
 showAmount('summary-total',data.subtotal,data.currency);
 const annual=document.querySelector('#annual-summary');
 document.querySelector('#annual-summary-row').hidden=!(data.billing==='yearly'&&data.annualSavings>0);
 annual.hidden=!(data.billing==='yearly'&&data.annualSavings>0);
 if(data.billing==='yearly'&&data.annualSavings>0){
  showAmount('summary-annual',-data.annualSavings,data.currency);
  annual.textContent='20% off yearly · '+money(data.unitAmount/12,data.currency)+' per license/month, billed annually.';
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches)annual.animate([{opacity:.2,translate:'0 6px'},{opacity:1,translate:'0 0'}],{duration:450,easing:'ease-out'});
 }
 document.querySelector('#coupon-summary-row').hidden=!data.coupon;
 if(data.coupon)showAmount('summary-coupon',-data.coupon.discountAmount,data.currency);
 couponRemove.hidden=!appliedCoupon;
 const loyalty=data.loyalty;
 document.querySelector('#loyalty-summary-row').hidden=!loyalty?.discountAmount;
 document.querySelector('#loyalty-summary').hidden=!loyalty?.discountAmount;
 if(loyalty?.discountAmount){
  showAmount('summary-loyalty',-loyalty.discountAmount,data.currency);
  document.querySelector('#loyalty-percent').textContent=loyalty.percent+'%';
  document.querySelector('#loyalty-summary').textContent='One-time '+loyalty.percent+'% loyalty reward applied to your '+(data.billing==='yearly'?'first yearly renewal':'monthly payment '+loyalty.nextPayment)+'. '+(data.billing==='yearly'?'This is additional to the 20% yearly saving. ':'')+'Rewards and coupons do not stack.';
 }
 showCustomerReward(data);
 document.querySelector('#quote-note').textContent=data.preview?data.currency==='USD'?'Local-currency amounts are estimates. PayPal charges USD; your bank may use its own rate.':'Prices shown in INR. The USD equivalent is an estimate. Review the confirmed currency before approving payment.':'Price confirmed for your billing country. Review the confirmed total before payment.';
 status.textContent='';updateButton();document.dispatchEvent(new CustomEvent('ajoy:quote-rendered'));
}
document.addEventListener('ajoy:currency-ready',()=>{if(quote)showQuote(quote);});
async function render(){
 clearTimeout(quantityTimer);
 const r=++quoteRevision,s=selection();quote=null;updateButton();syncQuantity();
 document.querySelector('#summary-plan').textContent=s.plan==='online'?'Basic':'Premium';
 document.querySelector('#summary-billing').textContent=s.billing==='yearly'?'Yearly':'Monthly';
 document.querySelector('#summary-seats').textContent=quantity.value!==''?String(s.seats):'—';
 clearAmounts();
 if(!Number.isInteger(s.seats)||s.seats<1||s.seats>100||!s.country)return;
 try{
  let data;
  if(appliedCoupon){
   try{data=await getCouponQuote(s,appliedCoupon,customerHeaders());}catch(e){
    if(r!==quoteRevision)return;
    if(e.status!==400)throw e;
    appliedCoupon='';couponRemove.hidden=true;couponMessage(e.message+' No coupon discount is applied.',true);
   }
  }
  if(!data)data=apiBase?await getQuote(s.plan,s.billing,s.seats,s.country,customerHeaders()):previewPrice(s.plan,s.billing,s.seats,s.country);
  if(r!==quoteRevision)return;showQuote(data);
 }catch(e){if(r!==quoteRevision)return;if(e.status===401&&customerVerified()){clearCustomer('Your verification expired. Verify your email again.');return;}clearAmounts();showCustomerError();status.textContent=e.message;}
}
for(const name of ['plan','billing','country'])form.elements[name].addEventListener('change',render);
quantity.addEventListener('input',()=>{
 clearTimeout(quantityTimer);quoteRevision++;quote=null;updateButton();syncQuantity();clearAmounts();document.querySelector('#summary-seats').textContent=quantity.value||'—';quantityTimer=setTimeout(render,180);
});
quantity.addEventListener('change',()=>{clearTimeout(quantityTimer);render();});
async function applyCode(){
 const code=couponInput.value.trim().toUpperCase();couponInput.value=code;
 if(!/^[A-Z0-9][A-Z0-9-]{5,31}$/.test(code)){couponMessage('Enter a valid coupon code (6–32 letters, numbers or hyphens).',true);couponInput.focus();return;}
 if(!apiBase){couponMessage('Coupon validation is not available yet. No discount has been applied.',true);return;}
 const s=selection(),key=JSON.stringify(s),identity=customerVersion(),operation=++couponOperation;
 couponBusy=true;couponApply.disabled=true;couponApply.textContent='Checking…';couponMessage('Checking your coupon…');updateButton();
 try{
  const data=await getCouponQuote(s,code,customerHeaders());
  if(operation!==couponOperation)return;
  if(JSON.stringify(selection())!==key||identity!==customerVersion()){couponMessage('Your selection changed. Please apply the code again.',true);return;}
  quoteRevision++;appliedCoupon=data.coupon?code:'';showQuote(data);couponMessage(data.promotionMessage||(code+' applied: '+data.coupon.percent+'% off the plan subtotal.'));
 }catch(e){if(operation===couponOperation)couponMessage(e.message+(appliedCoupon?' '+appliedCoupon+' remains applied.':' No coupon discount has been applied.'),true);}
 finally{if(operation===couponOperation){couponBusy=false;couponApply.disabled=false;couponApply.textContent='Apply';updateButton();}}
}
couponApply.addEventListener('click',applyCode);
couponInput.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.isComposing){event.preventDefault();if(!couponBusy)applyCode();}});
couponRemove.addEventListener('click',()=>{
 couponOperation++;couponBusy=false;appliedCoupon='';couponInput.value='';couponApply.disabled=false;couponApply.textContent='Apply';couponRemove.hidden=true;couponMessage('Coupon removed.');render();
});
async function init(){
 let configFailed=false;
 if(apiBase){try{config=await api('/config');}catch{configFailed=true;document.querySelector('#availability').textContent='Subscriptions are temporarily unavailable. Your billing details stay in this browser.';}}
 if(!config.paymentsEnabled&&!configFailed)document.querySelector('#availability').textContent=config.loyalty?.enabled?'Payments are temporarily unavailable. You can review your plan and available rewards; no order or charge will be created.':'Payments are temporarily unavailable. You can review your plan; no order or charge will be created.';
 else if(config.paymentsEnabled){
  document.querySelector('#availability').textContent='Review your billing details, then continue to our payment partner to complete your subscription.';
 }
 if(!window.AJOY_CONFIG?.commerceUrl)initializeCustomerVerification(config.loyalty,()=>{
  couponOperation++;couponBusy=false;appliedCoupon='';couponApply.disabled=false;couponApply.textContent='Apply';couponRemove.hidden=true;couponMessage('Enter your code to check eligibility.');render();
 });
 await render();
}
form.addEventListener('submit',async event=>{
 event.preventDefault();if(!form.reportValidity())return;
 if(!config.paymentsEnabled){status.textContent='Payments are not open yet. No billing details have been submitted.';return;}
 if(!quote||quote.preview||!quote.quoteToken||couponBusy){status.textContent='Please refresh your price before continuing.';return;}
 if(quote.expiresAt<=Date.now()){await render();status.textContent='Your price has been refreshed. Review the total, then continue.';return;}
 pay.disabled=true;status.textContent='Preparing secure checkout…';
 try{
  const data=Object.fromEntries(new FormData(form));
  const result=await api('/checkout',{method:'POST',headers:customerHeaders(),body:JSON.stringify({billing:data,quoteToken:quote.quoteToken,couponCode:appliedCoupon||undefined})});
  const destination=new URL(result.url);
  if(destination.protocol!=='https:'||!['checkout.stripe.com','www.paypal.com','api.razorpay.com','rzp.io'].includes(destination.hostname))throw new Error('Invalid payment destination. Please contact support.');
  location.assign(destination.href);
 }catch(e){status.textContent=e.message;updateButton();}
});
init();
document.querySelector('#choose-yearly').addEventListener('click',()=>{
 form.elements.billing.value='yearly';form.elements.billing.dispatchEvent(new Event('change',{bubbles:true}));
 form.elements.billing.focus({preventScroll:true});
});
