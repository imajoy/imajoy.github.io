/* Approximate visitor country: verified edge lookup first, direct country.is/GeoJS fallback.
   Cached for display only; checkout independently validates eligibility. Empty means unknown. */
const KEY = 'ajoy.geo';
const normalize = c => typeof c === 'string' ? c.trim().toUpperCase() : '';
const ok = c => /^[A-Z]{2}$/.test(c || '') && !['XX','ZZ','EU'].includes(c);
let pending;
export function cachedGeo() { try { const v = sessionStorage.getItem(KEY); return ok(v) ? v : ''; } catch (e) { return ''; } }
export function rememberGeo(value) { const c=normalize(value); if (ok(c)) { try { sessionStorage.setItem(KEY, c); } catch (e) { /* private mode */ } } return ok(c) ? c : ''; }
/* Always asks again (a VPN or network can change between visits); the saved value only avoids a blank first paint. */
async function clientLookup() {
  for (const url of ['https://api.country.is/', 'https://get.geojs.io/v1/ip/country.json']) {
    try {
      const r = await fetch(url, { cache: 'no-store', credentials: 'omit', signal: AbortSignal.timeout(2500) });
      if (r.ok) { const c=rememberGeo((await r.json()).country); if(c)return c; }
    } catch (e) { /* Try the next provider when blocked, timed out or invalid. */ }
  }
  return '';
}
async function refreshGeo() {
  const base = window.AJOY_CONFIG && window.AJOY_CONFIG.paypalConfigUrl;
  if(base)try {
    const r = await fetch(base + (base.includes('?') ? '&' : '?') + 'geo=1', { cache: 'no-store', credentials: 'omit', signal: AbortSignal.timeout(4500) });
    if (r.ok) { const c = rememberGeo((await r.json()).country); if (c) return c; }
  } catch (e) { /* offline or blocked */ }
  return clientLookup();
}
// Share concurrent consumers; refresh again on a later call rather than keeping a stale network result forever.
export function detectGeo() {
  if(!pending)pending=refreshGeo().finally(()=>{pending=null;});
  return pending;
}
