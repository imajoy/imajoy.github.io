import test from 'node:test';
import assert from 'node:assert/strict';
import {guard,assertConfig,configProblems,createLimiter,SECURITY_HEADERS} from '../supabase/functions/_shared/guard.js';
import {COMMERCE_REQUIRED,COMMERCE_LIMITS,ORIGIN_LIST} from '../supabase/functions/_shared/policy.js';
const req=(path='checkout',init={})=>new Request('https://x.test/functions/v1/commerce/'+path,{method:'POST',headers:{'cf-connecting-ip':'198.51.100.7',origin:'https://imajoy.github.io'},...init});
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
test('every response gets the security headers and a correlation id',async()=>{
  const g=guard(()=>json({ok:true}),{name:'t'});
  const r=await g(req());
  for(const [k,v] of Object.entries(SECURITY_HEADERS))assert.equal(r.headers.get(k),v);
  assert.match(SECURITY_HEADERS['Strict-Transport-Security'],/max-age=31536000/);
  assert.ok(r.headers.get('x-correlation-id'));
});
test('client errors keep their message and gain a correlation id',async()=>{
  const r=await guard(()=>json({ok:false,error:'x',message:'Invalid request.'},400),{name:'t'})(req());
  const b=await r.json();assert.equal(b.message,'Invalid request.');assert.equal(b.correlationId,r.headers.get('x-correlation-id'));
});
test('crashes return a generic message with an id and log no message or stack',async()=>{
  const lines=[];
  const r=await guard(()=>{throw new Error('SELECT * FROM licenses at /srv/app/db.js:12 secret=abc');},{name:'t',log:l=>lines.push(l),origins:()=>['https://imajoy.github.io']})(req());
  const text=await r.text();assert.equal(r.status,500);
  assert.doesNotMatch(text,/SELECT|\/srv|secret|stack/i);assert.match(text,/correlationId/);
  assert.equal(r.headers.get('access-control-allow-origin'),'https://imajoy.github.io');
  assert.doesNotMatch(lines.join(),/SELECT|\/srv|secret/);assert.match(lines.join(),new RegExp(JSON.parse(text).correlationId));
});
test('5xx replies from handlers are logged by id only',async()=>{
  const lines=[];
  const r=await guard(()=>json({ok:false,error:'unavailable'},503),{name:'t',log:l=>lines.push(l)})(req());
  assert.equal(r.status,503);assert.equal(lines.length,1);assert.match(lines[0],/503/);
});
test('rate limit: 10 checkouts per minute per address, then 429 with Retry-After; other addresses unaffected',async()=>{
  let t=1000;const g=guard(()=>json({ok:true}),{name:'c',limits:COMMERCE_LIMITS,limiter:createLimiter(()=>t),origins:()=>ORIGIN_LIST(()=>'')});
  for(let i=0;i<10;i++)assert.equal((await g(req())).status,200);
  const blocked=await g(req());assert.equal(blocked.status,429);assert.ok(Number(blocked.headers.get('retry-after'))>=1);
  assert.equal(blocked.headers.get('access-control-allow-origin'),'https://imajoy.github.io');
  const other=await g(new Request('https://x.test/c/checkout',{method:'POST',headers:{'cf-connecting-ip':'198.51.100.8'}}));assert.equal(other.status,200);
  t+=61000;assert.equal((await g(req())).status,200);
});
test('webhooks and CORS preflights are not rate limited',async()=>{
  const g=guard(()=>json({ok:true}),{name:'c',limits:COMMERCE_LIMITS,limiter:createLimiter(()=>1)});
  for(let i=0;i<100;i++)assert.equal((await g(req('paypal-webhook'))).status,200);
  for(let i=0;i<100;i++)assert.equal((await g(req('checkout',{method:'OPTIONS'}))).status,200);
});
test('start-up refuses a missing or weak critical setting without printing values',()=>{
  const ok={COMMERCE_SECRET:'a'.repeat(32),TRIAL_IDENTITY_SECRET:'b'.repeat(32),SHEET_WEB_APP_URL:'https://script.google.com/macros/s/AKfy-1/exec'};
  assert.doesNotThrow(()=>assertConfig('commerce',k=>ok[k],COMMERCE_REQUIRED));
  assert.deepEqual(configProblems(k=>({...ok,COMMERCE_SECRET:'short-secret-value'})[k],COMMERCE_REQUIRED),['COMMERCE_SECRET is shorter than 32 characters']);
  assert.throws(()=>assertConfig('commerce',()=>undefined,COMMERCE_REQUIRED),/TRIAL_IDENTITY_SECRET is missing/);
  assert.throws(()=>assertConfig('commerce',k=>({...ok,SHEET_WEB_APP_URL:'http://evil.example'})[k],COMMERCE_REQUIRED),/wrong format/);
  try{assertConfig('commerce',k=>({...ok,COMMERCE_SECRET:'short-secret-value'})[k],COMMERCE_REQUIRED);}catch(e){assert.doesNotMatch(e.message,/short-secret-value/);}
});
test('no function allows every origin and none lists localhost',async()=>{
  const {readFileSync,readdirSync}=await import('node:fs');
  const root=new URL('../supabase/functions/',import.meta.url);
  for(const dir of readdirSync(root)){
    for(const f of ['index.ts','handler.js']){let s='';try{s=readFileSync(new URL(dir+'/'+f,root),'utf8');}catch{continue;}
      assert.doesNotMatch(s,/Allow-Origin['"]?\s*[:,]\s*['"]\*['"]/,dir+'/'+f);assert.doesNotMatch(s,/localhost|127\.0\.0\.1/,dir+'/'+f);}
  }
});
