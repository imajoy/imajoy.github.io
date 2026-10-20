import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {handleCommerceRequest,keyedHash,trustedIp} from '../supabase/functions/commerce/handler.js';
import {service} from './helpers/apps-service.mjs';
const origin='https://imajoy.github.io';
function setup(){
 const app=service({registered:false}),account=app.register('new@example.com');
 const values={COMMERCE_ENABLED:'true',COMMERCE_SECRET:app.values.get('COMMERCE_SECRET'),TRIAL_IDENTITY_SECRET:app.values.get('TRIAL_IDENTITY_SECRET'),SHEET_WEB_APP_URL:'https://script.google.com/macros/s/TEST/exec',COMMERCE_CLIENT_IP_HEADER:'cf-connecting-ip',SUPABASE_URL:'https://project.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'private-service-role',INSTALLER_BUCKET:'installers',INSTALLER_OBJECT:'Wrapline_Setup.py'};
 const env=key=>values[key],calls=[];
 const upstream=async(url,options={})=>{
  calls.push({url,options});
  if(url.startsWith('https://api.country.is/'))return Response.json({country:'US'});
  if(url===values.SHEET_WEB_APP_URL)return Response.json(app.ctx.handleCommerceEnvelope_(JSON.parse(options.body)));
  if(url.includes('/storage/v1/object/sign/')){assert.equal(options.headers.apikey,'private-service-role');assert.equal(JSON.parse(options.body).expiresIn,60);return Response.json({signedURL:'/object/sign/installers/Wrapline_Setup.py?token=SIGNED&download=Wrapline_Setup.py'});}
  throw Error('Unexpected upstream '+url);
 };
 const req=(path,body={},headers={})=>new Request('https://project.supabase.co/functions/v1/commerce/'+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','cf-connecting-ip':'203.0.113.12',...headers},body:JSON.stringify({accountToken:account.token,deviceId:'11111111-1111-4111-8111-111111111111',...body})});
 return {app,account,values,env,calls,upstream,req};
}
test('Gateway hashes only the ingress IP and browser ID, never browser-supplied hashes or email',async()=>{
 const s=setup();const result=await handleCommerceRequest(s.req('eligibility',{ip:'1.2.3.4',ipHash:'forged',deviceHash:'forged',email:'someone@example.com'}),s.env,s.upstream);
 assert.equal(result.status,200);assert.equal((await result.json()).eligible,true);
 const packed=JSON.parse(s.calls.find(c=>c.url===s.values.SHEET_WEB_APP_URL).options.body).payload,payload=JSON.parse(packed);
 assert.equal(payload.ipHash,await keyedHash(s.values.TRIAL_IDENTITY_SECRET,'ip:203.0.113.12'));
 assert(!packed.includes('1.2.3.4'));assert(!packed.includes('203.0.113.12'));assert.equal(payload.email,undefined);
});
test('Missing or untrusted IP headers cannot authorize a trial; equivalent IPv6 forms share a key',()=>{
 const env=k=>k==='COMMERCE_CLIENT_IP_HEADER'?'cf-connecting-ip':undefined;
 const req=h=>new Request('https://example.test',{headers:h});
 assert.equal(trustedIp(req({'x-forwarded-for':'203.0.113.1'}),env),'');
 assert.equal(trustedIp(req({'cf-connecting-ip':'1.2.3.999'}),env),'');
 assert.equal(trustedIp(req({'cf-connecting-ip':'203.0.113.1,203.0.113.2'}),env),'');
 assert.equal(trustedIp(req({'cf-connecting-ip':'2001:0db8:0000:0000:0000:0000:0000:0001'}),env),trustedIp(req({'cf-connecting-ip':'2001:db8::1'}),env));
 assert.equal(trustedIp(req({'cf-connecting-ip':'1.2.3.4'}),()=>undefined),'');
});
test('Download verifies a registered account before issuing a 60-second private storage URL',async()=>{
 const s=setup(),result=await handleCommerceRequest(s.req('download'),s.env,s.upstream),data=await result.json();
 assert.equal(data.url,'https://project.supabase.co/storage/v1/object/sign/installers/Wrapline_Setup.py?token=SIGNED&download=Wrapline_Setup.py');
 const start=s.calls.length;const rejected=await handleCommerceRequest(s.req('download',{accountToken:'invalid-signed-session-token'}),s.env,s.upstream);
 assert.equal(rejected.status,401);assert(!s.calls.slice(start).some(c=>c.url.includes('/storage/')));
 assert(!JSON.stringify(data).includes(s.values.SUPABASE_SERVICE_ROLE_KEY));
});
test('Unauthenticated, untrusted-origin and disabled requests never create a subscription or installer URL',async()=>{
 const s=setup();assert.equal((await handleCommerceRequest(s.req('checkout',{accountToken:''}),s.env,s.upstream)).status,401);
 assert.equal((await handleCommerceRequest(s.req('download',{}, {Origin:'https://evil.test'}),s.env,s.upstream)).status,403);
 s.values.COMMERCE_ENABLED='false';assert.equal((await handleCommerceRequest(s.req('download'),s.env,s.upstream)).status,503);
 assert.equal(s.calls.length,0);
});
test('Gateway-created checkout and webhook approval use the actual Sheets ledger and provider verification',async()=>{
 const s=setup(),created=await handleCommerceRequest(s.req('checkout',{plan:'online',billing:'monthly',seats:2,country:'US',offer:'trial',requestId:randomUUID(),name:'New Buyer',company:'Example Studio'}),s.env,s.upstream),data=await created.json();
 assert.equal(data.ok,true,JSON.stringify(data));const sub=s.app.subscriptions.get(data.subscriptionId);sub.status='ACTIVE';
 const headers={Origin:'','paypal-transmission-id':'test-id','paypal-transmission-time':new Date().toISOString(),'paypal-transmission-sig':'test-signature','paypal-cert-url':'https://api.paypal.com/cert','paypal-auth-algo':'SHA256withRSA'};
 const hook=s.req('paypal-webhook',{event_type:'BILLING.SUBSCRIPTION.ACTIVATED',resource:{id:data.subscriptionId}},headers);
 const result=await handleCommerceRequest(hook,s.env,s.upstream);assert.equal((await result.json()).accepted,true);
 assert.equal(s.app.orders.rows.length,2);
 assert.equal(s.app.orders.rows[1][5],'New Buyer');assert.equal(s.app.orders.rows[1][10],'Example Studio');
});
const testSelection=()=>({plan:'online',billing:'monthly',seats:1,country:'US',offer:'trial',requestId:randomUUID()});
const fromIndia=s=>(url,options)=>url.startsWith('https://api.country.is/')?Promise.resolve(Response.json({country:'IN'})):s.upstream(url,options);
test('A private Sandbox country cannot grant an ordinary account country-edit permission',async()=>{
 const s=setup();s.values.PAYPAL_MODE='sandbox';s.values.COMMERCE_SANDBOX_COUNTRY='US';
 const response=await handleCommerceRequest(s.req('checkout',testSelection()),s.env,fromIndia(s));
 assert.equal((await response.json()).error,'country_mismatch');assert.equal(s.app.subscriptions.size,0);
 const payload=JSON.parse(JSON.parse(s.calls.find(c=>c.url===s.values.SHEET_WEB_APP_URL).options.body).payload);
 assert.equal(payload.billingNetwork.country,'IN');assert.equal(payload.ipHash,await keyedHash(s.values.TRIAL_IDENTITY_SECRET,'ip:203.0.113.12'));
});
test('India stays closed without the private Sandbox setting; browser test-country claims are ignored',async()=>{
 const s=setup();s.values.PAYPAL_MODE='sandbox';
 const result=await handleCommerceRequest(s.req('checkout',{...testSelection(),sandboxCountry:'US',COMMERCE_SANDBOX_COUNTRY:'US'}),s.env,fromIndia(s));
 assert.equal((await result.json()).error,'country_mismatch');assert.equal(s.app.subscriptions.size,0);
});
test('Live and Sandbox gateways reject country overrides from ordinary accounts',async()=>{
 const live=setup();live.values.PAYPAL_MODE='live';live.values.COMMERCE_SANDBOX_COUNTRY='US';
 const result=await handleCommerceRequest(live.req('checkout',testSelection()),live.env,fromIndia(live));
 assert.equal((await result.json()).error,'country_mismatch');assert.equal(live.app.subscriptions.size,0);
 for(const mode of ['live','']){
  const mismatch=setup();mismatch.values.PAYPAL_MODE='sandbox';mismatch.values.COMMERCE_SANDBOX_COUNTRY='US';mismatch.app.values.set('PAYPAL_MODE',mode);
  const rejected=await handleCommerceRequest(mismatch.req('checkout',testSelection()),mismatch.env,fromIndia(mismatch));
  const data=await rejected.json();assert.equal(data.error,'country_mismatch');assert.equal(mismatch.app.subscriptions.size,0);
 }
});
test('Sandbox simulation never bypasses the trial network identifier requirement or closed test countries',async()=>{
 for(const country of ['US','IN']){
  const s=setup();s.values.PAYPAL_MODE='sandbox';s.values.COMMERCE_SANDBOX_COUNTRY=country;
  if(country==='US')delete s.values.COMMERCE_CLIENT_IP_HEADER;
  const result=await handleCommerceRequest(s.req('checkout',testSelection()),s.env,fromIndia(s));
  assert.equal((await result.json()).ok,false);assert.equal(s.app.subscriptions.size,0);
 }
});

test('Reward quotes and discounted checkout use the same signed gateway, identity and private paid history',async()=>{
 const s=setup(),id='I-PRIORPAID',email=s.account.email;
 s.app.orders.rows.push([new Date('2026-01-01'),id,'CANCELLED','sandbox',email,'Buyer','US','online','monthly',10,'','P-high-ONLINE']);
 s.app.subscriptions.set(id,{id,status:'CANCELLED',plan_id:'P-high-ONLINE',create_time:'2026-01-01T00:00:00Z'});
 s.app.transactions.set(id,{transactions:[{id:'TX-VERIFIED',status:'COMPLETED',time:'2026-02-01T00:00:00Z',amount_with_breakdown:{gross_amount:{value:'220.00',currency_code:'USD'}}}]});
 const selection={plan:'online',billing:'monthly',seats:2,country:'US',email:'forged@example.com',paidPeriods:99,percent:99};
 const result=await handleCommerceRequest(s.req('rewards',selection),s.env,s.upstream);assert.equal(result.status,200);
 const quote=(await result.json()).pricing;assert.equal(quote.percent,5);assert.equal(quote.total,4264);assert.equal(quote.nextPayment,2);
 const created=await handleCommerceRequest(s.req('checkout',{...selection,offer:'standard',requestId:randomUUID(),expectedTotal:quote.total,expectedRewardPercent:5}),s.env,s.upstream);
 assert.equal(created.status,200);const data=await created.json();assert.equal(data.pricing.total,4264);assert.equal(s.app.subscriptions.get(data.subscriptionId).plan_id,[...s.app.plans.values()][0].id);
 const rejected=await handleCommerceRequest(s.req('rewards',{...selection,accountToken:'not-a-valid-session-token'}),s.env,s.upstream);assert.equal(rejected.status,401);
});
