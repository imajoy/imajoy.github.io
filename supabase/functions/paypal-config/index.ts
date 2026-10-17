/* Serves the PayPal public settings to the website from private Supabase secrets.
   Secrets (set in the Supabase dashboard): PAYPAL_CLIENT_ID, PAYPAL_PLANS (JSON), PAYPAL_MODE ("sandbox" or "live").
   The PayPal Secret is NOT needed here and must never be added. */
const ORIGINS = ['https://imajoy.github.io', 'http://localhost:8765'];
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
  const clientId = Deno.env.get('PAYPAL_CLIENT_ID') || '';
  let plans: unknown = null;
  try { plans = JSON.parse(Deno.env.get('PAYPAL_PLANS') || 'null'); } catch { plans = null; }
  if (!clientId || !plans) return new Response('{"error":"not configured"}', { status: 503, headers });
  const mode = Deno.env.get('PAYPAL_MODE') === 'live' ? 'live' : 'sandbox';
  return new Response(JSON.stringify({ mode, clientId, currency: 'USD', plans }), { headers });
});
