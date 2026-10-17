import {api,apiBase,getQuote,previewPrice,money,suggestedCountry,mountTurnstile} from './commerce.js';
const form=document.querySelector('#billing-form'),status=document.querySelector('#checkout-status'),pay=document.querySelector('#pay');
const params=new URLSearchParams(location.search);
form.elements.plan.value=['online','offline'].includes(params.get('plan'))?params.get('plan'):'online';
form.elements.billing.value=params.get('billing')==='yearly'?'yearly':'monthly';
const codes='AF AL DZ AD AO AG AR AM AU AT AZ BS BH BD BB BY BE BZ BJ BT BO BA BW BR BN BG BF BI CV KH CM CA CF TD CL CN CO KM CG CD CR CI HR CU CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FJ FI FR GA GM GE DE GH GR GD GT GN GW GY HT HN HU IS IN ID IR IQ IE IL IT JM JP JO KZ KE KI KP KR KW KG LA LV LB LS LR LY LI LT LU MG MW MY MV ML MT MH MR MU MX FM MD MC MN ME MA MZ MM NA NR NP NL NZ NI NE NG MK NO OM PK PW PS PA PG PY PE PH PL PT QA RO RU RW KN LC VC WS SM ST SA SN RS SC SL SG SK SI SB SO ZA SS ES LK SD SR SE CH SY TW TJ TZ TH TL TG TO TT TN TR TM TV UG UA AE GB US UY UZ VU VA VE VN YE ZM ZW'.split(' ');
const names=new Intl.DisplayNames([navigator.language||'en'],{type:'region'});
const countries=codes.map(code=>[code,names.of(code)]).sort((a,b)=>a[1].localeCompare(b[1]));
for(const [code,name] of countries){const o=new Option(name,code);form.elements.country.add(o);}
form.elements.country.value=suggestedCountry();
let config={paymentsEnabled:false},quote=null,turnstileToken='',quoteRevision=0;
function selection(){return {plan:form.elements.plan.value,billing:form.elements.billing.value,seats:Number(form.elements.seats.value),country:form.elements.country.value};}
function updateButton(){pay.disabled=!config.paymentsEnabled||!quote||quote.preview||!turnstileToken;pay.textContent=!config.paymentsEnabled?'Payments opening soon':'Continue to secure payment';}
async function render(){
 const r=++quoteRevision,s=selection();quote=null;updateButton();
 document.querySelector('#summary-plan').textContent=s.plan==='online'?'Online':'Offline';
 document.querySelector('#summary-billing').textContent=s.billing==='yearly'?'Yearly':'Monthly';
 document.querySelector('#summary-seats').textContent=String(s.seats);
 if(!Number.isInteger(s.seats)||s.seats<1||s.seats>100||!s.country){document.querySelector('#summary-total').textContent='—';document.querySelector('#summary-subtotal').textContent='—';return;}
 try{
  const data=apiBase?await getQuote(s.plan,s.billing,s.seats,s.country):previewPrice(s.plan,s.billing,s.seats,s.country);
  if(r!==quoteRevision)return;quote=data;
  document.querySelector('#summary-subtotal').textContent=money(data.subtotal,data.currency);
  document.querySelector('#summary-total').textContent=money(data.subtotal,data.currency);
  document.querySelector('#quote-note').textContent=data.preview?'Estimated subtotal. The final total and applicable tax will be shown before payment.':'Price confirmed for your billing country. Any applicable tax will be shown before payment.';
  updateButton();
 }catch(e){if(r!==quoteRevision)return;document.querySelector('#summary-total').textContent='—';document.querySelector('#summary-subtotal').textContent='—';status.textContent=e.message;}
}
for(const name of ['plan','billing','country','seats'])form.elements[name].addEventListener('change',render);
form.elements.seats.addEventListener('input',()=>{quote=null;updateButton();});
async function init(){
 if(apiBase){try{config=await api('/config');}catch{document.querySelector('#availability').textContent='Subscriptions are temporarily unavailable. Your billing details stay in this browser.';}}
 if(!config.paymentsEnabled){document.querySelector('#availability').textContent='Payments are opening soon. You can review your plan here; billing details will not be sent while checkout is unavailable.';}
 else{
  document.querySelector('#availability').textContent='Review your billing details, then continue to our payment partner to confirm tax and complete your subscription.';
  try{await mountTurnstile('#checkout-verification',config.turnstileSiteKey,token=>{turnstileToken=token;updateButton();},message=>{status.textContent=message;},'checkout');}catch(e){status.textContent=e.message;}
 }
 await render();
}
form.addEventListener('submit',async event=>{
 event.preventDefault();
 if(!form.reportValidity())return;
 if(!config.paymentsEnabled){status.textContent='Payments are not open yet. No billing details have been submitted.';return;}
 if(!quote||quote.preview||!turnstileToken){status.textContent='Please refresh your price and complete human verification.';return;}
 pay.disabled=true;status.textContent='Preparing secure checkout…';
 try{
  const data=Object.fromEntries(new FormData(form));
  const result=await api('/checkout',{method:'POST',body:JSON.stringify({billing:data,quoteToken:quote.quoteToken,turnstileToken})});
  const destination=new URL(result.url);
  if(destination.protocol!=='https:'||!['checkout.stripe.com','www.paypal.com','api.razorpay.com','rzp.io'].includes(destination.hostname))throw new Error('Invalid payment destination. Please contact support.');
  location.assign(destination.href);
 }catch(e){status.textContent=e.message;turnstileToken='';if(window.turnstile)window.turnstile.reset();updateButton();}
});
init();
