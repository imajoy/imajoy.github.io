import test from 'node:test';
import assert from 'node:assert/strict';
import {service} from './helpers/apps-service.mjs';
const pay=(over={})=>({date:new Date(),email:'buyer@example.com',provider:'Razorpay',mode:'Live',plan:'online',billing:'monthly',seats:1,amount:899,currency:'INR',status:'Paid',paymentId:'pay_INV000000001',subscriptionId:'sub_X',source:'Webhook',...over});
const invoices=s=>s.mails.filter(m=>/invoice/i.test(m.subject));

test('a new subscription payment gets one invoice email, numbered, and is logged in the Invoices tab',()=>{
 const s=service();s.ctx.Logger={log(){}};
 assert.equal(s.ctx.paymentRecord_(pay()),true);
 const mails=invoices(s);assert.equal(mails.length,1);assert.equal(mails[0].to,'buyer@example.com');
 assert.match(mails[0].subject,/^Your Wrapline invoice WL-\d{6}-0001$/);
 assert.match(mails[0].htmlBody,/₹899\.00/);assert.match(mails[0].htmlBody,/Wrapline Basic · Monthly/);assert.match(mails[0].htmlBody,/pay_INV000000001/);
 assert.equal(s.sheets.get('Invoices').rows.length,2);
 s.ctx.paymentRecord_(pay());assert.equal(invoices(s).length,1,'same payment never invoiced twice');
 s.ctx.paymentRecord_(pay({paymentId:'pay_INV000000002'}));assert.match(invoices(s)[1].subject,/-0002$/,'renewals get the next number');
});

test('test payments are marked, seller details come from settings, and the buyer text is escaped',()=>{
 const s=service();s.values.set('INVOICE_SELLER_NAME','Ajoy Pal');s.values.set('INVOICE_SELLER_DETAILS','Kolkata, India|GSTIN 123');
 s.ctx.paymentRecord_(pay({mode:'Test',provider:'PayPal',currency:'USD',amount:19.5,plan:'offline',billing:'yearly',email:'a<b>@example.com'}));
 const m=invoices(s)[0];assert.match(m.subject,/^\[TEST\] /);assert.match(m.htmlBody,/Ajoy Pal/);assert.match(m.htmlBody,/GSTIN 123/);assert.match(m.htmlBody,/\$19\.50/);assert.match(m.htmlBody,/Premium · Yearly/);assert.equal(m.htmlBody.includes('<b>@'),false);
});

test('history imports, old payments, refunds and donations never send an invoice',()=>{
 const s=service();
 s.ctx.paymentRecord_(pay({source:'History import',paymentId:'pay_OLD000000001'}));
 s.ctx.paymentRecord_(pay({date:new Date(Date.now()-10*864e5),paymentId:'pay_OLD000000002'}));
 s.ctx.paymentRecord_(pay({status:'Refunded',paymentId:'pay_OLD000000003'}));
 s.paypalOrders.set('5O190127TN364715T',{id:'5O190127TN364715T',status:'COMPLETED',payer:{email_address:'giver@example.com'},purchase_units:[{custom_id:'coffee',payments:{captures:[{id:'CAP1',status:'COMPLETED',amount:{currency_code:'USD',value:'5.00'}}]}}]});
 s.ctx.doPost({postData:{contents:JSON.stringify({type:'donation',step:'paypal-verify',orderId:'5O190127TN364715T'})}});
 assert.equal(invoices(s).length,0);assert.equal(s.sheets.get('Invoices'),undefined);
});
