/* Serves the PayPal public settings to the website from private Supabase secrets.
   Secrets (set in the Supabase dashboard): PAYPAL_CLIENT_ID, PAYPAL_PLANS (JSON), PAYPAL_MODE ("sandbox" or "live").
   Optional secret: PAYPAL_CLOSED_COUNTRIES = comma list such as "LK,EG" to switch PayPal off for countries where it fails.
   The PayPal Secret is NOT needed here and must never be added.
   Also reports the visitor's country (IP lookup, see below) so the site can apply the right regional price.
   GET ?geo=1 returns only the country and needs no secrets. */
const ORIGINS = ['https://imajoy.github.io', 'http://localhost:8765'];
/* When an ingress IP header has been explicitly verified and configured, that IP is looked up with free
   no-key services (api.country.is, then geojs.io). Only the IP is sent; results are cached for an hour. */
import { createCountryLookup } from '../_shared/country.js';
const countryOf = createCountryLookup(fetch, Date.now, key => Deno.env.get(key));
Deno.serve(async (req: Request) => {
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
  const country = await countryOf(req);
  if (new URL(req.url).searchParams.get('geo')) return new Response(JSON.stringify({ country }), { headers });
  const clientId = Deno.env.get('PAYPAL_CLIENT_ID') || '';
  let plans: unknown = null;
  try { plans = JSON.parse(Deno.env.get('PAYPAL_PLANS') || 'null'); } catch { plans = null; }
  if (!clientId || !plans) return new Response('{"error":"not configured"}', { status: 503, headers });
  const mode = Deno.env.get('PAYPAL_MODE') === 'live' ? 'live' : 'sandbox';
  const closedCountries = (Deno.env.get('PAYPAL_CLOSED_COUNTRIES') || '').toUpperCase().split(/[^A-Z]+/).filter((c) => c.length === 2);
  // The browser only needs availability. Subscription IDs are selected privately by Apps Script.
  const flags = (value: unknown): unknown => {
    if (value && typeof value === 'object' && !Array.isArray(value)) return Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'productId').map(([key, item]) => [key, flags(item)]));
    return Boolean(value);
  };
  return new Response(JSON.stringify({ mode, clientId, currency: 'USD', plans: flags(plans), country, closedCountries, billingPolicyEnabled:true, vpnProtectionEnabled:Deno.env.get('BILLING_VPN_ENABLED')==='true' }), { headers });
});
