import test from 'node:test';
import assert from 'node:assert/strict';
import { priceFor } from '../supabase/functions/_shared/catalog.js';
import { handleRequest } from '../supabase/functions/storefront/handler.js';
const origin='https://imajoy.github.io';
const envValues={ALLOWED_ORIGINS:origin,DEFAULT_COUNTRY:'US',TURNSTILE_SITE_KEY:'public-test-key',TURNSTILE_SECRET_KEY:'test-secret',TURNSTILE_HOSTNAME:'imajoy.github.io',SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'server-test-key',QUOTE_SIGNING_SECRET:'test-only-signing-key-with-at-least-32-bytes'};
const env=k=>envValues[k];
const req=(path,body,requestOrigin=origin)=>new Request('https://example.supabase.co/functions/v1/storefront'+path,{method:body?'POST':'GET',headers:{Origin:requestOrigin,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
const jsonResponse=data=>new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}});
test('Online monthly tiers respect INR 699–1999; annual monthly equivalent never falls below 699',()=>{
 for(const country of ['IN','PK','BD','NP','LK','ID','PH','VN','BR','MX','ZA','ZZ']){
  const monthly=priceFor(country==='ZZ'?'ZZ':country);
  const annual=priceFor(country,'online','yearly');
  const rate=country==='IN'?1:country==='PK'?3.25:.0116;
  assert(monthly.unitAmount/(100*rate)>=698.5);
  assert(monthly.unitAmount/(100*rate)<=1999.5);
  assert(annual.unitAmount/(1200*rate)>=698.5);
 }
 assert.equal(priceFor('IN').unitAmount,69900);
 assert.equal(priceFor('IN','online','yearly').unitAmount,838800);
 assert.equal(priceFor('US').unitAmount,2319);
 assert.equal(priceFor('GB').unitAmount,1739);
});
test('Validate plan, interval, country and seat limits',()=>{
 for(const args of [['IN','free'],['IN','online','weekly'],['india'],['IN','online','monthly',0],['IN','online','monthly',101],['IN','online','monthly',1.5]])assert.throws(()=>priceFor(...args));
 assert.equal(priceFor('IN','online','monthly',3).subtotal,209700);
});
test('Quote is calculated server-side and ignores a forged client amount',async()=>{
 const response=await handleRequest(req('/quote?country=IN&seats=2&amount=1&currency=USD'),env);
 const result=await response.json();assert.equal(response.status,200);assert.equal(result.subtotal,139800);assert.equal(result.currency,'INR');assert(result.quoteToken.includes('.'));assert(result.expiresAt>Date.now());
});
test('Quote can use server-side approximate country lookup',async()=>{
 const request=new Request('https://example.supabase.co/functions/v1/storefront/quote',{headers:{Origin:origin,'x-forwarded-for':'203.0.113.1'}});
 const response=await handleRequest(request,env,async url=>{assert.match(url,/api.country.is/);return jsonResponse({country:'PK'});});assert.equal((await response.json()).currency,'PKR');
});
test('Untrusted origins cannot read or mutate storefront',async()=>{
 assert.equal((await handleRequest(req('/config',null,'https://evil.example'),env)).status,403);
 assert.equal((await handleRequest(req('/download',{token:'fake'},'https://evil.example'),env)).status,403);
});
test('Merchant is unavailable: never accepts billing or creates a charge',async()=>{
 assert.equal((await (await handleRequest(req('/config'),env)).json()).paymentsEnabled,false);
 const response=await handleRequest(req('/checkout',{billing:{email:'not-stored@example.com'},amount:1}),env,()=>{throw Error('No upstream requests allowed');});assert.equal(response.status,503);
});
test('Missing or malformed human tokens cannot request a download',async()=>{
 for(const token of ['',null,3,'a'.repeat(2049)])assert.equal((await handleRequest(req('/download',{token}),env,()=>{throw Error('No upstream requests allowed');})).status,400);
});
for(const [name,verification] of [['failed',{success:false}],['wrong action',{success:true,action:'checkout',hostname:'imajoy.github.io'}],['wrong hostname',{success:true,action:'download',hostname:'evil.example'}],['expired',{success:false,'error-codes':['timeout-or-duplicate']}]]){
 test(`Reject ${name} verification without generating any installer link`,async()=>{
  let count=0;const response=await handleRequest(req('/download',{token:'test-token'}),env,async()=>{count++;return jsonResponse(verification);});assert.equal(response.status,403);assert.equal(count,1);
 });
}
test('Valid server verification creates a short-lived private storage URL',async()=>{
 const calls=[];const response=await handleRequest(req('/download',{token:'test-token'}),env,async(url,options)=>{
  calls.push(url);
  if(url.includes('siteverify'))return jsonResponse({success:true,action:'download',hostname:'imajoy.github.io'});
  assert.match(url,/object\/sign\/installers\/AjoyTools_Setup.py/);assert.equal(JSON.parse(options.body).expiresIn,60);assert.equal(options.headers.Authorization,'Bearer server-test-key');
  return jsonResponse({signedURL:'/object/sign/installers/AjoyTools_Setup.py?token=test-signed-token'});
 });
 assert.equal(response.status,200);const result=await response.json();assert.equal(result.expiresIn,60);assert.match(result.url,/^https:\/\/example.supabase.co\/storage\/v1\/object\/sign/);assert.equal(calls.length,2);
 assert(!JSON.stringify(result).includes('server-test-key'));
});
test('Unconfigured verification fails closed',async()=>{
 const emptyEnv=k=>k==='ALLOWED_ORIGINS'?origin:undefined;
 assert.equal((await handleRequest(req('/download',{token:'test-token'}),emptyEnv)).status,503);
 assert.equal((await (await handleRequest(req('/config'),emptyEnv)).json()).downloadsEnabled,false);
});
