/* Razorpay recurring INR subscriptions. All calls arrive inside the signed commerce RPC.
   Separate enablement, mode and allowlist preserve the working PayPal integration. */
function razorpayMode_(){return props_().getProperty('RAZORPAY_MODE')==='live'?'live':'test';}
function razorpayCountries_(){
  return (props_().getProperty('RAZORPAY_ALLOWED_COUNTRIES')||'IN').toUpperCase().split(/[^A-Z]+/).filter(function(c){return /^[A-Z]{2}$/.test(c)&&(c==='IN'||CLOSED_.indexOf(c)<0);});
}
/* RAZORPAY_ALLOWED_COUNTRIES = ALL opens Razorpay (international payments) everywhere except deliberately closed
   countries (tax registration pending, sanctions). India is always included with ALL. */
function razorpayAllCountries_(){return /^\s*ALL\s*$/i.test(props_().getProperty('RAZORPAY_ALLOWED_COUNTRIES')||'');}
function razorpayClosed_(){return CLOSED_.filter(function(c){return c!=='IN';});}
function razorpayCountryAllowed_(c){
  if(!/^[A-Z]{2}$/.test(c||''))return false;
  if(razorpayAllCountries_())return c==='IN'||razorpayClosed_().indexOf(c)<0;
  return razorpayCountries_().indexOf(c)>=0;
}
function razorpayConnected_(){
  var p=props_(),key=p.getProperty('RAZORPAY_KEY_ID')||'';
  return key.indexOf('rzp_'+razorpayMode_()+'_')===0&&(p.getProperty('RAZORPAY_KEY_SECRET')||'').length>=16&&(p.getProperty('RAZORPAY_WEBHOOK_SECRET')||'').length>=16;
}
function razorpayEnabled_(){return props_().getProperty('COMMERCE_ENABLED')==='true'&&props_().getProperty('RAZORPAY_ENABLED')==='true'&&razorpayConnected_();}
function razorpayApi_(path,method,body){
  var p=props_(),key=p.getProperty('RAZORPAY_KEY_ID'),secret=p.getProperty('RAZORPAY_KEY_SECRET');
  if(!key||key.indexOf('rzp_'+razorpayMode_()+'_')!==0||!secret)throw commerceError_('unavailable','Razorpay credentials are not configured for this mode.');
  var options={method:method||'get',muteHttpExceptions:true,headers:{Authorization:'Basic '+Utilities.base64Encode(key+':'+secret)}};
  if(body){options.contentType='application/json';options.payload=JSON.stringify(body);}
  var response=UrlFetchApp.fetch('https://api.razorpay.com/v1'+path,options),status=response.getResponseCode();
  if(status<200||status>=300)throw commerceError_('provider','Razorpay could not complete this request. Check your subscription before retrying.');
  try{return JSON.parse(response.getContentText());}catch(e){throw commerceError_('provider','Razorpay returned an invalid response.');}
}
function razorpayCatalog_(){return JSON.parse(props_().getProperty('RAZORPAY_PLANS_'+razorpayMode_())||'{}');}
/* Currency for Razorpay outside India: USD (same prices as PayPal) once setupRazorpayPlans() has created the
   USD plans; until then the existing INR plans keep working. Script property RAZORPAY_INTL_CURRENCY=INR keeps INR. */
function razorpayIntlCurrency_(){return (props_().getProperty('RAZORPAY_INTL_CURRENCY')||'USD').toUpperCase()==='INR'?'INR':'USD';}
function razorpayCurrencyFor_(country,catalog){return country!=='IN'&&razorpayIntlCurrency_()==='USD'&&(catalog||razorpayCatalog_())._intlCurrency==='USD'?'USD':'INR';}
function razorpayYearlyPercent_(plan){return plan==='offline'?20:15;}
function razorpayPrice_(plan,billing,country,currency,full){
  // full: yearly at its regular price, for accounts that already used the first-year saving on that plan.
  full=!!full&&billing==='yearly';
  if((currency||'INR')==='USD'){
    var t=PRICES[tierFor_(country)][plan],m=Math.round(t.monthly*100);
    if(full){var f=Math.round(t.full*100);return {currency:'USD',unitAmount:f,monthlyAmount:m,compareAtUnitAmount:f,fullPrice:true};}
    return {currency:'USD',unitAmount:billing==='yearly'?Math.round(t.yearly*100):m,monthlyAmount:m,compareAtUnitAmount:billing==='yearly'?Math.round((t.full||t.monthly*12)*100):m};
  }
  var india=country==='IN',monthly=india?(plan==='offline'?189991:89900):{low:91698,mid:142698,high:203898}[tierFor_(country)]*(plan==='offline'?2:1);
  var list=india?(plan==='offline'?2279900:1078800):monthly*12;
  if(full)return {currency:'INR',unitAmount:list,monthlyAmount:monthly,compareAtUnitAmount:list,fullPrice:true};
  return {currency:'INR',unitAmount:billing==='yearly'?Math.round(list*(100-razorpayYearlyPercent_(plan))/100):monthly,monthlyAmount:monthly,compareAtUnitAmount:billing==='yearly'?list:monthly};
}
function razorpaySelection_(d,who){
  if(!razorpayEnabled_())throw commerceError_('unavailable','Razorpay subscriptions are not activated yet.');
  if(['online','offline'].indexOf(d.plan)<0||['monthly','yearly'].indexOf(d.billing)<0||!Number.isInteger(d.seats)||d.seats<1||d.seats>100)throw commerceError_('selection','Review your plan and license quantity.');
  if(d.sandboxCountry&&razorpayMode_()!=='test')throw commerceError_('region','Test country settings cannot be used for live payments.');
  var country=d.sandboxCountry||d.country;
  if(!razorpayCountryAllowed_(country)||country!==d.billingCountry)throw commerceError_('region','Razorpay is not available for your verified billing country.');
  var key=country==='IN'?'india':tierFor_(country),catalog=razorpayCatalog_(),full=!!who&&d.billing==='yearly'&&yearlyOfferUsed_(who.email,d.plan),planId=catalog[key]&&catalog[key][d.plan]&&catalog[key][d.plan][full?'yearlyFull':d.billing];
  if(!/^plan_[A-Za-z0-9]+$/.test(planId||''))throw commerceError_('unavailable','This Razorpay subscription plan is not configured yet.');
  if(catalog._priceVersion!==PRICE_VERSION)throw commerceError_('unavailable','Subscription plans are being updated. Please try again shortly.');
  var price=razorpayPrice_(d.plan,d.billing,country,razorpayCurrencyFor_(country,catalog),full);price.total=price.unitAmount*d.seats;price.plan=d.plan;price.billing=d.billing;price.seats=d.seats;price.country=country;price.planId=planId;
  if(d.offer==='trial'){
    if(d.plan!=='online')throw commerceError_('selection','Only Basic plans offer a trial.');
    if(!razorpayTrialOn_())throw commerceError_('trial_unavailable','The free trial is not available right now. You can continue with a paid subscription.');
    if(d.billing==='yearly'&&who&&yearlyOfferUsed_(who.email,'online'))throw commerceError_('selection','Your first-year yearly saving on Basic has already been used. Start the trial with monthly billing, or subscribe yearly at the regular price.');
    price.offer='trial';price.trialDays=RAZORPAY_TRIAL_DAYS_;
  }
  return price;
}
var RAZORPAY_TRIAL_DAYS_=4;
/* Coupons and returning-subscriber rewards for Razorpay. Razorpay cannot discount only the first charges of a
   subscription, so the discounted payment(s) are collected up front and the regular price starts after them. */
