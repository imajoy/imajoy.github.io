import test from 'node:test';
import assert from 'node:assert/strict';
import {service} from './helpers/apps-service.mjs';
const pay=(over={})=>({date:new Date(),email:'buyer@example.com',provider:'Razorpay',mode:'Live',plan:'online',billing:'monthly',seats:1,amount:899,currency:'INR',status:'Paid',paymentId:'pay_INV000000001',subscriptionId:'sub_X',source:'Webhook',...over});
const invoices=s=>s.mails.filter(m=>/invoice/i.test(m.subject));

test('a new subscription payment gets one invoice email, numbered, and is logged in the Invoices tab',()=>{
 const s=service();s.ctx.Logger={log(){}};
 assert.equal(s.ctx.paymentRecord_(pay()),true);
 const mails=invoices(s);assert.equal(mails.length,1);assert.equal(mails[0].to,'buyer@example.com');
 assert.match(mails[0].subject,/^Your Wrapline Pro invoice WL-\d{6}-0001$/);
 assert.match(mails[0].htmlBody,/₹899\.00/);assert.match(mails[0].htmlBody,/Wrapline Pro Basic · Monthly/);assert.match(mails[0].htmlBody,/pay_INV000000001/);
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

test('invoice history belongs to the verified account and survives a closed confirmation page',()=>{
 const s=service();s.register('buyer@example.com');s.register('other@example.com');
 s.ctx.paymentRecord_(pay());
 const buyer=s.ctx.handleAccount_({step:'history',token:s.ctx.makeSession_('buyer@example.com')});
 assert.equal(buyer.ok,true);assert.equal(buyer.invoices.length,1);assert.match(buyer.invoices[0].number,/^WL-/);
 assert.equal(buyer.invoices[0].amount,899);
 assert.deepEqual(s.ctx.handleAccount_({step:'history',token:s.ctx.makeSession_('other@example.com')}).invoices,[]);
 assert.equal(s.ctx.handleAccount_({step:'history',token:'forged'}).error,'expired');
});

test('a free order (4-day trial or 100% coupon) still gets a numbered invoice marked payment done',()=>{
 const s=service();s.ctx.Logger={log(){}};
 const n=s.ctx.invoiceSendFree_({id:'chk-1',email:'buyer@example.com',mode:'live',subscriptionId:'sub_F',price:{plan:'online',billing:'monthly',seats:1,currency:'INR'}},'Coupon');
 assert.match(n,/^WL-\d{6}-0001$/);const m=invoices(s)[0];
 assert.match(m.htmlBody,/Total paid/);assert.match(m.htmlBody,/₹0\.00/);assert.match(m.htmlBody,/Payment done/);assert.match(m.htmlBody,/Coupon/);
 assert.equal(s.ctx.invoiceSendFree_({id:'chk-1',email:'buyer@example.com',mode:'live',price:{plan:'online',billing:'monthly',seats:1}}),'','never invoiced twice');
 const hist=s.ctx.invoiceArchive_?s.ctx.invoiceArchive_({email:'buyer@example.com'}):null;if(hist)assert.equal(hist.length>=1,true);
});

test('opening the invoice history creates missing invoices for older orders, silently, once',()=>{
 const s=service();s.register('buyer@example.com');s.ctx.Logger={log(){}};
 s.ctx.paymentRecord_(pay({source:'History import',paymentId:'pay_OLD000000009',amount:1499}));
 s.ctx.razorpayRows_=()=>[{id:'chk-old',email:'buyer@example.com',mode:'live',accepted:true,createdAt:Date.now()-5*864e5,subscriptionId:'sub_T',trial:{},price:{plan:'online',billing:'yearly',seats:3,currency:'INR',offer:'trial'}}];
 const token=s.ctx.makeSession_('buyer@example.com');
 const h=s.ctx.handleAccount_({step:'history',token});
 assert.equal(h.ok,true);assert.equal(h.invoices.length,2);
 assert.deepEqual(h.invoices.map(i=>i.amount).sort((a,b)=>a-b),[0,1499]);
 assert.equal(invoices(s).length,0,'catch-up invoices send no email');
 const again=s.ctx.handleAccount_({step:'history',token});assert.equal(again.invoices.length,2,'not duplicated');
 s.cache&&s.cache.clear&&s.cache.clear();
});

test('the invoice shows the billing name, address and Order ID, and the saved copy keeps them',()=>{
 const s=service();s.ctx.Logger={log(){}};s.register('buyer@example.com');
 const id='1f2e3d4c-aaaa-4bbb-8ccc-0123456789ab';
 const buyer=JSON.stringify({name:'Asha Rao',company:'Rao <Studio>',address:'12 Park Street',city:'Kolkata',region:'West Bengal',postal:'700016'});
 s.ctx.commerceRows_=()=>[[id,'sandbox','buyer@example.com','','','','','online','monthly',1,'','I-ORDER0000001','created','','','','yes','','IN',buyer]];
 s.ctx.paymentRecord_(pay({subscriptionId:'I-ORDER0000001',paymentId:'pay_ORD000000001'}));
 const html=invoices(s)[0].htmlBody;
 assert.match(html,/Asha Rao/);assert.match(html,/12 Park Street/);assert.match(html,/Kolkata, West Bengal 700016/);assert.match(html,/Rao &lt;Studio&gt;/);
 assert.match(html,/Order ID/);assert.match(html,/ORD-1F2E3D4C/);assert.match(html,new RegExp(id));
 const saved=s.ctx.handleAccount_({step:'history',token:s.ctx.makeSession_('buyer@example.com')}).invoices[0];
 assert.equal(saved.orderId,'ORD-1F2E3D4C | '+id);assert.equal(saved.billedTo,'Asha Rao');assert.equal(saved.address,'12 Park Street, Kolkata, West Bengal 700016');
});

test('"Needs attention" lists money taken with no order and old unfinished checkouts, never recent ones',()=>{
 const s=service();s.ctx.Logger={log(){}};
 const old=Date.now()-3600e3;
 s.ctx.commerceRows_=()=>[['aaaaaaaa-1111-4111-8111-111111111111','sandbox','x@example.com','','','','','online','monthly',1,'','I-ABANDONED001','created',new Date(old),'','','','','IN','{}'],['bbbbbbbb-2222-4222-8222-222222222222','sandbox','y@example.com','','','','','online','monthly',1,'','I-FRESH0000001','created',new Date(),'','','','','IN','{}']];
 s.ctx.paymentRecord_(pay({mode:'Test',email:'z@example.com',subscriptionId:'I-NOORDER00001',paymentId:'pay_NOORDER0001',source:'History import'}));
 const n=s.ctx.needsAttention();
 const rows=s.sheets.get('Needs attention').rows;
 const text=JSON.stringify(rows);
 assert.match(text,/Checkout not done/);assert.match(text,/ORD-AAAAAAAA/);assert.doesNotMatch(text,/ORD-BBBBBBBB/);
 assert.ok(n>=1);
});
