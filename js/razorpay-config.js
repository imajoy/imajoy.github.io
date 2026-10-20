/* Razorpay settings come from Apps Script (a few seconds). The last copy is remembered for 30 minutes so pages
   can show prices and payment options at once; a fresh copy is always fetched and used for the next visit.
   Display only: the server re-checks availability, prices and offers on every quote and checkout. */
let pending;
const KEY='ajoy.rzpconfig';
const fresh=()=>{const url=window.AJOY_CONFIG?.razorpayUrl;return fetch(url+'/config',{cache:'no-store',signal:AbortSignal.timeout(10000)}).then(r=>r.ok?r.json():null).then(c=>{if(c?.ok)try{localStorage.setItem(KEY,JSON.stringify({at:Date.now(),c}));}catch{}return c;}).catch(()=>null);};
export function loadRazorpayConfig(){
 const url=window.AJOY_CONFIG?.razorpayUrl;
 if(!url)return Promise.resolve(null);
 if(!pending){
  let saved=null;try{const v=JSON.parse(localStorage.getItem(KEY)||'null');if(v&&Date.now()-v.at<1800000)saved=v.c;}catch{}
  const network=fresh();
  pending=saved?Promise.resolve(saved):network;
 }
 return pending;
}
/* countries ['*'] means international: every country except the owner's closed list. */
export const razorpayAvailable=(config,country)=>!!(config?.enabled&&/^[A-Z]{2}$/.test(country||'')&&(config.countries?.includes(country)||config.countries?.includes('*')&&!(config.closedCountries||[]).includes(country)));
