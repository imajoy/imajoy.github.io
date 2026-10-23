import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {service} from './helpers/apps-service.mjs';
const call=(s,data)=>JSON.parse(s.ctx.doPost({postData:{contents:JSON.stringify({type:'donation',...data})}}).text);
const withRazorpay=s=>{for(const [k,v] of Object.entries({RAZORPAY_MODE:'test',RAZORPAY_KEY_ID:'rzp_test_fixture',RAZORPAY_KEY_SECRET:'private-razorpay-test-secret'}))s.values.set(k,v);return s;};
const sign=(order,pay)=>createHmac('sha256','private-razorpay-test-secret').update(order+'|'+pay).digest('hex');
const paid=(s,order,status='captured')=>{s.razorpay.payments.set('pay_TESTPAYMENT01',{id:'pay_TESTPAYMENT01',order_id:order.id,amount:order.amount,currency:'INR',status,email:'giver@example.com'});};
const paypalOrder=(over={})=>({id:'5O190127TN364715T',status:'COMPLETED',payer:{email_address:'giver@example.com',name:{given_name:'Asha'}},purchase_units:[{custom_id:'coffee',payments:{captures:[{id:'CAP123',status:'COMPLETED',amount:{currency_code:'USD',value:'5.00'}}]}}],...over});

test('config says whether rupee donations are ready and shows the limits',()=>{
 const s=service();
 assert.equal(call(s,{step:'config'}).inr,false);
 assert.equal(call(withRazorpay(service()),{step:'config'}).inr,true);
 assert.deepEqual(call(s,{step:'config'}).limits.USD,{min:1,max:2000});
 s.values.set('DONATIONS_ENABLED','false');assert.equal(call(s,{step:'config'}).error,'closed');
});

test('India: a rupee order is created for any allowed amount, with limits and no decimals beyond paise',()=>{
 const s=withRazorpay(service());
 const made=call(s,{step:'rzp-order',amount:149.5,name:'Asha'});
 assert.equal(made.ok,true);assert.equal(made.amount,14950);assert.equal(made.currency,'INR');assert.equal(made.keyId,'rzp_test_fixture');assert.match(made.orderId,/^order_/);
 assert.equal(s.razorpay.orders.get(made.orderId).notes.type,'donation');
 for(const amount of [0,19,150001,-5,'abc',10.123,null])assert.equal(call(s,{step:'rzp-order',amount}).error,'amount','rejects '+amount);
 assert.equal(call(service(),{step:'rzp-order',amount:100}).ok,false,'keys not set: not available');
});

test('India: a verified, captured payment is recorded once; a forged signature or someone else\'s order is refused',()=>{
 const s=withRazorpay(service());
 const order=call(s,{step:'rzp-order',amount:199,name:'Asha'}),raw=s.razorpay.orders.get(order.orderId);paid(s,raw);
 const good={step:'rzp-verify',orderId:order.orderId,paymentId:'pay_TESTPAYMENT01',signature:sign(order.orderId,'pay_TESTPAYMENT01'),name:'Asha',message:'Love the IK tool'};
 assert.equal(call(s,{...good,signature:'0'.repeat(64)}).error,'verify','forged signature');
 assert.equal(call(s,{...good,signature:'nothex'}).error,'verify');
 const done=call(s,good);assert.equal(done.ok,true);assert.equal(done.amount,199);assert.equal(done.currency,'INR');assert.equal(done.name,'Asha');
 const rows=s.sheets.get('Donations').rows;assert.equal(rows.length,2);assert.equal(rows[1][1],'Razorpay');assert.equal(rows[1][2],'Test');assert.equal(rows[1][3],199);assert.equal(rows[1][6],'Love the IK tool');
 assert.equal(s.mails.at(-1).to,'owner@example.com');assert.match(s.mails.at(-1).subject,/INR 199\.00 from Asha/);
 assert.equal(call(s,good).ok,true);assert.equal(s.sheets.get('Donations').rows.length,2,'asking twice never records twice');
 // a payment that belongs to a different order, or is not a donation order
 s.razorpay.payments.set('pay_OTHERPAYMENT1',{id:'pay_OTHERPAYMENT1',order_id:'order_other00001',amount:19900,currency:'INR',status:'captured'});
 assert.equal(call(s,{...good,paymentId:'pay_OTHERPAYMENT1',signature:sign(order.orderId,'pay_OTHERPAYMENT1')}).error,'verify');
});

