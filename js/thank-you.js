/* Confirmation page. Razorpay buyers arrive the moment Razorpay reports success; the server check finishes here, live. */
import {getAccountSession,accountRequest} from './account-session.js?v=20261023-p7';
import {mountSetupProgress} from './setup-progress.js?v=20261025-setup1';
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
const originalSteps=Object.fromEntries(['ty-key','ty-step-key','ty-step-install','ty-step-start','ty-pass-note'].map(id=>[id,$(id).innerHTML]));
/* Basic needs no license key: it signs in with the email registered on this site. Premium keeps its key. */
function renderPlan(basic){
 for(const [id,html] of Object.entries(originalSteps))$(id).innerHTML=html;
 $('ty-key').classList.remove('ty-mail');$('ty-key').hidden=false;$('ty-eta-row').hidden=false;
 $('ty-step-key').dataset.step='current';$('ty-step-install').removeAttribute('data-step');$('ty-step-start').dataset.step='key';
 $('ty-key').setAttribute('aria-label','Your license key details');
 if(!basic){mountSetupProgress(false);return;}

 const who=getAccountSession()?.email,keyBox=$('ty-key');
 if(who){keyBox.replaceChildren();const label=document.createElement('small'),mail=document.createElement('b');label.textContent='Sign in to Wrapline with';mail.textContent=who;const row=document.createElement('div'),btn=document.createElement('button'),live=document.createElement('span');row.className='ty-mail-row';btn.type='button';btn.className='ty-copy';btn.setAttribute('aria-label','Copy email address');btn.textContent='Copy';live.className='ty-sr';live.setAttribute('role','status');
 let tm;const flash=ok=>{btn.textContent=ok?'Copied ✓':'Press Ctrl+C';btn.classList.toggle('is-ok',ok);live.textContent=ok?'Email copied':'Select and copy the email';clearTimeout(tm);tm=setTimeout(()=>{btn.textContent='Copy';btn.classList.remove('is-ok');live.textContent='';},2200);};
 btn.addEventListener('click',async()=>{let ok=false;try{await navigator.clipboard.writeText(who);ok=true;}catch{try{const r=document.createRange();r.selectNodeContents(mail);const sel=getSelection();sel.removeAllRanges();sel.addRange(r);ok=document.execCommand('copy');if(ok)sel.removeAllRanges();}catch{}}flash(ok);});
 row.append(mail,btn);keyBox.append(label,row,live);keyBox.classList.add('ty-mail');keyBox.setAttribute('aria-label','Your activation email');}
 else keyBox.hidden=true;
 $('ty-eta-row').hidden=true;$('ty-pass-note').textContent='No license key needed · sign in with your email';
 const keyStep=$('ty-step-key');keyStep.dataset.step='';keyStep.querySelector('b').textContent='Download the setup file';keyStep.querySelector('p').textContent='Use the Download setup button. No license key is needed for Basic.';
 const install=$('ty-step-install');install.dataset.step='current';install.querySelector('b').textContent='Install Wrapline in Maya';install.querySelector('p').textContent='Drag the setup file into the Maya viewport and choose Basic.';
 const start=$('ty-step-start');start.removeAttribute('data-step');start.querySelector('b').textContent='Sign in with your registered email';start.querySelector('p').textContent='Enter the same email you used on this website. Wrapline unlocks automatically while your plan is active.';
 mountSetupProgress(true);
}
renderPlan(plan==='Basic');
try{sessionStorage.removeItem('ajoy.acct.open');}catch{}

