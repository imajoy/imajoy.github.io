/* Where the visitor is connecting from, as seen by the paypal-config function (network edge, not the browser).
   Cached for the tab session so pricing and checkout agree. Empty string means unknown. */
const KEY = 'ajoy.geo';
const ok = c => /^[A-Z]{2}$/.test(c || '');
export function cachedGeo() { try { const v = sessionStorage.getItem(KEY); return ok(v) ? v : ''; } catch (e) { return ''; } }
export function rememberGeo(c) { if (ok(c)) { try { sessionStorage.setItem(KEY, c); } catch (e) { /* private mode */ } } return ok(c) ? c : ''; }
export async function detectGeo() {
  const hit = cachedGeo();
  if (hit) return hit;
  const base = window.AJOY_CONFIG && window.AJOY_CONFIG.paypalConfigUrl;
  if (!base) return '';
  try {
    const r = await fetch(base + (base.includes('?') ? '&' : '?') + 'geo=1', { cache: 'no-store', signal: AbortSignal.timeout(3500) });
    if (r.ok) return rememberGeo((await r.json()).country);
  } catch (e) { /* offline or blocked: the guess from the browser language is used */ }
  return '';
}
