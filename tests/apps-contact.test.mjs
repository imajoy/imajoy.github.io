import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {service} from './helpers/apps-service.mjs';
const message=(overrides={})=>({name:'A Maya artist',email:'artist@example.com',topic:'support',message:'I need help with a studio installation.',consent:true,requestId:randomUUID(),website:'',...overrides});
const send=(s,data)=>JSON.parse(s.ctx.doPost({postData:{contents:JSON.stringify({type:'contact',contact:data})}}).text);
test('contact route saves a private message and receipt without creating accounts or sending email',()=>{
 const s=service({registered:false}),data=message(),result=send(s,data);
 assert.equal(result.ok,true);assert.match(result.reference,/^AJ-/);
 const rows=s.sheets.get('Contacts').rows;assert.equal(rows.length,2);assert.equal(rows[1][3],data.email);assert.equal(rows[1][5],data.message);assert.equal(rows[1][7],true);
 assert.equal(s.sheets.has('Accounts'),false);assert.equal(s.sheets.has('Sheet1'),false);assert.equal(s.mails.length,0);assert.equal(s.requests.length,0);
 assert.deepEqual(send(s,data),result);assert.equal(rows.length,2,'Retry must not append another row.');
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
  assert.equal(s.sheets.has('Accounts'),false);assert.equal(s.mails.length,0);assert(!JSON.stringify(result).includes('private-test-upload-token'));assert.equal(send(s,data).attachmentSaved,true);assert.equal(s.github.uploads,1);
 }
});
test('a public repository, missing token, or unavailable GitHub cannot receive files or record partial messages',()=>{
 for(const configure of [s=>s.github.private=false,s=>s.values.delete('CONTACT_GITHUB_TOKEN'),s=>s.github.available=false]){
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
