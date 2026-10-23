import test from 'node:test';
import assert from 'node:assert/strict';
import {service} from './helpers/apps-service.mjs';
test('Unregistered email is rejected before a code is generated or sent',()=>{
 const app=service({registered:false});
 assert.deepEqual(app.call({step:'code',email:'new@example.com'}),{ok:false,error:'not_registered',registrationAvailable:true});
 assert.equal(app.mails.length,0);assert.equal(app.cache.has('code:new@example.com'),false);
});
test('Registered email -> emailed code -> signed session; code cannot be reused',()=>{
 const app=service(),sent=app.call({step:'code',email:' BUYER@EXAMPLE.COM '});assert.equal(sent.ok,true);assert.equal(sent.registered,true);assert.equal(sent.intent,'signin');assert(sent.expiresIn>0&&sent.expiresIn<=120);
 const code=app.mails[0].subject.match(/\d{6}/)[0];
 assert.equal(app.call({step:'verify',email:'buyer@example.com',code:'000000'}).error,'code');
 const result=app.call({step:'verify',email:'buyer@example.com',code});
 assert.equal(result.ok,true);assert.equal(result.email,'buyer@example.com');assert.equal(result.subscriptions,null);assert(result.expiresAt>Date.now());
 assert.equal(app.requests.length,0,'code verification must not wait for PayPal');
 assert.equal(app.call({step:'verify',email:'buyer@example.com',code}).error,'code_expired');
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
 assert.equal(app.call({step:'verify',email:'other@example.com',code}).error,'code_expired');
 app.cache.delete('code:buyer@example.com');
 assert.equal(app.call({step:'verify',email:'buyer@example.com',code}).error,'code_expired');
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

test('unified email detection never creates a session before verifying either existing or new email',()=>{
 for(const [email,registered] of [['buyer@example.com',true],['new@example.com',false]]){
  const app=service(),sent=app.call({step:'code',email,intent:'auto'});
  assert.equal(sent.ok,true);assert.equal(sent.registered,registered);assert.equal(sent.intent,registered?'signin':'register');assert.equal(sent.token,undefined);assert(!app.sheets.has('Accounts'));
  const code=app.mails[0].subject.match(/\d{6}/)[0];assert.match(app.mails[0].body,/2 minutes/);
  assert.equal(app.call({step:'verify',email,code}).ok,true);
 }
});
test('the server enforces the two-minute deadline even if a cached code survives, and resending invalidates it',()=>{
 const app=service(),email='new@example.com',sent=app.call({step:'code',email,intent:'auto'}),old=app.mails[0].subject.match(/\d{6}/)[0];
 let time=sent.expiresAt;app.ctx.Date=class extends Date{static now(){return time;}};
 assert.equal(app.call({step:'verify',email,code:old}).error,'code_expired');assert(!app.sheets.has('Accounts'));
 const resent=app.call({step:'code',email,intent:'auto'});assert.equal(resent.expiresAt,time+120000);
 const current=app.mails.at(-1).subject.match(/\d{6}/)[0];
 if(current!==old)assert.equal(app.call({step:'verify',email,code:old}).error,'code');
 assert.equal(app.call({step:'verify',email,code:current}).ok,true);
});
test('Subscriber can cancel their own PayPal subscription; access continues to the paid date',()=>{
 const app=service(),token=app.ctx.makeSession_('buyer@example.com');
 const paidAt=new Date(Date.now()-5*864e5);
 app.subscriptions.set('I-TESTBUYER1',{id:'I-TESTBUYER1',status:'ACTIVE',plan_id:'P-high-ONLINE',start_time:paidAt.toISOString(),subscriber:{payer_id:'P1'},billing_info:{last_payment:{time:paidAt.toISOString(),amount:{value:'22.00'}},next_billing_time:new Date(Date.now()+25*864e5).toISOString()}});
 const before=app.call({step:'status',token}).subscriptions[0];
 assert.equal(before.ref,'I-TESTBUYER1');assert.equal(before.renews,true);assert.equal(before.provider,'paypal');
 assert.equal(app.call({step:'cancel',token,provider:'paypal',ref:'I-SOMEONEELSE1'}).ok,false,'cannot cancel another account');
 assert.equal(app.subscriptions.get('I-TESTBUYER1').status,'ACTIVE');
 assert.equal(app.call({step:'cancel',token:'bad-token',provider:'paypal',ref:'I-TESTBUYER1'}).error,'expired');
 const result=app.call({step:'cancel',token,provider:'paypal',ref:'I-TESTBUYER1'});
 assert.equal(result.ok,true);assert.equal(app.subscriptions.get('I-TESTBUYER1').status,'CANCELLED');
 const after=app.call({step:'status',token}).subscriptions[0];
 assert.equal(after.renews,false);assert.equal(after.status,'CANCELLED');
 const daysLeft=(Date.parse(after.endsAt)-Date.now())/864e5;assert(daysLeft>20&&daysLeft<32,'access runs to the end of the paid month');
 assert(app.mails.some(m=>/Subscription cancelled/.test(m.subject)));
});
test('A cancelled free trial keeps access only until the trial would have ended',()=>{
 const app=service(),token=app.ctx.makeSession_('buyer@example.com');
 app.orders.rows[1][7]='online trial';
 const started=new Date(Date.now()-864e5);
 app.subscriptions.set('I-TESTBUYER1',{id:'I-TESTBUYER1',status:'ACTIVE',plan_id:'P-high-ONLINE',start_time:started.toISOString(),subscriber:{payer_id:'P1'},billing_info:{next_billing_time:new Date(started.getTime()+4*864e5).toISOString()}});
 assert.equal(app.call({step:'cancel',token,provider:'paypal',ref:'I-TESTBUYER1'}).ok,true);
 const after=app.call({step:'status',token}).subscriptions[0];
 assert.equal(after.trial,true);assert.equal(after.renews,false);
 assert(Math.abs(Date.parse(after.endsAt)-(started.getTime()+4*864e5))<1000);
});
