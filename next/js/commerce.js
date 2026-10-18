import {regionalPrice} from './regions.js?v=20261018-g2';
export const apiBase = (window.AJOY_CONFIG?.apiBase || '').replace(/\/$/, '');
export const money = (amount,currency) => new Intl.NumberFormat(navigator.language || 'en', {style:'currency',currency,minimumFractionDigits:Number.isInteger(amount/100)?0:2,maximumFractionDigits:2}).format(amount/100);
export async function api(path, options = {}) {
  if (!apiBase) throw new Error('Checkout is not open yet. Please contact Ajoy for subscription availability.');
  const response = await fetch(apiBase+path, { ...options, headers:{...(options.body?{'Content-Type':'application/json'}:{}),...options.headers},signal:AbortSignal.timeout(15000)});
  let data;
  try {data = await response.json();}catch{throw new Error('The service is unavailable. Please try again shortly.');}
  if(!response.ok){const error=new Error(data.error || 'The request could not be completed.');error.status=response.status;throw error;}
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
/* Regional price shown on the site (see regions.js). The PayPal plan for the same tier is what is charged. */
export function previewPrice(plan='online',billing='monthly',seats=1,country=suggestedCountry()) {
  const p=regionalPrice(plan,billing,seats,country);
  return {plan,billing,seats,country,currency:p.currency,unitAmount:p.unitAmount,subtotal:p.unitAmount*seats,baseSubtotal:p.unitAmount*seats,monthlyAmount:p.monthlyAmount,compareAtUnitAmount:p.compareAtUnitAmount,annualSavings:(p.compareAtUnitAmount-p.unitAmount)*seats,annualSavingsPercent:billing==='yearly'?20:0,preview:true};
}
export async function getQuote(plan,billing,seats=1,country,headers={}) {
  const params=new URLSearchParams({plan,billing,seats:String(seats)});
  if(country)params.set('country',country);
  return api('/quote?'+params,{headers});
}
export function getCouponQuote(selection,code,headers={}){return api('/coupon',{method:'POST',headers,body:JSON.stringify({...selection,code})});}
export function mountTurnstile(container,siteKey,onToken,onError,action,size='normal') {
  return new Promise((resolve,reject)=>{
    let widget;
    const render=()=>{
      try {widget=window.turnstile.render(container,{sitekey:siteKey,action,size,theme:'auto',callback:onToken,'expired-callback':()=>onToken(''),'error-callback':()=>{onToken('');onError('Verification could not load. Please retry.');}});resolve(widget);}catch(e){reject(e);}
    };
    if(window.turnstile){render();return;}
    const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;script.onload=render;script.onerror=()=>reject(new Error('Human verification could not load. Please check your connection.'));document.head.append(script);
  });
}
