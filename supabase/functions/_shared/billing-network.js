import {trustedIp} from './network.js';
import {createCountryLookup} from './country.js';
/* Reputation is not proof of residence. Only an explicitly trusted ingress IP is sent. */
/** @param {typeof fetch} request @param {(key: string) => string | undefined} env @param {() => number} now */
export function createBillingNetworkLookup(request=fetch,env=()=>undefined,now=Date.now){
 const countryOf=createCountryLookup(request,now,env),cache=new Map();
 return async req=>{
  const country=await countryOf(req);
  if(env('BILLING_POLICY_ENABLED')!=='true')return {country,status:'disabled'};
  const ip=trustedIp(req,env),key=env('BILLING_VPN_API_KEY');
  if(!ip||!country||!key)return {country,status:'unavailable'};
  const previous=cache.get(ip);if(previous&&now()-previous.time<60000)return {country,status:previous.status};
  try{
   const url='https://proxycheck.io/v2/'+encodeURIComponent(ip)+'?key='+encodeURIComponent(key)+'&vpn=1';
   const response=await request(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(4000)});
   if(!response.ok)return {country,status:'unavailable'};
   const data=await response.json(),entry=data[ip];
   // Quota errors, partial responses and an unexpected schema cannot mean "no VPN".
   if(data.status!=='ok'||!entry||!['yes','no'].includes(entry.proxy))return {country,status:'unavailable'};
   const status=entry.proxy==='yes'?'vpn':'clear';
   if(cache.size>=500)cache.clear();cache.set(ip,{status,time:now()});
   return {country,status};
  }catch{return {country,status:'unavailable'};}
 };
}
