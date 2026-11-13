/* Quick checkout for returning customers.
   If the account already has billing details saved, the long billing form is skipped: a small window shows the price,
   the payment method (a saved card, Razorpay or PayPal) and a Complete payment button. It reuses the real form behind it,
   so prices, coupons, country checks and the payment step all stay exactly the same. Card numbers are never seen here. */
import {getAccountSession,onAccountChange,openAccount} from './account-session.js?v=20261023-p7';
import {readBillingDraft,paymentStep} from './checkout-steps.js?v=20261113-cs4r1';
import {cachedProfile,loadProfile} from './profile-store.js?v=pm3';
const form=document.querySelector('#billing-form');
const params=new URLSearchParams(location.search);
const SKIP='ajoy.qc.skip',FLAG='ajoy.quickpay';
const $=(s,r=document)=>r.querySelector(s);
const el=(t,c,x)=>{const e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e;};
const calm=()=>matchMedia('(prefers-reduced-motion:reduce)').matches;
const svg=(d,c)=>{const s=document.createElementNS('http://www.w3.org/2000/svg','svg');s.setAttribute('viewBox','0 0 24 24');s.setAttribute('aria-hidden','true');if(c)s.setAttribute('class',c);const p=document.createElementNS('http://www.w3.org/2000/svg','path');p.setAttribute('d',d);s.append(p);return s;};
const ICON={card:'M3.5 7.5A2.5 2.5 0 0 1 6 5h12a2.5 2.5 0 0 1 2.5 2.5v9A2.5 2.5 0 0 1 18 19H6a2.5 2.5 0 0 1-2.5-2.5zM3.5 9.5h17M7 15h3',
  eye:'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 9.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6z',
  eyeOff:'M3 3l18 18M10.6 5.7A9.4 9.4 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a16 16 0 0 1-2.9 3.7M6.6 7.1A15.6 15.6 0 0 0 2.5 12S6 18.5 12 18.5c1.5 0 2.8-.4 4-.9M9.9 9.9a2.8 2.8 0 0 0 4.2 3.7',
  chev:'M6 9l6 6 6-6',wallet:'M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3M4 7.5V17a2 2 0 0 0 2 2h13a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1H6.5A2.5 2.5 0 0 1 4 7.5zM16 13.5h1.5',x:'M6 6l12 12M18 6 6 18'};

if(form&&!paymentStep&&!params.has('checkout')&&!params.has('edit')){
 let skipped=false;try{skipped=sessionStorage.getItem(SKIP)==='1';}catch{}
 if(!skipped)boot();
}

