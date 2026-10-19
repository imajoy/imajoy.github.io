import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {service} from './helpers/apps-service.mjs';
import {createPasskeyHandler} from '../supabase/functions/passkeys/handler.js';
const origin='https://imajoy.github.io';
function setup(){
 const app=service(),token=app.ctx.makeSession_('buyer@example.com');
 const rpc=(operation,data={})=>app.rpc('passkeys',{operation,...data});
 const context=rpc('context',{accountToken:token});
 const credential={id:'testcredential',publicKey:'YWJj',counter:0,userId:context.userId,transports:['internal'],aaguid:'00000000-0000-0000-0000-000000000000',deviceType:'multiDevice',backedUp:true};
 return {app,token,rpc,credential};
}
test('passkey enrollment and management require verified and recent full sessions',()=>{
 const s=setup();assert.equal(s.rpc('context',{accountToken:'forged'}).error,'signin_required');
 const body=Buffer.from('buyer@example.com|'+(Date.now()+30*86400000-11*60000)).toString('base64url'),old=body+'.'+s.app.ctx.sign_(body);
 assert.equal(s.rpc('list',{accountToken:old}).ok,true);assert.equal(s.rpc('context',{accountToken:old}).error,'reauth_required');
 assert.equal(s.rpc('save',{accountToken:old,credential:s.credential}).error,'reauth_required');
 assert.equal(s.rpc('save',{accountToken:s.token,credential:{...s.credential,userId:'another-account'}}).error,'invalid');
 assert.equal(s.rpc('save',{accountToken:s.token,credential:s.credential}).ok,true);
 assert.equal(s.rpc('save',{accountToken:s.token,credential:s.credential}).error,'duplicate');
 assert.equal(s.rpc('rename',{accountToken:s.token,credentialId:s.credential.id,name:'My laptop'}).ok,true);assert.equal(s.rpc('list',{accountToken:s.token}).credentials[0].name,'My laptop');
 assert.equal(s.rpc('rename',{accountToken:s.token,credentialId:s.credential.id,name:'bad\nlabel'}).error,'invalid');
 const other=s.app.register('other@example.com');
 assert.equal(s.rpc('remove',{accountToken:other.token,credentialId:s.credential.id}).error,'credential_missing');
 assert.equal(s.rpc('remove',{accountToken:s.token,credentialId:s.credential.id}).ok,true);
 assert.equal(s.rpc('credential',{credentialId:s.credential.id}).error,'credential_missing');
 assert.equal(s.rpc('list',{accountToken:s.token}).credentials.length,0);
});
test('passkey challenges are two-minute, one-use and bound to purpose and verified account',()=>{
 const s=setup(),id=randomUUID(),challenge='A'.repeat(43);
 assert.equal(s.rpc('challenge',{challengeId:id,kind:'register',challenge,accountToken:s.token}).ok,true);
 assert.equal(s.rpc('consume',{challengeId:id,kind:'authenticate'}).error,'challenge');
 assert.equal(s.rpc('consume',{challengeId:id,kind:'register',accountToken:s.token}).error,'challenge');
 const next=randomUUID();s.rpc('challenge',{challengeId:next,kind:'register',challenge,accountToken:s.token});
 const other=s.app.register('other@example.com');assert.equal(s.rpc('consume',{challengeId:next,kind:'register',accountToken:other.token}).error,'signin_required');
 const expired=randomUUID();s.rpc('challenge',{challengeId:expired,kind:'authenticate',challenge});
 const record=JSON.parse(s.app.cache.get('passkey-challenge:'+expired));record.expiresAt=Date.now()-1;s.app.cache.set('passkey-challenge:'+expired,JSON.stringify(record));
 assert.equal(s.rpc('consume',{challengeId:expired,kind:'authenticate'}).error,'challenge');
 const valid=randomUUID();s.rpc('challenge',{challengeId:valid,kind:'authenticate',challenge});assert.equal(s.rpc('consume',{challengeId:valid,kind:'authenticate'}).challenge,challenge);assert.equal(s.rpc('consume',{challengeId:valid,kind:'authenticate'}).ok,false);
});
test('private passkey login binds the stored account, enforces counter updates and checks revocation',()=>{
 const s=setup();s.rpc('save',{accountToken:s.token,credential:s.credential});
 const login=s.rpc('login',{credentialId:s.credential.id,previousCounter:0,newCounter:1,email:'attacker@example.com'});
 assert.equal(login.email,'buyer@example.com');assert(s.app.ctx.readSession_(login.token));
 assert.equal(s.rpc('login',{credentialId:s.credential.id,previousCounter:0,newCounter:1}).ok,false);
 assert.equal(s.rpc('login',{credentialId:s.credential.id,previousCounter:1,newCounter:1}).ok,false);
 s.rpc('remove',{accountToken:s.token,credentialId:s.credential.id});assert.equal(s.rpc('login',{credentialId:s.credential.id,previousCounter:1,newCounter:2}).ok,false);
 const forged=s.app.envelope({action:'passkeys',operation:'login',credentialId:s.credential.id,previousCounter:1,newCounter:2});forged.signature='forged';assert.equal(s.app.ctx.handleCommerceEnvelope_(forged).error,'signature');
});
test('passkey sign-in remains available when paid commerce is paused, but unknown emails cannot acquire sessions',()=>{
 const s=setup();s.app.values.set('COMMERCE_ENABLED','false');assert.equal(s.rpc('config').enabled,true);
 s.rpc('save',{accountToken:s.token,credential:s.credential});assert.equal(s.rpc('login',{credentialId:s.credential.id,previousCounter:0,newCounter:0}).ok,true);
 s.app.orders.rows.splice(1);assert.equal(s.rpc('credential',{credentialId:s.credential.id}).ok,false);
});
test('the five-passkey limit is enforced before enrollment and removal frees a slot',()=>{
 const s=setup();
 for(let i=0;i<5;i++)assert.equal(s.rpc('save',{accountToken:s.token,credential:{...s.credential,id:'credential'+i}}).ok,true);
 assert.equal(s.rpc('context',{accountToken:s.token}).error,'limit');
 assert.equal(s.rpc('save',{accountToken:s.token,credential:{...s.credential,id:'credential6'}}).error,'limit');
 s.rpc('remove',{accountToken:s.token,credentialId:'credential0'});
 assert.equal(s.rpc('context',{accountToken:s.token}).ok,true);
 assert.equal(s.rpc('save',{accountToken:s.token,credential:{...s.credential,id:'credential6'}}).ok,true);
});
test('passkey function rejects untrusted origins and never exposes credentials or signs browser-selected RPC actions',async()=>{
 const s=setup(),calls=[];
 const handler=createPasskeyHandler({}, {env:k=>k==='SHEET_WEB_APP_URL'?'https://script.google.com/macros/s/TEST/exec':s.app.values.get(k),request:async(url,options)=>{calls.push(url);return Response.json(JSON.parse(s.app.ctx.doPost({postData:{contents:options.body}}).text));}});
 const request=(path,body,requestOrigin=origin)=>new Request('https://project.supabase.co/functions/v1/passkeys/'+path,{method:body?'POST':'GET',headers:{Origin:requestOrigin},...(body?{body:JSON.stringify(body)}:{})});
 assert.equal((await handler(request('config',null,'https://evil.test'))).status,403);assert.equal(calls.length,0);
 assert.deepEqual(await (await handler(request('config'))).json(),{enabled:true,rpID:'imajoy.github.io'});
 assert.equal((await handler(request('registration/options',{}))).status,401);
 assert.equal((await handler(request('login',{action:'passkeys',operation:'login',credentialId:'testcredential'}))).status,404);
 const result=await handler(request('registration/verify',{accountToken:s.token,challengeId:randomUUID(),credential:{type:'public-key',id:'testcredential'}}));assert.equal(result.status,409);assert.equal(s.app.sheets.has('Passkeys'),false);
 assert.deepEqual(await (await createPasskeyHandler({}, {env:()=>undefined})(request('config'))).json(),{enabled:false});
});
