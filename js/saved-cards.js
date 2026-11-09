/* Payment methods: saved cards and the "Add payment method" window.
   Card details are only ever typed into Razorpay's own window. This page just asks the server for a Rs 1 card check, opens Razorpay,
   then shows the safe facts Razorpay returns (card type, last 4 digits, expiry). The Rs 1 is refunded by the server straight away. */
import {getAccountSession,clearAccountSession,onAccountChange} from './account-session.js?v=20261023-p7';
import {confirmLeave} from './confirm-leave.js?v=cl2';
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const list=$('#sc-list');if(!list)throw new Error('no saved-cards panel');
const count=$('#sc-count'),msg=$('#sc-msg'),dlg=$('#sc-dlg'),dmsg=$('#sc-dmsg'),go=$('#sc-go'),addBtn=$('#sc-add');
const base=()=>window.AJOY_CONFIG?.razorpayUrl||'';
const calm=()=>matchMedia('(prefers-reduced-motion:reduce)').matches;
let cards=null,unavailable=false;
function say(node,text,kind){node.textContent=text||'';node.dataset.kind=kind||'';}
async function call(path,body={}){
  const s=getAccountSession();if(!s)throw Object.assign(new Error('Sign in to manage your cards.'),{code:'signin'});
  if(!base())throw Object.assign(new Error('Saved cards are not available right now.'),{code:'off'});
  let r;try{r=await fetch(base()+'/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,accountToken:s.token}),signal:AbortSignal.timeout(30000)});}
  catch{throw Object.assign(new Error('Could not reach the payment service. Please try again.'),{code:'net'});}
  const j=await r.json().catch(()=>({}));
  if(!r.ok||!j.ok){if(j.error==='signin_required'){clearAccountSession();throw Object.assign(new Error('Your session expired. Sign in again.'),{code:'signin'});}
    throw Object.assign(new Error(r.status===503?'Saved cards are not available yet.':j.message||'Something went wrong. Please try again.'),{code:r.status===503?'off':'err'});}
  return j;
}
const brandName=n=>({visa:'Visa',mastercard:'Mastercard',rupay:'RuPay',amex:'American Express','american express':'American Express',diners:'Diners Club',maestro:'Maestro'}[String(n||'').toLowerCase()]||String(n||'Card'));
const el=(t,c,x)=>{const e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e;};
function paint(){
  list.replaceChildren();
  if(unavailable){count.textContent='Saved cards are not available yet.';addBtn.disabled=true;list.append(el('p','sc-empty','Card saving will appear here once payments are fully connected.'));return;}
  addBtn.disabled=false;
  if(!getAccountSession()){count.textContent='Sign in to see your saved cards.';return;}
  if(cards===null){count.textContent='Checking your saved cards…';return;}
  count.replaceChildren();const n=cards.length;
  count.append('You have ',el('b',null,String(n)),' saved '+(n===1?'card':'cards'));
  if(!n){list.append(el('p','sc-empty','No saved cards yet. Press Add payment method to add one.'));return;}
  cards.forEach((c,i)=>{
    const row=el('div','sc-row');row.style.setProperty('--i',String(Math.min(i,6)));
    const badge=el('span','sc-badge',({Visa:'VISA',Mastercard:'MC',RuPay:'RUPAY','American Express':'AMEX','Diners Club':'DINERS',Maestro:'MAES'})[brandName(c.network)]||'CARD');badge.setAttribute('aria-hidden','true');
    const info=el('div','sc-info'),top=el('b',null,brandName(c.network)+'  •••• •••• •••• '+(c.last4||'••••'));
    const meta=[c.type==='credit'?'Credit card':c.type==='debit'?'Debit card':'Card',c.expYear?'Expires '+c.expYear+'-'+String(c.expMonth).padStart(2,'0'):''].filter(Boolean).join(' · ');
    info.append(top,el('small',null,meta));
    const rm=el('button','sc-rm');rm.type='button';rm.setAttribute('aria-label','Remove card ending '+c.last4);rm.title='Remove card';
    rm.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 7V5h4v2m-6 0 .7 11h6.6L16 7"/></svg>';
    rm.addEventListener('click',()=>remove(c,row,rm));
    row.append(badge,info,rm);list.append(row);
  });
}
async function refresh(){
  if(!getAccountSession()){cards=null;paint();return;}
  try{const r=await call('cards');cards=r.cards||[];unavailable=false;}
  catch(e){if(e.code==='off'){unavailable=true;}else if(e.code!=='signin'){say(msg,e.message,'error');cards=cards||[];}}
  paint();
}
async function remove(c,row,btn){
  if(!(await confirmLeave('card')))return;
  btn.disabled=true;row.dataset.busy='';say(msg,'Removing…');
  try{const r=await call('card-remove',{tokenId:c.id});cards=r.cards||[];say(msg,'Card removed.','ok');setTimeout(()=>{if(msg.textContent==='Card removed.')say(msg,'');},2600);paint();}
  catch(e){say(msg,e.message,'error');btn.disabled=false;delete row.dataset.busy;}
}
/* ---- add payment method window ---- */
let rzp;function loadCheckout(){
  if(window.Razorpay)return Promise.resolve();
  return rzp||(rzp=new Promise((res,rej)=>{const t=document.createElement('script');t.src='https://checkout.razorpay.com/v1/checkout.js';t.onload=()=>window.Razorpay?res():rej(new Error('x'));t.onerror=()=>{rzp=null;rej(new Error('x'));};document.head.append(t);}));
}
function openDlg(){
  if(!getAccountSession()){window.dispatchEvent(new CustomEvent('ajoy-account-open',{detail:{}}));return;}
  say(dmsg,'');go.disabled=false;go.textContent='Submit Payment';
  $$('.sc-acc',dlg).forEach((a,i)=>{a.dataset.open=String(i===0);$('.sc-acc-h',a).setAttribute('aria-expanded',String(i===0));});
  if(!dlg.open)dlg.showModal();
}
function closeDlg(){
  if(!dlg.open||dlg.classList.contains('sc-out'))return;
  if(calm()){dlg.close();return;}
  dlg.classList.add('sc-out');let done=false;const end=()=>{if(done)return;done=true;dlg.classList.remove('sc-out');if(dlg.open)dlg.close();};
  dlg.addEventListener('animationend',end,{once:true});setTimeout(end,360);
}
addBtn.addEventListener('click',openDlg);
dlg.addEventListener('click',e=>{if(e.target.closest('[data-x]')||e.target===dlg){closeDlg();return;}
  const h=e.target.closest('.sc-acc-h');if(h){const a=h.parentElement,open=a.dataset.open!=='true';$$('.sc-acc',dlg).forEach(x=>{x.dataset.open='false';$('.sc-acc-h',x).setAttribute('aria-expanded','false');});a.dataset.open=String(open);h.setAttribute('aria-expanded',String(open));}});
dlg.addEventListener('cancel',e=>{e.preventDefault();closeDlg();});
go.addEventListener('click',async()=>{
  go.disabled=true;go.textContent='Opening Razorpay…';say(dmsg,'');
  try{
    const setup=await call('card-setup');await loadCheckout();
    const email=getAccountSession()?.email||'';let finished=false;
    closeDlg(); /* Razorpay's window must not sit underneath this one */
    const box=new window.Razorpay({key:setup.keyId,order_id:setup.orderId,customer_id:setup.customerId,amount:setup.amount,currency:setup.currency,name:'Wrapline Pro',
      description:'Card check · ₹1, refunded straight away',prefill:{email},remember_customer:true,theme:{color:'#2A64E8'},
      handler:async r=>{finished=true;say(msg,'Checking your card…');
        try{await call('card-verify',{orderId:r.razorpay_order_id,paymentId:r.razorpay_payment_id,signature:r.razorpay_signature});say(msg,'Done. The ₹1 check was refunded. If you ticked “Save this card”, it is in the list below.','ok');}
        catch(e){say(msg,e.message,'error');}
        const keep=msg.textContent,kind=msg.dataset.kind;await refresh();say(msg,keep,kind);},
      modal:{escape:true,confirm_close:true,ondismiss:()=>{if(!finished){say(msg,'Nothing was added. You closed the Razorpay window.','');}go.disabled=false;go.textContent='Submit Payment';}}});
    box.on('payment.failed',e=>{say(msg,(e?.error?.description||'The card check failed.').replace(/\.?$/,'.')+' Please try again.','error');});
    box.open();
  }catch(e){go.disabled=false;go.textContent='Submit Payment';say(dmsg,e.message,'error');if(!dlg.open)dlg.showModal();}
});
onAccountChange(()=>{cards=null;refresh();});
refresh();
