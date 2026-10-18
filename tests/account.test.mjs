import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';
import {createHmac,randomUUID} from 'node:crypto';
const source=readFileSync(new URL('../apps-script/Code.gs',import.meta.url),'utf8');
function service({registered=true,mailFails=false}={}){
 const values=new Map([['SESSION_SECRET','private-account-test-secret'],['PAYPAL_MODE','sandbox'],['PAYPAL_CLIENT_ID','test-client'],['PAYPAL_SECRET','test-secret']]);
 const cache=new Map(),mails=[],requests=[],lock={tryLock:()=>true,releaseLock:()=>{}};
 const rows=registered?[[new Date(),'I-TESTBUYER1','ACTIVE','sandbox','buyer@example.com','Buyer','US','online','monthly',1,'','P-TEST']]:[];
 const blob=value=>({getBytes:()=>[...Buffer.from(value)],getDataAsString:()=>Buffer.from(value).toString()});
 const ctx=createContext({console,PropertiesService:{getScriptProperties:()=>({getProperty:k=>values.get(k)||null,setProperty:(k,v)=>values.set(k,v)})},
  Utilities:{getUuid:randomUUID,base64Encode:value=>Buffer.from(value).toString('base64'),base64EncodeWebSafe:bytes=>Buffer.from(bytes).toString('base64url'),base64DecodeWebSafe:text=>[...Buffer.from(text,'base64url')],newBlob:blob,computeHmacSha256Signature:(text,key)=>[...createHmac('sha256',key).update(text).digest()]},
  LockService:{getScriptLock:()=>lock},CacheService:{getScriptCache:()=>({get:k=>cache.get(k)||null,put:(k,v)=>cache.set(k,v),remove:k=>cache.delete(k)})},
  SpreadsheetApp:{getActiveSpreadsheet:()=>({getSheetByName:name=>name==='Orders'?{getLastRow:()=>rows.length+1,getRange:()=>({getValues:()=>rows})}:null})},
  MailApp:{sendEmail:message=>{if(mailFails)throw Error('Mail service unavailable');mails.push(message);}},
  Session:{getEffectiveUser:()=>({getEmail:()=> 'owner@example.com'})},
  UrlFetchApp:{fetch:(url)=>{requests.push(url);return {getResponseCode:()=>200,getContentText:()=>JSON.stringify(url.endsWith('/token')?{access_token:'paypal-test-token'}:{status:'ACTIVE',billing_info:{next_billing_time:new Date(Date.now()+86400000*20).toISOString()}})};}},
  ContentService:{MimeType:{JSON:'json'},createTextOutput:()=>({setMimeType(){return this;},setContent(text){this.text=text;return this;}})}
 });
 runInContext(source,ctx);
 return {ctx,mails,requests,cache,rows,call:body=>JSON.parse(JSON.stringify(ctx.handleAccount_(body)))};
}
test('Unregistered email is rejected before a code is generated or sent',()=>{
 const app=service({registered:false});
 assert.deepEqual(app.call({step:'code',email:'new@example.com'}),{ok:false,error:'not_registered'});
 assert.equal(app.mails.length,0);assert.equal(app.cache.has('code:new@example.com'),false);
});
test('Registered email -> emailed code -> signed session; code cannot be reused',()=>{
 const app=service();assert.deepEqual(app.call({step:'code',email:' BUYER@EXAMPLE.COM '}),{ok:true,registered:true});
 const code=app.mails[0].subject.match(/\d{6}/)[0];
 assert.equal(app.call({step:'verify',email:'buyer@example.com',code:'000000'}).error,'code');
 const result=app.call({step:'verify',email:'buyer@example.com',code});
 assert.equal(result.ok,true);assert.equal(result.email,'buyer@example.com');assert.equal(result.subscriptions,null);assert(result.expiresAt>Date.now());
 assert.equal(app.requests.length,0,'code verification must not wait for PayPal');
 assert.equal(app.call({step:'verify',email:'buyer@example.com',code}).error,'code');
 const before=app.requests.length;
 assert.equal(app.call({step:'identity',token:result.token,email:'other@example.com'}).email,'buyer@example.com');
 assert.equal(app.requests.length,before,'identity restoration does not wait for PayPal');
 assert.equal(app.call({step:'status',token:result.token}).subscriptions.length,1);
});
test('Wrong codes are rate limited and malformed codes cannot bypass verification',()=>{
 const app=service();app.call({step:'code',email:'buyer@example.com'});
 for(let n=0;n<5;n++)assert.equal(app.call({step:'verify',email:'buyer@example.com',code:'000000'}).error,'code');
 assert.equal(app.call({step:'verify',email:'buyer@example.com',code:'000000'}).error,'limit');
});
test('Codes are tied to one email and an expired cached code cannot sign in',()=>{
 const app=service();app.call({step:'code',email:'buyer@example.com'});
 const code=app.mails[0].subject.match(/\d{6}/)[0];
 assert.equal(app.call({step:'verify',email:'other@example.com',code}).error,'code');
 app.cache.delete('code:buyer@example.com');
 assert.equal(app.call({step:'verify',email:'buyer@example.com',code}).error,'code');
});
test('Email delivery failure invalidates the unsent code and requests are rate limited',()=>{
 const app=service({mailFails:true});assert.equal(app.call({step:'code',email:'buyer@example.com'}).error,'mail');assert(!app.cache.has('code:buyer@example.com'));
 for(let n=0;n<4;n++)app.call({step:'code',email:'buyer@example.com'});
 assert.equal(app.call({step:'code',email:'buyer@example.com'}).error,'limit');
});
test('Expired, corrupt, altered tokens and deleted registrations fail identity checks',()=>{
 const app=service(),token=app.ctx.makeSession_('buyer@example.com');
 assert.equal(app.call({step:'identity',token:token+'x'}).error,'expired');
 assert.equal(app.call({step:'status',token:'not-a-token'}).error,'expired');
 const body=Buffer.from('buyer@example.com|1').toString('base64url'),expired=body+'.'+app.ctx.sign_(body);
 assert.equal(app.call({step:'identity',token:expired}).error,'expired');
 app.rows.length=0;assert.equal(app.call({step:'identity',token}).error,'not_registered');
});
test('A submitted subscription ID and email never grant a new account session',()=>{
 const app=service();
 for(const result of ['ok','duplicate']){
  const reply=app.ctx.orderReply_(result,{subscriptionId:'I-TESTBUYER1',email:'buyer@example.com'});
  assert.equal(reply.token,undefined);assert.equal(reply.requiresVerification,true);
 }
});
test('Signed-in order email is enforced on the server and an expired token blocks logging',()=>{
 const app=service(),token=app.ctx.makeSession_('buyer@example.com');let logged;
 app.ctx.handleOrder_=data=>{logged=data;return 'ok';};
 const post=body=>JSON.parse(app.ctx.doPost({postData:{contents:JSON.stringify(body)}}).text);
 const result=post({type:'order',email:'forged@example.com',accountToken:token,subscriptionId:'I-TESTBUYER1'});
 assert.equal(logged.email,'buyer@example.com');assert.equal(result.email,'buyer@example.com');assert.equal(result.token,token);
 logged=null;assert.equal(post({type:'order',email:'forged@example.com',accountToken:'expired'}).r,'account_expired');assert.equal(logged,null);
});