function boot(){
 const base=()=>window.AJOY_CONFIG?.razorpayUrl||'';
 let dlg=null,opened=false,netReady=false,cards=[],cardsDone=false,revealed=false,options=[],current=null,listOpen=false,busy=false;
 const brand=n=>({visa:'Visa',mastercard:'Mastercard',rupay:'RuPay',amex:'American Express','american express':'American Express',diners:'Diners Club',maestro:'Maestro'}[String(n||'').toLowerCase()]||'Card');
 const picker=()=>$('.payment-picker');
 const avail=p=>{const label=picker()?.querySelector('[value="'+p+'"]')?.parentElement;return !!label&&!label.hidden;};
 const profileOk=p=>!!p&&!!String(p.name||'').trim()&&!!String(p.address||'').trim()&&!!String(p.postal||'').trim();
 document.addEventListener('ajoy:billing-network',()=>{netReady=true;});

 async function fetchCards(){
  const s=getAccountSession();if(!s||!base()){cardsDone=true;return;}
  try{
   const r=await fetch(base()+'/cards',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({accountToken:s.token}),signal:AbortSignal.timeout(8000)});
   const j=await r.json().catch(()=>({}));if(r.ok&&j.ok&&Array.isArray(j.cards))cards=j.cards.slice(0,6);
  }catch{}
  cardsDone=true;
 }

 function buildOptions(){
  options=[];
  if(avail('razorpay')){
   for(const c of cards)options.push({id:'card:'+c.id,provider:'razorpay',kind:'card',name:brand(c.network),last4:String(c.last4||'').slice(-4),sub:[c.type==='credit'?'Credit card':c.type==='debit'?'Debit card':'',c.expYear?'Expires '+String(c.expMonth).padStart(2,'0')+'/'+String(c.expYear).slice(-2):''].filter(Boolean).join(' · ')});
   options.push({id:'razorpay',provider:'razorpay',kind:'razorpay',name:cards.length?'Another card, UPI or net banking':'Razorpay',sub:'Pay securely in the Razorpay window'});
  }
  if(avail('paypal'))options.push({id:'paypal',provider:'paypal',kind:'paypal',name:'PayPal',sub:'PayPal account or card, in USD'});
  if(!current||!options.some(o=>o.id===current.id))current=options[0]||null;
 }

 const mask=o=>o.kind==='card'?o.name+'  •••• '+(revealed?o.last4||'••••':'••••'):o.name;

 /* ---------- window ---------- */
 const R={};
 function build(){
  dlg=el('dialog','qp-dlg');dlg.id='qp-dlg';dlg.setAttribute('aria-labelledby','qp-title');
  const box=el('div','qp-box');
  const head=el('div','qp-head');const t=el('h2',null,'Complete your purchase');t.id='qp-title';
  const x=el('button','qp-x');x.type='button';x.setAttribute('aria-label','Close');x.append(svg(ICON.x));
  head.append(t,x);
  const sub=el('p','qp-sub','Review the details and proceed to checkout.');
  /* payment method */
  const lab=el('p','qp-lab','Payment method');lab.id='qp-lab';
  const sel=el('div','qp-select');
  const trig=el('div','qp-trigger');
  const main=el('button','qp-main');main.type='button';main.setAttribute('aria-haspopup','listbox');main.setAttribute('aria-expanded','false');main.setAttribute('aria-labelledby','qp-lab qp-name');
  const ico=el('span','qp-ico');ico.append(svg(ICON.card));
  const nm=el('span','qp-name');nm.id='qp-name';
  main.append(ico,nm);
  const eye=el('button','qp-eye');eye.type='button';
  const chev=el('button','qp-chev');chev.type='button';chev.tabIndex=-1;chev.setAttribute('aria-hidden','true');chev.append(svg(ICON.chev));
  trig.append(main,eye,chev);
  const list=el('ul','qp-list');list.setAttribute('role','listbox');list.setAttribute('aria-labelledby','qp-lab');list.hidden=true;
  sel.append(trig,list);
  /* summary */
  const sum=el('div','qp-sum');
  const l1=el('div','qp-line qp-plan');const l1a=el('div','qp-plan-t');const pn=el('b'),pm=el('small');l1a.append(pn,pm);const pa=el('span','qp-amt');l1.append(l1a,pa);
  const disc=el('div','qp-disc');
  const cp=el('div','qp-line qp-coupon');const cl=el('span',null,'Coupon code');const add=el('button','qp-link','Add');add.type='button';cp.append(cl,add);
  const cbox=el('div','qp-cbox');cbox.hidden=true;
  const cin=el('input');cin.type='text';cin.maxLength=32;cin.autocomplete='off';cin.autocapitalize='characters';cin.spellcheck=false;cin.placeholder='Enter code';cin.setAttribute('aria-label','Coupon code');
  const capply=el('button','qp-apply','Apply');capply.type='button';
  const cmsg=el('p','qp-cmsg');cmsg.setAttribute('role','status');cmsg.setAttribute('aria-live','polite');
  const crow=el('div','qp-crow');crow.append(cin,capply);cbox.append(crow,cmsg);
  const tot=el('div','qp-line qp-total');tot.append(el('span',null,'Total today'));const ta=el('b','qp-amt');tot.append(ta);
  const bill=el('p','qp-bill');const bt=el('span');const be=el('button','qp-link','Edit');be.type='button';bill.append(el('i',null,'Billed to'),bt,be);
  sum.append(l1,disc,cp,cbox,tot);
  const terms=el('p','qp-terms');terms.append('By checking out, you agree to our ');
  for(const [h,txt] of [['license.html','license terms'],['privacy.html','privacy notice']]){const a=el('a',null,txt);a.href=h;a.target='_blank';a.rel='noopener';terms.append(a,txt==='license terms'?' and ':'');}
  terms.append(' and understand this is a recurring subscription. You can cancel renewal at any time from your account.');
  const st=el('p','qp-status');st.setAttribute('role','status');st.setAttribute('aria-live','polite');
  const foot=el('div','qp-foot');const cancel=el('button','qp-cancel','Cancel');cancel.type='button';
  const go=el('button','qp-go','Complete payment');go.type='button';foot.append(cancel,go);
  box.append(head,sub,lab,sel,sum,bill,terms,st,foot);dlg.append(box);document.body.append(dlg);
  Object.assign(R,{x,main,nm,ico,eye,chev,list,pn,pm,pa,disc,add,cbox,cin,capply,cmsg,ta,bt,be,st,cancel,go,cp,trig});
  wire();
 }

 function paintMethod(){
  const o=current;
  R.nm.replaceChildren();
  if(!o){R.nm.textContent='No payment method available';R.eye.hidden=true;return;}
  R.nm.textContent=mask(o);
  R.ico.replaceChildren(svg(o.kind==='paypal'?ICON.wallet:ICON.card));
  R.eye.hidden=o.kind!=='card';
  R.eye.replaceChildren(svg(revealed?ICON.eye:ICON.eyeOff));R.eye.setAttribute('aria-label',revealed?'Hide card number':'Show last four digits');R.eye.setAttribute('aria-pressed',String(revealed));
 }
 function paintList(){
  R.list.replaceChildren();
  options.forEach((o,i)=>{
   const li=el('li','qp-opt');li.setAttribute('role','option');li.setAttribute('aria-selected',String(current?.id===o.id));li.tabIndex=-1;li.style.setProperty('--i',String(i));li.dataset.id=o.id;
   const ic=el('span','qp-ico');ic.append(svg(o.kind==='paypal'?ICON.wallet:ICON.card));
   const tx=el('span','qp-otx');tx.append(el('b',null,mask(o)));if(o.sub)tx.append(el('small',null,o.sub));
   li.append(ic,tx);
   li.addEventListener('click',()=>choose(o));
   R.list.append(li);
  });
  const other=el('li','qp-opt qp-other');other.setAttribute('role','option');other.tabIndex=-1;other.style.setProperty('--i',String(options.length));
  const ic=el('span','qp-ico');ic.append(svg(ICON.card));const otx=el('span','qp-otx');otx.append(el('b',null,'Choose a different payment method'));other.append(ic,otx);
  other.addEventListener('click',()=>leave('payment'));
  R.list.append(other);
 }
 function toggleList(force){
  listOpen=force===undefined?!listOpen:force;
  R.main.setAttribute('aria-expanded',String(listOpen));R.trig.dataset.open=String(listOpen);
  if(listOpen){paintList();R.list.hidden=false;requestAnimationFrame(()=>R.list.dataset.open='true');}
  else{R.list.dataset.open='false';const done=()=>{if(!listOpen)R.list.hidden=true;};calm()?done():setTimeout(done,200);}
 }
 function choose(o){
  current=o;paintMethod();toggleList(false);
  const radio=picker()?.querySelector('[value="'+o.provider+'"]');if(radio&&!radio.checked)radio.click();
 }

 /* ---------- mirror the real checkout summary ---------- */
 const txt=s=>($(s)?.textContent||'').trim();
 function mirror(){
  if(!dlg)return;
  const plan=txt('#summary-plan'),billing=txt('#summary-billing'),seats=txt('#summary-seats');
  R.pn.textContent='Wrapline Pro '+plan;R.pm.textContent=billing+' · '+seats+(seats==='1'?' license':' licenses');
  {const sub=txt('#summary-subtotal');R.pa.textContent=sub&&sub!=='—'?sub:txt('#summary-total');}
  R.disc.replaceChildren();
  for(const [row,val] of [['#annual-summary-row','#summary-annual'],['#loyalty-summary-row','#summary-loyalty'],['#coupon-summary-row','#summary-coupon']]){
   const r=$(row);if(!r||r.hidden)continue;
   const line=el('div','qp-line qp-dsc');line.append(el('span',null,(r.querySelector('dt')?.textContent||'Discount').replace(/\s+/g,' ').trim()),el('b','qp-amt',txt(val)));R.disc.append(line);
  }
  const total=$('#summary-total');R.ta.textContent=(total?.textContent||'—').trim();
  const ready=!!total&&total.dataset.moneyAmount!==undefined&&txt('#summary-total')!=='—';
  R.go.disabled=busy||!ready||!current;
  const cm=txt('#coupon-status');R.cmsg.textContent=/Enter your code|Sign in, then/.test(cm)?'':cm;R.cmsg.dataset.error=$('#coupon-status')?.dataset.error||'false';
  const applied=$('#coupon-remove')&&!$('#coupon-remove').hidden;
  R.add.textContent=applied?'Remove':'Add';R.cp.dataset.applied=String(!!applied);
  const p=cachedProfile();
  if(p)R.bt.textContent=[p.name,[p.city,p.region].filter(Boolean).join(', '),p.postal].filter(Boolean).join(' · ');
 }

 function wire(){
  R.main.onclick=R.chev.onclick=()=>toggleList();
  R.eye.onclick=()=>{revealed=!revealed;paintMethod();if(listOpen)paintList();};
  R.x.onclick=R.cancel.onclick=()=>leave('cancel');
  R.be.onclick=()=>leave('edit');
  dlg.addEventListener('cancel',e=>{e.preventDefault();if(listOpen)toggleList(false);else leave('cancel');});
  dlg.addEventListener('click',e=>{if(e.target===dlg)leave('cancel');if(listOpen&&!e.target.closest('.qp-select'))toggleList(false);});
  R.add.onclick=()=>{
   if($('#coupon-remove')&&!$('#coupon-remove').hidden){$('#coupon-remove').click();return;}
   R.cbox.hidden=!R.cbox.hidden;if(!R.cbox.hidden)R.cin.focus();
  };
  const apply=()=>{const code=R.cin.value.trim();if(!code)return;const real=$('#coupon-code');if(!real)return;real.value=code;real.dispatchEvent(new Event('input',{bubbles:true}));$('#coupon-apply')?.click();};
  R.capply.onclick=apply;R.cin.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();apply();}});
  R.go.onclick=complete;
  new MutationObserver(mirror).observe($('.checkout-side')||document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['hidden','data-money-amount']});
  document.addEventListener('ajoy:provider-change',()=>{buildOptions();paintMethod();});
 }

 function say(t,kind){R.st.textContent=t||'';R.st.dataset.kind=kind||'';}
 function complete(){
  if(busy)return;
  if(!getAccountSession()){close(()=>openAccount({purpose:'checkout'}));return;}
  if(!current){say('No payment method is available for your country right now.','error');return;}
  const E=form.elements;
  if(E.terms)E.terms.checked=true;
  if(!form.checkValidity()){leave('edit');setTimeout(()=>form.reportValidity(),60);return;}
  busy=true;R.go.disabled=true;R.go.dataset.busy='';R.go.textContent='Opening checkout…';say('');
  const radio=picker()?.querySelector('[value="'+current.provider+'"]');if(radio&&!radio.checked)radio.click();
  try{if(current.provider==='razorpay')sessionStorage.setItem(FLAG,JSON.stringify({email:getAccountSession().email,at:Date.now(),provider:'razorpay'}));}catch{}
  setTimeout(()=>{$('[data-continue-payment]')?.click();},60);
  /* If the page did not move on (for example the country needs confirming) bring the message back. */
  setTimeout(()=>{if(!document.body.contains(dlg)||!dlg.open)return;const m=txt('[data-payment-step-status]');busy=false;delete R.go.dataset.busy;R.go.textContent='Complete payment';say(m||'We could not continue. Check your details and try again.','error');mirror();try{sessionStorage.removeItem(FLAG);}catch{}},2200);
 }

 function close(after){
  if(!dlg||!dlg.open){after?.();return;}
  const done=()=>{dlg.classList.remove('qp-out');dlg.close();document.documentElement.classList.remove('qp-lock');after?.();};
  if(calm()){done();return;}
  dlg.classList.add('qp-out');let fired=false;const once=()=>{if(fired)return;fired=true;done();};
  dlg.addEventListener('animationend',e=>{if(e.target===dlg)once();},{once:true});setTimeout(once,420);
 }
 /* Leaving the quick window shows the normal checkout page, and it stays out of the way for this tab. */
 function leave(why){
  try{sessionStorage.setItem(SKIP,'1');}catch{}
  close(()=>{if(why==='edit'||why==='payment'){const t=why==='payment'?$('.payment-picker')||$('#availability'):$('.billing-entry');t?.scrollIntoView({behavior:calm()?'auto':'smooth',block:'center'});}});
 }

 function open(){
  if(opened)return;opened=true;
  build();buildOptions();paintMethod();mirror();
  document.documentElement.classList.add('qp-lock');
  dlg.showModal();R.go.focus({preventScroll:true});
 }

 /* ---------- when to show it ---------- */
 let tries=0;
 async function tryOpen(){
  if(opened)return true;
  const s=getAccountSession();if(!s||readBillingDraft())return false;
  let p=cachedProfile();if(p===undefined)p=await loadProfile().catch(()=>undefined);
  if(!profileOk(p)||!netReady||document.documentElement.dataset.billingBlocked==='true')return false;
  if(!avail('razorpay')&&!avail('paypal'))return false;
  if(!cardsDone){await fetchCards();}
  if(opened)return true;
  open();return true;
 }
 const timer=setInterval(async()=>{tries++;if(await tryOpen()||tries>40)clearInterval(timer);},400);
 onAccountChange(()=>{if(!getAccountSession()&&dlg?.open)close();});
}
