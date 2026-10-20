import {keyedHash} from '../commerce/handler.js';
import {trustedIp} from '../_shared/network.js';
import {createBillingNetworkLookup} from '../_shared/billing-network.js';
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
export function createRazorpayHandler({env,request=fetch}){
 const networkOf=createBillingNetworkLookup(request,env);
 return async req=>{
  const origin=req.headers.get('origin')||'',allowed=(env('ALLOWED_ORIGINS')||'https://imajoy.github.io').split(',').map(s=>s.trim());
  const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type'};
  if(allowed.includes(origin))headers['Access-Control-Allow-Origin']=origin;
  const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers});
  try{
   const path=new URL(req.url).pathname.split('/').filter(Boolean).pop();
   if(req.method==='OPTIONS')return new Response(null,{status:allowed.includes(origin)?204:403,headers});
   if(!['config','quote','checkout','confirm','cancel','stop','webhook'].includes(path))throw fail('Not found.',404);
   if(path!=='webhook'&&!allowed.includes(origin))throw fail('Origin not allowed.',403);
   if(req.method!==(path==='config'?'GET':'POST'))throw fail('Method not allowed.',405);
   if(path!=='config'&&env('COMMERCE_ENABLED')!=='true')throw fail('Checkout is temporarily unavailable.',503);
   const secret=env('COMMERCE_SECRET'),url=env('SHEET_WEB_APP_URL');
   if(!secret||secret.length<32||!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(url||''))throw fail('The payment service is not configured.',503);
   const raw=path==='config'?'':await req.text();if(raw.length>250000)throw fail('Request is too large.',413);
   let payload={action:'razorpay',operation:path};
   if(path==='webhook'){
    const signature=req.headers.get('x-razorpay-signature');
    if(!/^[a-f0-9]{64}$/.test(signature||''))throw fail('Missing webhook signature.',400);
    payload={...payload,rawBody:raw,webhookSignature:signature};
   }else if(path!=='config'){
    let data;try{data=JSON.parse(raw);}catch{throw fail('Invalid request.');}
    if(typeof data.accountToken!=='string'||data.accountToken.length<16||data.accountToken.length>4096)throw fail('Sign in or register before subscribing.',401);
    payload.accountToken=data.accountToken;
    if(['confirm','cancel','stop'].includes(path)){
     if(!/^[-a-f0-9]{36}$/i.test(data.checkoutId||''))throw fail('Invalid checkout.');
     payload.checkoutId=data.checkoutId;
    }else{
     if(!['online','offline'].includes(data.plan)||!['monthly','yearly'].includes(data.billing)||!Number.isInteger(data.seats)||data.seats<1||data.seats>100||!/^([A-Z]{2})$/.test(data.country||''))throw fail('Review your plan, licenses and billing country.');
     if(path==='checkout'&&!/^[-a-f0-9]{36}$/i.test(data.requestId||''))throw fail('Invalid checkout request.');
     const network=await networkOf(req),country=network.country;
     const sandbox=(env('RAZORPAY_MODE')==='test'&&/^[A-Z]{2}$/.test(env('RAZORPAY_SANDBOX_COUNTRY')||''))?env('RAZORPAY_SANDBOX_COUNTRY'):'';
     const offer=data.offer===undefined?'standard':data.offer;
     if(!['standard','trial'].includes(offer))throw fail('Review your plan, licenses and billing country.');
     Object.assign(payload,{plan:data.plan,billing:data.billing,seats:data.seats,country,billingCountry:data.country,sandboxCountry:sandbox,name:typeof data.name==='string'?data.name.slice(0,80):'',company:typeof data.company==='string'?data.company.slice(0,80):'',requestId:data.requestId,expectedTotal:data.expectedTotal,offer,coupon:typeof data.coupon==='string'?data.coupon.trim().toUpperCase().slice(0,32):''});
     if(offer==='trial'&&path==='checkout'){
      // Same one-trial identity signals as PayPal: keyed hashes only, never the raw browser id or IP.
      const identity=env('TRIAL_IDENTITY_SECRET');if(!identity||identity.length<32)throw fail('Trials are not configured.',503);
      if(data.deviceId!==undefined&&!/^[-a-f0-9]{36}$/i.test(data.deviceId||''))throw fail('Invalid browser identifier.');
      const ip=trustedIp(req,env);
      payload.deviceHash=data.deviceId?await keyedHash(identity,'device:'+data.deviceId.toLowerCase()):'';
      payload.ipHash=ip?await keyedHash(identity,'ip:'+ip):'';
     }
     payload.billingNetwork=network;
    }
   }
   const packed=JSON.stringify(payload),timestamp=String(Date.now()),nonce=crypto.randomUUID(),signature=await keyedHash(secret,timestamp+'.'+nonce+'.'+packed);
   const response=await request(url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({type:'commerce',payload:packed,timestamp,nonce,signature}),signal:AbortSignal.timeout(55000)});
   let result;try{result=await response.json();}catch{throw fail('The payment service needs updating.',503);}
   if(!response.ok||typeof result?.ok!=='boolean')throw fail('The payment service is unavailable.',503);
   if(path==='config'&&!result.ok)return json({ok:true,enabled:false});
   return json(result,result.ok?200:result.error==='signin_required'?401:result.error==='signature'?400:result.error==='unavailable'?503:409);
  }catch(error){return json({ok:false,error:'unavailable',message:error.status?error.message:'The payment service is temporarily unavailable.'},error.status||503);}
 };
}
