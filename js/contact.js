/* Guest contact is independent of account verification; a saved receipt confirms delivery. */
import {getAccountSession,onAccountChange,openAccount} from './account-session.js?v=20261023-p7';
import {inspectAttachment,readAttachment} from './contact-attachment.js?v=20261111-multi';
const form=document.querySelector('#contact-form');
if(form){
 const status=document.querySelector('#contact-status'),submit=form.querySelector('[type=submit]');
 const art=document.querySelector('.contact-art'),caption=document.querySelector('#contact-art-caption'),meter=document.querySelector('#contact-draft-progress'),ready=document.querySelector('#contact-ready-count');
 const picker=document.querySelector('#attachment-picker'),fileInput=form.elements.attachment,attachmentStatus=document.querySelector('#attachment-status'),transfer=document.querySelector('#attachment-transfer'),progress=document.querySelector('#attachment-progress'),progressLabel=document.querySelector('#attachment-progress-label');
 const motion=matchMedia('(prefers-reduced-motion:reduce)');
 const topics=['general','support','studio','billing','privacy','idea'],topic=new URLSearchParams(location.search).get('topic');
 if(topics.includes(topic))form.elements.topic.value=topic;
 const refParam=(new URLSearchParams(location.search).get('ref')||'').match(/^ORD-[A-F0-9]{8}$/)?.[0];
 if(refParam&&!form.elements.message.value)form.elements.message.value='Order ID: '+refParam+'\n\nWhat happened: ';
 let requestId=crypto.randomUUID(),lastPayload='',busy=false,selecting=false,files=[],objectURLs=[],fileVersion=0,typingTimer,visible=true;
 let identityMode=getAccountSession()?'account':'guest',wantsAccount=false;
 const announce=(message,error=false)=>{status.textContent=message;status.dataset.error=String(error);};
 const setArt=(state,text)=>{art.dataset.state=state;if(text)caption.textContent=text;};
 /* Send button states (idle, sending, sent, error) and the animated receipt card. */
 const sendLabel=submit.querySelector('.send-label');let resetTimer;
 const setSend=(state,text)=>{clearTimeout(resetTimer);submit.dataset.state=state;if(sendLabel&&text&&sendLabel.textContent!==text){sendLabel.textContent=text;sendLabel.classList.remove('is-new');void sendLabel.offsetWidth;sendLabel.classList.add('is-new');}};
 const clearReceipt=()=>{const card=status.querySelector('.contact-receipt');if(!card)return;card.classList.add('is-leaving');setTimeout(()=>{if(card.isConnected){card.remove();}},360);};
 const showReceipt=(reference,email)=>{
  const svg='http://www.w3.org/2000/svg',el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n;};
  const card=el('div','contact-receipt'),badge=el('span','receipt-badge'),icon=document.createElementNS(svg,'svg'),path=document.createElementNS(svg,'path');
  icon.setAttribute('viewBox','0 0 24 24');icon.setAttribute('fill','none');icon.setAttribute('stroke','currentColor');icon.setAttribute('stroke-width','2.4');icon.setAttribute('stroke-linecap','round');icon.setAttribute('stroke-linejoin','round');icon.setAttribute('aria-hidden','true');
  path.setAttribute('d','M5 12.5l4.3 4.3L19 7');icon.append(path);badge.append(icon);
  ['#2fb583','#5bd8ed','#3d8bff','#ffb84d','#2fb583','#9c8cff'].forEach((c,i)=>{const spark=el('i','receipt-spark');spark.style.setProperty('--a',(i*60+15)+'deg');spark.style.setProperty('--c',c);card.append(spark);});
  const body=el('div'),title=el('b','','Message received'),line=el('p'),ref=el('p','receipt-ref'),code=el('code','',reference),copy=el('button','receipt-copy','Copy');
  line.append('Ajoy will reply to ');if(email){const who=el('strong','',email);line.append(who);}else line.append('your email');line.append('. Keep your reference in case you need to follow up.');
  copy.type='button';copy.setAttribute('aria-label','Copy reference '+reference);
  copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(reference);copy.textContent='Copied';copy.setAttribute('data-copied','');setTimeout(()=>{copy.textContent='Copy';copy.removeAttribute('data-copied');},1800);}catch{}});
  ref.append('Reference ',code,copy);body.append(title,line,ref);card.prepend(badge);card.append(body);
  status.dataset.error='false';status.replaceChildren(card);
 };
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
  const completed=Number(!!fields.name.value.trim())+Number(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(fields.email.value.trim()))+Number(fields.message.value.trim().length>=10)+Number(fields.consent.checked);const ok={name:!!fields.name.value.trim(),email:/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(fields.email.value.trim()),message:fields.message.value.trim().length>=10,consent:fields.consent.checked};
  for(const k of Object.keys(ok)){const box=fields[k].closest('.contact-field,.contact-consent');if(box)box.dataset.valid=String(ok[k]);}
  const before=Number(meter.value)||0;meter.value=completed;meter.dataset.done=String(completed);
  ready.textContent=completed===4?'All set, ready to send':`${completed} of 4 details ready`;
  const wrap=meter.closest('.draft-meter');if(wrap){wrap.dataset.done=String(completed);if(completed>before){wrap.classList.remove('just-done');void wrap.offsetWidth;wrap.classList.add('just-done');}}
 }
 document.querySelectorAll('[data-contact-mode]').forEach(button=>button.addEventListener('click',()=>{
  if(button.dataset.contactMode==='account'&&!getAccountSession()){wantsAccount=true;openAccount({intent:'signin',purpose:'contact'});return;}
  wantsAccount=false;identityMode=button.dataset.contactMode;syncEmail();
 }));
 syncEmail();onAccountChange(syncEmail);
 const syncMotion=()=>art.toggleAttribute('data-motion-active',visible&&!document.hidden&&!motion.matches);
 if('IntersectionObserver'in window)new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;syncMotion();}).observe(art);
 document.addEventListener('visibilitychange',syncMotion);motion.addEventListener('change',()=>{syncMotion();if(files.length)renderList();});syncMotion();
 const syncValidity=el=>{if(el.willValidate)el.setAttribute('aria-invalid',String(!el.validity.valid));};
 form.addEventListener('invalid',event=>syncValidity(event.target),true);
 form.addEventListener('blur',event=>{if(event.target.matches('input,textarea,select'))syncValidity(event.target);},true);
 form.addEventListener('input',event=>{
  if(event.target.validity?.valid)event.target.removeAttribute('aria-invalid');updateDraft();
  if(event.target.matches('textarea')&&!busy){
   art.setAttribute('data-typing','');form.setAttribute('data-typing','');setArt('draft','Your message is taking shape.');clearTimeout(typingTimer);
   typingTimer=setTimeout(()=>{art.removeAttribute('data-typing');form.removeAttribute('data-typing');if(!busy)setArt('draft','Ready whenever you are.');},1000);
  }
 });
 /* Up to 5 files, 10 MB in total. Each file is checked here and again by the service. */
 const MAX_FILES=5,MAX_TOTAL=10*1024*1024,megabytes=bytes=>(bytes/1048576).toFixed(2)+' MB',list=document.querySelector('#attachment-list');
 const totalBytes=()=>files.reduce((n,f)=>n+f.info.size,0);
 function setNote(text,error=false){attachmentStatus.textContent=text;if(error){attachmentStatus.dataset.error='true';picker.dataset.state='error';fileInput.setAttribute('aria-invalid','true');}else{delete attachmentStatus.dataset.error;delete picker.dataset.state;fileInput.removeAttribute('aria-invalid');}}
 function clearAttachment(resetInput=true){
  fileVersion++;selecting=false;submit.disabled=busy;files=[];if(resetInput)fileInput.value='';renderList();setNote('');
 }
 function removeFile(index){if(busy)return;files.splice(index,1);renderList();setNote(files.length?`${files.length} of ${MAX_FILES} files · ${megabytes(totalBytes())} of 10 MB. Uploaded only when you send your message.`:'');fileInput.focus();}
 function renderList(){
  for(const url of objectURLs)URL.revokeObjectURL(url);objectURLs=[];list.replaceChildren();
  files.forEach((entry,index)=>{
   const {file,info}=entry,item=document.createElement('div'),thumb=document.createElement('div'),text=document.createElement('div'),name=document.createElement('b'),size=document.createElement('span'),remove=document.createElement('button');
   item.className='attachment-preview';thumb.className='attachment-media';text.className='attachment-file-info';
   name.textContent=info.name;size.textContent=`${megabytes(info.size)} · ${info.extension.toUpperCase()}`;text.append(name,size);
   if(info.extension==='gif'&&motion.matches)thumb.textContent='GIF';
   else{
    const url=URL.createObjectURL(file);objectURLs.push(url);const video=info.type.startsWith('video/'),element=document.createElement(video?'video':'img');
    if(video){element.muted=true;element.playsInline=true;element.preload='metadata';element.setAttribute('aria-label','Video preview');element.addEventListener('error',()=>{thumb.textContent=info.extension.toUpperCase();});}
    else element.alt='';
    element.src=url;thumb.append(element);
   }
   remove.type='button';remove.textContent='×';remove.setAttribute('aria-label','Remove '+info.name);remove.addEventListener('click',()=>removeFile(index));
   item.append(thumb,text,remove);list.append(item);
  });
  list.hidden=!files.length;
 }
 async function addFiles(incoming){
  if(busy)return;const version=fileVersion,problems=[];selecting=true;submit.disabled=true;
  try{
   for(const file of Array.from(incoming)){
    if(files.length>=MAX_FILES){problems.push(`You can attach up to ${MAX_FILES} files. The rest were not added.`);break;}
    if(file.size>MAX_TOTAL){problems.push(`${file.name} is ${megabytes(file.size)}, over the 10 MB limit. Try a smaller export.`);continue;}
    if(totalBytes()+file.size>MAX_TOTAL){problems.push(`${file.name} would take the total over 10 MB (now ${megabytes(totalBytes())}). Remove a file first.`);continue;}
    try{const info=await inspectAttachment(file);if(version!==fileVersion)return;files.push({file,info});}
    catch(error){if(version!==fileVersion)return;problems.push(`${file.name}: ${error.message}`);}
   }
   renderList();fileInput.value='';
   const summary=files.length?`${files.length} of ${MAX_FILES} files · ${megabytes(totalBytes())} of 10 MB. Uploaded only when you send your message.`:'';
   setNote(problems.length?(problems.join(' ')+(summary?' '+summary:'')):summary,problems.length>0);
  }finally{if(version===fileVersion){selecting=false;submit.disabled=busy;}}
 }
 fileInput.addEventListener('change',()=>addFiles(fileInput.files));
 for(const type of ['dragenter','dragover'])picker.addEventListener(type,event=>{event.preventDefault();if(!busy)picker.setAttribute('data-dragging','');});
 picker.addEventListener('dragleave',event=>{if(!picker.contains(event.relatedTarget))picker.removeAttribute('data-dragging');});
 picker.addEventListener('drop',event=>{event.preventDefault();picker.removeAttribute('data-dragging');addFiles(event.dataTransfer.files);});
 window.addEventListener('pagehide',()=>{for(const url of objectURLs)URL.revokeObjectURL(url);});
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(busy||selecting||!form.reportValidity())return;
  const payload={name:form.elements.name.value.trim(),email:form.elements.email.value.trim(),topic:form.elements.topic.value,message:form.elements.message.value.trim(),consent:form.elements.consent.checked,website:form.elements.website.value};
  if(payload.message.length<10){announce('Please write at least 10 characters so we can help.',true);form.elements.message.focus();return;}
  const endpoint=window.AJOY_CONFIG?.sheetUrl;if(!endpoint){announce('The contact service is unavailable. Please try again later.',true);return;}
  const controls=[...form.elements].filter(el=>el!==submit),disabled=controls.map(el=>el.disabled);
  busy=true;submit.disabled=true;controls.forEach(el=>el.disabled=true);form.setAttribute('aria-busy','true');clearReceipt();setSend('sending',files.length?'Uploading your files':'Sending your message');art.removeAttribute('data-typing');form.removeAttribute('data-typing');clearTimeout(typingTimer);announce('Preparing your message…');
  try{
   if(files.length){
    transfer.hidden=false;progress.value=0;progressLabel.textContent='Preparing attachments…';
    const all=totalBytes()||1;let done=0;payload.attachments=[];
    for(const {file,info} of files){
     const base64=await readAttachment(file,fraction=>{progress.value=Math.round((done+fraction*info.size)/all*100);});
     done+=info.size;payload.attachments.push({name:info.name,type:info.type,size:info.size,base64});
    }
    progress.removeAttribute('value');progressLabel.textContent='Uploading privately and saving your message…';
   }
   const serialized=JSON.stringify(payload);if(lastPayload&&lastPayload!==serialized)requestId=crypto.randomUUID();lastPayload=serialized;
   setArt('sending','Sending your message to Ajoy…');announce(files.length?'Uploading your attachments and sending your message…':'Sending your message…');
   const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({type:'contact',contact:{...payload,requestId}}),signal:AbortSignal.timeout(90000)});
   if(!response.ok)throw Error('service');let result;try{result=await response.json();}catch{throw Error('service');}
   if(!result.ok||!/^AJ-[a-zA-Z0-9-]{20,80}$/.test(result.reference||'')){throw Error(['limit','invalid','attachment_invalid','attachment_unavailable'].includes(result.error)?result.error:'service');}
   if(files.length&&result.attachmentSaved!==true)throw Error('attachment_unavailable');
   const replyTo=payload.email;showReceipt(result.reference,replyTo);setSend('sent','Message sent');resetTimer=setTimeout(()=>{if(!busy)setSend('idle','Send message');},4200);setArt('sent','Message received. Back to creating.');
   form.reset();clearAttachment();syncEmail();requestId=crypto.randomUUID();lastPayload='';
  }catch(error){
   const errors={limit:'You’ve reached the message limit. Please try again later.',invalid:'Please check your details and try again.',attachment_invalid:'The attachments could not be accepted. Choose up to 5 supported files, 10 MB in total.',attachment_unavailable:'Attachment uploads are temporarily unavailable. You can remove the files and send your message without them.'};
   announce(errors[error.message]||'Your message could not be confirmed. Your text and attachment are still here—please retry in a moment.',true);setArt('error','Your draft is safe here. Please try again.');setSend('error','Try again');
  }finally{busy=false;submit.disabled=false;controls.forEach((el,i)=>el.disabled=disabled[i]);form.removeAttribute('aria-busy');transfer.hidden=true;}
 });
 submit.disabled=false;submit.removeAttribute('title');
}
