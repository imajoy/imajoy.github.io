/* Returning-subscriber rewards for the active Sheets/PayPal checkout.
   Only PayPal-verified, positive completed payments count. Orders are not receipts. */
function rewardPlanInfo_(id) {
  var catalog=JSON.parse(props_().getProperty('PLANS_'+mode_())||'{}'),tiers=catalog.tiers||{};
  for(var tier in tiers)for(var kind in tiers[tier])for(var billing in tiers[tier][kind]){
    if(tiers[tier][kind][billing]===id)return {tier:tier,plan:kind==='onlineTrial'?'online':kind,billing:billing};
  }
  var saved=JSON.parse(props_().getProperty('LOYALTY_PLANS_'+mode_())||'{}');
  for(var key in saved)if(saved[key].id===id)return saved[key];
  return null;
}
function rewardBuyer_(row) {
  try{return row[19]?JSON.parse(row[19]):{};}catch(e){throw commerceError_('rewards_unavailable','Saved reward details could not be verified. Please contact Ajoy.');}
}
function rewardHistory_(email) {
  var known={},sheet=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ORDERS_SHEET);
  if(sheet&&sheet.getLastRow()>1)sheet.getRange(2,1,sheet.getLastRow()-1,12).getValues().forEach(function(r){
    if(r[3]===mode_()&&String(r[4]).trim().toLowerCase()===email)known[r[1]]={created:r[0],seats:r[9]};
  });
  commerceRows_().forEach(function(r){if(r[1]===mode_()&&r[2]===email&&r[11])known[r[11]]={created:r[13],seats:r[9],loyalty:rewardBuyer_(r).loyalty};});
  var history={monthly:0,yearly:0,used:{},statuses:{},receipts:[]},seen={};
  var ids=Object.keys(known);
  if(ids.length>50)throw commerceError_('rewards_unavailable','Your payment history needs review. Please contact Ajoy before subscribing.');
  ids.forEach(function(id){
    if(!/^I-[A-Z0-9]+$/.test(id))throw commerceError_('rewards_unavailable','A saved subscription could not be verified. Please contact Ajoy.');
    var s=commercePaypal_('/v1/billing/subscriptions/'+encodeURIComponent(id));
    var info=rewardPlanInfo_(s.plan_id);
    if(s.id&&s.id!==id||!info)throw commerceError_('rewards_unavailable','A previous subscription plan could not be verified. Please contact Ajoy.');
    history.statuses[id]=s.status;
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
      var expected=(loyalty?(intro?loyalty.discountedUnitAmount:loyalty.unitAmount):PRICES[info.tier][info.plan][info.billing]*100)*quantity;
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
  return history;
}
function rewardQuote_(d,who,history) {
  var country=d.sandboxCountry||d.country;
  var amount=PRICES[tierFor_(country)][d.plan][d.billing]*100;
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
  return {ok:true,pricing:rewardQuote_(d,who,rewardHistory_(who.email))};
}
function rewardPending_(d,who) {
  var rows=commerceRows_().filter(function(r){return r[1]===mode_()&&r[2]===who.email;});
  var same=rows.filter(function(r){return r[17]===d.requestId;})[0];
  if(same)return same;
  if(d.offer!=='standard')return null;
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
  var key=[tier,d.plan,d.billing,quote.percent,quote.unitAmount,quote.rewardPayments,'v1'].join('-');
  if(saved[key])return saved[key].id;
  var catalog=JSON.parse(props_().getProperty('PLANS_'+mode_())||'{}');
  if(!catalog.productId)throw commerceError_('rewards_unavailable','The PayPal product is not configured for rewards. Please contact Ajoy.');
  var frequency={interval_unit:d.billing==='yearly'?'YEAR':'MONTH',interval_count:1};
  // PayPal supports paid introductory (TRIAL tenure) cycles. Only the promised introductory
  // payments are reduced; the unlimited REGULAR phase restores the catalog rate.
  var plan=commercePaypal_('/v1/billing/plans','post',{
    product_id:catalog.productId,name:'Ajoy Tools '+d.plan+' '+d.billing+' returning reward '+quote.percent+'% ('+tier+')',
    description:quote.rewardPayments+' payment(s) with '+quote.percent+'% returning subscriber savings; then the standard '+d.billing+' rate.',status:'ACTIVE',quantity_supported:true,
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
