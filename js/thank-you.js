/* Confirmation page. Razorpay buyers arrive the moment Razorpay reports success; the server check finishes here, live. */
import {getAccountSession,accountRequest} from './account-session.js?v=20261023-p7';
import {orb} from './mood-orb.js?v=mo1';
import {buildInvoiceDoc,printDoc,invoicePeriod} from './ty-invoice.js?v=iv7';
import {readReceiptBilling,billingLines} from './receipt-billing.js?v=rb1';
import {mountSetupProgress} from './setup-progress.js?v=20261101-auto1';
let progress=null;
/* A real confirmation always arrives with details in the address. Opened bare, it would wrongly say "Payment confirmed", so send the visitor to the toolkit page instead. */
if(!location.search)location.replace('wrapline.html');
const q=new URLSearchParams(location.search),$=id=>document.getElementById(id),main=document.querySelector('.ty-main');
const plan=q.get('plan')==='offline'?'Premium':'Basic',billing=q.get('billing')==='yearly'?'Yearly':'Monthly';
let seats=parseInt(q.get('seats'),10);seats=seats>0&&seats<=100?seats:1;
const provider=q.get('provider')==='razorpay'?'Razorpay':q.get('provider')==='paypal'?'PayPal':'',trial=q.get('offer')==='trial';
$('ty-plan').textContent=plan+' plan';$('ty-billing').textContent=billing;$('ty-seats').textContent=seats+(seats===1?' license':' licenses');
if(provider)$('ty-provider').textContent=provider;else $('ty-provider').parentElement.hidden=true;
const eta=new Date(Date.now()+12*3600e3);
$('ty-eta').textContent=eta.toLocaleString(undefined,{weekday:'short',hour:'numeric',minute:'2-digit'});
const trialLead=()=>'Your 4-day Wrapline Pro trial is approved. Your first payment is taken after the trial unless you cancel.'+(provider==='Razorpay'?' The small payment-method check Razorpay took is refunded to you automatically.':'');
if(trial){
 $('ty-status').textContent='Free trial started';$('ty-step-pay').textContent='Trial approved';
 $('ty-lead').textContent=trialLead();
}
if(provider==='PayPal')$('ty-fine').innerHTML='Need help? <a href="contact.html">Contact support</a>. To stop automatic renewal, open <b>Account</b> on the Wrapline Pro page or cancel in your <a href="https://www.paypal.com/myaccount/autopay/" target="_blank" rel="noopener">PayPal account</a>.';
const originalSteps=Object.fromEntries(['ty-key','ty-step-key','ty-step-install','ty-step-start','ty-pass-note'].map(id=>[id,$(id).innerHTML]));
/* Basic needs no license key: it signs in with the email registered on this site. Premium keeps its key. */
function renderPlan(basic){
 for(const [id,html] of Object.entries(originalSteps))$(id).innerHTML=html;
 $('ty-key').classList.remove('ty-mail');$('ty-key').hidden=false;$('ty-eta-row').hidden=false;
 $('ty-step-key').dataset.step='current';$('ty-step-install').removeAttribute('data-step');$('ty-step-start').dataset.step='key';
 $('ty-key').setAttribute('aria-label','Your license key details');
 if(!basic){progress=mountSetupProgress(false);return;}

 const who=getAccountSession()?.email,keyBox=$('ty-key');
 if(who){keyBox.replaceChildren();const label=document.createElement('small'),mail=document.createElement('b');label.textContent='Sign in to Wrapline Pro with';mail.textContent=who;const row=document.createElement('div'),btn=document.createElement('button'),live=document.createElement('span');row.className='ty-mail-row';btn.type='button';btn.className='ty-copy';btn.setAttribute('aria-label','Copy email address');btn.textContent='Copy';live.className='ty-sr';live.setAttribute('role','status');
 let tm;const flash=ok=>{btn.textContent=ok?'Copied ✓':'Press Ctrl+C';btn.classList.toggle('is-ok',ok);live.textContent=ok?'Email copied':'Select and copy the email';clearTimeout(tm);tm=setTimeout(()=>{btn.textContent='Copy';btn.classList.remove('is-ok');live.textContent='';},2200);};
 btn.addEventListener('click',async()=>{let ok=false;try{await navigator.clipboard.writeText(who);ok=true;}catch{try{const r=document.createRange();r.selectNodeContents(mail);const sel=getSelection();sel.removeAllRanges();sel.addRange(r);ok=document.execCommand('copy');if(ok)sel.removeAllRanges();}catch{}}flash(ok);});
 row.append(mail,btn);keyBox.append(label,row,live);keyBox.classList.add('ty-mail');keyBox.setAttribute('aria-label','Your activation email');}
 else keyBox.hidden=true;
 $('ty-eta-row').hidden=true;$('ty-pass-note').textContent='No license key needed · sign in with your email';
 const keyStep=$('ty-step-key');keyStep.dataset.step='';keyStep.querySelector('b').textContent='Download the setup file';keyStep.querySelector('p').textContent='Use the Download setup button. No license key is needed for Basic.';
 const install=$('ty-step-install');install.dataset.step='current';install.querySelector('b').textContent='Install Wrapline Pro in Maya';install.querySelector('p').textContent='Drag the setup file into the Maya viewport and choose Basic.';
 const start=$('ty-step-start');start.removeAttribute('data-step');start.querySelector('b').textContent='Sign in with your registered email';start.querySelector('p').textContent='Enter the same email you used on this website. Wrapline Pro unlocks automatically while your plan is active.';
 progress=mountSetupProgress(true);
}
renderPlan(plan==='Basic');
try{sessionStorage.removeItem('ajoy.acct.open');}catch{}
/* Basic: tick every step as soon as Wrapline Pro is active in Maya with this email. Asked live from the
   server (only about the signed-in account), every few seconds while this page is open, so it turns green by itself. */
