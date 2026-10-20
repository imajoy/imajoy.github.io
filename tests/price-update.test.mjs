import test from 'node:test';
import assert from 'node:assert/strict';
import {service} from './helpers/apps-service.mjs';
import {regionalPrice,USD} from '../js/regions.js';
const legacy={high:{online:{monthly:22,yearly:211},offline:{monthly:44,yearly:422}},mid:{online:{monthly:14,yearly:134},offline:{monthly:28,yearly:269}},low:{online:{monthly:9,yearly:86},offline:{monthly:18,yearly:173}}};
test('Online and Offline monthly/yearly prices rise exactly 2%, with integer cents and matching server quotes',()=>{
 const app=service();
 for(const [tier,country] of [['high','US'],['mid','BR'],['low','LK']])for(const plan of ['online','offline'])for(const billing of ['monthly','yearly']){
  const expected=Math.round(legacy[tier][plan][billing]*102);
  assert.equal(regionalPrice(plan,billing,1,country).unitAmount,expected);
  assert.equal(Math.round(USD[tier][plan][billing]*100),expected);
  const quote=app.ctx.rewardQuote_({country,plan,billing,seats:3},{},{monthly:0,yearly:0,used:{}});
  assert.equal(quote.unitAmount,expected);assert.equal(quote.total,expected*3);assert(Number.isInteger(quote.unitAmount));
 }
 for(const plan of ['online','offline'])for(const billing of ['monthly','yearly']){
  const browser=regionalPrice(plan,billing,1,'IN'),server=app.ctx.razorpayPrice_(plan,billing,'IN');
  assert.equal(browser.unitAmount,server.unitAmount);assert.equal(browser.unitAmount,Math.round((billing==='yearly'?863040:89900)*(plan==='offline'?2:1)*1.02));
 }
});
test('PayPal setup replaces old plans once, preserves old history/trial IDs and never changes existing subscriptions',()=>{
 const app=service();app.ctx.Logger={log(){}};
 const old=JSON.parse(app.values.get('PLANS_sandbox'));delete old.priceVersion;delete old.prices;
 old.tiers.high.online.monthly='P-OLDMONTHLY';old.tiers.high.onlineTrial.monthly='P-OLDTRIAL';app.values.set('PLANS_sandbox',JSON.stringify(old));
 assert.throws(()=>app.ctx.commercePlan_('online','monthly','US','trial'),/being updated/);
 app.ctx.setupPlans();const current=JSON.parse(app.values.get('PLANS_sandbox'));
 assert.equal(current.priceVersion,app.ctx.PRICE_VERSION);assert.equal(app.plans.size,18);
 assert.notEqual(current.tiers.high.online.monthly,'P-OLDMONTHLY');assert.equal(app.ctx.rewardPlanInfo_('P-OLDMONTHLY').unitAmount,2200);
 assert.equal(app.ctx.isTrialPlan_('P-OLDTRIAL'),true);assert.equal(app.ctx.planTier_('P-OLDMONTHLY'),'high');
 for(const plan of app.plans.values()){
  const cycle=plan.billing_cycles.at(-1),info=app.ctx.rewardPlanInfo_(plan.id);
  assert.equal(Math.round(Number(cycle.pricing_scheme.fixed_price.value)*100),info.unitAmount);
 }
 app.ctx.setupPlans();assert.equal(app.plans.size,18,'rerunning does not recreate plans');
 assert(!app.requests.some(r=>r.url.includes('/subscriptions')||r.options.method==='patch'));
});
test('Razorpay replaces a legacy catalog with new plans and keeps immutable old plans for existing buyers',()=>{
 const app=service();app.ctx.Logger={log(){}};
 app.values.set('RAZORPAY_MODE','test');app.values.set('RAZORPAY_KEY_ID','rzp_test_fixture');app.values.set('RAZORPAY_KEY_SECRET','private-test-secret');
 const old={india:{online:{monthly:'plan_old'}}};app.values.set('RAZORPAY_PLANS_test',JSON.stringify(old));app.razorpay.plans.set('plan_old',{id:'plan_old',item:{amount:89900,currency:'INR'}});
 app.ctx.setupRazorpayPlans();const catalog=JSON.parse(app.values.get('RAZORPAY_PLANS_test'));
 assert.equal(catalog._priceVersion,app.ctx.PRICE_VERSION);assert.equal(app.razorpay.plans.size,17);
 assert.equal(app.razorpay.plans.get('plan_old').item.amount,89900);assert.equal(app.razorpay.plans.get(catalog.india.online.monthly).item.amount,91698);
 app.ctx.setupRazorpayPlans();assert.equal(app.razorpay.plans.size,17);assert.equal(app.razorpay.subscriptions.size,0);
});
test('Interrupted PayPal catalog setup resumes created plans and retains archived historical prices',()=>{
 const app=service();app.ctx.Logger={log(){}};
 const catalog=JSON.parse(app.values.get('PLANS_sandbox'));delete catalog.priceVersion;delete catalog.prices;app.values.set('PLANS_sandbox',JSON.stringify(catalog));
 const fetch=app.ctx.UrlFetchApp.fetch;let calls=0;
 app.ctx.UrlFetchApp.fetch=(url,options)=>{
  if(url.endsWith('/v1/billing/plans')&&++calls===3)return {getResponseCode:()=>503,getContentText:()=> 'unavailable'};
  return fetch(url,options);
 };
 assert.throws(()=>app.ctx.setupPlans(),/503/);assert.equal(app.plans.size,2);
 const partial=JSON.parse(app.values.get('PLANS_sandbox')),first=partial.tiers.high.online.monthly;
 app.ctx.UrlFetchApp.fetch=fetch;app.ctx.setupPlans();assert.equal(app.plans.size,18);
 assert.equal(JSON.parse(app.values.get('PLANS_sandbox')).tiers.high.online.monthly,first);
 assert.equal(app.ctx.rewardPlanInfo_(catalog.tiers.high.online.monthly).unitAmount,2200);
});
