import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHmac} from 'node:crypto';
import {service} from './helpers/apps-service.mjs';
import {createRazorpayHandler} from '../supabase/functions/razorpay/handler.js';
function setup(){
 const app=service(),token=app.ctx.makeSession_('buyer@example.com');
 for(const [k,v] of Object.entries({RAZORPAY_MODE:'test',RAZORPAY_ENABLED:'true',RAZORPAY_KEY_ID:'rzp_test_fixture',RAZORPAY_KEY_SECRET:'private-razorpay-test-secret',RAZORPAY_WEBHOOK_SECRET:'private-webhook-test-secret',RAZORPAY_ALLOWED_COUNTRIES:'IN US GB RU'}))app.values.set(k,v);
 app.ctx.Logger={log(){}};app.ctx.setupRazorpayPlans();
 const rpc=(operation,data={})=>app.rpc('razorpay',{operation,...data});
 const selection=(overrides={})=>({accountToken:token,plan:'online',billing:'monthly',seats:1,country:'IN',billingCountry:'IN',requestId:randomUUID(),expectedTotal:91698,...overrides});
 return {app,token,rpc,selection};
}
function paid(s,created,{amount=91698,status='captured',refunded=0}={}){
 const sub=s.app.razorpay.subscriptions.get(created.subscriptionId);sub.status='active';
 const invoice={id:'inv_fixture1',subscription_id:sub.id,payment_id:'pay_fixture1',paid_at:Math.floor(Date.now()/1000),status:'paid',currency:'INR',amount_paid:amount};
 const payment={id:invoice.payment_id,invoice_id:invoice.id,status,captured:status==='captured',currency:'INR',amount,amount_refunded:refunded};
 s.app.razorpay.invoices.set(invoice.id,invoice);s.app.razorpay.payments.set(payment.id,payment);return {sub,invoice,payment};
}
function webhook(s,event){const rawBody=JSON.stringify(event),webhookSignature=createHmac('sha256',s.app.values.get('RAZORPAY_WEBHOOK_SECRET')).update(rawBody).digest('hex');return s.rpc('webhook',{rawBody,webhookSignature});}
test('Razorpay is hidden unless enabled with matching-mode credentials and complete plans; no secrets are public',()=>{
 const app=service();assert.equal(app.rpc('razorpay',{operation:'config'}).enabled,false);
 const s=setup(),config=s.rpc('config');assert(config.enabled);assert.equal(config.mode,'test');assert.equal(config.currency,'INR');assert.deepEqual(config.countries,['IN','US']);assert(!JSON.stringify(config).includes('secret'));assert(!JSON.stringify(config).includes('plan_'));
 s.app.values.set('RAZORPAY_MODE','live');assert.equal(s.rpc('config').enabled,false);
 s.app.values.set('RAZORPAY_MODE','test');s.app.values.set('COMMERCE_ENABLED','false');assert.equal(s.rpc('config').enabled,false);assert.equal(s.rpc('quote',s.selection()).error,'unavailable');
});
test('Razorpay requires verified accounts, exact server/billing country and configured allowed markets',()=>{
 const s=setup();assert.equal(s.rpc('quote',s.selection({accountToken:'forged'})).error,'signin_required');
 assert.equal(s.rpc('quote',s.selection({country:'GB',billingCountry:'GB'})).error,'region');
 assert.equal(s.rpc('quote',s.selection({country:'RU',billingCountry:'RU'})).error,'region');
 assert.equal(s.rpc('quote',s.selection({country:'',billingCountry:'IN'})).error,'region');
 assert.equal(s.rpc('quote',s.selection({country:'IN',billingCountry:'US'})).error,'region');
 s.app.values.set('RAZORPAY_MODE','live');s.app.values.set('RAZORPAY_KEY_ID','rzp_live_fixture');
 assert.equal(s.rpc('quote',s.selection({sandboxCountry:'IN'})).error,'region');
});
test('Razorpay prices are server-owned INR amounts with annual 20% savings and bounded quantities',()=>{
 const s=setup();const quote=s.rpc('quote',s.selection({billing:'yearly',seats:3,amount:1})).pricing;
 assert.equal(quote.unitAmount,880301);assert.equal(quote.total,2640903);assert.equal(quote.planId,undefined);
 assert.equal(s.rpc('quote',s.selection({seats:0})).error,'selection');
 assert.equal(s.rpc('quote',s.selection({seats:101})).error,'selection');
 assert.equal(s.rpc('checkout',s.selection({expectedTotal:1})).error,'price_changed');
 assert.equal(s.app.razorpay.subscriptions.size,0);
});
test('Plan setup is resumable; checkout retries and lost creation responses cannot create duplicate subscriptions',()=>{
 const s=setup();assert.equal(s.app.razorpay.plans.size,16);s.app.ctx.setupRazorpayPlans();assert.equal(s.app.razorpay.plans.size,16);
 const data=s.selection(),one=s.rpc('checkout',data);assert.equal(one.ok,true,JSON.stringify(one));
 assert.equal(s.rpc('checkout',data).subscriptionId,one.subscriptionId);
 assert.equal(s.rpc('checkout',s.selection()).subscriptionId,one.subscriptionId);assert.equal(s.app.razorpay.subscriptions.size,1);
 assert.equal(s.rpc('checkout',{...data,billing:'yearly',expectedTotal:880301}).error,'selection');
 const other=setup(),lost=other.selection();other.app.razorpay.loseCreateResponse=true;
 assert.equal(other.rpc('checkout',lost).ok,false);const recovered=other.rpc('checkout',lost);
 assert.equal(recovered.ok,true);assert.equal(other.app.razorpay.subscriptions.size,1);
});
test('Activation and authorization alone grant no access; captured amount, currency, invoice and billing terms are checked',()=>{
 for(const mutation of ['unpaid','authorized','amount','currency','quantity','note','plan','refund']){
  const s=setup(),c=s.rpc('checkout',s.selection()),p=paid(s,c);
  if(mutation==='unpaid')s.app.razorpay.invoices.clear();
  if(mutation==='authorized'){p.payment.status='authorized';p.payment.captured=false;}
  if(mutation==='amount')p.payment.amount=1;
  if(mutation==='currency')p.payment.currency='USD';
  if(mutation==='quantity')p.sub.quantity=10;
  if(mutation==='note')p.sub.notes.checkout_id=randomUUID();
  if(mutation==='plan')s.app.razorpay.plans.get(p.sub.plan_id).item.amount=1;
  if(mutation==='refund')p.payment.amount_refunded=1;
  const result=s.rpc('confirm',{accountToken:s.token,checkoutId:c.checkoutId});
  assert(!result.accepted,mutation);assert.equal(s.app.orders.rows.length,2,mutation+' creates no new order');assert.equal(s.app.mails.length,0);
 }
});
test('Captured checkout is owner-bound, idempotent, records private receipts and appears in account subscriptions',()=>{
 const s=setup(),c=s.rpc('checkout',s.selection());paid(s,c);
 const other=s.app.register('other@example.com');s.app.mails.length=0;
 assert.equal(s.rpc('confirm',{accountToken:other.token,checkoutId:c.checkoutId}).error,'checkout');
 assert.equal(s.rpc('confirm',{accountToken:s.token,checkoutId:c.checkoutId}).accepted,true);
 assert.equal(s.rpc('confirm',{accountToken:s.token,checkoutId:c.checkoutId}).accepted,true);
 assert.equal(s.app.orders.rows.length,3);assert.equal(s.app.mails.length,2);assert.equal(s.app.sheets.get('RazorpayPayments').rows.length,2);
 const status=s.app.call({step:'status',token:s.token});assert(status.subscriptions.some(sub=>sub.status==='ACTIVE'&&sub.plan==='online'&&sub.seats===1));
});
test('Signed webhook grants access without browser confirmation and duplicate deliveries do not duplicate receipts or emails',()=>{
 const s=setup(),c=s.rpc('checkout',s.selection()),p=paid(s,c),event={event:'subscription.charged',payload:{subscription:{entity:p.sub}}};
 assert.equal(s.rpc('webhook',{rawBody:JSON.stringify(event),webhookSignature:'0'.repeat(64)}).error,'signature');
 assert.equal(webhook(s,event).accepted,true);assert.equal(webhook(s,event).accepted,true);assert.equal(s.app.mails.length,2);assert.equal(s.app.sheets.get('RazorpayPayments').rows.length,2);
 const packet=s.app.envelope({action:'razorpay',operation:'webhook',rawBody:JSON.stringify(event),webhookSignature:'x'});packet.signature='forged';assert.equal(s.app.ctx.handleCommerceEnvelope_(packet).error,'signature');
});
test('Cancelling after a captured payment retains that paid period; unpaid expired checkout permits a fresh attempt',()=>{
 const s=setup(),c=s.rpc('checkout',s.selection()),p=paid(s,c);p.sub.status='cancelled';
 assert.equal(s.rpc('confirm',{accountToken:s.token,checkoutId:c.checkoutId}).accepted,true);
 const account=s.app.call({step:'status',token:s.token});assert(account.subscriptions.some(item=>item.status==='CANCELLED'&&item.endsAt&&item.renews===false));
 const other=setup(),old=other.rpc('checkout',other.selection());other.app.razorpay.subscriptions.get(old.subscriptionId).status='expired';
 assert.equal(other.rpc('confirm',{accountToken:other.token,checkoutId:old.checkoutId}).status,'expired');
 const fresh=other.rpc('checkout',other.selection());assert.notEqual(fresh.subscriptionId,old.subscriptionId);
});
test('Renewals require a new captured invoice; old invoices do not extend access and refunds remove the paid period',()=>{
 const s=setup(),c=s.rpc('checkout',s.selection()),p=paid(s,c);webhook(s,{event:'subscription.charged',payload:{subscription:{entity:p.sub}}});
 const original=s.app.ctx.razorpayFind_(c.checkoutId).paidThrough;
 p.sub.current_start+=30*86400;p.sub.current_end+=30*86400;
 s.rpc('confirm',{accountToken:s.token,checkoutId:c.checkoutId});assert.equal(s.app.ctx.razorpayFind_(c.checkoutId).paidThrough,original);
 const invoice={...p.invoice,id:'inv_fixture2',payment_id:'pay_fixture2',paid_at:p.sub.current_start+5},payment={...p.payment,id:'pay_fixture2',invoice_id:'inv_fixture2'};
 s.app.razorpay.invoices.set(invoice.id,invoice);s.app.razorpay.payments.set(payment.id,payment);
 webhook(s,{event:'subscription.charged',payload:{subscription:{entity:p.sub}}});assert.equal(s.app.ctx.razorpayFind_(c.checkoutId).paidThrough,p.sub.current_end);
 assert.equal(s.app.sheets.get('RazorpayPayments').rows.length,3);payment.amount_refunded=payment.amount;
 webhook(s,{event:'refund.processed',payload:{refund:{entity:{payment_id:payment.id}}}});assert.equal(s.app.ctx.razorpayFind_(c.checkoutId).paidThrough,0);
 const account=s.app.call({step:'status',token:s.token});assert(account.subscriptions.some(item=>item.status==='EXPIRED'));
});
test('Hiding Razorpay stops new checkouts without losing already-approved payments or renewals',()=>{
 const s=setup(),c=s.rpc('checkout',s.selection()),p=paid(s,c);
 s.app.values.set('RAZORPAY_ENABLED','false');assert.equal(s.rpc('config').enabled,false);assert.equal(s.rpc('quote',s.selection()).error,'unavailable');
 assert.equal(webhook(s,{event:'subscription.charged',payload:{subscription:{entity:p.sub}}}).accepted,true);
 assert.equal(s.rpc('confirm',{accountToken:s.token,checkoutId:c.checkoutId}).accepted,true);
});
test('Edge function rejects forged origins/sessions and uses only trusted server geography, not browser country claims',async()=>{
 const s=setup(),calls=[];
 const env=k=>({SHEET_WEB_APP_URL:'https://script.google.com/macros/s/FIXTURE/exec',COMMERCE_CLIENT_IP_HEADER:'cf-connecting-ip'}[k]||s.app.values.get(k));
 const handler=createRazorpayHandler({env,request:async(url,options)=>{
  calls.push(url);if(url.startsWith('https://api.country.is/'))return Response.json({country:'IN'});
  return Response.json(JSON.parse(s.app.ctx.doPost({postData:{contents:options.body}}).text));
 }});
 const req=(path,body,origin='https://imajoy.github.io',ip='8.8.8.8')=>new Request('https://project.supabase.co/functions/v1/razorpay/'+path,{method:body?'POST':'GET',headers:{Origin:origin,...(ip?{'cf-connecting-ip':ip}:{})},...(body?{body:JSON.stringify(body)}:{})});
 assert.equal((await handler(req('config',null,'https://evil.test'))).status,403);assert.equal(calls.length,0);
 assert.equal((await handler(req('quote',{}))).status,401);
 assert.equal((await handler(req('quote',{accountToken:s.token,plan:'online',billing:'monthly',seats:1,country:'IN'}))).status,200);
 assert.equal((await handler(req('quote',{accountToken:s.token,plan:'online',billing:'monthly',seats:1,country:'US'}))).status,409);
 assert.equal((await handler(req('quote',{accountToken:s.token,plan:'online',billing:'monthly',seats:1,country:'IN'},undefined,''))).status,409);
 assert.equal((await handler(req('webhook',{event:'subscription.charged'},''))).status,400);
});
test('Closing the Razorpay window or a failed payment cancels only the unpaid checkout; a paid one is confirmed instead',()=>{
 const s=setup(),created=s.rpc('checkout',s.selection());assert(created.ok,JSON.stringify(created));
 assert.equal(s.rpc('config').keyId,'rzp_test_fixture');
 const other=s.app.register('other@example.com');assert.equal(s.rpc('cancel',{accountToken:other.token,checkoutId:created.checkoutId}).error,'checkout');
 const cancelled=s.rpc('cancel',{accountToken:s.token,checkoutId:created.checkoutId});assert(cancelled.cancelled,JSON.stringify(cancelled));
 assert.equal(s.app.razorpay.subscriptions.get(created.subscriptionId).status,'cancelled');
 const again=s.rpc('checkout',s.selection());assert(again.ok);assert.notEqual(again.checkoutId,created.checkoutId,'a cancelled checkout must not be reused');
 paid(s,again);s.app.razorpay.subscriptions.get(again.subscriptionId).paid_count=1;
 const late=s.rpc('cancel',{accountToken:s.token,checkoutId:again.checkoutId});assert(late.accepted,'a paid subscription is confirmed, never cancelled');
 assert.equal(s.app.razorpay.subscriptions.get(again.subscriptionId).status,'active');
});
test('A subscriber can stop automatic renewal; access continues to the end of the paid period',()=>{
 const s=setup(),created=s.rpc('checkout',s.selection());paid(s,created);
 assert(s.rpc('confirm',{accountToken:s.token,checkoutId:created.checkoutId}).accepted);
 const unpaid=s.rpc('checkout',s.selection({billing:'yearly',expectedTotal:880301}));assert.equal(s.rpc('stop',{accountToken:s.token,checkoutId:unpaid.checkoutId}).error,'checkout');
 const stopped=s.rpc('stop',{accountToken:s.token,checkoutId:created.checkoutId});assert(stopped.stopped,JSON.stringify(stopped));assert(Date.parse(stopped.endsAt)>Date.now());
 assert.deepEqual(s.app.razorpay.cancelled.at(-1),{id:created.subscriptionId,atCycleEnd:true});
 const subs=s.app.ctx.razorpaySubscriptions_('buyer@example.com');assert.equal(subs[0].renews,false);assert.equal(subs[0].provider,'razorpay');assert.equal(subs[0].ref,created.checkoutId);
});
test('Owner test reset clears test purchases for the test account only and refuses live mode',()=>{
 const s=setup(),created=s.rpc('checkout',s.selection());assert.equal(created.ok,true);
 const {sub}=paid(s,created);assert.equal(s.rpc('confirm',{accountToken:s.token,checkoutId:created.checkoutId}).accepted,true);
 assert(s.app.call({step:'status',token:s.token}).subscriptions.some(x=>x.provider==='razorpay'));
 s.app.ctx.Session={getEffectiveUser:()=>({getEmail:()=>'buyer@example.com'})};
 assert.match(s.app.ctx.resetTestPurchases(),/1 test checkout\(s\) cleared, 1 Razorpay test subscription\(s\) cancelled, 1 Orders row/);
 assert.equal(sub.status,'cancelled');
 assert.notEqual(s.rpc('confirm',{accountToken:s.token,checkoutId:created.checkoutId}).accepted,true);
 assert(!s.app.call({step:'status',token:s.token}).subscriptions.some(x=>x.provider==='razorpay'),'reset purchase no longer shows on the account');
 assert.equal(s.app.ctx.razorpayFind_(created.checkoutId).state,'reset');
 s.app.values.set('RAZORPAY_MODE','live');assert.throws(()=>s.app.ctx.resetTestPurchases(),/LIVE mode/);
});
test('Razorpay 2-day trial: authorize now, access until trial end, one trial per person, cancel stops the first charge, conversion on day 3',()=>{
 const s=setup(),hex=c=>c.repeat(64),signals={deviceHash:hex('a'),ipHash:hex('b')};
 assert.equal(s.rpc('config').trial,true);
 assert.equal(s.rpc('checkout',s.selection({plan:'offline',offer:'trial',expectedTotal:91698*2,...signals})).error,'selection');
 const created=s.rpc('checkout',s.selection({offer:'trial',...signals}));assert.equal(created.ok,true,created.message);assert.equal(created.offer,'trial');
 const sub=s.app.razorpay.subscriptions.get(created.subscriptionId);
 assert(Math.abs(sub.start_at-(Date.now()/1000+2*86400))<5,'first charge is scheduled for the end of the trial');
 assert.notEqual(s.rpc('confirm',{accountToken:s.token,checkoutId:created.checkoutId}).accepted,true,'no access before the mandate is authorized');
 sub.status='authenticated';sub.paid_count=0;
 const ok=s.rpc('confirm',{accountToken:s.token,checkoutId:created.checkoutId});assert.equal(ok.accepted,true);assert.equal(ok.offer,'trial');
 assert(s.app.orders.rows.some(r=>r[1]===sub.id&&r[7]==='online trial'));
 let item=s.app.call({step:'status',token:s.token}).subscriptions.find(x=>x.provider==='razorpay');
 assert.equal(item.trial,true);assert.equal(item.renews,true);assert.equal(item.status,'ACTIVE');assert(Math.abs(Date.parse(item.endsAt)/1000-sub.start_at)<2);
 // One trial per person: same account, and same browser on another account.
 assert.equal(s.rpc('checkout',s.selection({offer:'trial',...signals})).error,'trial_used');
 const other=s.app.register('other@example.com');
 assert.equal(s.rpc('checkout',s.selection({accountToken:other.token,offer:'trial',deviceHash:hex('a'),ipHash:hex('c')})).error,'trial_used');
 assert.equal(s.app.rpc('eligibility',{accountToken:s.token,deviceHash:hex('d'),ipHash:hex('e'),country:'IN'}).reason,'trial_used','PayPal trial is refused after a Razorpay trial');
 // Paid checkout still works for the same person.
 assert.equal(s.rpc('checkout',s.selection({offer:'standard'})).ok,true);
 // Conversion after the trial.
 sub.status='active';sub.paid_count=1;sub.current_start=Math.floor(Date.now()/1000);sub.current_end=sub.current_start+30*86400;
 const invoice={id:'inv_trial',subscription_id:sub.id,payment_id:'pay_trial',paid_at:Math.floor(Date.now()/1000),status:'paid',currency:'INR',amount_paid:91698};
 s.app.razorpay.invoices.set(invoice.id,invoice);s.app.razorpay.payments.set('pay_trial',{id:'pay_trial',invoice_id:invoice.id,status:'captured',captured:true,currency:'INR',amount:91698,amount_refunded:0});
 assert.equal(webhook(s,{event:'subscription.charged',payload:{subscription:{entity:{id:sub.id}}}}).accepted,true);
 const record=s.app.ctx.razorpayFind_(created.checkoutId);assert.equal(record.paidThrough,sub.current_end);assert(record.convertedAt);
 assert(s.app.mails.some(m=>/trial converted/.test(m.subject)));
 item=s.app.call({step:'status',token:s.token}).subscriptions.find(x=>x.provider==='razorpay'&&x.ref===created.checkoutId);assert.equal(item.trial,false);
});
test('Cancelling a Razorpay trial cancels the mandate at once and keeps access until the trial ends',()=>{
 const s=setup(),created=s.rpc('checkout',s.selection({offer:'trial',deviceHash:'f'.repeat(64),ipHash:'e'.repeat(64)}));
 const sub=s.app.razorpay.subscriptions.get(created.subscriptionId);sub.status='authenticated';sub.paid_count=0;
 assert.equal(s.rpc('confirm',{accountToken:s.token,checkoutId:created.checkoutId}).accepted,true);
 assert.equal(s.app.call({step:'cancel',token:s.token,provider:'razorpay',ref:created.checkoutId}).ok,true);
 assert.equal(sub.status,'cancelled','no payment will be taken');
 const item=s.app.call({step:'status',token:s.token}).subscriptions.find(x=>x.provider==='razorpay');
 assert.equal(item.renews,false);assert.equal(item.status,'CANCELLED');assert(Date.parse(item.endsAt)>Date.now()+86400e3);
 // Closing the Razorpay window after authorizing must not cancel the trial.
 const again=s.app.register('x@example.com'),c2=s.rpc('checkout',s.selection({accountToken:again.token,offer:'trial',deviceHash:'1'.repeat(64),ipHash:'2'.repeat(64)}));
 const sub2=s.app.razorpay.subscriptions.get(c2.subscriptionId);sub2.status='authenticated';sub2.paid_count=0;
 assert.equal(s.rpc('cancel',{accountToken:again.token,checkoutId:c2.checkoutId}).accepted,true);assert.equal(sub2.status,'authenticated');
});
function coupons(app,rows){app.ctx.couponSheet_();const sheet=app.sheets.get('Coupons');rows.forEach(r=>sheet.appendRow(r));return sheet;}
test('Coupons work with Razorpay: discounted period(s) up front, regular price after, country limits respected, one use per buyer',()=>{
 const s=setup(),future=new Date(Date.now()+30*864e5);
 coupons(s.app,[['SAVE10',10,1,future,'both','both','','',true,'',''],['USONLY',20,1,future,'both','both','','',true,'','US, GB'],['INDIA25',25,2,future,'both','monthly','','',true,'','IN']]);
 assert.equal(s.rpc('quote',s.selection({coupon:'USONLY'})).error,'coupon_invalid','country-limited coupon is refused elsewhere');
 const q=s.rpc('quote',s.selection({coupon:'save10'})).pricing;
 assert.equal(q.discount.percent,10);assert.equal(q.total,82528);assert.equal(q.recurringTotal,91698);assert.equal(q.upfront,true);
 const two=s.rpc('quote',s.selection({coupon:'INDIA25',seats:2})).pricing;assert.equal(two.total,Math.round(91698*.75)*2*2,'2 discounted months for 2 licenses, paid today');
 const created=s.rpc('checkout',s.selection({coupon:'SAVE10',expectedTotal:82528}));assert.equal(created.ok,true,created.message);
 const sub=s.app.razorpay.subscriptions.get(created.subscriptionId);
 assert.equal(sub.addons[0].item.amount,82528);const month=new Date();month.setMonth(month.getMonth()+1);assert(Math.abs(sub.start_at-month/1000)<10,'regular billing starts after the discounted month');
 // Up-front payment taken at authorization.
 sub.status='authenticated';sub.paid_count=0;sub.current_start=null;sub.current_end=null;
 const inv={id:'inv_up',subscription_id:sub.id,payment_id:'pay_up',paid_at:Math.floor(Date.now()/1000),status:'paid',currency:'INR',amount_paid:82528};
 s.app.razorpay.invoices.set(inv.id,inv);s.app.razorpay.payments.set('pay_up',{id:'pay_up',invoice_id:inv.id,status:'captured',captured:true,currency:'INR',amount:82528,amount_refunded:0});
 const ok=s.rpc('confirm',{accountToken:s.token,checkoutId:created.checkoutId});assert.equal(ok.accepted,true,ok.message);
 assert.equal(s.app.ctx.razorpayFind_(created.checkoutId).paidThrough,sub.start_at);
 assert.equal(s.app.sheets.get('Coupons').rows[1][7],1,'coupon use is counted');
 assert.equal(s.rpc('quote',s.selection({coupon:'SAVE10'})).error,'coupon_used');
 const item=s.app.call({step:'status',token:s.token}).subscriptions.find(x=>x.provider==='razorpay');assert.equal(item.status,'ACTIVE');assert.equal(item.renews,true);
 // First regular charge at the full price extends access.
 sub.status='active';sub.current_start=sub.start_at;sub.current_end=sub.start_at+30*86400;
 const inv2={id:'inv_reg',subscription_id:sub.id,payment_id:'pay_reg',paid_at:sub.start_at+60,status:'paid',currency:'INR',amount_paid:91698};
 s.app.razorpay.invoices.set(inv2.id,inv2);s.app.razorpay.payments.set('pay_reg',{id:'pay_reg',invoice_id:inv2.id,status:'captured',captured:true,currency:'INR',amount:91698,amount_refunded:0});
 webhook(s,{event:'subscription.charged',payload:{subscription:{entity:{id:sub.id}}}});
 assert.equal(s.app.ctx.razorpayFind_(created.checkoutId).paidThrough,sub.current_end);
});
test('PayPal coupons respect the Countries column; blank means every country',()=>{
 const s=setup(),future=new Date(Date.now()+30*864e5);
 coupons(s.app,[['ALL5',5,1,future,'both','both','','',true,'',''],['INONLY',5,1,future,'both','both','','',true,'','IN']]);
 const sel={accountToken:s.token,plan:'online',billing:'monthly',seats:1,country:'US',billingCountry:'US',offer:'standard',requestId:randomUUID()};
 assert.equal(s.app.rpc('rewards',{...sel,coupon:'ALL5'}).pricing.percent,5);
 assert.equal(s.app.rpc('rewards',{...sel,coupon:'INONLY'}).error,'coupon_invalid');
});
