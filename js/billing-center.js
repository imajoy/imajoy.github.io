/* Billing area: Subscriptions, Payment history and Payment methods for the signed-in account.
   Data comes from the same verified-session calls the rest of the site uses: 'history' (subscriptions + invoices) and the saved profile. */
import {getAccountSession,accountRequest,onAccountChange,openAccount} from './account-session.js?v=20261023-p7';
import {loadProfile,saveProfile,clearProfile,emptyProfile,hasBilling} from './profile-store.js?v=pm3';
import {bindPostal} from './billing-postal.js?v=bp3';
import {buildInvoiceDoc,printDoc,printDocs,invoicePeriod} from './ty-invoice.js?v=iv13';
import {downloadInvoices} from './invoice-pdf.js?v=pdf3';

const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e;};
const calm=()=>matchMedia('(prefers-reduced-motion:reduce)').matches;
const TABS={account:'Account information',subscriptions:'Subscriptions',history:'Payment history',methods:'Payment methods'};
const shell=$('.bc-shell'),nav=$('.bc-nav'),ind=$('.bc-ind');
let data=null,loading=false,tab='subscriptions';
const sort={subscriptions:{key:'date',dir:-1},history:{key:'date',dir:-1}};
const query={subscriptions:'',history:''};
let hmode='payments';

/* ---------- formatting ---------- */
const cur=c=>/^[A-Z]{3}$/.test(c||'')?c:'USD';
const money=(v,c)=>{try{return new Intl.NumberFormat(undefined,{style:'currency',currency:cur(c)}).format(v);}catch{return cur(c)+' '+Number(v).toFixed(2);}};
const day=(iso,style='medium')=>{const t=Date.parse(iso);return Number.isFinite(t)?new Date(t).toLocaleDateString(undefined,{dateStyle:style}):'—';};
const planName=p=>'Wrapline Pro '+(p==='offline'?'Premium':'Basic');
const providerName=p=>p==='razorpay'?'Razorpay':p==='paypal'?'PayPal':'—';

/* Where a subscription stands, in the customer's words. */
function describe(s){
  const end=Date.parse(s.endsAt),future=Number.isFinite(end)&&end>Date.now();
  if(s.status==='UNKNOWN')return {kind:'unknown',label:'Unavailable',when:'Could not be verified'};
  if(s.status==='ACTIVE'&&s.renews&&future)return s.trial?{kind:'trial',label:'Free trial',when:'First payment '+day(s.endsAt)}:{kind:'active',label:'Active',when:'Renews '+day(s.endsAt)};
  if(future)return {kind:'cancelled',label:s.trial?'Trial cancelled':'Cancelled',when:'Access until '+day(s.endsAt)};
  return {kind:'ended',label:'Expired',when:'Ended '+day(s.endsAt)};
}
const lastPayment=(s)=>{const mine=(data?.invoices||[]).filter(i=>i.subscriptionId===s.ref&&Number(i.amount)>0);return mine[0]||null;};

