import test from 'node:test';
import assert from 'node:assert/strict';
import {service} from './helpers/apps-service.mjs';
const mail='leaver@example.com',other='keeper@example.com';
function setup(){
 const app=service();app.register(mail);app.register(other);
 const sheet=name=>{let s=app.ctx.SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);return s;};
 return {app,sheet};
}
const codeFor=(app,email)=>{app.call({step:'code',email});return app.mails.at(-1).subject.match(/\d{6}/)[0];};
test('Deleting an account needs a session and a fresh emailed code',()=>{
 const {app}=setup(),token=app.ctx.makeSession_(mail);
 assert.equal(app.call({step:'erase',token:'bad.token',code:'123456'}).error,'expired');
 assert.equal(app.call({step:'erase',token,code:'123456'}).error,'code_expired');
 codeFor(app,mail);
 assert.equal(app.call({step:'erase',token,code:'000000'}).error,'code');
});
test('Deletion removes the account and anonymizes ledger rows, but keeps other people and amounts',()=>{
 const {app}=setup(),token=app.ctx.makeSession_(mail),S=app.ctx.SpreadsheetApp.getActiveSpreadsheet();
 const orders=S.getSheetByName('Orders')||S.insertSheet('Orders');
 {orders.rows[0]=(['Time','Subscription ID','Status','Mode','Buyer email','Name','Country','Plan','Billing','Licenses','Company','Plan ID']);}
 orders.appendRow(['2026-01-01','I-OLDSUB1','CANCELLED','live',mail,'Real Name','IN','online monthly','monthly',1,'Acme Ltd','P-1']);
 orders.appendRow(['2026-01-02','I-OTHER','ACTIVE','live',other,'Other Person','US','online monthly','monthly',1,'','P-1']);
 const code=codeFor(app,mail),result=app.call({step:'erase',token,code});
 assert.equal(result.ok,true,JSON.stringify(result));
 const accounts=S.getSheetByName('Accounts').rows.map(r=>String(r[0]));
 assert(!accounts.includes(mail),'account row removed');assert(accounts.includes(other),'other account kept');
 const row=orders.rows.find(r=>r[1]==='I-OLDSUB1'),keep=orders.rows.find(r=>r[1]==='I-OTHER');
 assert(/^deleted-[a-z0-9]{8}$/.test(row[4]),'email anonymized: '+row[4]);
 assert.equal(row[5],'');assert.equal(row[10],'');assert.equal(row[0],'2026-01-01');assert.equal(row[6],'IN');
 assert.equal(keep[4],other);assert.equal(keep[5],'Other Person');
 assert.equal(app.call({step:'status',token}).error,'not_registered','old token no longer works');
 assert(/deleted/i.test(app.mails.at(-1).subject));
});
