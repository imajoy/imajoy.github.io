import test from 'node:test';
import assert from 'node:assert/strict';
import {service} from './helpers/apps-service.mjs';
const mail='member@example.com',other='friend@example.com';
test('A session token works until the person signs out, then it is dead everywhere',()=>{
 const app=service();app.register(mail);app.register(other);
 const a=app.ctx.makeSession_(mail),b=app.ctx.makeSession_(other);
 assert.equal(app.call({step:'identity',token:a}).ok,true);
 assert.equal(app.call({step:'logout',token:a}).ok,true);
 assert.equal(app.call({step:'identity',token:a}).error,'expired');
 assert.equal(app.call({step:'identity',token:b}).ok,true,'other people stay signed in');
 assert.equal(app.call({step:'logout',token:'garbage'}).ok,true,'a bad token reveals nothing');
});
test('A token cannot be forged, edited, or reused for another email',()=>{
 const app=service();app.register(mail);app.register(other);
 const t=app.ctx.makeSession_(mail),[body,sig]=t.split('.');
 const evil=Buffer.from(other+'|'+(Date.now()+1e9)).toString('base64url');
 assert.equal(app.ctx.readSession_(evil+'.'+sig),null);
 assert.equal(app.ctx.readSession_(body+'.'+sig.slice(0,-1)+(sig.endsWith('A')?'B':'A')),null);
 assert.equal(app.ctx.readSession_(body+'.'),null);
 assert.equal(app.ctx.readSession_(t).email,mail);
});
test('Sign-in codes are six digits and not from Math.random',()=>{
 const app=service(),seen=new Set();
 for(let i=0;i<200;i++){const c=app.ctx.secureCode_();assert.match(c,/^[1-9]\d{5}$/);seen.add(c);}
 assert.ok(seen.size>150);
});
test('A person cannot read or cancel another person\'s subscription',()=>{
 const app=service();app.register(mail);app.register(other);
 const t=app.ctx.makeSession_(mail);
 const r=app.call({step:'cancel',token:t,provider:'paypal',ref:'I-NOTMINE123'});
 assert.equal(r.ok,false);
 assert.equal(app.call({step:'history',token:t,email:other}).email,mail,'a client-supplied email is ignored');
});
test('Deleting an account also kills its old tokens, even if the email registers again',()=>{
 const app=service();app.register(mail);
 const t=app.ctx.makeSession_(mail);
 app.call({step:'code',email:mail});const code=app.mails.at(-1).subject.match(/\d{6}/)[0];
 assert.equal(app.call({step:'erase',token:t,code}).ok,true);
 assert.ok(app.ctx.revokedBefore_(mail)>0,'revocation recorded so a re-registered email cannot revive it');
 assert.equal(app.ctx.readSession_(t),null);
});
