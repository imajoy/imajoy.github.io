import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {service} from './helpers/apps-service.mjs';
const selection=(app,extra={})=>({accountToken:app.ctx.makeSession_('buyer@example.com'),plan:'online',billing:'monthly',seats:1,country:'US',billingCountry:'US',offer:'standard',requestId:randomUUID(),...extra});
const receipt=(id,status='COMPLETED',value='22.44',time)=>({id,status,time,amount_with_breakdown:{gross_amount:{value,currency_code:'USD'}}});
function paidHistory(app,count){
 app.subscriptions.set('I-TESTBUYER1',{id:'I-TESTBUYER1',status:'ACTIVE',plan_id:app.orders.rows[1][11],create_time:'2026-01-01T00:00:00Z'});
 app.transactions.set('I-TESTBUYER1',{transactions:Array.from({length:count},(_,i)=>receipt('PAID-'+i,'COMPLETED','22.44',`2026-${String(i+1).padStart(2,'0')}-02T00:00:00Z`))});
}
function withTriggers(app){const triggers=[];app.ctx.Logger={log(){}};app.ctx.ScriptApp={getProjectTriggers:()=>triggers,newTrigger:name=>({timeBased:()=>({everyDays:()=>({atHour:()=>({create:()=>{triggers.push({getHandlerFunction:()=>name});}})})})})};return triggers;}
const payments=app=>app.sheets.get('Payments')?.rows.slice(1)||[];
const paypalCalls=app=>app.requests.filter(r=>/\/v1\/billing\/subscriptions\/I-/.test(r.url||r)).length;

test('History import fills the Payments tab once, switches rewards to it and installs one daily check',()=>{
 const app=service(),triggers=withTriggers(app);paidHistory(app,1);
 const before=app.rpc('rewards',selection(app));assert.equal(before.pricing.percent,5,'old method: 2nd monthly payment is 5% off');
 const note=app.ctx.buildPaymentHistory();assert.match(note,/1 PayPal and 0 Razorpay payment/);
 assert.equal(payments(app).length,1);const row=payments(app)[0];
 assert.deepEqual([row[1],row[2],row[3],row[4],row[5],row[7],row[8],row[9],row[10],row[12],row[13],row[14]],['buyer@example.com','PayPal','Test','Online','Monthly',22.44,'USD','Paid','Yes','PAID-0','I-TESTBUYER1','History import']);
 assert.equal(app.values.get('PAYMENT_LEDGER'),'on');assert.equal(triggers.length,1);
 app.ctx.buildPaymentHistory();assert.equal(payments(app).length,1,'running again adds nothing');assert.equal(triggers.length,1);
 const calls=paypalCalls(app);
 const after=app.rpc('rewards',selection(app));assert.equal(after.pricing.percent,5,'same reward from the Payments tab');
 assert.equal(paypalCalls(app),calls,'rewards no longer ask PayPal for old subscriptions');
});
test('A missing old PayPal subscription is skipped by the import instead of failing',()=>{
 const app=service();withTriggers(app);app.paypalMissing.add('I-TESTBUYER1');
 assert.match(app.ctx.buildPaymentHistory(),/0 PayPal .* 1 old subscription/);
 assert.equal(app.rpc('rewards',selection(app)).pricing.percent,0);
});
test('Signed PayPal sale notifications add a row once; refunds stop it counting but keep a used reward used',()=>{
 const app=service();withTriggers(app);paidHistory(app,0);app.ctx.buildPaymentHistory();
 const sale=(id,t)=>({headers:{},event:{id:'EV-'+id,event_type:'PAYMENT.SALE.COMPLETED',resource:{id,billing_agreement_id:'I-TESTBUYER1',state:'completed',create_time:t,amount:{total:'22.44',currency:'USD'}}}});
 app.rpc('webhook',sale('SALE-1','2026-09-02T00:00:00Z'));app.rpc('webhook',sale('SALE-1','2026-09-02T00:00:00Z'));
 assert.equal(payments(app).length,1,'duplicates are ignored');
 assert.equal(app.rpc('rewards',selection(app)).pricing.percent,5);
 app.rpc('webhook',{headers:{},event:{id:'EV-R',event_type:'PAYMENT.SALE.REFUNDED',resource:{id:'REFUND-1',sale_id:'SALE-1'}}});
 assert.equal(payments(app)[0][9],'Refunded');
 assert.equal(app.rpc('rewards',selection(app)).pricing.percent,0,'a refunded payment no longer counts');
});
test('Owner rows: a Manual payment counts, "Counts for rewards = No" is ignored, other emails never mix',()=>{
 const app=service();withTriggers(app);paidHistory(app,0);app.ctx.buildPaymentHistory();
 const sheet=app.ctx.paymentsSheet_();
 sheet.appendRow([new Date('2026-08-05'),'buyer@example.com','Manual','Test','Online','Monthly',1,22.44,'USD','Paid','No','','BANK-1','','Manual','Bank transfer']);
 assert.equal(app.rpc('rewards',selection(app)).pricing.percent,0);
 sheet.rows[sheet.rows.length-1][10]='Yes';
 sheet.appendRow([new Date('2026-08-05'),'someone@else.com','Manual','Test','Online','Monthly',1,22.44,'USD','Paid','Yes','','BANK-2','','Manual','']);
 assert.equal(app.rpc('rewards',selection(app)).pricing.percent,5);
 sheet.appendRow([new Date('2026-09-05'),'buyer@example.com','Manual','Test','Online','Monthly',1,22.44,'USD','Paid','Yes','2nd monthly 5%, 3rd monthly 5%','BANK-3','','Manual','']);
 assert.equal(app.rpc('rewards',selection(app)).pricing.percent,0,'both monthly rewards are already used');
});
test('Payments are written straight under the header even when the guide on the right makes the sheet taller',()=>{
 const app=service();withTriggers(app);paidHistory(app,2);
 const sheet=app.ctx.paymentsSheet_();for(let r=1;r<=12;r++){sheet.rows[r]=sheet.rows[r]||[];sheet.rows[r][17]='Guide line '+r;}
 app.ctx.buildPaymentHistory();
 assert.equal(sheet.rows[1][12],'PAID-0');assert.equal(sheet.rows[2][12],'PAID-1');assert.equal(sheet.rows[3][12]??'','');
 assert.equal(sheet.rows[1][17],'Guide line 1','the guide is untouched');
 assert.equal(app.rpc('rewards',selection(app)).pricing.percent,5,'3rd monthly payment');
});

