/* ---------- Payments tab: the shop's own payment record ----------
   One row per successful payment, written when PayPal or Razorpay sends its signed notification
   (and by the daily check / one-time import). Returning-subscriber rewards are counted from this tab,
   so checkout no longer asks PayPal for every old subscription.
   Owner controls: set "Counts for rewards" to No to ignore a row, or add a row by hand
   (Provider = Manual) for a payment made another way. Refunded rows stop counting, but a reward
   that was already given stays used. */
var PAYMENTS_SHEET_='Payments';
var PAYMENT_HEADERS_=['Date','Email','Provider','Mode','Plan','Billing','Licenses','Amount','Currency','Status','Counts for rewards','Reward used','Payment ID','Subscription ID','Source','Note'];
var REWARD_LABELS_={monthly_second:'2nd monthly 5%',monthly_third:'3rd monthly 5%',yearly_return:'Yearly renewal 10%'};

function paymentsSheet_(){
  var ss=SpreadsheetApp.getActiveSpreadsheet(),sheet=ss.getSheetByName(PAYMENTS_SHEET_);
  if(!sheet){sheet=ss.insertSheet(PAYMENTS_SHEET_);sheet.appendRow(PAYMENT_HEADERS_);sheet.setFrozenRows(1);}
  return sheet;
}
function paymentRows_(){
  var sheet=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PAYMENTS_SHEET_);
  if(!sheet||sheet.getLastRow()<2)return [];
  return sheet.getRange(2,1,sheet.getLastRow()-1,PAYMENT_HEADERS_.length).getValues();
}
function paymentFilled_(r){return r[0]!==''||r[1]!==''||r[12]!=='';}
function paymentModeLabel_(mode){return mode==='live'?'Live':'Test';}
function paymentTitle_(s){s=String(s||'').toLowerCase();return s?s.charAt(0).toUpperCase()+s.slice(1):'';}
function paymentRewardKeys_(text){
  var out=[];String(text||'').split(/\s*,\s*/).forEach(function(part){
    Object.keys(REWARD_LABELS_).forEach(function(k){if(part===k||part===REWARD_LABELS_[k])out.push(k);});
  });
  return out;
}
/* Adds a payment once (by Payment ID). An existing row is only ever moved to Refunded, never back. */
function paymentRecord_(p){
  if(!p||!p.paymentId||!p.email)return false;
  var sheet=paymentsSheet_(),rows=paymentRows_();
  for(var i=0;i<rows.length;i++){
    if(String(rows[i][12])===String(p.paymentId)){
      if(p.status==='Refunded'&&rows[i][9]!=='Refunded')sheet.getRange(i+2,10).setValue('Refunded');
      return false;
    }
  }
  var keys=p.rewardKeys||[];
  // Write to the first free row under the table (the guide on the right makes the sheet taller).
  var used=rows.reduce(function(n,r,i){return r[0]!==''||r[1]!==''||r[12]!==''?i+1:n;},0);
  sheet.getRange(used+2,1,1,PAYMENT_HEADERS_.length).setValues([[p.date||new Date(),String(p.email).toLowerCase(),p.provider,p.mode,paymentTitle_(p.plan),paymentTitle_(p.billing),Number(p.seats)||1,Number(p.amount)||0,p.currency||'',p.status||'Paid','Yes',keys.map(function(k){return REWARD_LABELS_[k]||k;}).join(', '),String(p.paymentId),String(p.subscriptionId||''),p.source||'Webhook',p.note||''].map(safeSheetCell_)]);
  try{CacheService.getScriptCache().remove('rh:'+mode_()+':'+String(p.email).toLowerCase());}catch(e){}
  return true;
}
function paymentRefund_(paymentId){
  var rows=paymentRows_();
  for(var i=0;i<rows.length;i++)if(String(rows[i][12])===String(paymentId)){
    if(rows[i][9]!=='Refunded')paymentsSheet_().getRange(i+2,10).setValue('Refunded');
    try{CacheService.getScriptCache().remove('rh:'+mode_()+':'+String(rows[i][1]).toLowerCase());}catch(e){}
    return true;
  }
  return false;
}
function paymentsOn_(){return props_().getProperty('PAYMENT_LEDGER')==='on';}

