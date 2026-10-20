/* No client amount or trial-eligibility claim authorizes a subscription. */
import {getAccountSession,clearAccountSession,openAccount} from './account-session.js?v=20261018-n1';
const cfg=window.AJOY_CONFIG||{};
let device;
export function browserDeviceId(){
 if(device)return device;
 try{
  device=localStorage.getItem('ajoy.browser');
  if(!/^[-a-f0-9]{36}$/i.test(device||'')){device=crypto.randomUUID();localStorage.setItem('ajoy.browser',device);}
  return device;
 }catch{return null;}
}
export async function secureCommerce(path,body={}){
 const session=getAccountSession();
 if(!session){openAccount({purpose:path==='download'?'download':'checkout'});throw new Error('Sign in or register and verify your email to continue.');}
 if(!cfg.commerceUrl)throw new Error('Secure checkout and downloads are being connected. Please try again shortly.');
 const response=await fetch(cfg.commerceUrl.replace(/\/$/,'')+'/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,accountToken:session.token,...(['checkout','eligibility'].includes(path)?{deviceId:browserDeviceId()}: {})}),signal:AbortSignal.timeout(60000)});
 let data;try{data=await response.json();}catch{throw new Error('The secure account service needs updating. Please try again later.');}
 if(!response.ok||!data.ok){
  if(response.status===401){clearAccountSession();openAccount({purpose:path==='download'?'download':'checkout'});}
  document.dispatchEvent(new CustomEvent('ajoy:billing-denied',{detail:{code:data.error}}));
  const error=new Error(data.message||'The request could not be completed. Please try again.');error.code=data.error;throw error;
 }
 return data;
}
