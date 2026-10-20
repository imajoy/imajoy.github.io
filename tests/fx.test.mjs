import test from 'node:test';
import assert from 'node:assert/strict';
let serial=0;
async function fixture(t,response={USD:1,EUR:.9,INR:84,JPY:150,KWD:.3},cached){
 const previous=['fetch','localStorage'].map(k=>Object.getOwnPropertyDescriptor(globalThis,k)),values=new Map(cached?[['ajoy.fx',JSON.stringify(cached)]]:[]);let requests=0;
 globalThis.localStorage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};
 globalThis.fetch=async()=>{requests++;return response===null?new Response('',{status:503}):Response.json({rates:response});};
 t.after(()=>['fetch','localStorage'].forEach((k,i)=>previous[i]?Object.defineProperty(globalThis,k,previous[i]):delete globalThis[k]));
 return {fx:await import('../js/fx.js?fixture='+ ++serial),values,count:()=>requests};
}
test('Display conversions cover USD, INR, zero, negatives and currencies with different decimal precision',async t=>{
 const {fx}=await fixture(t),rates=await fx.exchangeRates();
 assert.equal(fx.convertMinor(2200,'USD','EUR',rates),1980);assert.equal(fx.convertMinor(-110,'USD','EUR',rates),-99);
 assert.equal(fx.convertMinor(89900,'INR','USD',rates),89900/84);
 assert.equal(fx.convertMinor(0,'USD','JPY',null),0);assert.equal(fx.convertMinor(2200,'USD','EUR',null),null);
 assert.equal(fx.currencyForCountry('BG'),'EUR');assert.equal(fx.currencyForCountry('CA'),'CAD');assert.equal(fx.currencyForCountry('IN'),'INR');
 assert.match(fx.formatCurrency(3300,'JPY'),/3,300/);assert(!fx.formatCurrency(3300,'JPY').includes('.00'));
 assert.match(fx.formatCurrency(6.6,'KWD'),/6\.600/);
});
test('Concurrent currency consumers share one fetch and preserve decimal estimates',async t=>{
 const {fx,count}=await fixture(t);const [a,b]=await Promise.all([fx.localFormatter('DE'),fx.localFormatter('IN')]);
 assert.equal(count(),1);assert.match(a(2090),/18\.81/);assert.match(b(2200),/1,848\.00/);
});
test('A recent validated cache is reused without a request',async t=>{
 const {fx,count}=await fixture(t,null,{t:Date.now(),r:{USD:1,EUR:.9}});assert.match((await fx.localFormatter('DE'))(2200),/19\.80/);assert.equal(count(),0);
});
test('Corrupt and future caches are ignored; failed or invalid feeds never invent rates',async t=>{
 const {fx,count}=await fixture(t,{USD:1,EUR:.9},{t:Date.now()+3600e3,r:{USD:1,EUR:999}});
 assert.match((await fx.localFormatter('DE'))(2200),/19\.80/);assert.equal(count(),1);
});
test('Unavailable rates return no converted estimate',async t=>{const {fx}=await fixture(t,null);assert.equal(await fx.localFormatter('DE'),null);});
test('Nonpositive exchange rates are rejected',async t=>{const {fx}=await fixture(t,{USD:1,EUR:0});assert.equal(await fx.localFormatter('DE'),null);});