if(plan==='Basic'&&getAccountSession()?.token){
 const url=(window.AJOY_CONFIG?.commerceUrl||'').replace(/\/commerce\/?$/,'/maya-status');
 const install=$('ty-step-install'),start=$('ty-step-start');let tries=0;
 const mark=n=>{if(progress)return progress.complete('Detected in Maya: Wrapline Pro is active with your email on '+n+(n===1?' computer.':' computers.'));install.dataset.step='done';start.dataset.step='done';$('ty-pass-note').textContent='Active in Maya · signed in with your email';};
 const check=async()=>{
  if(document.hidden){setTimeout(check,4000);return;}
  try{
   const session=getAccountSession();if(!session?.token)return;
   const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({accountToken:session.token}),signal:AbortSignal.timeout(30000)});
   const data=await response.json().catch(()=>({}));
   if(data.ok&&data.installed)return mark(Number(data.computers)||1);
   if(response.status===401)return;
  }catch{}
  if(++tries<240)setTimeout(check,tries<10?6000:15000);
 };
 if(/^https:\/\//.test(url))check();
}

const state=(name,status,lead)=>{main.dataset.tyState=name;if(status)$('ty-status').textContent=status;if(lead)$('ty-lead').textContent=lead;};
/* The orb shows how the order is going: happy when confirmed, attentive while verifying, worried when delayed, sad on a problem. */
const MOODS={confirmed:'joy',verifying:'listen',delayed:'worry',problem:'sad'};
const orbBox=$('ty-orb');orbBox.innerHTML=orb('listen');
const syncOrb=()=>{const e=orbBox.firstElementChild;if(e)e.dataset.mood=MOODS[main.dataset.tyState]||'joy';};
new MutationObserver(syncOrb).observe(main,{attributes:true,attributeFilter:['data-ty-state']});
const archiveMode=q.has('history')||q.has('subscription');
if(!archiveMode)state('confirmed');
let archiveLoading=false;
function loadArchive(){
 if(archiveLoading)return;
 if(archiveMode)state('verifying','Checking your subscription','Loading your saved confirmation…');
 const session=getAccountSession(),archive=$('ty-archive'),retry=$('ty-invoice-retry');archive.hidden=false;
 $('ty-archive-note').textContent='Loading your invoices…';
 if(!session){
  state('problem','Sign in to continue','Open Wrapline Pro, choose Register / Login, then return to your account to view purchases and invoices.');
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
   const summary=document.createElement('summary'),title=document.createElement('b'),total=document.createElement('span'),when=document.createElement('small'),left=document.createElement('div'),chip=document.createElement('em');
   const zero=!(Number(inv.amount)>0);
   title.textContent='Invoice '+inv.number+(inv.mode==='Test'?' · TEST':'');total.textContent=new Intl.NumberFormat(undefined,{style:'currency',currency:/^[A-Z]{3}$/.test(inv.currency)?inv.currency:'USD'}).format(inv.amount);
   when.textContent=inv.date?new Date(inv.date).toLocaleDateString(undefined,{dateStyle:'medium'}):'';
   chip.textContent=zero?'No payment due':'Paid';chip.dataset.kind=zero?'free':'paid';
   left.append(title,when);summary.append(left,chip,total);details.append(summary);
   const cur2=/^[A-Z]{3}$/.test(inv.currency)?inv.currency:'USD',money2=v=>{try{return new Intl.NumberFormat(undefined,{style:'currency',currency:cur2}).format(v);}catch{return cur2+' '+Number(v).toFixed(2);}};
   const doc=buildInvoiceDoc({kind:'Invoice',number:inv.number,test:inv.mode==='Test',date:inv.date?new Date(inv.date).toLocaleDateString(undefined,{dateStyle:'long'}):'—',statusText:zero?'No payment due':'Paid',statusKind:zero?'free':'paid',email:session.email,provider:inv.provider,reference:inv.paymentId,orderId:(inv.orderId||'').split(' | ')[0],orderFull:(inv.orderId||'').split(' | ')[1]||'',billed:{name:inv.billedTo||'',lines:[inv.company,inv.address].filter(Boolean)},seller:inv.seller,title:'Wrapline Pro '+(inv.plan==='offline'?'Premium':'Basic'),sub:inv.billing==='yearly'?'Yearly':'Monthly',currency:cur2,period:invoicePeriod(inv.date,inv.billing),nextBilling:(()=>{const sub=data.subscriptions.find(x=>x.ref===inv.subscriptionId);return sub&&sub.renews&&Number.isFinite(Date.parse(sub.endsAt))?new Date(sub.endsAt).toLocaleDateString(undefined,{dateStyle:'medium'}):'';})(),seats:Number(inv.seats)||1,money:money2,total:Number(inv.amount)||0,totalLabel:zero?'Total due':'Total paid',note:zero?'No payment was due on this order. This invoice is your record of it.':''});
   const body=document.createElement('div');body.className='ty-invoice-body';
   const print=document.createElement('button');print.type='button';print.className='btn btn-light ty-print';print.textContent='Print or save as PDF';print.addEventListener('click',()=>{details.open=true;printDoc(doc);});
   body.append(doc,print);details.append(body);box.append(details);
  }
  if('IntersectionObserver' in window){const reveal=new IntersectionObserver(entries=>{if(entries[0].isIntersecting){archive.dataset.ready='true';reveal.disconnect();}},{threshold:.12});reveal.observe(archive);}else archive.dataset.ready='true';
  $('ty-archive-note').textContent=data.archivePending?'Online invoices are being connected. Your existing invoices remain in your verified email inbox.':data.invoices.length?'Invoices are also sent to your verified email after each payment.':(archiveMode?'No invoices here yet. Each paid or free order appears as soon as its invoice is issued.':'Payment received. Your invoice is being prepared and will appear here and in your email shortly. You don\'t need to do anything.');
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
  const clean=new URLSearchParams(q);clean.delete('verify');if(clean.get('checkout')){clean.set('order',clean.get('checkout'));clean.delete('checkout');}history.replaceState(null,'','?'+clean.toString());loadArchive();};
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

