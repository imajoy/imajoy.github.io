/* Private commerce RPC. Deploy alongside Code.gs. PayPal credentials remain Script properties. */
var CHECKOUT_HEADERS_ = ['Checkout ID','Mode','Verified email','Email hash','Browser hash','IP hash','Offer','Plan','Billing','Licenses','PayPal plan ID','Subscription ID','State','Created at','Updated at','Payer hash','Order recorded','Request ID','Country','Buyer details','Trial used at','Provider status'];
function commerceError_(code,message) { var e = new Error(message); e.code = code; return e; }
function commerceHash_(text) {
  var secret = props_().getProperty('COMMERCE_SECRET') || '';
  if (secret.length < 32) throw commerceError_('unavailable','Commerce signing is not configured.');
  return Utilities.computeHmacSha256Signature(text,secret).map(function(b){return ('0'+((b+256)%256).toString(16)).slice(-2);}).join('');
}
function trialHash_(text) {
  var key=props_().getProperty('TRIAL_IDENTITY_SECRET')||'';
  if(key.length<32)throw commerceError_('unavailable','Trial identity checks are not configured.');
  return Utilities.computeHmacSha256Signature(text,key).map(function(b){return ('0'+((b+256)%256).toString(16)).slice(-2);}).join('');
}
function commerceLock_(fn) {
  var lock=LockService.getScriptLock();if(!lock.tryLock(10000))throw commerceError_('busy','Another request is updating your account. Please retry.');
  try{return fn();}finally{lock.releaseLock();}
}
function commerceTable_() {
  var ss=SpreadsheetApp.getActiveSpreadsheet(),sheet=ss.getSheetByName('Checkouts');
  if(!sheet){sheet=ss.insertSheet('Checkouts');sheet.appendRow(CHECKOUT_HEADERS_);sheet.setFrozenRows(1);}
  return sheet;
}
function commerceRows_() {var s=commerceTable_();return s.getLastRow()>1?s.getRange(2,1,s.getLastRow()-1,CHECKOUT_HEADERS_.length).getValues():[];}
function commerceWrite_(row) {
  var sheet=commerceTable_(),rows=commerceRows_(),index=rows.findIndex(function(r){return r[0]===row[0];});
  var cells=row.map(safeSheetCell_);
  if(index<0)sheet.appendRow(cells);else sheet.getRange(index+2,1,1,CHECKOUT_HEADERS_.length).setValues([cells]);
}
function commerceFind_(id) {return commerceRows_().filter(function(r){return r[0]===id&&r[1]===mode_();})[0]||null;}
function commerceWho_(token) {
  var who=readSession_(token);
  if(!who||!registeredEmail_(who.email))throw commerceError_('signin_required','Sign in or register and verify your email first.');
  return who;
}
function commercePaypal_(path,method,body,id) {
  var token=token_();if(!token)throw commerceError_('unavailable','PayPal is not connected.');
  var options={method:method||'get',muteHttpExceptions:true,headers:{Authorization:'Bearer '+token,Prefer:'return=representation'}};
  if(id)options.headers['PayPal-Request-Id']=id;
  if(body){options.contentType='application/json';options.payload=JSON.stringify(body);}
  var response=UrlFetchApp.fetch(base_()+path,options),status=response.getResponseCode();
  if(status<200||status>299){
    var failure={};try{var decoded=JSON.parse(response.getContentText());if(decoded&&typeof decoded==='object')failure=decoded;}catch(e){}
    var rawIssue=failure.details&&failure.details[0]&&failure.details[0].issue||failure.name||'',issue=typeof rawIssue==='string'&&/^[A-Z][A-Z0-9_]{0,79}$/.test(rawIssue)?rawIssue:'';
    var read=String(options.method).toLowerCase()==='get',subject=path.indexOf('/transactions?')>=0?'payment history':'subscription details';
    var message=read?'PayPal could not verify your '+subject+' (HTTP '+status+(issue?', '+issue:'')+'). Please retry or contact support.':'PayPal could not complete the request. Please retry; do not approve another checkout.';
    if(typeof Logger!=='undefined')Logger.log(JSON.stringify({event:'paypal_request_failed',status:status,issue:issue,read:read}));
    var error=commerceError_('provider',message);error.providerStatus=status;error.providerIssue=issue;throw error;
  }
  var text=response.getContentText();return text?JSON.parse(text):{};
}
function commerceHistoricalTrial_(email) {
  if(typeof razorpayTrialUsedByEmail_==='function'&&razorpayTrialUsedByEmail_(email))return true;
  var sheet=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ORDERS_SHEET);
  if(!sheet||sheet.getLastRow()<2)return false;
  return sheet.getRange(2,1,sheet.getLastRow()-1,12).getValues().some(function(r){return r[3]===mode_()&&String(r[4]).toLowerCase()===email&&(['ACTIVE','APPROVED'].indexOf(r[2])>=0)&&(String(r[7]).indexOf('trial')>=0||isTrialPlan_(String(r[11])));});
}
function commerceConflict_(signals,exceptId,usedOnly) {
  if(typeof razorpayTrialConflict_==='function'&&razorpayTrialConflict_(signals,exceptId,usedOnly))return true;
  return commerceRows_().some(function(r){
    if(r[0]===exceptId||r[1]!==mode_()||r[6]!=='trial')return false;
    var pending=['reserved','created'].indexOf(r[12])>=0&&Date.now()-new Date(r[13]).getTime()<1800000;
    if(usedOnly&&!r[20]||!r[20]&&!pending)return false;
    return [[3,'emailHash'],[4,'deviceHash'],[5,'ipHash'],[15,'payerHash']].some(function(pair){return !!signals[pair[1]]&&!!r[pair[0]]&&signals[pair[1]]===r[pair[0]];});
  });
}
function commerceSignals_(d,email) {
  if(d.deviceHash&&!/^[a-f0-9]{64}$/.test(d.deviceHash)||d.ipHash&&!/^[a-f0-9]{64}$/.test(d.ipHash))throw commerceError_('signals','Browser eligibility could not be verified.');
  return {emailHash:trialHash_('email:'+email),deviceHash:d.deviceHash||'',ipHash:d.ipHash||''};
}
function commerceEligibility_(d,who) {
  var signals=commerceSignals_(d,who.email);
  var own=commerceRows_().filter(function(r){return r[1]===mode_()&&r[2]===who.email&&r[6]==='trial'&&['reserved','created'].indexOf(r[12])>=0&&r[4]===signals.deviceHash&&r[5]===signals.ipHash&&Date.now()-new Date(r[13]).getTime()<1800000;})[0];
  var claimed=commerceHistoricalTrial_(who.email)||commerceConflict_(signals,'',true);
  var reason=claimed?'trial_used':!signals.ipHash?'network_unverified':!signals.deviceHash?'browser_unverified':commerceConflict_(signals,own?own[0]:'')?'trial_reserved':'eligible';
  var messages={trial_used:'2-day trial already claimed. You can continue with a paid subscription.',trial_reserved:'A trial checkout is already in progress for this browser or network. Resume it or try again after its reservation expires.',network_unverified:'Trial eligibility requires a verified network. Standard subscriptions remain available once your location is confirmed.',browser_unverified:'Trial eligibility requires a saved browser identifier. Allow site storage and try again.',eligible:'Trial eligibility is checked again when PayPal approves your account.'};
  return {ok:true,rewardsVersion:1,eligible:reason==='eligible',reason:reason,message:messages[reason]};
}
function commercePlan_(plan,billing,country,offer) {
  var noPaypal='AF BD NP PK MM ET ZW BI CF TD KM CG CD DJ ER GQ GW IQ LY SO SS SD YE LS LR ML MR NE SL ST BT GN HT TJ TM UZ VE TL KI NR TV PW MH FM SB VU WS TO PG SR'.split(' ');
  if(!/^[A-Z]{2}$/.test(country||'')||CLOSED_.indexOf(country)>=0||noPaypal.indexOf(country)>=0)throw commerceError_('region','Subscriptions are not currently available for this location.');
  var saved=JSON.parse(props_().getProperty('PLANS_'+mode_())||'{}'),tier=tierFor_(country),group=saved.tiers&&saved.tiers[tier];
  if(saved.priceVersion!==PRICE_VERSION)throw commerceError_('unavailable','Subscription plans are being updated. Please try again shortly.');
  var id=group&&group[offer==='trial'?'onlineTrial':plan]&&group[offer==='trial'?'onlineTrial':plan][billing];
  if(!id)throw commerceError_('unavailable','This subscription is not configured yet.');
  return id;
}
function commerceCreate_(d,who) {
  if(['online','offline'].indexOf(d.plan)<0||['monthly','yearly'].indexOf(d.billing)<0||['trial','standard'].indexOf(d.offer)<0||!Number.isInteger(d.seats)||d.seats<1||d.seats>100||!/^[-a-f0-9]{36}$/i.test(d.requestId||''))throw commerceError_('selection','Review your plan and quantity.');
  if(d.offer==='trial'&&d.plan!=='online')throw commerceError_('selection','Only Online plans offer a trial.');
  var checkoutCountry=d.country;
  if(d.sandboxCountry){
    if(props_().getProperty('PAYPAL_MODE')!=='sandbox')throw commerceError_('unavailable','A Sandbox country simulation requires PAYPAL_MODE=sandbox in Apps Script and cannot use Live merchant settings.');
    if(!/^[A-Z]{2}$/.test(d.sandboxCountry))throw commerceError_('selection','Invalid Sandbox test country.');
    checkoutCountry=d.sandboxCountry;
  }
  if(d.billingCountry&&tierFor_(d.billingCountry)!==tierFor_(checkoutCountry))throw commerceError_('region','Your billing country and detected price region differ. Review your country before subscribing.');
  if(!/^[A-Z]{2}$/.test(checkoutCountry||''))throw commerceError_('network_unverified','Your network location could not be verified. Please retry or contact support.');
  var planId=commercePlan_(d.plan,d.billing,checkoutCountry,d.offer),signals=commerceSignals_(d,who.email);
  var prior=rewardPending_(d,who);
  var history=!prior&&d.offer==='standard'?rewardHistory_(who.email):null;
  var pricing=prior?rewardBuyer_(prior).loyalty:d.offer==='standard'?couponApply_(rewardQuote_(d,who,history),d,who.email):null;
  if(!prior&&pricing&&(d.expectedTotal!==undefined&&d.expectedTotal!==pricing.total||d.expectedRewardPercent!==undefined&&d.expectedRewardPercent!==pricing.percent)){
    try{CacheService.getScriptCache().remove('rh:'+mode_()+':'+who.email);}catch(e){}
    throw commerceError_('price_changed','Your payment history or price changed. Refresh your reward and review the total before approving.');
  }
  if(prior)planId=prior[10];
  else if(pricing&&pricing.percent)planId=rewardPayPalPlan_(d,pricing);
  var row=commerceLock_(function(){
    var existing=commerceRows_().filter(function(r){return r[1]===mode_()&&r[2]===who.email&&(r[17]===d.requestId||prior&&r[0]===prior[0]||d.offer==='trial'&&r[6]==='trial'&&['reserved','created'].indexOf(r[12])>=0&&r[4]===signals.deviceHash&&r[5]===signals.ipHash&&Date.now()-new Date(r[13]).getTime()<1800000);})[0];
    if(existing){
      if(existing[6]!==d.offer||existing[7]!==d.plan||existing[8]!==d.billing||existing[9]!==d.seats||existing[10]!==planId)throw commerceError_('selection','Start a new checkout after changing your selection.');
      if(Date.now()-new Date(existing[13]).getTime()>1800000&&existing[12]!=='accepted'&&!(rewardBuyer_(existing).loyalty||{}).reward)throw commerceError_('expired','This checkout expired. Start again.');
      return existing;
    }
    if(d.offer==='trial'){
      if(commerceHistoricalTrial_(who.email)||commerceConflict_(signals,'',true))throw commerceError_('trial_used','2-day trial already claimed. You can continue with a paid subscription.');
      if(!signals.ipHash)throw commerceError_('network_unverified','Your network could not be verified for a trial. Please try again.');
      if(!signals.deviceHash)throw commerceError_('browser_unverified','Allow site storage to verify this browser for a trial.');
      if(commerceConflict_(signals,''))throw commerceError_('trial_reserved','A trial checkout is already in progress for this browser or network. Resume it or try again after its reservation expires.');
    }
    if(pricing&&pricing.reward)rewardReserve_(who,pricing,history,'');
    if(pricing&&pricing.coupon&&!prior)couponRule_(pricing.coupon.code,d,who.email);
    var buyer=JSON.stringify({name:clip_(d.name,80),company:clip_(d.company,80),networkCountry:d.country||'',sandboxCountry:d.sandboxCountry||'',loyalty:pricing});
    var now=new Date(),created=[Utilities.getUuid(),mode_(),who.email,signals.emailHash,signals.deviceHash,signals.ipHash,d.offer,d.plan,d.billing,d.seats,planId,'','reserved',now,now,'','',d.requestId,checkoutCountry,buyer,'',''];
    commerceWrite_(created);return created;
  });
  if(row[11])return {ok:true,checkoutId:row[0],subscriptionId:row[11],offer:row[6],pricing:rewardBuyer_(row).loyalty||null};
  var origin='https://imajoy.github.io';
  var subscription=commercePaypal_('/v1/billing/subscriptions','post',{plan_id:planId,quantity:String(d.seats),custom_id:row[0],subscriber:{email_address:who.email},application_context:{brand_name:'Wrapline by Ajoy Tools',shipping_preference:'NO_SHIPPING',user_action:'SUBSCRIBE_NOW',return_url:origin+'/checkout.html?checkout='+row[0],cancel_url:origin+'/checkout.html?cancelled=1'}},row[0]);
  if(!/^I-[A-Z0-9]+$/.test(subscription.id||''))throw commerceError_('provider','PayPal did not return a subscription.');
  commerceLock_(function(){var current=commerceFind_(row[0]);current[11]=subscription.id;current[12]='created';current[14]=new Date();commerceWrite_(current);});
  return {ok:true,checkoutId:row[0],subscriptionId:subscription.id,offer:row[6],pricing:rewardBuyer_(row).loyalty||null};
}
function commerceCancel_(id) {commercePaypal_('/v1/billing/subscriptions/'+encodeURIComponent(id)+'/cancel','post',{reason:'Trial eligibility could not be verified. No trial access will be issued.'});}
function commerceConfirm_(id,who) {
  var row=commerceFind_(id);
  if(!row||who&&row[2]!==who.email)throw commerceError_('checkout','This checkout does not belong to your account.');
  if(!row[11])throw commerceError_('pending','Checkout is not ready. Please retry.');
  var s=commercePaypal_('/v1/billing/subscriptions/'+encodeURIComponent(row[11])),payer=s.subscriber&&s.subscriber.payer_id;
  if(s.custom_id!==id||s.plan_id!==row[10]||Number(s.quantity||1)!==row[9])throw commerceError_('mismatch','PayPal details do not match this checkout. Access was not issued.');
  if(s.status!=='ACTIVE')return {ok:true,pending:true,status:s.status||'UNKNOWN',checkoutId:id};
  var blocked=false,blockedReason='trial_unavailable';
  row=commerceLock_(function(){
    var current=commerceFind_(id);
    if(current[12]==='accepted')return current;
    var expired=current[6]==='trial'&&Date.now()-new Date(current[13]).getTime()>1800000;
    var signals={emailHash:current[3],deviceHash:current[4],ipHash:current[5],payerHash:payer?trialHash_('payer:'+payer):''};
    var claimed=current[6]==='trial'&&(commerceHistoricalTrial_(current[2])||commerceConflict_(signals,id,true));
    var reserved=current[6]==='trial'&&!claimed&&commerceConflict_(signals,id);
    blocked=expired||current[12]==='blocked'||current[6]==='trial'&&(!payer||claimed||reserved);
    blockedReason=claimed?'trial_used':expired?'trial_expired':reserved?'trial_reserved':'trial_unavailable';
    current[12]=blocked?'blocked':'accepted';current[14]=new Date();current[15]=signals.payerHash;current[21]=s.status;
    if(!blocked&&current[6]==='trial')current[20]=new Date();
    commerceWrite_(current);return current;
  });
  if(blocked){
    commerceCancel_(row[11]);
    var message=blockedReason==='trial_used'?'2-day trial already claimed. This additional trial subscription was cancelled. You can continue with a paid subscription.':blockedReason==='trial_expired'?'This trial checkout expired and the subscription was cancelled. Start a new checkout to try again.':blockedReason==='trial_reserved'?'Another trial checkout is already in progress. This additional subscription was cancelled.':'Trial eligibility could not be verified and this subscription was cancelled. Please contact support.';
    throw commerceError_(blockedReason,message);
  }
  if(!row[16]){
    var buyer=row[19]?JSON.parse(row[19]):{};
    var logged=handleOrder_({subscriptionId:row[11],email:row[2],country:row[18],detectedCountry:row[18],plan:row[7],billing:row[8],seats:row[9],name:buyer.name||'',company:buyer.company||''});
    if(logged!=='ok'&&logged!=='duplicate')throw commerceError_('pending','Your approved subscription is being recorded. Please check again.');
    commerceLock_(function(){var current=commerceFind_(id);current[16]='yes';current[14]=new Date();commerceWrite_(current);});
    try{CacheService.getScriptCache().remove('rh:'+mode_()+':'+row[2]);}catch(e){}
    var usedCoupon=(rewardBuyer_(row).loyalty||{}).coupon;if(usedCoupon)couponRecordUse_(usedCoupon.code);
  }
  return {ok:true,accepted:true,checkoutId:id,subscriptionId:row[11],offer:row[6],email:row[2],plan:row[7],billing:row[8],seats:row[9]};
}
function commerceWebhook_(d) {
  var webhook=props_().getProperty('PAYPAL_WEBHOOK_ID');if(!webhook)throw commerceError_('unavailable','PayPal webhook verification is not configured.');
  var h=d.headers||{},verified=commercePaypal_('/v1/notifications/verify-webhook-signature','post',{auth_algo:h['paypal-auth-algo'],cert_url:h['paypal-cert-url'],transmission_id:h['paypal-transmission-id'],transmission_sig:h['paypal-transmission-sig'],transmission_time:h['paypal-transmission-time'],webhook_id:webhook,webhook_event:d.event});
  if(verified.verification_status!=='SUCCESS')throw commerceError_('signature','Invalid PayPal signature.');
  var event=d.event||{},resource=event.resource||{},sub=String(resource.billing_agreement_id||resource.id||'');
  if(!/^I-[A-Z0-9]+$/.test(sub))return {ok:true,ignored:true};
  var row=commerceRows_().filter(function(r){return r[1]===mode_()&&r[11]===sub;})[0];
  if(!row){
    var cutoff=Date.parse(props_().getProperty('COMMERCE_ENFORCE_FROM')||'');
    if(Number.isFinite(cutoff)&&event.event_type==='BILLING.SUBSCRIPTION.ACTIVATED'){
      var unknown=commercePaypal_('/v1/billing/subscriptions/'+encodeURIComponent(sub));
      if(isTrialPlan_(unknown.plan_id)&&Date.parse(unknown.create_time||'')>=cutoff&&unknown.status==='ACTIVE')commerceCancel_(sub);
    }
    return {ok:true,ignored:true};
  }
  if(event.event_type==='BILLING.SUBSCRIPTION.ACTIVATED'||event.event_type==='PAYMENT.SALE.COMPLETED')return commerceConfirm_(row[0],null);
  commerceLock_(function(){var current=commerceFind_(row[0]);current[21]=String(resource.status||event.event_type);current[14]=new Date();commerceWrite_(current);});
  return {ok:true};
}
function handleCommerceEnvelope_(envelope) {
  try{
    var timestamp=String(envelope.timestamp||''),nonce=String(envelope.nonce||''),packed=envelope.payload;
    if(typeof packed!=='string'||packed.length>260000||!/^[-a-f0-9]{36}$/i.test(nonce)||!/^\d{13}$/.test(timestamp)||Math.abs(Date.now()-Number(timestamp))>120000)throw commerceError_('signature','Invalid service request.');
    var signature=commerceHash_(timestamp+'.'+nonce+'.'+packed);
    if(signature!==envelope.signature)throw commerceError_('signature','Invalid service signature.');
    commerceLock_(function(){var cache=CacheService.getScriptCache();if(cache.get('rpc:'+nonce))throw commerceError_('signature','Service request was already used.');cache.put('rpc:'+nonce,'1',300);});
    var d=JSON.parse(packed);
    if(d.action==='passkeys')return handlePasskeys_(d);
    if(d.action==='billing_context'&&typeof billingContext_==='function')return billingContext_(d);
    if(d.action==='razorpay'&&typeof handleRazorpay_==='function')return handleRazorpay_(d);
    if(props_().getProperty('COMMERCE_ENABLED')!=='true')throw commerceError_('unavailable','Secure checkout is not activated.');
    if((d.action==='checkout'||d.action==='webhook')&&!Number.isFinite(Date.parse(props_().getProperty('COMMERCE_ENFORCE_FROM')||'')))throw commerceError_('unavailable','The trial activation cutoff is not configured.');
    if(d.action==='webhook')return commerceWebhook_(d);
    var who=commerceWho_(d.accountToken);
    if(['eligibility','rewards','checkout'].indexOf(d.action)>=0){
      if(typeof billingApply_!=='function'&&(d.billingNetwork||props_().getProperty('BILLING_POLICY_ENABLED')==='true'))throw commerceError_('unavailable','The billing protection module needs updating.');
      if(typeof billingApply_==='function')billingApply_(d,who);
    }
    if(d.action==='eligibility')return commerceLock_(function(){return commerceEligibility_(d,who);});
    if(d.action==='rewards')return commerceRewards_(d,who);
    if(d.action==='checkout')return commerceCreate_(d,who);
    if(d.action==='confirm')return commerceConfirm_(d.checkoutId,who);
    if(d.action==='download')return {ok:true,email:who.email};
    throw commerceError_('action','Unknown service request.');
  }catch(error){return {ok:false,error:error.code||'unavailable',message:error.code?error.message:'The account service could not complete the request. Please retry.'};}
}
/* Run once before enabling secure checkout: imports prior trial emails and PayPal payer IDs.
   It never creates a subscription, charges a buyer or emails anyone. */
function backfillTrialHistory() {
  var sheet=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ORDERS_SHEET);if(!sheet||sheet.getLastRow()<2)return;
  sheet.getRange(2,1,sheet.getLastRow()-1,12).getValues().forEach(function(r){
    if(r[3]!==mode_()||!(String(r[7]).indexOf('trial')>=0||isTrialPlan_(String(r[11]))))return;
    var id='legacy-'+r[1];if(commerceFind_(id))return;
    var s=commercePaypal_('/v1/billing/subscriptions/'+encodeURIComponent(String(r[1]))),payer=s.subscriber&&s.subscriber.payer_id;
    if(!payer)throw new Error('Cannot verify payer for '+r[1]+'. Resolve this order before enabling trials.');
    var email=String(r[4]).trim().toLowerCase(),now=new Date();
    commerceLock_(function(){if(!commerceFind_(id))commerceWrite_([id,mode_(),email,trialHash_('email:'+email),'','','trial','online',r[8],Number(r[9])||1,r[11],r[1],'accepted',r[0],now,trialHash_('payer:'+payer),'yes','',r[6],'',r[0]||now,s.status]);});
  });
}