function razorpayDiscount_(price,d,who){
  if(price.offer==='trial')return price;
  var history;try{history=rewardHistoryCached_(who.email);}catch(e){history={monthly:0,yearly:0,used:{},statuses:{},receipts:[]};}
  var reward=rewardQuote_({plan:price.plan,billing:price.billing,seats:price.seats,country:'US'},who,history);
  var coupon=d.coupon?couponRule_(d.coupon,{plan:price.plan,billing:price.billing,country:price.country,billingCountry:price.country,exceptId:d.exceptId||''},who.email):null;
  var percent=coupon?coupon.percent:reward.percent,payments=coupon?coupon.payments:reward.rewardPayments;
  if(!percent||!payments)return price;
  var unit=Math.round(price.unitAmount*(100-percent)/100);
  price.discount={percent:percent,payments:payments,unitAmount:unit,reward:coupon?'':reward.reward,rewardKeys:coupon?[]:reward.rewardKeys,coupon:coupon};
  price.recurringTotal=price.unitAmount*price.seats;price.total=unit*price.seats*payments;price.upfront=true;
  return price;
}
function razorpayAddPeriods_(seconds,billing,count){var x=new Date(seconds*1000);if(billing==='yearly')x.setFullYear(x.getFullYear()+count);else x.setMonth(x.getMonth()+count);return Math.floor(x.getTime()/1000);}
/* Payment-method check taken when a trial mandate is authorized. Razorpay's default is ₹5 (refunded by Razorpay).
   We set our own upfront amount (default ₹1, script property RAZORPAY_TRIAL_CHECK_PAISE) and refund it ourselves
   as soon as the trial is approved. Set the property to 0 to use Razorpay's own ₹5 refundable check instead. */
