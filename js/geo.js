/* Where the visitor is connecting from, as seen by the paypal-config function (network edge, not the browser).
   Cached for the tab session so pricing and checkout agree. Empty string means unknown. */
const KEY = 'ajoy.geo';
const ok = c => /^[A-Z]{2}$/.test(c || '');
export function cachedGeo() { try { const v = sessionStorage.getItem(KEY); return ok(v) ? v : ''; } catch (e) { return ''; } }
export function rememberGeo(c) { if (ok(c)) { try { sessionStorage.setItem(KEY, c); } catch (e) { /* private mode */ } } return ok(c) ? c : ''; }
/* Always asks again (a VPN or network can change between visits); the saved value only avoids a blank first paint. */
async function clientLookup() {
  try {
    const r = await fetch('https://api.country.is/', { cache: 'no-store', signal: AbortSignal.timeout(3000) });
    if (r.ok) return rememberGeo((await r.json()).country);
  } catch (e) { /* blocked */ }
  return '';
}
export async function detectGeo() {
  const base = window.AJOY_CONFIG && window.AJOY_CONFIG.paypalConfigUrl;
  if (!base) return '';
  try {
    const r = await fetch(base + (base.includes('?') ? '&' : '?') + 'geo=1', { cache: 'no-store', signal: AbortSignal.timeout(3500) });
    if (r.ok) { const c = rememberGeo((await r.json()).country); if (c) return c; }
  } catch (e) { /* offline or blocked */ }
  return clientLookup();
}
