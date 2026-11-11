import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {service} from './helpers/apps-service.mjs';
const message=(overrides={})=>({name:'A Maya artist',email:'artist@example.com',topic:'support',message:'I need help with a studio installation.',consent:true,requestId:randomUUID(),website:'',...overrides});
const send=(s,data)=>JSON.parse(s.ctx.doPost({postData:{contents:JSON.stringify({type:'contact',contact:data})}}).text);
test('contact route saves a private message and receipt without creating accounts, and mails you a copy',()=>{
 const s=service({registered:false}),data=message(),result=send(s,data);
 assert.equal(result.ok,true);assert.match(result.reference,/^AJ-/);
 const rows=s.sheets.get('Contacts').rows;assert.equal(rows.length,2);assert.equal(rows[1][3],data.email);assert.equal(rows[1][5],data.message);assert.equal(rows[1][7],true);
 assert.equal(s.sheets.has('Accounts'),false);assert.equal(s.sheets.has('Sheet1'),false);assert.equal(s.mails.filter(m=>!/^Contact form/.test(m.subject)).length,0);assert.equal(s.requests.length,0);
 assert.equal(s.mails.length,1);assert.equal(s.mails[0].to,'owner@example.com');assert.equal(s.mails[0].replyTo,data.email);assert.match(s.mails[0].subject,/^Contact form \(support\): /);assert.match(s.mails[0].body,/I need help/);
 assert.deepEqual(send(s,data),result);assert.equal(s.mails.length,1,'A retry must not email again.');assert.equal(rows.length,2,'Retry must not append another row.');
 assert.equal(send(s,{...data,message:'A different message for the same request.'}).error,'invalid');
 assert.equal(send(s,{...data,email:'other@example.com'}).error,'invalid');
});
test('contact rejects missing consent, malformed fields, oversized messages and spam without creating a tab',()=>{
 for(const bad of [{name:''},{email:'not-an-email'},{message:'short'},{message:'x'.repeat(4001)},{consent:false},{consent:'true'},{topic:'admin'},{website:'spam.example'},{requestId:'bad'}]){
  const s=service();assert.equal(send(s,message(bad)).ok,false);assert.equal(s.sheets.has('Contacts'),false);
 }
});
test('contact cells escape formulas even with leading whitespace',()=>{
 const s=service(),result=send(s,message({name:'  =HYPERLINK("example")',message:'\n\t+SUM(1, 2) more content'}));
 assert.equal(result.ok,true);const row=s.sheets.get('Contacts').rows[1];assert(row[2].startsWith("'="));assert(row[5].startsWith("'+"));
});
test('contact enforces sender and site limits while allowing safe retry receipts',()=>{
 const s=service(),first=message();assert.equal(send(s,first).ok,true);
 for(let i=0;i<2;i++)assert.equal(send(s,message()).ok,true);
 assert.equal(send(s,message()).error,'limit');assert.equal(send(s,first).ok,true);
 const t=service();t.values.set('CONTACT_DAILY',JSON.stringify({day:new Date().toISOString().slice(0,10),count:200}));
 assert.equal(send(t,message()).error,'limit');assert.equal(t.sheets.has('Contacts'),false);
});

