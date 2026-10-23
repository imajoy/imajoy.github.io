import {mountPasskeys,cancelPasskey} from './passkeys.js?v=20261020-fast1';
/* Email-code sign-in with an immediate cached summary and live subscription refresh. */
import {getAccountSession,setAccountSession,clearAccountSession,onAccountChange,accountRequest} from './account-session.js?v=20261023-p7';
const cfg = window.AJOY_CONFIG || {};
if (cfg.accountOpen && cfg.sheetUrl) init();
function init() {
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const label = plan => plan === 'offline' ? 'Premium' : 'Basic';
  const dayWord = n => n + (n === 1 ? ' day' : ' days');
  const daysLeft = iso => Math.max(0, Math.ceil((new Date(iso) - Date.now()) / 864e5));
  const fmtDate = iso => new Date(iso).toLocaleDateString(undefined, {day:'numeric',month:'short',year:'numeric'});
  const describe = s => {
    const days = s.endsAt ? daysLeft(s.endsAt) : 0, live = days > 0, date = s.endsAt ? fmtDate(s.endsAt) : '';
    if (s.status === 'UNKNOWN') return {state:'unknown',kind:'unknown',text:'Subscription details are temporarily unavailable.',short:'Account',days:0};
    if (live && s.renews && s.trial) return {state:'active',kind:'trial',text:'Free trial · '+dayWord(days)+' left · first payment on '+date+' unless you cancel',short:days+'d left',days,date};
    if (live && s.renews) return {state:'active',kind:'active',text:'Active · '+dayWord(days)+' left · renews on '+date,short:days+'d left',days,date};
    if (live) return {state:'ending',kind:'cancelled',text:(s.trial?'Trial cancelled':'Cancelled')+' · access continues until '+date+' ('+dayWord(days)+' left)',short:days+'d left',days,date};
    return {state:'ended',kind:'ended',text:'Ended'+(date?' '+date:'')+' · renew to keep using Wrapline',short:'Renew',days:0,date};
  };
  const canCancel = s => s.renews && s.ref && ['paypal','razorpay'].includes(s.provider) && daysLeft(s.endsAt) > 0;
  const sameSub = (a,b) => a.provider===b.provider && a.ref===b.ref;
  /* Cancels future renewals. Access continues until the paid or trial period ends. */
  async function cancelSubscription(s){
    const current=getAccountSession();if(!current)throw new Error('Sign in again to manage your subscription.');
    let result=await accountRequest({step:'cancel',token:current.token,provider:s.provider,ref:s.ref},60000);
    if(!result.ok&&['step','email'].includes(result.error)){
      // The account service has not been updated yet: fall back to the provider routes that already exist.
      if(s.provider==='paypal'){window.open('https://www.paypal.com/myaccount/autopay/','_blank','noopener');return {external:true};}
      const url=cfg.razorpayUrl;if(!url)throw new Error('Cancellation is unavailable right now. Please contact support.');
      const response=await fetch(url+'/stop',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({checkoutId:s.ref,accountToken:current.token}),signal:AbortSignal.timeout(60000)});
      result=await response.json().catch(()=>({}));if(response.ok&&result.ok)result.cancelled=true;
    }
    if(!result.ok){if(result.error==='expired'){clearAccountSession();throw new Error('Your session expired. Sign in again.');}throw new Error(result.message||'Your subscription could not be cancelled. Please try again or contact support.');}
    const latest=getAccountSession();
    if(latest?.token===current.token&&Array.isArray(latest.subscriptions))setAccountSession({...latest,subscriptions:latest.subscriptions.map(x=>sameSub(x,s)?{...x,renews:false,endsAt:result.endsAt||x.endsAt}:x)});
    setTimeout(status,1500);
    return result;
  }
  const totalDays = list => list.reduce((n,s) => n+describe(s).days,0);
  let registration=false,purpose='',email='',step='email',msg='',busy=false,updating=false,offline=false,generation=0,closing=false,codeDeadline=0,countdownTimer,reauthenticating=false;
  const dlg=document.createElement('dialog');
  dlg.className='acct-dlg';dlg.setAttribute('aria-labelledby','acct-title');
  dlg.innerHTML='<button class="acct-close" type="button" aria-label="Close sign-in">×</button><div class="acct-body"></div>';
  document.body.appendChild(dlg);
  const body=dlg.querySelector('.acct-body');
  const btn=document.querySelector('[data-account-button]')||document.createElement('button');btn.disabled=false;btn.removeAttribute('title');btn.type='button';btn.className='acct-btn';btn.setAttribute('aria-haspopup','dialog');btn.setAttribute('aria-controls','account-dialog');dlg.id='account-dialog';
  const pill=document.querySelector('.site-header .pillbar');
  const landingAccount=!!pill&&(pill.hasAttribute('data-wrapline-account')||pill.hasAttribute('data-account-entry'));
  pill?.querySelectorAll('[data-account-register]').forEach(el=>el.remove());
  const nav=pill||document.querySelector('.commerce-header .wrap');
  if(nav&&!btn.parentElement)nav.insertBefore(btn,nav.querySelector('.btn-sm')||nav.querySelector('.back-link'));
  const accountIcon='<span class="acct-icon" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none"><path d="M7 11l9 7 9-7M8 8h16a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V11a3 3 0 0 1 3-3Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg></span>';
  async function close() {
    if(closing||!dlg.open)return;
    closing=true;cancelPasskey();dlg.dataset.closing='';
    if(!matchMedia('(prefers-reduced-motion: reduce)').matches){
      await new Promise(requestAnimationFrame);
      await Promise.race([Promise.allSettled(dlg.getAnimations().map(a=>a.finished)),new Promise(r=>setTimeout(r,380))]);
    }
    clearInterval(countdownTimer);dlg.close();delete dlg.dataset.closing;closing=false;
  }
  function open() { if(closing)return;render();if(!dlg.open)dlg.showModal();if(step==='code'&&!getAccountSession()){clearInterval(countdownTimer);syncCountdown();countdownTimer=setInterval(syncCountdown,1000);}focusStep(); }
  function focusStep(){if(dlg.open)body.querySelector('input, #acct-title')?.focus({preventScroll:true});}
  dlg.querySelector('.acct-close').addEventListener('click',close);
  dlg.addEventListener('cancel',e=>{e.preventDefault();close();});
  dlg.addEventListener('click',e=>{const r=dlg.getBoundingClientRect();if(e.target===dlg&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom))close();});
  btn.addEventListener('click',()=>{purpose='';open();});
  window.addEventListener('ajoy-account-open',event=>{purpose=event.detail?.purpose||'';if(event.detail?.email&&event.detail.email!==email){generation++;busy=false;step='email';codeDeadline=0;email=event.detail.email;msg='';}open();});
  function announce(text,error=false){msg=text;const n=body.querySelector('.acct-msg');if(n){n.textContent=text;n.dataset.error=String(error);} }
  function setBusy(value){busy=value;body.setAttribute('aria-busy',String(value));for(const button of body.querySelectorAll('button'))button.disabled=value;if(step==='code')syncCountdown();}
  function render() {
    clearInterval(countdownTimer);
    const session=reauthenticating?null:getAccountSession(),subs=session?.subscriptions;
    body.dataset.stage=session?'account':step;body.setAttribute('aria-busy',String(busy));
    if(session){
      body.innerHTML='<span class="acct-icon acct-icon-success" aria-hidden="true">✓</span><p class="eyebrow">Your account</p><h2 id="acct-title" tabindex="-1">'+esc(session.email)+'</h2><p class="acct-note acct-sync" role="status">'+(updating?'Updating your subscription details…':offline?'Showing your saved account. Reconnect to update your details.':'Your verified account email is used automatically at checkout.')+'</p>'+
        (subs?.length>1&&totalDays(subs)?'<p class="acct-total">Total across your subscriptions: <b>'+dayWord(totalDays(subs))+' left</b></p>':'')+
        (subs===null?'<div class="acct-skeleton" aria-hidden="true"><i></i><i></i></div>':subs.length?subs.map(s=>{const d=describe(s);return '<div class="acct-sub" data-state="'+d.state+'"><b>Wrapline '+label(s.plan)+'</b><span>'+(s.billing==='yearly'?'Yearly':'Monthly')+' · '+Number(s.seats||1)+' license(s)</span><p>'+esc(d.text)+'</p>'+(d.state==='ended'?'<a class="btn btn-dark btn-sm" href="checkout.html?plan='+(s.plan==='offline'?'offline':'online')+'&amp;billing='+(s.billing==='yearly'?'yearly':'monthly')+'">Renew</a>':'')+(canCancel(s)?'<button class="acct-link acct-stop" type="button" data-cancel-index="'+subs.indexOf(s)+'">'+(s.trial?'Cancel free trial':'Cancel subscription')+'</button>':'')+'</div>';}).join(''):'<p class="acct-note">Your email is registered. <a href="wrapline.html#pricing">Explore subscriptions and trial availability</a>.</p>')+
        (session.limited?'<p class="acct-note">Only your latest subscription is shown. Sign out and verify your email to see every subscription.</p>':'')+
        '<div class="acct-passkeys" hidden></div>'+
        (offline?'<button class="acct-link" type="button" data-retry>Try updating again</button>':'')+'<p class="acct-note">To use a different email, sign out first.</p><button class="acct-link" type="button" data-out>Sign out</button>';
      body.querySelector('[data-out]').onclick=()=>{generation++;registration=false;step='email';email='';msg='';busy=false;clearAccountSession();};
      body.querySelector('[data-retry]')?.addEventListener('click',status);
      for(const stop of body.querySelectorAll('[data-cancel-index]'))stop.addEventListener('click',async()=>{
        const sub=subs[Number(stop.dataset.cancelIndex)];if(!sub)return;
        if(stop.dataset.confirm!=='1'){stop.dataset.confirm='1';stop.textContent='Confirm cancel · access continues until '+fmtDate(sub.endsAt);return;}
        stop.disabled=true;stop.textContent='Cancelling…';
        try{const result=await cancelSubscription(sub);if(result.external){stop.disabled=false;stop.dataset.confirm='';stop.textContent=sub.trial?'Cancel free trial':'Cancel subscription';announce('Finish cancelling in the PayPal window that opened.');}}
        catch(error){stop.disabled=false;stop.dataset.confirm='';stop.textContent=sub.trial?'Cancel free trial':'Cancel subscription';announce(error.message,true);}
      });
      mountAccountPasskeys(session);
      return;
    }
    const code=step==='code';
    body.innerHTML=accountIcon+'<p class="eyebrow">Register / Login <span class="acct-step">'+(code?'02':'01')+' / 02</span></p><h2 id="acct-title" tabindex="-1">'+(code?'Check your inbox.':(reauthenticating?'Confirm it’s you.':'Your email. One account.'))+'</h2><p class="acct-note">'+(code?(registration?'Email is not registered yet. Verify the code to create your account and sign in.':'Your email is registered. Verify the code to sign in securely.')+'<br>Code sent to <b>'+esc(email)+'</b>.':'Enter your email. We’ll detect whether you already have an account and send a verification code.')+'</p><form class="acct-form"><label for="acct-input">'+(code?'Email verification code':'Your email address')+'</label><input id="acct-input" '+(code?'type="text" inputmode="numeric" pattern="[0-9]{6}" minlength="6" maxlength="6" autocomplete="one-time-code"':'type="email" maxlength="120" autocomplete="email"')+' required autocapitalize="off" autocorrect="off" spellcheck="false" aria-describedby="acct-message'+(code?' acct-countdown':'')+'" '+(!code?'value="'+esc(email)+'"'+(reauthenticating?' readonly':''):'')+'><button class="btn btn-dark" type="submit">'+(code?(registration?'Verify and create account':'Verify and login'):'Send verification code')+'<span aria-hidden="true"> →</span></button></form>'+(!code?'<div class="acct-passkeys" hidden></div>':'')+(code?'<div class="acct-code-status"><p id="acct-countdown" role="timer" aria-live="off"></p><button class="acct-link" type="button" data-resend disabled>Resend code</button></div>':'')+'<p id="acct-message" class="acct-msg" role="status" aria-live="polite">'+esc(msg)+'</p>'+(code?'<button class="acct-link" type="button" data-back>'+(reauthenticating?'Back to account':'Use a different email')+'</button>':'<p class="acct-note acct-privacy">We use your email for account verification and service messages. <a href="privacy.html">Privacy notice</a></p>');
    body.querySelector('[data-back]')?.addEventListener('click',()=>{generation++;busy=false;step='email';codeDeadline=0;msg='';reauthenticating=false;render();focusStep();});
    body.querySelector('[data-resend]')?.addEventListener('click',()=>{if(!busy&&Date.now()>=codeDeadline)requestCode();});
    body.querySelector('form').addEventListener('submit',async event=>{
      event.preventDefault();if(busy)return;
      const input=body.querySelector('input');if(!input.reportValidity())return;
      if(step!=='code'){email=input.value.trim().toLowerCase();await requestCode();return;}
      if(Date.now()>=codeDeadline){syncCountdown();return;}
      const operation=++generation,value=input.value.trim();setBusy(true);announce('Verifying your code…');
      try{
        const result=await accountRequest({step:'verify',email,code:value});if(operation!==generation)return;
        if(!result.ok){
          if(result.error==='code_expired'){codeDeadline=0;syncCountdown();return;}
          announce(result.error==='limit'?'Too many incorrect codes. Please wait before trying again.':'That code is incorrect. Check your email and try again.',true);input.setAttribute('aria-invalid','true');input.focus();return;
        }
        if(!result.token||!result.email||(result.subscriptions!==null&&!Array.isArray(result.subscriptions)))throw new Error('Sign-in could not be completed. Please try again.');
        msg='';step='email';codeDeadline=0;reauthenticating=false;setAccountSession(result);status();if(purpose){purpose='';close();}
      }catch(error){if(operation===generation)announce(error.message||'Could not reach the service. Please try again.',true);}
      finally{if(operation===generation)setBusy(false);}
    });
    body.querySelector('input').addEventListener('input',event=>{event.target.removeAttribute('aria-invalid');if(step!=='code'||Date.now()<codeDeadline)announce('');});
    if(!code)mountAccountPasskeys(null);
    if(code){syncCountdown();if(dlg.open)countdownTimer=setInterval(syncCountdown,1000);}
  }
  function mountAccountPasskeys(session){
    mountPasskeys(body.querySelector('.acct-passkeys'),{session,onSession:result=>{
      if(!result.token||!result.email)throw Error('Passkey sign-in could not be completed.');
      generation++;step='email';msg='';reauthenticating=false;setAccountSession(result);status();if(purpose){purpose='';close();}
    },onReauth:()=>{
      const saved=getAccountSession();if(!saved)return;
      generation++;reauthenticating=true;email=saved.email;step='email';msg='';render();requestCode();
    }});
  }
  function syncCountdown(){
    const timer=body.querySelector('#acct-countdown');if(!timer)return;
    const seconds=Math.max(0,Math.ceil((codeDeadline-Date.now())/1000));
    timer.textContent=seconds?'Code expires in '+Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0'):'Code expired';
    body.querySelector('[type=submit]').disabled=busy||seconds===0;
    body.querySelector('[data-resend]').disabled=busy||seconds>0;
    if(!seconds){clearInterval(countdownTimer);announce('This code has expired. Resend to receive a new code.',true);}
  }
  async function requestCode(){
    cancelPasskey();
    const operation=++generation;setBusy(true);announce('Checking your email and sending a code…');
    try{
      let result=await accountRequest({step:'code',email,intent:'auto'});
      // Compatibility with an older Apps Script while its deployment is being updated.
      if(!result.ok&&result.error==='not_registered')result=await accountRequest({step:'code',email,intent:'register'});
      if(operation!==generation)return;
      if(!result.ok){announce(result.error==='limit'?'Too many requests. Please wait an hour before requesting another code.':result.error==='email'?'Enter a valid email address.':'Could not send your code. Please try again.',true);return;}
      registration=result.registered===false;
      // Old deployments send ten-minute codes without expiry metadata. Show their real lifetime until redeployed.
      const lifetime=result.expiresIn===undefined?600:Math.min(120,Math.max(0,Number(result.expiresIn)||0));
      codeDeadline=Date.now()+lifetime*1000;
      step='code';msg='';render();focusStep();
    }catch(error){if(operation===generation)announce(error.message||'Could not send your code. Please try again.',true);}
    finally{if(operation===generation)setBusy(false);}
  }
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&dlg.open&&step==='code')syncCountdown();});
  function refresh(){
    const session=getAccountSession(),subs=session?.subscriptions;
    const active=subs?.map(s=>({s,d:describe(s)})),best=active?.find(x=>x.d.state==='active'||x.d.state==='ending')||active?.[0];
    btn.textContent=!session?'Register / Login':landingAccount&&Array.isArray(subs)&&!subs.length?'No subscription':!pill||!best?'Account':best.d.state==='ended'?label(best.s.plan)+' · Renew':best.d.state==='unknown'?'Account':(active.length>1?'Subscribed':label(best.s.plan))+' · '+totalDays(subs)+'d left';
    if(landingAccount)pill.dataset.signedIn=String(!!session);
    btn.dataset.state=best?.d.state||'';btn.classList.toggle('is-updating',updating);
    btn.setAttribute('aria-label',session?'Account: '+session.email+'. '+btn.textContent+(updating?'. Updating subscription details.':''):'Register / Login');
    for(const plan of ['online','offline']){
      const a=document.querySelector('[data-buy="'+plan+'"]');if(!a)continue;
      const mine=active?.find(x=>x.s.plan===plan&&(x.d.state==='active'||x.d.state==='ending'))||active?.find(x=>x.s.plan===plan);
      if(!a.dataset.orig)a.dataset.orig=a.textContent;
      planStatus(a,mine);
      if(!mine){if(a.classList.contains('is-owned'))a.textContent=a.dataset.orig;a.classList.remove('is-owned','is-covered');delete a.dataset.state;continue;}
      a.classList.add('is-owned');a.dataset.state=mine.d.kind;
      // While the plan still has time left, the status card replaces the button; it returns as "Renew" once access ends.
      a.classList.toggle('is-covered',mine.d.state==='active'||mine.d.state==='ending');
      a.textContent=mine.d.state==='ended'?'Renew '+label(plan):mine.d.state==='unknown'?'View account':(mine.d.kind==='trial'?'Free trial · ':'Your plan · ')+mine.d.short;
    }
  }
  /* Status card under a plan's button: state, time left, renewal date and an in-place cancel. */
  const calm=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
  function countTo(node,target){
    const from=Number(node.dataset.value||0);node.dataset.value=String(target);
    const write=n=>{node.textContent=target?dayWord(n)+' left':'Ended';};
    if(calm()||from===target){write(target);return;}
    const t0=performance.now(),run=now=>{const k=Math.min(1,(now-t0)/700),e=1-Math.pow(1-k,3);write(Math.round(from+(target-from)*e));if(k<1)requestAnimationFrame(run);};requestAnimationFrame(run);
  }
  function planStatus(a,mine){
    let box=a.nextElementSibling?.classList.contains('plan-status')?a.nextElementSibling:null;
    if(!mine||mine.d.state==='unknown'){
      if(box&&!box.dataset.leaving){box.dataset.leaving='';const done=()=>box.remove();if(calm())done();else{box.addEventListener('animationend',done,{once:true});setTimeout(done,500);}}
      return;
    }
    if(box&&box.dataset.leaving!==undefined){box.remove();box=null;}
    const s=mine.s,d=mine.d;
    if(!box){
      box=document.createElement('div');box.className='plan-status';
      box.innerHTML='<div class="ps-head"><span class="ps-badge"><i aria-hidden="true"></i><b></b></span><span class="ps-days" data-value="0"></span></div><div class="ps-meter" aria-hidden="true"><span></span></div><p class="ps-text"></p><div class="ps-links"><button type="button" class="ps-manage">Manage account</button><button type="button" class="ps-cancel"></button></div><div class="ps-confirm" hidden><div class="ps-confirm-inner"><p></p><div class="ps-actions"><button type="button" class="ps-keep">Keep my plan</button><button type="button" class="ps-yes">Yes, cancel</button></div></div></div><p class="ps-msg" role="status" aria-live="polite"></p>';
      a.after(box);
      const confirmBox=box.querySelector('.ps-confirm'),cancel=box.querySelector('.ps-cancel'),msgNode=box.querySelector('.ps-msg');
      const toggle=show=>{if(show){confirmBox.hidden=false;requestAnimationFrame(()=>confirmBox.dataset.open='');box.querySelector('.ps-keep').focus();}else{delete confirmBox.dataset.open;const hide=()=>{if(confirmBox.dataset.open===undefined)confirmBox.hidden=true;};calm()?hide():setTimeout(hide,320);cancel.focus();}cancel.setAttribute('aria-expanded',String(show));};
      cancel.addEventListener('click',()=>{msgNode.textContent='';toggle(confirmBox.hidden);});
      box.querySelector('.ps-manage').addEventListener('click',()=>{purpose='';open();});
      box.querySelector('.ps-keep').addEventListener('click',()=>toggle(false));
      box.querySelector('.ps-yes').addEventListener('click',async()=>{
        const sub=box._sub;if(!sub)return;
        const yes=box.querySelector('.ps-yes'),keep=box.querySelector('.ps-keep');yes.disabled=keep.disabled=true;yes.textContent='Cancelling…';box.setAttribute('aria-busy','true');
        try{
          const result=await cancelSubscription(sub);
          toggle(false);msgNode.dataset.kind='ok';
          msgNode.textContent=result.external?'Finish cancelling in the PayPal window that opened.':'Cancelled. You won’t be charged again, and you keep access until '+fmtDate(result.endsAt||sub.endsAt)+'.';
        }catch(error){msgNode.dataset.kind='error';msgNode.textContent=error.message;}
        finally{yes.disabled=keep.disabled=false;yes.textContent='Yes, cancel';box.removeAttribute('aria-busy');}
      });
    }
    box._sub=s;
    const previous=box.dataset.state;box.dataset.state=d.kind;
    if(previous&&previous!==d.kind&&!calm()){box.classList.remove('ps-changed');void box.offsetWidth;box.classList.add('ps-changed');}
    box.querySelector('.ps-badge b').textContent={trial:'Free trial',active:'Active',cancelled:s.trial?'Trial cancelled':'Cancelled',ended:'Expired'}[d.kind];
    countTo(box.querySelector('.ps-days'),d.days);
    const period=s.trial?2:s.billing==='yearly'?365:31,fill=Math.max(d.days?.04:0,Math.min(1,d.days/period));
    const bar=box.querySelector('.ps-meter span');requestAnimationFrame(()=>requestAnimationFrame(()=>bar.style.transform='scaleX('+fill.toFixed(3)+')'));
    box.querySelector('.ps-text').textContent=d.kind==='trial'?'Your first payment is on '+d.date+'. Cancel before then and you won’t be charged.':d.kind==='active'?'Renews automatically on '+d.date+'.':d.kind==='cancelled'?'Won’t renew. Your access continues until '+d.date+'.':'Ended '+(d.date||'')+'. Renew to keep using Wrapline.';
    const cancel=box.querySelector('.ps-cancel'),can=canCancel(s);cancel.hidden=!can;cancel.textContent=s.trial?'Cancel free trial':'Cancel subscription';
    box.querySelector('.ps-confirm p').textContent=(s.trial?'Cancel your free trial? You won’t be charged, and you can keep using Wrapline until ':'Cancel automatic renewal? You won’t be charged again, and you keep full access until ')+(d.date||'the end of your period')+'.';
    if(!can){const c=box.querySelector('.ps-confirm');delete c.dataset.open;c.hidden=true;}
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
  document.addEventListener('click',event=>{const a=event.target.closest('.is-owned');if(a&&/Your plan|View account|Free trial/.test(a.textContent)){event.preventDefault();open();}});
  refresh();
  let autoOpen=false;try{autoOpen=sessionStorage.getItem('ajoy.acct.open')==='1';sessionStorage.removeItem('ajoy.acct.open');email=sessionStorage.getItem('ajoy.acct.email')||'';sessionStorage.removeItem('ajoy.acct.email');}catch{}
  if(autoOpen)open();
  status();
}
