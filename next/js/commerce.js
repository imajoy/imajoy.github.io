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
/* Display-only fallback while the server is unavailable. It cannot authorize a charge. */
export function previewPrice(plan='online',billing='monthly',seats=1,country=suggestedCountry()) {
  const low=['IN','PK','BD','NP','LK'].includes(country),middle=['ID','PH','VN','BR','MX','ZA'].includes(country),base=low?899:middle?1299:1999;
  const local={IN:['INR',1],PK:['PKR',3.25],US:['USD',.0116],GB:['GBP',.0087],CA:['CAD',.0158],AU:['AUD',.0179],AE:['AED',.0426],DE:['EUR',.0106],FR:['EUR',.0106],ES:['EUR',.0106],IT:['EUR',.0106],NL:['EUR',.0106],IE:['EUR',.0106]};
  const [currency,rate]=local[country]||['USD',.0116],m=plan==='offline'?2:1;
  const monthlyAmount=Math.round(base*m*rate*100),compareAtUnitAmount=billing==='yearly'?monthlyAmount*12:monthlyAmount;
  const unitAmount=billing==='yearly'?Math.round(compareAtUnitAmount*.8):monthlyAmount;
  return {plan,billing,seats,country,currency,unitAmount,subtotal:unitAmount*seats,baseSubtotal:unitAmount*seats,monthlyAmount,compareAtUnitAmount,annualSavings:(compareAtUnitAmount-unitAmount)*seats,annualSavingsPercent:billing==='yearly'?20:0,preview:true};
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
