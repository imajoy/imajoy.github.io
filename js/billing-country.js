import {getAccountSession,onAccountChange,clearAccountSession,openAccount} from './account-session.js?v=20261020-ps1';
const reasons={
 vpn_detected:'Your connection was flagged as a VPN or proxy. Turn it off, then retry to continue.',
 country_unavailable:'We could not verify your connection country. Retry the check or contact support.',
 network_unavailable:'We could not complete the network check. Retry in a moment or contact support.',
 country_mismatch:'Your connection country changed. Retry the check to update your billing country.'
};
export function initializeBillingCountry(form){
 const field=form.elements.country,grid=document.querySelector('.checkout-grid');
 const hint=document.createElement('p');hint.id='country-hint';hint.className='form-hint';field.after(hint);field.setAttribute('aria-describedby',hint.id);
 field.disabled=true;field.value='';
 const gate=document.createElement('section');gate.className='billing-network-gate';gate.setAttribute('role','status');gate.setAttribute('aria-live','polite');
 gate.innerHTML=`<div class="network-copy"><span class="network-kicker">A little check before checkout</span><h2>Checking your connection</h2><p data-network-message>Detecting your billing country securely…</p><div class="network-activity"><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i><span>Finding your region</span></div><div class="network-actions"><button type="button" class="btn btn-dark" data-network-retry>Retry check</button><button type="button" class="btn btn-light" data-network-signin>Register / Login</button><a class="text-link" href="contact.html?topic=billing">Contact support</a></div></div>
 <div class="network-art" aria-hidden="true"><div class="network-halo"></div><div class="network-orbit"><span></span><span></span></div><svg class="network-globe" viewBox="0 0 200 200" fill="none"><circle cx="100" cy="100" r="75"/><ellipse cx="100" cy="100" rx="32" ry="75"/><path d="M25 100h150M36 62c38 18 90 18 128 0M36 138c38-18 90-18 128 0"/></svg><div class="network-pin"><svg viewBox="0 0 48 56" fill="none"><path d="M24 52S5 32 5 22a19 19 0 1 1 38 0c0 10-19 30-19 30Z"/><circle cx="24" cy="22" r="7"/></svg></div><span class="network-chip network-chip-device"><svg viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="13" rx="3"/><path d="M8 21h8M12 17v4"/></svg>Your connection</span><span class="network-chip network-chip-region"><span></span>Billing country</span></div>`;
 grid.before(gate);
 const root=document.documentElement,retry=gate.querySelector('[data-network-retry]');
 // Decorative motion never determines verification or delays the actual result.
 let inView=true;
 const pauseMotion=()=>{gate.dataset.motionPaused=String(document.hidden||!inView);};
 if('IntersectionObserver' in window)new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;pauseMotion();}).observe(gate);
 document.addEventListener('visibilitychange',pauseMotion);pauseMotion();
 let country='',tester=false,revision=0,accountToken=getAccountSession()?.token,configPromise;
 const config=()=>configPromise||=(async()=>{const response=await fetch(window.AJOY_CONFIG.paypalConfigUrl,{cache:'no-store',signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error();return response.json();})().catch(error=>{configPromise=null;throw error;});
 const valid=c=>typeof c==='string'&&/^[A-Z]{2}$/.test(c)&&!['XX','ZZ','EU'].includes(c);
 function announce(blocked,reason='',pending=false){
  gate.dataset.state=pending?'checking':blocked?'error':'ready';gate.setAttribute('aria-busy',String(pending));
  root.dataset.billingBlocked=blocked?'true':'false';root.dataset.billingTester=String(tester);
  grid.hidden=blocked;gate.hidden=!blocked;
  if(blocked){gate.querySelector('h2').textContent=pending?'Checking your connection':reason==='vpn_detected'?'Turn off your VPN to continue':'Connection check needed';gate.querySelector('[data-network-message]').textContent=pending?'Detecting your billing country securely…':reasons[reason]||reasons.network_unavailable;}
  retry.disabled=pending;
  hint.textContent=tester?'Verified testing account: you can choose a country. Provider restrictions and payment verification still apply.':country?'Detected by the server from your connection. This field cannot be edited.':'Waiting for the server to confirm your billing country.';
  document.dispatchEvent(new CustomEvent('ajoy:billing-network',{detail:{blocked,country,canEdit:tester}}));
 }
 async function refresh(){
  const operation=++revision,session=getAccountSession(),previousTester=tester,previousCountry=field.value;
  tester=false;field.disabled=true;retry.disabled=true;if(country)field.value=country;
  if(!country)announce(true,'',true);
  else{root.dataset.billingTester='false';hint.textContent='Confirming account permissions…';}
  try{
   const cfg=await config();let context={country:cfg.country,canEditCountry:false,blocked:!valid(cfg.country),reason:'country_unavailable'};
   if(cfg.billingPolicyEnabled){
    const response=await fetch(window.AJOY_CONFIG.commerceUrl+'/billing-context',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(session?{accountToken:session.token}:{}),signal:AbortSignal.timeout(25000)});
    if(response.status===401&&session&&getAccountSession()?.token===session.token){clearAccountSession();return;}
    context=await response.json();if(!response.ok||!context.ok)throw Error();
   }
   if(operation!==revision||getAccountSession()?.token!==session?.token)return;
   country=valid(context.country)?context.country:'';tester=context.canEditCountry===true;
   const chosen=tester&&previousTester&&valid(previousCountry)?previousCountry:country;
   if(chosen&&![...field.options].some(o=>o.value===chosen))field.add(new Option(new Intl.DisplayNames([navigator.language||'en'],{type:'region'}).of(chosen),chosen));
   field.value=chosen;field.disabled=!tester;
   const blocked=context.blocked===true||(!country&&!tester);
   announce(blocked,context.reason||'country_unavailable');
   field.dispatchEvent(new Event('change',{bubbles:true}));
  }catch{if(operation===revision){country='';tester=false;field.value='';field.disabled=true;announce(true,'network_unavailable');}}
 }
 // Native disabled controls stop ordinary editing; payment servers independently
 // reject tampering, including same-tier substitutions and forged tester claims.
 form.addEventListener('change',()=>{if(!tester&&field.value!==country)field.value=country;},true);
 retry.onclick=()=>{configPromise=null;refresh();};gate.querySelector('[data-network-signin]').onclick=()=>openAccount({purpose:'checkout'});
 onAccountChange(()=>{const next=getAccountSession()?.token;if(next===accountToken)return;accountToken=next;refresh();});
 document.addEventListener('ajoy:billing-denied',event=>{if(reasons[event.detail?.code]){tester=false;field.disabled=true;announce(true,event.detail.code);}});
 refresh();
}
