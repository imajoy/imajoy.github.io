/* Approximate local-currency amounts for display only. Payment is always taken in US dollars by PayPal.
   Rates come from a free public feed (open.er-api.com), cached for 12 hours. If anything fails, nothing is shown. */
const CUR = {
  AD:'EUR',AE:'AED',AF:'AFN',AG:'XCD',AL:'ALL',AM:'AMD',AO:'AOA',AR:'ARS',AT:'EUR',AU:'AUD',AZ:'AZN',BA:'BAM',BB:'BBD',BD:'BDT',BE:'EUR',BF:'XOF',BG:'BGN',BH:'BHD',BI:'BIF',BJ:'XOF',BN:'BND',BO:'BOB',BR:'BRL',BS:'BSD',BT:'BTN',BW:'BWP',BY:'BYN',BZ:'BZD',
  CA:'CAD',CD:'CDF',CF:'XAF',CG:'XAF',CH:'CHF',CI:'XOF',CL:'CLP',CM:'XAF',CN:'CNY',CO:'COP',CR:'CRC',CU:'CUP',CV:'CVE',CY:'EUR',CZ:'CZK',DE:'EUR',DJ:'DJF',DK:'DKK',DM:'XCD',DO:'DOP',DZ:'DZD',
  EC:'USD',EE:'EUR',EG:'EGP',ER:'ERN',ES:'EUR',ET:'ETB',FI:'EUR',FJ:'FJD',FR:'EUR',GA:'XAF',GB:'GBP',GD:'XCD',GE:'GEL',GH:'GHS',GM:'GMD',GN:'GNF',GQ:'XAF',GR:'EUR',GT:'GTQ',GW:'XOF',GY:'GYD',
  HK:'HKD',HN:'HNL',HR:'EUR',HT:'HTG',HU:'HUF',ID:'IDR',IE:'EUR',IL:'ILS',IN:'INR',IQ:'IQD',IR:'IRR',IS:'ISK',IT:'EUR',JM:'JMD',JO:'JOD',JP:'JPY',KE:'KES',KG:'KGS',KH:'KHR',KM:'KMF',KN:'XCD',KR:'KRW',KW:'KWD',KZ:'KZT',
  LA:'LAK',LB:'LBP',LC:'XCD',LI:'CHF',LK:'LKR',LR:'LRD',LS:'LSL',LT:'EUR',LU:'EUR',LV:'EUR',LY:'LYD',MA:'MAD',MC:'EUR',MD:'MDL',ME:'EUR',MG:'MGA',MK:'MKD',ML:'XOF',MM:'MMK',MN:'MNT',MO:'MOP',MR:'MRU',MT:'EUR',MU:'MUR',MV:'MVR',MW:'MWK',MX:'MXN',MY:'MYR',MZ:'MZN',
  NA:'NAD',NE:'XOF',NG:'NGN',NI:'NIO',NL:'EUR',NO:'NOK',NP:'NPR',NZ:'NZD',OM:'OMR',PA:'USD',PE:'PEN',PG:'PGK',PH:'PHP',PK:'PKR',PL:'PLN',PT:'EUR',PY:'PYG',QA:'QAR',RO:'RON',RS:'RSD',RU:'RUB',RW:'RWF',
  SA:'SAR',SB:'SBD',SC:'SCR',SD:'SDG',SE:'SEK',SG:'SGD',SI:'EUR',SK:'EUR',SL:'SLE',SM:'EUR',SN:'XOF',SO:'SOS',SR:'SRD',SS:'SSP',ST:'STN',SV:'USD',SY:'SYP',SZ:'SZL',TD:'XAF',TG:'XOF',TH:'THB',TJ:'TJS',TL:'USD',TM:'TMT',TN:'TND',TO:'TOP',TR:'TRY',TT:'TTD',TW:'TWD',TZ:'TZS',
  UA:'UAH',UG:'UGX',US:'USD',UY:'UYU',UZ:'UZS',VC:'XCD',VE:'VES',VN:'VND',VU:'VUV',WS:'WST',YE:'YER',ZA:'ZAR',ZM:'ZMW',ZW:'USD',PR:'USD'
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
  const step = v >= 100000 ? 1000 : v >= 10000 ? 100 : v >= 1000 ? 10 : v >= 10 ? 1 : 0.5;
  try { return '≈ ' + new Intl.NumberFormat(undefined, { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(Math.round(v / step) * step); }
  catch (e) { return '≈ ' + cur + ' ' + Math.round(v).toLocaleString(); }
}

/* Returns a function (usd cents) -> "LKR 2,700" for the visitor's country, or null when there is no local currency or no rate. */
export async function localFormatter(country) {
  const cur = CUR[country];
  if (!cur || cur === 'USD') return null;
  const r = await rates();
  if (!r || !r[cur]) return null;
  return cents => {
    const v = cents / 100 * r[cur];
    const step = v >= 100000 ? 1000 : v >= 10000 ? 100 : v >= 1000 ? 10 : v >= 10 ? 1 : 0.5;
    const n = Math.round(v / step) * step;
    try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: cur, maximumFractionDigits: n % 1 ? 1 : 0 }).format(n); }
    catch (e) { return cur + ' ' + Math.round(n).toLocaleString(); }
  };
}
