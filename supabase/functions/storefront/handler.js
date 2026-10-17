import {priceFor,validCountry} from '../_shared/catalog.js';
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
 const cors={'Access-Control-Allow-Origin':origin&&origins.includes(origin)?origin:origins[0],'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'content-type','Access-Control-Max-Age':'600','Vary':'Origin','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
 const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json'}});
 if(origin&&!origins.includes(origin))return json({error:'This origin is not allowed.'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 const path=new URL(req.url).pathname.replace(/^.*\/storefront/,'')||'/';
 try{
  if(req.method==='GET'&&path==='/config')return json({paymentsEnabled:false,downloadsEnabled:Boolean(env('TURNSTILE_SECRET_KEY')&&env('TURNSTILE_SITE_KEY')&&env('SUPABASE_SERVICE_ROLE_KEY')&&env('SUPABASE_URL')),turnstileSiteKey:env('TURNSTILE_SITE_KEY')||null});
  if(req.method==='GET'&&path==='/quote'){
   const params=new URL(req.url).searchParams;
   const requested=params.get('country');
   if(requested&&!validCountry(requested))return json({error:'Choose a valid billing country.'},400);
   const country=requested||await countryFromRequest(req,env,request);
   let quote;try{quote=priceFor(country,params.get('plan')||'online',params.get('billing')||'monthly',Number(params.get('seats')||1));}catch{return json({error:'Choose a valid license, billing period, and computer count.'},400);}
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
   if(path!=='/download')return json({error:'Not found.'},404);
   const raw=await req.text();if(raw.length>8192)return json({error:'Request is too large.'},413);
   let body;try{body=JSON.parse(raw);}catch{return json({error:'Invalid request.'},400);}
   if(typeof body.token!=='string'||!body.token||body.token.length>2048)return json({error:'Complete the human check before downloading.'},400);
   const secret=env('TURNSTILE_SECRET_KEY');
   if(!secret||!env('SUPABASE_SERVICE_ROLE_KEY')||!env('SUPABASE_URL'))return json({error:'Download verification is temporarily unavailable.'},503);
   const verifyBody=new URLSearchParams({secret,response:body.token});
   const ip=clientIP(req);if(ip)verifyBody.set('remoteip',ip);
   const verification=await request('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:verifyBody,signal:AbortSignal.timeout(10000)});
   const verified=await verification.json();
   const hostname=env('TURNSTILE_HOSTNAME')||'imajoy.github.io';
   if(!verification.ok||verified.success!==true||verified.action!=='download'||verified.hostname!==hostname)return json({error:'Human verification failed or expired. Please verify again.'},403);
   const bucket=env('INSTALLER_BUCKET')||'installers';
   const file=env('INSTALLER_OBJECT')||'AjoyTools_Setup.py';
   const base=env('SUPABASE_URL').replace(/\/$/,'');
   const serviceKey=env('SUPABASE_SERVICE_ROLE_KEY');
   const storage=await request(base+'/storage/v1/object/sign/'+encodeURIComponent(bucket)+'/'+file.split('/').map(encodeURIComponent).join('/'),{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+serviceKey,'apikey':serviceKey},body:JSON.stringify({expiresIn:60}),signal:AbortSignal.timeout(10000)});
   const signed=await storage.json();
   if(!storage.ok||typeof signed.signedURL!=='string')return json({error:'The installer is temporarily unavailable. Please try again later.'},503);
   // Storage REST returns /object/sign/... (the SDK prepends /storage/v1).
   const signedPath=signed.signedURL.startsWith('/object/sign/')?'/storage/v1'+signed.signedURL:signed.signedURL;
   if(!signedPath.startsWith('/storage/v1/object/sign/'))return json({error:'The installer link could not be created.'},503);
   const signedURL=new URL(signedPath,base);
   if(signedURL.origin!==new URL(base).origin)return json({error:'The installer link could not be created.'},503);
   return json({url:signedURL.href,expiresIn:60});
  }
  return json({error:'Not found.'},404);
 }catch{return json({error:'The service is temporarily unavailable. Please try again.'},503);}
}
