import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {service} from './helpers/apps-service.mjs';
const selection=(app,extra={})=>({accountToken:app.ctx.makeSession_('buyer@example.com'),plan:'online',billing:'monthly',seats:1,country:'US',billingCountry:'US',offer:'standard',requestId:randomUUID(),...extra});
const future=new Date(Date.now()+30*864e5),past=new Date(Date.now()-2*864e5);
function coupons(app,rows){app.ctx.couponSheet_();const sheet=app.sheets.get('Coupons');rows.forEach(r=>sheet.appendRow(r));return sheet;}
test('A valid coupon from the Coupons tab discounts the chosen number of payments, then the standard rate',()=>{
 const app=service();coupons(app,[['SAVE20',20,3,future,'both','monthly','','',true,'']]);
 const data=selection(app,{coupon:'save20',seats:2}),quote=app.rpc('rewards',data);
 assert.equal(quote.pricing.percent,20);assert.equal(quote.pricing.total,1760*2);assert.equal(quote.pricing.coupon.code,'SAVE20');assert.equal(quote.pricing.rewardPayments,3);
 const created=app.rpc('checkout',{...data,expectedTotal:quote.pricing.total,expectedRewardPercent:20});assert(created.ok,JSON.stringify(created));
 const plan=[...app.plans.values()][0];assert.equal(app.subscriptions.get(created.subscriptionId).plan_id,plan.id);
 assert.equal(plan.billing_cycles[0].total_cycles,3);assert.equal(plan.billing_cycles[0].pricing_scheme.fixed_price.value,'17.60');assert.equal(plan.billing_cycles[1].pricing_scheme.fixed_price.value,'22.00');
 assert.match(plan.name,/coupon/);
 app.subscriptions.get(created.subscriptionId).status='ACTIVE';
 const done=app.rpc('confirm',{accountToken:data.accountToken,checkoutId:created.checkoutId});assert(done.accepted,JSON.stringify(done));
 assert.equal(app.sheets.get('Coupons').rows[1][7],1);
 assert.equal(app.rpc('rewards',selection(app,{coupon:'SAVE20'})).error,'coupon_used');
});
test('Inactive, unknown, expired, wrong plan or billing and used-up coupons are refused; no coupon keeps the normal price',()=>{
 const app=service();coupons(app,[['OFF',10,1,future,'both','both','','','No',''],['YESCODE',15,1,future,'both','both','','','Yes',''],['OLD',10,1,past,'both','both','','',true,''],['YEARONLY',10,1,future,'both','yearly','','',true,''],['OFFLINE10',10,1,'','offline','both','','',true,''],['ONCE',10,1,'','both','both',1,'',true,'']]);
 for(const [code,error] of [['NOPE','coupon_invalid'],['OFF','coupon_invalid'],['OLD','coupon_expired'],['YEARONLY','coupon_invalid'],['OFFLINE10','coupon_invalid']])assert.equal(app.rpc('rewards',selection(app,{coupon:code})).error,error,code);
 assert.equal(app.rpc('rewards',selection(app,{coupon:'OFFLINE10',plan:'offline'})).pricing.percent,10);
 assert.equal(app.rpc('rewards',selection(app)).pricing.percent,0);
 assert.equal(app.rpc('rewards',selection(app,{coupon:'yescode'})).pricing.percent,15);
 const other=app.register('other@example.com');
 const first=app.rpc('checkout',selection(app,{coupon:'ONCE'}));assert(first.ok,JSON.stringify(first));
 assert.equal(app.rpc('rewards',selection(app,{accountToken:other.token,coupon:'ONCE'})).error,'coupon_used');
});
test('A coupon never applies to the free trial',()=>{
 const app=service({registered:false});app.register('buyer@example.com');coupons(app,[['SAVE20',20,1,future,'both','both','','',true,'']]);
 const created=app.rpc('checkout',selection(app,{offer:'trial',coupon:'SAVE20',deviceId:undefined,deviceHash:'a'.repeat(64),ipHash:'b'.repeat(64)}));
 assert(created.ok,JSON.stringify(created));assert.equal(created.pricing,null);assert.equal(app.plans.size,0);
});
test('Price previews reuse the PayPal login and recent payment history; checkout always re-checks',()=>{
 const app=service();app.options.keepHistoryCache=true;
 const count=()=>app.requests.filter(r=>r.url.includes('/v1/billing/subscriptions/I-TESTBUYER1')).length;
 const tokens=()=>app.requests.filter(r=>r.url.endsWith('/v1/oauth2/token')).length;
 app.rpc('rewards',selection(app));const first=count();
 app.rpc('rewards',selection(app));assert.equal(count(),first,'second preview should not call PayPal again');
 assert.equal(tokens(),1,'PayPal login should be reused');
 app.rpc('checkout',selection(app,{expectedTotal:2200,expectedRewardPercent:0}));assert(count()>first,'checkout must re-check history');
});
