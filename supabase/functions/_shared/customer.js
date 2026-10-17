export function loyaltyEnabled(env){
 return env('LOYALTY_ENABLED')==='true'&&Boolean(env('SUPABASE_URL')&&publicAuthKey(env('SUPABASE_ANON_KEY'))&&env('SUPABASE_SERVICE_ROLE_KEY')&&env('QUOTE_SIGNING_SECRET')?.length>=32&&env('AUTH_TURNSTILE_SITE_KEY'));
}
function publicAuthKey(value){
 if(typeof value!=='string')return false;
 if(value.startsWith('sb_publishable_'))return true;
 try{return JSON.parse(atob(value.split('.')[1].replaceAll('-','+').replaceAll('_','/'))).role==='anon';}catch{return false;}
}
function failure(message,status){return Object.assign(new Error(message),{status});}
export async function emailHash(email){
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(email.trim().toLowerCase()));
 return [...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}
export async function verifiedCustomer(req,env,request=fetch){
 if(!loyaltyEnabled(env))throw failure('Returning subscriber verification is not available yet.',503);
 const authorization=req.headers.get('authorization')||'';
 if(!/^Bearer [A-Za-z0-9._~-]{16,8192}$/.test(authorization))throw failure('Verify your subscription email to check returning subscriber savings.',401);
 const base=env('SUPABASE_URL').replace(/\/$/,'');
 const response=await request(base+'/auth/v1/user',{headers:{apikey:env('SUPABASE_ANON_KEY'),Authorization:authorization},signal:AbortSignal.timeout(10000)});
 if(response.status>=500)throw failure('Customer verification is temporarily unavailable.',503);
 if(!response.ok)throw failure('Your verification expired. Verify your email again.',401);
 const user=await response.json();
 if(!/^[a-f0-9-]{36}$/i.test(user.id||'')||typeof user.email!=='string'||!user.email.includes('@')||!user.email_confirmed_at||user.is_anonymous===true)throw failure('A verified subscription email is required.',401);
 return {id:user.id,email:user.email.trim().toLowerCase()};
}
export async function customerHistory(customer,env,request=fetch){
 const base=env('SUPABASE_URL').replace(/\/$/,'');
 const response=await request(base+'/rest/v1/rpc/storefront_loyalty_history',{
  method:'POST',headers:{apikey:env('SUPABASE_SERVICE_ROLE_KEY'),Authorization:'Bearer '+env('SUPABASE_SERVICE_ROLE_KEY'),'Content-Type':'application/json'},
  body:JSON.stringify({p_user_id:customer.id,p_email_hash:await emailHash(customer.email)}),signal:AbortSignal.timeout(10000)
 });
 if(!response.ok)throw failure('Payment history could not be checked. Please try again.',503);
 const history=await response.json();
 for(const field of ['paidPurchases','monthlyPaidPeriods','yearlyPaidPeriods'])if(!Number.isSafeInteger(history[field])||history[field]<0)throw failure('Payment history could not be checked. Please try again.',503);
 if(history.monthlyPaidPeriods+history.yearlyPaidPeriods>history.paidPurchases||typeof history.historyVersion!=='string'||!Array.isArray(history.usedRewards)||history.usedRewards.some(reward=>!['monthly_second','monthly_third','yearly_return'].includes(reward)))throw failure('Payment history could not be checked. Please try again.',503);
 return history;
}
export async function linkCustomerHistory(customer,env,request=fetch){
 const response=await request(env('SUPABASE_URL').replace(/\/$/,'')+'/rest/v1/rpc/storefront_link_customer',{
  method:'POST',headers:{apikey:env('SUPABASE_SERVICE_ROLE_KEY'),Authorization:'Bearer '+env('SUPABASE_SERVICE_ROLE_KEY'),'Content-Type':'application/json'},
  body:JSON.stringify({p_user_id:customer.id,p_email_hash:await emailHash(customer.email)}),signal:AbortSignal.timeout(10000)
 });
 if(!response.ok)throw failure('Your payment history could not be linked. Please try again.',503);
}
