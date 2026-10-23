import {displayMoney,setMoney} from './currency-display.js?v=20261020-local1';
import {readBillingDraft,paymentStep} from './checkout-steps.js?v=20261020-trial1';
/* Hosted payment selection: provider visibility is configuration, never payment authorization. */
import {availability,countryCheck,tierFor,razorpayEstimate} from './regions.js?v=20261023-p7';
import {getAccountSession,onAccountChange,openAccount} from './account-session.js?v=20261023-p7';
import {loadRazorpayConfig,razorpayAvailable} from './razorpay-config.js?v=20261021-fast2';
import {secureCommerce,browserDeviceId} from './commerce-gateway.js?v=20261020-country1';
const form=document.querySelector('#billing-form'),paypal=document.querySelector('[data-payment-provider="paypal"]'),url=window.AJOY_CONFIG?.razorpayUrl;
if(form&&paypal&&url){
 const picker=document.createElement('fieldset');picker.className='payment-picker';picker.hidden=true;
 picker.innerHTML='<legend>Choose a payment method</legend><label hidden><input type="radio" name="payment-provider" value="paypal" checked><span><b>PayPal</b><small>Pay in USD · PayPal account or card</small></span><i class="pick-badge pick-paypal" aria-hidden="true">USD</i></label><label hidden><input type="radio" name="payment-provider" value="razorpay"><span><b>Razorpay</b><small data-rzp-pick>Pay in INR · cards</small></span><i class="pick-badge pick-rzp" aria-hidden="true">INR</i></label>';
 const panel=document.createElement('section');panel.className='razorpay-panel';panel.hidden=true;
 const review=document.createElement('section');review.className='billing-review';
 review.innerHTML='<h3>Review your billing details</h3><p data-billing-availability>Checking payment availability…</p><button type="button" class="btn btn-light btn-block" data-review-billing>Review billing details</button><p class="billing-review-status" role="status" aria-live="polite"></p>';
 panel.innerHTML='<div class="rzp-head"><span class="rzp-shield" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8.5 10.5V7.8a3.5 3.5 0 0 1 7 0v2.7"/></svg></span><div><b>Secure INR checkout</b><small>Processed by Razorpay. Card and bank details never reach this site.</small></div><p class="razorpay-mode" hidden><i aria-hidden="true"></i>Test mode</p></div><fieldset class="rzp-offer" hidden><legend>How would you like to start?</legend><label><input type="radio" name="rzp-offer" value="trial"><span><b>Start 4-day free trial</b><small data-trial-terms>Nothing to pay today</small></span><em>Free</em></label><label><input type="radio" name="rzp-offer" value="standard"><span><b>Pay now</b><small>Your paid subscription starts today</small></span></label><p class="rzp-offer-note" role="status"></p></fieldset><div class="rzp-total"><small data-rzp-label>Recurring amount</small><p class="razorpay-amount" aria-live="polite"></p><p class="rzp-saving" hidden>Includes your first-year yearly saving</p><p class="rzp-check" hidden></p><p class="rzp-deal" hidden></p></div><details class="rzp-coupon"><summary>Have a coupon?</summary><div class="rzp-coupon-row"><input type="text" maxlength="32" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="Enter code" aria-label="Coupon code"><button type="button" class="btn btn-light btn-sm" data-coupon-apply>Apply</button><button type="button" class="rzp-coupon-remove" data-coupon-remove hidden>Remove</button></div><p class="rzp-coupon-msg" role="status" aria-live="polite"></p></details><ul class="rzp-methods" aria-label="Payment methods offered by Razorpay"><li>UPI</li><li>Cards</li><li>Net banking</li></ul><p class="razorpay-status" role="status" aria-live="polite"></p><button type="button" class="btn btn-blue btn-block rzp-pay" data-razorpay-start>Continue with Razorpay</button><button type="button" class="btn btn-light btn-block" data-razorpay-check hidden>Check payment status</button><a class="text-link" data-razorpay-open hidden target="_blank" rel="noopener">Open secure Razorpay checkout</a><button type="button" class="razorpay-cancel" data-razorpay-cancel hidden>Cancel this checkout</button><ul class="rzp-assure"><li>Cancel renewal any time from your account</li><li>License key within 12 hours</li><li>Time starts when you activate</li></ul><details class="razorpay-terms"><summary>Billing terms</summary><p>Paid recurring subscription, charged in rupees (INR) in India and in US dollars (USD) elsewhere. Your first-year yearly saving is included when it applies. The 4-day trial, coupons and returning-subscriber offers are currently available through PayPal only. Monthly plans authorize up to 100 charges; yearly plans up to 10, then billing stops.</p></details>';
 paypal.before(picker);paypal.after(panel,review);
 const status=panel.querySelector('.razorpay-status'),start=panel.querySelector('[data-razorpay-start]'),check=panel.querySelector('[data-razorpay-check]'),link=panel.querySelector('[data-razorpay-open]'),cancelBtn=panel.querySelector('[data-razorpay-cancel]');
 const pageCoupon={input:document.querySelector('#coupon-code'),remove:document.querySelector('#coupon-remove'),status:document.querySelector('#coupon-status')};
 let config=null,paypalConfig=null,provider='review',quote=null,pending=null,busy=false,revision=0,timer,creating=false;
 document.documentElement.dataset.paymentProvider='review';paypal.hidden=true;
 document.querySelector('#customer-verification').hidden=true;document.querySelector('.coupon-panel').hidden=true;
 const draft=readBillingDraft();let restoredProvider=false;
 let requestId=crypto.randomUUID();
 const choice=()=>({plan:form.elements.plan.value,billing:form.elements.billing.value,seats:Number(form.elements.seats.value),country:form.elements.country.value});
 const key=()=>JSON.stringify(choice());
 /* Razorpay charges INR in India and USD elsewhere once the owner has created the USD plans (config.intlCurrency). */
 const rzpCurrency=()=>quote?.currency||(choice().country!=='IN'&&config?.intlCurrency==='USD'?'USD':'INR');
 const money=value=>displayMoney(value,rzpCurrency(),choice().country);
 const showAmount=(id,value)=>setMoney(document.getElementById(id),value,rzpCurrency(),choice().country);
 const say=(text,kind='')=>{status.textContent=text;status.dataset.kind=kind;};
 /* Confirmed quotes are remembered for 10 minutes so the next step shows the price at once.
    Display only: checkout re-sends the expected total and the server refuses any changed price. */
 const quoteKey=extra=>'ajoy.rzpq:'+JSON.stringify([getAccountSession()?.email||'',choice(),extra]);
 const readQuote=extra=>{try{const v=JSON.parse(sessionStorage.getItem(quoteKey(extra))||'null');return v&&Date.now()-v.at<600000?Object.assign(v.pricing,{_age:Date.now()-v.at}):null;}catch{return null;}};
 const inflight=new Map();
 /* Identical price requests share one server call (Apps Script slows down when many arrive at once). */
 const quoteOnce=(extra,body)=>{const k=quoteKey(extra);if(!inflight.has(k))inflight.set(k,api('quote',body).finally(()=>setTimeout(()=>inflight.delete(k),1500)));return inflight.get(k);};
 const saveQuote=(extra,pricing)=>{try{sessionStorage.setItem(quoteKey(extra),JSON.stringify({at:Date.now(),pricing}));}catch{}};
 let clubNote='';
 let coupon=/^[A-Z0-9][A-Z0-9-]{2,31}$/.test(draft?.coupon||'')?draft.coupon:'',usingPopup=false,rzpScript=null,offer='standard',trialCheck={key:'',state:'',message:''};
 const thankYou=(r,plan,billing,seats)=>'thank-you.html?'+new URLSearchParams({provider:'razorpay',plan:r?.plan||plan,billing:r?.billing||billing,seats:String(r?.seats||seats),...((r?.offer||offer)==='trial'?{offer:'trial'}:{})}).toString();
 const clearPending=()=>{pending=null;requestId=crypto.randomUUID();check.hidden=true;link.hidden=true;try{sessionStorage.removeItem('ajoy.razorpay.pending');}catch{}};
 function loadCheckout(){
  if(window.Razorpay)return Promise.resolve();
  if(!rzpScript)rzpScript=new Promise((resolve,reject)=>{const tag=document.createElement('script');tag.src='https://checkout.razorpay.com/v1/checkout.js';tag.onload=()=>window.Razorpay?resolve():reject(Error('Razorpay could not load.'));tag.onerror=()=>{rzpScript=null;reject(Error('Razorpay could not load. Check your connection and try again.'));};document.head.append(tag);});
  return rzpScript;
 }
 /* Razorpay reported success: show the confirmation page at once; it finishes the server verification live. */
 function goThankYou(checkoutId,sel){
  busy=true;say('Payment received. Opening your confirmation…','ok');paint();
  try{sessionStorage.removeItem('ajoy.razorpay.pending');sessionStorage.removeItem('ajoy.billing-draft');}catch{}
  document.dispatchEvent(new Event('ajoy:payment-complete'));
  location.href=thankYou(null,sel.plan,sel.billing,sel.seats)+'&'+new URLSearchParams({checkout:checkoutId,verify:'1'}).toString();
 }
 /* Buyer closed the window or the payment failed: end the unpaid checkout so nothing is left waiting. */
 function abandon(checkoutId,reason){
  clearPending();busy=false;paint();
  say(reason?'Payment failed: '+reason+' No money was taken. You can try again.':'Payment cancelled. No money was taken. You can start again whenever you are ready.',reason?'error':'warn');
  api('cancel',{checkoutId}).catch(()=>{});
 }
 /* Payment step: the agreement sits just above the pay button of the chosen method. */
 function placeTerms(){
  if(!paymentStep)return;const terms=document.querySelector('#terms')?.closest('.check-row');if(!terms)return;
  terms.classList.add('terms-in-card');
  if(provider==='razorpay')start.before(terms);
  else if(provider==='paypal'){const target=paypal.querySelector('.paypal-price-check')||paypal.querySelector('#paypal-buttons');target?target.before(terms):paypal.append(terms);}
 }
 function selected(next){
  provider=next;document.documentElement.dataset.paymentProvider=provider;
  for(const radio of picker.querySelectorAll('input'))radio.checked=radio.value===provider;
  panel.hidden=provider!=='razorpay';paypal.hidden=provider!=='paypal';
  review.hidden=provider!=='review';
  // Offers and coupons work with PayPal and Razorpay alike.
  const promos=document.querySelector('#customer-verification');if(promos)promos.hidden=!['paypal','razorpay'].includes(provider);
  document.querySelector('.coupon-panel').hidden=!['paypal','razorpay'].includes(provider);
  document.documentElement.toggleAttribute('data-rzp-offers',provider==='razorpay');
  placeTerms();
  if(provider==='razorpay'){pageCoupon.input.value=coupon;couponNote();loyaltyNote(quote?.discount&&!trialOn()?quote.discount:null);}
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
 const offerBox=panel.querySelector('.rzp-offer'),offerNote=offerBox.querySelector('.rzp-offer-note');
 const small=p=>(rzpCurrency()==='USD'?'$':'\u20b9')+(p%100===0?p/100:(p/100).toFixed(2));
 const checkText=()=>{const usd=rzpCurrency()==='USD',raw=usd?config?.trialCheckCents:config?.trialCheckPaise;if(!Number.isInteger(raw)||raw<0||raw>500)return 'Razorpay may take a refundable payment-method check. Review the exact amount in the Razorpay window before approving.';return raw>0?'Razorpay takes a '+small(raw)+' payment-method check now. We refund it automatically.':'Razorpay takes a small payment-method check now and refunds it automatically.';};
 const trialAvailable=()=>!!config?.trial&&choice().plan==='online';
 const trialOn=()=>trialAvailable()&&offer==='trial'&&trialCheck.key===trialKey()&&trialCheck.state==='eligible';
 const trialKey=()=>(getAccountSession()?.email||'')+'|'+choice().country;
 const dateIn=days=>new Date(Date.now()+days*864e5).toLocaleDateString(undefined,{day:'numeric',month:'short'});
 /* Same one-trial-per-person check PayPal uses. The server checks again before any trial is granted. */
 async function checkTrial(){
  const k=trialKey();if(!trialAvailable()||!getAccountSession()||trialCheck.key===k&&trialCheck.state)return;
  trialCheck={key:k,state:'checking',message:''};paint();
  try{const memo='ajoy.rzptrial:'+k;let r=null;try{const v=JSON.parse(sessionStorage.getItem(memo)||'null');if(v&&Date.now()-v.at<600000)r=v.r;}catch{}
   // Only a "yes" is remembered: a "no" (for example a checkout still in progress) is always re-checked.
   if(!r){r=await secureCommerce('eligibility',{country:choice().country});if(r.eligible)try{sessionStorage.setItem(memo,JSON.stringify({at:Date.now(),r:{eligible:true}}));}catch{}else try{sessionStorage.removeItem(memo);}catch{}}if(trialCheck.key!==k)return;trialCheck={key:k,state:r.eligible?'eligible':r.reason==='trial_used'?'used':'blocked',message:r.eligible?'':(r.message||'The free trial is not available for this account.')};if(r.eligible){if(!offerTouched&&!coupon)offer='trial';if(offer==='trial'){paint();refresh();return;}}}
  catch(error){if(trialCheck.key===k)trialCheck={key:k,state:'error',message:error.message||'Trial eligibility could not be checked. You can still pay now.'};}
  paint();
 }
 let offerTouched=!!draft?.rzpOffer;if(offerTouched)offer=draft.rzpOffer;
 const couponBox=panel.querySelector('.rzp-coupon'),couponInput=couponBox.querySelector('input'),couponMsg=couponBox.querySelector('.rzp-coupon-msg'),couponRemove=couponBox.querySelector('[data-coupon-remove]');
 couponInput.value=coupon;if(coupon)couponBox.open=true;
 function couponNote(text,bad=false){
  if(text===undefined){const d=quote?.discount;text=coupon&&d?.coupon?d.coupon.code+' applied: '+d.percent+'% off '+(d.payments>1?'your first '+d.payments+' payments':'your first payment')+'.':coupon&&trialOn()?'Coupons apply to paid subscriptions, not the free trial.':'';bad=false;}
  couponMsg.textContent=text;couponMsg.dataset.error=String(bad);couponRemove.hidden=!coupon;
  if(provider==='razorpay'){pageCoupon.status.textContent=text||(getAccountSession()?'Enter your code and choose Apply. Coupons apply to paid subscriptions, not the free trial.':'Sign in, then enter your code.');pageCoupon.status.dataset.error=String(bad);pageCoupon.remove.hidden=!coupon;}
 }
 function applyCoupon(raw){
  const code=String(raw||'').trim().toUpperCase();couponInput.value=code;pageCoupon.input.value=code;
  if(!/^[A-Z0-9][A-Z0-9-]{2,31}$/.test(code)){couponNote('Enter a valid coupon code.',true);couponInput.focus();return;}
  if(!getAccountSession()){couponNote('Sign in or register first, then apply your coupon.',true);openAccount({purpose:'checkout'});return;}
  const wasTrial=trialOn();coupon=code;clubNote=wasTrial?'A coupon can\u2019t be combined with the free trial, so you\u2019re now on Pay now with '+code+'. Prefer the free trial? Choose it above (the coupon won\u2019t apply).':'';if(offer==='trial'){offer='standard';offerTouched=true;}couponNote('Checking '+code+'…');refresh();
 }
 couponBox.querySelector('[data-coupon-apply]').onclick=()=>applyCoupon(couponInput.value);
 /* The page's own coupon box and returning-subscriber card (also used by PayPal) drive Razorpay too. */
 document.addEventListener('click',event=>{
  if(provider!=='razorpay')return;const target=event.target.closest?.('#coupon-apply,#coupon-remove');if(!target)return;
  event.preventDefault();event.stopPropagation();
  if(target.id==='coupon-apply')applyCoupon(pageCoupon.input.value);else couponRemove.onclick();
 },true);
 pageCoupon.input.addEventListener('keydown',event=>{if(provider==='razorpay'&&event.key==='Enter'){event.preventDefault();event.stopPropagation();applyCoupon(pageCoupon.input.value);}},true);
 function loyaltyNote(deal){
  if(provider!=='razorpay')return;
  for(const id of ['loyalty-send','loyalty-change','loyalty-code-panel'])document.getElementById(id)?.setAttribute('hidden','');
  const note=document.getElementById('loyalty-status');if(!note)return;
  const session=getAccountSession();note.dataset.error='false';
  note.textContent=!session?'Sign in with the email you subscribed with before. Your reward is applied automatically.':deal&&!deal.coupon?'Welcome back. Your '+deal.percent+'% returning-subscriber reward is applied to this payment.':deal?.coupon?'Your coupon is applied. Coupons replace the returning-subscriber reward on this checkout.':quote?'Checked for '+session.email+': no returning-subscriber reward is due on this payment.':'Checking your returning-subscriber rewards…';
 }
 couponInput.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();couponBox.querySelector('[data-coupon-apply]').click();}});
 couponRemove.onclick=()=>{clubNote='';coupon='';couponInput.value='';pageCoupon.input.value='';couponNote('Coupon removed.');refresh();};
 document.addEventListener('ajoy:checkout-draft',event=>{if(provider==='razorpay'){event.detail.coupon=coupon;if(offerTouched)event.detail.rzpOffer=offer;}});
 for(const radio of offerBox.querySelectorAll('input'))radio.addEventListener('change',()=>{offerTouched=true;offer=radio.value;clubNote=offer==='trial'&&coupon?'The free trial can\u2019t be combined with a coupon, so '+coupon+' is not applied. Choose Pay now to use your coupon instead.':'';if(offer==='trial'&&coupon)couponNote('Coupons apply to paid subscriptions, not the free trial. Choose "Pay now" to use '+coupon+'.');refresh();});
 function paint(){
  if(provider!=='razorpay')return;
  const methods=panel.querySelector('.rzp-methods'),local=choice().country==='IN',pick=picker.querySelector('[data-rzp-pick]');const cur=rzpCurrency();if(pick)pick.textContent=local?'Pay in INR · UPI, cards or net banking':'Pay in '+cur+' · international cards';
  const badge=picker.querySelector('.pick-rzp');if(badge)badge.textContent=cur;
  const headline=panel.querySelector('.rzp-head b');if(headline)headline.textContent='Secure '+cur+' checkout';
  const want=local?'UPI,Cards,Net banking':'International cards';
  if(methods&&methods.dataset.set!==want){methods.dataset.set=want;methods.replaceChildren(...want.split(',').map(t=>Object.assign(document.createElement('li'),{textContent:t})));}
  const showOffer=trialAvailable()&&!!getAccountSession();offerBox.hidden=!showOffer;
  if(showOffer){
   const trialRadio=offerBox.querySelector('[value=trial]');trialRadio.disabled=trialCheck.state!=='eligible';
   const shown=offer==='trial'&&trialCheck.state==='eligible'?'trial':'standard';
   for(const radio of offerBox.querySelectorAll('input'))radio.checked=radio.value===shown;
   offerBox.querySelector('[data-trial-terms]').textContent=trialCheck.state==='checking'?'Checking if your account can start a trial…':trialCheck.state==='eligible'?money(0)+' today · first payment on '+dateIn(config.trialDays||4)+' · cancel any time before':trialCheck.state==='used'?'Already used on this account':trialCheck.state?'Could not be checked right now':'Checking…';
   offerNote.textContent=clubNote||trialCheck.message;offerNote.hidden=!(clubNote||trialCheck.message);offerNote.dataset.kind=clubNote?'club':'';
   if(!trialCheck.state||trialCheck.key!==trialKey())setTimeout(checkTrial,0);
  }
  const trialing=trialOn(),deal=!trialing&&quote?.discount;panel.dataset.offer=trialing?'trial':'standard';
  document.querySelector('#trial-line')?.setAttribute('hidden','');document.querySelector('.order-total')?.classList.remove('is-trial');
  for(const id of ['loyalty-summary-row','loyalty-summary','coupon-summary-row'])document.getElementById(id).hidden=true;
  const session=getAccountSession(),ownsPending=pending?.email===session?.email;start.disabled=busy||!session||!quote||ownsPending;start.textContent=!session?'Register / Login to continue':creating?'Preparing secure checkout…':ownsPending?'Check your existing checkout below':quote&&trialing?'Start 4-day free trial':quote?'Pay '+money(quote.total)+' securely':'Continue with Razorpay';panel.dataset.busy=String(busy);
  if(!ownsPending){check.hidden=true;link.hidden=true;}
  cancelBtn.hidden=check.hidden||busy;
  if(!session)start.disabled=false;
  const shownQuote=quote||(provider==='razorpay'&&Number.isInteger(choice().seats)&&choice().seats>0&&/^[A-Z]{2}$/.test(choice().country)?razorpayEstimate(choice().plan,choice().billing,choice().seats,choice().country,rzpCurrency()):null);
  const amount=shownQuote?money(shownQuote.total):'—';showAmount('summary-total',shownQuote?(trialing?0:shownQuote.total):null);loyaltyNote(deal);
  const summary=document.querySelector('.order-total');summary?.classList.toggle('is-trial',trialing);
  let line=document.querySelector('#trial-line');
  if(deal){if(!line){line=document.createElement('p');line.id='trial-line';line.className='trial-line';summary?.after(line);}line.hidden=false;const until=new Date();if(quote.billing==='yearly')until.setFullYear(until.getFullYear()+deal.payments);else until.setMonth(until.getMonth()+deal.payments);
   line.textContent=(deal.coupon?deal.coupon.code+' coupon':'Returning subscriber reward')+': '+deal.percent+'% off. You pay '+amount+' today for your first '+(deal.payments>1?deal.payments+' '+(quote.billing==='yearly'?'years':'months'):(quote.billing==='yearly'?'year':'month'))+'. Then '+money(quote.recurringTotal)+' per '+(quote.billing==='yearly'?'year':'month')+' from '+until.toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'})+'.';
   document.getElementById('coupon-summary-row').hidden=false;showAmount('summary-coupon',-(quote.unitAmount-deal.unitAmount)*quote.seats*deal.payments);}
  else if(trialing&&quote){if(!line){line=document.createElement('p');line.id='trial-line';line.className='trial-line';summary?.after(line);}line.hidden=false;line.textContent='4-day free trial. Then '+amount+' per '+(quote.billing==='yearly'?'year':'month')+' from '+dateIn(config.trialDays||2)+'. Cancel any time from your account before then and you won\u2019t be charged. '+checkText();}const figure=panel.querySelector('.razorpay-amount');const dealNode=panel.querySelector('.rzp-deal');
  panel.querySelector('[data-rzp-label]').textContent=trialing||deal?'Due today':'Recurring amount';
  dealNode.hidden=!deal;if(deal)dealNode.textContent=(deal.coupon?'Coupon '+deal.coupon.code:'Returning subscriber reward')+' · '+deal.percent+'% off';if(shownQuote){figure.innerHTML='<span class="rzp-figure"></span><span class="rzp-per"></span>';figure.firstChild.textContent=trialing?money(0):amount;figure.lastChild.textContent=deal?'covers your first '+(deal.payments>1?deal.payments+' '+(quote.billing==='yearly'?'years':'months'):(quote.billing==='yearly'?'year':'month'))+' · then '+money(quote.recurringTotal)+' per '+(quote.billing==='yearly'?'year':'month'):trialing?'then '+amount+' per '+(shownQuote.billing==='yearly'?'year':'month')+' from '+dateIn(config.trialDays||2):'per '+(shownQuote.billing==='yearly'?'year':'month')+' · '+shownQuote.seats+(shownQuote.seats===1?' license':' licenses');}else figure.innerHTML='<span class="rzp-figure rzp-placeholder">₹ ——</span>';panel.querySelector('.rzp-saving').hidden=!shownQuote||shownQuote.billing!=='yearly';{const chk=panel.querySelector('.rzp-check');chk.hidden=!trialing;if(trialing)chk.textContent=checkText();}
  if(!shownQuote){for(const id of ['summary-unit','summary-subtotal'])showAmount(id,null);document.querySelector('#annual-summary-row').hidden=true;document.querySelector('#annual-summary').hidden=true;return;}
  showAmount('summary-unit',shownQuote.unitAmount);
  showAmount('summary-subtotal',shownQuote.compareAtUnitAmount*shownQuote.seats);
  const savings=(shownQuote.compareAtUnitAmount-shownQuote.unitAmount)*shownQuote.seats;
  document.querySelector('#annual-summary-row').hidden=shownQuote.billing!=='yearly'||savings<=0;showAmount('summary-annual',-savings);
  const annual=document.querySelector('#annual-summary');annual.hidden=shownQuote.billing!=='yearly'||savings<=0;const pct=shownQuote.plan==='offline'?20:15;const tag=document.querySelector('[data-saving-percent]');if(tag)tag.textContent=pct+'%';annual.textContent=pct+'% off your first yearly plan · '+money(shownQuote.unitAmount/12)+' per license/month, billed annually.';
  document.querySelector('#quote-note').textContent='Razorpay charges '+rzpCurrency()+'. Converted local-currency amounts are estimates. Review the confirmed recurring amount before authorizing.';
  document.querySelector('#availability').textContent='Review your billing details, then authorize securely with Razorpay.';
 }
 async function api(operation,body={}){
  const session=getAccountSession();if(!session){openAccount({purpose:'checkout'});throw Error('Sign in or register to continue.');}
  const response=await fetch(url+'/'+operation,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,accountToken:session.token}),signal:AbortSignal.timeout(60000)});
  let data;try{data=await response.json();}catch{throw Error('Razorpay could not respond. Please try again later.');}
  if(!response.ok||!data.ok){document.dispatchEvent(new CustomEvent('ajoy:billing-denied',{detail:{code:data.error}}));const error=Error(data.message||'Razorpay checkout is temporarily unavailable.');error.code=data.error;throw error;}return data;
 }
 function refresh(){
  clearTimeout(timer);const operation=++revision;quote=null;requestId=crypto.randomUUID();paint();
  if(provider!=='razorpay'||!getAccountSession()||document.documentElement.dataset.billingBlocked==='true')return;
  const c=choice(),selection=key(),token=getAccountSession().token;
  if(!Number.isInteger(c.seats)||c.seats<1||c.seats>100)return;
  const sentCoupon=coupon,trialing=trialOn(),extra={offer:trialing?'trial':'standard',coupon:sentCoupon&&!trialing?sentCoupon:''};
  const remembered=readQuote(extra);
  if(remembered){quote=remembered;say('Price confirmed. Review the total before continuing.');couponNote();}
  else{busy=true;say('Confirming your Razorpay price…');}
  paint();
  if(remembered&&remembered._age<60000)return;
  timer=setTimeout(async()=>{try{const data=await quoteOnce(extra,{...c,offer:trialing?'trial':'standard',...(sentCoupon&&!trialing?{coupon:sentCoupon}:{})});if(operation!==revision||key()!==selection||getAccountSession()?.token!==token)return;quote=data.pricing;saveQuote(extra,data.pricing);say('Price confirmed. Review the total before continuing.');couponNote();}
   catch(error){if(operation!==revision)return;quote=null;if(sentCoupon&&String(error.code||'').startsWith('coupon_')){coupon='';couponNote(error.message+' No coupon discount is applied.',true);busy=false;refresh();return;}say(error.message);}finally{if(operation===revision){busy=false;paint();}}},remembered?0:180);
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
   const trialing=trialOn();const result=await api('checkout',{...sel,offer:trialing?'trial':'standard',...(coupon&&!trialing?{coupon}:{}),...(trialing?{deviceId:browserDeviceId()}:{}),requestId,expectedTotal:price.total,name:form.elements.name.value,company:form.elements.company.value});
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
    description:(trialing?'4-day free trial · then ':'')+'Wrapline '+(sel.plan==='offline'?'Premium':'Basic')+' · '+sel.billing+' · '+sel.seats+' license(s)',
    prefill:{email:getAccountSession().email,name:form.elements.name.value},theme:{color:'#2A64E8'},
    handler:()=>{paid=true;goThankYou(result.checkoutId,sel);},
    modal:{escape:true,confirm_close:true,ondismiss:()=>{if(!paid)abandon(result.checkoutId,failure);}}});
   rzp.on('payment.failed',event=>{failure=(event?.error?.description||'The bank declined the payment.').replace(/\.?$/,'.');say('Payment failed: '+failure+' Try another card or method in the Razorpay window, or close it to cancel.','error');});
   creating=false;busy=false;paint();say(trialing?'Approve in the Razorpay window. '+checkText()+' Your first payment is after the trial. Closing the window cancels this checkout.':'Complete the payment in the Razorpay window. Closing it cancels this checkout.');
   rzp.open();
  }catch(error){popup?.close();if(pending&&!usingPopup)clearPending();say(error.message,'error');if(error.code==='price_changed'||String(error.code||'').startsWith('coupon_')){if(String(error.code).startsWith('coupon_')){coupon='';couponNote(error.message,true);}setTimeout(refresh,0);}}finally{busy=false;creating=false;paint();}
 };
 check.onclick=confirm;
 cancelBtn.onclick=()=>{if(pending&&!busy)abandon(pending.id,'');};
 window.addEventListener('focus',()=>{if(provider==='razorpay'&&pending&&usingPopup)confirm();});
 for(const radio of picker.querySelectorAll('input'))radio.onchange=()=>selected(radio.value);
 for(const name of ['plan','billing','seats','country'])form.elements[name].addEventListener('change',()=>{sync();if(provider==='razorpay')refresh();});
 form.elements.seats.addEventListener('input',()=>{if(provider==='razorpay')refresh();});
 document.addEventListener('ajoy:currency-ready',()=>{if(provider==='razorpay')paint();});
 document.addEventListener('ajoy:quote-rendered',()=>{if(provider==='razorpay')paint();else if(provider==='review')reviewSummary();});
 let pricedFor=getAccountSession()?.token;
 onAccountChange(()=>{const t=getAccountSession()?.token;if(t===pricedFor)return;pricedFor=t;if(provider==='razorpay')refresh();});
 document.addEventListener('ajoy:billing-network',()=>{sync();if(provider==='razorpay')refresh();});
 Promise.all([loadRazorpayConfig(),fetch(window.AJOY_CONFIG.paypalConfigUrl,{cache:'no-store',signal:AbortSignal.timeout(10000)}).then(r=>r.ok?r.json():null).catch(()=>null)]).then(([rzp,pp])=>{config=rzp;paypalConfig=pp;sync();});
 try{const saved=JSON.parse(sessionStorage.getItem('ajoy.razorpay.pending')||'null');if(saved?.email===getAccountSession()?.email&&/^[-a-f0-9]{36}$/i.test(saved.id)){pending=saved;check.hidden=false;}}catch{}
}
