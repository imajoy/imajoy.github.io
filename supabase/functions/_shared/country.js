import {trustedIp} from './network.js';
/* Approximate display location only. Paid checkout independently verifies eligibility and pricing. */
const valid = value => typeof value === 'string' && /^[A-Z]{2}$/.test(value) && !['XX','ZZ','EU'].includes(value);
/** @param {typeof fetch} request @param {() => number} now @param {(key: string) => string | undefined} env */
export function createCountryLookup(request = fetch, now = Date.now, env = () => undefined) {
  const seen = new Map();
  async function lookup(url) {
    try {
      const response = await request(url, {signal:AbortSignal.timeout(1800),headers:{Accept:'application/json'}});
      if(!response.ok)return '';
      const country=String((await response.json()).country||'').trim().toUpperCase();
      return valid(country)?country:'';
    } catch { return ''; }
  }
  return async req => {
    // Only use the ingress header explicitly verified/configured by the owner.
    const ip=trustedIp(req,env);
    if(!ip)return '';
    const hit=seen.get(ip);
    if(hit&&now()-hit.time<3600000)return hit.country;
    const country=await lookup('https://api.country.is/'+encodeURIComponent(ip))||await lookup('https://get.geojs.io/v1/ip/country/'+encodeURIComponent(ip)+'.json');
    if(country){if(seen.size>=500)seen.clear();seen.set(ip,{country,time:now()});}
    return country;
  };
}
