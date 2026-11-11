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
 let requestId=crypto.randomUUID(),lastPayload='',busy=false,selecting=false,files=[],fileVersion=0,typingTimer,visible=true;
 let identityMode=getAccountSession()?'account':'guest',wantsAccount=false;
 const announce=(message,error=false)=>{status.textContent=message;status.dataset.error=String(error);};
 const setArt=(state,text)=>{art.dataset.state=state;if(text)caption.textContent=text;};
 /* Send button states (idle, sending, sent, error) and the animated receipt card. */
 const sendLabel=submit.querySelector('.send-label');let resetTimer;
 const setPct=n=>{submit.style.setProperty('--p',String(n/100));const el=submit.querySelector('.send-pct');if(el)el.textContent=Math.round(n)+'%';};
 const setSend=(state,text)=>{clearTimeout(resetTimer);if(state!=='sending'){delete submit.dataset.wait;submit.style.removeProperty('--p');const pc=submit.querySelector('.send-pct');if(pc)pc.textContent='';}submit.dataset.state=state;if(sendLabel&&text&&sendLabel.textContent!==text){sendLabel.textContent=text;sendLabel.classList.remove('is-new');void sendLabel.offsetWidth;sendLabel.classList.add('is-new');}};
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
 document.addEventListener('visibilitychange',syncMotion);motion.addEventListener('change',syncMotion);syncMotion();
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
 /* Up to 5 files, 10 MB in total. Each file is checked here and again by the service, and starts uploading the moment it is attached, so Send has nothing left to upload. */
 const MAX_FILES=5,MAX_TOTAL=10*1024*1024,megabytes=bytes=>(bytes/1048576).toFixed(2)+' MB',list=document.querySelector('#attachment-list');
 let uploadId=crypto.randomUUID(),queue=Promise.resolve();
 const totalBytes=()=>files.reduce((n,f)=>n+f.info.size,0);
 const summary=()=>files.length?`${files.length} of ${MAX_FILES} files · ${megabytes(totalBytes())} of 10 MB. Files upload privately as soon as you attach them.`:'';
 function setNote(text,error=false){attachmentStatus.textContent=text;if(error){attachmentStatus.dataset.error='true';picker.dataset.state='error';fileInput.setAttribute('aria-invalid','true');}else{delete attachmentStatus.dataset.error;delete picker.dataset.state;fileInput.removeAttribute('aria-invalid');}}
 const waiting=()=>files.some(f=>!f.done&&!f.gone);
 function refreshSend(){
  if(busy)return;const wait=waiting();submit.disabled=selecting||wait;
  if(submit.dataset.state==='idle'||!submit.dataset.state||submit.dataset.state==='error'){
   if(wait){if(sendLabel&&sendLabel.textContent!=='Uploading your files'){sendLabel.textContent='Uploading your files';}submit.title='Please wait until your files finish uploading.';}
   else{submit.removeAttribute('title');if(sendLabel&&sendLabel.textContent==='Uploading your files'){sendLabel.textContent='Send message';sendLabel.classList.remove('is-new');void sendLabel.offsetWidth;sendLabel.classList.add('is-new');}}
  }
 }
 function dropEntry(entry){entry.gone=true;entry.abort?.abort();if(entry.url)URL.revokeObjectURL(entry.url);entry.row?.remove();}
 function clearAttachment(resetInput=true){
  fileVersion++;selecting=false;submit.disabled=busy;files.forEach(dropEntry);files=[];uploadId=crypto.randomUUID();if(resetInput)fileInput.value='';list.hidden=true;setNote('');refreshSend();
 }
 function removeFile(entry){if(busy)return;const i=files.indexOf(entry);if(i<0)return;files.splice(i,1);entry.row.classList.add('is-leaving');setTimeout(()=>dropEntry(entry),motion.matches?0:260);entry.gone=true;entry.abort?.abort();list.hidden=!files.length;setNote(summary());fileInput.focus();}
 const svgIcon=(d,cls)=>{const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg'),path=document.createElementNS(ns,'path');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','2.4');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');svg.setAttribute('aria-hidden','true');if(cls)svg.setAttribute('class',cls);path.setAttribute('d',d);svg.append(path);return svg;};
 function addRow(entry){
  const {file,info}=entry,item=document.createElement('div'),thumb=document.createElement('div'),text=document.createElement('div'),name=document.createElement('b'),meta=document.createElement('span'),track=document.createElement('div'),fill=document.createElement('i'),tag=document.createElement('em'),done=document.createElement('span'),remove=document.createElement('button');
  item.className='attachment-preview';item.dataset.state='queued';thumb.className='attachment-media';text.className='attachment-file-info';track.className='attachment-track';tag.className='attachment-pct';done.className='attachment-done';
  name.textContent=info.name;meta.textContent=`${megabytes(info.size)} · ${info.extension.toUpperCase()} · Waiting`;tag.textContent='0%';track.append(fill,tag);track.setAttribute('aria-hidden','true');done.append(svgIcon('M5 12.5l4.3 4.3L19 7'));done.setAttribute('aria-hidden','true');text.append(name,meta,track);
  if(info.extension==='gif'&&motion.matches)thumb.textContent='GIF';
  else{
   entry.url=URL.createObjectURL(file);const video=info.type.startsWith('video/'),element=document.createElement(video?'video':'img');
   if(video){element.muted=true;element.playsInline=true;element.preload='metadata';element.setAttribute('aria-label','Video preview');element.addEventListener('error',()=>{thumb.textContent=info.extension.toUpperCase();});}
   else element.alt='';
   element.src=entry.url;thumb.append(element);
  }
  remove.type='button';remove.textContent='×';remove.setAttribute('aria-label','Remove '+info.name);remove.addEventListener('click',()=>removeFile(entry));
  item.append(thumb,text,done,remove);entry.row=item;entry.meta=meta;
  entry.paint=n=>{entry.pct=Math.max(entry.pct||0,Math.min(100,n));item.style.setProperty('--p',String(entry.pct/100));tag.textContent=Math.round(entry.pct)+'%';};
  list.append(item);list.hidden=false;
 }
 /* One file at a time. The browser cannot report how much of a request has left the device, so after the file is read (a real figure) the rest of the bar is paced by file size and completes only when the service confirms the save. */
 async function uploadEntry(entry){
  const endpoint=window.AJOY_CONFIG?.sheetUrl,{file,info}=entry,label=`${megabytes(info.size)} · ${info.extension.toUpperCase()}`;
  if(entry.gone)return;let timer;
  try{
   if(!endpoint)throw Error('service');
   entry.abort=new AbortController();entry.row.dataset.state='uploading';entry.meta.textContent=label+' · Uploading';
   const base64=await readAttachment(file,fraction=>entry.paint(fraction*30));if(entry.gone)return;
   const started=performance.now(),expected=2200+info.size/1048576*1800;
   timer=setInterval(()=>{const t=(performance.now()-started)/expected;entry.paint(30+64*(1-Math.exp(-2.2*t)));},120);
   const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({type:'contact-upload',upload:{uploadId,file:{name:info.name,type:info.type,size:info.size,base64}}}),signal:AbortSignal.any?AbortSignal.any([entry.abort.signal,AbortSignal.timeout(90000)]):entry.abort.signal});
   if(!response.ok)throw Error('service');const result=await response.json();if(!result.ok||!result.file?.token)throw Error(result.error||'service');
   if(entry.gone)return;clearInterval(timer);entry.receipt=result.file;entry.paint(100);
   setTimeout(()=>{if(!entry.gone){entry.row.dataset.state='done';entry.meta.textContent=label+' · Uploaded';}},motion.matches?0:420);
  }catch(error){
   clearInterval(timer);if(entry.gone)return;
   /* Not fatal: the file simply travels with the message instead, as before. */
   entry.row.dataset.state='later';entry.meta.textContent=label+' · Will upload when you send';
  }
 }
 async function addFiles(incoming){
  if(busy)return;const version=fileVersion,problems=[];selecting=true;refreshSend();
  try{
   for(const file of Array.from(incoming)){
    if(files.length>=MAX_FILES){problems.push(`You can attach up to ${MAX_FILES} files. The rest were not added.`);break;}
    if(file.size>MAX_TOTAL){problems.push(`${file.name} is ${megabytes(file.size)}, over the 10 MB limit. Try a smaller export.`);continue;}
    if(totalBytes()+file.size>MAX_TOTAL){problems.push(`${file.name} would take the total over 10 MB (now ${megabytes(totalBytes())}). Remove a file first.`);continue;}
    try{
     const info=await inspectAttachment(file);if(version!==fileVersion)return;
     const entry={file,info};files.push(entry);addRow(entry);
     entry.promise=queue=queue.then(()=>uploadEntry(entry)).finally(()=>{entry.done=true;refreshSend();});
    }
    catch(error){if(version!==fileVersion)return;problems.push(`${file.name}: ${error.message}`);}
   }
   fileInput.value='';
   setNote(problems.length?(problems.join(' ')+(summary()?' '+summary():'')):summary(),problems.length>0);
  }finally{if(version===fileVersion){selecting=false;refreshSend();}}
 }
 fileInput.addEventListener('change',()=>addFiles(fileInput.files));
 for(const type of ['dragenter','dragover'])picker.addEventListener(type,event=>{event.preventDefault();if(!busy)picker.setAttribute('data-dragging','');});
 picker.addEventListener('dragleave',event=>{if(!picker.contains(event.relatedTarget))picker.removeAttribute('data-dragging');});
 picker.addEventListener('drop',event=>{event.preventDefault();picker.removeAttribute('data-dragging');addFiles(event.dataTransfer.files);});
 window.addEventListener('pagehide',()=>{for(const entry of files)if(entry.url)URL.revokeObjectURL(entry.url);});
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(busy||selecting||waiting()||!form.reportValidity())return;
  const payload={name:form.elements.name.value.trim(),email:form.elements.email.value.trim(),topic:form.elements.topic.value,message:form.elements.message.value.trim(),consent:form.elements.consent.checked,website:form.elements.website.value};
  if(payload.message.length<10){announce('Please write at least 10 characters so we can help.',true);form.elements.message.focus();return;}
  const endpoint=window.AJOY_CONFIG?.sheetUrl;if(!endpoint){announce('The contact service is unavailable. Please try again later.',true);return;}
  const controls=[...form.elements].filter(el=>el!==submit),disabled=controls.map(el=>el.disabled);
  busy=true;submit.disabled=true;controls.forEach(el=>el.disabled=true);form.setAttribute('aria-busy','true');clearReceipt();setSend('sending','Sending your message');art.removeAttribute('data-typing');form.removeAttribute('data-typing');clearTimeout(typingTimer);announce(files.some(f=>!f.receipt&&/uploading|queued/.test(f.row?.dataset.state))?'Finishing your uploads…':'Sending your message…');
  try{
   if(files.length){
    /* Most files are already saved; wait for any still on their way, and carry along only those that could not be uploaded early. */
    await Promise.allSettled(files.map(f=>f.promise));
    const early=files.filter(f=>f.receipt),late=files.filter(f=>!f.receipt);
    if(early.length){payload.uploadId=uploadId;payload.uploads=early.map(f=>f.receipt);}
    if(late.length){payload.attachments=[];for(const {file,info} of late)payload.attachments.push({name:info.name,type:info.type,size:info.size,base64:await readAttachment(file)});}
   }
   const serialized=JSON.stringify(payload);if(lastPayload&&lastPayload!==serialized)requestId=crypto.randomUUID();lastPayload=serialized;
   setArt('sending','Sending your message to Ajoy…');announce('Sending your message…');
   const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({type:'contact',contact:{...payload,requestId}}),signal:AbortSignal.timeout(90000)});
   if(!response.ok)throw Error('service');let result;try{result=await response.json();}catch{throw Error('service');}
   if(!result.ok||!/^AJ-[a-zA-Z0-9-]{20,80}$/.test(result.reference||'')){throw Error(['limit','invalid','attachment_invalid','attachment_unavailable'].includes(result.error)?result.error:'service');}
   if(files.length&&result.attachmentSaved!==true)throw Error('attachment_unavailable');
   const replyTo=payload.email;showReceipt(result.reference,replyTo);setSend('sent','Message sent');resetTimer=setTimeout(()=>{if(!busy)setSend('idle','Send message');},4200);setArt('sent','Message received. Back to creating.');
   form.reset();clearAttachment();syncEmail();requestId=crypto.randomUUID();lastPayload='';
  }catch(error){
   const errors={limit:'You’ve reached the message limit. Please try again later.',invalid:'Please check your details and try again.',attachment_invalid:'The attachments could not be accepted. Choose up to 5 supported files, 10 MB in total.',attachment_unavailable:'Attachment uploads are temporarily unavailable. You can remove the files and send your message without them.'};
   announce(errors[error.message]||'Your message could not be confirmed. Your text and attachment are still here—please retry in a moment.',true);setArt('error','Your draft is safe here. Please try again.');setSend('error','Try again');
  }finally{busy=false;refreshSend();controls.forEach((el,i)=>el.disabled=disabled[i]);form.removeAttribute('aria-busy');}
 });
 submit.disabled=false;submit.removeAttribute('title');
}
