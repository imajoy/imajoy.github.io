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
const kindLabel={card:'Card',upi:'UPI AutoPay',paypal:'PayPal'};
function paint(){
  list.replaceChildren();
  if(unavailable){count.textContent='Saved payment methods are not available yet.';addBtn.disabled=true;list.append(el('p','sc-empty','Saving payment methods will appear here once payments are fully connected.'));return;}
  addBtn.disabled=false;
  if(!getAccountSession()){count.textContent='Sign in to see your saved payment methods.';return;}
  if(cards===null){count.textContent='Checking your saved payment methods…';return;}
  count.replaceChildren();const n=cards.length;
  count.append('You have ',el('b',null,String(n)),' saved payment '+(n===1?'method':'methods'));
  if(!n){list.append(el('p','sc-empty','Nothing saved yet. Press Add payment method to add a card, UPI or PayPal.'));return;}
  cards.forEach((c,i)=>{
    const row=el('div','sc-row');row.style.setProperty('--i',String(Math.min(i,6)));
    const k=c.kind||'card';
    const badge=el('span','sc-badge',k==='upi'?'UPI':k==='paypal'?'PAYPAL':({Visa:'VISA',Mastercard:'MC',RuPay:'RUPAY','American Express':'AMEX','Diners Club':'DINERS',Maestro:'MAES'})[brandName(c.network)]||'CARD');badge.setAttribute('aria-hidden','true');
    const info=el('div','sc-info');let top,meta;
    if(k==='card'){top=el('b',null,brandName(c.network)+'  •••• •••• •••• '+(c.last4||'••••'));
      meta=[c.type==='credit'?'Credit card':c.type==='debit'?'Debit card':'Card',c.expYear?'Expires '+c.expYear+'-'+String(c.expMonth).padStart(2,'0'):''].filter(Boolean).join(' · ');}
    else if(k==='upi'){top=el('b',null,c.vpa||'UPI');meta='UPI AutoPay mandate'+(c.maxAmount?' · up to ₹'+Math.round(c.maxAmount/100).toLocaleString('en-IN'):'');}
    else{top=el('b',null,c.email||'PayPal');meta='PayPal account';}
    info.append(top,el('small',null,meta));
    const rm=el('button','sc-rm');rm.type='button';rm.setAttribute('aria-label','Remove '+kindLabel[k]);rm.title='Remove';
    rm.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 7V5h4v2m-6 0 .7 11h6.6L16 7"/></svg>';
    rm.addEventListener('click',()=>remove(c,row,rm));
    row.append(badge,info,rm);list.append(row);
  });
}
let paypalList=[];
function merge(r){return [...(r.cards||[]).map(c=>({...c,kind:'card'})),...(r.upi||[]).map(c=>({...c,kind:'upi'})),...paypalList.map(c=>({...c,kind:'paypal'}))];}
let lastRz={cards:[],upi:[]};
async function refresh(){
  if(!getAccountSession()){cards=null;paint();return;}
  const [rz,pp]=await Promise.allSettled([call('cards'),call('paypal-list')]);
  paypalList=pp.status==='fulfilled'?(pp.value.paypal||[]):[];
  if(rz.status==='fulfilled'){lastRz=rz.value;cards=merge(rz.value);unavailable=false;}
  else{const e=rz.reason;
    if(e.code==='off'){if(pp.status==='fulfilled'){lastRz={cards:[],upi:[]};cards=merge(lastRz);unavailable=false;}else unavailable=true;}
    else if(e.code!=='signin'){say(msg,e.message,'error');lastRz=lastRz||{cards:[],upi:[]};cards=merge(lastRz);}}
  paint();
}
async function remove(c,row,btn){
  if(!(await confirmLeave('card')))return;
  btn.disabled=true;row.dataset.busy='';say(msg,'Removing…');
  try{
    if(c.kind==='paypal'){const r=await call('paypal-remove',{methodId:c.id});paypalList=r.paypal||[];cards=merge(lastRz);}
    else{const r=await call('card-remove',{tokenId:c.id});lastRz={...lastRz,...r};cards=merge(lastRz);}
    say(msg,'Removed.','ok');setTimeout(()=>{if(msg.textContent==='Removed.')say(msg,'');},2600);paint();}
  catch(e){say(msg,e.message,'error');btn.disabled=false;delete row.dataset.busy;}
}
/* ---- add payment method window ---- */
let rzp;function loadCheckout(){
  if(window.Razorpay)return Promise.resolve();
  return rzp||(rzp=new Promise((res,rej)=>{const t=document.createElement('script');t.src='https://checkout.razorpay.com/v1/checkout.js';t.onload=()=>window.Razorpay?res():rej(new Error('x'));t.onerror=()=>{rzp=null;rej(new Error('x'));};document.head.append(t);}));
}
function openDlg(){
  if(!getAccountSession()){window.dispatchEvent(new CustomEvent('ajoy-account-open',{detail:{}}));return;}
  say(dmsg,'');say($('#sc-umsg'),'');say($('#sc-pmsg'),'');go.disabled=false;go.textContent='Submit Payment';$('#sc-ugo').textContent='Continue';syncUpi();
  $$('.sc-acc',dlg).forEach(a=>{a.dataset.open='false';$('.sc-acc-h',a).setAttribute('aria-expanded','false');});
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
  const h=e.target.closest('.sc-acc-h');if(h){const a=h.parentElement,open=a.dataset.open!=='true';$$('.sc-acc',dlg).forEach(x=>{x.dataset.open='false';$('.sc-acc-h',x).setAttribute('aria-expanded','false');});a.dataset.open=String(open);h.setAttribute('aria-expanded',String(open));if(open&&a.querySelector('#sc-pp-btn'))initPaypal();}});