const mediaFile=(extension,bytes)=>({name:'screen.'+extension,type:{png:'image/png',jpeg:'image/jpeg',gif:'image/gif',mp4:'video/mp4',mov:'video/quicktime'}[extension],size:bytes.length,base64:Buffer.from(bytes).toString('base64')});
const mediaFixtures=[mediaFile('png',[137,80,78,71,13,10,26,10,0]),mediaFile('jpeg',[255,216,255,224,0]),mediaFile('gif',Buffer.from('GIF89a'+String.fromCharCode(1,0,1,0))),mediaFile('mp4',Buffer.from([0,0,0,24,...Buffer.from('ftypisom'),0,0,0,0])),mediaFile('mov',Buffer.from([0,0,0,24,...Buffer.from('ftypqt  '),0,0,0,0]))];
function storageService(){const s=service({registered:false});s.values.set('CONTACT_GITHUB_TOKEN','private-test-upload-token');s.values.set('CONTACT_GITHUB_REPO','imajoy/Ajoy-Tools-Contact-Details');return s;}
test('all five supported formats save privately with a Sheet link and never register the guest',()=>{
 for(const attachment of mediaFixtures){
  const s=storageService(),data=message({attachment}),result=send(s,data);assert.equal(result.ok,true);assert.equal(result.attachmentSaved,true);assert.equal(s.github.uploads,1);
  const row=s.sheets.get('Contacts').rows[1];assert.match(row[8],/^https:\/\/github.com\/imajoy\/Ajoy-Tools-Contact-Details\/blob\/main\/contact-details\//);assert.equal(row[9],attachment.name);assert.equal(row[11],attachment.size);
  assert.equal(s.sheets.has('Accounts'),false);assert.equal(s.mails.filter(m=>!/^Contact form/.test(m.subject)).length,0);assert(!JSON.stringify(result).includes('private-test-upload-token'));assert.equal(send(s,data).attachmentSaved,true);assert.equal(s.github.uploads,1);
 }
});
test('a public repository, missing token, or unavailable GitHub cannot receive files or record partial messages',()=>{
 for(const configure of [s=>s.github.private=false,s=>s.github.available=false]){
  const s=storageService();configure(s);assert.equal(send(s,message({attachment:mediaFixtures[0]})).error,'attachment_unavailable');assert.equal(s.github.uploads,0);assert.equal(s.sheets.has('Contacts'),false);
  assert.equal(send(s,message()).ok,true,'Guest messages still work without an upload.');
 }
});
test('attachment validation rejects oversized, spoofed, corrupt and unsafe names before any GitHub call',()=>{
 const png=mediaFixtures[0];
 for(const bad of [{...png,size:5*1024*1024+1},{...png,name:'bad.exe'},{...png,name:'../screen.png'},{...png,type:'text/html'},{...png,size:99},{...png,base64:'invalid????'},{...png,base64:Buffer.from('NOT A PNG').toString('base64')}]){
  const s=storageService();assert.equal(send(s,message({attachment:bad})).error,'attachment_invalid');assert.equal(s.requests.length,0);assert.equal(s.sheets.has('Contacts'),false);
 }
});
test('upload retry reuses a matching Git blob after a failed Sheet write and rejects substituted contents',()=>{
 const s=storageService(),data=message({attachment:mediaFixtures[0]}),spreadsheet=s.ctx.SpreadsheetApp.getActiveSpreadsheet;
 s.ctx.SpreadsheetApp.getActiveSpreadsheet=()=>{throw Error('Temporary Sheets failure');};
 assert.equal(send(s,data).error,'unavailable');assert.equal(s.github.uploads,1);assert.equal(s.sheets.has('Contacts'),false);
 s.ctx.SpreadsheetApp.getActiveSpreadsheet=spreadsheet;assert.equal(send(s,data).ok,true);assert.equal(s.github.uploads,1);assert.equal(s.sheets.get('Contacts').rows.length,2);
 const other={...data.attachment,base64:Buffer.from([137,80,78,71,13,10,26,10,1]).toString('base64')};s.cache.clear();assert.equal(send(s,{...data,attachment:other}).error,'attachment_unavailable');assert.equal(s.github.uploads,1);assert.equal(s.sheets.get('Contacts').rows.length,2);
});

test('first attachment initializes an empty private repository without a manual README',()=>{
 const s=storageService();s.github.empty=true;
 assert.equal(send(s,message({attachment:mediaFixtures[0]})).ok,true);assert.equal(s.github.uploads,1);assert.equal(s.github.empty,false);
});
test('without a GitHub token the attachment is saved in a private Drive folder instead of being refused',()=>{
 const s=storageService();s.values.delete('CONTACT_GITHUB_TOKEN');
 const data=message({attachment:mediaFixtures[0]}),result=send(s,data);
 assert.equal(result.ok,true);assert.equal(result.attachmentSaved,true);assert.equal(s.github.uploads,0);
 assert.equal(s.drive.folders.get('Wrapline contact files').files.size,1);
 const row=s.sheets.get('Contacts').rows[1];assert.match(row[8],/^https:\/\/drive\.google\.com\/file\/d\//);
 assert.match(s.mails.at(-1).body,/drive\.google\.com/);assert.equal(s.mails.at(-1).attachments,undefined);
 assert.equal(send(s,data).attachmentSaved,true);assert.equal(s.drive.files.length,1,'a retry reuses the saved file');
});
test('up to five files totalling no more than 10 MB are saved together; a sixth file or an oversize total is refused',()=>{
 const s=storageService();s.values.delete('CONTACT_GITHUB_TOKEN');
 const five=mediaFixtures.slice(0,5).map((f,i)=>({...f,name:'shot'+i+'.'+f.name.split('.').pop()}));
 const ok=send(s,message({attachments:five}));assert.equal(ok.ok,true);assert.equal(ok.attachmentSaved,true);
 const row=s.sheets.get('Contacts').rows[1];assert.equal(String(row[8]).split('\n').length,5);assert.equal(row[11],five.reduce((n,f)=>n+f.size,0));
 const t=storageService();t.values.delete('CONTACT_GITHUB_TOKEN');
 assert.equal(send(t,message({attachments:[...five,...five.slice(0,1)]})).error,'attachment_invalid','six files');
 const big=bytes=>{const b=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),Buffer.alloc(bytes-8)]);return {name:'big.png',type:'image/png',size:b.length,base64:b.toString('base64')};};
 assert.equal(send(t,message({attachments:[big(6*1024*1024),{...big(5*1024*1024),name:'big2.png'}]})).error,'attachment_invalid','11 MB in total');
 assert.equal(send(t,message({attachments:[big(6*1024*1024),{...big(4*1024*1024),name:'big2.png'}]})).ok,true,'10 MB in total is fine');
});
test('files uploaded on attach are stored once, and the message accepts only receipts this service signed',()=>{
 const s=storageService();s.values.delete('CONTACT_GITHUB_TOKEN');
 const upload=(uploadId,file)=>JSON.parse(s.ctx.doPost({postData:{contents:JSON.stringify({type:'contact-upload',upload:{uploadId,file}})}}).text);
 const uploadId=randomUUID(),a=upload(uploadId,mediaFixtures[0]),b=upload(uploadId,{...mediaFixtures[1],name:'second.'+mediaFixtures[1].name.split('.').pop()});
 assert.equal(a.ok,true);assert.equal(b.ok,true);assert.match(a.file.url,/^https:\/\/drive\.google\.com\//);assert.equal(s.drive.files.length,2);
 assert.match([...s.drive.folders.get('Wrapline contact files').files.keys()][0],/^unsent-/);
 const result=send(s,message({uploadId,uploads:[a.file,b.file]}));
 assert.equal(result.ok,true);assert.equal(result.attachmentSaved,true);assert.equal(s.drive.files.length,2,'nothing is uploaded a second time');assert.ok(s.drive.files.every(f=>!/^unsent-/.test(f.name)),'sent files lose the unsent- prefix');
 const row=s.sheets.get('Contacts').rows[1];assert.equal(row[8].split('\n').length,2);assert.match(s.mails.at(-1).body,/second\./);
 assert.equal(send(s,message({uploadId,uploads:[{...a.file,url:'https://evil.example/x'}]})).error,'attachment_invalid');
 assert.equal(send(s,message({uploadId:randomUUID(),uploads:[a.file]})).error,'attachment_invalid');
 assert.equal(upload('short',mediaFixtures[0]).error,'invalid');
 assert.equal(upload(uploadId,{...mediaFixtures[0],base64:'AAAA',size:3}).error,'attachment_invalid');
});
test('a file removed or abandoned before sending is deleted again, and only with its signed receipt',()=>{
 const s=storageService();s.values.delete('CONTACT_GITHUB_TOKEN');
 const call=(type,upload)=>JSON.parse(s.ctx.doPost({postData:{contents:JSON.stringify({type,upload})}}).text);
 const uploadId=randomUUID(),a=call('contact-upload',{uploadId,file:mediaFixtures[0]});assert.equal(a.ok,true);
 const folder=()=>s.drive.folders.get('Wrapline contact files').files;assert.equal(folder().size,1);
 assert.equal(call('contact-upload-remove',{uploadId,file:{...a.file,token:'x'}}).ok,false,'bad receipt');assert.equal(folder().size,1);
 assert.equal(call('contact-upload-remove',{uploadId:randomUUID(),file:a.file}).ok,false,'wrong upload id');assert.equal(folder().size,1);
 assert.equal(call('contact-upload-remove',{uploadId,file:a.file}).ok,true);assert.equal(folder().size,0,'file is gone from the folder');
});
test('contact messages from the owner\'s test addresses are removed after 24 hours, with their Drive files; customers\' messages stay',()=>{
 const s=storageService();s.values.delete('CONTACT_GITHUB_TOKEN');
 const sheet=()=>s.sheets.get('Contacts');
 const send1=(email,name)=>send(s,message({email,name,attachments:[mediaFixtures[0]]}));
 assert.equal(send1('contactmy3dart@gmail.com','mine').ok,true);assert.equal(send1('ajoypal41@gmail.com','mine2').ok,true);assert.equal(send1('test@wrapline.in','mine3').ok,true);assert.equal(send1('real.customer@example.com','Real').ok,true);
 assert.equal(sheet().rows.length,5);const files=s.drive.folders.get('Wrapline contact files').files;assert.equal(files.size,4);
 s.ctx.cleanTestMessages_();assert.equal(sheet().rows.length,5,'nothing is removed while the messages are fresh');
 for(const r of sheet().rows.slice(1))r[0]=new Date(Date.now()-25*3600000);
 s.ctx.cleanTestMessages_();
 assert.deepEqual(sheet().rows.slice(1).map(r=>r[3]),['real.customer@example.com'],'only the three test addresses are cleaned');
 assert.equal(files.size,1,'their attachment files were binned, the customer\'s kept');
});