/* ---------- tab handling ---------- */
function placeIndicator(){
  const a=$('.bc-nav a[aria-current="page"]');if(!a||!ind)return;
  ind.style.cssText='left:'+a.offsetLeft+'px;top:'+a.offsetTop+'px;width:'+a.offsetWidth+'px;height:'+a.offsetHeight+'px';
}
function show(next,{push=true}={}){
  if(!TABS[next])next='subscriptions';
  const changed=next!==tab;tab=next;
  $$('.bc-nav a').forEach(a=>{const on=a.dataset.tab===tab;if(on)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  $$('.bc-panel').forEach(p=>{const on=p.id==='p-'+tab;p.hidden=!on;if(on&&changed&&!calm()){p.classList.remove('bc-in');void p.offsetWidth;p.classList.add('bc-in');}});
  $('#bc-title').textContent=TABS[tab];$('#bc-crumb').textContent=TABS[tab];
  document.title=TABS[tab]+' · Billing · Wrapline Pro';
  placeIndicator();
  if(push&&location.hash!=='#'+tab)history.replaceState(null,'','#'+tab);
  if(changed)scrollTo({top:0,behavior:calm()?'auto':'smooth'});
}
nav.addEventListener('click',e=>{const a=e.target.closest('a[data-tab]');if(!a)return;e.preventDefault();show(a.dataset.tab);});
document.addEventListener('click',e=>{const a=e.target.closest('a[data-tab-link]');if(!a)return;e.preventDefault();show(a.dataset.tabLink);});
addEventListener('hashchange',()=>show(location.hash.slice(1),{push:false}));
addEventListener('resize',placeIndicator,{passive:true});
document.fonts?.ready.then(placeIndicator);

/* ---------- tables ---------- */
function chip(kind,label){const c=el('span','bc-chip',label);c.dataset.kind=kind;const i=el('i');i.setAttribute('aria-hidden','true');c.prepend(i);return c;}
function empty(title,text,action){
  const box=el('div','bc-empty');box.append(el('b',null,title),el('p',null,text));
  if(action){const a=el('a','btn btn-light',action.label);a.href=action.href;box.append(a);}
  return box;
}
const skeletonRows=()=>Array.from({length:3},()=>{const tr=el('tr','bc-skel');for(let i=0;i<5;i++){const td=el('td');td.append(el('span','sk-bar'));tr.append(td);}return tr;});

function th(table,key,label,{sortable=true}={}){
  const h=el('th');h.scope='col';
  if(!sortable){h.textContent=label;return h;}
  const b=el('button','bc-sort');b.type='button';b.dataset.key=key;b.append(el('span',null,label));
  b.insertAdjacentHTML('beforeend','<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 12V4M5 4 2.5 6.5M5 4l2.5 2.5M11 4v8M11 12 8.5 9.5M11 12l2.5-2.5"/></svg>');
  b.addEventListener('click',()=>{const s=sort[table];s.dir=s.key===key?-s.dir:1;s.key=key;render(table);});
  h.append(b);return h;
}
const cmp=(a,b)=>typeof a==='number'&&typeof b==='number'?a-b:String(a).localeCompare(String(b),undefined,{numeric:true,sensitivity:'base'});

function subscriptionRows(){
  return (data.subscriptions||[]).map(s=>{
    const d=describe(s),last=lastPayment(s);
    return {s,d,last,
      name:planName(s.plan),seats:s.seats,
      text:[planName(s.plan),s.billing,providerName(s.provider),d.label,d.when].join(' ').toLowerCase(),
      sort:{name:planName(s.plan),price:last?Number(last.amount):0,date:Date.parse(s.endsAt)||0,status:d.label}};
  });
}
function renderSubscriptions(){
  const host=$('#sub-table'),body=$('tbody',host),rows=subscriptionRows(),q=query.subscriptions.trim().toLowerCase();
  let list=rows.filter(r=>!q||r.text.includes(q));
  const s=sort.subscriptions;list.sort((a,b)=>cmp(a.sort[s.key],b.sort[s.key])*s.dir);
  body.replaceChildren();
  $('#sub-empty').replaceChildren();
  if(!rows.length){$('#sub-empty').append(empty('No subscriptions yet','When you subscribe to Wrapline Pro it appears here, with its renewal date.',{label:'See plans',href:'wrapline.html#pricing'}));host.hidden=true;return;}
  host.hidden=false;
  if(!list.length){$('#sub-empty').append(empty('No results','Nothing matches “'+query.subscriptions.trim()+'”.'));return;}
  list.forEach((r,i)=>{
    const tr=el('tr');tr.style.setProperty('--i',String(Math.min(i,8)));
    const c1=el('td');c1.dataset.label='Subscription';const t=el('b',null,r.name);c1.append(t,el('small',null,(r.s.billing==='yearly'?'Yearly':'Monthly')+' · '+r.seats+(r.seats===1?' computer':' computers')));
    const c2=el('td',null,r.last?money(r.last.amount,r.last.currency):'—');c2.dataset.label='Last payment';
    const c3=el('td',null,r.d.when);c3.dataset.label='Billing date';
    const c4=el('td');c4.dataset.label='Status';c4.append(chip(r.d.kind,r.d.label));
    const c5=el('td','bc-act');const m=el('button','bc-link','Manage');m.type='button';m.addEventListener('click',()=>openAccount({}));c5.append(m);
    tr.append(c1,c2,c3,c4,c5);body.append(tr);
  });
}

function renderHistory(){
  const host=$('#his-table'),body=$('tbody',host),q=query.history.trim().toLowerCase();
  const all=(data.invoices||[]).map(inv=>{
    const zero=!(Number(inv.amount)>0);
    return {inv,zero,text:[inv.number,inv.paymentId,planName(inv.plan),day(inv.date),money(inv.amount,inv.currency),inv.refunded?'refunded':zero?'payment done':'paid',providerName(inv.provider)].join(' ').toLowerCase(),
      sort:{number:inv.number,date:Date.parse(inv.date)||0,plan:planName(inv.plan),amount:Number(inv.amount)||0}};
  });
  const rows=hmode==='refunds'?all.filter(r=>r.inv.refunded):all;
  let list=rows.filter(r=>!q||r.text.includes(q));
  const s=sort.history;list.sort((a,b)=>cmp(a.sort[s.key],b.sort[s.key])*s.dir);
  body.replaceChildren();$('#his-empty').replaceChildren();
  if(!rows.length){host.hidden=true;$('#his-empty').append(hmode==='refunds'?empty('No refunds','If a payment is ever refunded, it appears here.'):empty('No payments yet',data.archivePending?'Online invoices are being connected. Your emailed copies stay in your inbox.':'Each paid or free order appears here as soon as its invoice is ready.'));return;}
  host.hidden=false;
  if(!list.length){$('#his-empty').append(empty('No results','Nothing matches “'+query.history.trim()+'”.'));return;}
  list.forEach((r,i)=>{
    const inv=r.inv,tr=el('tr');tr.style.setProperty('--i',String(Math.min(i,8)));
    const c1=el('td');c1.dataset.label='Invoice';{const w=el('div');w.append(el('b',null,inv.number+(inv.mode==='Test'?' · TEST':'')),el('small',null,planName(inv.plan)+' · '+(inv.billing==='yearly'?'Yearly':'Monthly')+' · '+providerName(inv.provider)));c1.append(w);}
    const c2=el('td');c2.dataset.label='Payment ID';const pid=String(inv.paymentId||'');const pv=el('span','bc-mono',pid?(pid.length>16?pid.slice(0,7)+'…'+pid.slice(-4):pid):'—');if(pid)pv.title=pid;c2.append(pv);
    const c3=el('td',null,day(inv.date));c3.dataset.label='Paid at';
    const c4=el('td',null,money(inv.amount,inv.currency));c4.dataset.label='Amount';
    const c5=el('td');c5.dataset.label='Status';c5.append(inv.refunded?chip('cancelled','Refunded'):chip(r.zero?'free':'active',r.zero?'Payment done':'Paid'));
    const c6=el('td','bc-act');
    const v=el('button','bc-view',null);v.type='button';v.textContent='View';v.setAttribute('aria-label','View invoice '+inv.number);v.addEventListener('click',()=>openInvoice(inv));
    const dl=el('button','bc-dl1');dl.type='button';dl.setAttribute('aria-label','Download invoice '+inv.number+' as PDF');dl.title='Download PDF';
    dl.innerHTML='<span class="dl-slot" aria-hidden="true"><svg class="dl-a1" viewBox="0 0 24 24"><path d="M12 5v10m0 0-4-4m4 4 4-4"/></svg><svg class="dl-a2" viewBox="0 0 24 24"><path d="M12 5v10m0 0-4-4m4 4 4-4"/></svg></span><svg class="dl-ring" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="18"/></svg><svg class="dl-ok" viewBox="0 0 24 24" aria-hidden="true"><path d="m6.5 12.5 3.8 3.8 7.2-8"/></svg>';
    dl.addEventListener('click',()=>saveDocs([inv],dl));
    c6.append(v,dl);
    tr.append(c1,c2,c3,c4,c5,c6);body.append(tr);
  });
}
$$('[data-hmode]').forEach(b=>b.addEventListener('click',()=>{
  if(hmode===b.dataset.hmode)return;hmode=b.dataset.hmode;
  $$('[data-hmode]').forEach(x=>x.setAttribute('aria-selected',String(x===b)));
  $('#his-search').placeholder=hmode==='refunds'?'Search refunds':'Search';
  renderHistory();
}));

function render(which){
  if(!data)return;
  if(!which||which==='subscriptions')renderSubscriptions();
  if(!which||which==='history')renderHistory();
  $$('.bc-sort').forEach(b=>{const t=b.closest('table').id==='sub-table'?'subscriptions':'history',s=sort[t];const on=s.key===b.dataset.key;b.dataset.on=on?(s.dir>0?'asc':'desc'):'';b.closest('th').setAttribute('aria-sort',on?(s.dir>0?'ascending':'descending'):'none');});
}

/* ---------- invoice viewer ---------- */
function invoiceDoc(inv){
  const session=getAccountSession();if(!session)return null;
  const zero=!(Number(inv.amount)>0),m=v=>money(v,inv.currency);
  return buildInvoiceDoc({kind:'Invoice',number:inv.number,test:inv.mode==='Test',date:inv.date?new Date(inv.date).toLocaleDateString(undefined,{dateStyle:'long'}):'—',statusText:inv.refunded?'Refunded':zero?'Payment done':'Paid',statusKind:zero||inv.refunded?'free':'paid',email:session.email,provider:inv.provider,reference:inv.paymentId,orderId:(inv.orderId||'').split(' | ')[0],orderFull:(inv.orderId||'').split(' | ')[1]||'',billed:{name:inv.billedTo||'',lines:[inv.company,inv.address].filter(Boolean)},seller:inv.seller,title:'Wrapline Pro '+(inv.plan==='offline'?'Premium':'Basic'),sub:inv.billing==='yearly'?'Yearly':'Monthly',currency:cur(inv.currency),period:invoicePeriod(inv.date,inv.billing),nextBilling:(()=>{const sub=(data?.subscriptions||[]).find(x=>x.ref===inv.subscriptionId);return sub&&sub.renews&&Number.isFinite(Date.parse(sub.endsAt))?day(sub.endsAt):'';})(),seats:Number(inv.seats)||1,money:m,total:Number(inv.amount)||0,totalLabel:zero?'Total paid':'Total paid',note:zero?'Payment done. This invoice is your record of it.':''});
}
async function saveDocs(invs,btn){
  const docs=invs.map(invoiceDoc).filter(Boolean);if(!docs.length||btn.dataset.s==='busy')return;
  btn.dataset.s='busy';const t0=Date.now();
  try{
    await downloadInvoices(docs,docs.length===1?'Wrapline-invoice-'+invs[0].number:'Wrapline-invoices');
    await new Promise(r=>setTimeout(r,Math.max(0,650-(Date.now()-t0))));
    btn.dataset.s='done';setTimeout(()=>{delete btn.dataset.s;},1700);
  }catch{btn.dataset.s='fail';setTimeout(()=>{delete btn.dataset.s;},1700);}
}
function openInvoice(inv){
  const dlg=$('#bc-invoice'),slot=$('.bc-invoice-body',dlg);slot.replaceChildren();
  const doc=invoiceDoc(inv);if(!doc)return;
  slot.append(doc);
  $('.bc-print',dlg).onclick=()=>printDoc(doc);
  if(!dlg.open)dlg.showModal();
}
/* closing plays the opening motion in reverse before the dialog is really closed */
const invDlg=$('#bc-invoice');
function closeInvoice(){
  if(!invDlg.open||invDlg.classList.contains('bc-out'))return;
  if(calm()){invDlg.close();return;}
  invDlg.classList.add('bc-out');
  let done=false;const end=()=>{if(done)return;done=true;invDlg.classList.remove('bc-out');if(invDlg.open)invDlg.close();};
  invDlg.addEventListener('animationend',end,{once:true});setTimeout(end,360);
}
invDlg.addEventListener('click',e=>{if(e.target.closest('[data-x]')||e.target===e.currentTarget)closeInvoice();});
invDlg.addEventListener('cancel',e=>{e.preventDefault();closeInvoice();});

/* ---------- payment methods ---------- */
const form=$('#bc-billing'),payBox=$('#bc-savecard'),billMsg=$('#bc-bill-msg'),payMsg=$('#bc-pay-msg');
let flash=0;
function say(node,text,kind){clearTimeout(flash);node.textContent=text;node.dataset.kind=kind||'';if(text&&kind==='ok')flash=setTimeout(()=>{node.textContent='';},2600);}
function fill(p){
  const v=p||emptyProfile();
  for(const k of ['name','address','postal','city','region','company','companyAddress','companyPostal'])if(form.elements[k])form.elements[k].value=v[k]||'';
  form.elements.companyOn.checked=!!v.companyOn;$('.bc-co',form).dataset.open=String(!!v.companyOn);
  payBox.setAttribute('aria-checked',String(!!v.saveCard));
  $('[data-clear]',form).hidden=!hasBilling(v);
}
bindPostal(form);
form.elements.companyOn.addEventListener('change',()=>{$('.bc-co',form).dataset.open=String(form.elements.companyOn.checked);});
payBox.addEventListener('click',async()=>{
  const on=payBox.getAttribute('aria-checked')!=='true';
  payBox.setAttribute('aria-checked',String(on));payBox.disabled=true;say(payMsg,'Saving…');
  try{await saveProfile({saveCard:on});say(payMsg,on?'Saved. Razorpay will offer to remember your card at checkout.':'Saved. Cards will not be saved.','ok');}
  catch{payBox.setAttribute('aria-checked',String(!on));say(payMsg,'Could not save. Please try again.','error');}
  finally{payBox.disabled=false;}
});
/* Every billing detail is needed for an invoice, so empty fields are refused with a message under the field. */
const REQUIRED=[['name','Enter your full name.'],['address','Enter your billing address.'],['postal','Enter your postal code.'],['city','Enter your city.'],['region','Enter your state or region.']];
function fieldError(input,text){
  const box=input.closest('.bc-field');if(!box)return;
  let note=$('.bc-err',box);
  if(!text){box.removeAttribute('data-invalid');input.removeAttribute('aria-invalid');note?.remove();return;}
  if(!note){note=el('p','bc-err');note.id=input.id+'-err';note.setAttribute('role','alert');box.append(note);}
  note.textContent=text;box.dataset.invalid='';input.setAttribute('aria-invalid','true');input.setAttribute('aria-describedby',note.id);
}
function validate(f){
  let first=null;
  const need=[...REQUIRED];if(f.companyOn.checked)need.push(['company','Enter your company name.']);
  for(const [k,msg] of need){const bad=!f[k].value.trim();fieldError(f[k],bad?msg:'');if(bad&&!first)first=f[k];}
  if(first){say(billMsg,'Please fill in the highlighted fields.','error');first.focus();return false;}
  return true;
}
form.addEventListener('input',e=>{if(e.target.closest('.bc-field')?.hasAttribute('data-invalid'))fieldError(e.target,'');});
form.addEventListener('submit',async e=>{
  e.preventDefault();const f=form.elements,btn=$('.bc-save',form);
  if(!validate(f))return;
  btn.disabled=true;say(billMsg,'Saving…');
  try{
    await saveProfile({name:f.name.value.trim(),address:f.address.value.trim(),postal:f.postal.value.trim(),city:f.city.value.trim(),region:f.region.value.trim(),companyOn:f.companyOn.checked,company:f.company.value.trim(),companyAddress:f.companyAddress.value.trim(),companyPostal:f.companyPostal.value.trim()});
    say(billMsg,'Saved to your account. We fill these in at checkout.','ok');$('[data-clear]',form).hidden=false;
  }catch{say(billMsg,'Could not save. Please try again.','error');}
  finally{btn.disabled=false;}
});
$('[data-clear]',form).addEventListener('click',async()=>{
  say(billMsg,'Removing…');
  try{await clearProfile();fill(null);say(billMsg,'Saved details removed.','ok');}catch{say(billMsg,'Could not remove. Please try again.','error');}
});

/* ---------- search ---------- */
$('#sub-search').addEventListener('input',e=>{query.subscriptions=e.target.value;renderSubscriptions();});
$('#his-search').addEventListener('input',e=>{query.history=e.target.value;renderHistory();});

/* ---------- loading ---------- */
function setState(s){shell.dataset.state=s;}
async function load(){
  const session=getAccountSession();
  if(!session){data=null;setState('out');return;}
  if(session.limited){setState('limited');return;}
  if(loading)return;loading=true;setState('loading');
  $('#sub-table tbody').replaceChildren(...skeletonRows());$('#his-table tbody').replaceChildren(...skeletonRows());
  $('#sub-table').hidden=false;$('#his-table').hidden=false;
  loadProfile().then(p=>{if(p!==undefined)fill(p);});
  try{
    let res=await accountRequest({step:'history',token:session.token},45000);
    if(!res.ok&&['step','email'].includes(res.error)){const legacy=await accountRequest({step:'status',token:session.token},45000);res={...legacy,invoices:[],archivePending:true};}
    if(!res.ok||res.email!==session.email||!Array.isArray(res.subscriptions))throw Error(res.error||'history');
    data={subscriptions:res.subscriptions,invoices:Array.isArray(res.invoices)?res.invoices:[],archivePending:!!res.archivePending};
    setState('ready');render();
  }catch(err){
    if(getAccountSession()!==session&&!getAccountSession()){setState('out');}
    else setState('error');
  }finally{loading=false;}
}
$('.bc-retry').addEventListener('click',()=>{load();});
$$('.bc-signin-btn').forEach(b=>b.addEventListener('click',()=>openAccount({purpose:'billing'})));
let lastToken=getAccountSession()?.token||'';
onAccountChange(()=>{const t=getAccountSession()?.token||'';if(t!==lastToken){lastToken=t;data=null;load();}});

$('#sub-head').append(th('subscriptions','name','Subscription'),th('subscriptions','price','Last payment'),th('subscriptions','date','Billing date'),th('subscriptions','status','Status'),th('subscriptions','','',{sortable:false}));
$('#his-head').append(th('history','number','Invoice'),th('history','paymentId','Payment ID',{sortable:false}),th('history','date','Paid at'),th('history','amount','Amount'),th('history','status','Status',{sortable:false}),th('history','go','',{sortable:false}));
$$('#sub-head th:last-child,#his-head th:last-child').forEach(h=>h.className='bc-act');
$('#his-head th:last-child').innerHTML='<span class="sr">View</span>';
show(location.hash.slice(1)||'subscriptions',{push:false});
load();
