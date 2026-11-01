/* Wrapline in Maya: tells the signed-in website user whether Wrapline is active in Maya with their Basic email.
   The account session is checked by Apps Script (the same signed envelope as the commerce function); the computers
   come from the licenses/activations tables the Maya "activate" function fills (Basic rows are labelled basic:<email>).
   Read-only. Answers only about the signed-in account itself. */
const encoder=new TextEncoder();
async function hmacHex(secret,text){
 const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return [...new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(text)))].map(b=>b.toString(16).padStart(2,'0')).join('');
}
export async function handleMayaStatus(req,env,request=fetch){
 const origin=req.headers.get('origin')||'',allowed=(env('ALLOWED_ORIGINS')||'https://imajoy.github.io').split(',').map(s=>s.trim());
 const cors={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type'};
 if(allowed.includes(origin))cors['Access-Control-Allow-Origin']=origin;
 const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:cors});
 if(req.method==='OPTIONS')return new Response(null,{status:allowed.includes(origin)?204:403,headers:cors});
 if(req.method!=='POST')return json({ok:false,error:'method'},405);
 if(!allowed.includes(origin))return json({ok:false,error:'origin'},403);
 try{
  const data=await req.json().catch(()=>({}));
  const token=typeof data.accountToken==='string'?data.accountToken:'';
  if(token.length<16||token.length>4096)return json({ok:false,error:'signin_required'},401);
  const secret=env('COMMERCE_SECRET')||'',script=env('SHEET_WEB_APP_URL')||'';
  if(secret.length<32||!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(script))return json({ok:false,error:'unavailable'},503);
  // Who is signed in: Apps Script checks the website session (its "download" step returns the verified email).
  const packed=JSON.stringify({action:'download',accountToken:token}),timestamp=String(Date.now()),nonce=crypto.randomUUID();
  const signature=await hmacHex(secret,timestamp+'.'+nonce+'.'+packed);
  const who=await (await request(script,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({type:'commerce',payload:packed,timestamp,nonce,signature}),signal:AbortSignal.timeout(20000)})).json().catch(()=>null);
  if(!who||!who.ok||typeof who.email!=='string')return json({ok:false,error:who&&who.error==='signin_required'?'signin_required':'unavailable'},who&&who.error==='signin_required'?401:503);
  const email=who.email.trim().toLowerCase(),base=(env('SUPABASE_URL')||'').replace(/\/$/,''),key=env('SUPABASE_SERVICE_ROLE_KEY')||'';
  const head={apikey:key,Authorization:'Bearer '+key};
  const lic=await (await request(base+'/rest/v1/licenses?select=id,active,max_devices&label=eq.'+encodeURIComponent('basic:'+email),{headers:head,signal:AbortSignal.timeout(8000)})).json();
  const row=Array.isArray(lic)?lic[0]:null;
  if(!row)return json({ok:true,installed:false,computers:0,licenses:0});
  const acts=await (await request(base+'/rest/v1/activations?select=last_seen,machine_name&active=eq.true&license_id=eq.'+encodeURIComponent(row.id),{headers:head,signal:AbortSignal.timeout(8000)})).json();
  const list=Array.isArray(acts)?acts:[],last=list.map(a=>a.last_seen).sort().pop()||'';
  return json({ok:true,installed:list.length>0&&row.active!==false,computers:list.length,licenses:row.max_devices||1,lastSeen:last});
 }catch(error){return json({ok:false,error:'unavailable'},503);}
}
