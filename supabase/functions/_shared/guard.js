/* Shared safety layer for every public Edge Function.
   - Adds the security headers to every response (including errors).
   - Rate limits by client address.
   - Turns any crash or 5xx into a generic message plus a correlation ID; the details go to the server log only.
   - Checks the required settings and refuses to serve when one is missing or too weak. */

export const SECURITY_HEADERS = Object.freeze({
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  'Referrer-Policy': 'no-referrer',
  'Cross-Origin-Resource-Policy': 'same-site',
});

export function correlationId() {
  return crypto.randomUUID().replaceAll('-', '').slice(0, 16);
}

/* rules: [{name, min?: number, pattern?: RegExp}] -> list of problems (names only, never values). */
export function configProblems(env, rules) {
  const problems = [];
  for (const rule of rules) {
    const value = env(rule.name);
    if (!value) problems.push(rule.name + ' is missing');
    else if (rule.min && value.length < rule.min) problems.push(rule.name + ' is shorter than ' + rule.min + ' characters');
    else if (rule.pattern && !rule.pattern.test(value)) problems.push(rule.name + ' has the wrong format');
  }
  return problems;
}

/* Throws at start-up so the function never serves with a missing critical setting. */
export function assertConfig(functionName, env, rules) {
  const problems = configProblems(env, rules);
  if (problems.length) throw new Error('[config] ' + functionName + ' cannot start: ' + problems.join('; '));
}

/* Sliding-window limiter kept in memory. Each Edge Function instance has its own counters, so this is a
   brake against floods and guessing, not an exact global quota. Durable per-account limits live in Apps Script. */
export function createLimiter(now = Date.now) {
  const hits = new Map();
  let lastSweep = now();
  return function allow(key, limit, windowMs) {
    const t = now();
    if (t - lastSweep > 60000) {
      for (const [k, list] of hits) if (!list.length || t - list[list.length - 1] > 3600000) hits.delete(k);
      lastSweep = t;
    }
    const list = (hits.get(key) || []).filter((stamp) => t - stamp < windowMs);
    if (list.length >= limit) { hits.set(key, list); return { ok: false, retryAfter: Math.max(1, Math.ceil((windowMs - (t - list[0])) / 1000)) }; }
    list.push(t);
    hits.set(key, list);
    return { ok: true, retryAfter: 0 };
  };
}

/* Address used only to group requests for limiting, never stored or logged. */
export function clientKey(req) {
  const h = req.headers;
  const direct = (h.get('cf-connecting-ip') || h.get('x-real-ip') || '').trim();
  if (direct) return direct.slice(0, 64);
  const forwarded = (h.get('x-forwarded-for') || '').split(',')[0].trim();
  return (forwarded || 'shared').slice(0, 64);
}

function withHeaders(response, extra) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) headers.set(name, value);
  for (const [name, value] of Object.entries(extra || {})) headers.set(name, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

/* options:
   name        function name for the log
   limits      [{match: (path, method) => boolean, limit, windowMs}] first match wins
   log         server-side logger (default console.error)
   limiter     injectable for tests
   origins     () => allowed origin list, so 429 and 500 replies stay readable by the site */
export function guard(handler, options = {}) {
  const { name = 'function', limits = [], log = (line) => console.error(line), limiter = createLimiter(), origins = () => [] } = options;
  const corsFor = (req) => {
    const origin = req.headers.get('origin') || '';
    return origin && origins().includes(origin) ? { 'Access-Control-Allow-Origin': origin, 'Vary': 'Origin' } : {};
  };
  return async function guarded(req, ...rest) {
    const id = correlationId();
    const path = new URL(req.url).pathname.split('/').filter(Boolean).pop() || '';
    try {
      if (req.method !== 'OPTIONS') {
        const rule = limits.find((item) => item.match(path, req.method));
        if (rule) {
          const verdict = limiter(name + ':' + path + ':' + clientKey(req), rule.limit, rule.windowMs);
          if (!verdict.ok) {
            log(JSON.stringify({ fn: name, id, path, status: 429 }));
            return withHeaders(new Response(JSON.stringify({ ok: false, error: 'rate_limited', message: 'Too many requests. Please wait a moment and try again.', correlationId: id }), { status: 429, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Retry-After': String(verdict.retryAfter) } }), { 'X-Correlation-Id': id, ...corsFor(req) });
          }
        }
      }
      const response = await handler(req, ...rest);
      if (response.status < 500) {
        const type = response.headers.get('content-type') || '';
        if (response.status >= 400 && type.includes('application/json')) return withHeaders(await addId(response, id), { 'X-Correlation-Id': id });
        return withHeaders(response, { 'X-Correlation-Id': id });
      }
      log(JSON.stringify({ fn: name, id, path, status: response.status }));
      return withHeaders(await addId(response, id), { 'X-Correlation-Id': id });
    } catch (error) {
      /* Only the error class and the ID are logged: messages can carry customer data. */
      log(JSON.stringify({ fn: name, id, path, status: 500, kind: error && error.name ? String(error.name) : 'Error' }));
      return withHeaders(new Response(JSON.stringify({ ok: false, error: 'unavailable', message: 'Something went wrong on our side. Please try again.', correlationId: id }), { status: 500, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }), { 'X-Correlation-Id': id, ...corsFor(req) });
    }
  };
}

/* Adds correlationId to a JSON error body without changing its other fields. */
async function addId(response, id) {
  const type = response.headers.get('content-type') || '';
  if (!type.includes('application/json')) return response;
  let body;
  try { body = JSON.parse(await response.clone().text()); } catch { return response; }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return response;
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  return new Response(JSON.stringify({ ...body, correlationId: id }), { status: response.status, statusText: response.statusText, headers });
}
