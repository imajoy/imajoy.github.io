/* Amounts are integer minor units. This module runs on the server only. */
export const CATALOG_VERSION = '2026-10-17-v1';
const currencies = {
  IN: ['INR',1], PK: ['PKR',3.25], US: ['USD',.0116], GB: ['GBP',.0087],
  CA: ['CAD',.0158], AU: ['AUD',.0179], AE: ['AED',.0426],
  DE: ['EUR',.0106], FR: ['EUR',.0106], ES: ['EUR',.0106], IT: ['EUR',.0106], NL: ['EUR',.0106], IE: ['EUR',.0106]
};
const supported = new Set([...Object.keys(currencies),'BD','NP','LK','ID','PH','VN','BR','MX','ZA']);
export const validCountry = c => typeof c === 'string' && /^[A-Z]{2}$/.test(c);
export function priceFor(country, plan = 'online', billing = 'monthly', seats = 1) {
  if (!validCountry(country) || !['online','offline'].includes(plan) || !['monthly','yearly'].includes(billing) || !Number.isInteger(seats) || seats < 1 || seats > 100) throw new Error('Invalid order selection.');
  const low = ['IN','PK','BD','NP','LK'].includes(country);
  const middle = ['ID','PH','VN','BR','MX','ZA'].includes(country);
  const onlineINR = low ? 699 : middle ? 1299 : 1999;
  const multiplier = plan === 'offline' ? 2 : 1;
  const annualMonthly = Math.max(699, Math.round(onlineINR * .8));
  const unitINR = (billing === 'yearly' ? annualMonthly * 12 : onlineINR) * multiplier;
  const [currency,rate] = currencies[country] || ['USD',.0116];
  const unitAmount = Math.round(unitINR * rate * 100);
  return {plan,billing,seats,currency,unitAmount,subtotal:unitAmount*seats,monthlyAmount:Math.round(onlineINR*multiplier*rate*100),catalogVersion:CATALOG_VERSION,country,expiresAt:Date.now()+15*60*1000};
}