/* ---- mood + receipt (v2) ---------------------------------------------------------------------------------------------
   The page takes a colour mood from what was bought: basic = sapphire, premium = gold on obsidian, trial = emerald,
   free (nothing to pay today, e.g. a 100% coupon) = amethyst + gold. Every confirmed order shows a receipt, including
   orders that cost nothing, so there is always a record on screen as well as the invoice email. */
(()=>{
 const rawPaid=q.get('paid'),cur=/^[A-Z]{3}$/.test(q.get('cur')||'')?q.get('cur'):'INR',coupon=/^[A-Z0-9][A-Z0-9-]{2,31}$/.test(q.get('cp')||'')?q.get('cp'):'';
 const paidKnown=rawPaid!==null&&rawPaid!==''&&Number.isFinite(Number(rawPaid)),paid=paidKnown?Math.max(0,Number(rawPaid))/100:null;
 const free=paidKnown&&paid===0&&!trial;
 const kind=trial?'trial':free?'free':plan==='Premium'?'premium':'basic';
 main.dataset.tyKind=kind;document.body.dataset.tyKind=kind;
 const money=v=>{try{return new Intl.NumberFormat(undefined,{style:'currency',currency:cur}).format(v);}catch{return cur+' '+v.toFixed(2);}};
 const email=getAccountSession()?.email||'';
 const orderFull=(/^[-a-f0-9]{36}$/i.test(q.get('checkout')||'')?q.get('checkout'):/^[-a-f0-9]{36}$/i.test(q.get('order')||'')?q.get('order'):'').toLowerCase();
 const orderRef=orderFull.replace(/[^a-f0-9]/g,'').slice(0,8).toUpperCase();
 const billedTo=()=>{const b=readReceiptBilling();return b?{name:b.name,lines:billingLines({...b,company:b.company})}:null;};
 const slot=$('ty-receipt');
 /* Order ID box: the reference to quote if a payment ever needs to be traced. */
 const box=$('ty-order');
 if(orderRef){
  box.hidden=false;$('ty-order-id').textContent='ORD-'+orderRef;
  const mail=box.querySelector('a');mail.href='contact.html?topic=billing&ref='+encodeURIComponent('ORD-'+orderRef);
  const copy=box.querySelector('button');
  copy.addEventListener('click',async()=>{let ok=false;try{await navigator.clipboard.writeText('ORD-'+orderRef);ok=true;}catch{}copy.textContent=ok?'Copied ✓':'Select and copy';setTimeout(()=>{copy.textContent='Copy';},1800);});
 }
 const build=()=>{
  slot.replaceChildren();
  const doc=buildInvoiceDoc({kind:'Receipt',number:orderRef?'ORD-'+orderRef:'',orderId:orderRef?'ORD-'+orderRef:'',orderFull:orderFull,billed:billedTo(),date:new Date().toLocaleDateString(undefined,{dateStyle:'long'}),statusText:trial?'Trial active':free?'No payment due':'Paid',statusKind:(trial||free)?'free':'paid',email:getAccountSession()?.email||email,provider,reference:'',title:'Wrapline Pro '+plan,sub:trial?'4-day free trial, then '+billing.toLowerCase()+' billing':billing+' subscription',seats,money,total:paidKnown?paid:null,coupon,totalLabel:paidKnown?(paid===0?'Total due today':'Total paid'):'Total',note:paidKnown?(paid===0?'Nothing was due today. Your invoice is still emailed to you'+(email?' at '+email:'')+', and it is kept in your account.':'Your invoice is emailed to you'+(email?' at '+email:'')+' and kept in your account.'):'Your invoice is emailed to you'+(email?' at '+email:'')+' and kept in your account.'});
  const act=document.createElement('div');act.className='ty-doc-actions';const btn=document.createElement('button');btn.type='button';btn.className='btn btn-light';btn.textContent='Print or save as PDF';btn.addEventListener('click',()=>printDoc(doc));act.append(btn);
  slot.append(doc,act);
 };
 build();
 const sec=$('ty-receipt-sec'),sync=()=>{sec.hidden=main.dataset.tyState!=='confirmed'||archiveMode;};
 new MutationObserver(sync).observe(main,{attributes:true,attributeFilter:['data-ty-state']});sync();
})();

