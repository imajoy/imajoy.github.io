/* Confirmation page. Razorpay buyers arrive the moment Razorpay reports success; the server check finishes here, live. */
import {getAccountSession} from './account-session.js?v=20261023-p7';
const q=new URLSearchParams(location.search),$=id=>document.getElementById(id),main=document.querySelector('.ty-main');
const plan=q.get('plan')==='offline'?'Premium':'Basic',billing=q.get('billing')==='yearly'?'Yearly':'Monthly';
let seats=parseInt(q.get('seats'),10);seats=seats>0&&seats<=100?seats:1;
const provider=q.get('provider')==='razorpay'?'Razorpay':q.get('provider')==='paypal'?'PayPal':'',trial=q.get('offer')==='trial';
$('ty-plan').textContent=plan+' plan';$('ty-billing').textContent=billing;$('ty-seats').textContent=seats+(seats===1?' license':' licenses');
if(provider)$('ty-provider').textContent=provider;else $('ty-provider').parentElement.hidden=true;
const eta=new Date(Date.now()+12*3600e3);
$('ty-eta').textContent=eta.toLocaleString(undefined,{weekday:'short',hour:'numeric',minute:'2-digit'});
const trialLead=()=>'Your 4-day Wrapline trial is approved. Your first payment is taken after the trial unless you cancel.'+(provider==='Razorpay'?' The small payment-method check Razorpay took is refunded to you automatically.':'');
if(trial){
 $('ty-status').textContent='Free trial started';$('ty-step-pay').textContent='Trial approved';
 $('ty-lead').textContent=trialLead();
}
if(provider==='PayPal')$('ty-fine').innerHTML='Need help? <a href="contact.html">Contact support</a>. To stop automatic renewal, open <b>Account</b> on the Wrapline page or cancel in your <a href="https://www.paypal.com/myaccount/autopay/" target="_blank" rel="noopener">PayPal account</a>.';
try{sessionStorage.removeItem('ajoy.acct.open');}catch{}

const state=(name,status,lead)=>{main.dataset.tyState=name;if(status)$('ty-status').textContent=status;if(lead)$('ty-lead').textContent=lead;};
const checkout=q.get('checkout'),url=window.AJOY_CONFIG?.razorpayUrl,session=getAccountSession();
if(provider==='Razorpay'&&q.get('verify')==='1'&&/^[-a-f0-9]{36}$/i.test(checkout||'')&&url&&session){
 state('verifying','Payment received · verifying with Razorpay','Razorpay has your payment. We are confirming it securely. This usually takes a few seconds; you can stay on this page.');
 $('ty-step-pay').textContent='Payment received · verifying';
 const started=Date.now();let done=false;
 const finish=()=>{if(done)return;done=true;state('confirmed',trial?'Free trial started':'Payment confirmed',trial?trialLead():'Your subscription is confirmed. A receipt is on its way to your verified email address.');$('ty-step-pay').textContent=trial?'Trial approved':'Payment confirmed';
  const clean=new URLSearchParams(q);clean.delete('verify');clean.delete('checkout');history.replaceState(null,'','?'+clean.toString());};
 const poll=async()=>{
  if(done)return;
  try{
   const response=await fetch(url+'/confirm',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({checkoutId:checkout,accountToken:session.token}),signal:AbortSignal.timeout(45000)});
   const data=await response.json().catch(()=>({}));
   if(data.ok&&data.accepted)return finish();
   if(data.ok&&['cancelled','expired','completed'].includes(data.status)){done=true;state('problem','Payment not completed','Razorpay reports that this checkout ended without a payment. No license will be issued. If money left your account, contact support with the time of payment.');$('ty-step-pay').textContent='Payment not completed';return;}
  }catch{}
  if(Date.now()-started>120000){done=true;state('delayed','Payment received · confirmation in progress','Your payment reached Razorpay. Final confirmation is taking longer than usual, so we will finish it in the background and email you. You don’t need to pay again.');return;}
  setTimeout(poll,2500);
 };
 poll();
}
