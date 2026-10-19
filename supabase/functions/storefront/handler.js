import {priceFor,validCountry} from '../_shared/catalog.js';
import {applyCoupon} from '../_shared/coupons.js';
import {loyaltyEnabled,verifiedCustomer,customerHistory,linkCustomerHistory} from '../_shared/customer.js';
import {applyLoyalty,betterPromotion} from '../_shared/loyalty.js';
const defaultEnv = name => globalThis.Deno?.env.get(name);
const encode = bytes => btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
async function sign(data,secret){
 const body=encode(new TextEncoder().encode(JSON.stringify(data)));
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return body+'.'+encode(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(body))));
}
function clientIP(req){
 // Supabase's gateway supplies x-forwarded-for. Use for approximate display only,
 // never as the authority for a future payment or tax calculation.
 const ip=(req.headers.get('x-forwarded-for')||'').split(',')[0].trim();
 return /^[0-9a-fA-F.:]+$/.test(ip)&&ip.length<=45?ip:null;
}
async function countryFromRequest(req,env,request){
 const ip=clientIP(req);
 if(ip){try{
  const response=await request('https://api.country.is/'+encodeURIComponent(ip),{signal:AbortSignal.timeout(2500)});
  const data=await response.json();if(response.ok&&validCountry(data.country))return data.country;
 }catch{/* Pricing remains available when approximate geo lookup is unavailable. */}}
 const fallback=env('DEFAULT_COUNTRY')||'US';return validCountry(fallback)?fallback:'US';
}
export async function handleRequest(req,env=defaultEnv,request=fetch){
 const origins=(env('ALLOWED_ORIGINS')||'https://imajoy.github.io').split(',').map(s=>s.trim());
 const origin=req.headers.get('origin');
 const cors={'Access-Control-Allow-Origin':origin&&origins.includes(origin)?origin:origins[0],'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'content-type, authorization','Access-Control-Max-Age':'600','Vary':'Origin','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
 const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json'}});
 if(origin&&!origins.includes(origin))return json({error:'This origin is not allowed.'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 const path=new URL(req.url).pathname.replace(/^.*\/storefront/,'')||'/';
 try{
  if(req.method==='GET'&&path==='/config')return json({paymentsEnabled:false,downloadsEnabled:false,
   loyalty:loyaltyEnabled(env)?{enabled:true,authUrl:env('SUPABASE_URL').replace(/\/$/,'')+'/auth/v1',publicKey:env('SUPABASE_ANON_KEY')}:{enabled:false}});
  if(req.method==='GET'&&path==='/quote'){
   const params=new URL(req.url).searchParams;
   const requested=params.get('country');
   if(requested&&!validCountry(requested))return json({error:'Choose a valid billing country.'},400);
   const country=requested||await countryFromRequest(req,env,request);
   let quote;try{quote=priceFor(country,params.get('plan')||'online',params.get('billing')||'monthly',Number(params.get('seats')||1));}catch{return json({error:'Choose a valid license, billing period, and computer count.'},400);}
   if(req.headers.has('authorization')){
    const customer=await verifiedCustomer(req,env,request);
    quote=applyLoyalty(quote,customer,await customerHistory(customer,env,request));
   }
   if(env('QUOTE_SIGNING_SECRET'))quote.quoteToken=await sign(quote,env('QUOTE_SIGNING_SECRET'));
   return json(quote);
  }
  if(req.method==='POST'){
   if(!origin||!origins.includes(origin))return json({error:'A valid website origin is required.'},403);
   if(!req.headers.get('content-type')?.startsWith('application/json'))return json({error:'JSON is required.'},415);
   if(Number(req.headers.get('content-length')||0)>8192)return json({error:'Request is too large.'},413);
   // Until a merchant integration is explicitly configured, do not parse or
   // retain billing information, create orders, or claim that a payment worked.
   if(path==='/checkout')return json({error:'Payments are not open yet. No order or charge has been created.'},503);
   if(path==='/customer'){
    const customer=await verifiedCustomer(req,env,request);
    await linkCustomerHistory(customer,env,request);
    return json({verified:true});
   }
   if(path==='/coupon'){
    const raw=await req.text();if(raw.length>2048)return json({error:'Request is too large.'},413);
    let body;try{body=JSON.parse(raw);}catch{return json({error:'Invalid request.'},400);}
    let registry;try{registry=JSON.parse(env('COUPONS_JSON')||'{}');}catch{return json({error:'Coupon validation is temporarily unavailable.'},503);}
    if(!registry||Array.isArray(registry)||typeof registry!=='object')return json({error:'Coupon validation is temporarily unavailable.'},503);
    let quote,customer,history;
    if(req.headers.has('authorization')){customer=await verifiedCustomer(req,env,request);history=await customerHistory(customer,env,request);}
    try{
     quote=priceFor(body.country,body.plan,body.billing,body.seats);
     const coupon=await applyCoupon(quote,body.code,registry);
     quote=customer?betterPromotion(applyLoyalty(quote,customer,history),coupon):coupon;
    }catch(e){return json({error:e.message||'This coupon could not be applied.'},400);}
    if(env('QUOTE_SIGNING_SECRET'))quote.quoteToken=await sign(quote,env('QUOTE_SIGNING_SECRET'));
    return json(quote);
   }
   if(path==='/download')return json({error:'Sign in or register through the current download page. This legacy download route is closed.'},410);
   return json({error:'Not found.'},404);
  }
  return json({error:'Not found.'},404);
 }catch(e){return json({error:e?.status===401?e.message:'The service is temporarily unavailable. Please try again.'},e?.status===401?401:503);}
}
