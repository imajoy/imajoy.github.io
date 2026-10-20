import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {service} from './helpers/apps-service.mjs';
const selection=(app,extra={})=>({accountToken:app.ctx.makeSession_('buyer@example.com'),plan:'online',billing:'monthly',seats:1,country:'US',billingCountry:'US',offer:'standard',requestId:randomUUID(),...extra});
const receipt=(id,status='COMPLETED',value='22.44',time)=>({id,status,time,amount_with_breakdown:{gross_amount:{value,currency_code:'USD'}}});
function paidHistory(app,count){
 app.subscriptions.set('I-TESTBUYER1',{id:'I-TESTBUYER1',status:'ACTIVE',plan_id:app.orders.rows[1][11],create_time:'2026-01-01T00:00:00Z'});
 app.transactions.set('I-TESTBUYER1',{transactions:Array.from({length:count},(_,i)=>receipt('PAID-'+i,'COMPLETED','22.44',`2026-${String(i+1).padStart(2,'0')}-02T00:00:00Z`))});
}
function withTriggers(app){const triggers=[];app.ctx.Logger={log(){}};app.ctx.ScriptApp={getProjectTriggers:()=>triggers,newTrigger:name=>({timeBased:()=>({everyDays:()=>({atHour:()=>({create:()=>{triggers.push({getHandlerFunction:()=>name});}})})})})};return triggers;}
const payments=app=>app.sheets.get('Payments')?.rows.slice(1)||[];
const paypalCalls=app=>app.requests.filter(r=>/\/v1\/billing\/subscriptions\/I-/.test(r.url||r)).length;

test('History import fills the Payments tab once, switches rewards to it and installs one daily check',()=>{
 const app=service(),triggers=withTriggers(app);paidHistory(app,1);
 const before=app.rpc('rewards',selection(app));assert.equal(before.pricing.percent,5,'old method: 2nd monthly payment is 5% off');
 const note=app.ctx.buildPaymentHistory();assert.match(note,/1 PayPal and 0 Razorpay payment/);
 assert.equal(payments(app).length,1);const row=payments(app)[0];
 assert.deepEqual([row[1],row[2],row[3],row[4],row[5],row[7],row[8],row[9],row[10],row[12],row[13],row[14]],['buyer@example.com','PayPal','Test','Online','Monthly',22.44,'USD','Paid','Yes','PAID-0','I-TESTBUYER1','History import']);
 assert.equal(app.values.get('PAYMENT_LEDGER'),'on');assert.equal(triggers.length,1);
 app.ctx.buildPaymentHistory();assert.equal(payments(app).length,1,'running again adds nothing');assert.equal(triggers.length,1);
 const calls=paypalCalls(app);
 const after=app.rpc('rewards',selection(app));assert.equal(after.pricing.percent,5,'same reward from the Payments tab');
 assert.equal(paypalCalls(app),calls,'rewards no longer ask PayPal for old subscriptions');
});
test('A missing old PayPal subscription is skipped by the import instead of failing',()=>{
 const app=service();withTriggers(app);app.paypalMissing.add('I-TESTBUYER1');
 assert.match(app.ctx.buildPaymentHistory(),/0 PayPal .* 1 old subscription/);
 assert.equal(app.rpc('rewards',selection(app)).pricing.percent,0);
});
test('Signed PayPal sale notifications add a row once; refunds stop it counting but keep a used reward used',()=>{
 const app=service();withTriggers(app);paidHistory(app,0);app.ctx.buildPaymentHistory();
 const sale=(id,t)=>({headers:{},event:{id:'EV-'+id,event_type:'PAYMENT.SALE.COMPLETED',resource:{id,billing_agreement_id:'I-TESTBUYER1',state:'completed',create_time:t,amount:{total:'22.44',currency:'USD'}}}});
 app.rpc('webhook',sale('SALE-1','2026-09-02T00:00:00Z'));app.rpc('webhook',sale('SALE-1','2026-09-02T00:00:00Z'));
 assert.equal(payments(app).length,1,'duplicates are ignored');
 assert.equal(app.rpc('rewards',selection(app)).pricing.percent,5);
 app.rpc('webhook',{headers:{},event:{id:'EV-R',event_type:'PAYMENT.SALE.REFUNDED',resource:{id:'REFUND-1',sale_id:'SALE-1'}}});
 assert.equal(payments(app)[0][9],'Refunded');
 assert.equal(app.rpc('rewards',selection(app)).pricing.percent,0,'a refunded payment no longer counts');
});
test('Owner rows: a Manual payment counts, "Counts for rewards = No" is ignored, other emails never mix',()=>{
 const app=service();withTriggers(app);paidHistory(app,0);app.ctx.buildPaymentHistory();
 const sheet=app.ctx.paymentsSheet_();
 sheet.appendRow([new Date('2026-08-05'),'buyer@example.com','Manual','Test','Online','Monthly',1,22.44,'USD','Paid','No','','BANK-1','','Manual','Bank transfer']);
 assert.equal(app.rpc('rewards',selection(app)).pricing.percent,0);
 sheet.rows[sheet.rows.length-1][10]='Yes';
 sheet.appendRow([new Date('2026-08-05'),'someone@else.com','Manual','Test','Online','Monthly',1,22.44,'USD','Paid','Yes','','BANK-2','','Manual','']);
 assert.equal(app.rpc('rewards',selection(app)).pricing.percent,5);
 sheet.appendRow([new Date('2026-09-05'),'buyer@example.com','Manual','Test','Online','Monthly',1,22.44,'USD','Paid','Yes','2nd monthly 5%, 3rd monthly 5%','BANK-3','','Manual','']);
 assert.equal(app.rpc('rewards',selection(app)).pricing.percent,0,'both monthly rewards are already used');
});
test('Payments are written straight under the header even when the guide on the right makes the sheet taller',()=>{
 const app=service();withTriggers(app);paidHistory(app,2);
 const sheet=app.ctx.paymentsSheet_();for(let r=1;r<=12;r++){sheet.rows[r]=sheet.rows[r]||[];sheet.rows[r][17]='Guide line '+r;}
 app.ctx.buildPaymentHistory();
 assert.equal(sheet.rows[1][12],'PAID-0');assert.equal(sheet.rows[2][12],'PAID-1');assert.equal(sheet.rows[3][12]??'','');
 assert.equal(sheet.rows[1][17],'Guide line 1','the guide is untouched');
 assert.equal(app.rpc('rewards',selection(app)).pricing.percent,5,'3rd monthly payment');
});
