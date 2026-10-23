/* "Buy me a coffee" page. Dollars through PayPal for everyone, rupees through Razorpay in India.
   The server (apps-script/Donations.gs) re-checks every payment before it is recorded; this file only collects the amount and shows the greeting. */
import {detectGeo,cachedGeo} from './geo.js?v=20261019-geo1';
const cfg=window.AJOY_CONFIG||{};
const $=id=>document.getElementById(id);
const LIMITS={USD:{min:1,max:2000},INR:{min:20,max:150000}};
const CHIPS={
 USD:[[3,'Small cup'],[5,'A coffee'],[10,'Coffee + cake'],[25,'The big one']],
 INR:[[99,'A chai'],[199,'A coffee'],[499,'Coffee + snack'],[999,'The big one']]
};
const REF={USD:25,INR:999};
const calm=matchMedia('(prefers-reduced-motion: reduce)').matches;
const state={cur:'USD',amount:5,india:false,inrReady:false,rzpKey:'',paypal:null,paypalMode:'live',busy:false,chosen:false};
let paypalLoading=null,paypalDrawn=false,rzpLoading=null,uid=0;

const money=(n,cur)=>{
 const whole=Math.round(n*100)%100===0;
 try{return new Intl.NumberFormat(cur==='INR'?'en-IN':'en-US',{style:'currency',currency:cur,minimumFractionDigits:whole?0:2,maximumFractionDigits:2}).format(n);}
 catch{return (cur==='INR'?'₹':'$')+n;}
};
const parse=v=>{const t=String(v||'').replace(/[,\s]/g,'');return /^\d+(\.\d{1,2})?$/.test(t)?Number(t):NaN;};
const valid=(n,cur)=>Number.isFinite(n)&&n>=LIMITS[cur].min&&n<=LIMITS[cur].max;

/* ---------- the mug ---------- */
function mugSVG(big){
 const id='mg'+(++uid);
 const wave='M-56 0q14-8 28 0t28 0 28 0 28 0 28 0 28 0 28 0 28 0 28 0 28 0V200H-56Z';
 return `<svg viewBox="0 0 160 160" aria-hidden="true"${big?'':' style="--lvl:.5"'}>
 <defs><clipPath id="${id}"><path d="M32 60h80v48a32 32 0 0 1-32 32H64a32 32 0 0 1-32-32Z"/></clipPath>
 <linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c0794a"/><stop offset="1" stop-color="#6b3a1a"/></linearGradient></defs>
 <ellipse cx="72" cy="150" rx="54" ry="6" fill="#ffcf8a" opacity=".5"/>
 ${big?'<g class="th-pour" style="transform-box:fill-box"><rect x="69" y="-60" width="6" height="124" rx="3" fill="#8a4b22"/></g>':''}
 <g class="mug-steam"><path d="M54 48c-6-6 6-10 0-18"/><path d="M72 46c-6-6 6-10 0-18"/><path d="M90 48c-6-6 6-10 0-18"/></g>
 <g class="mug-body">
  <path d="M112 74h6a18 18 0 0 1 0 36h-8" fill="none" stroke="#e58a3e" stroke-width="8" stroke-linecap="round"/>
  <path d="M32 60h80v48a32 32 0 0 1-32 32H64a32 32 0 0 1-32-32Z" fill="#fff7ec"/>
  <g clip-path="url(#${id})"><g class="mug-liquid"><rect x="-60" y="2" width="320" height="200" fill="url(#${id}g)"/>
   <path class="mug-wave" d="${wave}" fill="#a15f33"/><path class="mug-wave" d="${wave}" fill="#d9a06a" transform="translate(0 -2)"/></g>
   ${big?'<path class="th-latte" d="M72 90c-10-8-14-14-8-18 4-2 7 0 8 3 1-3 4-5 8-3 6 4 2 10-8 18Z" fill="#fff3df"/>':''}</g>
  <path d="M32 60h80v48a32 32 0 0 1-32 32H64a32 32 0 0 1-32-32Z" fill="none" stroke="#e58a3e" stroke-width="5" stroke-linejoin="round"/>
  <ellipse cx="72" cy="60" rx="40" ry="5" fill="none" stroke="#e58a3e" stroke-width="3" opacity=".7"/>
 </g></svg>`;
}
const level=()=>{const a=valid(state.amount,state.cur)?state.amount:0;return 0.22+0.68*Math.min(1,Math.log10(1+a*9/REF[state.cur])/1);};
function paintMug(){const svg=$('sp-mug').firstElementChild;if(svg)svg.style.setProperty('--lvl',level().toFixed(3));}

