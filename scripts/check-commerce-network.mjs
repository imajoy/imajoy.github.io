/* Read-only probe of a temporary function. It never changes production secrets or calls commerce. */
import {isIP} from 'node:net';
import {randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';

export const HEADER_NAMES=['cf-connecting-ip','x-real-ip'];
export const PROBES=[
  ['normal',{}],
  ['forged Cloudflare IPv4',{'cf-connecting-ip':'203.0.113.123'}],
  ['forged Cloudflare IPv6',{'cf-connecting-ip':'2001:db8::123'}],
  ['forged real-IP IPv4',{'x-real-ip':'198.51.100.123'}],
  ['forged real-IP IPv6',{'x-real-ip':'2001:db8::456'}],
  ['forged forwarding chain',{'x-forwarded-for':'203.0.113.123, 198.51.100.123'}],
  ['forged Forwarded header',{'forwarded':'for=203.0.113.123'}],
  ['all forwarding headers forged',{'cf-connecting-ip':'203.0.113.123','x-real-ip':'198.51.100.123','x-forwarded-for':'203.0.113.123','forwarded':'for=198.51.100.123'}]
];
export function canonicalIp(value) {
  if(typeof value!=='string'||!isIP(value.trim()))return '';
  value=value.trim().toLowerCase();
  return isIP(value)===6?new URL('http://['+value+']/').hostname.slice(1,-1):value;
}
export function assessNetwork(expectedIp,samples) {
  const expected=canonicalIp(expectedIp);
  if(!expected)throw new Error('The independent public-IP lookup did not return a valid IP.');
  if(samples.length!==PROBES.length||samples.some((s,i)=>s.name!==PROBES[i][0]||!s.observed||typeof s.observed!=='object'))throw new Error('The network check is incomplete. No header can be recommended.');
  return HEADER_NAMES.map(header=>{
    if(samples[0].status&&samples[0].status!==200)return {header,result:'NORMAL REQUEST BLOCKED (HTTP '+samples[0].status+')',candidate:false};
    const baseline=canonicalIp(samples[0].observed[header]);
    if(!baseline)return {header,result:'NOT AVAILABLE',candidate:false};
    if(baseline!==expected)return {header,result:'DOES NOT MATCH PUBLIC IP',candidate:false};
    if(samples.some(s=>(!s.status||s.status===200)&&canonicalIp(s.observed[header])!==expected))return {header,result:'CHANGES WITH REQUEST HEADERS',candidate:false};
    if(samples.some(s=>s.status&&s.status!==200))return {header,result:'INCONCLUSIVE: SOME REQUESTS BLOCKED',candidate:false};
    return {header,result:'MATCHES PUBLIC IP IN ALL 8 CHECKS',candidate:true};
  });
}
export async function runNetworkCheck(request=fetch,project='wsadhewcmpdhojgqzstw') {
  if(!/^[a-z0-9]{20}$/.test(project))throw new Error('Invalid Supabase project reference.');
  const publicResponse=await request('https://api64.ipify.org/?format=json',{signal:AbortSignal.timeout(15000)});
  if(!publicResponse.ok)throw new Error('Could not determine your public IP. Retry without changing any settings.');
  const publicIp=(await publicResponse.json()).ip,samples=[];
  for(const [name,headers] of PROBES){
    const nonce=randomUUID();
    const response=await request('https://'+project+'.supabase.co/functions/v1/network-check?nonce='+nonce,{headers,cache:'no-store',signal:AbortSignal.timeout(15000)});
    const server=(response.headers.get('server')||'not reported').replace(/[^a-zA-Z0-9 ._/-]/g,'').slice(0,80);
    if(!response.ok){
      samples.push({name,status:response.status,server,observed:{}});
      // If even the normal request is blocked, avoid sending forged-header requests.
      if(name==='normal')break;
      continue;
    }
    let result;try{result=await response.json();}catch{throw new Error('Probe "'+name+'" returned a non-JSON response. No header was verified.');}
    if(result.nonce!==nonce)throw new Error('Unexpected or cached diagnostic response during "'+name+'". No settings should be changed.');
    samples.push({name,status:response.status,server,observed:result.observed});
  }
  const blockedBaseline=samples.length===1&&samples[0].status!==200;
  return {
    requests:samples.map(({name,status,server})=>({probe:name,status,server})),
    headers:blockedBaseline?HEADER_NAMES.map(header=>({header,result:'NORMAL REQUEST BLOCKED (HTTP '+samples[0].status+')',candidate:false})):assessNetwork(publicIp,samples)
  };
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    console.log('Checking the temporary network-check function. No accounts or payments are accessed.');
    const result=await runNetworkCheck();
    console.table(result.requests);
    console.table(result.headers.map(({header,result})=>({header,result})));
    const normal=result.requests[0];
    if(normal.status===401)console.log('The normal request was rejected with HTTP 401. Check JWT verification for network-check only.');
    else if(normal.status===403)console.log('The normal request was rejected with HTTP 403 before header checks could finish. Review its network/edge access and function invocation logs; this is not proof of a JWT setting problem.');
    else if(result.requests.some(r=>r.status!==200))console.log('The normal request succeeded, but one or more forged-header requests were rejected. Share both tables; the result remains inconclusive.');
    console.log(result.headers.some(r=>r.candidate)?'A candidate header was observed. Share both result tables for review before changing COMMERCE_CLIENT_IP_HEADER.':'No supported header was verified. Leave COMMERCE_CLIENT_IP_HEADER unset.');
    console.log('These are observations from this deployment, not a guarantee of the provider ingress contract. No settings were changed.');
  }catch(error){console.error('Check stopped: '+error.message);process.exitCode=1;}
}
