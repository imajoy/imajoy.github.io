/* The 2-day free trial: Online plan only, monthly and yearly. It exists only when the PayPal plans include trial plans
   (created by setupPlans in apps-script/Code.gs). The buyer approves with PayPal now and PayPal takes the first payment
   after the trial, so no code or manual step is needed. */
import { tierFor, availability } from './regions.js?v=20261020-ps1';
const url = window.AJOY_CONFIG && window.AJOY_CONFIG.paypalConfigUrl;
export const TRIAL_DAYS = 2;
let pending = null;
export function loadTrialConfig() {
  if (!pending) pending = (async () => {
    if (!url) return null;
    try { const r = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' }); return r.ok ? await r.json() : null; } catch (e) { return null; }
  })();
  return pending;
}
/* Display-only trial availability for this buyer (a boolean in the new config), or '' when there is no trial for this plan, billing period or country */
export function trialPlanId(cfg, plan, billing, country) {
  if (!cfg || !cfg.plans || plan !== 'online') return '';
  if (!availability(country, cfg.closedCountries || []).open) return '';
  const t = cfg.plans.tiers && cfg.plans.tiers[tierFor(country)];
  return (t && t.onlineTrial && t.onlineTrial[billing]) || '';
}
export const addDays = (n, from = new Date()) => { const d = new Date(from.getTime() + n * 864e5); return d; };
export const fmtDay = d => d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
