import {displayMoney,setMoney} from './currency-display.js?v=20261020-local1';
import {paymentStep,readBillingDraft,clearBillingDraft} from './checkout-steps.js?v=20261020-steps1';
/* Verified account -> server eligibility -> server-created PayPal subscription -> verified confirmation. */
import {tierFor,availability,closedMessage,countryCheck,USD} from './regions.js?v=20261020-ps1';
import {trialPlanId,TRIAL_DAYS,addDays,fmtDay} from './trial.js?v=20261020-rz1';
import {getAccountSession,onAccountChange,openAccount,bindAccountEmail} from './account-session.js?v=20261020-ps1';
import {secureCommerce} from './commerce-gateway.js?v=20261020-country1';
const settings=window.AJOY_CONFIG||{},form=document.querySelector('#billing-form'),pay=document.querySelector('#pay');
bindAccountEmail(form?.elements.email,document.querySelector('#email-hint'));
if(form&&pay){
 const box=document.createElement('div');box.className='paypal-box';box.dataset.paymentProvider='paypal';
 box.innerHTML='<section class="account-required" id="checkout-account"><b>Verify your email before subscribing.</b><p>Sign in, or register a new email with a verification code.</p><button type="button" class="btn btn-dark" data-account-gate>Register / Login</button></section><p class="paypal-test" hidden><b>Test mode.</b> No real money moves.</p><p class="paypal-closed" role="status" hidden></p><fieldset class="checkout-offer" hidden><legend>Choose your subscription</legend><label><input type="radio" name="checkout-offer" value="trial"><span data-trial-option-label>2-day Online trial · free today</span></label><label><input type="radio" name="checkout-offer" value="standard">Standard subscription · paid after PayPal approval</label></fieldset><p class="paypal-note" role="status"></p><section class="paypal-price-check" hidden><p class="form-hint" data-payment-price-status role="status" aria-live="polite"></p><button class="btn btn-light" type="button" data-payment-price-retry hidden>Retry price check</button></section><div id="paypal-buttons" hidden></div><p class="paypal-fine"></p>';
 pay.replaceWith(box);
 const gate=box.querySelector('#checkout-account'),closed=box.querySelector('.paypal-closed'),offerBox=box.querySelector('.checkout-offer'),buttons=box.querySelector('#paypal-buttons'),note=box.querySelector('.paypal-note'),fine=box.querySelector('.paypal-fine');
 const priceCheck=box.querySelector('.paypal-price-check'),priceStatus=box.querySelector('[data-payment-price-status]'),priceRetry=box.querySelector('[data-payment-price-retry]');
 priceRetry.onclick=()=>{refreshReward();sync();};
 const total=document.querySelector('#summary-total'),availabilityNote=document.querySelector('#availability');
 const esc=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let rewardQuote=null,rewardRevision=0,rewardTimer,rewardBusy=false,rewardError='',rewardKey='';
 const draft=readBillingDraft();let restoredOffer=false;
 let cfg=null,eligibility=null,selectedOffer='',trialOn=false,activeToken='',revision=0,sdkPromise,rendered=false,checkout=null,requestId=crypto.randomUUID();
 const choice=()=>({plan:form.elements.plan.value,billing:form.elements.billing.value,seats:Number(form.elements.seats.value),country:form.elements.country.value});
 const say=(text,bad=false,claimed=false)=>{note.textContent=text;note.dataset.bad=bad?'1':'0';note.classList.toggle('is-trial-claimed',claimed);};
 const rewardsSupported=()=>eligibility?.rewardsVersion===1;
 const trialConfigured=c=>Boolean(cfg&&trialPlanId(cfg,c.plan,c.billing,c.country));
 box.querySelector('[data-account-gate]').onclick=()=>openAccount({purpose:'checkout',email:form.elements.email.value});
 const invalidate=()=>{requestId=crypto.randomUUID();checkout=null;};
 const reflectTrialRestriction=error=>{
  if(error.code==='trial_expired'){invalidate();return;}
  if(!['trial_used','trial_reserved'].includes(error.code))return;
  eligibility={eligible:false,reason:error.code};selectedOffer='';invalidate();sync();
 };
 function sync(){
  if(document.documentElement.dataset.billingBlocked==='true'){box.hidden=true;trialOn=false;return;}
  if(document.documentElement.dataset.paymentProvider&&document.documentElement.dataset.paymentProvider!=='paypal'){box.hidden=true;trialOn=false;document.querySelector('#trial-line')?.setAttribute('hidden','');return;}
  box.hidden=false;
  const session=getAccountSession(),c=choice(),region=availability(c.country,cfg?.closedCountries||[]),match=document.documentElement.dataset.billingTester==='true'?{ok:true}:countryCheck(c.country,cfg?.mode==='live'?cfg.country:'');
  gate.hidden=!!session;offerBox.hidden=!session||!cfg||!eligibility;
  const available=region.open&&match.ok;
  closed.hidden=available;closed.textContent=!region.open?closedMessage[region.reason]:!match.ok?'Choose your detected billing country before subscribing.':'';
  const trial=!!session&&eligibility?.eligible&&trialConfigured(c);
  const trialRadio=offerBox.querySelector('[value="trial"]');trialRadio.disabled=!trial;
  const standardLabel=offerBox.querySelector('[value="standard"]').parentElement;
  standardLabel.lastChild.textContent=rewardsSupported()?'Standard subscription · paid after PayPal approval':'Standard subscription · no loyalty reward applied';
  const trialLabel=offerBox.querySelector('[data-trial-option-label]');
  trialLabel.textContent=eligibility?.reason==='trial_used'?'2-day trial already claimed':'2-day Online trial · '+displayPrice(0)+' today';
  trialLabel.toggleAttribute('data-trial-claimed',eligibility?.reason==='trial_used');
  if(session&&eligibility&&!restoredOffer){restoredOffer=true;if(draft?.offer)selectedOffer=draft.offer;}
  if(!session||!eligibility)selectedOffer='';
  else if(c.plan==='offline')selectedOffer='standard';
  else if(selectedOffer==='trial'&&!trial)selectedOffer='';
  else if(!selectedOffer&&couponCode)selectedOffer='standard';
  else if(!selectedOffer&&trial)selectedOffer='trial';
  for(const radio of offerBox.querySelectorAll('input'))radio.checked=radio.value===selectedOffer;
  const wasTrial=trialOn;trialOn=selectedOffer==='trial'&&trial;
  const summary=document.querySelector('.order-total');summary?.classList.toggle('is-trial',trialOn);
  let line=document.querySelector('#trial-line');
  if(trialOn){
   setMoney(total,0,'USD',c.country);
   if(!line){line=document.createElement('p');line.id='trial-line';line.className='trial-line';summary?.after(line);}
   const price=USD[tierFor(c.country)].online[c.billing]*c.seats;
   line.hidden=false;line.textContent='2-day free trial, subject to final PayPal account eligibility. Then '+displayPrice(price*100)+' per '+(c.billing==='yearly'?'year':'month')+'. Cancel in PayPal before billing starts.';
  }else{if(line)line.hidden=true;if(wasTrial)setMoney(total,USD[tierFor(c.country)][c.plan][c.billing]*100*c.seats,'USD',c.country);}
  fine.textContent=trialOn?'One trial per customer, browser, network and verified PayPal payer account. We check your payment account before granting access. Your first subscription payment follows the 2-day trial unless cancelled.':'Charged in US dollars by PayPal. Review the subscription price before approving. Your license is sent within 12 hours after server confirmation.';
  if(couponBox)couponBox.hidden=!session||!eligibility||!rewardsSupported();
  renderReward();
  const needsPrice=selectedOffer==='standard'&&rewardsSupported(),priceReady=!!rewardQuote&&!rewardBusy&&rewardKey===keyOf();
  const waiting=!!session&&!!cfg&&!!eligibility&&available&&needsPrice&&!priceReady;
  priceCheck.hidden=!waiting;priceStatus.textContent=waiting?(rewardBusy?'Confirming your subscription price…':rewardError||'Confirm your subscription price before continuing to PayPal.'):'';
  priceRetry.hidden=!waiting||rewardBusy;
  buttons.hidden=!session||!cfg||!eligibility||!selectedOffer||!available||(needsPrice&&!priceReady);
  if(availabilityNote)availabilityNote.textContent=!session?'Sign in or register your email, then review your subscription.':!cfg?'Secure checkout is temporarily unavailable.':!eligibility?'Checking your account and trial eligibility…':trialOn?'Review your free trial and its first paid renewal, then approve with PayPal.':'Review the standard subscription price, then approve with PayPal.';
  if(!buttons.hidden&&paymentStep&&document.documentElement.dataset.checkoutReady!=='false')startButtons();
 }
 for(const radio of offerBox.querySelectorAll('input'))radio.addEventListener('change',()=>{
  selectedOffer=radio.value;invalidate();say('');
  if(selectedOffer==='standard'&&rewardsSupported()&&(!rewardQuote||rewardKey!==keyOf())&&(!rewardBusy||rewardKey!==keyOf()))refreshReward();
  sync();
 });
 for(const name of ['plan','billing','country','seats'])form.elements[name].addEventListener('change',()=>{invalidate();refreshReward();sync();});
 form.elements.seats.addEventListener('input',()=>{invalidate();refreshReward();sync();});
 document.addEventListener('ajoy:quote-rendered',sync);
 /* Coupon codes are checked by the server against the owner's Coupons sheet; the old storefront handlers are replaced. */
 let couponCode=draft?.coupon||'';
 for(const id of ['coupon-code','coupon-apply','coupon-remove']){const el=document.getElementById(id);if(el)el.replaceWith(el.cloneNode(true));}
 const couponBox=document.querySelector('.coupon-panel'),cInput=document.querySelector('#coupon-code'),cApply=document.querySelector('#coupon-apply'),cRemove=document.querySelector('#coupon-remove'),cStatus=document.querySelector('#coupon-status');
 if(cInput)cInput.value=couponCode;
 document.addEventListener('ajoy:checkout-draft',event=>{event.detail.offer=selectedOffer;event.detail.coupon=couponCode;});
 const couponSay=(text,bad=false)=>{if(cStatus){cStatus.textContent=text;cStatus.dataset.error=String(bad);}};
 const keyOf=()=>JSON.stringify({...choice(),coupon:couponCode});
 function applyCoupon(){
  const code=cInput.value.trim().toUpperCase();cInput.value=code;
  if(!/^[A-Z0-9][A-Z0-9-]{2,31}$/.test(code)){couponSay('Enter a valid coupon code.',true);cInput.focus();return;}
  if(!getAccountSession()){couponSay('Sign in or register first, then apply your coupon.',true);openAccount({purpose:'checkout',email:form.elements.email.value});return;}
  couponCode=code;if(selectedOffer!=='standard'&&getAccountSession()&&eligibility)selectedOffer='standard';invalidate();refreshReward();sync();
 }
 if(cApply)cApply.onclick=applyCoupon;
 if(cInput)cInput.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.isComposing){event.preventDefault();applyCoupon();}});
 if(cRemove)cRemove.onclick=()=>{couponCode='';cInput.value='';cRemove.hidden=true;couponSay('Coupon removed.');invalidate();refreshReward();sync();};
 const rewardStatus=document.querySelector('#loyalty-status'),rewardRetry=document.querySelector('#loyalty-send');
 rewardRetry.textContent='Check rewards again';rewardRetry.disabled=false;rewardRetry.onclick=()=>{refreshReward();sync();};
 for(const id of ['loyalty-send','loyalty-change','loyalty-code-panel'])document.getElementById(id).hidden=true;
 document.querySelector('.loyalty-fine').textContent='Sign in with your previous subscription email. Rewards apply to a new checkout after paid-history verification. Existing subscriptions keep their agreed schedule. Monthly rewards do not accumulate; extra licenses do not advance a reward.';
 function renderReward(){
  const s=getAccountSession(),q=rewardQuote;
  const applied=Boolean(q?.percent&&selectedOffer==='standard'),coupon=q?.coupon;
  const span=q?(q.rewardPayments>1?'your first '+q.rewardPayments+' '+q.billing+' payments':'your first '+q.billing+' payment'):'';
  const dt=document.querySelector('#loyalty-summary-row dt');if(dt&&dt.firstChild&&dt.firstChild.nodeType===3)dt.firstChild.textContent=coupon?'Coupon '+coupon.code+' ':'Loyalty reward ';
  if(cRemove)cRemove.hidden=!couponCode;
  if(couponCode){
   const c=choice(),region=cfg?availability(c.country,cfg.closedCountries||[]):null;
   if(coupon)couponSay(coupon.code+' applied: '+coupon.percent+'% off '+span+'. The discount is shown in your order summary.'+(trialOn?' Choose the standard subscription to use it; coupons do not apply to the free trial.':''));
   else if(rewardBusy)couponSay('Checking '+couponCode+'…');
   else if(!s)couponSay('Sign in or register first, then apply your coupon.',true);
   else if(!cfg||!eligibility)couponSay('Loading your checkout. Your coupon will be checked in a moment.');
   else if(!c.country)couponSay('Choose your billing country to check this coupon.',true);
   else if(region&&!region.open)couponSay('Subscriptions are not open for the selected billing country yet, so this coupon cannot be used there.',true);
   else if(rewardError)couponSay(rewardError,true);
  }
  document.querySelector('#loyalty-summary-row').hidden=!applied;
  document.querySelector('#loyalty-summary').hidden=!applied;
  rewardRetry.hidden=!s||!rewardError||rewardBusy;
  rewardStatus.dataset.error=String(Boolean(rewardError));
  rewardStatus.textContent=!s?'Sign in or register below to check your returning subscriber rewards.':rewardBusy?'Checking verified Subscription history…':rewardError||(coupon?'Your coupon is used on this checkout. Coupons and returning subscriber rewards do not combine.':eligibility&&!rewardsSupported()?'Returning subscriber rewards are not activated on this checkout yet. No loyalty discount is applied. Review the standard price in PayPal before approval.':!q?'Choose an available billing country to check your rewards.':q.percent?'Verified: '+q.percent+'% off '+(q.rewardPayments===2?'your next two monthly payments':'your next '+q.billing+' payment')+'. '+(trialOn?'Choose the standard subscription to use this reward; it does not combine with a free trial.':'The discounted total is shown before PayPal approval.'):'Verified: no returning subscriber reward is due for this payment.');
  if(applied){
   setMoney(document.querySelector('#summary-loyalty'),-q.discountAmount,'USD',choice().country);
   document.querySelector('#loyalty-percent').textContent=q.percent+'%';
   document.querySelector('#loyalty-summary').textContent=coupon?coupon.code+' coupon, '+q.percent+'% off: '+displayPrice(q.total)+' for '+(q.rewardPayments>1?'each of your first '+q.rewardPayments+' '+q.billing+' payments':'your first '+q.billing+' payment')+', then '+displayPrice(q.unitAmount*q.seats)+' per '+(q.billing==='yearly'?'year':'month')+'.':q.percent+'% returning subscriber reward: '+displayPrice(q.total)+' for '+(q.rewardPayments===2?'each of the next two monthly payments':'the next '+q.billing+' payment')+', then '+displayPrice(q.unitAmount*q.seats)+' per '+(q.billing==='yearly'?'year':'month')+'. '+(q.billing==='yearly'?'Additional to the yearly plan saving. ':'')+'Rewards and coupons do not stack.';
  }
  if(q&&selectedOffer==='standard'){
   setMoney(total,q.total,'USD',choice().country);
   setMoney(document.querySelector('#summary-unit'),q.unitAmount,'USD',choice().country);
   if(q.billing==='monthly')setMoney(document.querySelector('#summary-subtotal'),q.unitAmount*q.seats,'USD',choice().country);
  }
 }
 function displayPrice(cents){return displayMoney(cents,'USD',choice().country);}
 function refreshReward(){
  clearTimeout(rewardTimer);const operation=++rewardRevision,c=choice(),token=getAccountSession()?.token;
  rewardQuote=null;rewardError='';rewardBusy=false;rewardKey='';
  if(document.documentElement.dataset.billingBlocked==='true'||!token||!cfg||!rewardsSupported()||!Number.isInteger(c.seats)||c.seats<1||c.seats>100||!availability(c.country,cfg.closedCountries||[]).open)return;
  rewardBusy=true;rewardKey=keyOf();const sentCoupon=couponCode;
  rewardTimer=setTimeout(async()=>{
   try{
    const result=await secureCommerce('rewards',sentCoupon?{...c,coupon:sentCoupon}:c);
    if(operation!==rewardRevision||getAccountSession()?.token!==token||keyOf()!==rewardKey)return;
    const p=result.pricing,okPercent=p&&(p.coupon?Number.isInteger(p.percent)&&p.percent>=1&&p.percent<=90:[0,5,10].includes(p.percent));
    if(!p||!Number.isInteger(p.total)||!okPercent)throw new Error('Your price could not be confirmed. Please try again.');
    rewardQuote=result.pricing;
   }catch(error){
    if(operation!==rewardRevision)return;
    if(sentCoupon&&String(error.code||'').startsWith('coupon_')){couponCode='';couponSay(error.message+' No coupon discount is applied.',true);rewardBusy=false;refreshReward();sync();return;}
    rewardError=error.message;
   }
   finally{if(operation===rewardRevision){rewardBusy=false;sync();}}
  },200);
 }

 async function checkAccount(){
  if(document.documentElement.dataset.billingBlocked==='true'){revision++;eligibility=null;sync();return;}
  const token=getAccountSession()?.token||'';if(token===activeToken&&eligibility){sync();return;}
  activeToken=token;refreshReward();eligibility=null;selectedOffer='';invalidate();const operation=++revision;say(token?'Checking your account and trial eligibility…':'');sync();
  if(!token)return;
  try{const result=await secureCommerce('eligibility');if(operation!==revision||getAccountSession()?.token!==token)return;eligibility=result;refreshReward();say(result.reason==='trial_used'?'2-day trial already claimed. You can continue with a paid subscription.':result.message||'Choose your subscription.',false,result.reason==='trial_used');}
  catch(error){if(operation===revision)say(error.message,true);}
  sync();
 }
 document.addEventListener('ajoy:currency-ready',sync);
 onAccountChange(checkAccount);
 document.addEventListener('ajoy:billing-network',checkAccount);
 document.addEventListener('ajoy:provider-change',event=>{if(event.detail.provider==='paypal'){refreshReward();checkAccount();}sync();});
 async function confirm(id){
  say('Verifying your subscription and payment account…');
  try{
   const result=await secureCommerce('confirm',{checkoutId:id});
   if(!result.accepted){say('PayPal approval is still processing. Choose Check subscription again.');let retry=box.querySelector('[data-confirm-retry]');if(!retry){retry=document.createElement('button');retry.type='button';retry.className='btn btn-light';retry.dataset.confirmRetry='';retry.textContent='Check subscription again';retry.onclick=()=>confirm(id);box.append(retry);}return;}
   showDone(result);
  }catch(error){reflectTrialRestriction(error);say(error.message,true,error.code==='trial_used');}
 }
 function showDone(result){
  clearBillingDraft();document.dispatchEvent(new Event('ajoy:payment-complete'));
  const c={...checkout?.selection,plan:result.plan||checkout?.selection.plan,billing:result.billing||checkout?.selection.billing,seats:result.seats||checkout?.selection.seats};
  say('Payment confirmed. Taking you to your confirmation page…');
  location.href='thank-you.html?'+new URLSearchParams({provider:'paypal',plan:c.plan==='offline'?'offline':'online',billing:c.billing==='yearly'?'yearly':'monthly',seats:String(c.seats||1),...(result.offer==='trial'?{offer:'trial'}:{})}).toString();
 }
 function loadSdk(){
  if(!sdkPromise)sdkPromise=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://www.paypal.com/sdk/js?client-id='+encodeURIComponent(cfg.clientId)+'&vault=true&intent=subscription&currency=USD';script.onload=()=>window.paypal?.Buttons?resolve():reject(new Error('PayPal could not start.'));script.onerror=()=>reject(new Error('PayPal could not load. Check your connection.'));document.head.append(script);});
  return sdkPromise;
 }
 async function startButtons(){
  if(rendered)return;rendered=true;
  try{
   await loadSdk();
   await window.paypal.Buttons({style:{layout:'vertical',shape:'pill',color:'blue',label:'subscribe',height:46},
    onClick:async(data,actions)=>{
     if(!getAccountSession()){openAccount({purpose:'checkout'});return actions.reject();}
     if(!form.reportValidity()||!selectedOffer||selectedOffer==='standard'&&rewardsSupported()&&(!rewardQuote||rewardBusy))return actions.reject();return actions.resolve();
    },
    createSubscription:async()=>{
     const selection=choice(),offer=selectedOffer;if(!getAccountSession()||!offer)throw new Error('Sign in and choose your subscription first.');
     try{
      if(offer==='standard'&&rewardsSupported()&&(!rewardQuote||rewardBusy||keyOf()!==rewardKey))throw new Error('Wait for your verified reward price before subscribing.');
      const result=await secureCommerce('checkout',{...selection,offer,requestId,...(offer==='standard'&&rewardsSupported()?{expectedTotal:rewardQuote.total,expectedRewardPercent:rewardQuote.percent,...(couponCode?{coupon:couponCode}:{})}:{}),name:form.elements.name.value,company:form.elements.company.value});checkout={id:result.checkoutId,selection,offer:result.offer};return result.subscriptionId;
     }catch(error){if(error.code==='price_changed'||String(error.code||'').startsWith('coupon_')){if(String(error.code||'').startsWith('coupon_')){couponCode='';couponSay(error.message,true);}invalidate();refreshReward();sync();}reflectTrialRestriction(error);say(error.message,true,error.code==='trial_used');throw error;}
    },
    onApprove:()=>{if(checkout)confirm(checkout.id);else say('Open your account to check the subscription status.',true);},
    onCancel:()=>say('Checkout cancelled. You can resume this checkout or try again after its trial reservation expires.'),
    onError:error=>{reflectTrialRestriction(error);say(error.message||'PayPal could not complete the request. Please check your subscription status before retrying.',true,error.code==='trial_used'||eligibility?.reason==='trial_used');}
   }).render('#paypal-buttons');
  }catch(error){say(error.message,true);rendered=false;}
 }
 sync();
 fetch(settings.paypalConfigUrl,{cache:'no-store',signal:AbortSignal.timeout(10000)}).then(async response=>{if(!response.ok)throw Error();cfg=await response.json();box.querySelector('.paypal-test').hidden=cfg.mode==='live';refreshReward();sync();}).catch(()=>say('Secure checkout settings are unavailable. Please try again later.',true));
 checkAccount();
 const returning=new URLSearchParams(location.search).get('checkout');if(returning&&getAccountSession())confirm(returning);
}
