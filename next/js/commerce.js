export const apiBase = (window.AJOY_CONFIG?.apiBase || '').replace(/\/$/, '');
export const money = (amount,currency) => new Intl.NumberFormat(navigator.language || 'en', {style:'currency',currency,maximumFractionDigits:currency==='INR'?0:2}).format(amount/100);
export async function api(path, options = {}) {
  if (!apiBase) throw new Error('Checkout is not open yet. Please contact Ajoy for subscription availability.');
  const response = await fetch(apiBase+path, { ...options, headers:{'Content-Type':'application/json',...options.headers},signal:AbortSignal.timeout(15000)});
  let data;
  try {data = await response.json();}catch{throw new Error('The service is unavailable. Please try again shortly.');}
  if(!response.ok) throw new Error(data.error || 'The request could not be completed.');
  return data;
}
export function suggestedCountry() {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if(['Asia/Calcutta','Asia/Kolkata'].includes(timezone))return 'IN';
  if(timezone==='Asia/Karachi')return 'PK';
  if(timezone==='Europe/London')return 'GB';
  const region=(navigator.language||'').split('-')[1];
  return /^[A-Za-z]{2}$/.test(region||'')?region.toUpperCase():'US';
}
/* Display-only fallback while the server is unavailable. It cannot authorize a charge. */
export function previewPrice(plan='online',billing='monthly',seats=1,country=suggestedCountry()) {
  const low=['IN','PK'].includes(country),base=low?699:1999;
  const c=country==='IN'?'INR':country==='PK'?'PKR':country==='GB'?'GBP':'USD';
  const rate={INR:1,PKR:3.25,GBP:.0087,USD:.0116}[c];
  const m=plan==='offline'?2:1;
  const subtotal=Math.round((billing==='yearly'?Math.max(699,Math.round(base*.8))*12:base)*m*rate*100);
  return {plan,billing,seats,country,currency:c,unitAmount:subtotal,subtotal:subtotal*seats,preview:true};
}
export async function getQuote(plan,billing,seats=1,country) {
  const params=new URLSearchParams({plan,billing,seats:String(seats)});
  if(country)params.set('country',country);
  return api('/quote?'+params);
}
export function mountTurnstile(container,siteKey,onToken,onError,action) {
  return new Promise((resolve,reject)=>{
    let widget;
    const render=()=>{
      try {widget=window.turnstile.render(container,{sitekey:siteKey,action,theme:'auto',callback:onToken,'expired-callback':()=>onToken(''),'error-callback':()=>{onToken('');onError('Verification could not load. Please retry.');}});resolve(widget);}catch(e){reject(e);}
    };
    if(window.turnstile){render();return;}
    const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;script.onload=render;script.onerror=()=>reject(new Error('Human verification could not load. Please check your connection.'));document.head.append(script);
  });
}
