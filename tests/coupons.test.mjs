import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,stat,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {priceFor} from '../supabase/functions/_shared/catalog.js';
import {applyCoupon,couponHash} from '../supabase/functions/_shared/coupons.js';
import {handleRequest} from '../supabase/functions/storefront/handler.js';
const code='TEST-OWNER-10',future=new Date(Date.now()+86400000).toISOString();
const makeRule=extra=>({active:true,percent:10,expiresAt:future,billing:['monthly'],...extra});
const registry=async rule=>({[await couponHash(code)]:rule});
test('Regional price table: yearly is 12 months less about 20%, offline is double, tiers never invert',async()=>{
 globalThis.window={AJOY_CONFIG:{apiBase:''}};
 const {previewPrice}=await import('../js/commerce.js');
 const {availability,tierFor}=await import('../js/regions.js');
 delete globalThis.window;
 for(const country of ['IN','PK','ID','BR','US','CA','AU','AE','DE','GB','ZZ'])for(const plan of ['online','offline'])for(const seats of [1,3,100]){
  const m=previewPrice(plan,'monthly',seats,country),y=previewPrice(plan,'yearly',seats,country);
  assert.equal(m.subtotal,m.unitAmount*seats);assert.equal(y.subtotal,y.unitAmount*seats);
  assert(Math.abs(y.unitAmount-m.unitAmount*12*.8)<=100,country+' yearly is about 20% off');
  assert(y.annualSavings>0);
 }
 for(const country of ['US','BR','PK']){assert.equal(previewPrice('offline','monthly',1,country).unitAmount,previewPrice('online','monthly',1,country).unitAmount*2);}
 assert(previewPrice('online','monthly',1,'US').unitAmount>previewPrice('online','monthly',1,'BR').unitAmount);
 assert(previewPrice('online','monthly',1,'BR').unitAmount>previewPrice('online','monthly',1,'PK').unitAmount);
 assert.equal(tierFor('US'),'high');assert.equal(tierFor('BR'),'mid');assert.equal(tierFor('PK'),'low');
 assert.equal(availability('US').open,true);assert.equal(availability('DE').open,false);assert.equal(availability('GB').reason,'tax');assert.equal(availability('IN').reason,'india');
});
test('Billing country must match the connection country; PayPal-unsupported countries are closed',async()=>{
 const {availability,countryCheck}=await import('../js/regions.js');
 assert.equal(availability('LK').open,true);assert.equal(availability('PK').reason,'paypal');assert.equal(availability('LK',['LK']).reason,'paypal');
 assert.equal(countryCheck('LK','LK').ok,true);assert.equal(countryCheck('LK','').ok,true);
 assert.equal(countryCheck('LK','US').ok,false,'US visitor cannot pick the cheap tier');
 assert.equal(countryCheck('US','LK').ok,true,'paying the dearer tier is allowed');
 assert.equal(countryCheck('US','DE').ok,false,'EU visitor cannot pick an open country');
 assert.equal(countryCheck('US','IN').ok,false);
 assert.equal(countryCheck('BR','US').ok,false);assert.equal(countryCheck('US','BR').ok,true);
});
test('A valid monthly coupon discounts server subtotal and preserves original prices',async()=>{
 const quote=priceFor('IN');const result=await applyCoupon(quote,' test-owner-10 ',await registry(makeRule()));
 assert.equal(result.subtotal,80910);assert.equal(result.baseSubtotal,89900);assert.equal(result.unitAmount,89900);assert.equal(result.coupon.discountAmount,8990);assert.equal(result.coupon.percent,10);
 assert(result.expiresAt<=Date.parse(future));
});
test('Expired, inactive, unknown and malformed codes fail closed',async()=>{
 for(const rule of [makeRule({active:false}),makeRule({expiresAt:'invalid'}),makeRule({expiresAt:new Date(Date.now()-1000).toISOString()}),makeRule({percent:100}),makeRule({billing:'monthly'})])await assert.rejects(applyCoupon(priceFor('IN'),code,await registry(rule)));
 for(const invalid of ['x','<script>bad</script>','UNKNOWN-OWNER-CODE'])await assert.rejects(applyCoupon(priceFor('IN'),invalid,await registry(makeRule())));
});
test('Country, plan, billing and quantity eligibility is enforced on server',async()=>{
 for(const rule of [makeRule({plans:['offline']}),makeRule({countries:['US']}),makeRule({billing:['yearly']}),makeRule({maxSeats:1})])await assert.rejects(applyCoupon(priceFor('IN','online','monthly',2),code,await registry(rule)));
});
test('Coupon cannot breach price floor or stack twice',async()=>{
 await assert.rejects(applyCoupon(priceFor('IN','online','yearly'),code,await registry(makeRule({billing:['yearly']}))),/current price/);
 const applied=await applyCoupon(priceFor('US'),code,await registry(makeRule()));
 await assert.rejects(applyCoupon(applied,code,await registry(makeRule())),/one coupon/);
 const quote=priceFor('IN');await assert.rejects(applyCoupon(quote,code,await registry(makeRule({percent:50}))),/current price/);
});
test('Public coupon endpoint ignores forged amounts and returns only selected coupon data',async()=>{
 const values={ALLOWED_ORIGINS:'https://imajoy.github.io',COUPONS_JSON:JSON.stringify(await registry(makeRule())),QUOTE_SIGNING_SECRET:'test-only-signing-secret-with-32-bytes'};
 const request=new Request('https://example.supabase.co/functions/v1/storefront/coupon',{method:'POST',headers:{Origin:'https://imajoy.github.io','Content-Type':'application/json'},body:JSON.stringify({code,country:'IN',plan:'online',billing:'monthly',seats:2,subtotal:1,percent:99,minimumSubtotal:0})});
 const response=await handleRequest(request,key=>values[key]);const result=await response.json();assert.equal(response.status,200);assert.equal(result.subtotal,161820);assert.equal(result.coupon.percent,10);assert(result.quoteToken);assert(!JSON.stringify(result).includes(await couponHash(code)));
});
test('Coupon endpoint rejects bad origins and malformed or oversized requests',async()=>{
 const env=key=>key==='ALLOWED_ORIGINS'?'https://imajoy.github.io':undefined;
 const make=(body,origin='https://imajoy.github.io')=>new Request('https://example.supabase.co/functions/v1/storefront/coupon',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body});
 assert.equal((await handleRequest(make('{}','https://evil.example'),env)).status,403);
 assert.equal((await handleRequest(make('bad-json'),env)).status,400);
 assert.equal((await handleRequest(make(' '.repeat(2049)),env)).status,413);
 const broken=key=>key==='COUPONS_JSON'?'bad-json':env(key);assert.equal((await handleRequest(make('{}'),broken)).status,503);
});
test('Owner utility creates a private hashed registry, preserves entries and rejects duplicates',async()=>{
 const directory=await mkdtemp('/tmp/ajoy-coupon-test-'),file=directory+'/coupons.json';
 try{
  const args=['scripts/create-coupon.mjs','--percent','10','--expires',future,'--billing','monthly','--out',file];
  const output=execFileSync(process.execPath,[...args,'--code','TEST-PRIVATE-ONE'],{encoding:'utf8'});assert(output.includes('TEST-PRIVATE-ONE'));
  let data=JSON.parse(await readFile(file,'utf8'));assert(!JSON.stringify(data).includes('TEST-PRIVATE-ONE'));assert.equal(data[await couponHash('TEST-PRIVATE-ONE')].percent,10);assert.equal((await stat(file)).mode&0o777,0o600);
  execFileSync(process.execPath,[...args,'--code','TEST-PRIVATE-TWO']);data=JSON.parse(await readFile(file,'utf8'));assert.equal(Object.keys(data).length,2);
  assert.throws(()=>execFileSync(process.execPath,[...args,'--code','TEST-PRIVATE-ONE'],{stdio:'pipe'}));
  assert.throws(()=>execFileSync(process.execPath,[...args.slice(0,-2),'--out','./coupon-should-not-exist.json'],{stdio:'pipe'}));
 }finally{await rm(directory,{recursive:true,force:true});}
});
