/* Shared account state. Cached details speed up display; only the server authenticates a token. */
const KEY = 'ajoy.acct';
const EVENT = 'ajoy-account-change';
const cfg = window.AJOY_CONFIG || {};
let pending = null;
const emailOf = value => typeof value === 'string' ? value.trim().toLowerCase() : '';
function clean(value) {
  if (!value || typeof value.token !== 'string' || value.token.length < 16 || value.token.length > 4096) return null;
  const email = emailOf(value.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return null;
  const expiresAt = Number(value.expiresAt) || 0;
  if (expiresAt && expiresAt <= Date.now()) return null;
  const subscriptions = Array.isArray(value.subscriptions) ? value.subscriptions.filter(s => s && ['online','offline'].includes(s.plan) && ['monthly','yearly'].includes(s.billing)).slice(0,5).map(s => ({
    plan:s.plan,billing:s.billing,seats:Number.isInteger(s.seats)&&s.seats>0&&s.seats<=100?s.seats:1,
    status:['ACTIVE','APPROVED','CANCELLED','SUSPENDED','EXPIRED'].includes(s.status)?s.status:'UNKNOWN',
    endsAt:typeof s.endsAt==='string'&&Number.isFinite(Date.parse(s.endsAt))?s.endsAt:'',trial:!!s.trial,renews:!!s.renews
  })) : null;
  return { token: value.token, email, expiresAt, limited: !!value.limited, subscriptions };
}
function load() {
  try { return clean(JSON.parse(localStorage.getItem(KEY) || 'null')); } catch { return null; }
}
let current = cfg.accountOpen ? load() : null;
export const getAccountSession = () => current;
export function setAccountSession(value) {
  current = clean(value);
  try { current ? localStorage.setItem(KEY, JSON.stringify(current)) : localStorage.removeItem(KEY); } catch { /* private mode */ }
  window.dispatchEvent(new Event(EVENT));
  return current;
}
export const clearAccountSession = () => setAccountSession(null);
export function onAccountChange(callback) {
  window.addEventListener(EVENT, callback);
  return () => window.removeEventListener(EVENT, callback);
}
window.addEventListener('storage', event => {
  if (event.key !== KEY && event.key !== null) return;
  current = cfg.accountOpen ? load() : null;
  window.dispatchEvent(new Event(EVENT));
});
export async function accountRequest(body) {
  if (!cfg.accountOpen || !cfg.sheetUrl) throw new Error('Subscriber sign-in is unavailable.');
  const response = await fetch(cfg.sheetUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ type: 'account', ...body }), signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error('Could not reach the account service. Please try again.');
  try { return await response.json(); } catch { throw new Error('The account service could not respond. Please try again.'); }
}
export async function verifyAccountSession() {
  const saved = current;
  if (!saved) return null;
  if (pending?.token === saved.token) return pending.promise;
  const promise = (async () => {
    let result = await accountRequest({ step: 'identity', token: saved.token });
    // Existing deployments still support status while the new script is being deployed.
    if (!result.ok && result.error === 'step') result = await accountRequest({ step: 'status', token: saved.token });
    if (current?.token !== saved.token) return null;
    if (!result.ok) {
      if (result.error === 'expired' || result.error === 'not_registered') clearAccountSession();
      throw new Error(result.error === 'expired' ? 'Your session expired. Sign in again.' : 'Your account could not be verified. Please try again.');
    }
    if (!emailOf(result.email)) throw new Error('Your account could not be verified.');
    return setAccountSession({ ...saved, ...result });
  })();
  pending = { token: saved.token, promise };
  try { return await promise; } finally { if (pending?.promise === promise) pending = null; }
}
export function bindAccountEmail(input, hint) {
  if (!input || !cfg.accountOpen) return;
  const originalHint = hint?.textContent || '', originalReadOnly = input.readOnly;
  let filled = '';
  function sync() {
    if (current) {
      filled = current.email;input.value = filled;input.readOnly = true;
      input.dataset.accountEmail = 'true';
      if (hint) hint.textContent = 'Using your signed-in email. Sign out to use a different email.';
    } else {
      if (filled && input.value === filled) input.value = '';
      filled = '';input.readOnly = originalReadOnly;delete input.dataset.accountEmail;
      if (hint) hint.textContent = originalHint;
    }
  }
  onAccountChange(sync);
  input.addEventListener('input', () => { if (current) input.value = current.email; });
  sync();
  if (current) verifyAccountSession().catch(() => { /* keep cached identity on a network error; server checks it before checkout */ });
}

export function openAccount(detail={}) { window.dispatchEvent(new CustomEvent('ajoy-account-open',{detail})); }