dlg.addEventListener('cancel',e=>{e.preventDefault();closeDlg();});
async function runCheck(kind,btn,msgNode,idle,phone){
  btn.disabled=true;btn.textContent='Opening Razorpay…';say(msgNode,'');
  const reset=()=>{btn.disabled=false;btn.textContent=idle;};
  try{
    const setup=await call('card-setup',kind==='upi'?{method:'upi'}:{});await loadCheckout();
    const email=getAccountSession()?.email||'';let finished=false;
    closeDlg(); /* Razorpay's window must not sit underneath this one */
    const box=new window.Razorpay({key:setup.keyId,order_id:setup.orderId,customer_id:setup.customerId,amount:setup.amount,currency:setup.currency,name:'Wrapline Pro',
      description:(kind==='upi'?'UPI AutoPay':'Card')+' check · ₹1, refunded straight away',prefill:{email,...(phone?{contact:phone,method:'upi'}:{})},remember_customer:true,...(kind==='upi'?{recurring:'1'}:{}),theme:{color:'#2A64E8'},
      handler:async r=>{finished=true;say(msg,kind==='upi'?'Checking your UPI mandate…':'Checking your card…');
        try{await call('card-verify',{orderId:r.razorpay_order_id,paymentId:r.razorpay_payment_id,signature:r.razorpay_signature});say(msg,kind==='upi'?'Done. Your UPI AutoPay is set up and the ₹1 was refunded.':'Done. The ₹1 check was refunded. If you ticked “Save this card”, it is in the list below.','ok');}
        catch(e){say(msg,e.message,'error');}
        const keep=msg.textContent,k=msg.dataset.kind;await refresh();say(msg,keep,k);},
      modal:{escape:true,confirm_close:true,ondismiss:()=>{if(!finished){say(msg,'Nothing was added. You closed the Razorpay window.','');}reset();}}});
    box.on('payment.failed',e=>{say(msg,(e?.error?.description||'The check failed.').replace(/\.?$/,'.')+' Please try again.','error');});
    box.open();
  }catch(e){reset();say(msgNode,e.message,'error');if(!dlg.open)dlg.showModal();}
}
go.addEventListener('click',()=>runCheck('card',go,dmsg,'Submit Payment'));
const upiDigits=()=>{const raw=($('#sc-phone').value||'').replace(/[\s-]/g,''),m=/^(\+91|0091|91)?(\d{10})$/.exec(raw)||/^\+(\d{10,13})$/.exec(raw);return m?(m[2]?'+91'+m[2]:'+'+m[1]):'';};
function syncUpi(){const ok=!!upiDigits();$('#sc-ugo').disabled=!ok;$('#sc-ugo').setAttribute('aria-disabled',String(!ok));}
$('#sc-phone').addEventListener('input',()=>{say($('#sc-umsg'),'');syncUpi();});syncUpi();
$('#sc-ugo').addEventListener('click',()=>{
  const raw=($('#sc-phone').value||'').replace(/[\s-]/g,''),m=/^(\+91|0091|91)?(\d{10})$/.exec(raw)||/^\+(\d{10,13})$/.exec(raw);
  if(!m){say($('#sc-umsg'),'Enter the 10-digit mobile number linked to your UPI app.','error');$('#sc-phone').focus();return;}
  const digits=m[2]?'+91'+m[2]:'+'+m[1];
  runCheck('upi',$('#sc-ugo'),$('#sc-umsg'),'Continue',digits);
});
/* ---- PayPal: PayPal's own button approves saving the account; only a PayPal token is kept ---- */
let ppState='';
async function initPaypal(){
  const box=$('#sc-pp-btn'),load=$('#sc-pp-load'),pm=$('#sc-pmsg');
  if(ppState==='ready'||ppState==='loading'||!getAccountSession())return;
  ppState='loading';load.hidden=false;say(pm,'');
  try{
    const init=await call('paypal-init');
    if(!/^[A-Za-z0-9_-]{20,120}$/.test(init.clientId||''))throw Object.assign(new Error('Saving PayPal is not available yet.'),{code:'off'});
    if(!window.paypal){await new Promise((res,rej)=>{const t=document.createElement('script');t.src='https://www.paypal.com/sdk/js?client-id='+encodeURIComponent(init.clientId)+'&components=buttons&currency=USD';if(init.idToken&&/^[\w.-]+$/.test(init.idToken))t.dataset.userIdToken=init.idToken;t.onload=res;t.onerror=()=>rej(new Error('PayPal could not load. Check your connection and try again.'));document.head.append(t);});}
    if(!window.paypal?.Buttons)throw new Error('PayPal could not load.');
    await window.paypal.Buttons({style:{shape:'pill',color:'gold',label:'paypal',height:44,layout:'horizontal',tagline:false},
      createVaultSetupToken:async()=>(await call('paypal-setup')).setupTokenId,
      onApprove:async({vaultSetupToken})=>{say(pm,'Saving your PayPal account…');
        try{const r=await call('paypal-save',{setupTokenId:vaultSetupToken});paypalList=r.paypal||[];cards=merge(lastRz);paint();closeDlg();say(msg,'Done. Your PayPal account is saved.','ok');}
        catch(e){say(pm,e.message,'error');}},
      onCancel:()=>say(pm,'Nothing was saved. You closed PayPal.',''),
      onError:()=>say(pm,'PayPal could not save your account right now. Please try again.','error')}).render(box);
    load.hidden=true;ppState='ready';
  }catch(e){ppState='';load.hidden=true;say(pm,e.code==='off'?'Saving PayPal is not available yet.':e.message,'error');}
}
onAccountChange(()=>{cards=null;refresh();});
refresh();