test('Partial or wrong-currency ledger payments cannot qualify; original catalog prices still qualify',()=>{
 const app=service();app.values.set('PAYMENT_LEDGER','on');
 const sale=(id,value,currency='USD',month='09')=>app.ctx.paymentFromPaypalSale_('I-TESTBUYER1',{id,create_time:`2026-${month}-02T00:00:00Z`,amount:{total:value,currency}},'Regression');
 sale('ONE-CENT','0.01');assert.equal(app.ctx.paymentHistory_('buyer@example.com').monthly,0);
 sale('PRORATED','10.00');assert.equal(app.ctx.paymentHistory_('buyer@example.com').monthly,0);
 sale('WRONG-CURRENCY','100.00','INR');assert.equal(app.ctx.paymentHistory_('buyer@example.com').monthly,0);
 sale('FULL-OLD-RATE','22.00');assert.equal(app.ctx.paymentHistory_('buyer@example.com').monthly,1);
 sale('DUPLICATE-PERIOD','22.00');assert.equal(app.ctx.paymentHistory_('buyer@example.com').monthly,1);
 app.ctx.paymentRefund_('FULL-OLD-RATE');app.ctx.paymentRefund_('DUPLICATE-PERIOD');assert.equal(app.ctx.paymentHistory_('buyer@example.com').monthly,0);
});
test('Ledger qualification uses the purchased license count, not editable receipt fields',()=>{
 const app=service();app.orders.rows[1][9]=3;
 const sale=(id,value)=>app.ctx.paymentFromPaypalSale_('I-TESTBUYER1',{id,create_time:'2026-09-02T00:00:00Z',amount:{total:value,currency:'USD'}},'Regression');
 sale('ONE-SEAT','22.00');app.sheets.get('Payments').rows[1][6]=1;
 assert.equal(app.ctx.paymentHistory_('buyer@example.com').monthly,0);
 sale('THREE-SEATS','66.00');assert.equal(app.ctx.paymentHistory_('buyer@example.com').monthly,1);
});
test('Discounted introductory receipts qualify and subsequent full periods require the agreed standard rate',()=>{
 const app=service();app.values.set('PAYMENT_LEDGER','on');
 app.ctx.paymentFromPaypalSale_('I-TESTBUYER1',{id:'PAST',create_time:'2026-01-02T00:00:00Z',amount:{total:'22.00',currency:'USD'}},'Regression');
 const checkout=app.rpc('checkout',selection(app));assert(checkout.ok,JSON.stringify(checkout));
 const sale=(id,value,month)=>app.ctx.paymentFromPaypalSale_(checkout.subscriptionId,{id,create_time:`2026-${month}-02T00:00:00Z`,amount:{total:value,currency:'USD'}},'Regression');
 sale('INTRO-1','21.32','02');sale('INTRO-2','21.32','03');sale('UNDERPAID-REGULAR','21.32','04');
 assert.equal(app.ctx.paymentHistory_('buyer@example.com').monthly,3);
 sale('FULL-REGULAR','22.44','04');assert.equal(app.ctx.paymentHistory_('buyer@example.com').monthly,4);
 app.ctx.paymentRefund_('INTRO-1');assert.equal(app.ctx.paymentHistory_('buyer@example.com').monthly,3);
 assert(app.ctx.paymentHistory_('buyer@example.com').used.monthly_second);
});
test('Ledger mode releases cancelled or expired reward reservations, while pending/active or unverifiable ones stay protected',()=>{
 for(const status of ['CANCELLED','EXPIRED','APPROVAL_PENDING','ACTIVE','UNAVAILABLE']){
  const app=service();app.values.set('PAYMENT_LEDGER','on');
  app.ctx.paymentFromPaypalSale_('I-TESTBUYER1',{id:'PAST',create_time:'2026-01-02T00:00:00Z',amount:{total:'22.00',currency:'USD'}},'Regression');
  const first=app.rpc('checkout',selection(app));assert(first.ok,JSON.stringify(first));
  app.subscriptions.get(first.subscriptionId).status=status;
  if(status==='UNAVAILABLE'){
   const fetch=app.ctx.UrlFetchApp.fetch;
   app.ctx.UrlFetchApp.fetch=(url,options)=>url.endsWith('/subscriptions/'+first.subscriptionId)?{getResponseCode:()=>503,getContentText:()=> '{}'}:fetch(url,options);
  }
  const result=app.rpc('checkout',selection(app,{seats:2}));
  if(['CANCELLED','EXPIRED'].includes(status)){assert(result.ok,JSON.stringify(result));assert.notEqual(result.subscriptionId,first.subscriptionId);}
  else {assert.equal(result.ok,false);assert.equal(result.error,status==='UNAVAILABLE'?'provider':'reward_reserved');}
 }
});
test('A stale pre-fix history cache cannot keep granting credit for a partial receipt',()=>{
 const app=service();app.values.set('PAYMENT_LEDGER','on');app.options.keepHistoryCache=true;
 app.ctx.paymentFromPaypalSale_('I-TESTBUYER1',{id:'TINY',create_time:'2026-01-02T00:00:00Z',amount:{total:'0.01',currency:'USD'}},'Regression');
 app.cache.set('rh:sandbox:buyer@example.com',JSON.stringify({monthly:1,yearly:0,used:{},statuses:{},receipts:['TINY']}));
 const quote=app.rpc('rewards',selection(app));assert.equal(quote.pricing.percent,0);
 assert.equal(JSON.parse(app.cache.get('rh:sandbox:buyer@example.com')).ledgerVersion,2);
});
test('Razorpay ledger requires the full purchased amount and counts paid upfront periods once',()=>{
 const app=service();app.values.set('RAZORPAY_MODE','test');
 const record={id:randomUUID(),subscriptionId:'sub_ledger',mode:'test',email:'buyer@example.com',price:{plan:'online',billing:'monthly',seats:2,unitAmount:91698,total:165056,upfront:true,recurringTotal:183396,discount:{payments:1,percent:10}},accepted:true};
 app.ctx.razorpayWrite_(record);
 const payment=(id,amount)=>app.ctx.paymentFromRazorpay_(record,{id,amount,created_at:Date.parse('2026-09-02T00:00:00Z')/1000},'Regression');
 payment('pay_tiny',100);assert.equal(app.ctx.paymentHistory_('buyer@example.com').monthly,0);
 payment('pay_full',165056);assert.equal(app.ctx.paymentHistory_('buyer@example.com').monthly,1);
 app.ctx.paymentRefund_('pay_full');assert.equal(app.ctx.paymentHistory_('buyer@example.com').monthly,0);
 // Two discounted months paid together represent two paid periods, not two seats.
 record.subscriptionId='sub_prepaid';record.price.seats=1;record.price.discount.payments=2;record.price.total=165056;app.ctx.razorpayWrite_({...record,id:randomUUID()});
 payment('pay_prepaid',165056);payment('pay_prepaid',165056);
 assert.equal(app.ctx.paymentHistory_('buyer@example.com').monthly,2);
});
