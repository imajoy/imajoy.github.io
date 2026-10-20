/* Returning-subscriber rewards for the active Sheets/PayPal checkout.
   Only PayPal-verified, positive completed payments count. Orders are not receipts. */
function archivePayPalCatalog_(catalog) {
  var key='PAYPAL_PLAN_HISTORY_'+mode_(),history=JSON.parse(props_().getProperty(key)||'{}'),tiers=catalog.tiers||{},prices=catalog.prices||LEGACY_PRICES;
  for(var tier in tiers)for(var kind in tiers[tier])for(var billing in tiers[tier][kind]){
    var plan=kind==='onlineTrial'?'online':kind;
    history[tiers[tier][kind][billing]]={tier:tier,plan:plan,billing:billing,trial:kind==='onlineTrial',unitAmount:Math.round(prices[tier][plan][billing]*100)};
  }
  props_().setProperty(key,JSON.stringify(history));
}
function rewardPlanInfo_(id) {
  var catalog=JSON.parse(props_().getProperty('PLANS_'+mode_())||'{}'),tiers=catalog.tiers||{};
  for(var tier in tiers)for(var kind in tiers[tier])for(var billing in tiers[tier][kind]){
    if(tiers[tier][kind][billing]===id){var plan=kind==='onlineTrial'?'online':kind;return {tier:tier,plan:plan,billing:billing,trial:kind==='onlineTrial',unitAmount:Math.round((catalog.prices||LEGACY_PRICES)[tier][plan][billing]*100)};}
  }
  var historic=JSON.parse(props_().getProperty('PAYPAL_PLAN_HISTORY_'+mode_())||'{}');
  if(historic[id])return historic[id];
  var saved=JSON.parse(props_().getProperty('LOYALTY_PLANS_'+mode_())||'{}');
  for(var key in saved)if(saved[key].id===id)return saved[key];
  return null;
}
function rewardBuyer_(row) {
  try{return row[19]?JSON.parse(row[19]):{};}catch(e){throw commerceError_('rewards_unavailable','Saved reward details could not be verified. Please contact Ajoy.');}
}
function rewardHistory_(email) {
  // After buildPaymentHistory() has run, rewards come from the shop's own Payments tab.
  if(typeof paymentsOn_==='function'&&paymentsOn_())return paymentHistory_(email);
  var known={},sheet=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ORDERS_SHEET);
  if(sheet&&sheet.getLastRow()>1)sheet.getRange(2,1,sheet.getLastRow()-1,12).getValues().forEach(function(r){
    if(r[3]===mode_()&&String(r[4]).trim().toLowerCase()===email)known[r[1]]={created:r[0],seats:r[9],recorded:true};
  });
  commerceRows_().forEach(function(r){
    if(r[1]!==mode_()||r[2]!==email||!r[11])return;
    var recorded=!!(known[r[11]]&&known[r[11]].recorded)||r[12]==='accepted'||!!r[16];
    known[r[11]]={created:r[13],seats:r[9],loyalty:rewardBuyer_(r).loyalty,recorded:recorded,unapproved:!recorded&&['reserved','created'].indexOf(r[12])>=0};
  });
  var history={monthly:0,yearly:0,used:{},statuses:{},receipts:[]},seen={};
  var ids=Object.keys(known);
  if(ids.length>50)throw commerceError_('rewards_unavailable','Your payment history needs review. Please contact Ajoy before subscribing.');
  ids.forEach(function(id){
    if(!/^I-[A-Z0-9]+$/.test(id))throw commerceError_('rewards_unavailable','A saved subscription could not be verified. Please contact Ajoy.');
    var s;
    try{s=commercePaypal_('/v1/billing/subscriptions/'+encodeURIComponent(id));}
    catch(e){
      // PayPal no longer knows this subscription (unapproved checkouts are deleted; sandbox/test records can vanish).
      // It can add no verified paid periods, so it is skipped instead of blocking the buyer's checkout.
      // Skipping can only lower a reward, never raise one.
      if(e.providerStatus===404){history.statuses[id]='EXPIRED';if(typeof Logger!=='undefined')Logger.log('Reward history skipped missing PayPal subscription '+id);return;}
      throw e;
    }
    var info=rewardPlanInfo_(s.plan_id);
    if(s.id&&s.id!==id||!info)throw commerceError_('rewards_unavailable','A previous subscription plan could not be verified. Please contact Ajoy.');
    history.statuses[id]=s.status;
    // PayPal-confirmed unapproved checkouts have no completed billing periods.
    // Skip their transaction endpoint only when no order/access was ever recorded.
    // Established subscriptions still require complete verified payment history.
    if(known[id].unapproved&&['APPROVAL_PENDING','APPROVED'].indexOf(s.status)>=0)return;
    var start=Date.parse(s.create_time||known[id].created);
    if(!Number.isFinite(start))throw commerceError_('rewards_unavailable','A previous subscription date could not be verified. Please contact Ajoy.');
    var result=commercePaypal_('/v1/billing/subscriptions/'+encodeURIComponent(id)+'/transactions?start_time='+encodeURIComponent(new Date(start-86400000).toISOString())+'&end_time='+encodeURIComponent(new Date().toISOString()));
    // PayPal leaves out "transactions" when a subscription has no payments yet (for example a trial).
    if(!Object.prototype.hasOwnProperty.call(result,'transactions')&&!Number(result.total_items||0))result.transactions=[];
    if(!Array.isArray(result.transactions)||Number(result.total_pages||1)>1||Number(result.total_items||0)>result.transactions.length)throw commerceError_('rewards_unavailable','Complete payment history is not available. Please contact Ajoy before subscribing.');
    var settled=[],periods={},paidPeriods={},loyalty=known[id].loyalty;
    var quantity=Number(s.quantity||known[id].seats||1);
    if(!Number.isInteger(quantity)||quantity<1||quantity>100)throw commerceError_('rewards_unavailable','A previous license quantity could not be verified.');
    result.transactions.sort(function(a,b){return Date.parse(a.time)-Date.parse(b.time);});
    result.transactions.forEach(function(t){
      var amount=t.amount_with_breakdown&&t.amount_with_breakdown.gross_amount;
      if(!t.id||!Number.isFinite(Date.parse(t.time)))throw commerceError_('rewards_unavailable','A payment record could not be verified. Please contact Ajoy.');
      if(seen[t.id])return;seen[t.id]=true;
      if(!amount||!Number.isFinite(Number(amount.value))||Number(amount.value)<=0)return;
      if(amount.currency_code!=='USD')throw commerceError_('rewards_unavailable','A previous payment currency needs review. Please contact Ajoy.');
      // Conservatively count at most one full payment per subscription/calendar
      // billing period. Repeated invoices and prorated captures cannot advance rewards.
      var date=new Date(t.time),period=date.getUTCFullYear()+(info.billing==='monthly'?'-'+date.getUTCMonth():'');
      var phase=Object.prototype.hasOwnProperty.call(periods,period)?periods[period]:settled.length;
      var intro=loyalty&&phase<(loyalty.rewardPayments||1);
      var expected=(loyalty?(intro?loyalty.discountedUnitAmount:loyalty.unitAmount):(info.unitAmount||Math.round(PRICES[info.tier][info.plan][info.billing]*100)))*quantity;
      // A refunded reward remains consumed; refunds never reset a used benefit.
      if(['COMPLETED','REFUNDED','PARTIALLY_REFUNDED'].indexOf(t.status)>=0&&!Object.prototype.hasOwnProperty.call(periods,period)){
        periods[period]=settled.length;settled.push(t);
      }
      if(t.status==='COMPLETED'&&!paidPeriods[period]&&Math.round(Number(amount.value)*100)>=expected){
        paidPeriods[period]=true;history[info.billing]++;history.receipts.push(t.id);
      }
    });
    if(loyalty&&loyalty.reward){
      settled.sort(function(a,b){return Date.parse(a.time)-Date.parse(b.time);});
      var keys=loyalty.rewardKeys||[loyalty.reward];
      keys.forEach(function(key,index){if(settled[index])history.used[key]=true;});
    }
  });
  razorpayHistory_(email,history);
  return history;
}
/* Paid Razorpay subscriptions count toward the same returning-subscriber rewards (test and live data never mix). */
function razorpayHistory_(email,history){
  if(typeof razorpayRows_!=='function'||(mode_()==='live')!==(razorpayMode_()==='live'))return history;
  var sheet=SpreadsheetApp.getActiveSpreadsheet().getSheetByName('RazorpayPayments');
  var receipts=sheet&&sheet.getLastRow()>1?sheet.getRange(2,1,sheet.getLastRow()-1,2).getValues():[];
  razorpayRows_().forEach(function(r){
    if(r.mode!==razorpayMode_()||r.email!==email||!r.accepted||!r.subscriptionId)return;
    var paid=receipts.filter(function(x){return x[1]===r.subscriptionId;}).length;
    if(paid&&(r.price.billing==='monthly'||r.price.billing==='yearly'))history[r.price.billing]+=paid;
    (r.price.discount&&r.price.discount.rewardKeys||[]).forEach(function(k){history.used[k]=true;});
  });
  return history;
}
function rewardHistoryCached_(email){
  var cache=CacheService.getScriptCache(),key='rh:'+mode_()+':'+email,history=null;
  try{history=JSON.parse(cache.get(key)||'null');}catch(e){}
  if(!history){history=rewardHistory_(email);cache.put(key,JSON.stringify(history),300);}
  return history;
}
function rewardQuote_(d,who,history) {
  var country=d.sandboxCountry||d.country;
  var amount=Math.round(PRICES[tierFor_(country)][d.plan][d.billing]*100);
  var next=history[d.billing]+1,reward='',percent=0;
  if(d.billing==='monthly'&&(next===2||next===3)){reward=next===2?'monthly_second':'monthly_third';percent=5;}
  if(d.billing==='yearly'&&next===2){reward='yearly_return';percent=10;}
  if(history.used[reward]){reward='';percent=0;}
  var keys=reward?[reward]:[];
  if(reward==='monthly_second'&&!history.used.monthly_third)keys.push('monthly_third');
  var discounted=Math.round(amount*(100-percent)/100);
  return {currency:'USD',unitAmount:amount,discountedUnitAmount:discounted,seats:d.seats,total:discounted*d.seats,discountAmount:(amount-discounted)*d.seats,percent:percent,reward:reward,rewardKeys:keys,rewardPayments:keys.length,nextPayment:next,plan:d.plan,billing:d.billing};
}
function rewardSelection_(d) {
  if(['online','offline'].indexOf(d.plan)<0||['monthly','yearly'].indexOf(d.billing)<0||!Number.isInteger(d.seats)||d.seats<1||d.seats>100)throw commerceError_('selection','Review your plan, billing period and license quantity.');
  var country=d.sandboxCountry||d.country;
  if(d.sandboxCountry&&props_().getProperty('PAYPAL_MODE')!=='sandbox')throw commerceError_('unavailable','Sandbox country simulation cannot use Live merchant settings.');
  commercePlan_(d.plan,d.billing,country,'standard');
  if(d.billingCountry&&tierFor_(d.billingCountry)!==tierFor_(country))throw commerceError_('region','Your billing country and detected price region differ. Review your country before subscribing.');
}
function commerceRewards_(d,who) {
  rewardSelection_(d);
  // The price preview reuses a recent payment-history lookup (PayPal calls are slow); checkout always re-checks.
  var history=rewardHistoryCached_(who.email);
  return {ok:true,pricing:couponApply_(rewardQuote_(d,who,history),d,who.email)};
}
function rewardPending_(d,who) {
  var rows=commerceRows_().filter(function(r){return r[1]===mode_()&&r[2]===who.email;});
  var same=rows.filter(function(r){return r[17]===d.requestId;})[0];
  if(same)return same;
  if(d.offer!=='standard'||d.coupon)return null;
  var pending=rows.filter(function(r){return r[6]==='standard'&&r[7]===d.plan&&r[8]===d.billing&&r[9]===d.seats&&r[18]===(d.sandboxCountry||d.country)&&['reserved','created'].indexOf(r[12])>=0&&rewardBuyer_(r).loyalty&&rewardBuyer_(r).loyalty.reward;});
  for(var i=0;i<pending.length;i++){
    if(!pending[i][11])return pending[i];
    var sub=commercePaypal_('/v1/billing/subscriptions/'+encodeURIComponent(pending[i][11]));
    if(['CANCELLED','EXPIRED'].indexOf(sub.status)<0)return pending[i];
  }
  return null;
}
function rewardReserve_(who,quote,history,exceptId) {
  if(!quote.reward)return;
  var conflict=commerceRows_().some(function(r){
    if(r[0]===exceptId||r[1]!==mode_()||r[2]!==who.email)return false;
    var used=rewardBuyer_(r).loyalty;
    if(!used||(used.rewardKeys||[used.reward]).indexOf(quote.reward)<0)return false;
    // Approval-pending subscriptions can still be approved after a local timeout.
    // Keep their reservation until PayPal confirms cancellation or expiration.
    return !r[11]||['CANCELLED','EXPIRED'].indexOf(history.statuses[r[11]])<0;
  });
  if(conflict)throw commerceError_('reward_reserved','This reward is already attached to another checkout. Complete it, or cancel that subscription in PayPal before starting again.');
}
function rewardPayPalPlan_(d,quote) {
  var tier=tierFor_(d.sandboxCountry||d.country),saved=JSON.parse(props_().getProperty('LOYALTY_PLANS_'+mode_())||'{}');
  var key=[tier,d.plan,d.billing,quote.percent,quote.unitAmount,quote.rewardPayments,quote.coupon?'coupon':'v1'].join('-');
  if(saved[key])return saved[key].id;
  var catalog=JSON.parse(props_().getProperty('PLANS_'+mode_())||'{}');
  if(!catalog.productId)throw commerceError_('rewards_unavailable','The PayPal product is not configured for rewards. Please contact Ajoy.');
  var frequency={interval_unit:d.billing==='yearly'?'YEAR':'MONTH',interval_count:1};
  // PayPal supports paid introductory (TRIAL tenure) cycles. Only the promised introductory
  // payments are reduced; the unlimited REGULAR phase restores the catalog rate.
  var plan=commercePaypal_('/v1/billing/plans','post',{
    product_id:catalog.productId,name:'Wrapline '+d.plan+' '+d.billing+(quote.coupon?' coupon ':' returning reward ')+quote.percent+'% ('+tier+')',
    description:quote.rewardPayments+' payment(s) with '+quote.percent+(quote.coupon?'% coupon savings':'% returning subscriber savings')+'; then the standard '+d.billing+' rate.',status:'ACTIVE',quantity_supported:true,
    billing_cycles:[
      {frequency:frequency,tenure_type:'TRIAL',sequence:1,total_cycles:quote.rewardPayments,pricing_scheme:{fixed_price:{value:(quote.discountedUnitAmount/100).toFixed(2),currency_code:'USD'}}},
      {frequency:frequency,tenure_type:'REGULAR',sequence:2,total_cycles:0,pricing_scheme:{fixed_price:{value:(quote.unitAmount/100).toFixed(2),currency_code:'USD'}}}
    ],payment_preferences:{auto_bill_outstanding:true,setup_fee_failure_action:'CONTINUE',payment_failure_threshold:3}
  },'ajoy-loyalty-'+mode_()+'-'+key);
  if(!/^P-[A-Z0-9-]+$/.test(plan.id||''))throw commerceError_('provider','PayPal did not return a reward plan.');
  // Merge under a lock: simultaneous quotes for different plans must not lose entries.
  commerceLock_(function(){var latest=JSON.parse(props_().getProperty('LOYALTY_PLANS_'+mode_())||'{}');latest[key]={id:plan.id,tier:tier,plan:d.plan,billing:d.billing};props_().setProperty('LOYALTY_PLANS_'+mode_(),JSON.stringify(latest));});
  return plan.id;
}

