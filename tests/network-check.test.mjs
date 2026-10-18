import test from 'node:test';
import assert from 'node:assert/strict';
import {handleNetworkCheck} from '../supabase/functions/network-check/handler.js';
import {PROBES,assessNetwork,runNetworkCheck} from '../scripts/check-commerce-network.mjs';
const ip='198.51.100.10';
const samples=()=>PROBES.map(([name])=>({name,observed:{'cf-connecting-ip':ip,'x-real-ip':''}}));
test('Network probe exposes only candidate IP headers and echoes a cache-busting nonce',async()=>{
  const nonce='11111111-1111-4111-8111-111111111111';
  const response=handleNetworkCheck(new Request('https://example.test/?nonce='+nonce,{headers:{'cf-connecting-ip':ip,authorization:'private-token',cookie:'private-cookie'}}));
  assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'no-store');
  const data=await response.json();assert.deepEqual(data,{nonce,observed:{'cf-connecting-ip':ip,'x-real-ip':''}});
  assert.equal(handleNetworkCheck(new Request('https://example.test/')).status,400);
  assert.equal(handleNetworkCheck(new Request('https://example.test/',{method:'POST'})).status,405);
});
test('Header recommendations require a public-IP match and stable observations for every probe',()=>{
  assert.equal(assessNetwork(ip,samples())[0].candidate,true);
  assert.equal(assessNetwork(ip,samples())[1].candidate,false);
  const spoofed=samples();spoofed[2].observed['cf-connecting-ip']='203.0.113.123';
  assert.equal(assessNetwork(ip,spoofed)[0].candidate,false);
  assert.equal(assessNetwork('198.51.100.11',samples())[0].candidate,false);
  assert.throws(()=>assessNetwork(ip,samples().slice(1)),/incomplete/);
  assert.throws(()=>assessNetwork('invalid',samples()),/valid IP/);
});
test('IPv6 spellings are normalized and comma-separated or private-proxy mismatches fail',()=>{
  const list=samples();for(const s of list)s.observed['cf-connecting-ip']='2001:db8::1';
  assert.equal(assessNetwork('2001:0db8:0:0:0:0:0:1',list)[0].candidate,true);
  list[0].observed['cf-connecting-ip']='198.51.100.10, 203.0.113.1';
  assert.equal(assessNetwork(ip,list)[0].candidate,false);
  for(const s of list)s.observed['cf-connecting-ip']='10.0.0.1';
  assert.equal(assessNetwork(ip,list)[0].candidate,false);
});
test('Diagnostic runner only calls the IP service and temporary probe, and rejects cached results',async()=>{
  const calls=[];
  const request=async(url)=>{calls.push(url);if(url.startsWith('https://api64.ipify.org/'))return Response.json({ip});return handleNetworkCheck(new Request(url,{headers:{'cf-connecting-ip':ip}}));};
  const result=await runNetworkCheck(request);assert(result[0].candidate);assert.equal(calls.length,9);
  assert(calls.every(url=>url.startsWith('https://api64.ipify.org/')||url.includes('/functions/v1/network-check?')));
  await assert.rejects(runNetworkCheck(async url=>url.includes('ipify')?Response.json({ip}):Response.json({nonce:'old',observed:{}})),/cached/);
  await assert.rejects(runNetworkCheck(async url=>url.includes('ipify')?Response.json({ip}):new Response('',{status:401})),/HTTP 401/);
});
