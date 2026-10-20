/* Razorpay recurring INR subscriptions. All calls arrive inside the signed commerce RPC.
   Separate enablement, mode and allowlist preserve the working PayPal integration. */
function razorpayMode_(){return props_().getProperty('RAZORPAY_MODE')==='live'?'live':'test';}
function razorpayCountries_(){
  return (props_().getProperty('RAZORPAY_ALLOWED_COUNTRIES')||'IN').toUpperCase().split(/[^A-Z]+/).filter(function(c){return /^[A-Z]{2}$/.test(c)&&(c==='IN'||CLOSED_.indexOf(c)<0);});
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
function razorpayPrice_(plan,billing,country){
  var monthly=(country==='IN'?899:{low:899,mid:1399,high:1999}[tierFor_(country)])*(plan==='offline'?2:1)*100;
  return {currency:'INR',unitAmount:billing==='yearly'?Math.round(monthly*12*.8):monthly,monthlyAmount:monthly,compareAtUnitAmount:billing==='yearly'?monthly*12:monthly};
}
function razorpaySelection_(d){
  if(!razorpayEnabled_())throw commerceError_('unavailable','Razorpay subscriptions are not activated yet.');
  if(['online','offline'].indexOf(d.plan)<0||['monthly','yearly'].indexOf(d.billing)<0||!Number.isInteger(d.seats)||d.seats<1||d.seats>100)throw commerceError_('selection','Review your plan and license quantity.');
  if(d.sandboxCountry&&razorpayMode_()!=='test')throw commerceError_('region','Test country settings cannot be used for live payments.');
  var country=d.sandboxCountry||d.country;
  if(razorpayCountries_().indexOf(country)<0||country!==d.billingCountry)throw commerceError_('region','Razorpay is not available for your verified billing country.');
  var key=country==='IN'?'india':tierFor_(country),catalog=razorpayCatalog_(),planId=catalog[key]&&catalog[key][d.plan]&&catalog[key][d.plan][d.billing];
  if(!/^plan_[A-Za-z0-9]+$/.test(planId||''))throw commerceError_('unavailable','This Razorpay subscription plan is not configured yet.');
  var price=razorpayPrice_(d.plan,d.billing,country);price.total=price.unitAmount*d.seats;price.plan=d.plan;price.billing=d.billing;price.seats=d.seats;price.country=country;price.planId=planId;
  return price;
}
function razorpayTable_(){var ss=SpreadsheetApp.getActiveSpreadsheet(),sheet=ss.getSheetByName('RazorpayCheckouts');if(!sheet){sheet=ss.insertSheet('RazorpayCheckouts');sheet.appendRow(['Checkout ID','Verified email','Mode','Record']);sheet.setFrozenRows(1);}return sheet;}
function razorpayRows_(){var ss=SpreadsheetApp.getActiveSpreadsheet(),sheet=ss.getSheetByName('RazorpayCheckouts');if(!sheet||sheet.getLastRow()<2)return [];return sheet.getRange(2,1,sheet.getLastRow()-1,4).getValues().map(function(r){return JSON.parse(r[3]);});}
function razorpayWrite_(record){var sheet=razorpayTable_(),ids=sheet.getLastRow()>1?sheet.getRange(2,1,sheet.getLastRow()-1,1).getValues():[],index=ids.findIndex(function(r){return r[0]===record.id;}),row=[record.id,'email:'+record.email,record.mode,JSON.stringify(record)];if(index<0)sheet.appendRow(row);else sheet.getRange(index+2,1,1,4).setValues([row]);}
function razorpayFind_(id){return razorpayRows_().find(function(r){return r.id===id&&r.mode===razorpayMode_();});}
function razorpayPublic_(record){return {ok:true,checkoutId:record.id,subscriptionId:record.subscriptionId,url:record.url,pricing:record.price,accepted:!!record.accepted&&!record.accessRevoked&&record.paidThrough>Date.now()/1000,email:record.email,plan:record.price.plan,billing:record.price.billing,seats:record.price.seats,offer:'standard',provider:'razorpay'};}
function razorpayCheckout_(d,who){
  var price=razorpaySelection_(d);
  if(!/^[-a-f0-9]{36}$/i.test(d.requestId||''))throw commerceError_('selection','Invalid checkout request.');
  if(d.expectedTotal!==price.total)throw commerceError_('price_changed','Your price changed. Review the updated total before paying.');
  return commerceLock_(function(){
    var records=razorpayRows_().filter(function(r){return r.mode===razorpayMode_()&&r.email===who.email;}),record=records.find(function(r){return r.requestId===d.requestId;});
    if(record&&JSON.stringify(record.price)!==JSON.stringify(price))throw commerceError_('selection','This request belongs to a different selection. Refresh checkout.');
    if(!record)record=records.find(function(r){return !r.accepted&&r.state!=='expired'&&r.state!=='cancelled'&&Date.now()-r.createdAt<1800000&&JSON.stringify(r.price)===JSON.stringify(price);});
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
    record={id:Utilities.getUuid(),requestId:d.requestId,email:who.email,mode:razorpayMode_(),price:price,createdAt:Date.now(),state:'creating',name:clip_(d.name,80),company:clip_(d.company,80),accepted:false};razorpayWrite_(record);
    var subscription=razorpayApi_('/subscriptions','post',{plan_id:price.planId,quantity:price.seats,total_count:price.billing==='yearly'?10:100,customer_notify:1,notify_info:{notify_email:who.email},expire_by:Math.floor(Date.now()/1000)+1800,notes:{checkout_id:record.id}});
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
    if(!plan.item||plan.item.currency!=='INR'||plan.item.amount!==record.price.unitAmount||plan.period!==record.price.billing||plan.interval!==1)throw commerceError_('mismatch','Razorpay billing terms do not match your confirmed price.');
    cache.put(planKey,'ok',21600);
  }
  return s;
}
function razorpayNotify_(record){
  var text='Wrapline '+record.price.plan+' · '+record.price.billing+' · '+record.price.seats+' license(s)\nSubscription: '+record.subscriptionId+'\nVerified account: '+record.email+'\nPaid through: '+new Date(record.paidThrough*1000).toISOString();
  if(!record.ownerNotified){MailApp.sendEmail({to:ownerEmail_(),subject:(record.mode==='test'?'[TEST] ':'')+'Wrapline Razorpay: send the license',body:text+'\n\nVerify this order and send the matching access code to the buyer.'});record.ownerNotified=true;razorpayWrite_(record);}
  if(!record.buyerNotified){MailApp.sendEmail({to:record.email,subject:(record.mode==='test'?'[TEST] ':'')+'Your Wrapline subscription is confirmed',body:text+'\n\nYour access code is sent within 12 hours. Manage future payments with Razorpay or contact support at https://imajoy.github.io/contact.html'});record.buyerNotified=true;razorpayWrite_(record);}
}
function razorpayConfirm_(id,who){
  var record=razorpayFind_(id);if(!record||who&&who.email!==record.email)throw commerceError_('checkout','This checkout does not belong to your account.');
  if(!record.subscriptionId)throw commerceError_('pending','Your checkout is still being prepared.');
  // Already verified (usually by the subscription.charged webhook): answer at once. Refunds and revocations update the record.
  if(who&&record.accepted&&!record.accessRevoked&&record.paidThrough>Date.now()/1000)return razorpayPublic_(record);
  var subscription=razorpayVerify_(record);
  // Authorization/activation alone is not a paid receipt. Read the provider's
  // invoice and captured payment before recording an order or issuing a license.
  var invoices=razorpayApi_('/invoices?subscription_id='+encodeURIComponent(record.subscriptionId)+'&count=100');
  if(!Array.isArray(invoices.items))throw commerceError_('provider','Your invoice could not be verified.');
  var invoice=invoices.items.filter(function(i){return i.subscription_id===record.subscriptionId&&i.status==='paid'&&i.currency==='INR'&&i.amount_paid===record.price.total&&i.payment_id&&Number(i.paid_at)>=Number(subscription.current_start)-300;}).sort(function(a,b){return b.paid_at-a.paid_at;})[0];
  if(!invoice){
    if(!record.accepted&&['cancelled','expired','completed'].indexOf(subscription.status)>=0)commerceLock_(function(){var r=razorpayFind_(id);r.state='expired';razorpayWrite_(r);});
    return record.accepted?razorpayPublic_(record):{ok:true,pending:true,status:subscription.status,checkoutId:id};
  }
  var payment=razorpayApi_('/payments/'+encodeURIComponent(invoice.payment_id));
  if(payment.id!==invoice.payment_id||payment.status!=='captured'||payment.captured!==true||payment.currency!=='INR'||payment.amount!==record.price.total||Number(payment.amount_refunded||0)>0||payment.invoice_id!==invoice.id)throw commerceError_('mismatch','Your payment is not confirmed as captured for this invoice.');
  if(!Number.isSafeInteger(subscription.current_end)||subscription.current_end<=Date.now()/1000)throw commerceError_('pending','Your paid billing period is still being confirmed.');
  return commerceLock_(function(){
    var current=razorpayFind_(id);current.accepted=true;current.state='accepted';current.accessRevoked=false;current.providerStatus=subscription.status;current.paidThrough=subscription.current_end;current.paymentId=payment.id;current.invoiceId=invoice.id;razorpayWrite_(current);
    var sheet=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ORDERS_SHEET);
    if(!sheet){sheet=SpreadsheetApp.getActiveSpreadsheet().insertSheet(ORDERS_SHEET);sheet.appendRow(['Time','Subscription ID','Status','Mode','Buyer email','Name','Country','Plan','Billing','Licenses','Company','Plan ID']);}
    var rows=sheet.getLastRow()>1?sheet.getRange(2,1,sheet.getLastRow()-1,2).getValues():[];
    if(!rows.some(function(r){return r[1]===current.subscriptionId;}))sheet.appendRow([new Date(),current.subscriptionId,'ACTIVE','razorpay_'+current.mode,current.email,current.name,current.price.country,current.price.plan,current.price.billing,current.price.seats,current.company,current.price.planId].map(safeSheetCell_));
    var ss=SpreadsheetApp.getActiveSpreadsheet(),receipts=ss.getSheetByName('RazorpayPayments');
    if(!receipts){receipts=ss.insertSheet('RazorpayPayments');receipts.appendRow(['Payment ID','Subscription ID','Mode','Verified email','Amount (paise)','Currency','Paid through','Invoice ID']);}
    var seen=receipts.getLastRow()>1?receipts.getRange(2,1,receipts.getLastRow()-1,1).getValues():[];
    if(!seen.some(function(r){return r[0]===payment.id;}))receipts.appendRow([payment.id,current.subscriptionId,current.mode,'email:'+current.email,payment.amount,'INR',new Date(current.paidThrough*1000),invoice.id]);
    razorpayNotify_(current);return razorpayPublic_(current);
  });
}
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
    if(refund&&refund.payment_id===record.paymentId){var paid=razorpayApi_('/payments/'+encodeURIComponent(record.paymentId));if(Number(paid.amount_refunded)>0)commerceLock_(function(){var r=razorpayFind_(record.id);r.paidThrough=0;r.accessRevoked=true;r.providerStatus='refunded';razorpayWrite_(r);});}
  }
  if(event.event==='subscription.charged'||event.event==='payment.captured')return razorpayConfirm_(record.id,null);
  return {ok:true};
}
function constantTimeEqual_(a,b){if(a.length!==b.length)return false;var x=0;for(var i=0;i<a.length;i++)x|=a.charCodeAt(i)^b.charCodeAt(i);return x===0;}
function handleRazorpay_(d){
  if(d.operation==='config'){
    var catalog=razorpayCatalog_(),ready=['india','high','mid','low'].every(function(t){return ['online','offline'].every(function(k){return ['monthly','yearly'].every(function(b){return /^plan_[A-Za-z0-9]+$/.test(catalog[t]&&catalog[t][k]&&catalog[t][k][b]||'');});});});
    var keyId=props_().getProperty('RAZORPAY_KEY_ID')||'';
    return {ok:true,enabled:razorpayEnabled_()&&ready,countries:razorpayCountries_(),mode:razorpayMode_(),currency:'INR',trial:false,promotions:false,keyId:/^rzp_(test|live)_[A-Za-z0-9]+$/.test(keyId)?keyId:''};
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
  if(d.operation==='quote'){var price=razorpaySelection_(d);delete price.planId;return {ok:true,pricing:price};}
  if(d.operation==='checkout')return razorpayCheckout_(d,who);
  throw commerceError_('action','Unknown Razorpay operation.');
}
function razorpaySubscriptions_(email,onlySub){
  var list=razorpayRows_().filter(function(r){return r.mode===razorpayMode_()&&r.email===email&&r.accepted&&(!onlySub||r.subscriptionId===onlySub);}).slice(-5).reverse();
  return list.map(function(r){
    var item={plan:r.price.plan,billing:r.price.billing,seats:r.price.seats,trial:false,status:'UNKNOWN',endsAt:r.paidThrough?new Date(r.paidThrough*1000).toISOString():'',renews:false,provider:'razorpay',ref:r.id,_orderTime:r.createdAt};
    try{var s=razorpayVerify_(r);item.status=r.accessRevoked?'EXPIRED':s.status==='active'?'ACTIVE':['cancelled','completed','expired'].indexOf(s.status)>=0?'CANCELLED':'SUSPENDED';item.renews=s.status==='active'&&!r.accessRevoked&&!r.stopRequested&&!s.ended_at&&s.status!=='cancelled';}catch(e){}
    return item;
  });
}
/* Run once per mode, with checkout disabled until plans/webhooks have been tested. */
function setupRazorpayPlans(){
  var catalog=razorpayCatalog_();
  ['india','high','mid','low'].forEach(function(tier){catalog[tier]=catalog[tier]||{};['online','offline'].forEach(function(kind){catalog[tier][kind]=catalog[tier][kind]||{};['monthly','yearly'].forEach(function(billing){
    if(catalog[tier][kind][billing])return;
    var country={india:'IN',high:'US',mid:'BR',low:'LK'}[tier],price=razorpayPrice_(kind,billing,country);
    var plan=razorpayApi_('/plans','post',{period:billing,interval:1,item:{name:'Wrapline '+kind+' '+billing+' ('+tier+')',amount:price.unitAmount,currency:'INR'},notes:{product:'wrapline',tier:tier}});
    if(!/^plan_[A-Za-z0-9]+$/.test(plan.id||''))throw new Error('Razorpay did not return a plan ID.');
    catalog[tier][kind][billing]=plan.id;props_().setProperty('RAZORPAY_PLANS_'+razorpayMode_(),JSON.stringify(catalog));
  });});});
  Logger.log('Razorpay '+razorpayMode_()+' plans saved. No customer subscription was created.');
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
    if(['active','authenticated'].indexOf(s.status)>=0&&s.paid_count>0)return razorpayConfirm_(id,who);
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
  commerceLock_(function(){var r=razorpayFind_(id);r.stopRequested=true;razorpayWrite_(r);});
  try{MailApp.sendEmail({to:ownerEmail_(),name:'Wrapline orders',subject:'Renewal stopped: '+record.subscriptionId,body:who.email+' stopped renewal of their Wrapline '+record.price.plan+' '+record.price.billing+' subscription ('+record.subscriptionId+'). Access continues until '+(record.paidThrough?new Date(record.paidThrough*1000).toDateString():'the end of the paid period')+'.'});}catch(e){}
  return {ok:true,stopped:true,endsAt:record.paidThrough?new Date(record.paidThrough*1000).toISOString():''};
}
