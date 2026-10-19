/* Email-code sign-in with an immediate cached summary and live subscription refresh. */
import {getAccountSession,setAccountSession,clearAccountSession,onAccountChange,accountRequest} from './account-session.js?v=20261018-n1';
const cfg = window.AJOY_CONFIG || {};
if (cfg.accountOpen && cfg.sheetUrl) init();
function init() {
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const label = plan => plan === 'offline' ? 'Offline' : 'Online';
  const dayWord = n => n + (n === 1 ? ' day' : ' days');
  const daysLeft = iso => Math.max(0, Math.ceil((new Date(iso) - Date.now()) / 864e5));
  const fmtDate = iso => new Date(iso).toLocaleDateString(undefined, {day:'numeric',month:'short',year:'numeric'});
  const describe = s => {
    const days = s.endsAt ? daysLeft(s.endsAt) : 0, live = days > 0;
    if (s.status === 'UNKNOWN') return {state:'unknown',text:'Subscription details are temporarily unavailable.',short:'Account',days:0};
    if (s.status === 'ACTIVE' && live && s.trial) return {state:'active',text:'Free trial · '+dayWord(days)+' left, then billed automatically on '+fmtDate(s.endsAt),short:days+'d left',days};
    if (s.status === 'ACTIVE' && live) return {state:'active',text:dayWord(days)+' left · renews '+fmtDate(s.endsAt),short:days+'d left',days};
    if (live) return {state:'ending',text:'Ends '+fmtDate(s.endsAt)+' ('+dayWord(days)+' left) · not renewing',short:days+'d left',days};
    return {state:'ended',text:'Ended'+(s.endsAt?' '+fmtDate(s.endsAt):'')+' · renew to keep using Ajoy Tools',short:'Renew',days:0};
  };
  const totalDays = list => list.reduce((n,s) => n+describe(s).days,0);
  let registration=false,purpose='',email='',step='email',msg='',busy=false,updating=false,offline=false,generation=0,closing=false;
  const dlg=document.createElement('dialog');
  dlg.className='acct-dlg';dlg.setAttribute('aria-labelledby','acct-title');
  dlg.innerHTML='<button class="acct-close" type="button" aria-label="Close sign-in">×</button><div class="acct-body"></div>';
  document.body.appendChild(dlg);
  const body=dlg.querySelector('.acct-body');
  const btn=document.querySelector('[data-account-button]')||document.createElement('button');btn.disabled=false;btn.removeAttribute('title');btn.type='button';btn.className='acct-btn';btn.setAttribute('aria-haspopup','dialog');btn.setAttribute('aria-controls','account-dialog');dlg.id='account-dialog';
  const pill=document.querySelector('.site-header .pillbar');
  const nav=pill||document.querySelector('.commerce-header .wrap');
  if(nav&&!btn.parentElement)nav.insertBefore(btn,nav.querySelector('.btn-sm')||nav.querySelector('.back-link'));
  const accountIcon='<span class="acct-icon" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none"><path d="M7 11l9 7 9-7M8 8h16a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V11a3 3 0 0 1 3-3Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg></span>';
  async function close() {
    if(closing||!dlg.open)return;
    closing=true;dlg.dataset.closing='';
    if(!matchMedia('(prefers-reduced-motion: reduce)').matches){
      await new Promise(requestAnimationFrame);
      await Promise.race([Promise.allSettled(dlg.getAnimations().map(a=>a.finished)),new Promise(r=>setTimeout(r,380))]);
    }
    dlg.close();delete dlg.dataset.closing;closing=false;
  }
  function open() { if(closing)return;render();if(!dlg.open)dlg.showModal();focusStep(); }
  function focusStep(){if(dlg.open)body.querySelector('input, #acct-title')?.focus({preventScroll:true});}
  dlg.querySelector('.acct-close').addEventListener('click',close);
  dlg.addEventListener('cancel',e=>{e.preventDefault();close();});
  dlg.addEventListener('click',e=>{const r=dlg.getBoundingClientRect();if(e.target===dlg&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom))close();});
  btn.addEventListener('click',()=>{purpose='';open();});
  window.addEventListener('ajoy-account-open',event=>{purpose=event.detail?.purpose||'';registration=event.detail?.intent==='register';if(event.detail?.email)email=event.detail.email;open();});
  function announce(text,error=false){msg=text;const n=body.querySelector('.acct-msg');if(n){n.textContent=text;n.dataset.error=String(error);} }
  function setBusy(value){busy=value;body.setAttribute('aria-busy',String(value));for(const button of body.querySelectorAll('button'))button.disabled=value;}
  function render() {
    const session=getAccountSession(),subs=session?.subscriptions;
    body.dataset.stage=session?'account':step;body.setAttribute('aria-busy',String(busy));
    if(session){
      body.innerHTML='<span class="acct-icon acct-icon-success" aria-hidden="true">✓</span><p class="eyebrow">Your account</p><h2 id="acct-title" tabindex="-1">'+esc(session.email)+'</h2><p class="acct-note acct-sync" role="status">'+(updating?'Updating your subscription details…':offline?'Showing your saved account. Reconnect to update your details.':'Your verified account email is used automatically at checkout.')+'</p>'+
        (subs?.length>1&&totalDays(subs)?'<p class="acct-total">Total across your subscriptions: <b>'+dayWord(totalDays(subs))+' left</b></p>':'')+
        (subs===null?'<div class="acct-skeleton" aria-hidden="true"><i></i><i></i></div>':subs.length?subs.map(s=>{const d=describe(s);return '<div class="acct-sub" data-state="'+d.state+'"><b>Ajoy Tools '+label(s.plan)+'</b><span>'+(s.billing==='yearly'?'Yearly':'Monthly')+' · '+Number(s.seats||1)+' license(s)</span><p>'+esc(d.text)+'</p>'+(d.state==='ended'||d.state==='ending'?'<a class="btn btn-dark btn-sm" href="checkout.html?plan='+(s.plan==='offline'?'offline':'online')+'&amp;billing='+(s.billing==='yearly'?'yearly':'monthly')+'">Renew</a>':'')+'</div>';}).join(''):'<p class="acct-note">Your email is registered. <a href="index.html#pricing">Explore subscriptions and trial availability</a>.</p>')+
        (session.limited?'<p class="acct-note">Only your latest subscription is shown. Sign out and verify your email to see every subscription.</p>':'')+
        (offline?'<button class="acct-link" type="button" data-retry>Try updating again</button>':'')+'<p class="acct-note">To use a different email, sign out first.</p><button class="acct-link" type="button" data-out>Sign out</button>';
      body.querySelector('[data-out]').onclick=()=>{generation++;registration=false;step='email';email='';msg='';busy=false;clearAccountSession();};
      body.querySelector('[data-retry]')?.addEventListener('click',status);
      return;
    }
    const code=step==='code';
    body.innerHTML=accountIcon+'<p class="eyebrow">'+(registration?'Register your email':'Sign in')+' <span class="acct-step">'+(code?'02':'01')+' / 02</span></p><h2 id="acct-title" tabindex="-1">'+(code?'Check your inbox.':registration?'Create your account.':'Welcome back.')+'</h2><p class="acct-note">'+(code?'Enter the 6-digit code sent to <b>'+esc(email)+'</b>. It expires in 10 minutes.':registration?'Verify your email to download the setup or subscribe. Your account is created only after verification.':'Use your registered email. New here? Register below.')+'</p><form class="acct-form"><label for="acct-input">'+(code?'Email verification code':registration?'Your email address':'Registered email address')+'</label><input id="acct-input" '+(code?'type="text" inputmode="numeric" pattern="[0-9]{6}" minlength="6" maxlength="6" autocomplete="one-time-code"':'type="email" maxlength="120" autocomplete="email"')+' required autocapitalize="off" autocorrect="off" spellcheck="false" aria-describedby="acct-message" '+(!code?'value="'+esc(email)+'"':'')+'><button class="btn btn-dark" type="submit">'+(code?(registration?'Verify and register':'Verify and sign in'):'Send verification code')+'<span aria-hidden="true"> →</span></button></form><p id="acct-message" class="acct-msg" role="status" aria-live="polite">'+esc(msg)+'</p>'+(code?'<button class="acct-link" type="button" data-back>Use a different email</button>':'<button class="acct-link" type="button" data-register>'+(registration?'Already registered? Sign in':'New here? Register your email')+'</button><p class="acct-note acct-privacy">We use your email for account verification and service messages. <a href="privacy.html">Privacy notice</a></p>');
    body.querySelector('[data-register]')?.addEventListener('click',()=>{registration=!registration;email=body.querySelector('input').value.trim().toLowerCase();msg='';render();focusStep();});
    body.querySelector('[data-back]')?.addEventListener('click',()=>{generation++;step='email';msg='';render();focusStep();});
    body.querySelector('form').addEventListener('submit',async event=>{
      event.preventDefault();if(busy)return;
      const input=body.querySelector('input');if(!input.reportValidity())return;
      const operation=++generation,wasCode=step==='code',value=input.value.trim();
      if(!wasCode)email=value.toLowerCase();
      setBusy(true);announce(wasCode?'Verifying your code…':'Checking your registered email…');
      try{
        const result=await accountRequest(wasCode?{step:'verify',email,code:value}:{step:'code',email,intent:registration?'register':'signin'});
        if(operation!==generation)return;
        if(!result.ok){
          announce(result.error==='not_registered'?'Email is not registered. Choose Register your email below.':result.error==='limit'?(wasCode?'Too many wrong codes. Please wait 10 minutes.':'Too many requests. Please wait an hour.'):result.error==='email'?'Enter a valid email address.':wasCode?'That code is invalid or expired.':'Could not send your code. Please try again.',true);
          input.setAttribute('aria-invalid','true');input.focus();return;
        }
        if(wasCode){
          if(!result.token||!result.email||(result.subscriptions!==null&&!Array.isArray(result.subscriptions)))throw new Error('Sign-in could not be completed. Please try again.');
          msg='';step='email';setAccountSession(result);
          status();if(purpose){purpose='';close();}
        }else{step='code';msg='';render();focusStep();}
      }catch(error){if(operation===generation)announce(error.message||'Could not reach the service. Please try again.',true);}
      finally{if(operation===generation)setBusy(false);}
    });
    body.querySelector('input').addEventListener('input',event=>{event.target.removeAttribute('aria-invalid');announce('');});
  }
  function refresh(){
    const session=getAccountSession(),subs=session?.subscriptions;
    const active=subs?.map(s=>({s,d:describe(s)})),best=active?.find(x=>x.d.state==='active'||x.d.state==='ending')||active?.[0];
    btn.textContent=!session?'Sign in':!pill||!best?'Account':best.d.state==='ended'?label(best.s.plan)+' · Renew':best.d.state==='unknown'?'Account':(active.length>1?'Subscribed':label(best.s.plan))+' · '+totalDays(subs)+'d left';
    btn.dataset.state=best?.d.state||'';btn.classList.toggle('is-updating',updating);
    btn.setAttribute('aria-label',session?'Account: '+session.email+(updating?'. Updating subscription details.':''):'Sign in');
    for(const plan of ['online','offline']){
      const a=document.querySelector('[data-buy="'+plan+'"]');if(!a)continue;
      const mine=active?.find(x=>x.s.plan===plan&&(x.d.state==='active'||x.d.state==='ending'))||active?.find(x=>x.s.plan===plan);
      if(!a.dataset.orig)a.dataset.orig=a.textContent;
      if(!mine){if(a.classList.contains('is-owned'))a.textContent=a.dataset.orig;a.classList.remove('is-owned');continue;}
      a.classList.add('is-owned');
      a.textContent=mine.d.state==='ended'?'Renew '+label(plan):mine.d.state==='ending'?'Renew · '+mine.d.short:mine.d.state==='unknown'?'View account':'Your plan · '+mine.d.short;
    }
  }
  async function status(){
    const saved=getAccountSession();if(!saved)return;
    updating=true;offline=false;refresh();if(dlg.open)render();
    try{
      const result=await accountRequest({step:'status',token:saved.token});
      if(getAccountSession()?.token!==saved.token)return;
      if(result.ok&&Array.isArray(result.subscriptions)){setAccountSession({...saved,...result});}
      else if(result.error==='expired'||result.error==='not_registered'){msg='Your session expired. Sign in again.';clearAccountSession();}
      else offline=true;
    }catch{offline=true;}
    finally{updating=false;refresh();if(dlg.open)render();}
  }
  onAccountChange(()=>{refresh();if(dlg.open)render();});
  document.addEventListener('click',event=>{const a=event.target.closest('.is-owned');if(a&&/Your plan|View account/.test(a.textContent)){event.preventDefault();open();}});
  refresh();
  let autoOpen=false;try{autoOpen=sessionStorage.getItem('ajoy.acct.open')==='1';sessionStorage.removeItem('ajoy.acct.open');email=sessionStorage.getItem('ajoy.acct.email')||'';sessionStorage.removeItem('ajoy.acct.email');}catch{}
  if(autoOpen)open();
  status();
}