function razorpayTrialCheckPaise_(currency){var v=props_().getProperty(currency==='USD'?'RAZORPAY_TRIAL_CHECK_CENTS':'RAZORPAY_TRIAL_CHECK_PAISE');var n=v===null||v===''?100:Number(v);return Number.isInteger(n)&&n>=0&&n<=500?n:100;}
function razorpayTrialOn_(){return props_().getProperty('RAZORPAY_TRIAL')!=='false'&&(props_().getProperty('TRIAL_IDENTITY_SECRET')||'').length>=32;}
/* Razorpay trials share PayPal's one-trial rule: the same email, browser or network cannot claim another trial. */
function razorpayTrialConflict_(signals,exceptId,usedOnly){
  return razorpayRows_().some(function(r){
    if(r.id===exceptId||r.mode!==razorpayMode_()||!r.trial||!r.price||r.price.offer!=='trial')return false;
    var pending=!r.accepted&&['creating','created'].indexOf(r.state)>=0&&Date.now()-r.createdAt<1800000;
    if(usedOnly&&!r.trialUsedAt||!r.trialUsedAt&&!pending)return false;
    // A buyer's own unfinished (cancelled, failed or abandoned) trial checkout never blocks them from trying again.
    if(!r.trialUsedAt&&signals.emailHash&&r.trial.emailHash===signals.emailHash)return false;
    return ['emailHash','deviceHash','ipHash'].some(function(k){return !!signals[k]&&!!r.trial[k]&&signals[k]===r.trial[k];});
  });
}
function razorpayTrialUsedByEmail_(email){return razorpayRows_().some(function(r){return r.mode===razorpayMode_()&&r.email===email&&!!r.trialUsedAt;});}
function razorpayTrialCheck_(d,email,exceptId){
  var signals=commerceSignals_(d,email);
  if(commerceHistoricalTrial_(email)||commerceConflict_(signals,exceptId||'',true))throw commerceError_('trial_used','4-day trial already claimed. You can continue with a paid subscription.');
  if(!signals.ipHash)throw commerceError_('network_unverified','Your network could not be verified for a trial. Please try again.');
  if(!signals.deviceHash)throw commerceError_('browser_unverified','Allow site storage to verify this browser for a trial.');
  if(commerceConflict_(signals,exceptId||''))throw commerceError_('trial_reserved','A trial checkout is already in progress for this browser or network. Resume it or try again in 30 minutes.');
  return signals;
}
function razorpayTable_(){var ss=SpreadsheetApp.getActiveSpreadsheet(),sheet=ss.getSheetByName('RazorpayCheckouts');if(!sheet){sheet=ss.insertSheet('RazorpayCheckouts');sheet.appendRow(['Checkout ID','Verified email','Mode','Record']);sheet.setFrozenRows(1);}return sheet;}
function razorpayRows_(){var ss=SpreadsheetApp.getActiveSpreadsheet(),sheet=ss.getSheetByName('RazorpayCheckouts');if(!sheet||sheet.getLastRow()<2)return [];return sheet.getRange(2,1,sheet.getLastRow()-1,4).getValues().map(function(r){return JSON.parse(r[3]);});}
function razorpayWrite_(record){var sheet=razorpayTable_(),ids=sheet.getLastRow()>1?sheet.getRange(2,1,sheet.getLastRow()-1,1).getValues():[],index=ids.findIndex(function(r){return r[0]===record.id;}),row=[record.id,'email:'+record.email,record.mode,JSON.stringify(record)];if(index<0)sheet.appendRow(row);else sheet.getRange(index+2,1,1,4).setValues([row]);}
function razorpayFind_(id){return razorpayRows_().find(function(r){return r.id===id&&r.mode===razorpayMode_();});}
function razorpayPublic_(record){return {ok:true,checkoutId:record.id,subscriptionId:record.subscriptionId,url:record.url,pricing:record.price,accepted:!!record.accepted&&!record.accessRevoked&&record.paidThrough>Date.now()/1000,email:record.email,plan:record.price.plan,billing:record.price.billing,seats:record.price.seats,offer:record.price.offer==='trial'?'trial':'standard',trialEndsAt:record.trialEndsAt?new Date(record.trialEndsAt*1000).toISOString():'',provider:'razorpay'};}
function razorpayCheckout_(d,who){
  var price=razorpayDiscount_(razorpaySelection_(d,who),d,who);
  if(!/^[-a-f0-9]{36}$/i.test(d.requestId||''))throw commerceError_('selection','Invalid checkout request.');
  if(d.expectedTotal!==price.total)throw commerceError_('price_changed','Your price changed. Review the updated total before paying.');
  return commerceLock_(function(){
    var mine=razorpayRows_().filter(function(r){return r.mode===razorpayMode_()&&r.email===who.email;});
    var prior=mine.find(function(r){return r.requestId===d.requestId;})||mine.find(function(r){return !r.accepted&&['creating','created'].indexOf(r.state)>=0&&Date.now()-r.createdAt<1800000&&JSON.stringify(r.price)===JSON.stringify(price);});
    var signals=price.offer==='trial'?razorpayTrialCheck_(d,who.email,prior?prior.id:''):null;
    var records=razorpayRows_().filter(function(r){return r.mode===razorpayMode_()&&r.email===who.email;}),record=records.find(function(r){return r.requestId===d.requestId;});
    if(record&&JSON.stringify(record.price)!==JSON.stringify(price))throw commerceError_('selection','This request belongs to a different selection. Refresh checkout.');
    if(!record)record=records.find(function(r){return !r.accepted&&['expired','cancelled','reset','blocked'].indexOf(r.state)<0&&Date.now()-r.createdAt<1800000&&JSON.stringify(r.price)===JSON.stringify(price);});
    if(record&&record.subscriptionId)return razorpayPublic_(record);
    // If creation timed out, never issue another subscription blindly. Find the
    // original by its private checkout note, or leave it for owner reconciliation.
    if(record){
      for(var skip=0;skip<500;skip+=100){
        var page=razorpayApi_('/subscriptions?count=100&skip='+skip),items=page.items;
        if(!Array.isArray(items))throw commerceError_('provider','Subscription history could not be checked.');
        var recovered=items.find(function(s){return s.notes&&s.notes.checkout_id===record.id;});
        if(recovered){record.subscriptionId=recovered.id;record.url=razorpayUrl_(recovered.short_url);record.state='created';razorpayWrite_(record);return razorpayPublic_(record);}
        if(items.length<100)break;
      }
      throw commerceError_('provider_pending','Your previous checkout is being reconciled. Contact support before starting another subscription.');
    }
    record={id:Utilities.getUuid(),requestId:d.requestId,email:who.email,mode:razorpayMode_(),price:price,createdAt:Date.now(),state:'creating',name:clip_(d.name,80),company:clip_(d.company,80),accepted:false};
    if(signals)record.trial=signals;
    razorpayWrite_(record);
    var body={plan_id:price.planId,quantity:price.seats,total_count:price.billing==='yearly'?10:100,customer_notify:1,notify_info:{notify_email:who.email},expire_by:Math.floor(Date.now()/1000)+1800,notes:{checkout_id:record.id}};
    // Trial: the buyer authorizes the mandate now; Razorpay takes the first payment when the trial ends.
    if(price.offer==='trial'){body.start_at=Math.floor(Date.now()/1000)+price.trialDays*86400;body.notes.offer='trial';var check=razorpayTrialCheckPaise_(price.currency);if(check>0){body.addons=[{item:{name:'Payment method check (refunded automatically)',amount:check,currency:price.currency}}];record.trialCheckPaise=check;razorpayWrite_(record);}}
    // Discount: the buyer pays the discounted period(s) now; regular billing starts when they end.
    if(price.upfront){
      var n=price.discount.payments;body.start_at=razorpayAddPeriods_(Math.floor(Date.now()/1000),price.billing,n);body.notes.offer=price.discount.coupon?'coupon '+price.discount.coupon.code:'returning reward';
      body.addons=[{item:{name:'Wrapline '+planLabel_(price.plan)+' · first '+(n>1?n+' '+(price.billing==='yearly'?'years':'months'):(price.billing==='yearly'?'year':'month'))+' · '+price.discount.percent+'% off',amount:price.total,currency:price.currency}}];
    }
    var subscription=razorpayApi_('/subscriptions','post',body);
    if(!/^sub_[A-Za-z0-9]+$/.test(subscription.id||''))throw commerceError_('provider','Razorpay did not return a subscription.');
    record.subscriptionId=subscription.id;record.url=razorpayUrl_(subscription.short_url);record.state='created';razorpayWrite_(record);return razorpayPublic_(record);
  });
}
function razorpayUrl_(url){if(!/^https:\/\/(?:rzp\.io|rzp\.co)\/[A-Za-z0-9/_?=&%-]+$/.test(url||''))throw commerceError_('provider','Razorpay returned an invalid checkout link.');return url;}
function razorpayVerify_(record){
  var s=razorpayApi_('/subscriptions/'+encodeURIComponent(record.subscriptionId));
  if(s.id!==record.subscriptionId||s.plan_id!==record.price.planId||Number(s.quantity)!==record.price.seats||!s.notes||s.notes.checkout_id!==record.id)throw commerceError_('mismatch','Razorpay subscription details do not match this checkout.');
  // Plans are immutable in Razorpay, so a verified plan/price pair is cached to save a provider round trip.
  var cache=CacheService.getScriptCache(),planKey='rzp-plan:'+s.plan_id+':'+record.price.unitAmount+':'+record.price.billing;
  if(cache.get(planKey)!=='ok'){
    var plan=razorpayApi_('/plans/'+encodeURIComponent(s.plan_id));
    if(!plan.item||plan.item.currency!==(record.price.currency||'INR')||plan.item.amount!==record.price.unitAmount||plan.period!==record.price.billing||plan.interval!==1)throw commerceError_('mismatch','Razorpay billing terms do not match your confirmed price.');
    cache.put(planKey,'ok',21600);
  }
  return s;
}
function razorpayNotify_(record){
  var trial=record.price.offer==='trial'&&!record.convertedAt;
  var text='Wrapline '+planLabel_(record.price.plan)+(trial?' (4-day FREE TRIAL)':'')+' · '+record.price.billing+' · '+record.price.seats+' license(s)\nSubscription: '+record.subscriptionId+'\nVerified account: '+record.email+'\n'+(trial?'Trial ends (first charge): ':'Paid through: ')+new Date(record.paidThrough*1000).toISOString();
  if(!record.ownerNotified){MailApp.sendEmail({to:ownerEmail_(),subject:(record.mode==='test'?'[TEST] ':'')+'Wrapline Razorpay: send the license',body:text+'\n\nVerify this order and send the matching access code to the buyer.'});record.ownerNotified=true;razorpayWrite_(record);}
  if(!record.buyerNotified){MailApp.sendEmail({to:record.email,subject:(record.mode==='test'?'[TEST] ':'')+'Your Wrapline subscription is confirmed',body:text+'\n\nYour access code is sent within 12 hours. Manage future payments with Razorpay or contact support at https://imajoy.github.io/contact.html'});record.buyerNotified=true;razorpayWrite_(record);}
}
function razorpayConfirm_(id,who){
  var record=razorpayFind_(id);if(!record||who&&who.email!==record.email)throw commerceError_('checkout','This checkout does not belong to your account.');
  if(!record.subscriptionId)throw commerceError_('pending','Your checkout is still being prepared.');
  if(record.state==='reset')return {ok:true,pending:true,status:'cancelled',checkoutId:id};
  // Already verified (usually by the subscription.charged webhook): answer at once. Refunds and revocations update the record.
  if(who&&record.accepted&&!record.accessRevoked&&record.paidThrough>Date.now()/1000)return razorpayPublic_(record);
  var subscription=razorpayVerify_(record);
  if(record.price.offer==='trial'&&!record.accepted&&subscription.status==='authenticated'&&Number(subscription.start_at)>Date.now()/1000)return razorpayAcceptTrial_(record.id,subscription);
  // Authorization/activation alone is not a paid receipt. Read the provider's
  // invoice and captured payment before recording an order or issuing a license.
  var invoices=razorpayApi_('/invoices?subscription_id='+encodeURIComponent(record.subscriptionId)+'&count=100');
  if(!Array.isArray(invoices.items))throw commerceError_('provider','Your invoice could not be verified.');
  var regular=record.price.recurringTotal||record.price.total;
  var invoice=invoices.items.filter(function(i){return i.subscription_id===record.subscriptionId&&i.status==='paid'&&i.currency===(record.price.currency||'INR')&&(i.amount_paid===record.price.total||i.amount_paid===regular)&&i.payment_id&&Number(i.paid_at)>=Number(subscription.current_start)-300;}).sort(function(a,b){return b.paid_at-a.paid_at;})[0];
  if(!invoice){
    if(!record.accepted&&['cancelled','expired','completed'].indexOf(subscription.status)>=0)commerceLock_(function(){var r=razorpayFind_(id);r.state='expired';razorpayWrite_(r);});
    return record.accepted?razorpayPublic_(record):{ok:true,pending:true,status:subscription.status,checkoutId:id};
  }
  var payment=razorpayApi_('/payments/'+encodeURIComponent(invoice.payment_id));
  if(payment.id!==invoice.payment_id||payment.status!=='captured'||payment.captured!==true||payment.currency!==(record.price.currency||'INR')||payment.amount!==invoice.amount_paid||Number(payment.amount_refunded||0)>0||payment.invoice_id!==invoice.id)throw commerceError_('mismatch','Your payment is not confirmed as captured for this invoice.');
  // Up-front discounted periods run until the subscription's first regular charge (start_at).
  var periodEnd=Number.isSafeInteger(subscription.current_end)?subscription.current_end:record.price.upfront&&subscription.status==='authenticated'?Number(subscription.start_at):NaN;
  if(!Number.isSafeInteger(periodEnd)||periodEnd<=Date.now()/1000)throw commerceError_('pending','Your paid billing period is still being confirmed.');
  return commerceLock_(function(){
    var current=razorpayFind_(id),converted=current.price.offer==='trial'&&current.trialUsedAt&&!current.convertedAt;
    current.accepted=true;current.state='accepted';current.accessRevoked=false;current.providerStatus=subscription.status;current.paidThrough=periodEnd;current.paymentId=payment.id;current.invoiceId=invoice.id;
    if(current.price.offer==='trial'&&!current.convertedAt)current.convertedAt=Date.now();
    razorpayWrite_(current);
    if(converted)try{MailApp.sendEmail({to:ownerEmail_(),subject:(current.mode==='test'?'[TEST] ':'')+'Wrapline trial converted to paid: '+current.subscriptionId,body:current.email+' was charged after the 4-day trial. Paid through: '+new Date(current.paidThrough*1000).toISOString()});}catch(e){}
    var sheet=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ORDERS_SHEET);
    if(!sheet){sheet=SpreadsheetApp.getActiveSpreadsheet().insertSheet(ORDERS_SHEET);sheet.appendRow(['Time','Subscription ID','Status','Mode','Buyer email','Name','Country','Plan','Billing','Licenses','Company','Plan ID']);}
    var rows=sheet.getLastRow()>1?sheet.getRange(2,1,sheet.getLastRow()-1,2).getValues():[];
    if(!rows.some(function(r){return r[1]===current.subscriptionId;}))sheet.appendRow([new Date(),current.subscriptionId,'ACTIVE','razorpay_'+current.mode,current.email,current.name,current.price.country,current.price.plan,current.price.billing,current.price.seats,current.company,current.price.planId].map(safeSheetCell_));
    var ss=SpreadsheetApp.getActiveSpreadsheet(),receipts=ss.getSheetByName('RazorpayPayments');
    if(!receipts){receipts=ss.insertSheet('RazorpayPayments');receipts.appendRow(['Payment ID','Subscription ID','Mode','Verified email','Amount (paise)','Currency','Paid through','Invoice ID']);}
    var seen=receipts.getLastRow()>1?receipts.getRange(2,1,receipts.getLastRow()-1,1).getValues():[];
    if(!seen.some(function(r){return r[0]===payment.id;}))receipts.appendRow([payment.id,current.subscriptionId,current.mode,'email:'+current.email,payment.amount,current.price.currency||'INR',new Date(current.paidThrough*1000),invoice.id]);
    if(typeof paymentFromRazorpay_==='function')try{paymentFromRazorpay_(current,payment,'Webhook');}catch(e){Logger.log('Payments tab: '+e.message);}
    razorpayNotify_(current);
    if(current.price.discount&&current.price.discount.coupon&&typeof couponRecordUse_==='function')couponRecordUse_(couponCode_(current.price.discount.coupon.code));
    try{CacheService.getScriptCache().remove('rh:'+mode_()+':'+current.email);}catch(e){}
    return razorpayPublic_(current);
  });
}
/* Trial authorized: grant access until the trial ends. Eligibility is checked again at activation. */
function razorpayAcceptTrial_(id,subscription){
  return commerceLock_(function(){
    var current=razorpayFind_(id);
    if(current.accepted)return razorpayPublic_(current);
    var signals=current.trial||{emailHash:trialHash_('email:'+current.email)};
    if(commerceHistoricalTrial_(current.email)||commerceConflict_(signals,current.id,true)){
      try{razorpayApi_('/subscriptions/'+encodeURIComponent(current.subscriptionId)+'/cancel','post',{cancel_at_cycle_end:0});}catch(e){}
      current.state='blocked';current.providerStatus='cancelled';razorpayWrite_(current);
      throw commerceError_('trial_used','4-day trial already claimed. This trial was cancelled and you will not be charged. You can continue with a paid subscription.');
    }
    current.accepted=true;current.state='accepted';current.accessRevoked=false;current.providerStatus=subscription.status;
    current.trialEndsAt=Number(subscription.start_at);current.paidThrough=current.trialEndsAt;current.trialUsedAt=Date.now();razorpayWrite_(current);
    var sheet=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ORDERS_SHEET);
    if(!sheet){sheet=SpreadsheetApp.getActiveSpreadsheet().insertSheet(ORDERS_SHEET);sheet.appendRow(['Time','Subscription ID','Status','Mode','Buyer email','Name','Country','Plan','Billing','Licenses','Company','Plan ID']);}
    var rows=sheet.getLastRow()>1?sheet.getRange(2,1,sheet.getLastRow()-1,2).getValues():[];
    if(!rows.some(function(r){return r[1]===current.subscriptionId;}))sheet.appendRow([new Date(),current.subscriptionId,'ACTIVE','razorpay_'+current.mode,current.email,current.name,current.price.country,'online trial',current.price.billing,current.price.seats,current.company,current.price.planId].map(safeSheetCell_));
    razorpayNotify_(current);
    if(current.trialCheckPaise)razorpayRefundTrialCheck_(current);
    return razorpayPublic_(current);
  });
}
/* Refund the small payment-method check taken when the trial mandate was authorized. Safe to repeat. */
function razorpayRefundTrialCheck_(record){
  if(!record||!record.trialCheckPaise||record.trialCheckRefundId)return false;
  try{
    var invoices=razorpayApi_('/invoices?subscription_id='+encodeURIComponent(record.subscriptionId)+'&count=100');
    var check=(invoices.items||[]).filter(function(i){return i.status==='paid'&&i.payment_id&&Number(i.amount_paid)===record.trialCheckPaise;})[0];
    if(!check)return false;
    var payment=razorpayApi_('/payments/'+encodeURIComponent(check.payment_id));
    if(Number(payment.amount_refunded||0)<record.trialCheckPaise){var refund=razorpayApi_('/payments/'+encodeURIComponent(check.payment_id)+'/refund','post',{amount:record.trialCheckPaise,notes:{reason:'Trial payment-method check'}});record.trialCheckRefundId=refund.id||'refunded';}
    else record.trialCheckRefundId='refunded';
    record.trialCheckPaymentId=check.payment_id;razorpayWrite_(record);return true;
  }catch(e){if(typeof Logger!=='undefined')Logger.log('Trial check refund pending for '+record.subscriptionId+': '+e.message);return false;}
}
/* Daily safety net for checks whose refund could not be made at once. */
function razorpayRefundPendingChecks_(){var n=0;razorpayRows_().forEach(function(r){if(r.mode===razorpayMode_()&&r.accepted&&r.trialCheckPaise&&!r.trialCheckRefundId&&razorpayRefundTrialCheck_(r))n++;});return n;}
function razorpayWebhook_(d){
  var secret=props_().getProperty('RAZORPAY_WEBHOOK_SECRET')||'';
  var expected=Utilities.computeHmacSha256Signature(d.rawBody||'',secret).map(function(b){return ('0'+((b+256)%256).toString(16)).slice(-2);}).join('');
  if(secret.length<16||!constantTimeEqual_(expected,d.webhookSignature||''))throw commerceError_('signature','Invalid Razorpay webhook signature.');
  var event;try{event=JSON.parse(d.rawBody);}catch(e){throw commerceError_('invalid','Invalid webhook.');}
  var sub=event.payload&&event.payload.subscription&&event.payload.subscription.entity,id=sub&&sub.id;
  if(!id&&event.payload&&event.payload.refund){var refunded=event.payload.refund.entity;if(refunded&&refunded.payment_id){var refundPayment=razorpayApi_('/payments/'+encodeURIComponent(refunded.payment_id));if(refundPayment.invoice_id){var refundInvoice=razorpayApi_('/invoices/'+encodeURIComponent(refundPayment.invoice_id));id=refundInvoice.subscription_id;}}}
  if(!id&&event.payload&&event.payload.payment){var pay=event.payload.payment.entity;if(pay&&pay.invoice_id){var invoice=razorpayApi_('/invoices/'+encodeURIComponent(pay.invoice_id));id=invoice.subscription_id;}}
  var record=razorpayRows_().find(function(r){return r.mode===razorpayMode_()&&r.subscriptionId===id;});
  if(!record)return {ok:true,ignored:true};
  // Fetch current provider state, including on duplicate/out-of-order events.
  var current=razorpayVerify_(record);
  commerceLock_(function(){var r=razorpayFind_(record.id);r.providerStatus=current.status;razorpayWrite_(r);});
  if(event.event==='refund.processed'){
    var refund=event.payload&&event.payload.refund&&event.payload.refund.entity;
    if(refund&&refund.payment_id&&typeof paymentRefund_==='function')paymentRefund_(refund.payment_id);
    if(refund&&refund.payment_id===record.paymentId){var paid=razorpayApi_('/payments/'+encodeURIComponent(record.paymentId));if(Number(paid.amount_refunded)>0)commerceLock_(function(){var r=razorpayFind_(record.id);r.paidThrough=0;r.accessRevoked=true;r.providerStatus='refunded';razorpayWrite_(r);});}
  }
  if(event.event==='subscription.charged'||event.event==='payment.captured'||event.event==='subscription.authenticated'&&(record.price.offer==='trial'||record.price.upfront))return razorpayConfirm_(record.id,null);
  return {ok:true};
}
function constantTimeEqual_(a,b){if(a.length!==b.length)return false;var x=0;for(var i=0;i<a.length;i++)x|=a.charCodeAt(i)^b.charCodeAt(i);return x===0;}
function handleRazorpay_(d){
  if(d.operation==='config'){
    var catalog=razorpayCatalog_(),ready=['india','high','mid','low'].every(function(t){return ['online','offline'].every(function(k){return ['monthly','yearly'].every(function(b){return /^plan_[A-Za-z0-9]+$/.test(catalog[t]&&catalog[t][k]&&catalog[t][k][b]||'');});});});
    var keyId=props_().getProperty('RAZORPAY_KEY_ID')||'';
    return {ok:true,enabled:razorpayEnabled_()&&ready&&catalog._priceVersion===PRICE_VERSION,countries:razorpayAllCountries_()?['*']:razorpayCountries_(),closedCountries:razorpayAllCountries_()?razorpayClosed_():[],mode:razorpayMode_(),currency:'INR',trial:razorpayTrialOn_(),trialDays:RAZORPAY_TRIAL_DAYS_,trialCheckPaise:razorpayTrialCheckPaise_('INR'),trialCheckCents:razorpayTrialCheckPaise_('USD'),intlCurrency:razorpayCurrencyFor_('US',catalog),promotions:true,keyId:/^rzp_(test|live)_[A-Za-z0-9]+$/.test(keyId)?keyId:''};
  }
  if(props_().getProperty('COMMERCE_ENABLED')!=='true'||!razorpayConnected_())throw commerceError_('unavailable','Razorpay is not connected.');
  if(d.operation==='webhook')return razorpayWebhook_(d);
  var who=commerceWho_(d.accountToken);
  if(d.operation==='confirm')return razorpayConfirm_(d.checkoutId,who);
  if(d.operation==='cancel')return razorpayAbandon_(d.checkoutId,who);
  if(d.operation==='stop')return razorpayStopRenewal_(d.checkoutId,who);
  if(['quote','checkout'].indexOf(d.operation)>=0){
      if(typeof billingApply_!=='function'&&(d.billingNetwork||props_().getProperty('BILLING_POLICY_ENABLED')==='true'))throw commerceError_('unavailable','The billing protection module needs updating.');
      if(typeof billingApply_==='function')billingApply_(d,who);
    }
  if(!razorpayEnabled_())throw commerceError_('unavailable','Razorpay subscriptions are not activated yet.');
  if(d.operation==='quote'){var price=razorpayDiscount_(razorpaySelection_(d,who),d,who);delete price.planId;return {ok:true,pricing:price};}
  if(d.operation==='checkout')return razorpayCheckout_(d,who);
  throw commerceError_('action','Unknown Razorpay operation.');
}
function razorpaySubscriptions_(email,onlySub){
  var list=razorpayRows_().filter(function(r){return r.mode===razorpayMode_()&&r.email===email&&r.accepted&&(!onlySub||r.subscriptionId===onlySub);}).slice(-5).reverse();
  return list.map(function(r){
    var item={plan:r.price.plan,billing:r.price.billing,seats:r.price.seats,trial:r.price.offer==='trial'&&!r.convertedAt&&r.trialEndsAt>Date.now()/1000,status:'UNKNOWN',endsAt:r.paidThrough?new Date(r.paidThrough*1000).toISOString():'',renews:false,provider:'razorpay',ref:r.id,_orderTime:r.createdAt};
    try{var s=razorpayVerify_(r);var live=s.status==='active'||s.status==='authenticated'&&(r.price.offer==='trial'||r.price.upfront);item.status=r.accessRevoked?'EXPIRED':live?'ACTIVE':['cancelled','completed','expired'].indexOf(s.status)>=0?'CANCELLED':'SUSPENDED';item.renews=live&&!r.accessRevoked&&!r.stopRequested&&!s.ended_at;}catch(e){}
    return item;
  });
}
/* Run once per mode, with checkout disabled until plans/webhooks have been tested. */
/* Owner tool for TEST mode only. Run it from the Apps Script editor to make a test account look new again:
   cancels that account's test Razorpay subscriptions and removes them from the account and the Orders tab.
   Change TEST_EMAIL below if you test with another address. Live-mode records are never touched. */
