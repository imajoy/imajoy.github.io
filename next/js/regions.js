/* Regional pricing and availability.
   Prices are final USD prices per computer (the amount PayPal charges). Three tiers follow what buyers in a
   region can reasonably pay and how large the Maya community is there. India is shown in rupees and opens later.
   Countries where tax is due from the first sale (EU, UK, EEA) stay closed until local tax registration is done. */
const LOW = 'PK BD NP LK EG NG KE GH ET TZ UG ZM ZW SN CM MM KH LA AF'.split(' ');
const MID = 'ID PH VN BR MX ZA TR TH MY CO AR CL PE UA RS KZ GE AM AZ MA TN DZ JO LB EC DO CR PA GT CN UZ MN JM'.split(' ');
const CLOSED_TAX = 'AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE GB NO IS LI'.split(' ');
const CLOSED_OTHER = 'RU BY IR KP SY CU'.split(' ');
/* USD whole-dollar prices. Yearly = 12 months less 20 percent, rounded. */
export const USD = {
  high: { online: { monthly: 22, yearly: 211 }, offline: { monthly: 44, yearly: 422 } },
  mid:  { online: { monthly: 14, yearly: 134 }, offline: { monthly: 28, yearly: 269 } },
  low:  { online: { monthly: 9,  yearly: 86  }, offline: { monthly: 18, yearly: 173 } }
};
export const tierFor = c => LOW.includes(c) ? 'low' : MID.includes(c) ? 'mid' : 'high';
/* open:true means the PayPal button is offered. reason explains a closed region. */
export function availability(c) {
  if (c === 'IN') return { open: false, reason: 'india' };
  if (CLOSED_TAX.includes(c)) return { open: false, reason: 'tax' };
  if (CLOSED_OTHER.includes(c)) return { open: false, reason: 'blocked' };
  return { open: true, reason: '' };
}
export const closedMessage = {
  india: 'Payments for India open soon. Please contact Ajoy to subscribe in the meantime.',
  tax: 'Sales to your region open soon, once local tax registration is complete. Please contact Ajoy to be notified.',
  blocked: 'Subscriptions are not available in your country.'
};
/* Display price in minor units (cents or paise) so money() can format it. */
export function regionalPrice(plan, billing, seats, country) {
  const m = plan === 'offline' ? 2 : 1;
  if (country === 'IN') {
    const monthly = 899 * m * 100, compare = billing === 'yearly' ? monthly * 12 : monthly;
    const unit = billing === 'yearly' ? Math.round(compare * .8 / 100) * 100 : monthly;
    return { currency: 'INR', unitAmount: unit, monthlyAmount: monthly, compareAtUnitAmount: compare };
  }
  const t = USD[tierFor(country)][plan], monthly = t.monthly * 100, compare = billing === 'yearly' ? monthly * 12 : monthly;
  return { currency: 'USD', unitAmount: t[billing] * 100, monthlyAmount: monthly, compareAtUnitAmount: compare };
}
