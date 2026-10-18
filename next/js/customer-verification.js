import {api,mountTurnstile} from './commerce.js?v=20261018-g2';
let session=null,version=0,resetUI=()=>{};
export const customerVersion=()=>version;
export const customerHeaders=()=>session&&session.expiresAt>Date.now()?{Authorization:'Bearer '+session.accessToken}:{};
export const customerVerified=()=>Boolean(customerHeaders().Authorization);
export function clearCustomer(message){resetUI(message);}
export function showCustomerError(){
 if(!customerVerified())return;
 const notice=document.querySelector('#loyalty-status');notice.dataset.error='true';notice.textContent='Your email is verified, but payment history is unavailable. No reward has been confirmed. Choose Check rewards again to retry.';
}
export function showCustomerReward(quote){
 if(!customerVerified()||!quote.loyalty)return;
 const notice=document.querySelector('#loyalty-status');
 notice.dataset.error='false';
 notice.textContent=quote.promotionMessage||(quote.loyalty.discountAmount>0?'Email verified. Your one-time '+quote.loyalty.percent+'% returning subscriber reward is applied automatically.':quote.loyalty.reason==='new_customer'?'Email verified. No previous eligible paid subscription was found.':'Email verified. No unused loyalty reward is due for this payment.');
}
export function initializeCustomerVerification(config,onChange){
 const panel=document.querySelector('#customer-verification'),email=document.querySelector('#email');
 const send=document.querySelector('#loyalty-send'),verify=document.querySelector('#loyalty-verify'),change=document.querySelector('#loyalty-change');
 const code=document.querySelector('#loyalty-code'),codePanel=document.querySelector('#loyalty-code-panel'),challenge=document.querySelector('#loyalty-challenge'),notice=document.querySelector('#loyalty-status');
 let widget,generation=0,expiryTimer,requestEmail='',busy=false;
 const normalizedEmail=()=>email.value.trim().toLowerCase();
 const message=(text,error=false)=>{notice.textContent=text;notice.dataset.error=String(error);};
 const setBusy=value=>{busy=value;panel.setAttribute('aria-busy',String(value));send.disabled=value||!config?.enabled;verify.disabled=value;};
 const removeWidget=()=>{if(widget!==undefined&&window.turnstile){window.turnstile.remove(widget);widget=undefined;}challenge.hidden=true;challenge.replaceChildren();};
 const reset=(text)=>{
  generation++;version++;session=null;requestEmail='';clearTimeout(expiryTimer);removeWidget();code.value='';codePanel.hidden=true;change.hidden=true;send.hidden=false;send.textContent='Verify subscription email';setBusy(false);
  message(text||'Use the email from your previous subscription to check your rewards.');onChange();
 };
 resetUI=reset;
 // The reward offer is always shown. The email-verification controls only appear once the server enables them.
 panel.hidden=false;
 const live=!!config?.enabled;
 panel.toggleAttribute('data-preview',!live);
 const fineText=panel.querySelector('.loyalty-fine');
 if(!live){
  send.hidden=true;change.hidden=true;codePanel.hidden=true;challenge.hidden=true;setBusy(false);message('');
  if(fineText)fineText.textContent='Your reward is applied automatically when you subscribe again with the same email. Monthly rewards do not accumulate. Multiple licenses do not advance a reward.';
  return;
 }
 send.hidden=false;
 let authBase;
 try{const url=new URL(config.authUrl);if(url.protocol!=='https:'||!url.pathname.endsWith('/auth/v1'))throw Error();authBase=url.href.replace(/\/$/,'');}catch{setBusy(true);message('Email verification is temporarily unavailable.',true);return;}
 async function authRequest(path,body){
  const response=await fetch(authBase+path,{method:'POST',headers:{apikey:config.publicKey,'Content-Type':'application/json'},body:JSON.stringify(body),credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new Error(response.status===429?'Too many attempts. Please wait before trying again.':path==='/verify'?'The code is invalid or expired. Request a new code.':'A verification code could not be sent. Please try again later.');
  return response.json();
 }
 send.disabled=false;
 send.addEventListener('click',async()=>{
  if(busy)return;
  if(customerVerified()){onChange();return;}
  if(!email.reportValidity())return;
  const operation=++generation,target=normalizedEmail();requestEmail=target;setBusy(true);message('Complete the human check to request your email code.');removeWidget();challenge.hidden=false;
  try{
   widget=await mountTurnstile('#loyalty-challenge',config.turnstileSiteKey,async token=>{
    if(operation!==generation)return;
    if(!token){generation++;removeWidget();setBusy(false);message('The human check expired. Request a new code.',true);return;}
    try{
     message('Requesting your email code…');
     await authRequest('/otp',{email:target,create_user:true,gotrue_meta_security:{captcha_token:token}});
     if(operation!==generation||target!==normalizedEmail())return;
     codePanel.hidden=false;code.value='';send.textContent='Send a new code';message('If this address can receive a code, it will arrive shortly. Enter it below.');code.focus();
    }catch(e){if(operation===generation)message(e.message,true);}
    finally{if(operation===generation){removeWidget();setBusy(false);}}
   },text=>{if(operation===generation){message(text,true);removeWidget();setBusy(false);}},'loyalty','compact');
   if(operation!==generation)removeWidget();
  }catch(e){if(operation===generation){message(e.message,true);removeWidget();setBusy(false);}}
 });
 async function verifyCode(){
  if(busy)return;
  if(!/^\d{6,10}$/.test(code.value.trim())){message('Enter the 6–10 digit code from your email.',true);code.focus();return;}
  if(!requestEmail||requestEmail!==normalizedEmail()){reset('Your email changed. Request a new code.');return;}
  const operation=++generation,target=requestEmail;setBusy(true);message('Verifying your email…');
  try{
   const result=await authRequest('/verify',{type:'email',email:target,token:code.value.trim()});
   if(operation!==generation||target!==normalizedEmail())return;
   if(typeof result.access_token!=='string'||result.access_token.length<16||!Number.isFinite(result.expires_in)||result.expires_in<30||result.user?.email?.trim().toLowerCase()!==target)throw new Error('Email verification could not be completed. Please request a new code.');
   // Link old receipts only after the server independently verifies this token.
   await api('/customer',{method:'POST',headers:{Authorization:'Bearer '+result.access_token},body:'{}'});
   if(operation!==generation||target!==normalizedEmail())return;
   session={accessToken:result.access_token,email:target,expiresAt:Date.now()+Math.min(result.expires_in,3600)*1000-15000};version++;
   code.value='';codePanel.hidden=true;send.textContent='Check rewards again';change.hidden=false;message('Email verified. Checking your payment history…');
   clearTimeout(expiryTimer);expiryTimer=setTimeout(()=>reset('Your email verification expired. Verify again to check rewards.'),session.expiresAt-Date.now());onChange();
  }catch(e){if(operation===generation)message(e.message,true);}
  finally{if(operation===generation)setBusy(false);}
 }
 verify.addEventListener('click',verifyCode);
 code.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.isComposing){event.preventDefault();verifyCode();}});
 change.addEventListener('click',()=>{reset('Enter your subscription email, then verify it.');email.focus();});
 email.addEventListener('input',()=>{if((session&&session.email!==normalizedEmail())||(requestEmail&&requestEmail!==normalizedEmail()))reset('Your email changed. Verify it to check returning subscriber rewards.');});
 document.addEventListener('visibilitychange',()=>{if(session&&session.expiresAt<=Date.now())reset('Your email verification expired. Verify again to check rewards.');});
 message('Verify the email from your previous subscription. We check paid history automatically; no coupon is needed.');
}
