import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {service} from './helpers/apps-service.mjs';
const selection=(app,extra={})=>({accountToken:app.ctx.makeSession_('buyer@example.com'),plan:'online',billing:'monthly',seats:1,country:'US',billingCountry:'US',offer:'standard',requestId:randomUUID(),...extra});
const receipt=(id,status='COMPLETED',value='22.00',time=new Date().toISOString())=>({id,status,time,amount_with_breakdown:{gross_amount:{value,currency_code:'USD'}}});
function history(app,count,billing='monthly'){
 app.orders.rows[1][8]=billing;app.orders.rows[1][11]=billing==='yearly'?'P-high-YEARLY':'P-high-ONLINE';
 app.subscriptions.set('I-TESTBUYER1',{id:'I-TESTBUYER1',status:'CANCELLED',plan_id:app.orders.rows[1][11],create_time:'2023-01-01T00:00:00Z'});
 app.transactions.set('I-TESTBUYER1',{transactions:Array.from({length:count},(_,i)=>receipt('PAID-'+i,'COMPLETED',billing==='yearly'?'211.00':'22.00',billing==='yearly'?`${2024+i}-01-01T00:00:00Z`:`2026-${String(i+1).padStart(2,'0')}-01T00:00:00Z`))});
}
function approve(app,created){app.subscriptions.get(created.subscriptionId).status='ACTIVE';return app.rpc('confirm',{accountToken:app.ctx.makeSession_('buyer@example.com'),checkoutId:created.checkoutId});}
test('Active checkout verifies paid transactions: monthly payments 2 and 3 receive 5%, never 10%, then stop',()=>{
 for(const [paid,percent] of [[0,0],[1,5],[2,5],[3,0],[8,0]]){
  const app=service();history(app,paid);const data=selection(app),quote=app.rpc('rewards',data);
  assert.equal(quote.pricing.percent,percent);assert.equal(quote.pricing.total,percent?2849:2999);
  const created=app.rpc('checkout',{...data,expectedTotal:quote.pricing.total,expectedRewardPercent:percent});assert(created.ok,JSON.stringify(created));
  assert.equal(created.pricing.percent,percent);const sub=app.subscriptions.get(created.subscriptionId);
  if(percent){const plan=[...app.plans.values()][0];assert.equal(sub.plan_id,plan.id);assert.equal(plan.billing_cycles[0].pricing_scheme.fixed_price.value,'28.49');assert.equal(plan.billing_cycles[0].total_cycles,paid===1?2:1);assert.equal(plan.billing_cycles[1].pricing_scheme.fixed_price.value,'29.99');assert.equal(plan.billing_cycles[1].total_cycles,0);}
  else assert.equal(app.plans.size,0);
 }
});
test('Second annual payment gets 10% off the yearly catalog rate once, with no monthly history cross-over',()=>{
 for(const [paid,percent] of [[0,0],[1,10],[2,0]]){
  const app=service();history(app,paid,'yearly');const data=selection(app,{billing:'yearly',seats:3}),quote=app.rpc('rewards',data);
  assert.equal(quote.pricing.percent,percent);assert.equal(quote.pricing.total,(percent?25911:28790)*3);
  const created=app.rpc('checkout',data);assert(created.ok,JSON.stringify(created));
  if(percent){const plan=[...app.plans.values()][0];assert.equal(plan.billing_cycles[0].total_cycles,1);assert.equal(plan.billing_cycles[0].pricing_scheme.fixed_price.value,'259.11');assert.equal(plan.billing_cycles[1].pricing_scheme.fixed_price.value,'287.90');}
 }
 const app=service();history(app,2);assert.equal(app.rpc('rewards',selection(app,{billing:'yearly'})).pricing.percent,0);
});
test('Free, failed, pending and refunded payments do not advance eligibility; license count does not multiply periods',()=>{
 const app=service();history(app,0);app.orders.rows[1][9]=99;
 app.transactions.set('I-TESTBUYER1',{transactions:[receipt('PENDING','PENDING'),receipt('FAILED','FAILED'),receipt('FREE','COMPLETED','0.00'),receipt('REFUND','REFUNDED')]});
 assert.equal(app.rpc('rewards',selection(app)).pricing.percent,0);
 app.transactions.get('I-TESTBUYER1').transactions.push(receipt('REAL','COMPLETED','2178.00'));
 const q=app.rpc('rewards',selection(app,{seats:99})).pricing;assert.equal(q.nextPayment,2);assert.equal(q.percent,5);assert.equal(q.total,2849*99);
});
test('Reserved rewards resume after reload, competing checkouts cannot claim them, repeated requests are idempotent',()=>{
 const app=service();history(app,1);const data=selection(app),first=app.rpc('checkout',data);assert(first.ok);
 assert.equal(app.rpc('checkout',data).subscriptionId,first.subscriptionId);
 assert.equal(app.rpc('checkout',selection(app)).subscriptionId,first.subscriptionId,'reload resumes pending checkout');
 const competing=app.rpc('checkout',selection(app,{seats:2}));assert.equal(competing.error,'reward_reserved');assert.equal(app.subscriptions.size,2);
 app.subscriptions.get(first.subscriptionId).status='CANCELLED';assert(app.rpc('checkout',selection(app,{seats:2})).ok,'an unpaid cancelled checkout releases its reservation');
});
test('Completed reward payments consume each promised reward once; refunds and cancellation do not restore them',()=>{
 const app=service();history(app,1);const created=app.rpc('checkout',selection(app));assert(approve(app,created).accepted);
 app.transactions.set(created.subscriptionId,{transactions:[receipt('REWARD-2','COMPLETED','20.90','2026-09-01T00:00:00Z'),receipt('REWARD-3','COMPLETED','20.90','2026-10-01T00:00:00Z')]});
 assert.equal(app.rpc('rewards',selection(app)).pricing.percent,0);
 app.transactions.get(created.subscriptionId).transactions.forEach(t=>t.status='REFUNDED');app.subscriptions.get(created.subscriptionId).status='CANCELLED';
 assert.equal(app.rpc('rewards',selection(app)).pricing.percent,0,'refunded monthly_second cannot be reused');
});
test('Identity, environment and provider failures cannot invent rewards; stale displayed totals block before creating a subscription',()=>{
 const app=service();history(app,1);
 assert.equal(app.rpc('rewards',selection(app,{accountToken:'invalid'})).error,'signin_required');
 const other=app.register('other@example.com');assert.equal(app.rpc('rewards',selection(app,{accountToken:other.token,email:'buyer@example.com'})).pricing.percent,0);
 assert.equal(app.rpc('checkout',selection(app,{expectedTotal:2999,expectedRewardPercent:0})).error,'price_changed');assert.equal(app.plans.size,0);
 app.transactions.set('I-TESTBUYER1',{transactions:[],total_items:1,total_pages:2});assert.equal(app.rpc('rewards',selection(app)).error,'rewards_unavailable');
 app.transactions.set('I-TESTBUYER1',{links:[]});assert.equal(app.rpc('rewards',selection(app)).pricing.percent,0);
 app.transactions.set('I-TESTBUYER1',{total_items:2});assert.equal(app.rpc('rewards',selection(app)).error,'rewards_unavailable');
 app.values.set('PAYPAL_MODE','live');assert.equal(app.ctx.rewardHistory_('buyer@example.com').monthly,0);
});

