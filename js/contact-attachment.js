/* One optional attachment. These checks are repeated by the Apps Script service. */
export const MAX_ATTACHMENT_BYTES=5*1024*1024;
export const attachmentTypes={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',mp4:'video/mp4',mov:'video/quicktime'};
export function attachmentInfo(file,bytes){
 const extension=(file.name||'').split('.').pop().toLowerCase(),type=attachmentTypes[extension];
 if((file.name||'').length>180||/[\\/\x00-\x1f]/.test(file.name||''))throw Error('Please shorten the file name and remove special path characters.');
 if(!type||!file.size||file.size>MAX_ATTACHMENT_BYTES)throw Error(file.size>MAX_ATTACHMENT_BYTES?'Choose a file no larger than 5 MB.':'Choose a PNG, JPEG, GIF, MP4 or MOV file.');
 if(file.type&&file.type!==type&&!(extension==='mov'&&file.type==='video/mp4'))throw Error('The file type does not match its extension.');
 if(bytes){
  const b=new Uint8Array(bytes),text=(start,end)=>String.fromCharCode(...b.slice(start,end));
  const valid=extension==='png'?b.length>=8&&[137,80,78,71,13,10,26,10].every((v,i)=>b[i]===v):['jpg','jpeg'].includes(extension)?b[0]===255&&b[1]===216&&b[2]===255:extension==='gif'?['GIF87a','GIF89a'].includes(text(0,6)):b.length>=12&&(text(4,8)==='ftyp'||extension==='mov'&&['moov','mdat','wide','free'].includes(text(4,8)));
  if(!valid)throw Error('This file does not appear to be a valid '+extension.toUpperCase()+' file.');
 }
 return {name:file.name,type,size:file.size,extension};
}
export async function inspectAttachment(file){return attachmentInfo(file,await file.slice(0,32).arrayBuffer());}
export function readAttachment(file,onProgress=()=>{}){
 return new Promise((resolve,reject)=>{
  const reader=new FileReader();reader.onprogress=event=>{if(event.lengthComputable)onProgress(event.loaded/event.total);};
  reader.onerror=()=>reject(Error('The attachment could not be read. Please choose it again.'));
  reader.onload=()=>{onProgress(1);resolve(String(reader.result).split(',')[1]);};reader.readAsDataURL(file);
 });
}
