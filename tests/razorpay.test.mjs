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
 const selection=(overrides={})=>({accountToken:token,plan:'online',billing:'monthly',seats:1,country:'IN',billingCountry:'IN',requestId:randomUUID(),expectedTotal:89900,...overrides});
 return {app,token,rpc,selection};
}
function paid(s,created,{amount=89900,status='captured',refunded=0}={}){
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
 assert.equal(quote.unitAmount,863040);assert.equal(quote.total,2589120);assert.equal(quote.planId,undefined);
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
 assert.equal(s.rpc('checkout',{...data,billing:'yearly',expectedTotal:863040}).error,'selection');
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
