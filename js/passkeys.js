import '../assets/vendor/webauthn-polyfills-0.1.7/json_serialization.js';
import {getAccountSession} from './account-session.js?v=20261023-p5';
const endpoint=window.AJOY_CONFIG?.passkeysUrl;
const supported=!!(isSecureContext&&window.PublicKeyCredential&&navigator.credentials?.create&&navigator.credentials?.get);
let configuration,pending;
export function cancelPasskey(){pending?.abort();pending=null;}
async function api(path,body,signal){
 const response=await fetch(endpoint+'/'+path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},...(body?{body:JSON.stringify(body)}:{}),signal:signal?AbortSignal.any([signal,AbortSignal.timeout(25000)]):AbortSignal.timeout(25000),cache:'no-store',credentials:'omit'});
 let result;try{result=await response.json();}catch{throw Error('Passkeys are temporarily unavailable. Use an email code.');}
 if(!response.ok||result.ok===false)throw Object.assign(new Error(result.message||'Passkeys are temporarily unavailable. Use an email code.'),{code:result.error,status:response.status});
 return result;
}
function config(){if(!configuration)configuration=api('config').catch(()=>({enabled:false}));return configuration;}
const date=value=>new Date(value).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'});
export async function mountPasskeys(container,{session,onSession,onReauth}){
 if(!container||!supported||!endpoint)return;
 const settings=await config();if(!settings.enabled||!container.isConnected)return;
 const token=session?.token||'',current=()=>container.isConnected&&(getAccountSession()?.token||'')===token;
 container.hidden=false;
 container.innerHTML='<div class="passkey-heading"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="9" r="5"/><path d="m12 12 8 8m-4-4 3-3m-6 0 3-3"/></svg><div><b>'+ (session?'Your passkeys':'Already have a passkey?')+'</b><p>'+(session?'Sign in with your fingerprint, face or device PIN. Biometrics stay with your device.':'Use your device or password manager. No email code needed.')+'</p></div></div><div class="passkey-list"></div><button type="button" class="acct-link" data-passkey-action>'+ (session?'Add a passkey':'Use a passkey')+'</button><p class="passkey-status" role="status" aria-live="polite"></p>';
 const status=container.querySelector('.passkey-status'),action=container.querySelector('[data-passkey-action]');
 const say=text=>{if(current())status.textContent=text;};
 async function accepted(list){
  if(!current()||!PublicKeyCredential.signalAllAcceptedCredentials)return;
  try{await PublicKeyCredential.signalAllAcceptedCredentials({rpId:settings.rpID,userId:list.userId,allAcceptedCredentialIds:list.credentials.map(c=>c.id)});}catch{/* Optional password-manager synchronization. */}
 }
 async function list(){
  const result=await api('list',{accountToken:token});if(!current())return;
  const host=container.querySelector('.passkey-list');host.replaceChildren();
  for(const key of result.credentials){
   const row=document.createElement('div');row.className='passkey-row';
   const copy=document.createElement('div'),title=document.createElement('b'),detail=document.createElement('small');title.textContent=key.name;detail.textContent='Added '+date(key.createdAt)+(key.lastUsedAt?' · Used '+date(key.lastUsedAt):' · Not used yet');copy.append(title,detail);
   const remove=document.createElement('button');remove.type='button';remove.className='acct-link';remove.textContent='Remove';remove.setAttribute('aria-label','Remove '+key.name);
   remove.onclick=()=>run(async signal=>{await api('remove',{accountToken:token,credentialId:key.id},signal);await list();say('Passkey removed. Email-code sign-in is still available.');});
   const rename=document.createElement('button');rename.type='button';rename.className='acct-link';rename.textContent='Rename';rename.setAttribute('aria-label','Rename '+key.name);
   rename.onclick=()=>{
    if(row.querySelector('input'))return;
    const label=document.createElement('label'),input=document.createElement('input'),save=document.createElement('button');
    label.textContent='Passkey name';input.type='text';input.maxLength=60;input.value=key.name;label.append(input);save.type='button';save.className='acct-link';save.textContent='Save name';
    save.onclick=()=>{if(!input.value.trim()){input.focus();return;}run(async signal=>{await api('rename',{accountToken:token,credentialId:key.id,name:input.value},signal);await list();say('Passkey renamed.');});};
    const cancel=document.createElement('button');cancel.type='button';cancel.className='acct-link';cancel.textContent='Cancel';cancel.onclick=()=>{label.remove();save.remove();cancel.remove();rename.hidden=false;};
    copy.append(label,save,cancel);rename.hidden=true;input.focus();
   };
   const controls=document.createElement('div');controls.className='passkey-controls';controls.append(rename,remove);row.append(copy,controls);host.append(row);
  }
  action.disabled=result.credentials.length>=5;action.dataset.full=String(action.disabled);if(!result.credentials.length)say('No passkeys yet. Add one after verifying your account.');
  await accepted(result);
 }
 async function run(work){
  cancelPasskey();const controller=new AbortController();pending=controller;
  container.querySelectorAll('button').forEach(button=>button.disabled=true);say('Follow the prompt from your device or password manager…');
  try{await work(controller.signal);}
  catch(error){
   if(!current())return;
   if(error.code==='reauth_required'){cancelPasskey();onReauth();return;}
   say(error.name==='AbortError'?'Passkey request cancelled. You can use your email code.':error.name==='NotAllowedError'?'No passkey was used. Try again or use your email code.':error.name==='InvalidStateError'?'This device already has a passkey for your account.':error.name==='SecurityError'?'Passkeys are unavailable on this website address. Use your email code.':error.message);
  }finally{if(pending===controller)pending=null;if(current()){container.querySelectorAll('button').forEach(button=>button.disabled=false);action.disabled=action.dataset.full==='true';}}
 }
 action.onclick=()=>run(async signal=>{
  const kind=session?'registration':'authentication';
  const options=await api(kind+'/options',session?{accountToken:token}:{},signal);if(!current()||signal.aborted)return;
  const credential=session?await navigator.credentials.create({publicKey:PublicKeyCredential.parseCreationOptionsFromJSON(options.options),signal}):await navigator.credentials.get({publicKey:PublicKeyCredential.parseRequestOptionsFromJSON(options.options),signal});
  if(!credential||signal.aborted||!current())return;
  say(session?'Saving your verified passkey…':'Verifying your passkey…');
  const encoded=credential.toJSON();let result;
  try{result=await api(kind+'/verify',{...(session?{accountToken:token}:{}),challengeId:options.challengeId,credential:encoded},signal);}
  catch(error){
   // Only an explicit unknown-credential response can remove a saved login from the manager.
   if(!session&&error.status===404&&PublicKeyCredential.signalUnknownCredential)try{await PublicKeyCredential.signalUnknownCredential({rpId:settings.rpID,credentialId:encoded.id});}catch{}
   throw error;
  }
  if(signal.aborted||!current())return;
  if(session){await list();say('Passkey added. Next time, choose “Use a passkey”.');}
  else{pending=null;onSession(result);}
 });
 if(session)list().catch(error=>say(error.message));
}
