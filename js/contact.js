/* A receipt from Apps Script is required before a message is called saved. */
import {getAccountSession,onAccountChange} from './account-session.js?v=20261018-n1';
const form=document.querySelector('#contact-form');
if(form){
 const status=document.querySelector('#contact-status'),submit=form.querySelector('[type=submit]');
 const topics=['general','support','studio','india','privacy','idea'];
 const topic=new URLSearchParams(location.search).get('topic');
 if(topics.includes(topic))form.elements.topic.value=topic;
 let requestId=crypto.randomUUID(),lastPayload='',busy=false;
 const syncEmail=()=>{
  const session=getAccountSession();
  if(session){form.elements.email.value=session.email;form.elements.email.readOnly=true;}
  else form.elements.email.readOnly=false;
 };
 syncEmail();onAccountChange(syncEmail);
 const announce=(message,error=false)=>{status.textContent=message;status.dataset.error=String(error);};
 const syncValidity=el=>{if(el.willValidate)el.setAttribute('aria-invalid',String(!el.validity.valid));};
 form.addEventListener('invalid',event=>syncValidity(event.target),true);
 form.addEventListener('blur',event=>{if(event.target.matches('input,textarea,select'))syncValidity(event.target);},true);
 form.addEventListener('input',event=>{if(event.target.validity?.valid)event.target.removeAttribute('aria-invalid');});
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(busy||!form.reportValidity())return;
  const payload={name:form.elements.name.value.trim(),email:form.elements.email.value.trim(),topic:form.elements.topic.value,message:form.elements.message.value.trim(),consent:form.elements.consent.checked,website:form.elements.website.value};
  if(payload.message.length<10){announce('Please write at least 10 characters so we can help.',true);form.elements.message.focus();return;}
  const serialized=JSON.stringify(payload);if(lastPayload&&lastPayload!==serialized)requestId=crypto.randomUUID();lastPayload=serialized;
  const endpoint=window.AJOY_CONFIG?.sheetUrl;
  if(!endpoint){announce('The contact service is unavailable. Please try again later.',true);return;}
  const controls=[...form.elements].filter(el=>el!==submit),disabled=controls.map(el=>el.disabled);
  busy=true;submit.disabled=true;controls.forEach(el=>el.disabled=true);form.setAttribute('aria-busy','true');announce('Sending your message…');
  try{
   const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({type:'contact',contact:{...payload,requestId}}),signal:AbortSignal.timeout(20000)});
   if(!response.ok)throw Error('service');
   let result;try{result=await response.json();}catch{throw Error('service');}
   if(!result.ok||!/^AJ-[a-zA-Z0-9-]{20,80}$/.test(result.reference||'')){
    if(result.error==='limit')throw Error('limit');
    if(result.error==='invalid')throw Error('invalid');
    throw Error('service');
   }
   announce('Message received. Ajoy will reply to your email. Your reference: '+result.reference+'.');
   form.reset();syncEmail();requestId=crypto.randomUUID();lastPayload='';
  }catch(error){announce(error.message==='limit'?'You’ve reached the message limit. Please try again later.':error.message==='invalid'?'Please check your details and try again.':'Your message could not be confirmed. Your text is still here—please retry in a moment.',true);}
  finally{busy=false;submit.disabled=false;controls.forEach((el,i)=>el.disabled=disabled[i]);form.removeAttribute('aria-busy');}
 });
 submit.disabled=false;submit.removeAttribute('title');
}
