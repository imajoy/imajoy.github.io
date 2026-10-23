import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID,createHmac} from 'node:crypto';
import {service} from './helpers/apps-service.mjs';
const hash=n=>n.toString(16).padStart(64,'0');
const selection=(token,overrides={})=>({accountToken:token,plan:'online',billing:'monthly',seats:1,country:'US',billingCountry:'US',offer:'trial',deviceHash:hash(1),ipHash:hash(2),requestId:randomUUID(),...overrides});
function approved(app,token,options={},payer='PAYER-ONE'){
 const data=selection(token,options),created=app.rpc('checkout',data);assert.equal(created.ok,true,JSON.stringify(created));
 const subscription=app.subscriptions.get(created.subscriptionId);subscription.status='ACTIVE';subscription.subscriber.payer_id=payer;
 const confirmed=app.rpc('confirm',{accountToken:token,checkoutId:created.checkoutId});return {created,confirmed,data};
}
test('Private commerce rejects unsigned, altered, expired and replayed service envelopes',()=>{
 const app=service(),token=app.ctx.makeSession_('buyer@example.com');
 const packet=app.envelope({action:'eligibility',...selection(token)});
 assert.equal(app.ctx.handleCommerceEnvelope_({...packet,signature:'fake'}).error,'signature');
 assert.equal(app.ctx.handleCommerceEnvelope_(packet).ok,true);
 assert.equal(app.ctx.handleCommerceEnvelope_(packet).error,'signature');
 const expired=app.envelope({action:'download',accountToken:token});expired.timestamp=String(Date.now()-300000);
 assert.equal(app.ctx.handleCommerceEnvelope_(expired).ok,false);
});
test('Checkout and download require a verified registered account; client email is ignored',()=>{
 const app=service({registered:false});assert.equal(app.rpc('download',{accountToken:'forged'}).error,'signin_required');
 const account=app.register('new@example.com');assert.equal(app.rpc('download',{accountToken:account.token}).ok,true);
 const created=app.rpc('checkout',selection(account.token,{email:'other@example.com'}));assert.equal(created.ok,true);
 assert.equal(app.subscriptions.get(created.subscriptionId).subscriber.email_address,'new@example.com');
});
test('A trial consumes its email once and never turns a rejected trial into a paid subscription',()=>{
 const app=service(),token=app.ctx.makeSession_('buyer@example.com');const first=approved(app,token);assert.equal(first.confirmed.accepted,true);
 const count=app.subscriptions.size;
 assert.equal(app.rpc('checkout',selection(token,{deviceHash:hash(3),ipHash:hash(4)})).error,'trial_used');assert.equal(app.subscriptions.size,count);
 const paid=app.rpc('checkout',selection(token,{offer:'standard'}));assert.equal(paid.ok,true);assert.equal(paid.offer,'standard');
});
test('Browser or network reuse across different registered emails blocks another trial before PayPal creation',()=>{
 for(const signal of ['deviceHash','ipHash']){
  const app=service({registered:false}),one=app.register('one@example.com'),two=app.register('two@example.com');
  assert.equal(approved(app,one.token).confirmed.accepted,true);
  const other=selection(two.token,{deviceHash:hash(8),ipHash:hash(9)});other[signal]=signal==='deviceHash'?hash(1):hash(2);
  assert.equal(app.rpc('checkout',other).error,'trial_used');assert.equal(app.subscriptions.size,1);
 }
});
test('The same PayPal payer on a new email, browser and IP is cancelled and receives no trial access',()=>{
 const app=service({registered:false}),one=app.register('one@example.com'),two=app.register('two@example.com');
 assert.equal(approved(app,one.token).confirmed.accepted,true);
 const second=approved(app,two.token,{deviceHash:hash(5),ipHash:hash(6)},'PAYER-ONE');
 assert.equal(second.confirmed.error,'trial_used');assert.equal(app.subscriptions.get(second.created.subscriptionId).status,'CANCELLED');
 assert.equal(app.orders.rows.length,2,'only the approved trial is recorded as an order');
});
test('Trial reservations block competing accounts, and repeated create/confirm requests are idempotent',()=>{
 const app=service({registered:false}),one=app.register('one@example.com'),two=app.register('two@example.com');
 const data=selection(one.token),created=app.rpc('checkout',data);
 assert.equal(app.rpc('checkout',selection(two.token)).error,'trial_reserved');
 assert.equal(app.rpc('checkout',data).subscriptionId,created.subscriptionId);
 assert.equal(app.rpc('checkout',selection(one.token)).subscriptionId,created.subscriptionId,'same owner/browser resumes an existing reservation');
 assert.equal(app.subscriptions.size,1);
 app.subscriptions.get(created.subscriptionId).status='ACTIVE';
 assert.equal(app.rpc('confirm',{accountToken:one.token,checkoutId:created.checkoutId}).accepted,true);
 const mailCount=app.mails.length;assert.equal(app.rpc('confirm',{accountToken:one.token,checkoutId:created.checkoutId}).accepted,true);assert.equal(app.mails.length,mailCount);
});
test('Lost PayPal responses keep the reservation and retry with the same provider idempotency key',()=>{
 const app=service({registered:false}),account=app.register('retry@example.com'),data=selection(account.token),fetch=app.ctx.UrlFetchApp.fetch;let lost=true;
 app.ctx.UrlFetchApp.fetch=(url,options)=>{const result=fetch(url,options);if(lost&&url.endsWith('/v1/billing/subscriptions')){lost=false;throw Error('Network timeout after creation');}return result;};
 assert.equal(app.rpc('checkout',data).ok,false);assert.equal(app.subscriptions.size,1);
 assert.equal(app.rpc('checkout',data).ok,true);assert.equal(app.subscriptions.size,1);
});
test('Late approval after reservation expiry is cancelled without issuing access',()=>{
 const app=service({registered:false}),account=app.register('late@example.com'),created=app.rpc('checkout',selection(account.token));
 const row=app.sheets.get('Checkouts').rows.find(r=>r[0]===created.checkoutId);row[13]=new Date(Date.now()-3600000);app.subscriptions.get(created.subscriptionId).status='ACTIVE';
 assert.equal(app.rpc('confirm',{accountToken:account.token,checkoutId:created.checkoutId}).error,'trial_expired');assert.equal(app.subscriptions.get(created.subscriptionId).status,'CANCELLED');assert.equal(app.orders.rows.length,1);
});
test('Unknown network/browser signals cannot claim a trial and fake owner/subscription details cannot confirm',()=>{
 const app=service({registered:false}),one=app.register('one@example.com'),two=app.register('two@example.com');
 assert.equal(app.rpc('checkout',selection(one.token,{ipHash:''})).error,'network_unverified');
 assert.equal(app.rpc('checkout',selection(one.token,{deviceHash:''})).error,'browser_unverified');
 const created=app.rpc('checkout',selection(one.token));assert.equal(app.rpc('confirm',{accountToken:two.token,checkoutId:created.checkoutId}).error,'checkout');
 const subscription=app.subscriptions.get(created.subscriptionId);subscription.status='ACTIVE';subscription.custom_id='other-checkout';
 assert.equal(app.rpc('confirm',{accountToken:one.token,checkoutId:created.checkoutId}).error,'mismatch');assert.equal(app.orders.rows.length,1);
});
test('Signature-verified webhooks enforce trials without the browser, invalid signatures cannot grant access',()=>{
 const app=service({registered:false}),account=app.register('webhook@example.com'),created=app.rpc('checkout',selection(account.token));app.subscriptions.get(created.subscriptionId).status='ACTIVE';
 const body={headers:{},event:{id:'EVENT1',event_type:'BILLING.SUBSCRIPTION.ACTIVATED',resource:{id:created.subscriptionId}}};
 app.setSignature(false);assert.equal(app.rpc('webhook',body).error,'signature');assert.equal(app.orders.rows.length,1);
 app.setSignature(true);assert.equal(app.rpc('webhook',body).accepted,true);assert.equal(app.orders.rows.length,2);
 const count=app.mails.length;assert.equal(app.rpc('webhook',body).accepted,true);assert.equal(app.mails.length,count);
});
test('Cancellation and refunds never reset an already-used trial',()=>{
 const app=service({registered:false}),account=app.register('cancel@example.com'),first=approved(app,account.token);assert(first.confirmed.accepted);
 app.rpc('webhook',{headers:{},event:{event_type:'BILLING.SUBSCRIPTION.CANCELLED',resource:{id:first.created.subscriptionId,status:'CANCELLED'}}});
 assert.equal(app.rpc('checkout',selection(account.token,{deviceHash:hash(7),ipHash:hash(8)})).error,'trial_used');
});
test('Legacy trial imports keep PayPal payer history so changing email cannot reset the reward',()=>{
 const app=service();app.orders.rows[1][7]='online (4-day trial)';app.orders.rows[1][11]='P-high-TRIAL';app.ctx.backfillTrialHistory();
 const account=app.register('different@example.com');const second=approved(app,account.token,{deviceHash:hash(20),ipHash:hash(21)},'LEGACY-PAYER');
 assert.equal(second.confirmed.error,'trial_used');
});
test('A new trial created outside the server-managed checkout is cancelled by a verified webhook',()=>{
 const app=service({registered:false});const id='I-OUTSIDE123';
 app.subscriptions.set(id,{id,status:'ACTIVE',plan_id:'P-high-TRIAL',create_time:new Date().toISOString(),subscriber:{payer_id:'PAYER-OUTSIDE'}});
 assert.equal(app.rpc('webhook',{headers:{},event:{event_type:'BILLING.SUBSCRIPTION.ACTIVATED',resource:{id}}}).ok,true);
 assert.equal(app.subscriptions.get(id).status,'CANCELLED');assert.equal(app.orders.rows.length,1);
});
test('A consumed trial clearly says already claimed, including when network verification is unavailable',()=>{
 const app=service(),token=app.ctx.makeSession_('buyer@example.com');assert(approved(app,token).confirmed.accepted);
 const result=app.rpc('eligibility',selection(token,{ipHash:'',deviceHash:''}));
 assert.equal(result.reason,'trial_used');assert.equal(result.eligible,false);assert.match(result.message,/4-day trial already claimed/);
 const rejected=app.rpc('checkout',selection(token));assert.equal(rejected.error,'trial_used');assert.match(rejected.message,/4-day trial already claimed/);
 assert.equal(app.rpc('checkout',selection(token,{offer:'standard'})).ok,true);
});
test('An unfinished checkout and missing verification never claim that a trial was already used',()=>{
 const app=service({registered:false}),one=app.register('one@example.com'),two=app.register('two@example.com');
 const data=selection(one.token),created=app.rpc('checkout',data);assert(created.ok);
 const pending=app.rpc('eligibility',selection(two.token));assert.equal(pending.reason,'trial_reserved');assert(!pending.message.includes('already claimed'));
 assert.equal(app.rpc('eligibility',data).eligible,true,'owner can resume the same reservation');
 const row=app.sheets.get('Checkouts').rows.find(r=>r[0]===created.checkoutId);row[13]=new Date(Date.now()-3600000);
 assert.equal(app.rpc('eligibility',selection(two.token)).eligible,true);
 assert.equal(app.rpc('eligibility',selection(two.token,{ipHash:''})).reason,'network_unverified');
 assert.equal(app.rpc('eligibility',selection(two.token,{deviceHash:''})).reason,'browser_unverified');
});
test('Missing payer verification cancels a trial without falsely calling it already claimed',()=>{
 const app=service({registered:false}),one=app.register('payer@example.com');
 const result=approved(app,one.token,{},'');assert.equal(result.confirmed.error,'trial_unavailable');
 assert(!result.confirmed.message.includes('already claimed'));assert.equal(app.subscriptions.get(result.created.subscriptionId).status,'CANCELLED');
});