test('India: an authorised payment is captured first; a failed one is not recorded',()=>{
 const s=withRazorpay(service());
 const order=call(s,{step:'rzp-order',amount:99}),raw=s.razorpay.orders.get(order.orderId);paid(s,raw,'authorized');
 const done=call(s,{step:'rzp-verify',orderId:order.orderId,paymentId:'pay_TESTPAYMENT01',signature:sign(order.orderId,'pay_TESTPAYMENT01')});
 assert.equal(done.ok,true);assert.equal(s.razorpay.payments.get('pay_TESTPAYMENT01').status,'captured');
 const failed=withRazorpay(service()),o2=call(failed,{step:'rzp-order',amount:99});paid(failed,failed.razorpay.orders.get(o2.orderId),'failed');
 assert.equal(call(failed,{step:'rzp-verify',orderId:o2.orderId,paymentId:'pay_TESTPAYMENT01',signature:sign(o2.orderId,'pay_TESTPAYMENT01')}).error,'verify');
 assert.equal(failed.sheets.get('Donations'),undefined,'nothing recorded');
});

test('Worldwide: a completed PayPal donation order in dollars is read back from PayPal and recorded',()=>{
 const s=service();s.paypalOrders.set('5O190127TN364715T',paypalOrder());
 const done=call(s,{step:'paypal-verify',orderId:'5O190127TN364715T',name:'',message:'=HYPERLINK("http://x","hi")'});
 assert.equal(done.ok,true);assert.equal(done.amount,5);assert.equal(done.currency,'USD');assert.equal(done.name,'Asha','falls back to the PayPal first name');
 const row=s.sheets.get('Donations').rows[1];assert.equal(row[1],'PayPal');assert.equal(row[2],'Test');assert.equal(row[7],'giver@example.com');assert.match(String(row[6]),/^'=/,'formulas are stored as plain text');
 assert.equal(call(s,{step:'paypal-verify',orderId:'5O190127TN364715T'}).ok,true);assert.equal(s.sheets.get('Donations').rows.length,2);
});

test('Worldwide: pending, wrong-currency, non-donation and unknown PayPal orders are refused',()=>{
 const s=service();
 s.paypalOrders.set('PENDINGORDER1',paypalOrder({id:'PENDINGORDER1',status:'APPROVED'}));
 s.paypalOrders.set('EURORDER12345',paypalOrder({id:'EURORDER12345',purchase_units:[{custom_id:'coffee',payments:{captures:[{id:'C2',status:'COMPLETED',amount:{currency_code:'EUR',value:'5.00'}}]}}]}));
 s.paypalOrders.set('PLAINORDER123',paypalOrder({id:'PLAINORDER123',purchase_units:[{payments:{captures:[{id:'C3',status:'COMPLETED',amount:{currency_code:'USD',value:'5.00'}}]}}]}));
 s.paypalOrders.set('HUGEORDER1234',paypalOrder({id:'HUGEORDER1234',purchase_units:[{custom_id:'coffee',payments:{captures:[{id:'C4',status:'COMPLETED',amount:{currency_code:'USD',value:'99999.00'}}]}}]}));
 for(const id of ['PENDINGORDER1','EURORDER12345','PLAINORDER123','HUGEORDER1234','NOSUCHORDER123','bad id!'])assert.equal(call(s,{step:'paypal-verify',orderId:id}).error,'verify',id);
 assert.equal(s.sheets.get('Donations'),undefined);
});

test('a name and message are trimmed and cleaned; the row is kept even if the email cannot be sent',()=>{
 const s=service({mailFails:true});s.paypalOrders.set('5O190127TN364715T',paypalOrder());
 const done=call(s,{step:'paypal-verify',orderId:'5O190127TN364715T',name:'  <b>Asha</b>  '.padEnd(80,'x'),message:'y'.repeat(400)});
 assert.equal(done.ok,true);assert.equal(done.name.includes('<'),false);assert.equal(done.name.length<=40,true);
 assert.equal(s.sheets.get('Donations').rows[1][6].length,200);
});

test('unknown steps and too many orders are handled',()=>{
 const s=withRazorpay(service());
 assert.equal(call(s,{step:'nope'}).error,'step');
 for(let i=0;i<60;i++)assert.equal(call(s,{step:'rzp-order',amount:99}).ok,true);
 assert.equal(call(s,{step:'rzp-order',amount:99}).error,'limit');
});