/* Reward history from the Payments tab. Same rules as before: one payment per subscription and
   billing period, only paid rows count, rewards already given stay used even after a refund. */
function paymentHistory_(email){
  var history={monthly:0,yearly:0,used:{},statuses:{},receipts:[]},periods={};
  var paypalMode=paymentModeLabel_(mode_()),rzpMode=typeof razorpayMode_==='function'?paymentModeLabel_(razorpayMode_()):'';
  paymentRows_().forEach(function(r){
    if(String(r[1]).trim().toLowerCase()!==email)return;
    var provider=String(r[2]),mode=String(r[3]||'Live');
    var modeOk=provider==='PayPal'?mode===paypalMode:provider==='Razorpay'?(mode===rzpMode&&rzpMode===paypalMode):mode===paypalMode;
    if(!modeOk)return;
    paymentRewardKeys_(r[11]).forEach(function(k){history.used[k]=true;});
    var billing=String(r[5]).toLowerCase(),date=r[0] instanceof Date?r[0]:new Date(r[0]);
    if(r[9]!=='Paid'||String(r[10]).toLowerCase()==='no'||!(Number(r[7])>0)||['monthly','yearly'].indexOf(billing)<0||isNaN(date.getTime()))return;
    var period=(String(r[13])||String(r[12]))+':'+date.getUTCFullYear()+(billing==='monthly'?'-'+date.getUTCMonth():'');
    if(periods[period])return;periods[period]=true;
    history[billing]++;history.receipts.push(String(r[12]));
  });
  return history;
}

/* ---------- Writers called by the payment code ---------- */
function paymentOrderFor_(sub){
  var sheet=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ORDERS_SHEET);
  if(!sheet||sheet.getLastRow()<2)return null;
  var rows=sheet.getRange(2,1,sheet.getLastRow()-1,12).getValues();
  for(var i=rows.length-1;i>=0;i--)if(String(rows[i][1])===sub)return {email:String(rows[i][4]).trim().toLowerCase(),plan:String(rows[i][7]).split(' ')[0],billing:String(rows[i][8]),seats:Number(rows[i][9])||1,mode:String(rows[i][3])};
  return null;
}
/* PayPal PAYMENT.SALE.COMPLETED: the sale belongs to subscription `sub`. */
function paymentFromPaypalSale_(sub,sale,source){
  var amount=sale.amount||{},value=Number(amount.total||amount.value||0);
  if(!sale.id||!(value>0))return false;
  var row=commerceRows_().filter(function(r){return r[11]===sub&&r[1]===mode_();})[0],order=paymentOrderFor_(sub);
  var email=row?row[2]:order&&order.email;if(!email)return false;
  var loyalty=row?rewardBuyer_(row).loyalty:null,keys=loyalty&&loyalty.reward?(loyalty.rewardKeys||[loyalty.reward]):[];
  var index=paymentRows_().filter(function(r){return String(r[13])===sub;}).length;
  return paymentRecord_({date:new Date(sale.create_time||sale.update_time||Date.now()),email:email,provider:'PayPal',mode:paymentModeLabel_(mode_()),plan:row?row[7]:order.plan,billing:row?row[8]:order.billing,seats:row?row[9]:order.seats,amount:value,currency:amount.currency||amount.currency_code||'USD',status:'Paid',rewardKeys:index<keys.length?[keys[index]]:[],paymentId:sale.id,subscriptionId:sub,source:source||'Webhook'});
}
/* Razorpay captured payment for an accepted checkout record. */
function paymentFromRazorpay_(record,payment,source){
  if(!record||!payment||!payment.id)return false;
  var first=!paymentRows_().some(function(r){return String(r[13])===record.subscriptionId;});
  var keys=first&&record.price.discount&&record.price.discount.rewardKeys||[];
  return paymentRecord_({date:payment.created_at?new Date(payment.created_at*1000):new Date(),email:record.email,provider:'Razorpay',mode:paymentModeLabel_(record.mode),plan:record.price.plan,billing:record.price.billing,seats:record.price.seats,amount:Number(payment.amount||0)/100,currency:'INR',status:Number(payment.amount_refunded||0)>0?'Refunded':'Paid',rewardKeys:keys,paymentId:payment.id,subscriptionId:record.subscriptionId,source:source||'Webhook',note:record.price.discount&&record.price.discount.coupon?'Coupon '+record.price.discount.coupon.code:''});
}

