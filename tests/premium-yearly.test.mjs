import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {service} from './helpers/apps-service.mjs';
const selection=(app,extra={})=>({accountToken:app.ctx.makeSession_('buyer@example.com'),plan:'offline',billing:'yearly',seats:1,country:'US',billingCountry:'US',offer:'standard',requestId:randomUUID(),...extra});
const usedPremiumYearly=app=>{app.orders.rows[1][7]='offline';app.orders.rows[1][8]='yearly';app.orders.rows[1][11]='P-high-OFFLINE';
 app.subscriptions.set('I-TESTBUYER1',{id:'I-TESTBUYER1',status:'CANCELLED',plan_id:'P-high-OFFLINE',create_time:'2023-01-01T00:00:00Z'});app.transactions.set('I-TESTBUYER1',{transactions:[]});};
test('First Premium yearly subscription keeps the 20% saving; later Premium yearly subscriptions pay the full price',()=>{
 const first=service({registered:false});first.register('buyer@example.com');
 let quote=first.rpc('rewards',selection(first)).pricing;
 assert.equal(quote.unitAmount,47920);assert.equal(quote.fullPrice,false);
 const created=first.rpc('checkout',selection(first,{expectedTotal:47920}));assert(created.ok,JSON.stringify(created));assert.equal(first.plans.size,0,'the standard 20% yearly plan is used');
 const app=service();usedPremiumYearly(app);
 quote=app.rpc('rewards',selection(app)).pricing;
 assert.equal(quote.fullPrice,true);assert.equal(quote.unitAmount,59900);assert.equal(quote.percent,0);assert.equal(quote.total,59900);
 const three=app.rpc('rewards',selection(app,{seats:3})).pricing;assert.equal(three.total,59900*3);
 assert.equal(app.rpc('checkout',selection(app,{expectedTotal:47920})).error,'price_changed','the old 20% price is refused');
 const ok=app.rpc('checkout',selection(app,{expectedTotal:59900}));assert(ok.ok,JSON.stringify(ok));
 assert.equal(app.plans.size,1);const plan=[...app.plans.values()][0];
 assert.equal(plan.billing_cycles.length,1);assert.equal(plan.billing_cycles[0].pricing_scheme.fixed_price.value,'599.00');assert.equal(plan.billing_cycles[0].frequency.interval_unit,'YEAR');
 assert.equal(app.subscriptions.get(ok.subscriptionId).plan_id,plan.id);
 app.rpc('checkout',selection(app,{expectedTotal:59900}));assert.equal(app.plans.size,1,'the full-price plan is reused');
});
test('Each plan uses up its own yearly saving: Basic 15%, Premium 20%; monthly prices never change', ()=>{
 const app=service();usedPremiumYearly(app);
 assert.equal(app.rpc('rewards',selection(app,{plan:'online'})).pricing.unitAmount,30590,'Basic yearly is 15% off until it is used');
 assert.equal(app.rpc('rewards',selection(app,{billing:'monthly'})).pricing.unitAmount,4992);
 assert.equal(app.rpc('rewards',selection(app,{country:'BR',billingCountry:'BR'})).pricing.unitAmount,46900);
});
test('The account tells the site whether the Premium yearly saving has been used',()=>{
 const fresh=service();assert.equal(fresh.call({step:'identity',token:fresh.ctx.makeSession_('buyer@example.com')}).premiumYearlyUsed,false);
 const app=service();usedPremiumYearly(app);const token=app.ctx.makeSession_('buyer@example.com');
 assert.equal(app.call({step:'identity',token}).premiumYearlyUsed,true);
 app.orders.rows[1][7]='online';assert.equal(app.call({step:'identity',token}).premiumYearlyUsed,false,'a Basic yearly order does not use it up');
 app.orders.rows[1][7]='offline';app.orders.rows[1][8]='monthly';assert.equal(app.call({step:'identity',token}).premiumYearlyUsed,false);
});
test('Premium yearly full price also applies to Razorpay, in rupees',()=>{
 const app=service(),token=app.ctx.makeSession_('buyer@example.com');
 for(const [k,v] of Object.entries({RAZORPAY_MODE:'test',RAZORPAY_ENABLED:'true',RAZORPAY_KEY_ID:'rzp_test_fixture',RAZORPAY_KEY_SECRET:'private-razorpay-test-secret',RAZORPAY_WEBHOOK_SECRET:'private-webhook-test-secret',RAZORPAY_ALLOWED_COUNTRIES:'IN US'}))app.values.set(k,v);
 app.ctx.Logger={log(){}};app.ctx.setupRazorpayPlans();
 const quote=()=>app.rpc('razorpay',{operation:'quote',accountToken:token,plan:'offline',billing:'yearly',seats:1,country:'IN',billingCountry:'IN',requestId:randomUUID()}).pricing;
 assert.equal(quote().unitAmount,1823920);
 app.orders.rows.push([new Date(),'sub_USED1','ACTIVE','razorpay_test','buyer@example.com','Buyer','IN','offline','yearly',1,'','plan_x']);
 const full=quote();assert.equal(full.unitAmount,2279900);assert.equal(full.compareAtUnitAmount,2279900);assert.equal(full.fullPrice,true);
});
test('Basic yearly: first subscription 15% off, later ones the full price; the trial cannot reuse the saving',()=>{
 const first=service();
 const quote=first.rpc('rewards',selection(first,{plan:'online'})).pricing;assert.equal(quote.unitAmount,30590);assert.equal(quote.fullPrice,false);
 const app=service();app.orders.rows[1][7]='online';app.orders.rows[1][8]='yearly';
 app.subscriptions.set('I-TESTBUYER1',{id:'I-TESTBUYER1',status:'CANCELLED',plan_id:'P-high-ONLINE',create_time:'2023-01-01T00:00:00Z'});app.transactions.set('I-TESTBUYER1',{transactions:[]});
 const again=app.rpc('rewards',selection(app,{plan:'online'})).pricing;assert.equal(again.fullPrice,true);assert.equal(again.unitAmount,35988);
 assert.equal(app.rpc('rewards',selection(app,{plan:'offline'})).pricing.unitAmount,47920,'Premium yearly is unaffected by a Basic order');
 const hash=c=>c.repeat(64);
 assert.equal(app.rpc('checkout',selection(app,{plan:'online',offer:'trial',deviceHash:hash('a'),ipHash:hash('b')})).error,'selection');
 const token=app.ctx.makeSession_('buyer@example.com');
 assert.deepEqual(app.call({step:'identity',token}).yearlyOfferUsed,{online:true,offline:false});
});
