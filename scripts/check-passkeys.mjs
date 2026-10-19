/* Native Chromium WebAuthn + the real pinned verifier + a private Sheets harness. No real emails/accounts. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {service} from '../tests/helpers/apps-service.mjs';
import {createPasskeyHandler} from '../supabase/functions/passkeys/handler.js';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const webauthn=await import(process.env.PASSKEY_SERVER_MODULE||'@simplewebauthn/server');
const base=new URL(process.argv[2]||'http://localhost:8798/'),app=service(),token=app.ctx.makeSession_('buyer@example.com');
const handler=createPasskeyHandler(webauthn,{origin:base.origin,rpID:base.hostname,env:key=>key==='SHEET_WEB_APP_URL'?'https://script.google.com/macros/s/TEST/exec':app.values.get(key),request:async(url,options)=>Response.json(JSON.parse(app.ctx.doPost({postData:{contents:options.body}}).text))});
const request=(path,body)=>handler(new Request('https://project.supabase.co/functions/v1/passkeys/'+path,{method:'POST',headers:{Origin:base.origin},body:JSON.stringify(body)}));
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),page=await context.newPage();
 await context.addInitScript(token=>{for(const key of ['parseCreationOptionsFromJSON','parseRequestOptionsFromJSON'])Object.defineProperty(PublicKeyCredential,key,{value:undefined,configurable:true});Object.defineProperty(PublicKeyCredential.prototype,'toJSON',{value:undefined,configurable:true});localStorage.setItem('ajoy.acct',JSON.stringify({token,email:'buyer@example.com',expiresAt:Date.now()+30*864e5,subscriptions:[]}));},token);
 let registration,authentication;
 const routeRequests=async route=>{
  const req=route.request(),url=req.url();if(new URL(url).origin===base.origin)return route.continue();
  if(url.includes('/functions/v1/passkeys/')){
   const path=url.split('/passkeys/')[1];if(path==='registration/verify')registration=JSON.parse(req.postData());if(path==='authentication/verify')authentication=JSON.parse(req.postData());
   const response=await handler(new Request(url,{method:req.method(),headers:req.headers(),...(req.postData()?{body:req.postData()}:{})}));
   return route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:await response.text()});
  }
  if(url.includes('script.google.com'))return route.fulfill({contentType:'application/json',body:app.ctx.doPost({postData:{contents:req.postData()}}).text});
  return route.abort();
 };
 await context.route('**/*',routeRequests);
 const cdp=await context.newCDPSession(page);await cdp.send('WebAuthn.enable');
 const {authenticatorId}=await cdp.send('WebAuthn.addVirtualAuthenticator',{options:{protocol:'ctap2',transport:'internal',hasResidentKey:true,hasUserVerification:true,isUserVerified:true,automaticPresenceSimulation:true}});
 await page.goto(base.href);await page.locator('[data-account-button]').click();
 await page.locator('[data-passkey-action]').waitFor();assert.equal(await page.locator('[data-passkey-action]').textContent(),'Add a passkey');
 await page.locator('[data-passkey-action]').click();await page.waitForFunction(()=>document.querySelector('.passkey-status')?.textContent.includes('Passkey added'));
 assert.equal(app.sheets.get('Passkeys').rows.length,2);assert.equal(app.mails.length,0);assert.equal(await page.locator('.passkey-row').count(),1);
 assert.equal((await request('registration/verify',registration)).status,409,'Registration challenges cannot be replayed');
 await page.getByRole('button',{name:'Rename Passkey 1'}).click();await page.getByLabel('Passkey name').fill('My laptop');await page.getByRole('button',{name:'Save name'}).click();await page.waitForFunction(()=>document.querySelector('.passkey-row b').textContent==='My laptop');
 await page.screenshot({path:'/tmp/passkey-account-mobile.png',animations:'disabled'});
 await page.locator('[data-out]').click();await page.locator('[data-passkey-action]').waitFor();assert.equal(await page.locator('[data-passkey-action]').textContent(),'Use a passkey');
 await page.locator('[data-passkey-action]').click();await page.locator('[data-out]').waitFor();
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('ajoy.acct')).email),'buyer@example.com');assert.equal(app.mails.length,0);
 assert.equal((await request('authentication/verify',authentication)).status,409,'Authentication challenges cannot be replayed');
 async function assertion(){
  const options=await (await request('authentication/options',{})).json();
  const credential=await page.evaluate(async options=>(await navigator.credentials.get({publicKey:PublicKeyCredential.parseRequestOptionsFromJSON(options)})).toJSON(),options.options);
  return {challengeId:options.challengeId,credential};
 }
 const mismatched=await assertion(),fresh=await (await request('authentication/options',{})).json();mismatched.challengeId=fresh.challengeId;assert.equal((await request('authentication/verify',mismatched)).status,400);
 const signature=await assertion();signature.credential.response.signature=Buffer.from('invalid signature').toString('base64url');assert.equal((await request('authentication/verify',signature)).status,400);
 const wrongAccount=await assertion();wrongAccount.credential.response.userHandle=Buffer.from('someone else').toString('base64url');assert.equal((await request('authentication/verify',wrongAccount)).status,400);
 const wrongOrigin=await assertion(),client=JSON.parse(Buffer.from(wrongOrigin.credential.response.clientDataJSON,'base64url'));client.origin='https://evil.test';wrongOrigin.credential.response.clientDataJSON=Buffer.from(JSON.stringify(client)).toString('base64url');assert.equal((await request('authentication/verify',wrongOrigin)).status,400);
 const wrongRP=await assertion(),authData=Buffer.from(wrongRP.credential.response.authenticatorData,'base64url');authData[0]^=255;wrongRP.credential.response.authenticatorData=authData.toString('base64url');assert.equal((await request('authentication/verify',wrongRP)).status,400);
 const noUV=await assertion(),flags=Buffer.from(noUV.credential.response.authenticatorData,'base64url');flags[32]&=~4;noUV.credential.response.authenticatorData=flags.toString('base64url');assert.equal((await request('authentication/verify',noUV)).status,400);
 const expired=await assertion(),challenge=JSON.parse(app.cache.get('passkey-challenge:'+expired.challengeId));challenge.expiresAt=Date.now()-1;app.cache.set('passkey-challenge:'+expired.challengeId,JSON.stringify(challenge));assert.equal((await request('authentication/verify',expired)).status,409);
 const removed=await assertion();
 await page.getByRole('button',{name:/Remove My laptop/}).click();await page.waitForFunction(()=>document.querySelectorAll('.passkey-row').length===0);
 assert.equal((await request('authentication/verify',removed)).status,404,'Revoked credentials cannot log in');
 // An old remembered session must reverify email before it can enroll a lasting credential.
 const body=Buffer.from('buyer@example.com|'+(Date.now()+30*86400000-11*60000)).toString('base64url'),old=body+'.'+app.ctx.sign_(body);
 const oldContext=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),op=await oldContext.newPage();
 await oldContext.addInitScript(token=>localStorage.setItem('ajoy.acct',JSON.stringify({token,email:'buyer@example.com',expiresAt:Date.now()+30*864e5,subscriptions:[]})),old);
 await oldContext.route('**/*',routeRequests);await op.goto(base.href);await op.locator('[data-account-button]').click();await op.locator('[data-passkey-action]').click();
 await op.locator('#acct-countdown').waitFor();assert.equal(app.mails.length,1,'Email is used once for enrollment reauthentication, never for passkey login');
 await op.locator('#acct-input').fill(app.mails.at(-1).subject.match(/\d{6}/)[0]);await op.locator('.acct-form [type=submit]').click();await op.locator('[data-out]').waitFor();
 assert.equal(await op.locator('[data-passkey-action]').textContent(),'Add a passkey');await oldContext.close();
 // A pre-passkey deployment must keep email sign-in working and never show dead passkey buttons.
 const fallback=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce'}),fp=await fallback.newPage();
 await fallback.route('**/*',route=>new URL(route.request().url()).origin===base.origin?route.continue():route.abort());
 await fp.goto(base.href);await fp.locator('[data-account-button]').click();assert(await fp.locator('.acct-form [type=submit]').isVisible());assert.equal(await fp.locator('[data-passkey-action]').count(),0);
 await fallback.close();await context.close();
 console.log('Passkeys passed with real WebAuthn signatures: enrollment, code-free login, no email sends, one-use/expired prompts, wrong signature/account/origin/RP/UV rejection, removal and email fallback.');
}finally{await browser.close();}
