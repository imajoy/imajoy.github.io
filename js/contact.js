/* Guest contact is independent of account verification; a saved receipt confirms delivery. */
import {getAccountSession,onAccountChange,openAccount} from './account-session.js?v=20261020-ty1';
import {inspectAttachment,readAttachment} from './contact-attachment.js?v=20261019-advanced1';
const form=document.querySelector('#contact-form');
if(form){
 const status=document.querySelector('#contact-status'),submit=form.querySelector('[type=submit]');
 const art=document.querySelector('.contact-art'),caption=document.querySelector('#contact-art-caption'),meter=document.querySelector('#contact-draft-progress'),ready=document.querySelector('#contact-ready-count');
 const picker=document.querySelector('#attachment-picker'),fileInput=form.elements.attachment,preview=document.querySelector('#attachment-preview'),media=document.querySelector('#attachment-media'),attachmentStatus=document.querySelector('#attachment-status'),transfer=document.querySelector('#attachment-transfer'),progress=document.querySelector('#attachment-progress'),progressLabel=document.querySelector('#attachment-progress-label');
 const motion=matchMedia('(prefers-reduced-motion:reduce)');
 const topics=['general','support','studio','india','privacy','idea'],topic=new URLSearchParams(location.search).get('topic');
 if(topics.includes(topic))form.elements.topic.value=topic;
 let requestId=crypto.randomUUID(),lastPayload='',busy=false,selecting=false,chosenFile=null,chosenInfo=null,objectURL='',fileVersion=0,typingTimer,visible=true;
 let identityMode=getAccountSession()?'account':'guest',wantsAccount=false;
 const announce=(message,error=false)=>{status.textContent=message;status.dataset.error=String(error);};
 const setArt=(state,text)=>{art.dataset.state=state;if(text)caption.textContent=text;};
 const syncEmail=()=>{
  const session=getAccountSession();if(wantsAccount&&session){identityMode='account';wantsAccount=false;}
  if(!session&&identityMode==='account')identityMode='guest';
  form.elements.email.readOnly=identityMode==='account';
  if(identityMode==='account')form.elements.email.value=session.email;
  document.querySelectorAll('[data-contact-mode]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.contactMode===identityMode)));
  document.querySelector('#contact-mode-note').textContent=identityMode==='account'?'Using your signed-in email. You can also contact us as a guest.':'No login needed. Use any valid email where you can receive a reply.';
  updateDraft();
 };
 function updateDraft(){
  const fields=form.elements;
  const completed=Number(!!fields.name.value.trim())+Number(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(fields.email.value.trim()))+Number(fields.message.value.trim().length>=10)+Number(fields.consent.checked);meter.value=completed;ready.textContent=`${completed} of 4 details ready`;
 }
 document.querySelectorAll('[data-contact-mode]').forEach(button=>button.addEventListener('click',()=>{
  if(button.dataset.contactMode==='account'&&!getAccountSession()){wantsAccount=true;openAccount({intent:'signin',purpose:'contact'});return;}
  wantsAccount=false;identityMode=button.dataset.contactMode;syncEmail();
 }));
 syncEmail();onAccountChange(syncEmail);
 const syncMotion=()=>art.toggleAttribute('data-motion-active',visible&&!document.hidden&&!motion.matches);
 if('IntersectionObserver'in window)new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;syncMotion();}).observe(art);
 document.addEventListener('visibilitychange',syncMotion);motion.addEventListener('change',()=>{syncMotion();if(chosenFile)renderPreview();});syncMotion();
 const syncValidity=el=>{if(el.willValidate)el.setAttribute('aria-invalid',String(!el.validity.valid));};
 form.addEventListener('invalid',event=>syncValidity(event.target),true);
 form.addEventListener('blur',event=>{if(event.target.matches('input,textarea,select'))syncValidity(event.target);},true);
 form.addEventListener('input',event=>{
  if(event.target.validity?.valid)event.target.removeAttribute('aria-invalid');updateDraft();
  if(event.target.matches('input:not([type]),input[type=text],input[type=email],textarea')&&!busy){
   art.setAttribute('data-typing','');form.setAttribute('data-typing','');setArt('draft','Your message is taking shape.');clearTimeout(typingTimer);
   typingTimer=setTimeout(()=>{art.removeAttribute('data-typing');form.removeAttribute('data-typing');if(!busy)setArt('draft','Ready whenever you are.');},1000);
  }
 });
 function clearAttachment(resetInput=true){
  fileVersion++;selecting=false;submit.disabled=busy;chosenFile=null;chosenInfo=null;if(resetInput)fileInput.value='';preview.hidden=true;preview.classList.remove('has-media');media.replaceChildren();
  if(objectURL){URL.revokeObjectURL(objectURL);objectURL='';}attachmentStatus.textContent='';delete attachmentStatus.dataset.error;
 }
 function renderPreview(){
  media.replaceChildren();preview.classList.remove('has-media');if(objectURL){URL.revokeObjectURL(objectURL);objectURL='';}
  document.querySelector('#attachment-name').textContent=chosenInfo.name;
  document.querySelector('#attachment-size').textContent=`${(chosenInfo.size/1024/1024).toFixed(2)} MB · ${chosenInfo.extension.toUpperCase()}`;
  if(chosenInfo.extension==='gif'&&motion.matches){media.textContent='GIF';}
  else{
   objectURL=URL.createObjectURL(chosenFile);const video=chosenInfo.type.startsWith('video/'),element=document.createElement(video?'video':'img');
   const version=fileVersion,info=chosenInfo;
   if(video){element.controls=true;element.playsInline=true;element.preload='metadata';element.setAttribute('aria-label','Your video attachment preview');element.addEventListener('error',()=>{if(version!==fileVersion)return;media.textContent=info.extension.toUpperCase();preview.classList.remove('has-media');attachmentStatus.textContent='Your browser cannot preview this video. It can still be attached.';});}
   else element.alt='Your selected attachment';element.src=objectURL;media.append(element);preview.classList.add('has-media');
  }
  preview.hidden=false;
 }
 async function chooseFile(file,fromInput=false){
  if(busy)return;clearAttachment(!fromInput);if(!file)return;const version=fileVersion;selecting=true;submit.disabled=true;
  try{
   const info=await inspectAttachment(file);if(version!==fileVersion)return;chosenFile=file;chosenInfo=info;renderPreview();
   attachmentStatus.textContent='Ready to attach. Uploaded only when you send your message.';
  }catch(error){if(version!==fileVersion)return;fileInput.value='';attachmentStatus.textContent=error.message+' No attachment selected.';attachmentStatus.dataset.error='true';}
  finally{if(version===fileVersion){selecting=false;submit.disabled=busy;}}
 }
 fileInput.addEventListener('change',()=>chooseFile(fileInput.files[0],true));
 document.querySelector('#attachment-remove').addEventListener('click',()=>{clearAttachment();fileInput.focus();});
 for(const type of ['dragenter','dragover'])picker.addEventListener(type,event=>{event.preventDefault();if(!busy)picker.setAttribute('data-dragging','');});
 picker.addEventListener('dragleave',event=>{if(!picker.contains(event.relatedTarget))picker.removeAttribute('data-dragging');});
 picker.addEventListener('drop',event=>{event.preventDefault();picker.removeAttribute('data-dragging');if(event.dataTransfer.files.length>1){attachmentStatus.textContent='Please choose one attachment at a time.';attachmentStatus.dataset.error='true';return;}chooseFile(event.dataTransfer.files[0]);});
 window.addEventListener('pagehide',()=>{if(objectURL)URL.revokeObjectURL(objectURL);});
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(busy||selecting||!form.reportValidity())return;
  const payload={name:form.elements.name.value.trim(),email:form.elements.email.value.trim(),topic:form.elements.topic.value,message:form.elements.message.value.trim(),consent:form.elements.consent.checked,website:form.elements.website.value};
  if(payload.message.length<10){announce('Please write at least 10 characters so we can help.',true);form.elements.message.focus();return;}
  const endpoint=window.AJOY_CONFIG?.sheetUrl;if(!endpoint){announce('The contact service is unavailable. Please try again later.',true);return;}
  const controls=[...form.elements].filter(el=>el!==submit),disabled=controls.map(el=>el.disabled);
  busy=true;submit.disabled=true;controls.forEach(el=>el.disabled=true);form.setAttribute('aria-busy','true');art.removeAttribute('data-typing');form.removeAttribute('data-typing');clearTimeout(typingTimer);announce('Preparing your message…');
  try{
   if(chosenFile){
    transfer.hidden=false;progress.value=0;progressLabel.textContent='Preparing attachment…';
    const base64=await readAttachment(chosenFile,fraction=>{progress.value=Math.round(fraction*100);});
    payload.attachment={name:chosenInfo.name,type:chosenInfo.type,size:chosenInfo.size,base64};
    progress.removeAttribute('value');progressLabel.textContent='Uploading privately and saving your message…';
   }
   const serialized=JSON.stringify(payload);if(lastPayload&&lastPayload!==serialized)requestId=crypto.randomUUID();lastPayload=serialized;
   setArt('sending','Sending your message to Ajoy…');announce(chosenFile?'Uploading your attachment and sending your message…':'Sending your message…');
   const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({type:'contact',contact:{...payload,requestId}}),signal:AbortSignal.timeout(90000)});
   if(!response.ok)throw Error('service');let result;try{result=await response.json();}catch{throw Error('service');}
   if(!result.ok||!/^AJ-[a-zA-Z0-9-]{20,80}$/.test(result.reference||'')){throw Error(['limit','invalid','attachment_invalid','attachment_unavailable'].includes(result.error)?result.error:'service');}
   if(chosenFile&&result.attachmentSaved!==true)throw Error('attachment_unavailable');
   announce('Message received. Ajoy will reply to your email. Your reference: '+result.reference+'.');setArt('sent','Message received. Back to creating.');
   form.reset();clearAttachment();syncEmail();requestId=crypto.randomUUID();lastPayload='';
  }catch(error){
   const errors={limit:'You’ve reached the message limit. Please try again later.',invalid:'Please check your details and try again.',attachment_invalid:'The attachment could not be accepted. Choose a supported file up to 5 MB.',attachment_unavailable:'Attachment uploads are temporarily unavailable. You can remove the file and send your message without it.'};
   announce(errors[error.message]||'Your message could not be confirmed. Your text and attachment are still here—please retry in a moment.',true);setArt('error','Your draft is safe here. Please try again.');
  }finally{busy=false;submit.disabled=false;controls.forEach((el,i)=>el.disabled=disabled[i]);form.removeAttribute('aria-busy');transfer.hidden=true;}
 });
 submit.disabled=false;submit.removeAttribute('title');
}