/* ---------- messages ---------- */
function say(text,error){const m=$('sp-msg');m.textContent=text||'';if(error)m.dataset.error='true';else delete m.dataset.error;}
function busy(on){state.busy=on;$('sp-pay').dataset.busy=on?'true':'false';$('sp-rzp').disabled=on;}

/* ---------- amount + currency ---------- */
function renderChips(){
 const box=$('sp-chips');box.textContent='';
 for(const [value,caption] of CHIPS[state.cur]){
  const b=document.createElement('button');b.type='button';b.className='sp-chip';b.setAttribute('role','radio');b.dataset.value=String(value);
  const strong=document.createElement('b');strong.textContent=money(value,state.cur);
  const small=document.createElement('small');small.textContent=caption;
  b.append(strong,small);b.addEventListener('click',()=>{$('sp-amount').value=String(value);onAmount();});
  box.append(b);
 }
}
function onAmount(){
 const n=parse($('sp-amount').value);state.amount=n;
 for(const c of document.querySelectorAll('.sp-chip'))c.setAttribute('aria-checked',String(Number(c.dataset.value)===n));
 const hint=$('sp-range'),lim=LIMITS[state.cur],empty=$('sp-amount').value.trim()==='';
 hint.textContent=(!empty&&!valid(n,state.cur))?`Please enter between ${money(lim.min,state.cur)} and ${money(lim.max,state.cur)}, with at most two decimals.`:`Anything from ${money(lim.min,state.cur)} to ${money(lim.max,state.cur)}.`;
 hint.dataset.error=(!empty&&!valid(n,state.cur))?'true':'false';
 const rz=$('sp-rzp');rz.textContent=valid(n,state.cur)?`Donate ${money(n,state.cur)} with Razorpay`:'Donate with Razorpay';
 paintMug();
}
function setCurrency(cur,keepAmount){
 state.cur=cur;$('sp-symbol').textContent=cur==='INR'?'₹':'$';
 renderChips();
 if(!keepAmount)$('sp-amount').value=String(CHIPS[cur][1][0]);
 onAmount();
 $('sp-paypal').hidden=cur!=='USD';$('sp-rzp').hidden=cur!=='INR';
 say('');
 if(cur==='USD')drawPayPal();else readyRazorpay();
 renderSwitch();
}
function renderSwitch(){
 const s=$('sp-switch');s.textContent='';
 if(!(state.india&&state.inrReady)){s.hidden=true;return;}
 s.hidden=false;
 const b=document.createElement('button');b.type='button';
 if(state.cur==='INR'){s.append('Giving from outside India? ');b.textContent='Pay in US dollars instead';b.addEventListener('click',()=>{state.chosen=true;setCurrency('USD');});}
 else{s.append('In India? ');b.textContent='Pay in rupees instead';b.addEventListener('click',()=>{state.chosen=true;setCurrency('INR');});}
 s.append(b);
}

/* ---------- talking to the server ---------- */
async function call(step,data){
 const url=cfg.sheetUrl;if(!url)throw new Error('The donation service is not set up yet.');
 const r=await fetch(url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({type:'donation',step,...data})});
 return r.json();
}
const who=()=>({name:$('sp-name').value.trim().slice(0,40),message:$('sp-message').value.trim().slice(0,200)});
function loadScript(src){return new Promise((ok,no)=>{const s=document.createElement('script');s.src=src;s.async=true;s.onload=ok;s.onerror=()=>no(new Error('load'));document.head.append(s);});}
const hideLoading=()=>{$('sp-loading').hidden=true;};

/* ---------- PayPal (USD) ---------- */
async function drawPayPal(){
 if(paypalDrawn||paypalLoading)return;
 paypalLoading=(async()=>{
  try{
   if(!cfg.paypalConfigUrl)throw new Error('config');
   const conf=await (await fetch(cfg.paypalConfigUrl)).json();
   if(!conf||!conf.clientId)throw new Error('config');
   state.paypalMode=conf.mode||'live';
   await loadScript('https://www.paypal.com/sdk/js?client-id='+encodeURIComponent(conf.clientId)+'&currency=USD&intent=capture&components=buttons');
   if(!window.paypal||!window.paypal.Buttons)throw new Error('sdk');
   window.paypal.Buttons({
    style:{layout:'vertical',shape:'pill',label:'paypal',height:46},
    onClick:(_d,actions)=>{
     if(!valid(state.amount,'USD')){say('Please enter an amount between $1 and $2,000 first.',true);return actions.reject();}
     say('');
    },
    createOrder:(_d,actions)=>actions.order.create({purchase_units:[{description:'Buy me a coffee (Wrapline)',custom_id:'coffee',amount:{currency_code:'USD',value:state.amount.toFixed(2)}}],application_context:{shipping_preference:'NO_SHIPPING'}}),
    onApprove:async(data,actions)=>{
     busy(true);say('Finishing up…');
     try{await actions.order.capture();}catch{busy(false);say('PayPal could not finish that payment. You have not been charged.',true);return;}
     await confirm('paypal-verify',{orderId:data.orderID});
    },
    onCancel:()=>say('No problem. Nothing was charged.'),
    onError:()=>{busy(false);say('PayPal ran into a problem. You have not been charged. Please try again.',true);}
   }).render('#sp-paypal');
   paypalDrawn=true;hideLoading();
  }catch{
   paypalLoading=null;hideLoading();
   say('PayPal could not be loaded. Check your connection, turn off any blocker for this page and reload.',true);
  }
 })();
}