/* ---------- One-time import + daily check ----------
   Run buildPaymentHistory() once from the Apps Script editor. It imports every past PayPal and
   Razorpay payment, switches rewards to the Payments tab and adds a daily check. Safe to run again. */
function buildPaymentHistory(){
  var added=paymentSync_('History import');
  props_().setProperty('PAYMENT_LEDGER','on');
  var exists=ScriptApp.getProjectTriggers().some(function(t){return t.getHandlerFunction()==='dailyPaymentCheck';});
  if(!exists)ScriptApp.newTrigger('dailyPaymentCheck').timeBased().everyDays(1).atHour(4).create();
  var note='Payments tab ready: '+added.paypal+' PayPal and '+added.razorpay+' Razorpay payment(s) added'+(added.skipped?', '+added.skipped+' old subscription(s) PayPal no longer has':'')+'. Rewards now use the Payments tab. A daily check runs at about 4 AM.';
  Logger.log(note);return note;
}
function dailyPaymentCheck(){var r=paymentSync_('Daily check');Logger.log('Daily payment check added '+(r.paypal+r.razorpay)+' payment(s).');return r;}
function paymentSync_(source){
  var added={paypal:0,razorpay:0,skipped:0},ids={};
  var sheet=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ORDERS_SHEET);
  if(sheet&&sheet.getLastRow()>1)sheet.getRange(2,1,sheet.getLastRow()-1,12).getValues().forEach(function(r){if(r[3]===mode_()&&/^I-[A-Z0-9]+$/.test(String(r[1])))ids[String(r[1])]=r[0];});
  commerceRows_().forEach(function(r){if(r[1]===mode_()&&/^I-[A-Z0-9]+$/.test(String(r[11]))&&(r[12]==='accepted'||r[16]))ids[String(r[11])]=ids[String(r[11])]||r[13];});
  Object.keys(ids).forEach(function(id){
    var s;try{s=commercePaypal_('/v1/billing/subscriptions/'+encodeURIComponent(id));}catch(e){if(e.providerStatus===404){added.skipped++;return;}throw e;}
    var start=Date.parse(s.create_time||ids[id]);if(!Number.isFinite(start))start=Date.now()-400*86400000;
    var result=commercePaypal_('/v1/billing/subscriptions/'+encodeURIComponent(id)+'/transactions?start_time='+encodeURIComponent(new Date(start-86400000).toISOString())+'&end_time='+encodeURIComponent(new Date().toISOString()));
    (result.transactions||[]).slice().sort(function(a,b){return Date.parse(a.time)-Date.parse(b.time);}).forEach(function(t){
      var gross=t.amount_with_breakdown&&t.amount_with_breakdown.gross_amount;
      if(!t.id||!gross||!(Number(gross.value)>0))return;
      if(['COMPLETED','REFUNDED','PARTIALLY_REFUNDED'].indexOf(t.status)<0)return;
      var sale={id:t.id,create_time:t.time,amount:{total:gross.value,currency:gross.currency_code}};
      if(paymentFromPaypalSale_(id,sale,source))added.paypal++;
      if(t.status!=='COMPLETED')paymentRefund_(t.id);
    });
  });
  if(typeof razorpayRows_==='function'&&typeof razorpayConnected_==='function'&&razorpayConnected_()){
    var rs=SpreadsheetApp.getActiveSpreadsheet().getSheetByName('RazorpayPayments');
    var receipts=rs&&rs.getLastRow()>1?rs.getRange(2,1,rs.getLastRow()-1,2).getValues():[];
    var records={};razorpayRows_().forEach(function(r){if(r.mode===razorpayMode_()&&r.subscriptionId)records[r.subscriptionId]=r;});
    receipts.forEach(function(x){
      var record=records[String(x[1])];if(!record)return;
      var payment;try{payment=razorpayApi_('/payments/'+encodeURIComponent(String(x[0])));}catch(e){return;}
      if(payment.status!=='captured'&&payment.status!=='refunded')return;
      if(paymentFromRazorpay_(record,payment,source))added.razorpay++;
      if(Number(payment.amount_refunded||0)>0)paymentRefund_(payment.id);
    });
  }
  return added;
}
