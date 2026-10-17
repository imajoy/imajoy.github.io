export const normalizeCoupon=code=>typeof code==='string'?code.trim().toUpperCase():'';
export async function couponHash(code){
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(normalizeCoupon(code)));
 return [...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
export async function applyCoupon(quote,rawCode,registry,now=Date.now()){
 if(quote.loyalty?.discountAmount>0)throw new Error('Coupons and loyalty rewards do not stack.');
 if(quote.coupon)throw new Error('Only one coupon can be applied per order.');
 const code=normalizeCoupon(rawCode);
 if(!/^[A-Z0-9][A-Z0-9-]{5,31}$/.test(code))throw new Error('Enter a valid coupon code.');
 const hash=await couponHash(code);
 const rule=registry&&Object.hasOwn(registry,hash)?registry[hash]:null;
 if(!rule||rule.active!==true||!Number.isInteger(rule.percent)||rule.percent<1||rule.percent>50||!Number.isFinite(Date.parse(rule.expiresAt))||Date.parse(rule.expiresAt)<=now)throw new Error('This coupon is invalid or has expired.');
 for(const key of ['plans','billing','countries'])if(rule[key]!==undefined&&(!Array.isArray(rule[key])||rule[key].some(value=>typeof value!=='string')))throw new Error('This coupon is invalid or has expired.');
 if((rule.plans&&!rule.plans.includes(quote.plan))||(rule.billing&&!rule.billing.includes(quote.billing))||(rule.countries&&!rule.countries.includes(quote.country))||(rule.maxSeats!==undefined&&(!Number.isInteger(rule.maxSeats)||quote.seats>rule.maxSeats)))throw new Error('This coupon is not available for your selected license or billing details.');
 const discountAmount=Math.round(quote.subtotal*rule.percent/100);
 if(!discountAmount||quote.subtotal-discountAmount<quote.minimumSubtotal)throw new Error('This coupon cannot be combined with the current price.');
 return {...quote,expiresAt:Math.min(quote.expiresAt,Date.parse(rule.expiresAt)),baseSubtotal:quote.subtotal,subtotal:quote.subtotal-discountAmount,coupon:{code,percent:rule.percent,discountAmount}};
}