function resetTestPurchases(){
  var TEST_EMAIL='';  // leave empty to use the Google account that runs this script
  var email=String(TEST_EMAIL||Session.getEffectiveUser().getEmail()||'').trim().toLowerCase();
  if(razorpayMode_()!=='test')throw new Error('Razorpay is in LIVE mode. This reset only works in test mode.');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))throw new Error('Set TEST_EMAIL to your test email address.');
  var mine=razorpayRows_().filter(function(r){return r.mode==='test'&&r.email===email&&r.state!=='reset';}),cancelled=0;
  mine.forEach(function(r){
    if(r.subscriptionId){try{var sub=razorpayApi_('/subscriptions/'+encodeURIComponent(r.subscriptionId));if(['created','authenticated','active','pending','halted'].indexOf(sub.status)>=0){razorpayApi_('/subscriptions/'+encodeURIComponent(r.subscriptionId)+'/cancel','post',{cancel_at_cycle_end:0});cancelled++;}}catch(e){Logger.log('Could not cancel '+r.subscriptionId+': '+e.message);}}
    commerceLock_(function(){var current=razorpayFind_(r.id);current.state='reset';current.accepted=false;current.accessRevoked=true;current.paidThrough=0;razorpayWrite_(current);});
  });
  var sheet=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ORDERS_SHEET),removed=0;
  if(sheet&&sheet.getLastRow()>1){
    var rows=sheet.getRange(2,1,sheet.getLastRow()-1,5).getValues();
    for(var i=rows.length-1;i>=0;i--)if(rows[i][3]==='razorpay_test'&&String(rows[i][4]).trim().toLowerCase()===email){sheet.deleteRow(i+2);removed++;}
  }
  var note='Test reset for '+email+': '+mine.length+' test checkout(s) cleared, '+cancelled+' Razorpay test subscription(s) cancelled, '+removed+' Orders row(s) removed. Sign out and back in on the site to see a fresh account.';
  Logger.log(note);return note;
}
function setupRazorpayPlans(){
  var catalog=razorpayCatalog_();
  if(catalog._priceVersion!==PRICE_VERSION){
    props_().setProperty('RAZORPAY_PLANS_HISTORY_'+razorpayMode_(),JSON.stringify(catalog));
    catalog={_priceVersion:PRICE_VERSION};
    props_().setProperty('RAZORPAY_PLANS_'+razorpayMode_(),JSON.stringify(catalog));
  }
  var intl=razorpayIntlCurrency_();
  if((catalog._intlCurrency||'INR')!==intl){
    // Build every new international plan first; the working plans are replaced only when all exist,
    // so a refused currency never leaves checkout without plans. Re-running resumes where it stopped.
    var stageKey='RAZORPAY_PLANS_STAGED_'+razorpayMode_(),staged=JSON.parse(props_().getProperty(stageKey)||'{}');
    if(staged._currency!==intl||staged._priceVersion!==PRICE_VERSION)staged={_currency:intl,_priceVersion:PRICE_VERSION};
    ['high','mid','low'].forEach(function(tier){staged[tier]=staged[tier]||{};['online','offline'].forEach(function(kind){staged[tier][kind]=staged[tier][kind]||{};['monthly','yearly','yearlyFull'].forEach(function(billing){
      if(staged[tier][kind][billing])return;
      var country={high:'US',mid:'BR',low:'LK'}[tier],period=billing==='yearlyFull'?'yearly':billing,price=razorpayPrice_(kind,period,country,intl,billing==='yearlyFull'),plan;
      try{plan=razorpayApi_('/plans','post',{period:period,interval:1,item:{name:'Wrapline '+planLabel_(kind)+' '+billing+' ('+tier+', '+intl+')',amount:price.unitAmount,currency:price.currency},notes:{product:'wrapline',tier:tier}});}
      catch(e){throw new Error('Razorpay refused a '+intl+' plan. Turn on international payments / multi-currency in your Razorpay account, then run setupRazorpayPlans again. Your current plans keep working.');}
      if(!/^plan_[A-Za-z0-9]+$/.test(plan.id||''))throw new Error('Razorpay did not return a plan ID.');
      staged[tier][kind][billing]=plan.id;props_().setProperty(stageKey,JSON.stringify(staged));
    });});});
    props_().setProperty('RAZORPAY_PLANS_HISTORY_INTL_'+razorpayMode_(),JSON.stringify({high:catalog.high,mid:catalog.mid,low:catalog.low,currency:catalog._intlCurrency||'INR'}));
    catalog.high=staged.high;catalog.mid=staged.mid;catalog.low=staged.low;catalog._intlCurrency=intl;
    props_().setProperty('RAZORPAY_PLANS_'+razorpayMode_(),JSON.stringify(catalog));props_().deleteProperty(stageKey);
  }
  ['india','high','mid','low'].forEach(function(tier){catalog[tier]=catalog[tier]||{};['online','offline'].forEach(function(kind){catalog[tier][kind]=catalog[tier][kind]||{};['monthly','yearly','yearlyFull'].forEach(function(billing){
    if(catalog[tier][kind][billing])return;
    var country={india:'IN',high:'US',mid:'BR',low:'LK'}[tier],period=billing==='yearlyFull'?'yearly':billing,price=razorpayPrice_(kind,period,country,tier==='india'?'INR':intl,billing==='yearlyFull');
    var plan=razorpayApi_('/plans','post',{period:period,interval:1,item:{name:'Wrapline '+planLabel_(kind)+' '+billing+' ('+tier+')',amount:price.unitAmount,currency:price.currency},notes:{product:'wrapline',tier:tier}});
    if(!/^plan_[A-Za-z0-9]+$/.test(plan.id||''))throw new Error('Razorpay did not return a plan ID.');
    catalog[tier][kind][billing]=plan.id;props_().setProperty('RAZORPAY_PLANS_'+razorpayMode_(),JSON.stringify(catalog));
  });});});
  Logger.log('Razorpay '+razorpayMode_()+' plans saved (India in INR, other countries in '+intl+'). No customer subscription was created.');
}

