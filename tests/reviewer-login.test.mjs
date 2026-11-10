import test from 'node:test';
import assert from 'node:assert/strict';
import {service} from './helpers/apps-service.mjs';
const FIXED='482913';
test('Reviewer login is off unless both properties are set',()=>{
 const app=service({registered:false,strictEmail:true});
 assert.equal(app.call({step:'code',email:'test@wrapline.in',intent:'register'}).error,'email_domain');
 app.values.set('REVIEWER_EMAIL','test@wrapline.in');
 assert.equal(app.call({step:'code',email:'test@wrapline.in',intent:'register'}).error,'email_domain','email alone must not enable it');
});
test('Reviewer signs in with the fixed code, no email is sent, and no other address can use it',()=>{
 const app=service({registered:false,strictEmail:true});
 app.values.set('REVIEWER_EMAIL','test@wrapline.in');app.values.set('REVIEWER_CODE',FIXED);
 const sent=app.mails.length;
 assert.equal(app.call({step:'code',email:'test@wrapline.in',intent:'register'}).ok,true);
 assert.equal(app.mails.length,sent,'no code email for the reviewer');
 assert.equal(app.call({step:'verify',email:'test@wrapline.in',code:'111111'}).error,'code');
 const ok=app.call({step:'verify',email:'test@wrapline.in',code:FIXED});
 assert.equal(ok.ok,true);assert.ok(ok.token);
 // later sign-in works too
 assert.equal(app.call({step:'code',email:'test@wrapline.in'}).ok,true);
 assert.equal(app.call({step:'verify',email:'test@wrapline.in',code:FIXED}).ok,true);
 // another address cannot use the fixed code
 assert.equal(app.call({step:'code',email:'other@wrapline.in',intent:'register'}).error,'email_domain');
 app.call({step:'code',email:'someone@gmail.com',intent:'register'});
 assert.equal(app.call({step:'verify',email:'someone@gmail.com',code:FIXED}).ok,false);
});
test('Reviewer code is rate limited like any other',()=>{
 const app=service({registered:false,strictEmail:true});
 app.values.set('REVIEWER_EMAIL','test@wrapline.in');app.values.set('REVIEWER_CODE',FIXED);
 app.call({step:'code',email:'test@wrapline.in',intent:'register'});
 for(let i=0;i<5;i++)app.call({step:'verify',email:'test@wrapline.in',code:'000000'});
 assert.equal(app.call({step:'verify',email:'test@wrapline.in',code:FIXED}).error,'limit');
});
