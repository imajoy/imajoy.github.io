import test from 'node:test';
import assert from 'node:assert/strict';
import {createCountryLookup} from '../supabase/functions/_shared/country.js';
import {availability,regionalPrice} from '../js/regions.js';
let serial=0;
async function browser(t,config,request){
 const keys=['window','sessionStorage','fetch'],previous=keys.map(k=>Object.getOwnPropertyDescriptor(globalThis,k));
 const storage=new Map();
 globalThis.window={AJOY_CONFIG:config};globalThis.sessionStorage={getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)};globalThis.fetch=request;
 t.after(()=>keys.forEach((k,i)=>{if(previous[i])Object.defineProperty(globalThis,k,previous[i]);else delete globalThis[k];}));
 return import('../js/geo.js?test='+ ++serial);
}
test('browser prefers server country, shares concurrent lookups and refreshes subsequent requests',async t=>{
 let calls=0;const geo=await browser(t,{paypalConfigUrl:'https://example.test/config?x=1'},async url=>{calls++;assert.match(url,/&geo=1$/);return Response.json({country:calls===1?' in ':'US'});});
 assert.deepEqual(await Promise.all([geo.detectGeo(),geo.detectGeo()]),['IN','IN']);assert.equal(calls,1);assert.equal(geo.cachedGeo(),'IN');
 assert.equal(await geo.detectGeo(),'US');assert.equal(geo.cachedGeo(),'US');assert.equal(availability('IN').open,false);assert.equal(regionalPrice('online','monthly',1,'IN').currency,'INR');
});
test('browser falls back from unavailable Supabase and country.is to GeoJS',async t=>{
 const calls=[];const geo=await browser(t,{paypalConfigUrl:'https://example.test/config'},async url=>{calls.push(url);if(url.includes('example.test'))throw new Error('offline');if(url.includes('country.is'))return new Response('rate limit',{status:429});return Response.json({country:'GB'});});
 assert.equal(await geo.detectGeo(),'GB');assert.equal(calls.length,3);assert.match(calls[2],/get.geojs.io/);assert.equal(availability(geo.cachedGeo()).reason,'tax');
});
test('browser lookups still work without Supabase config; malformed and unknown countries fall through',async t=>{
 const geo=await browser(t,{},async url=>url.includes('country.is')?Response.json({country:'XX'}):Response.json({country:' pk '}));
 assert.equal(await geo.detectGeo(),'PK');assert.equal(regionalPrice('online','monthly',1,geo.cachedGeo()).unitAmount,799);
 assert.equal(geo.rememberGeo('ZZ'),'');assert.equal(geo.rememberGeo({country:'US'}),'');assert.equal(geo.cachedGeo(),'PK');
});
test('all lookup failures return unknown without inventing a country or rejecting',async t=>{
 const geo=await browser(t,{},async url=>{if(url.includes('country.is'))return new Response('not json');throw new DOMException('timeout','TimeoutError');});
 assert.equal(await geo.detectGeo(),'');assert.equal(geo.cachedGeo(),'');
});
test('server falls back to GeoJS and caches a valid country per IP for one hour',async()=>{
 const calls=[];let time=0;const lookup=createCountryLookup(async url=>{calls.push(url);return url.includes('country.is')?new Response('limit',{status:429}):Response.json({country:'US'});},()=>time,()=> 'cf-connecting-ip');
 const req=new Request('https://example.test',{headers:{'cf-connecting-ip':'203.0.113.9'}});
 assert.equal(await lookup(req),'US');assert.equal(await lookup(req),'US');assert.equal(calls.length,2);assert.match(calls[1],/country\/203.0.113.9.json$/);
 time=3600001;await lookup(req);assert.equal(calls.length,4);
});
test('server rejects invalid lookup data and retries after failures without caching unknown',async()=>{
 let calls=0;const lookup=createCountryLookup(async()=>{calls++;return Response.json({country:calls<=2?'ZZ':'IN'});},Date.now,()=> 'cf-connecting-ip');
 const req=new Request('https://example.test',{headers:{'cf-connecting-ip':'2001:db8::1'}});
 assert.equal(await lookup(req),'');assert.equal(await lookup(req),'IN');assert.equal(calls,3);
 assert.equal(await lookup(new Request('https://example.test')),'');
});

test('unverified forwarding and country headers cannot select a server region',async()=>{
 const lookup=createCountryLookup(()=>{throw Error('must not query an unverified IP');});
 assert.equal(await lookup(new Request('https://example.test',{headers:{'cf-ipcountry':'US','x-vercel-ip-country':'IN','x-forwarded-for':'203.0.113.9','cf-connecting-ip':'203.0.113.9'}})),'');
});
