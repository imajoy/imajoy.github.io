/* Regional pricing and availability.
   Prices are final USD prices per computer (the amount PayPal charges). Three tiers follow what buyers in a
   region can reasonably pay and how large the Maya community is there. India is shown in rupees and paid through Razorpay.
   Countries where tax is due from the first sale (EU, UK, EEA) stay closed until local tax registration is done. */
const LOW = 'PK BD NP LK EG NG KE GH ET TZ UG ZM ZW SN CM MM KH LA AF'.split(' ');
const MID = 'ID PH VN BR MX ZA TR TH MY CO AR CL PE UA RS KZ GE AM AZ MA TN DZ JO LB EC DO CR PA GT CN UZ MN JM'.split(' ');
const CLOSED_TAX = 'AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE GB NO IS LI'.split(' ');
const CLOSED_OTHER = 'RU BY IR KP SY CU'.split(' ');
/* Countries where PayPal buyers or subscriptions are unsupported or unproven. They see a closed message instead of a
   button. Open one by deleting its code once a real buyer from there has paid. The paypal-config function can also
   close extra countries without a code change (secret PAYPAL_CLOSED_COUNTRIES). */
const NO_PAYPAL = 'AF BD NP PK MM ET ZW BI CF TD KM CG CD DJ ER GQ GW IQ LY SO SS SD YE LS LR ML MR NE SL ST BT GN HT TJ TM UZ VE TL KI NR TV PW MH FM SB VU WS TO PG SR'.split(' ');
/* USD prices per computer. Annual plans retain their catalog rounding. */
export const USD = {
  high: { online: { monthly: 29.99, yearly: 287.90 }, offline: { monthly: 49.92, yearly: 479.20, full: 599.00 } },
  mid:  { online: { monthly: 16.59, yearly: 159.20 }, offline: { monthly: 39.09, yearly: 375.20, full: 469.00 } },
  low:  { online: { monthly: 7.99, yearly: 76.70 }, offline: { monthly: 19.09, yearly: 183.20, full: 229.00 } }
};
/* India (Razorpay), in paise. list = the twelve-month list price; yearly billing is 20% off it. */
export const INDIA = { online: { monthly: 89900, list: 1078800 }, offline: { monthly: 189991, list: 2279900 } };
/* Premium yearly is 20% off only for an account's first Premium yearly subscription. The server decides
   (premiumYearlyUsed on the signed-in account); this just mirrors it so the prices shown match what is charged. */
export function premiumYearlyUsed() {
  try { return !!JSON.parse(localStorage.getItem('ajoy.acct') || 'null')?.premiumYearlyUsed; } catch { return false; }
}
const premiumFull = (plan, billing) => plan === 'offline' && billing === 'yearly' && premiumYearlyUsed();
export function usdUnit(tier, plan, billing) { const t = USD[tier][plan]; return premiumFull(plan, billing) ? t.full : t[billing]; }
export const tierFor = c => LOW.includes(c) ? 'low' : MID.includes(c) ? 'mid' : 'high';
/* open:true means the PayPal button is offered. reason explains a closed region. */
export function availability(c, extraClosed = []) {
  if (c === 'IN') return { open: false, reason: 'india' };
  if (CLOSED_TAX.includes(c)) return { open: false, reason: 'tax' };
  if (CLOSED_OTHER.includes(c)) return { open: false, reason: 'blocked' };
  if (NO_PAYPAL.includes(c) || extraClosed.includes(c)) return { open: false, reason: 'paypal' };
  return { open: true, reason: '' };
}
/* The buyer's billing country must match where they are connecting from. Choosing a dearer tier than your own is
   fine (you only pay more), but a cheaper tier, or any country while connecting from a closed one, is not.
   detected is '' when the location is unknown; the order is then checked by hand after payment. */
const RANK = { low: 0, mid: 1, high: 2 };
export function countryCheck(chosen, detected) {
  if (!detected || detected === chosen) return { ok: true };
  const home = availability(detected);
  if (home.open && RANK[tierFor(chosen)] >= RANK[tierFor(detected)]) return { ok: true };
  return { ok: false, detected };
}
export const closedMessage = {
  india: 'In India, subscribe with Razorpay. The PayPal free trial is not offered in India.',
  tax: 'Sales to your region open soon, once local tax registration is complete. Please contact Ajoy to be notified.',
  blocked: 'Subscriptions are not available in your country.',
  paypal: 'PayPal is not available for your country yet. Please contact Ajoy to subscribe in another way.'
};
/* Display price in minor units (cents or paise) so money() can format it. */
export function regionalPrice(plan, billing, seats, country) {
  if (country === 'IN') {
    const monthly = INDIA[plan].monthly, compare = billing === 'yearly' ? INDIA[plan].list : monthly;
    const unit = billing === 'yearly' ? (premiumFull(plan, billing) ? compare : Math.round(compare * .8)) : monthly;
    return { currency: 'INR', unitAmount: unit, monthlyAmount: monthly, compareAtUnitAmount: compare };
  }
  const t = USD[tierFor(country)][plan], monthly = Math.round(t.monthly * 100), unitAmount = Math.round(usdUnit(tierFor(country), plan, billing) * 100);
  const compare = premiumFull(plan, billing) ? unitAmount : billing === 'yearly' ? Math.round((t.full ?? t.monthly * 12) * 100) : monthly;
  return { currency: 'USD', unitAmount, monthlyAmount: monthly, compareAtUnitAmount: compare };
}
/* Instant Razorpay (INR, paise) price shown while the server confirms the real quote. Must match
   razorpayPrice_ in Razorpay.gs (a test checks this). Checkout always charges the server's confirmed amount. */
const RAZORPAY_MONTHLY_PAISE = { IN: 89900, low: 91698, mid: 142698, high: 203898 };
export function razorpayEstimate(plan, billing, seats, country, currency = 'INR') {
  if (currency === 'USD') {
    const t = USD[tierFor(country)][plan], m = Math.round(t.monthly * 100), unit = billing === 'yearly' ? Math.round(usdUnit(tierFor(country), plan, billing) * 100) : m;
    return { currency: 'USD', unitAmount: unit, monthlyAmount: m, compareAtUnitAmount: premiumFull(plan, billing) ? unit : billing === 'yearly' ? Math.round((t.full ?? t.monthly * 12) * 100) : m, total: unit * seats, recurringTotal: unit * seats, plan, billing, seats, estimate: true };
  }
  const india = country === 'IN';
  const monthly = india ? INDIA[plan].monthly : RAZORPAY_MONTHLY_PAISE[tierFor(country)] * (plan === 'offline' ? 2 : 1);
  const list = india ? INDIA[plan].list : monthly * 12;
  const unit = billing === 'yearly' ? (premiumFull(plan, billing) ? list : Math.round(list * 0.8)) : monthly;
  return { currency: 'INR', unitAmount: unit, monthlyAmount: monthly, compareAtUnitAmount: billing === 'yearly' ? list : monthly, total: unit * seats, recurringTotal: unit * seats, plan, billing, seats, estimate: true };
}
