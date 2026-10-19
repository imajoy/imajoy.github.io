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
