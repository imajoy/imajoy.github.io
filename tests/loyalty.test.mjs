import test from 'node:test';
import assert from 'node:assert/strict';
import {priceFor} from '../supabase/functions/_shared/catalog.js';
import {applyLoyalty,betterPromotion} from '../supabase/functions/_shared/loyalty.js';
import {applyCoupon,couponHash} from '../supabase/functions/_shared/coupons.js';
import {handleRequest} from '../supabase/functions/storefront/handler.js';
import {emailHash} from '../supabase/functions/_shared/customer.js';
const id='11111111-1111-4111-8111-111111111111',customer={id,email:'owner@example.test'};
const history=(monthly=0,yearly=0,usedRewards=[])=>({paidPurchases:monthly+yearly,monthlyPaidPeriods:monthly,yearlyPaidPeriods:yearly,usedRewards,historyVersion:'test-ledger-revision'});
const origin='https://imajoy.github.io',values={ALLOWED_ORIGINS:origin,SUPABASE_URL:'https://project.supabase.co',SUPABASE_ANON_KEY:'sb_publishable_test_only',SUPABASE_SERVICE_ROLE_KEY:'private-service-key',AUTH_TURNSTILE_SITE_KEY:'public-captcha-key',QUOTE_SIGNING_SECRET:'private-quote-signing-secret-at-least-32-bytes',LOYALTY_ENABLED:'true'};
const env=key=>values[key];
const response=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
const request=(path,{method='GET',body,token='test-access-token-with-enough-characters'}={})=>new Request('https://project.supabase.co/functions/v1/storefront'+path,{method,headers:{Origin:origin,...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
function upstream(trustedHistory=history(1),overrides={}){
 return async(url,options)=>{
  if(url.endsWith('/auth/v1/user')){assert.equal(options.headers.apikey,values.SUPABASE_ANON_KEY);return response({id,email:customer.email,email_confirmed_at:'2026-01-01T00:00:00Z',...overrides});}
  assert.equal(options.headers.Authorization,'Bearer '+values.SUPABASE_SERVICE_ROLE_KEY);
  const params=JSON.parse(options.body);assert.equal(params.p_user_id,id);assert.equal(params.p_email_hash,await emailHash(customer.email));assert(!options.body.includes(customer.email));
  if(url.endsWith('/storefront_link_customer'))return response(null);
  assert(url.endsWith('/storefront_loyalty_history'));return response(trustedHistory);
 };
}
test('Monthly rewards apply on payments 2 and 3 only, across countries, plans and quantities',()=>{
 for(const country of ['IN','US','GB','PK','ID'])for(const plan of ['online','offline'])for(const seats of [1,3,100])for(const previous of [0,1,2,3,9]){
  const base=priceFor(country,plan,'monthly',seats),quote=applyLoyalty(base,customer,history(previous));
  const percent=previous===1?5:previous===2?10:0;
  assert.equal(quote.loyalty.percent,percent);assert.equal(quote.subtotal,base.subtotal-Math.round(base.subtotal*percent/100));
  assert.equal(quote.customerId,id);assert.equal(quote.unitAmount,base.unitAmount);
 }
});
test('Only the first yearly renewal gets an additional 10%, including the authorised price-floor exception',()=>{
 const base=priceFor('IN','online','yearly');
 for(const years of [0,1,2,3]){
  const quote=applyLoyalty(base,customer,history(0,years));assert.equal(quote.loyalty.percent,years===1?10:0);
 }
 const discounted=applyLoyalty(base,customer,history(0,1));
 assert.equal(base.subtotal,863040);assert.equal(discounted.subtotal,776736);assert.equal(discounted.subtotal/1200,647.28);
 assert.equal(discounted.loyalty.belowCatalogFloor,true);assert.equal(discounted.annualSavings,215760);
 assert.equal(applyLoyalty(base,customer,history(3,0)).loyalty.discountAmount,0,'previous monthly payments do not invent an annual renewal');
});
test('Previously consumed rewards cannot be reused, including after a refund changes paid counts',()=>{
 for(const [billing,h,reward]of[['monthly',history(1),'monthly_second'],['monthly',history(2),'monthly_third'],['yearly',history(0,1),'yearly_return']]){
  h.usedRewards.push(reward);const quote=applyLoyalty(priceFor('US','online',billing),customer,h);
  assert.equal(quote.loyalty.discountAmount,0);assert.equal(quote.loyalty.reason,'already_used');
 }
});
test('Coupon and loyalty rewards never stack; the better validated offer wins',async()=>{
 const base=priceFor('US'),loyalty=applyLoyalty(base,customer,history(2));
 const registry={};registry[await couponHash('TEST-OWNER-20')]={active:true,percent:20,expiresAt:new Date(Date.now()+86400000).toISOString()};
 const coupon=await applyCoupon(base,'TEST-OWNER-20',registry),better=betterPromotion(loyalty,coupon);
 assert.equal(better.subtotal,coupon.subtotal);assert.equal(better.loyalty.discountAmount,0);assert.equal(better.customerId,id);
 assert.equal(betterPromotion(loyalty,{...coupon,subtotal:base.subtotal-1}).subtotal,loyalty.subtotal);
 await assert.rejects(applyCoupon(loyalty,'TEST-OWNER-20',registry),/do not stack/);
});
test('Authenticated quotes use verified identity and private history, ignoring client claims',async()=>{
 const result=await handleRequest(request('/quote?country=IN&billing=yearly&paidCount=500&customerId=forged&email=other@example.test'),env,upstream(history(0,1)));
 assert.equal(result.status,200);const quote=await result.json();assert.equal(quote.subtotal,776736);assert.equal(quote.customerId,id);assert(quote.quoteToken);
 assert(!JSON.stringify(quote).includes(customer.email));assert(!JSON.stringify(quote).includes(values.SUPABASE_SERVICE_ROLE_KEY));
});
test('Public quotes never trust an email or previous-payment count as proof',async()=>{
 const result=await handleRequest(request('/quote?country=IN&billing=yearly&email=owner@example.test&paidCount=1',{token:null}),env,()=>{throw Error('No private history request allowed');});
 const quote=await result.json();assert.equal(quote.subtotal,863040);assert.equal(quote.loyalty,undefined);
});
test('Expired, anonymous, unconfirmed and invalid identities cannot read payment history',async()=>{
 const rejected=await handleRequest(request('/quote?country=IN'),env,async url=>{assert(url.endsWith('/auth/v1/user'));return response({},401);});assert.equal(rejected.status,401);
 for(const user of [{email_confirmed_at:null},{is_anonymous:true},{id:'not-a-user-id'}])assert.equal((await handleRequest(request('/quote?country=IN'),env,upstream(history(1),user))).status,401);
});
test('Missing or corrupt private history fails closed instead of inventing a discount',async()=>{
 assert.equal((await handleRequest(request('/quote?country=IN'),env,upstream({...history(1),monthlyPaidPeriods:999}))).status,503);
 assert.equal((await handleRequest(request('/quote?country=IN'),env,upstream({...history(1),usedRewards:['forged']}))).status,503);
 const result=await handleRequest(request('/quote?country=IN'),env,async url=>url.endsWith('/auth/v1/user')?response({id,email:customer.email,email_confirmed_at:'yes'}):response({},500));assert.equal(result.status,503);
});
test('Account linking is a verified POST; browser-supplied identity is ignored',async()=>{
 const result=await handleRequest(request('/customer',{method:'POST',body:{customerId:'forged',email:'someone-else@example.test'}}),env,upstream());assert.equal(result.status,200);
 assert.equal((await handleRequest(request('/customer',{method:'POST',body:{},token:null}),env,()=>{throw Error('No history access');})).status,401);
 assert.equal((await handleRequest(request('/customer'),env)).status,404);
});
test('Loyalty config is off by default and never exposes a secret-role API key',async()=>{
 for(const key of ['sb_secret_must_not_be_exposed',values.SUPABASE_SERVICE_ROLE_KEY]){
  const result=await handleRequest(request('/config'),name=>name==='SUPABASE_ANON_KEY'?key:env(name));const config=await result.json();assert.equal(config.loyalty.enabled,false);assert(!JSON.stringify(config).includes(key));
 }
 const disabled=await handleRequest(request('/config'),name=>name==='LOYALTY_ENABLED'?undefined:env(name));assert.equal((await disabled.json()).loyalty.enabled,false);
 assert.equal((await handleRequest(request('/checkout',{method:'POST',body:{billing:{email:customer.email}}}),env)).status,503);
});