/* ---------- Razorpay (INR) ---------- */
function readyRazorpay(){hideLoading();}
async function openRazorpay(){
 if(state.busy)return;
 if(!valid(state.amount,'INR')){say('Please enter an amount between ₹20 and ₹1,50,000 first.',true);return;}
 busy(true);say('Opening Razorpay…');
 try{
  const [order]=await Promise.all([call('rzp-order',{amount:state.amount,name:who().name}),rzpLoading||(rzpLoading=loadScript('https://checkout.razorpay.com/v1/checkout.js').catch(e=>{rzpLoading=null;throw e;}))]);
  if(!order.ok){busy(false);say(order.message||'Razorpay is not available right now.',true);return;}
  if(!window.Razorpay){busy(false);say('Razorpay could not be loaded. Please reload and try again.',true);return;}
  const rz=new window.Razorpay({
   key:order.keyId,order_id:order.orderId,amount:order.amount,currency:'INR',name:'Wrapline',description:'Buy me a coffee',
   prefill:{name:who().name},theme:{color:'#e58a3e'},
   handler:resp=>{busy(true);say('Confirming your payment…');confirm('rzp-verify',{orderId:resp.razorpay_order_id,paymentId:resp.razorpay_payment_id,signature:resp.razorpay_signature});},
   modal:{ondismiss:()=>{busy(false);say('No problem. Nothing was charged.');}}
  });
  rz.on&&rz.on('payment.failed',()=>{busy(false);say('That payment did not go through. You have not been charged. Please try again.',true);});
  busy(false);say(order.mode==='test'?'Test mode: use Razorpay\'s test card, no real money moves.':'');
  rz.open();
 }catch{busy(false);say('Could not reach the payment service. Please check your connection and try again.',true);}
}