/* ---------- Coupon codes (managed in the "Coupons" tab of this sheet) ----------
   One row per code. Columns: Code | Percent off | Payments discounted | Expires on | Plan | Billing |
   Max uses | Used | Active | Note | Countries. Countries: blank = every country, or codes such as IN, US, GB.
   Coupons work with every payment option (PayPal and Razorpay). Plan/Billing: online, offline or both / monthly, yearly or both.
   Blank Max uses = unlimited. "Times used" is filled in automatically. Active: Yes/No (TRUE/FALSE also accepted). A coupon replaces the returning
   subscriber reward on that checkout (they never stack) and does not apply to the free trial. */
var COUPON_HEADERS_=['Code','Percent off','Payments discounted','Expires on','Plan','Billing','Max uses','Used','Active','Note','Countries'];
function couponSheet_() {
  var ss=SpreadsheetApp.getActiveSpreadsheet(),sheet=ss.getSheetByName('Coupons');
  if(!sheet){sheet=ss.insertSheet('Coupons');sheet.appendRow(COUPON_HEADERS_);sheet.setFrozenRows(1);}
  return sheet;
}
function couponCode_(raw) {return String(raw||'').trim().toUpperCase();}
function couponUses_(code,email,exceptId) {
  var total=0,mine=0;
  commerceRows_().forEach(function(r){
    if(r[0]===exceptId||r[1]!==mode_())return;
    var c=(rewardBuyer_(r).loyalty||{}).coupon;if(!c||couponCode_(c.code)!==code)return;
    var live=r[12]==='accepted'||['reserved','created'].indexOf(r[12])>=0&&Date.now()-new Date(r[13]).getTime()<1800000;
    if(!live)return;total++;if(email&&r[2]===email)mine++;
  });
  if(typeof razorpayRows_==='function')razorpayRows_().forEach(function(r){
    if(r.id===exceptId||r.mode!==razorpayMode_())return;
    var c=r.price&&r.price.discount&&r.price.discount.coupon;if(!c||couponCode_(c.code)!==code)return;
    var live=r.accepted||['creating','created'].indexOf(r.state)>=0&&Date.now()-r.createdAt<1800000;
    if(!live)return;total++;if(email&&r.email===email)mine++;
  });
  return {total:total,mine:mine};
}
function couponRule_(raw,d,email) {
  var code=couponCode_(raw);
  if(!/^[A-Z0-9][A-Z0-9-]{2,31}$/.test(code))throw commerceError_('coupon_invalid','Enter a valid coupon code.');
  var sheet=couponSheet_(),rows=sheet.getLastRow()>1?sheet.getRange(2,1,sheet.getLastRow()-1,COUPON_HEADERS_.length).getValues():[];
  var row=rows.filter(function(r){return couponCode_(r[0])===code;})[0];
  var active=row&&(row[8]===true||String(row[8]).trim().toUpperCase()==='TRUE'||String(row[8]).trim().toUpperCase()==='YES');
  if(!row||!active)throw commerceError_('coupon_invalid','This coupon code is not valid.');
  var percent=Number(row[1]),payments=row[2]===''?1:Number(row[2]);
  if(!Number.isInteger(percent)||percent<1||percent>90||!Number.isInteger(payments)||payments<1||payments>24)throw commerceError_('coupon_invalid','This coupon is not set up correctly. Please contact Ajoy.');
  if(row[3]!==''){
    var end=row[3] instanceof Date?new Date(row[3].getTime()):new Date(String(row[3]));
    if(isNaN(end.getTime()))throw commerceError_('coupon_invalid','This coupon is not set up correctly. Please contact Ajoy.');
    if(!(row[3] instanceof Date)||end.getHours()===0&&end.getMinutes()===0)end.setHours(23,59,59,999);
    if(end.getTime()<Date.now())throw commerceError_('coupon_expired','This coupon has expired.');
  }
  var plan=String(row[4]||'both').trim().toLowerCase(),billing=String(row[5]||'both').trim().toLowerCase();
  if(plan!=='both'&&plan!==d.plan)throw commerceError_('coupon_invalid','This coupon is only for the '+plan.charAt(0).toUpperCase()+plan.slice(1)+' plan.');
  if(billing!=='both'&&billing!==d.billing)throw commerceError_('coupon_invalid','This coupon is only for '+billing+' billing.');
  var countries=String(row[10]||'').toUpperCase().split(/[^A-Z]+/).filter(function(c){return /^[A-Z]{2}$/.test(c);});
  var where=d.billingCountry||d.sandboxCountry||d.country||'';
  if(countries.length&&countries.indexOf(where)<0)throw commerceError_('coupon_invalid','This coupon is not available in your country.');
  var uses=couponUses_(code,email,d.exceptId||'');
  if(uses.mine)throw commerceError_('coupon_used','You have already used this coupon.');
  if(row[6]!==''&&uses.total>=Number(row[6]))throw commerceError_('coupon_used','This coupon has reached its usage limit.');
  return {code:code,percent:percent,payments:payments};
}
function couponApply_(quote,d,email) {
  if(!d.coupon)return quote;
  var rule=couponRule_(d.coupon,d,email);
  var discounted=Math.round(quote.unitAmount*(100-rule.percent)/100);
  quote.percent=rule.percent;quote.discountedUnitAmount=discounted;quote.total=discounted*quote.seats;quote.discountAmount=(quote.unitAmount-discounted)*quote.seats;
  quote.reward='';quote.rewardKeys=[];quote.rewardPayments=rule.payments;quote.coupon=rule;
  return quote;
}
function couponRecordUse_(code) {
  try{
    var sheet=couponSheet_(),rows=sheet.getLastRow()>1?sheet.getRange(2,1,sheet.getLastRow()-1,1).getValues():[];
    var used=0;commerceRows_().forEach(function(r){var c=(rewardBuyer_(r).loyalty||{}).coupon;if(r[1]===mode_()&&r[12]==='accepted'&&c&&couponCode_(c.code)===code)used++;});
    if(typeof razorpayRows_==='function')razorpayRows_().forEach(function(r){var c=r.price&&r.price.discount&&r.price.discount.coupon;if(r.mode===razorpayMode_()&&r.accepted&&c&&couponCode_(c.code)===code)used++;});
    rows.forEach(function(r,i){if(couponCode_(r[0])===code)sheet.getRange(i+2,8).setValue(used);});
  }catch(e){}
}