/* Buyer closed the Razorpay window or the payment failed: end the unpaid checkout so it never lingers.
   A subscription that has already been paid is never cancelled here. */
function razorpayAbandon_(id,who){
  var record=razorpayFind_(id);
  if(!record||record.email!==who.email)throw commerceError_('checkout','This checkout does not belong to your account.');
  if(record.accepted)return razorpayPublic_(record);
  if(record.subscriptionId){
    var s=razorpayApi_('/subscriptions/'+encodeURIComponent(record.subscriptionId));
    if(s.notes&&s.notes.checkout_id!==record.id)throw commerceError_('mismatch','Razorpay subscription details do not match this checkout.');
    if(['active','authenticated'].indexOf(s.status)>=0&&s.paid_count>0||(record.price.offer==='trial'||record.price.upfront)&&s.status==='authenticated')return razorpayConfirm_(id,who);
    if(['created','authenticated','pending'].indexOf(s.status)>=0)razorpayApi_('/subscriptions/'+encodeURIComponent(record.subscriptionId)+'/cancel','post',{cancel_at_cycle_end:0});
  }
  commerceLock_(function(){var r=razorpayFind_(id);r.state='cancelled';r.providerStatus='cancelled';razorpayWrite_(r);});
  return {ok:true,cancelled:true,checkoutId:id};
}
/* Subscriber stops future renewals. Access continues until the end of the period already paid for. */
function razorpayStopRenewal_(id,who){
  var record=razorpayFind_(id);
  if(!record||record.email!==who.email||!record.accepted)throw commerceError_('checkout','This subscription does not belong to your account.');
  var s=razorpayVerify_(record);
  if(s.status==='active'&&!record.stopRequested)razorpayApi_('/subscriptions/'+encodeURIComponent(record.subscriptionId)+'/cancel','post',{cancel_at_cycle_end:1});
  else if(s.status==='authenticated'&&!record.stopRequested)razorpayApi_('/subscriptions/'+encodeURIComponent(record.subscriptionId)+'/cancel','post',{cancel_at_cycle_end:0});
  commerceLock_(function(){var r=razorpayFind_(id);r.stopRequested=true;razorpayWrite_(r);});
  try{MailApp.sendEmail({to:ownerEmail_(),name:'Wrapline orders',subject:'Renewal stopped: '+record.subscriptionId,body:who.email+' stopped renewal of their Wrapline '+record.price.plan+' '+record.price.billing+' subscription ('+record.subscriptionId+'). Access continues until '+(record.paidThrough?new Date(record.paidThrough*1000).toDateString():'the end of the paid period')+'.'});}catch(e){}
  return {ok:true,stopped:true,endsAt:record.paidThrough?new Date(record.paidThrough*1000).toISOString():''};
}
