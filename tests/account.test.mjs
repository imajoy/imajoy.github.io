import test from 'node:test';
import assert from 'node:assert/strict';
import {service} from './helpers/apps-service.mjs';
test('Unregistered email is rejected before a code is generated or sent',()=>{
 const app=service({registered:false});
 assert.deepEqual(app.call({step:'code',email:'new@example.com'}),{ok:false,error:'not_registered',registrationAvailable:true});
 assert.equal(app.mails.length,0);assert.equal(app.cache.has('code:new@example.com'),false);
});
test('Registered email -> emailed code -> signed session; code cannot be reused',()=>{
 const app=service();assert.deepEqual(app.call({step:'code',email:' BUYER@EXAMPLE.COM '}),{ok:true,registered:true,intent:'signin'});
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
 app.orders.rows.splice(1);assert.equal(app.call({step:'identity',token}).error,'not_registered');
});
test('A submitted subscription ID and email never grant a new account session',()=>{
 const app=service();
 for(const result of ['ok','duplicate']){
  const reply=app.ctx.orderReply_(result,{subscriptionId:'I-TESTBUYER1',email:'buyer@example.com'});
  assert.equal(reply.token,undefined);assert.equal(reply.requiresVerification,true);
 }
});
test('The legacy public order endpoint cannot bypass secure checkout',()=>{
 const app=service();let logged=false;app.ctx.handleOrder_=()=>{logged=true;return 'ok';};
 const result=JSON.parse(app.ctx.doPost({postData:{contents:JSON.stringify({type:'order',email:'forged@example.com',accountToken:app.ctx.makeSession_('buyer@example.com')})}}).text);
 assert.equal(result.r,'secure_checkout_required');assert.equal(logged,false);
});
test('Registration creates an account only after its own email code is verified',()=>{
 const app=service({registered:false});
 const sent=app.call({step:'code',email:'new@example.com',intent:'register'});assert.equal(sent.ok,true);
 assert.equal(app.sheets.has('Accounts'),false);assert.equal(app.call({step:'identity',token:'forged'}).ok,false);
 const code=app.mails[0].subject.match(/\d{6}/)[0];
 const verified=app.call({step:'verify',email:'new@example.com',code});assert.equal(verified.ok,true);
 assert.equal(app.sheets.get('Accounts').rows.length,2);
 assert.equal(app.call({step:'identity',token:verified.token}).email,'new@example.com');
 assert.deepEqual(app.call({step:'status',token:verified.token}).subscriptions,[]);
 assert.equal(app.call({step:'verify',email:'new@example.com',code}).ok,false);
});