/* ---------- confirmation + greeting ---------- */
async function confirm(step,data){
 let res=null;
 for(let i=0;i<2&&!(res&&res.ok);i++){
  try{res=await call(step,{...data,...who()});}catch{res=null;}
  if(res&&(res.ok||res.error==='verify'))break;
  await new Promise(r=>setTimeout(r,1200));
 }
 busy(false);
 if(res&&res.ok){say('');thank(res);return;}
 say((res&&res.message)||'Your payment went through, but I could not confirm it on this page right away. Thank you so much. Your receipt from the payment provider is proof, and I will see it on my side too.',!(res&&res.ok));
}
const LINES=[
 'Because of you, the next tool gets built a little faster.',
 'That coffee just turned into late-night fixes and small improvements.',
 'It is kind people like you who keep one-person projects going.',
 'I will drink this one slowly and think of you.',
 'Your kindness is now part of Wrapline. Thank you.'
];
function particle(kind,i){
 const el=document.createElement('i');
 const angle=(-Math.PI/2)+(Math.random()-.5)*Math.PI*1.5,dist=110+Math.random()*150;
 el.style.setProperty('--x',(Math.cos(angle)*dist).toFixed(0)+'px');
 el.style.setProperty('--y',(Math.sin(angle)*dist).toFixed(0)+'px');
 el.style.setProperty('--r',((Math.random()-.5)*540).toFixed(0)+'deg');
 el.style.setProperty('--d',(3.05+Math.random()*.35).toFixed(2)+'s');
 el.style.setProperty('--s',(kind==='bean'?12:kind==='heart'?16:11)+Math.round(Math.random()*8)+'px');
 el.style.setProperty('--c',kind==='bean'?'#7a4a24':kind==='heart'?['#ff6b81','#ff8fa3','#ff9b54'][i%3]:'#ffc247');
 el.innerHTML=kind==='bean'?'<svg viewBox="0 0 24 24"><ellipse cx="12" cy="12" rx="7" ry="10" transform="rotate(30 12 12)" fill="currentColor"/><path d="M8 5c5 4 3 10 8 14" fill="none" stroke="#e8c9a5" stroke-width="1.6" stroke-linecap="round"/></svg>'
  :kind==='heart'?'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.5 2.7 5 6 5c2.1 0 3.4 1.1 4.2 2.3L12 9.6l1.8-2.3C14.6 6.1 15.9 5 18 5c3.3 0 5.1 3.5 3.6 6.8C19.5 16.4 12 21 12 21Z"/></svg>'
  :'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 1l2.6 8.4L23 12l-8.4 2.6L12 23l-2.6-8.4L1 12l8.4-2.6Z"/></svg>';
 return el;
}
function thank(res){
 try{localStorage.setItem('ajoy.coffee',JSON.stringify({until:Date.now()+30*864e5}));}catch{}
 const name=(res.name||'').trim();
 const head=name?`You just made my day, ${name}.`:'You just made my day.';
 const root=document.createElement('div');
 root.className='sp-thanks';root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-labelledby','th-title');
 const box=document.createElement('div');box.className='th-box';
 const mug=document.createElement('div');mug.className='sp-bigmug';mug.innerHTML=mugSVG(true);
 const burst=document.createElement('div');burst.className='th-burst';
 if(!calm){const kinds=['bean','heart','spark'];for(let i=0;i<26;i++)burst.append(particle(kinds[i%3],i));}
 const eyebrow=document.createElement('p');eyebrow.className='th-eyebrow';eyebrow.textContent='Coffee received';
 const title=document.createElement('h2');title.className='th-title';title.id='th-title';
 head.split(/(\s+)/).filter(Boolean).forEach((w,i)=>{const s=document.createElement('span');s.style.setProperty('--i',String(i));s.textContent=w;title.append(s);});
 const line=document.createElement('p');line.className='th-line';line.textContent=LINES[Math.floor(Math.random()*LINES.length)];
 const meta=document.createElement('p');meta.className='th-meta';
 const amt=document.createElement('b');amt.textContent=money(res.amount,res.currency);
 meta.append(amt,res.currency==='INR'?' received through Razorpay. Your receipt is in your email.':' received through PayPal. Your receipt is in your email.');
 const actions=document.createElement('div');actions.className='th-actions';
 const home=document.createElement('a');home.className='btn btn-dark';home.href='wrapline.html';home.textContent='Back to Wrapline';
 const more=document.createElement('button');more.type='button';more.className='btn btn-light';more.textContent='Close';
 actions.append(home,more);
 box.append(mug,burst,eyebrow,title,line,meta,actions);root.append(box);
 const prev=document.activeElement;
 const close=()=>{removeEventListener('keydown',key);root.dataset.leaving='1';setTimeout(()=>{root.remove();document.body.style.overflow='';if(prev&&prev.focus)prev.focus();},calm?0:400);};
 const key=e=>{if(e.key==='Escape')close();else if(e.key==='Tab'){const f=[home,more];const i=f.indexOf(document.activeElement);e.preventDefault();f[(i+(e.shiftKey?-1:1)+f.length)%f.length].focus();}};
 more.addEventListener('click',close);addEventListener('keydown',key);
 document.body.append(root);document.body.style.overflow='hidden';
 setTimeout(()=>home.focus({preventScroll:true}),calm?0:4600);
}

/* ---------- start ---------- */
$('sp-mug').innerHTML=mugSVG(false);
$('sp-amount').addEventListener('input',onAmount);
$('sp-rzp').addEventListener('click',openRazorpay);
const tzIndia=()=>{try{return /^Asia\/(Calcutta|Kolkata)$/.test(Intl.DateTimeFormat().resolvedOptions().timeZone);}catch{return false;}};
state.india=(cachedGeo&&cachedGeo()==='IN')||tzIndia();
setCurrency('USD');
(async()=>{
 try{
  const conf=await call('config',{});
  if(conf&&conf.error==='closed'){hideLoading();$('sp-pay').textContent='';say(conf.message||'Donations are paused right now. Thank you for thinking of it!');return;}
  state.inrReady=!!(conf&&conf.ok&&conf.inr);
 }catch{state.inrReady=false;}
 if(!state.india){try{const g=await detectGeo();state.india=g==='IN'||(g&&g.country==='IN');}catch{}}
 renderSwitch();
 if(state.india&&state.inrReady&&!state.chosen)setCurrency('INR');
})();