test('Annual reward consumption survives refunds, duplicate confirmations and duplicate transaction IDs',()=>{
 const app=service();history(app,1,'yearly');const created=app.rpc('checkout',selection(app,{billing:'yearly'}));assert(approve(app,created).accepted);
 const tx=receipt('ANNUAL-REWARD','COMPLETED','259.11');app.transactions.set(created.subscriptionId,{transactions:[tx,{...tx}]});
 assert.equal(app.rpc('rewards',selection(app,{billing:'yearly'})).pricing.nextPayment,3,'duplicate transaction cannot count twice');
 const mails=app.mails.length;assert(approve(app,created).accepted);assert.equal(app.mails.length,mails);
 tx.status='REFUNDED';app.transactions.get(created.subscriptionId).transactions=[tx];
 assert.equal(app.rpc('rewards',selection(app,{billing:'yearly'})).pricing.percent,0,'refund cannot restore the annual reward');
});

test('Prorated amounts and repeated invoices in one billing period cannot accelerate rewards',()=>{
 const app=service();history(app,0);
 app.transactions.set('I-TESTBUYER1',{transactions:[receipt('PARTIAL','COMPLETED','5.00','2026-09-01T00:00:00Z'),receipt('FULL','COMPLETED','22.00','2026-09-02T00:00:00Z'),receipt('REPEAT','COMPLETED','22.00','2026-09-03T00:00:00Z')]});
 assert.equal(app.rpc('rewards',selection(app)).pricing.nextPayment,2);
 app.transactions.get('I-TESTBUYER1').transactions=[receipt('PARTIAL','COMPLETED','5.00')];assert.equal(app.rpc('rewards',selection(app)).pricing.nextPayment,1);
});

