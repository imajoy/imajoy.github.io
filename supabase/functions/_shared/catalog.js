/* Server prices in integer currency minor units. No browser amount is trusted. */
export const CATALOG_VERSION = '2026-10-20-v3';
const currencies = {
  IN: ['INR',1], PK: ['PKR',3.25], US: ['USD',.0116], GB: ['GBP',.0087],
  CA: ['CAD',.0158], AU: ['AUD',.0179], AE: ['AED',.0426],
  DE: ['EUR',.0106], FR: ['EUR',.0106], ES: ['EUR',.0106], IT: ['EUR',.0106], NL: ['EUR',.0106], IE: ['EUR',.0106]
};
export const validCountry = c => typeof c === 'string' && /^[A-Z]{2}$/.test(c);
export function priceFor(country, plan = 'online', billing = 'monthly', seats = 1) {
  if (!validCountry(country) || !['online','offline'].includes(plan) || !['monthly','yearly'].includes(billing) || !Number.isInteger(seats) || seats < 1 || seats > 100) throw new Error('Invalid order selection.');
  const low = ['IN','PK','BD','NP','LK'].includes(country);
  const middle = ['ID','PH','VN','BR','MX','ZA'].includes(country);
  const onlineINR = low ? 899 : middle ? 1299 : 1999;
  const multiplier = plan === 'offline' ? 2 : 1;
  const [currency,rate] = currencies[country] || ['USD',.0116];
  const monthlyAmount=Math.round(onlineINR*multiplier*rate*102);
  const compareAtUnitAmount=billing==='yearly'?monthlyAmount*12:monthlyAmount;
  const unitAmount=billing==='yearly'?Math.round(compareAtUnitAmount*.8):monthlyAmount;
  const subtotal=unitAmount*seats;
  const minimumSubtotal=Math.round(699*multiplier*rate*100)*(billing==='yearly'?12:1)*seats;
  return {plan,billing,seats,currency,unitAmount,subtotal,baseSubtotal:subtotal,monthlyAmount,compareAtUnitAmount,annualSavings:(compareAtUnitAmount-unitAmount)*seats,annualSavingsPercent:billing==='yearly'?20:0,minimumSubtotal,catalogVersion:CATALOG_VERSION,country,expiresAt:Date.now()+15*60*1000};
}
