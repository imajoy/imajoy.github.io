/* Trusted network boundary. Private records and PayPal credentials stay in Apps Script. */
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const encoder=new TextEncoder();
export async function keyedHash(secret,text){
 const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return [...new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(text)))].map(b=>b.toString(16).padStart(2,'0')).join('');
}
export function trustedIp(req,env){
 // Set this only to a header the deployed ingress strips and overwrites; never trust arbitrary X-Forwarded-For.
 const name=env('COMMERCE_CLIENT_IP_HEADER');
 if(!['cf-connecting-ip','x-real-ip'].includes(name))return '';
 const value=(req.headers.get(name)||'').trim().toLowerCase();
 if(value.includes(',')||!(/^(?:\d{1,3}\.){3}\d{1,3}$/.test(value)||/^[0-9a-f:]+$/.test(value)&&value.includes(':')))return '';
 if(value.includes('.'))return value.split('.').every(n=>Number(n)<=255)?value.split('.').map(Number).join('.'):'';
 // URL canonicalizes equivalent IPv6 spellings so the same address cannot claim twice by changing notation.
 try{return new URL('http://['+value+']/').hostname.slice(1,-1);}catch{return '';}
}
export async function handleCommerceRequest(req,env,request=fetch){
 const origin=req.headers.get('origin')||'',allowed=(env('ALLOWED_ORIGINS')||'https://imajoy.github.io').split(',').map(s=>s.trim());
 const cors={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type'};
 if(allowed.includes(origin))cors['Access-Control-Allow-Origin']=origin;
 const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:cors});
 try{
  const path=new URL(req.url).pathname.split('/').filter(Boolean).pop();
  if(req.method==='OPTIONS')return new Response(null,{status:allowed.includes(origin)?204:403,headers:cors});
  if(req.method!=='POST')throw fail('Method not allowed.',405);
  if(path!=='paypal-webhook'&&!allowed.includes(origin))throw fail('Origin not allowed.',403);
  if(!['eligibility','checkout','confirm','download','paypal-webhook'].includes(path))throw fail('Not found.',404);
  if(env('COMMERCE_ENABLED')!=='true')throw fail('Account checkout and downloads are being connected. Please try again shortly.',503);
  const secret=env('COMMERCE_SECRET'),identitySecret=env('TRIAL_IDENTITY_SECRET'),script=env('SHEET_WEB_APP_URL');
  if(!secret||secret.length<32||!identitySecret||identitySecret.length<32||!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(script||''))throw fail('Account service is not configured.',503);
  const raw=await req.text();if(raw.length>(path==='paypal-webhook'?250000:16000))throw fail('Request is too large.',413);
  let data;try{data=JSON.parse(raw);}catch{throw fail('Invalid request.');}
  let payload;
  if(path==='paypal-webhook'){
   const headers={};for(const name of ['paypal-transmission-id','paypal-transmission-time','paypal-transmission-sig','paypal-cert-url','paypal-auth-algo'])headers[name]=req.headers.get(name)||'';
   if(Object.values(headers).some(v=>!v||v.length>4096))throw fail('Missing PayPal verification headers.',400);
   payload={action:'webhook',event:data,headers};
  }else{
   if(typeof data.accountToken!=='string'||data.accountToken.length<16||data.accountToken.length>4096)throw fail('Sign in or register and verify your email first.',401);
   payload={action:path,accountToken:data.accountToken};
   if(['checkout','eligibility'].includes(path)){
    const device=data.deviceId;
    if(device&& (typeof device!=='string'||!/^[-a-f0-9]{36}$/i.test(device)))throw fail('Invalid browser identifier.');
    const ip=trustedIp(req,env);
    payload.deviceHash=device?await keyedHash(identitySecret,'device:'+device.toLowerCase()):'';
    payload.ipHash=ip?await keyedHash(identitySecret,'ip:'+ip):'';
    let country='';
    if(ip){try{const r=await request('https://api.country.is/'+encodeURIComponent(ip),{signal:AbortSignal.timeout(2500)});if(r.ok)country=(await r.json()).country||'';}catch{}}
    payload.country=/^[A-Z]{2}$/.test(country)?country:'';
    if(path==='checkout'){
     if(!['online','offline'].includes(data.plan)||!['monthly','yearly'].includes(data.billing)||!['trial','standard'].includes(data.offer)||!Number.isInteger(data.seats)||data.seats<1||data.seats>100||!/^[-a-f0-9]{36}$/i.test(data.requestId||''))throw fail('Review your plan, billing period and license quantity.');
     Object.assign(payload,{plan:data.plan,billing:data.billing,seats:data.seats,offer:data.offer,requestId:data.requestId,billingCountry:data.country,name:typeof data.name==='string'?data.name.slice(0,80):'',company:typeof data.company==='string'?data.company.slice(0,80):''});
     // Owner-controlled Sandbox simulation. Never accept a test country from the browser.
     const testCountry=(env('COMMERCE_SANDBOX_COUNTRY')||'').trim().toUpperCase();
     if(env('PAYPAL_MODE')==='sandbox'&&testCountry){
      if(!/^[A-Z]{2}$/.test(testCountry))throw fail('The Sandbox test country is not configured correctly.',503);
      payload.sandboxCountry=testCountry;
     }
    }
   }
   if(path==='confirm'){
    if(!/^[-a-f0-9]{36}$/i.test(data.checkoutId||''))throw fail('Invalid checkout.');payload.checkoutId=data.checkoutId;
   }
  }
  const packed=JSON.stringify(payload),timestamp=String(Date.now()),nonce=crypto.randomUUID();
  const signature=await keyedHash(secret,timestamp+'.'+nonce+'.'+packed);
  const result=await request(script,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({type:'commerce',payload:packed,timestamp,nonce,signature}),signal:AbortSignal.timeout(25000)});
  let response;try{response=await result.json();}catch{throw fail('The account service needs the latest deployment.',503);}
  if(!result.ok||!response||typeof response.ok!=='boolean')throw fail('The account service is unavailable.',503);
  if(!response.ok)return json(response,response.error==='signin_required'?401:response.error==='unavailable'?503:409);
  if(path==='download'){
   const base=env('SUPABASE_URL'),key=env('SUPABASE_SERVICE_ROLE_KEY'),bucket=env('INSTALLER_BUCKET'),object=env('INSTALLER_OBJECT');
   if(!base||!key||!bucket||!object)throw fail('The registered download is not connected yet.',503);
   const encoded=[bucket,...object.split('/')].map(encodeURIComponent).join('/');
   const signed=await request(base.replace(/\/$/,'')+'/storage/v1/object/sign/'+encoded,{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({expiresIn:60}),signal:AbortSignal.timeout(10000)});
   const file=await signed.json();if(!signed.ok||typeof file.signedURL!=='string')throw fail('The installer is temporarily unavailable.',503);
   const signedPath=file.signedURL.startsWith('/object/sign/')?'/storage/v1'+file.signedURL:file.signedURL;
   if(!signedPath.startsWith('/storage/v1/object/sign/'))throw fail('Invalid installer response.',503);
   const parsed=new URL(signedPath,base);if(parsed.origin!==new URL(base).origin)throw fail('Invalid installer response.',503);
   parsed.searchParams.set('download','AjoyTools_Setup.py');
   return json({ok:true,url:parsed.href});
  }
  return json(response);
 }catch(error){return json({ok:false,error:'unavailable',message:error.status?error.message:'The service could not complete the request. Please try again.'},error.status||503);}
}
