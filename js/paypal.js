/* Verified account -> server eligibility -> server-created PayPal subscription -> verified confirmation. */
import {tierFor,availability,closedMessage,countryCheck,USD} from './regions.js?v=20261018-g5';
import {rememberGeo} from './geo.js?v=20261018-h8';
import {trialPlanId,TRIAL_DAYS,addDays,fmtDay} from './trial.js?v=20261018-j3';
import {getAccountSession,onAccountChange,openAccount,bindAccountEmail} from './account-session.js?v=20261018-n1';
import {secureCommerce} from './commerce-gateway.js?v=20261018-n1';
const settings=window.AJOY_CONFIG||{},form=document.querySelector('#billing-form'),pay=document.querySelector('#pay');
bindAccountEmail(form?.elements.email,document.querySelector('#email-hint'));
if(form&&pay){
 const box=document.createElement('div');box.className='paypal-box';
 box.innerHTML='<section class="account-required" id="checkout-account"><b>Verify your email before subscribing.</b><p>Sign in, or register a new email with a verification code.</p><button type="button" class="btn btn-dark" data-account-gate>Sign in or register</button></section><p class="paypal-test" hidden><b>Test mode.</b> No real money moves.</p><p class="paypal-closed" role="status" hidden></p><fieldset class="checkout-offer" hidden><legend>Choose your subscription</legend><label><input type="radio" name="checkout-offer" value="trial">2-day Online trial · $0 today</label><label><input type="radio" name="checkout-offer" value="standard">Standard subscription · paid after PayPal approval</label></fieldset><p class="paypal-note" role="status"></p><div id="paypal-buttons" hidden></div><p class="paypal-fine"></p>';
 pay.replaceWith(box);
 const gate=box.querySelector('#checkout-account'),closed=box.querySelector('.paypal-closed'),offerBox=box.querySelector('.checkout-offer'),buttons=box.querySelector('#paypal-buttons'),note=box.querySelector('.paypal-note'),fine=box.querySelector('.paypal-fine');
 const total=document.querySelector('#summary-total'),availabilityNote=document.querySelector('#availability');
 const esc=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let cfg=null,eligibility=null,selectedOffer='',trialOn=false,lastTotal=total?.textContent||'—',activeToken='',revision=0,sdkPromise,rendered=false,checkout=null,requestId=crypto.randomUUID();
 const choice=()=>({plan:form.elements.plan.value,billing:form.elements.billing.value,seats:Number(form.elements.seats.value),country:form.elements.country.value});
 const say=(text,bad=false)=>{note.textContent=text;note.dataset.bad=bad?'1':'0';};
 const trialConfigured=c=>Boolean(cfg&&trialPlanId(cfg,c.plan,c.billing,c.country));
 box.querySelector('[data-account-gate]').onclick=()=>openAccount({purpose:'checkout',email:form.elements.email.value});
 const invalidate=()=>{requestId=crypto.randomUUID();checkout=null;};
 function sync(){
  const session=getAccountSession(),c=choice(),region=availability(c.country,cfg?.closedCountries||[]),match=countryCheck(c.country,cfg?.mode==='live'?cfg.country:'');
  gate.hidden=!!session;offerBox.hidden=!session||!cfg||!eligibility;
  const available=region.open&&match.ok;
  closed.hidden=available;closed.textContent=!region.open?closedMessage[region.reason]:!match.ok?'Choose your detected billing country before subscribing.':'';
  const trial=!!session&&eligibility?.eligible&&trialConfigured(c);
  const trialRadio=offerBox.querySelector('[value="trial"]');trialRadio.disabled=!trial;
  if(!session||!eligibility)selectedOffer='';
  else if(c.plan==='offline')selectedOffer='standard';
  else if(selectedOffer==='trial'&&!trial)selectedOffer='';
  else if(!selectedOffer&&trial)selectedOffer='trial';
  for(const radio of offerBox.querySelectorAll('input'))radio.checked=radio.value===selectedOffer;
  trialOn=selectedOffer==='trial'&&trial;
  const summary=document.querySelector('.order-total');summary?.classList.toggle('is-trial',trialOn);
  let line=document.querySelector('#trial-line');
  if(trialOn){
   if(total&&total.textContent!=='$0'){lastTotal=total.textContent;total.textContent='$0';}
   if(!line){line=document.createElement('p');line.id='trial-line';line.className='trial-line';summary?.after(line);}
   const price=USD[tierFor(c.country)].online[c.billing]*c.seats;
   line.hidden=false;line.textContent='2-day free trial, subject to final PayPal account eligibility. Then $'+price+' per '+(c.billing==='yearly'?'year':'month')+'. Cancel in PayPal before billing starts.';
  }else{if(line)line.hidden=true;if(total&&total.textContent==='$0')total.textContent=lastTotal;}
  fine.textContent=trialOn?'One trial per customer, browser, network and verified PayPal payer account. We check your payment account before granting access. Your first subscription payment follows the 2-day trial unless cancelled.':'Charged in US dollars by PayPal. Review the subscription price before approving. Your license is sent within 12 hours after server confirmation.';
  buttons.hidden=!session||!cfg||!eligibility||!selectedOffer||!available;
  if(availabilityNote)availabilityNote.textContent=!session?'Sign in or register your email, then review your subscription.':!cfg?'Secure checkout is temporarily unavailable.':!eligibility?'Checking your account and trial eligibility…':trialOn?'Review your free trial and its first paid renewal, then approve with PayPal.':'Review the standard subscription price, then approve with PayPal.';
  if(!buttons.hidden)startButtons();
 }
 if(total)new MutationObserver(()=>{if(total.textContent!=='$0')lastTotal=total.textContent;if(trialOn&&total.textContent!=='$0')total.textContent='$0';}).observe(total,{childList:true,characterData:true,subtree:true});
 for(const radio of offerBox.querySelectorAll('input'))radio.addEventListener('change',()=>{selectedOffer=radio.value;invalidate();sync();});
 for(const name of ['plan','billing','country','seats'])form.elements[name].addEventListener('change',()=>{invalidate();sync();});
 async function checkAccount(){
  const token=getAccountSession()?.token||'';if(token===activeToken&&eligibility){sync();return;}
  activeToken=token;eligibility=null;selectedOffer='';invalidate();const operation=++revision;sync();
  if(!token)return;
  try{const result=await secureCommerce('eligibility');if(operation!==revision||getAccountSession()?.token!==token)return;eligibility=result;say(result.message||'Choose your subscription.');}
  catch(error){if(operation===revision)say(error.message,true);}
  sync();
 }
 onAccountChange(checkAccount);
 async function confirm(id){
  say('Verifying your subscription and payment account…');
  try{
   const result=await secureCommerce('confirm',{checkoutId:id});
   if(!result.accepted){say('PayPal approval is still processing. Choose Check subscription again.');let retry=box.querySelector('[data-confirm-retry]');if(!retry){retry=document.createElement('button');retry.type='button';retry.className='btn btn-light';retry.dataset.confirmRetry='';retry.textContent='Check subscription again';retry.onclick=()=>confirm(id);box.append(retry);}return;}
   showDone(result);
  }catch(error){say(error.message,true);if(error.code==='trial_used'){eligibility={eligible:false};selectedOffer='';invalidate();sync();}}
 }
 function showDone(result){
  const c={...checkout?.selection,plan:result.plan||checkout?.selection.plan,billing:result.billing||checkout?.selection.billing,seats:result.seats||checkout?.selection.seats};
  const card=document.createElement('section');card.className='pay-done';card.setAttribute('role','status');
  card.innerHTML='<svg class="pd-check" viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="23"/><path d="M15 27l8 8 15-17"/></svg><p class="eyebrow">'+(result.offer==='trial'?'Trial approved':'Subscription confirmed')+'</p><h2>Thank you. Your account is ready.</h2><dl class="pd-list"><div><dt>Plan</dt><dd>'+esc(c.plan==='offline'?'Offline':'Online')+' · '+esc(c.billing)+' · '+esc(c.seats)+' license(s)</dd></div><div><dt>License email</dt><dd>'+esc(result.email)+'</dd></div><div><dt>Subscription ID</dt><dd>'+esc(result.subscriptionId)+'</dd></div></dl>'+(result.offer==='trial'?'<p class="pd-note">Your 2-day trial is approved. Your first payment follows the trial unless you cancel in PayPal.</p>':'')+'<p class="pd-note">Your license arrives within 12 hours. You remain signed in with your verified email.</p><div class="pd-bar" aria-hidden="true"></div><p class="pd-count">Taking you home in <b id="pd-sec">8</b> seconds. <a href="index.html">Go now</a></p>';
  card.style.setProperty('--redir','8s');document.querySelector('.checkout-grid').before(card);document.querySelector('.checkout-grid').hidden=true;if(availabilityNote)availabilityNote.hidden=true;
  try{sessionStorage.setItem('ajoy.acct.open','1');}catch{}
  card.scrollIntoView({behavior:'smooth',block:'center'});let left=8;const timer=setInterval(()=>{card.querySelector('#pd-sec').textContent=String(--left);if(left<=0){clearInterval(timer);location.href='index.html';}},1000);
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
     if(!form.reportValidity()||!selectedOffer)return actions.reject();return actions.resolve();
    },
    createSubscription:async()=>{
     const selection=choice(),offer=selectedOffer;if(!getAccountSession()||!offer)throw new Error('Sign in and choose your subscription first.');
     const result=await secureCommerce('checkout',{...selection,offer,requestId,name:form.elements.name.value,company:form.elements.company.value});checkout={id:result.checkoutId,selection,offer:result.offer};return result.subscriptionId;
    },
    onApprove:()=>{if(checkout)confirm(checkout.id);else say('Open your account to check the subscription status.',true);},
    onCancel:()=>say('Checkout cancelled. You can resume this checkout or try again after its trial reservation expires.'),
    onError:error=>say(error.message||'PayPal could not complete the request. Please check your subscription status before retrying.',true)
   }).render('#paypal-buttons');
  }catch(error){say(error.message,true);rendered=false;}
 }
 sync();
 fetch(settings.paypalConfigUrl,{cache:'no-store',signal:AbortSignal.timeout(10000)}).then(async response=>{if(!response.ok)throw Error();cfg=await response.json();rememberGeo(cfg.country);if(cfg.country&&[...form.elements.country.options].some(o=>o.value===cfg.country)){form.elements.country.value=cfg.country;form.elements.country.dispatchEvent(new Event('change'));}box.querySelector('.paypal-test').hidden=cfg.mode==='live';sync();}).catch(()=>say('Secure checkout settings are unavailable. Please try again later.',true));
 checkAccount();
 const returning=new URLSearchParams(location.search).get('checkout');if(returning&&getAccountSession())confirm(returning);
}
