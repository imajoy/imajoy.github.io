import test from 'node:test';
import assert from 'node:assert/strict';
import {attachmentInfo,inspectAttachment,MAX_ATTACHMENT_BYTES} from '../js/contact-attachment.js';
test('guest contact attachments accept PNG, JPEG, GIF, MP4 and MOV with matching signatures',async()=>{
 for(const [name,type,bytes] of [['still.PNG','image/png',[137,80,78,71,13,10,26,10]],['photo.jpeg','image/jpeg',[255,216,255,224]],['loop.gif','image/gif',[...Buffer.from('GIF89a')]],['clip.mp4','video/mp4',[0,0,0,24,...Buffer.from('ftypisom')]],['clip.mov','video/quicktime',[0,0,0,24,...Buffer.from('ftypqt  ')]]]){
  const info=await inspectAttachment(new File([new Uint8Array(bytes)],name,{type}));assert.equal(info.type,type);
 }
});
test('file checks reject spoofed signatures, MIME types, disallowed extensions, paths and the 5 MB boundary',async()=>{
 await assert.rejects(inspectAttachment(new File(['not an image'],'fake.png',{type:'image/png'})),/does not appear/);
 await assert.rejects(inspectAttachment(new File(['<svg>'],'file.svg',{type:'image/svg+xml'})),/Choose a PNG/);
 assert.throws(()=>attachmentInfo({name:'../image.png',size:9,type:'image/png'}),/path characters/);
 assert.throws(()=>attachmentInfo({name:'image.png',size:9,type:'text/html'}),/does not match/);
 assert.throws(()=>attachmentInfo({name:'image.png',size:MAX_ATTACHMENT_BYTES+1,type:'image/png'}),/5 MB/);
 assert.equal(attachmentInfo({name:'clip.mp4',size:MAX_ATTACHMENT_BYTES,type:'video/mp4'}).size,MAX_ATTACHMENT_BYTES);
});