const state=(name,status,lead)=>{main.dataset.tyState=name;if(status)$('ty-status').textContent=status;if(lead)$('ty-lead').textContent=lead;};
const archiveMode=q.has('history')||q.has('subscription');
if(!archiveMode)state('confirmed');
let archiveLoading=false;
function loadArchive(){
 if(archiveLoading)return;
 if(archiveMode)state('verifying','Checking your subscription','Loading your saved confirmation…');
 const session=getAccountSession(),archive=$('ty-archive'),retry=$('ty-invoice-retry');archive.hidden=false;
 $('ty-archive-note').textContent='Loading your invoices…';
 if(!session){
  state('problem','Sign in to continue','Open Wrapline, choose Register / Login, then return to your account to view purchases and invoices.');
  document.querySelector('.ty-side').hidden=true;$('ty-invoices').replaceChildren();$('ty-archive-note').textContent='Your purchase history is available after sign-in.';
 return;
 }
 archiveLoading=true;retry.disabled=true;retry.textContent='Loading invoices…';
 accountRequest({step:'history',token:session.token},45000).then(async data=>{
  if(!data.ok&&['step','email'].includes(data.error)){const legacy=await accountRequest({step:'status',token:session.token},45000);data={...legacy,invoices:[],archivePending:true};}
  if(!data.ok||data.email!==session.email||!Array.isArray(data.subscriptions)||!Array.isArray(data.invoices))throw Error('history');
  const selected=(q.get('subscription')?data.subscriptions.find(s=>s.ref===q.get('subscription')):data.subscriptions.find(s=>Date.parse(s.endsAt)>Date.now()&&s.status!=='UNKNOWN'));
  const active=selected&&Number.isFinite(Date.parse(selected.endsAt))&&Date.parse(selected.endsAt)>Date.now()&&selected.status!=='UNKNOWN';
  if(active&&archiveMode){
   state('confirmed',selected.trial?'Free trial started':'Subscription confirmed','Welcome back. Your subscription is active through '+new Date(selected.endsAt).toLocaleDateString()+'.');
   renderPlan(selected.plan!=='offline');document.querySelector('.ty-side').hidden=false;
   if(selected.plan==='offline'){$('ty-step-key').querySelector('b').textContent='Your license key';$('ty-step-key').querySelector('p').textContent='Use the key sent to your verified email address.';}
   $('ty-plan').textContent=(selected.plan==='offline'?'Premium':'Basic')+' plan';$('ty-billing').textContent=selected.billing==='yearly'?'Yearly':'Monthly';
   $('ty-seats').textContent=selected.seats+(selected.seats===1?' license':' licenses');$('ty-provider').textContent=selected.provider==='razorpay'?'Razorpay':'PayPal';
   $('ty-provider').parentElement.hidden=false;
   $('ty-step-pay').textContent=selected.trial?'Trial approved':'Subscription confirmed';
   $('ty-eta-row').hidden=true;
   document.querySelector('.ty-timeline li:first-child p').textContent='Saved to your account';
  }else if(archiveMode){
   state('problem','Subscription unavailable','This subscription is no longer active or could not be verified. Your invoices are below.');
   document.querySelector('.ty-side').hidden=true;
  }
  const box=$('ty-invoices');box.replaceChildren();
  for(const inv of data.invoices){
   const details=document.createElement('details');details.className='ty-invoice';details.open=box.children.length===0;details.style.setProperty('--invoice-index',String(Math.min(box.children.length,5)));
   const summary=document.createElement('summary'),title=document.createElement('b'),total=document.createElement('span');
   title.textContent='Invoice '+inv.number+(inv.mode==='Test'?' · TEST':'');total.textContent=new Intl.NumberFormat(undefined,{style:'currency',currency:/^[A-Z]{3}$/.test(inv.currency)?inv.currency:'USD'}).format(inv.amount);
   summary.append(title,total);details.append(summary);
   const body=document.createElement('div');body.className='ty-invoice-body';
   for(const [label,value] of [['Seller',inv.seller||'Ajoy Tools'],['Date',inv.date?new Date(inv.date).toLocaleDateString(undefined,{dateStyle:'long'}):'—'],['Billed to',session.email],['Item',inv.plan],['Billing',inv.billing],['Licenses',String(inv.seats)],['Paid with',inv.provider],['Payment ID',inv.paymentId],['Total paid',total.textContent]]){
    const row=document.createElement('p'),name=document.createElement('span'),text=document.createElement('b');name.textContent=label;text.textContent=value;row.append(name,text);body.append(row);
   }
   const print=document.createElement('button');print.type='button';print.className='btn btn-light ty-print';print.textContent='Print invoice';print.addEventListener('click',()=>{details.open=true;details.classList.add('ty-print-target');window.addEventListener('afterprint',()=>details.classList.remove('ty-print-target'),{once:true});window.print();});
   body.append(print);details.append(body);box.append(details);
  }
  if('IntersectionObserver' in window){const reveal=new IntersectionObserver(entries=>{if(entries[0].isIntersecting){archive.dataset.ready='true';reveal.disconnect();}},{threshold:.12});reveal.observe(archive);}else archive.dataset.ready='true';
  $('ty-archive-note').textContent=data.archivePending?'Online invoices are being connected. Your existing invoices remain in your verified email inbox.':data.invoices.length?'Invoices are also sent to your verified email after each payment.':'No paid invoices yet. Trial payments appear here after they are collected.';
 }).catch(()=>{if(archiveMode)state('problem','Could not load subscription','Please retry or contact support.');$('ty-archive-note').textContent='Could not load invoices. Please try again. Your emailed copies remain in your inbox.';}).finally(()=>{archiveLoading=false;retry.disabled=false;retry.textContent='Refresh invoices';});
}
document.getElementById('ty-invoice-retry').addEventListener('click',loadArchive);
document.querySelector('.ty-history-link').hidden=!archiveMode&&!getAccountSession();
if((archiveMode||getAccountSession())&&q.get('verify')!=='1')loadArchive();
const checkout=q.get('checkout'),url=window.AJOY_CONFIG?.razorpayUrl,session=getAccountSession();
if(provider==='Razorpay'&&q.get('verify')==='1'&&/^[-a-f0-9]{36}$/i.test(checkout||'')&&url&&session){
 state('verifying','Payment received · verifying with Razorpay','Razorpay has your payment. We are confirming it securely. This usually takes a few seconds; you can stay on this page.');
 $('ty-step-pay').textContent='Payment received · verifying';
 const started=Date.now();let done=false;
 const finish=()=>{if(done)return;done=true;state('confirmed',trial?'Free trial started':'Payment confirmed',trial?trialLead():'Your subscription is confirmed. A receipt is on its way to your verified email address.');$('ty-step-pay').textContent=trial?'Trial approved':'Payment confirmed';
  const clean=new URLSearchParams(q);clean.delete('verify');clean.delete('checkout');history.replaceState(null,'','?'+clean.toString());loadArchive();};
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
/* gentle 3D tilt on the pass card (pointer devices only, off for reduced motion) */
(()=>{const card=document.querySelector('.ty-pass');if(!card||!matchMedia('(hover:hover)').matches||matchMedia('(prefers-reduced-motion:reduce)').matches)return;
 card.addEventListener('pointermove',e=>{const r=card.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;card.style.transform=`perspective(900px) rotateY(${x*6}deg) rotateX(${-y*6}deg)`;});
 card.addEventListener('pointerleave',()=>{card.style.transform='';});})();
