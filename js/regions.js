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
  high: { online: { monthly: 22.44, yearly: 215.22 }, offline: { monthly: 44.88, yearly: 430.44 } },
  mid:  { online: { monthly: 14.28, yearly: 136.68 }, offline: { monthly: 28.56, yearly: 274.38 } },
  low:  { online: { monthly: 9.18, yearly: 87.72 }, offline: { monthly: 18.36, yearly: 176.46 } }
};
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
  const m = plan === 'offline' ? 2 : 1;
  if (country === 'IN') {
    const monthly = 91698 * m, compare = billing === 'yearly' ? monthly * 12 : monthly;
    const unit = billing === 'yearly' ? Math.round(compare * .8) : monthly;
    return { currency: 'INR', unitAmount: unit, monthlyAmount: monthly, compareAtUnitAmount: compare };
  }
  const t = USD[tierFor(country)][plan], monthly = Math.round(t.monthly * 100), compare = billing === 'yearly' ? monthly * 12 : monthly;
  return { currency: 'USD', unitAmount: Math.round(t[billing] * 100), monthlyAmount: monthly, compareAtUnitAmount: compare };
}
/* Instant Razorpay (INR, paise) price shown while the server confirms the real quote. Must match
   razorpayPrice_ in Razorpay.gs (a test checks this). Checkout always charges the server's confirmed amount. */
const RAZORPAY_MONTHLY_PAISE = { IN: 91698, low: 91698, mid: 142698, high: 203898 };
export function razorpayEstimate(plan, billing, seats, country) {
  const monthly = (country === 'IN' ? RAZORPAY_MONTHLY_PAISE.IN : RAZORPAY_MONTHLY_PAISE[tierFor(country)]) * (plan === 'offline' ? 2 : 1);
  const unit = billing === 'yearly' ? Math.round(monthly * 12 * 0.8) : monthly;
  return { currency: 'INR', unitAmount: unit, monthlyAmount: monthly, compareAtUnitAmount: billing === 'yearly' ? monthly * 12 : monthly, total: unit * seats, recurringTotal: unit * seats, plan, billing, seats, estimate: true };
}
