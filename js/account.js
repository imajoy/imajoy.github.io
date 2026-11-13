/* Email-code sign-in with an immediate cached summary and live subscription refresh. */
import {orb} from './mood-orb.js?v=mo1';
import {isDisposableEmail,EMAIL_POLICY_TEXT,EMAIL_TEMP_TEXT} from './email-policy.js?v=ep1r1';
import {confirmLeave} from './confirm-leave.js?v=cl3';
import {getAccountSession,setAccountSession,clearAccountSession,onAccountChange,accountRequest} from './account-session.js?v=20261023-p7';
import './profile-menu.js?v=20261113-pm17r1';
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
    return {state:'ended',kind:'ended',text:'Ended'+(date?' '+date:'')+' · renew to keep using Wrapline Pro',short:'Renew',days:0,date};
  };
  function subscriptionCard(s,index){
    const d=describe(s),badge=d.state==='ending'?'Renewal off':d.state==='ended'?'Ended':d.state==='unknown'?'Unavailable':s.trial?'Trial active':'Active';
    const detail=d.state==='ending'?'Access until '+d.date+'. No further renewals.':d.state==='active'?(s.trial?'First payment on ':'Renews on ')+d.date+(s.trial?' unless you cancel.':'.'):d.text;
    const seats=Number(s.seats||1);
    const span=s.trial?Math.max(d.days,7):s.billing==='yearly'?365:31,fill=d.days>0?Math.max(.04,Math.min(1,d.days/span)):0;
    return '<section class="acct-sub ax-pass" data-state="'+esc(d.state)+'" aria-label="Wrapline Pro '+label(s.plan)+' subscription"><div class="ax-pass-top"><span class="ax-brand"><i aria-hidden="true"></i>Wrapline Pro</span><span class="acct-sub-badge">'+badge+'</span></div>'+
      '<div class="ax-pass-mid">'+(d.days>0?'<div class="ax-ring" style="--f:'+fill.toFixed(3)+'" aria-hidden="true"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="44"/><circle class="ax-ring-on" cx="50" cy="50" r="44" pathLength="100"/></svg><span><b>'+d.days+'</b><small>'+(d.days===1?'day left':'days left')+'</small></span></div>':'')+
      '<div class="ax-pass-info"><b class="ax-plan">'+label(s.plan)+'</b><span class="acct-sub-meta">'+(s.billing==='yearly'?'Yearly':'Monthly')+' · '+seats+(seats===1?' license':' licenses')+'</span><p class="acct-sub-detail">'+esc(detail)+'</p></div></div>'+
      (d.days>0?'<p class="ax-sr">'+d.days+' '+(d.days===1?'day':'days')+' of access left</p>':'')+'<div class="acct-sub-actions">'+
      (d.state==='ended'?'<a class="btn btn-dark btn-sm" href="checkout.html?plan='+encodeURIComponent(s.plan)+'&amp;billing='+encodeURIComponent(s.billing)+'">Renew plan</a>':'')+
      (d.days>0&&s.ref?'<a class="acct-link acct-history" href="thank-you.html?subscription='+encodeURIComponent(s.ref)+'">View confirmation <span aria-hidden="true">→</span></a>':'')+
      (canCancel(s)?'<button class="acct-link acct-stop" type="button" data-cancel-index="'+index+'">'+(s.trial?'Cancel free trial':'Cancel subscription')+'</button>':'')+'</div></section>';
  }
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
    closing=true;origin();dlg.dataset.closing='';
    if(!matchMedia('(prefers-reduced-motion: reduce)').matches){
      await new Promise(requestAnimationFrame);
      await Promise.race([Promise.allSettled(dlg.getAnimations().map(a=>a.finished)),new Promise(r=>setTimeout(r,460))]);
    }
    clearInterval(countdownTimer);dlg.close();delete dlg.dataset.closing;closing=false;
  }
  /* the panel unfolds from the button that opened it (and folds back into it); Android phones get a short buzz */
  function origin(){const b=document.querySelector('.pmx-btn,[data-account-button]');if(!b||!b.getBoundingClientRect)return;const r=b.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;dlg.style.setProperty('--ax',Math.round(cx-innerWidth/2)+'px');dlg.style.setProperty('--ay',Math.round(cy-innerHeight/2)+'px');}
  const buzz=ms=>{try{if(matchMedia('(pointer:coarse)').matches&&!matchMedia('(prefers-reduced-motion: reduce)').matches)navigator.vibrate?.(ms);}catch{}};
  function open() { if(closing)return;render();if(!dlg.open){origin();buzz(8);dlg.showModal();}if(step==='code'&&!getAccountSession()){clearInterval(countdownTimer);syncCountdown();countdownTimer=setInterval(syncCountdown,1000);}focusStep(); }
  function focusStep(){if(dlg.open)(body.querySelector('input')||body.querySelector('#acct-title'))?.focus({preventScroll:true});}
  dlg.querySelector('.acct-close').addEventListener('click',close);
  dlg.addEventListener('cancel',e=>{e.preventDefault();close();});
  dlg.addEventListener('click',e=>{const r=dlg.getBoundingClientRect();if(e.target===dlg&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom))close();});
  btn.addEventListener('click',()=>{purpose='';open();});
  window.addEventListener('ajoy-account-erase',()=>{if(!getAccountSession())return;erasePanel={stage:'intro',msg:''};open();});
  window.addEventListener('ajoy-account-open',event=>{purpose=event.detail?.purpose||'';if(event.detail?.email&&event.detail.email!==email){generation++;busy=false;step='email';codeDeadline=0;email=event.detail.email;msg='';}open();});
  function announce(text,error=false){msg=text;const n=body.querySelector('.acct-msg');if(n){n.textContent=text;n.dataset.error=String(error);} }
  function setBusy(value){busy=value;body.setAttribute('aria-busy',String(value));for(const button of body.querySelectorAll('button'))button.disabled=value;if(step==='code')syncCountdown();}
  /* Delete my account and data: needs a fresh emailed code, auto-submits when the 6 digits are entered. */
  let erasePanel=null;
  const eraseErrors={active_subscription:'Your subscription still has access left. You can delete your account once it has ended.',code:'That code is not right. Check the email and try again.',code_expired:'That code has expired. Go back and ask for a new one.',limit:'Too many attempts. Please wait a few minutes and try again.',expired:'Your session expired. Sign in again to delete your account.',busy:'The service is busy. Please try again in a moment.'};
  /* A small orb with a face; its mood (sad, listening, fading, goodbye) is driven entirely by CSS. */
  const buddy=orb;
  function renderErase(session){
    const st=erasePanel;
    if(st.stage==='done'){
      body.innerHTML='<div class="ez">'+buddy('bye')+'<h2 id="acct-title" tabindex="-1">Goodbye, and thank you.</h2><p class="acct-note">Your data is deleted. A confirmation is on its way.</p><button class="btn btn-dark" type="button" data-close>Close</button></div>';
      body.querySelector('[data-close]').onclick=()=>{erasePanel=null;dlg.close();};
      return;
    }
    if(st.stage==='intro'){
      body.innerHTML='<div class="ez">'+buddy('sad')+'<h2 id="acct-title" tabindex="-1">Leaving so soon?</h2><p class="acct-note">Your account, reviews and messages will be erased. <b>This cannot be undone.</b></p>'+(st.msg?'<p class="acct-note acct-error" role="alert">'+esc(st.msg)+'</p>':'')+'<button class="btn btn-dark" type="button" data-send>Send me a code</button><button class="acct-link" type="button" data-back>Keep my account</button></div>';
      body.querySelector('[data-back]').onclick=()=>{erasePanel=null;render();};
      body.querySelector('[data-send]').onclick=async event=>{
        const b=event.currentTarget;b.disabled=true;b.textContent='Sending…';
        try{const r=await accountRequest({step:'code',email:session.email,intent:'signin'});
          if(r.ok){erasePanel={stage:'code',msg:''};render();}else{erasePanel={stage:'intro',msg:eraseErrors[r.error]||'We could not send the code. Please try again.'};render();}
        }catch(error){erasePanel={stage:'intro',msg:error.message};render();}
      };
      return;
    }
    body.innerHTML='<div class="ez">'+buddy('listen')+'<h2 id="acct-title" tabindex="-1">Enter the code.</h2><p class="acct-note">Sent to <b>'+esc(session.email)+'</b>. It deletes your account right away.</p><input class="acct-input" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]*" aria-label="6-digit code" data-code><div class="eb-dots" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div>'+(st.msg?'<p class="acct-note acct-error" role="alert">'+esc(st.msg)+'</p>':'')+'<button class="acct-link" type="button" data-back>Cancel</button></div>';
    const input=body.querySelector('[data-code]');input.focus();
    body.querySelector('[data-back]').onclick=()=>{erasePanel=null;render();};
    input.addEventListener('input',async()=>{
      input.value=input.value.replace(/\D/g,'').slice(0,6);
      body.querySelectorAll('.eb-dots i').forEach((dot,at)=>dot.classList.toggle('on',at<input.value.length));
      if(input.value.length<6)return;
      input.disabled=true;body.querySelector('.eb').dataset.mood='fade';
      try{const r=await accountRequest({step:'erase',token:session.token,code:input.value},60000);
        if(r.ok){erasePanel={stage:'done'};try{for(const k of Object.keys(localStorage))if(/^ajoy[.-]/.test(k)&&k!=='ajoy-theme')localStorage.removeItem(k);for(const k of Object.keys(sessionStorage))if(/^ajoy\./.test(k))sessionStorage.removeItem(k);}catch{}clearAccountSession();render();}
        else{erasePanel={stage:r.error==='code_expired'||r.error==='active_subscription'?'intro':'code',msg:eraseErrors[r.error]||'We could not delete the account. Please try again.'};render();}
      }catch(error){erasePanel={stage:'code',msg:error.message};render();}
    });
  }
  /* the window grows or shrinks smoothly when its content changes (one short height animation, no snapping) */
  function render() {
    const from=dlg.open?dlg.getBoundingClientRect().height:0;
    renderNow();
    if(!from||!dlg.open||!dlg.animate)return;
    const to=dlg.getBoundingClientRect().height;
    if(Math.abs(to-from)<4)return;
    dlg.animate([{height:from+'px'},{height:to+'px'}],{duration:340,easing:'cubic-bezier(.22,1,.36,1)'});
  }
  function renderNow() {
    clearInterval(countdownTimer);
    if(erasePanel&&erasePanel.stage==='done'){renderErase(null);return;}
    const session=reauthenticating?null:getAccountSession(),subs=session?.subscriptions;
    body.dataset.stage=session?'account':step;dlg.querySelector('.acct-close').setAttribute('aria-label',session?'Close account':'Close sign-in');body.setAttribute('aria-busy',String(busy));
    if(session&&erasePanel){renderErase(session);return;}
    if(session){
      body.innerHTML='<div class="ax-head"><span class="ax-av" aria-hidden="true">'+esc((session.email[0]||'W').toUpperCase())+'</span><div class="ax-who"><p class="ax-k"><i aria-hidden="true"></i>Signed in</p><h2 id="acct-title" tabindex="-1">'+esc(session.email).replace('@','<wbr>@')+'</h2></div></div><p class="acct-note acct-sync" role="status">'+(updating?'Updating your subscription details…':offline?'Showing your saved account. Reconnect to update your details.':'Your verified account email is used automatically at checkout.')+'</p>'+
        (subs?.length>1&&totalDays(subs)?'<p class="acct-total">Total across your subscriptions: <b>'+dayWord(totalDays(subs))+' left</b></p>':'')+
        (subs===null?'':subs.length?subs.map(subscriptionCard).join(''):'<p class="acct-note">Your email is registered. <a href="wrapline.html#pricing">Explore subscriptions and trial availability</a>.</p>')+
        (session.limited?'<p class="acct-note">Only your latest subscription is shown. Sign out and verify your email to see every subscription.</p>':'')+

        (offline?'<button class="acct-link" type="button" data-retry>Try updating again</button>':'')+'<div class="acct-footer acct-footer-solo"><button class="acct-link ax-out" type="button" data-out><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M9 16l-4-4 4-4M5 12h11"/></svg>Sign out</button></div>';
      body.querySelector('[data-out]').onclick=async()=>{if(!(await confirmLeave('out')))return;const leaving=getAccountSession()?.token;if(leaving)accountRequest({step:'logout',token:leaving},8000).catch(()=>{});generation++;registration=false;step='email';email='';msg='';busy=false;clearAccountSession();};
      body.querySelector('[data-retry]')?.addEventListener('click',status);
      for(const stop of body.querySelectorAll('[data-cancel-index]'))stop.addEventListener('click',async()=>{
        const sub=subs[Number(stop.dataset.cancelIndex)];if(!sub)return;
        if(stop.dataset.confirm!=='1'){stop.dataset.confirm='1';stop.textContent='Confirm cancel · access continues until '+fmtDate(sub.endsAt);return;}
        stop.disabled=true;stop.textContent='Cancelling…';
        try{const result=await cancelSubscription(sub);if(result.external){stop.disabled=false;stop.dataset.confirm='';stop.textContent=sub.trial?'Cancel free trial':'Cancel subscription';announce('Finish cancelling in the PayPal window that opened.');}}
        catch(error){stop.disabled=false;stop.dataset.confirm='';stop.textContent=sub.trial?'Cancel free trial':'Cancel subscription';announce(error.message,true);}
      });
      return;
    }
    const code=step==='code';
    body.innerHTML=sgTop(code?'2':'1')+'<h2 id="acct-title" tabindex="-1">'+(code?'Check your email':(reauthenticating?'Confirm it’s you':'Sign in to Wrapline'))+'</h2><p class="sg-sub">'+(code?'We sent a 6-digit code to<b title="'+esc(email)+'">'+esc(email)+'</b>':(reauthenticating?'We’ll send a code to the email on your account.':'New here? The same step creates your account. No password needed.'))+'</p><form class="acct-form"><label for="acct-input">'+(code?'Email verification code':'Your email address')+'</label><input id="acct-input" '+(code?'placeholder="6-digit code" type="text" inputmode="numeric" pattern="[0-9]{6}" minlength="6" maxlength="6" autocomplete="one-time-code"':'placeholder="name@email.com" type="email" maxlength="120" autocomplete="email"')+' required autocapitalize="off" autocorrect="off" spellcheck="false" aria-describedby="acct-message'+(code?' acct-countdown':'')+'" '+(!code?'value="'+esc(email)+'"'+(reauthenticating?' readonly':''):'')+'><button class="btn btn-dark" type="submit">'+(code?(registration?'Verify and create account':'Verify and login'):'Send verification code')+'<span aria-hidden="true"> →</span></button></form>'+(code?'<div class="acct-code-status"><p id="acct-countdown" role="timer" aria-live="off"></p><button class="acct-link" type="button" data-resend disabled>Resend code</button></div>':'')+'<p id="acct-message" class="acct-msg" role="status" aria-live="polite">'+esc(msg)+'</p><div class="acct-bar" aria-hidden="true"><i></i></div>'+(code?'<button class="acct-link" type="button" data-back>'+(reauthenticating?'Back to account':'Use a different email')+'</button>':'<p class="acct-note acct-privacy">Email used only for sign-in. <a href="privacy.html">Privacy</a></p>');
    body.querySelector('[data-back]')?.addEventListener('click',()=>{generation++;busy=false;step='email';codeDeadline=0;msg='';reauthenticating=false;render();focusStep();});
    body.querySelector('[data-resend]')?.addEventListener('click',()=>{if(!busy&&Date.now()>=codeDeadline)requestCode();});
    body.querySelector('form').addEventListener('submit',async event=>{
      event.preventDefault();if(busy)return;
      const input=body.querySelector('input');if(!input.reportValidity())return;
      if(step!=='code'){email=input.value.trim().toLowerCase();await requestCode();return;}
      if(Date.now()>=codeDeadline){syncCountdown();return;}
      const operation=++generation,value=input.value.trim();setBusy(true);announce(registration?'Creating your account… this can take a few seconds.':'Signing you in… this can take a few seconds.');
      try{
        const result=await accountRequest({step:'verify',email,code:value});if(operation!==generation)return;
        if(!result.ok){
          if(result.error==='code_expired'){codeDeadline=0;msg='';syncCountdown();return;}
          announce(result.error==='limit'?'Too many incorrect codes. Please wait before trying again.':'That code is incorrect. Check your email and try again.',true);input.setAttribute('aria-invalid','true');input.closest('.acct-otp')?.setAttribute('data-bad','');setTimeout(()=>{if(operation===generation&&input.isConnected){input.value='';input.dispatchEvent(new Event('input',{bubbles:true}));input.closest('.acct-otp')?.removeAttribute('data-bad');}},650);input.focus();return;
        }
        if(!result.token||!result.email||(result.subscriptions!==null&&!Array.isArray(result.subscriptions)))throw new Error('Sign-in could not be completed. Please try again.');
        await celebrate();if(operation!==generation)return;
        msg='';step='email';codeDeadline=0;reauthenticating=false;setAccountSession(result);status();if(purpose){purpose='';close();}
      }catch(error){if(operation===generation)announce(error.message||'Could not reach the service. Please try again.',true);}
      finally{if(operation===generation)setBusy(false);}
    });
    /* the address always stays on one line: its text size shrinks to fit the window (never breaks a word) */
    body.querySelectorAll('.sg-sub b').forEach(b=>{let f=16;b.style.fontSize=f+'px';while(b.scrollWidth>b.clientWidth&&f>11){f-=.5;b.style.fontSize=f+'px';}});
    const field=body.querySelector('input'),form=body.querySelector('form');
    let slots=[];
    if(code){
      const wrap=document.createElement('div');wrap.className='acct-otp';field.replaceWith(wrap);
      slots=Array.from({length:6},()=>wrap.appendChild(document.createElement('i')));wrap.appendChild(field);
    }
    const paint=()=>{const v=field.value;slots.forEach((el,i)=>{const had=el.textContent;el.textContent=v[i]||'';el.classList.toggle('on',!!v[i]);el.classList.toggle('cur',i===Math.min(v.length,5)&&document.activeElement===field);if(v[i]&&!had){el.classList.remove('pop');void el.offsetWidth;el.classList.add('pop');}});};
    field.addEventListener('focus',paint);field.addEventListener('blur',paint);
    field.addEventListener('input',event=>{
      field.removeAttribute('aria-invalid');
      if(code){field.value=field.value.replace(/\D/g,'').slice(0,6);paint();}
      if(step!=='code'||Date.now()<codeDeadline)announce('');
      /* all six digits in (typed, pasted or filled from the email/SMS): send it without another click */
      if(code&&field.value.length===6&&!busy&&Date.now()<codeDeadline)form.requestSubmit();
    });
    if(code)paint();
    else{
      /* no button to press: the code is sent on Enter, on paste/autofill, or when you leave a valid address */
      const ok=()=>field.value.trim()&&field.checkValidity()&&!busy&&!field.readOnly;
      field.addEventListener('paste',()=>setTimeout(()=>{if(ok())form.requestSubmit();},60));
      field.addEventListener('change',()=>{if(ok())form.requestSubmit();});
      field.addEventListener('blur',e=>{if(ok()&&dlg.open&&!(e.relatedTarget&&e.relatedTarget.closest&&e.relatedTarget.closest('.acct-close')))setTimeout(()=>{if(ok()&&field.isConnected)form.requestSubmit();},120);});
    }
    if(code){syncCountdown();if(dlg.open)countdownTimer=setInterval(syncCountdown,1000);}
  }
  /* a short "you're in" moment between the code and the account view */
  const sgTop=(n)=>'<div class="sg-top"><span class="sg-brand"><span class="sg-mark" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M3.5 17C9 17 10 7 20.5 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M3.5 13.4 7 17l-3.5 3.6L0 17z" fill="currentColor" transform="translate(2 -3)"/></svg></span>Wrapline</span><span class="sg-steps" data-s="'+n+'" role="img" aria-label="Step '+n+' of 2"><i></i><i></i></span></div>';
    async function celebrate(){
    const calm=matchMedia('(prefers-reduced-motion: reduce)').matches;
    body.innerHTML=sgTop('2')+'<div class="sg-ok" aria-hidden="true"><svg viewBox="0 0 64 64"><circle class="sg-ok-ring" cx="32" cy="32" r="28"/><path class="sg-ok-tick" d="M20 33l8 8 16-17"/></svg></div><h2 id="acct-title" tabindex="-1">'+(registration?'Account created':'You’re in')+'</h2><p class="sg-sub">Opening your account…</p><div class="sg-prog" aria-hidden="true"><i></i></div>';
    await new Promise(r=>setTimeout(r,calm?200:1150));
  }
  function syncCountdown(){
    const timer=body.querySelector('#acct-countdown');if(!timer)return;
    const seconds=Math.max(0,Math.ceil((codeDeadline-Date.now())/1000));
    timer.textContent=seconds?'Code expires in '+Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0'):'Code expired';
    body.querySelector('[type=submit]').disabled=busy||seconds===0;
    body.querySelector('[data-resend]').disabled=busy||seconds>0;
    /* say "expired" once, never while a request is running and never over a real error (a failed resend used to be hidden by this line) */
    if(!seconds){clearInterval(countdownTimer);if(!busy&&!msg)announce('This code has expired. Resend to receive a new code.',true);}
  }
  async function requestCode(){
    if(isDisposableEmail(email)){announce(EMAIL_TEMP_TEXT,true);return;}
    const operation=++generation;setBusy(true);announce('Checking your email and sending a code… this can take a few seconds.');
    try{
      let result=await accountRequest({step:'code',email,intent:'auto'});
      // Compatibility with an older Apps Script while its deployment is being updated.
      if(!result.ok&&result.error==='not_registered')result=await accountRequest({step:'code',email,intent:'register'});
      if(operation!==generation)return;
      if(!result.ok){announce(result.error==='limit'?'Too many requests. Please wait an hour before requesting another code.':result.error==='email'?'Enter a valid email address.':result.error==='email_domain'?EMAIL_POLICY_TEXT:'Could not send your code. Please try again.',true);return;}
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
    btn.title=!session?'Sign in or register to see your plan and manage your subscription':best&&best.d.text?'Your plan: '+best.d.text+'. Click to manage your account.'+(document.body.classList.contains('free-page')?' The Wrapline free toolkit stays free for everyone; this counter is only for your Wrapline Pro subscription.':''):'Open your account';
    {const m=/^(.*?)\s*·\s*(\d+)d left$/.exec(btn.textContent||'');if(m&&session&&best&&best.d.state!=='ended'){const k=document.body.classList.contains('free-page')?'Pro plan':'Plan';btn.textContent='';const ke=document.createElement('span');ke.className='ab-k';ke.textContent=k;const ve=document.createElement('span');ve.className='ab-v';const n=document.createElement('b');n.textContent=m[2]+'d';ve.append(n,document.createTextNode(' left'));btn.append(ke,document.createTextNode(' '),ve);btn.classList.add('has-days');}else btn.classList.remove('has-days');}
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
    box.querySelector('.ps-text').textContent=d.kind==='trial'?'Your first payment is on '+d.date+'. Cancel before then and you won’t be charged.':d.kind==='active'?'Renews automatically on '+d.date+'.':d.kind==='cancelled'?'Won’t renew. Your access continues until '+d.date+'.':'Ended '+(d.date||'')+'. Renew to keep using Wrapline Pro.';
    const cancel=box.querySelector('.ps-cancel'),can=canCancel(s);cancel.hidden=!can;cancel.textContent=s.trial?'Cancel free trial':'Cancel subscription';
    box.querySelector('.ps-confirm p').textContent=(s.trial?'Cancel your free trial? You won’t be charged, and you can keep using Wrapline Pro until ':'Cancel automatic renewal? You won’t be charged again, and you keep full access until ')+(d.date||'the end of your period')+'.';
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
  // Links from the Wrapline Pro Setup window in Maya: wrapline.in/#register opens Register / Login at once;
  // #register=you@site.com also fills in the email. The address after # never reaches any server.
  try{const m=/^#register(?:=(.*))?$/.exec(location.hash);if(m){const wanted=decodeURIComponent(m[1]||'').trim().toLowerCase();if(wanted.length<=120&&/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(wanted))email=wanted;autoOpen=true;history.replaceState(null,'',location.pathname+location.search);}}catch{}
  if(autoOpen)open();
  status();
}
