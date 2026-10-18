/* Serves the PayPal public settings to the website from private Supabase secrets.
   Secrets (set in the Supabase dashboard): PAYPAL_CLIENT_ID, PAYPAL_PLANS (JSON), PAYPAL_MODE ("sandbox" or "live").
   Optional secret: PAYPAL_CLOSED_COUNTRIES = comma list such as "LK,EG" to switch PayPal off for countries where it fails.
   The PayPal Secret is NOT needed here and must never be added.
   Also reports the visitor's country (from the network edge) so the site can apply the right regional price.
   GET ?geo=1 returns only the country and needs no secrets. */
const ORIGINS = ['https://imajoy.github.io', 'http://localhost:8765'];
function countryOf(req: Request): string {
  const raw = req.headers.get('cf-ipcountry') || req.headers.get('x-vercel-ip-country') || req.headers.get('x-country-code') || '';
  const c = raw.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(c) && c !== 'XX' && c !== 'T1' ? c : '';
}
Deno.serve((req: Request) => {
  const origin = req.headers.get('origin') || '';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
  };
  if (ORIGINS.includes(origin)) headers['Access-Control-Allow-Origin'] = origin;
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'GET') return new Response('{"error":"method"}', { status: 405, headers });
  const country = countryOf(req);
  if (new URL(req.url).searchParams.get('geo')) return new Response(JSON.stringify({ country }), { headers });
  const clientId = Deno.env.get('PAYPAL_CLIENT_ID') || '';
  let plans: unknown = null;
  try { plans = JSON.parse(Deno.env.get('PAYPAL_PLANS') || 'null'); } catch { plans = null; }
  if (!clientId || !plans) return new Response('{"error":"not configured"}', { status: 503, headers });
  const mode = Deno.env.get('PAYPAL_MODE') === 'live' ? 'live' : 'sandbox';
  const closedCountries = (Deno.env.get('PAYPAL_CLOSED_COUNTRIES') || '').toUpperCase().split(/[^A-Z]+/).filter((c) => c.length === 2);
  return new Response(JSON.stringify({ mode, clientId, currency: 'USD', plans, country, closedCountries }), { headers });
});
