import {keyedHash} from '../commerce/handler.js';
const fail=(code,message,status=400)=>Object.assign(new Error(message),{code,status});
const bytes=value=>Uint8Array.from(atob(value.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));
const base64=value=>btoa(String.fromCharCode(...value)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
/** @param {*} webauthn @param {{env:(key:string)=>string|undefined,request?:typeof fetch,origin?:string,rpID?:string}} options */
export function createPasskeyHandler(webauthn,{env,request=fetch,origin='https://imajoy.github.io',rpID='imajoy.github.io'}) {
  async function rpc(operation,data={}) {
    const secret=env('COMMERCE_SECRET'),url=env('SHEET_WEB_APP_URL');
    if(!secret||secret.length<32||!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(url||''))throw fail('unavailable','Passkeys are not connected yet. Use an email code.',503);
    const payload=JSON.stringify({action:'passkeys',operation,...data}),timestamp=String(Date.now()),nonce=crypto.randomUUID();
    const signature=await keyedHash(secret,timestamp+'.'+nonce+'.'+payload);
    const response=await request(url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({type:'commerce',payload,timestamp,nonce,signature}),signal:AbortSignal.timeout(20000)});
    let result;try{result=await response.json();}catch{throw fail('unavailable','Passkeys are not connected yet. Use an email code.',503);}
    if(!response.ok||!result?.ok)throw fail(result?.error||'unavailable',result?.message||'Passkeys are temporarily unavailable. Use an email code.',result?.error==='credential_missing'?404:result?.error==='reauth_required'||result?.error==='signin_required'?401:409);
    return result;
  }
  return async req=>{
    const cors={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type'};
    const allowed=req.headers.get('origin')===origin;if(allowed)cors['Access-Control-Allow-Origin']=origin;
    const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:cors});
    try{
      if(!allowed)throw fail('origin','Origin not allowed.',403);
      if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
      const path=new URL(req.url).pathname.replace(/^.*\/passkeys\/?/,'');
      if(req.method==='GET'&&path==='config'){
        try{await rpc('config');return json({enabled:true,rpID});}catch{return json({enabled:false});}
      }
      if(req.method!=='POST')throw fail('method','Method not allowed.',405);
      if(!['registration/options','registration/verify','authentication/options','authentication/verify','list','remove','rename'].includes(path))throw fail('path','Not found.',404);
      const raw=await req.text();if(raw.length>65536)throw fail('size','Passkey request is too large.',413);
      let data;try{data=JSON.parse(raw);}catch{throw fail('invalid','Invalid passkey request.');}
      const token=data.accountToken;
      if(['registration/options','registration/verify','list','remove','rename'].includes(path)&&!(typeof token==='string'&&token.length>=16&&token.length<=4096))throw fail('signin_required','Verify your email first.',401);
      if(path==='list')return json(await rpc('list',{accountToken:token}));
      if(path==='remove')return json(await rpc('remove',{accountToken:token,credentialId:data.credentialId}));
      if(path==='rename')return json(await rpc('rename',{accountToken:token,credentialId:data.credentialId,name:data.name}));
      if(path.endsWith('/options')){
        const registering=path.startsWith('registration'),kind=registering?'register':'authenticate';
        let options;
        if(registering){
          const who=await rpc('context',{accountToken:token});
          options=await webauthn.generateRegistrationOptions({rpName:'Ajoy Tools',rpID,userID:bytes(who.userId),userName:who.email,userDisplayName:who.email,attestationType:'none',timeout:120000,excludeCredentials:who.credentials.map(c=>({id:c.id,transports:c.transports})),authenticatorSelection:{residentKey:'required',requireResidentKey:true,userVerification:'required'}});
        }else options=await webauthn.generateAuthenticationOptions({rpID,timeout:120000,userVerification:'required',allowCredentials:[]});
        const challengeId=crypto.randomUUID();await rpc('challenge',{kind,challengeId,challenge:options.challenge,...(registering?{accountToken:token}:{})});
        return json({options,challengeId});
      }
      const registering=path.startsWith('registration'),kind=registering?'register':'authenticate';
      const credential=data.credential;
      if(!credential||credential.type!=='public-key'||!/^[-_a-zA-Z0-9]{1,2048}$/.test(credential.id||''))throw fail('verification','Invalid passkey response.');
      const challenge=await rpc('consume',{challengeId:data.challengeId,kind,...(registering?{accountToken:token}:{credentialId:credential.id})});
      if(registering){
        let result;try{result=await webauthn.verifyRegistrationResponse({response:credential,expectedChallenge:challenge.challenge,expectedOrigin:origin,expectedRPID:rpID,requireUserVerification:true});}catch{throw fail('verification','Your passkey could not be verified. Please try again.');}
        if(!result.verified||!result.registrationInfo?.userVerified)throw fail('verification','Passkey verification is required.');
        const info=result.registrationInfo,who=challenge.userId?challenge:await rpc('context',{accountToken:token});
        return json(await rpc('save',{accountToken:token,credential:{id:info.credential.id,publicKey:base64(info.credential.publicKey),counter:info.credential.counter,transports:info.credential.transports||[],userId:who.userId,deviceType:info.credentialDeviceType,backedUp:info.credentialBackedUp,aaguid:info.aaguid}}));
      }
      // Older Apps Script deployments ignore credentialId on consume; keep their
      // separate lookup working until the storage deployment is updated.
      const saved=challenge.credential||(await rpc('credential',{credentialId:credential.id})).credential;
      if(credential.response?.userHandle!==saved.userId)throw fail('verification','This passkey does not match the account.');
      let result;try{result=await webauthn.verifyAuthenticationResponse({response:credential,expectedChallenge:challenge.challenge,expectedOrigin:origin,expectedRPID:rpID,credential:{id:saved.id,publicKey:bytes(saved.publicKey),counter:saved.counter,transports:saved.transports},requireUserVerification:true});}catch{throw fail('verification','Your passkey could not be verified. Use an email code or try again.');}
      if(!result.verified||!result.authenticationInfo.userVerified)throw fail('verification','Passkey verification is required.');
      return json(await rpc('login',{credentialId:saved.id,previousCounter:saved.counter,newCounter:result.authenticationInfo.newCounter}));
    }catch(error){return json({ok:false,error:error.code||'unavailable',message:error.code?error.message:'Passkeys are temporarily unavailable. Use an email code.'},error.status||503);}
  };
}
