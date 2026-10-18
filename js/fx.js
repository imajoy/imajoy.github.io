/* Approximate local-currency amounts for display only. Payment is always taken in US dollars by PayPal.
   Rates come from a free public feed (open.er-api.com), cached for 12 hours. If anything fails, nothing is shown. */
const CUR = {
  PK:'PKR',BD:'BDT',NP:'NPR',LK:'LKR',EG:'EGP',NG:'NGN',KE:'KES',GH:'GHS',ET:'ETB',TZ:'TZS',UG:'UGX',ZM:'ZMW',ID:'IDR',PH:'PHP',VN:'VND',BR:'BRL',MX:'MXN',ZA:'ZAR',TR:'TRY',TH:'THB',MY:'MYR',CO:'COP',AR:'ARS',CL:'CLP',PE:'PEN',UA:'UAH',RS:'RSD',KZ:'KZT',GE:'GEL',AM:'AMD',AZ:'AZN',MA:'MAD',TN:'TND',DZ:'DZD',JO:'JOD',LB:'LBP',CR:'CRC',GT:'GTQ',CN:'CNY',MN:'MNT',JM:'JMD',
  US:'USD',CA:'CAD',AU:'AUD',NZ:'NZD',GB:'GBP',JP:'JPY',KR:'KRW',SG:'SGD',HK:'HKD',TW:'TWD',AE:'AED',SA:'SAR',QA:'QAR',KW:'KWD',IL:'ILS',CH:'CHF',IN:'INR'
};
const KEY = 'ajoy.fx';
async function rates() {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (c && Date.now() - c.t < 12 * 3600e3) return c.r;
  } catch (e) { /* ignore */ }
  try {
    const r = await fetch('https://open.er-api.com/v6/latest/USD', { signal: AbortSignal.timeout(4000) });
    const j = await r.json();
    if (j && j.rates) { try { localStorage.setItem(KEY, JSON.stringify({ t: Date.now(), r: j.rates })); } catch (e) { /* ignore */ } return j.rates; }
  } catch (e) { /* offline */ }
  return null;
}
/* usd in whole dollars -> "≈ LKR 2,700" or '' (US dollar countries and unknown countries show nothing) */
export async function localApprox(usd, country) {
  const cur = CUR[country];
  if (!cur || cur === 'USD' || !(usd > 0)) return '';
  const r = await rates();
  if (!r || !r[cur]) return '';
  const v = usd * r[cur];
  const step = v >= 100000 ? 1000 : v >= 10000 ? 100 : v >= 1000 ? 10 : v >= 100 ? 1 : 0.5;
  try { return '≈ ' + new Intl.NumberFormat(undefined, { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(Math.round(v / step) * step); }
  catch (e) { return '≈ ' + cur + ' ' + Math.round(v).toLocaleString(); }
}