/* sections below the first screen ease in as they arrive (transform/opacity only; everything shows if IntersectionObserver is missing) */
(()=>{if(!('IntersectionObserver' in window)||matchMedia('(prefers-reduced-motion:reduce)').matches)return;
 const items=[...document.querySelectorAll('.ty-rv')];if(!items.length)return;
 const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('is-in');io.unobserve(e.target);}}),{rootMargin:'0px 0px -8% 0px',threshold:.04});
 items.forEach(i=>io.observe(i));requestAnimationFrame(()=>document.documentElement.classList.add('ty-rvon'));
})();

/* ---- joy layer: tools unlock one by one, a counter, a scroll bar, soft pointer glow ---------------------------------------- */
(()=>{
 const reduce=matchMedia('(prefers-reduced-motion:reduce)').matches;
 const tiles=[['IK',200],['AB',150],['AU',320],['FB',25],['HK',270],['PB',0],['RB',175],['RV',165],['RI',340],['DD',45]];
 const extra=[['IS',255],['MS',285],['UD',15],['LP',35]];
 const total=plan==='Premium'?14:10,list=tiles.concat(plan==='Premium'?extra:[]).slice(0,total),row=$('ty-unlock-row');
 list.forEach(([t,h],i)=>{const b=document.createElement('span');b.className='ty-tile';b.textContent=t;b.style.setProperty('--h',h);b.style.setProperty('--n',i);row.append(b);});
 let counted=false;
 const count=()=>{
  if(counted)return;counted=true;const node=$('ty-count');$('ty-unlock-text').textContent=total===14?'tools unlocked · Pro + free Wrapline':'tools unlocked';
  if(reduce){node.textContent=total;return;}
  const t0=performance.now()+900,dur=list.length*90+500;
  const step=n=>{const k=Math.min(1,Math.max(0,(n-t0)/dur));node.textContent=Math.round(total*k);if(k<1)requestAnimationFrame(step);};requestAnimationFrame(step);
 };
 const sync=()=>{const ok=main.dataset.tyState==='confirmed';row.closest('.ty-unlock').classList.toggle('is-open',ok);if(ok)count();else if(main.dataset.tyState==='problem')$('ty-unlock-text').textContent='tools on hold';};
 new MutationObserver(sync).observe(main,{attributes:true,attributeFilter:['data-ty-state']});sync();
 /* scroll progress line (one transform write per frame) */
 const bar=document.querySelector('.ty-scrollbar i');let tick=0;
 const upd=()=>{tick=0;const m=document.documentElement.scrollHeight-innerHeight;bar.style.transform='scaleX('+(m>0?Math.min(1,scrollY/m):0).toFixed(4)+')';};
 addEventListener('scroll',()=>{if(!tick)tick=requestAnimationFrame(upd);},{passive:true});upd();
 /* the timeline lights up step by step when it scrolls into view */
 const tl=document.querySelector('.ty-timeline');
 if(tl&&'IntersectionObserver' in window&&!reduce){const io=new IntersectionObserver(es=>{if(es[0].isIntersecting){tl.classList.add('is-in');io.disconnect();}},{threshold:.3});io.observe(tl);}else tl?.classList.add('is-in');
})();
