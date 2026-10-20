import test from 'node:test';
import assert from 'node:assert/strict';
import {service} from './helpers/apps-service.mjs';
import {createBillingNetworkLookup} from '../supabase/functions/_shared/billing-network.js';
import {handleCommerceRequest} from '../supabase/functions/commerce/handler.js';
const ip='8.8.8.8',req=()=>new Request('https://example.test/checkout',{headers:{'cf-connecting-ip':ip}});
function lookup(response,{key='fixture-secret',trusted='cf-connecting-ip',now=Date.now}={}){
 const calls=[];
 const env=k=>({BILLING_POLICY_ENABLED:'true',BILLING_VPN_API_KEY:key,COMMERCE_CLIENT_IP_HEADER:trusted}[k]);
 const run=createBillingNetworkLookup(async url=>{calls.push(url);return url.startsWith('https://api.country.is/')?Response.json({country:'US'}):Response.json(response);},env,now);
 return {run,calls};
}
test('Network reputation strictly interprets clear and flagged responses and caches only valid checks',async()=>{
 for(const [proxy,status] of [['yes','vpn'],['no','clear']]){
  let time=1000;const s=lookup({status:'ok',[ip]:{proxy}},{now:()=>time});
  assert.deepEqual(await s.run(req()),{country:'US',status});await s.run(req());
  assert.equal(s.calls.filter(u=>u.includes('proxycheck.io')).length,1);
  time+=61000;await s.run(req());assert.equal(s.calls.filter(u=>u.includes('proxycheck.io')).length,2);
  assert(s.calls.some(u=>u.includes('vpn=1')));
 }
});
test('Missing keys, quota errors and malformed results never imply a clear connection',async()=>{
 for(const response of [{status:'denied'}, {status:'ok'}, {status:'ok',[ip]:{proxy:'unknown'}},null]){
  const s=lookup(response);assert.equal((await s.run(req())).status,'unavailable');
 }
 const s=lookup({},{key:''});assert.equal((await s.run(req())).status,'unavailable');assert(!s.calls.some(u=>u.includes('proxycheck.io')));
 const untrusted=lookup({});assert.deepEqual(await untrusted.run(new Request('https://example.test/',{headers:{'x-forwarded-for':ip}})),{country:'',status:'unavailable'});assert.equal(untrusted.calls.length,0);
});
function setup(){const app=service();app.values.set('BILLING_POLICY_ENABLED','true');return app;}
test('Only a verified full tester account can edit countries or bypass reputation checks',()=>{
 const app=setup(),buyer=app.ctx.makeSession_('buyer@example.com');
 app.register('contactmy3dart@gmail.com');const owner=app.ctx.makeSession_('contactmy3dart@gmail.com');
 for(const status of ['vpn','unavailable','clear']){
  const regular=app.rpc('billing_context',{accountToken:buyer,billingNetwork:{country:'US',status}});
  assert.equal(regular.canEditCountry,false);assert.equal(regular.blocked,status!=='clear');
  const tester=app.rpc('billing_context',{accountToken:owner,billingNetwork:{country:'US',status}});
  assert.equal(tester.canEditCountry,true);assert.equal(tester.blocked,false);
 }
 const guest=app.rpc('billing_context',{email:'contactmy3dart@gmail.com',isOwner:true,billingNetwork:{country:'US',status:'vpn'}});
 assert.equal(guest.canEditCountry,false);assert.equal(guest.blocked,true);
 assert.equal(app.rpc('billing_context',{accountToken:owner+'forged'}).error,'signin_required');
 assert.equal(app.ctx.billingTester_({email:'contactmy3dart@gmail.com',sub:'I-RESTRICTED'}),false);
});
test('PayPal billing fails closed and rejects country changes even within the same price tier',()=>{
 const app=setup(),accountToken=app.ctx.makeSession_('buyer@example.com');
 for(const [status,error] of [['vpn','vpn_detected'],['unavailable','network_unavailable']]){
  assert.equal(app.rpc('eligibility',{accountToken,billingNetwork:{country:'US',status}}).error,error);
 }
 assert.equal(app.rpc('rewards',{accountToken,plan:'online',billing:'monthly',seats:1,billingCountry:'CA',billingNetwork:{country:'US',status:'clear'}}).error,'country_mismatch');
 assert.equal(app.rpc('eligibility',{accountToken,billingNetwork:{country:'',status:'clear'}}).error,'country_unavailable');
});
test('Verified tester can test another country but provider restrictions remain enforced',()=>{
 const app=setup();app.register('contactmy3dart@gmail.com');const accountToken=app.ctx.makeSession_('contactmy3dart@gmail.com');
 const data={billingCountry:'CA',billingNetwork:{country:'US',status:'vpn'}};
 app.ctx.billingApply_(data,{email:'contactmy3dart@gmail.com'});assert.equal(data.country,'CA');
 const blocked=app.rpc('rewards',{accountToken,plan:'online',billing:'monthly',seats:1,billingCountry:'RU',billingNetwork:{country:'US',status:'vpn'}});
 assert.equal(blocked.ok,false);assert.notEqual(blocked.error,'vpn_detected');
});
test('Gateway discards browser network and role claims and signs only server network results',async()=>{
 const app=setup(),accountToken=app.ctx.makeSession_('buyer@example.com');let payload;
 const env=k=>({ALLOWED_ORIGINS:'https://imajoy.github.io',BILLING_POLICY_ENABLED:'true',SHEET_WEB_APP_URL:'https://script.google.com/macros/s/FIXTURE/exec'}[k]||app.values.get(k));
 const request=async(url,options)=>{const envelope=JSON.parse(options.body);payload=JSON.parse(envelope.payload);return Response.json(JSON.parse(app.ctx.doPost({postData:{contents:options.body}}).text));};
 const response=await handleCommerceRequest(new Request('https://edge.test/commerce/billing-context',{method:'POST',headers:{Origin:'https://imajoy.github.io'},body:JSON.stringify({accountToken,email:'contactmy3dart@gmail.com',isOwner:true,billingNetwork:{country:'IN',status:'clear'}})}),env,request,async()=>({country:'US',status:'vpn'}));
 assert.deepEqual(payload.billingNetwork,{country:'US',status:'vpn'});assert.equal(payload.isOwner,undefined);assert.equal(payload.email,undefined);assert(!JSON.stringify(payload).includes(ip));
 const result=await response.json();assert.equal(result.blocked,true);assert.equal(result.canEditCountry,false);
});
test('Razorpay quote/checkout share the billing gate; confirmations are not rejected by VPN checks',()=>{
 const app=setup();
 for(const [k,v] of Object.entries({RAZORPAY_MODE:'test',RAZORPAY_ENABLED:'true',RAZORPAY_KEY_ID:'rzp_test_fixture',RAZORPAY_KEY_SECRET:'private-razorpay-test-secret',RAZORPAY_WEBHOOK_SECRET:'private-webhook-test-secret',RAZORPAY_ALLOWED_COUNTRIES:'IN US'}))app.values.set(k,v);
 app.ctx.Logger={log(){}};app.ctx.setupRazorpayPlans();
 const accountToken=app.ctx.makeSession_('buyer@example.com');
 for(const operation of ['quote','checkout']){
  const result=app.rpc('razorpay',{operation,accountToken,plan:'online',billing:'monthly',seats:1,billingCountry:'IN',billingNetwork:{country:'IN',status:'vpn'}});
  assert.equal(result.error,'vpn_detected');
 }
 const confirm=app.rpc('razorpay',{operation:'confirm',accountToken,checkoutId:'nonexistent',billingNetwork:{country:'IN',status:'vpn'}});
 assert.equal(confirm.ok,false);assert.notEqual(confirm.error,'vpn_detected');assert.equal(app.razorpay.subscriptions.size,0);
});
test('Checkout/eligibility gateway also replaces client-supplied reputation',async()=>{
 const app=setup(),accountToken=app.ctx.makeSession_('buyer@example.com');
 const env=k=>({ALLOWED_ORIGINS:'https://imajoy.github.io',BILLING_POLICY_ENABLED:'true',SHEET_WEB_APP_URL:'https://script.google.com/macros/s/FIXTURE/exec'}[k]||app.values.get(k));
 for(const path of ['eligibility','rewards']){
  const response=await handleCommerceRequest(new Request('https://edge.test/commerce/'+path,{method:'POST',headers:{Origin:'https://imajoy.github.io'},body:JSON.stringify({accountToken,plan:'online',billing:'monthly',seats:1,country:'US',billingNetwork:{country:'US',status:'clear'}})}),env,async(u,o)=>Response.json(JSON.parse(app.ctx.doPost({postData:{contents:o.body}}).text)),async()=>({country:'US',status:'vpn'}));
  assert.equal((await response.json()).error,'vpn_detected');
 }
});
test('Partial activation or a missing billing module cannot silently skip protection',()=>{
 const app=setup(),accountToken=app.ctx.makeSession_('buyer@example.com'),billingNetwork={country:'US',status:'clear'};
 app.values.set('BILLING_POLICY_ENABLED','false');
 assert.equal(app.rpc('eligibility',{accountToken,billingNetwork}).error,'unavailable');
 assert.equal(app.rpc('billing_context',{billingNetwork}).error,'unavailable');
 app.values.set('BILLING_POLICY_ENABLED','true');app.ctx.billingApply_=undefined;
 assert.equal(app.rpc('eligibility',{accountToken,billingNetwork}).error,'unavailable');
});
