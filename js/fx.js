/* Display-only currency conversions. PayPal charges USD; Razorpay charges INR.
   Positive USD-based rates are shared and cached for 12 hours. No guessed exchange rates. */
const CUR = {
  AD:'EUR',AE:'AED',AF:'AFN',AG:'XCD',AL:'ALL',AM:'AMD',AO:'AOA',AR:'ARS',AT:'EUR',AU:'AUD',AZ:'AZN',BA:'BAM',BB:'BBD',BD:'BDT',BE:'EUR',BF:'XOF',BG:'EUR',BH:'BHD',BI:'BIF',BJ:'XOF',BN:'BND',BO:'BOB',BR:'BRL',BS:'BSD',BT:'BTN',BW:'BWP',BY:'BYN',BZ:'BZD',
  CA:'CAD',CD:'CDF',CF:'XAF',CG:'XAF',CH:'CHF',CI:'XOF',CL:'CLP',CM:'XAF',CN:'CNY',CO:'COP',CR:'CRC',CU:'CUP',CV:'CVE',CY:'EUR',CZ:'CZK',DE:'EUR',DJ:'DJF',DK:'DKK',DM:'XCD',DO:'DOP',DZ:'DZD',
  EC:'USD',EE:'EUR',EG:'EGP',ER:'ERN',ES:'EUR',ET:'ETB',FI:'EUR',FJ:'FJD',FR:'EUR',GA:'XAF',GB:'GBP',GD:'XCD',GE:'GEL',GH:'GHS',GM:'GMD',GN:'GNF',GQ:'XAF',GR:'EUR',GT:'GTQ',GW:'XOF',GY:'GYD',
  HK:'HKD',HN:'HNL',HR:'EUR',HT:'HTG',HU:'HUF',ID:'IDR',IE:'EUR',IL:'ILS',IN:'INR',IQ:'IQD',IR:'IRR',IS:'ISK',IT:'EUR',JM:'JMD',JO:'JOD',JP:'JPY',KE:'KES',KG:'KGS',KH:'KHR',KM:'KMF',KN:'XCD',KR:'KRW',KW:'KWD',KZ:'KZT',
  LA:'LAK',LB:'LBP',LC:'XCD',LI:'CHF',LK:'LKR',LR:'LRD',LS:'LSL',LT:'EUR',LU:'EUR',LV:'EUR',LY:'LYD',MA:'MAD',MC:'EUR',MD:'MDL',ME:'EUR',MG:'MGA',MK:'MKD',ML:'XOF',MM:'MMK',MN:'MNT',MO:'MOP',MR:'MRU',MT:'EUR',MU:'MUR',MV:'MVR',MW:'MWK',MX:'MXN',MY:'MYR',MZ:'MZN',
  NA:'NAD',NE:'XOF',NG:'NGN',NI:'NIO',NL:'EUR',NO:'NOK',NP:'NPR',NZ:'NZD',OM:'OMR',PA:'USD',PE:'PEN',PG:'PGK',PH:'PHP',PK:'PKR',PL:'PLN',PT:'EUR',PY:'PYG',QA:'QAR',RO:'RON',RS:'RSD',RU:'RUB',RW:'RWF',
  SA:'SAR',SB:'SBD',SC:'SCR',SD:'SDG',SE:'SEK',SG:'SGD',SI:'EUR',SK:'EUR',SL:'SLE',SM:'EUR',SN:'XOF',SO:'SOS',SR:'SRD',SS:'SSP',ST:'STN',SV:'USD',SY:'SYP',SZ:'SZL',TD:'XAF',TG:'XOF',TH:'THB',TJ:'TJS',TL:'USD',TM:'TMT',TN:'TND',TO:'TOP',TR:'TRY',TT:'TTD',TW:'TWD',TZ:'TZS',
  UA:'UAH',UG:'UGX',US:'USD',UY:'UYU',UZ:'UZS',VC:'XCD',VE:'VES',VN:'VND',VU:'VUV',WS:'WST',YE:'YER',ZA:'ZAR',ZM:'ZMW',ZW:'USD',PR:'USD'
};
Object.assign(CUR,{AS:'USD',AX:'EUR',BL:'EUR',BQ:'USD',CK:'NZD',CW:'XCG',FK:'FKP',FM:'USD',FO:'DKK',GF:'EUR',GG:'GBP',GI:'GIP',GL:'DKK',GP:'EUR',GS:'GBP',GU:'USD',IM:'GBP',IO:'USD',JE:'GBP',KI:'AUD',KP:'KPW',MF:'EUR',MH:'USD',MP:'USD',MQ:'EUR',MS:'XCD',NC:'XPF',NF:'AUD',NR:'AUD',NU:'NZD',PF:'XPF',PM:'EUR',PN:'NZD',PS:'ILS',PW:'USD',RE:'EUR',SH:'SHP',SJ:'NOK',SX:'XCG',TC:'USD',TF:'EUR',TK:'NZD',TV:'AUD',UM:'USD',VA:'EUR',VG:'USD',VI:'USD',WF:'XPF',XK:'EUR',YT:'EUR'});
export const currencyForCountry=country=>CUR[country]||'';
const KEY='ajoy.fx',lifetime=12*3600e3;
let pending;
function validRates(value){return value&&typeof value==='object'&&value.USD===1&&Object.values(value).every(n=>typeof n==='number'&&Number.isFinite(n)&&n>0);}
export async function exchangeRates(){
 if(pending)return pending;
 pending=(async()=>{
  try{const c=JSON.parse(localStorage.getItem(KEY)||'null');if(c&&Number.isFinite(c.t)&&c.t<=Date.now()&&Date.now()-c.t<lifetime&&validRates(c.r))return c.r;}catch{}
  try{
   const response=await fetch('https://open.er-api.com/v6/latest/USD',{signal:AbortSignal.timeout(4000)});
   if(!response.ok)return null;const data=await response.json();if(!validRates(data?.rates))return null;
   try{localStorage.setItem(KEY,JSON.stringify({t:Date.now(),r:data.rates}));}catch{}
   return data.rates;
  }catch{return null;}
 })();
 return pending;
}
export function formatCurrency(amount,currency){
 return new Intl.NumberFormat(globalThis.navigator?.language||'en',{style:'currency',currency}).format(amount);
}
export function convertMinor(amount,source,target,rates){
 if(!Number.isFinite(amount))return null;
 if(source===target||amount===0)return amount;
 if(!rates||!(rates[source]>0)||!(rates[target]>0))return null;
 const result=amount/rates[source]*rates[target];return Number.isFinite(result)?result:null;
}
/* Compatibility helpers used by discovery pricing; conversion is display-only. */
export async function localApprox(usd,country){const formatter=await localFormatter(country);return formatter&&usd>0?'≈ '+formatter(usd*100):'';}
export async function localFormatter(country){
 const currency=currencyForCountry(country);if(!currency||currency==='USD')return null;
 const rates=await exchangeRates();if(!rates?.[currency])return null;
 return cents=>formatCurrency(convertMinor(cents,'USD',currency,rates)/100,currency);
}