function unpaidCheckout(app){
 app.ctx.registerAccount_('buyer@example.com');app.orders.rows.splice(1);
 const row=Array(22).fill('');Object.assign(row,{0:randomUUID(),1:'sandbox',2:'buyer@example.com',6:'trial',7:'online',8:'monthly',9:1,10:'P-high-ONLINE',11:'I-TESTBUYER1',12:'created',13:new Date(),14:new Date(),18:'US'});app.ctx.commerceWrite_(row);
}
test('Unapproved checkouts do not query unavailable transaction history or block a paid Standard subscription',()=>{
 for(const status of ['APPROVAL_PENDING','APPROVED']){
  const app=service();history(app,0);unpaidCheckout(app);app.subscriptions.get('I-TESTBUYER1').status=status;
  const fetch=app.ctx.UrlFetchApp.fetch;
  app.ctx.UrlFetchApp.fetch=(url,options)=>{
   if(url.includes('/I-TESTBUYER1/transactions?'))return {getResponseCode:()=>400,getContentText:()=>JSON.stringify({name:'INVALID_REQUEST',details:[{issue:'INVALID_PARAMETER_VALUE'}]})};
   return fetch(url,options);
  };
  const quote=app.rpc('rewards',selection(app));assert.equal(quote.ok,true,JSON.stringify(quote));assert.equal(quote.pricing.percent,0);
  assert.equal(app.rpc('checkout',selection(app)).ok,true);
  assert(!app.requests.some(r=>r.url.includes('/I-TESTBUYER1/transactions?')));
 }
});
test('Unapproved checkouts cannot advance or consume a reward even if their transaction endpoint contains stale data',()=>{
 const app=service();history(app,2);unpaidCheckout(app);app.subscriptions.get('I-TESTBUYER1').status='APPROVAL_PENDING';
 const quote=app.rpc('rewards',selection(app));assert.equal(quote.pricing.percent,0);assert.equal(quote.pricing.nextPayment,1);
});
test('Paid-history provider failures remain blocked and expose only safe diagnostic codes',()=>{
 const app=service();history(app,1);const fetch=app.ctx.UrlFetchApp.fetch;
 app.ctx.UrlFetchApp.fetch=(url,options)=>url.includes('/I-TESTBUYER1/transactions?')?{getResponseCode:()=>403,getContentText:()=>JSON.stringify({name:'NOT_AUTHORIZED',details:[{issue:'PERMISSION_DENIED',description:'private account data must not appear'}],debug_id:'diagnostic-fixture',message:'private account data'})}:fetch(url,options);
 const quote=app.rpc('rewards',selection(app));assert.equal(quote.ok,false);assert.equal(quote.error,'provider');assert.match(quote.message,/HTTP 403/);assert.match(quote.message,/PERMISSION_DENIED/);assert(!JSON.stringify(quote).includes('private account data'));
 assert.equal(app.rpc('checkout',selection(app)).ok,false);assert.equal(app.plans.size,0);
});
test('Recorded subscriptions still require verified transactions even if their status needs renewed approval',()=>{
 const app=service();history(app,1);app.subscriptions.get('I-TESTBUYER1').status='APPROVAL_PENDING';
 const fetch=app.ctx.UrlFetchApp.fetch;
 app.ctx.UrlFetchApp.fetch=(url,options)=>url.includes('/I-TESTBUYER1/transactions?')?{getResponseCode:()=>403,getContentText:()=>JSON.stringify({name:'NOT_AUTHORIZED'})}:fetch(url,options);
 assert.equal(app.rpc('rewards',selection(app)).error,'provider');
});
test('A saved PayPal subscription that PayPal no longer knows (HTTP 404) does not block rewards, coupons or checkout',()=>{
 const app=service();app.paypalMissing.add('I-TESTBUYER1');
 const quote=app.rpc('rewards',selection(app));
 assert.equal(quote.ok,true,quote.message);assert.equal(quote.pricing.percent,0,'a missing subscription earns no reward');
 const data=selection(app),created=app.rpc('checkout',{...data,expectedTotal:quote.pricing.total,expectedRewardPercent:0});
 assert.equal(created.ok,true,created.message);
});
