import {indiaContact} from './india-availability.js?v=20261019-contact1';
/* Clear, contextual offers. Promotions never authorize a trial or change a paid selection. */
import {loadTrialConfig,trialPlanId} from './trial.js?v=20261018-j3';
import {detectGeo,cachedGeo} from './geo.js?v=20261019-geo1';
import {availability,closedMessage} from './regions.js?v=20261018-g5';
import {getAccountSession,onAccountChange} from './account-session.js?v=20261018-n1';
import {canShowTrialNudge,PROMO_DELAY} from './promotion-policy.js?v=20261018-p1';
const isHome=Boolean(document.querySelector('.trial-showcase'));
const home=isHome?'#trial':'wrapline.html#trial';
const isDiscovery=Boolean(document.querySelector('.tool-page'));
let config=null,country=cachedGeo(),settled=false,billing='',nudge=null;
const alreadyOnline=()=>getAccountSession()?.subscriptions?.some(s=>s.plan==='online'&&s.status==='ACTIVE'&&Date.parse(s.endsAt)>Date.now());
function render(){
  const subscribed=alreadyOnline(),inIndia=country==='IN',known=/^[A-Z]{2}$/.test(country);
  billing=known&&trialPlanId(config,'online','monthly',country)?'monthly':known&&trialPlanId(config,'online','yearly',country)?'yearly':'';
  const region=known?availability(country,config?.closedCountries||[]):null;
  const fallback=region&&!region.open?'wrapline.html#pricing':isHome?'checkout.html?plan=online&billing=monthly&offer=trial':home;
  for(const link of document.querySelectorAll('[data-trial-cta]')){
    link.href=subscribed?'wrapline.html#pricing':inIndia?indiaContact():billing?'checkout.html?'+new URLSearchParams({plan:'online',billing,offer:'trial',v:'20261018-p1'}):fallback;
    // Keep the word trial when configuration/location cannot be confirmed.
    link.textContent=subscribed?'View your Online plan':inIndia?'Ask about availability in India':billing?'Start my 2-day free trial':region&&!region.open?'Check trial availability':'Explore the 2-day free trial';
    link.toggleAttribute('data-region-unavailable',Boolean(region&&!region.open&&!subscribed));
    if(isHome&&inIndia&&!subscribed)link.textContent='Get launch updates';
    if(isHome&&inIndia&&!subscribed&&link.classList.contains('hero-secondary')){
      link.href='#workflows';link.textContent='Explore workflows';link.removeAttribute('data-region-unavailable');
    }
    link.dataset.trialReady=String(Boolean(billing&&!subscribed));
  }
  const mobileTrial=document.querySelector('.m-cta a:not(.primary)');
  if(mobileTrial){mobileTrial.href=subscribed?'#pricing':inIndia?indiaContact():'#trial';mobileTrial.textContent=subscribed?'Your Online plan':inIndia?'Get updates':'2-day trial';}
  for(const teaser of document.querySelectorAll('[data-trial-teaser]')){
    if(!teaser.dataset.originalCopy)teaser.dataset.originalCopy=teaser.textContent;
    teaser.textContent=isHome?teaser.dataset.originalCopy:inIndia&&!subscribed?'India checkout and the Online trial are not open yet. Ask Ajoy for launch updates.':teaser.dataset.originalCopy;
  }
  const message=subscribed?'You already have an active Online subscription. View your plan or account.':billing?'For eligible customers. Verify your email and approve in PayPal. Paid billing follows the 2-day trial unless cancelled.':inIndia?'Checkout and the 2-day Online trial are not available in India yet. Use the email link to ask Ajoy for launch updates.':region&&!region.open?closedMessage[region.reason]:settled?'Trial availability is confirmed at checkout. Verified registration and PayPal approval are required.':'Checking trial availability. Verified registration and PayPal approval are required.';
  for(const notice of document.querySelectorAll('[data-trial-status]')){notice.hidden=isHome&&inIndia;notice.textContent=isHome&&inIndia?'':message;}
  if(getAccountSession())closeNudge();
  tryNudge();
}
// Choose the visible interval without replacing the form's pricing or payment code.
const form=document.querySelector('#billing-form');
if(form){
  const control=document.querySelector('[data-offer-yearly]');
  const sync=()=>{
    const yearly=form.elements.billing.value==='yearly';
    document.querySelector('[data-offer-heading]').textContent=yearly?'Your yearly plan includes 20% savings.':'Save 20% with yearly billing.';
    document.querySelector('[data-offer-copy]').textContent=yearly?'Compared with 12 standard monthly payments. Review the annual total below.':'Same 13 tools. A lower price than paying monthly for a year.';
    control.hidden=yearly;
  };
  control?.addEventListener('click',()=>{form.elements.billing.value='yearly';form.elements.billing.dispatchEvent(new Event('change',{bubbles:true}));});
  form.elements.billing.addEventListener('change',sync);sync();
}
// Each new promotional animation starts once, on entry, and settles.
const offers=document.querySelectorAll('.trial-banner,.trial-stage,.tool-trial,.offer-inline');
if('IntersectionObserver' in window){
  const observer=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting){e.target.setAttribute('data-offer-in','');observer.unobserve(e.target);}},{threshold:.1});
  offers.forEach(el=>observer.observe(el));
}else offers.forEach(el=>el.setAttribute('data-offer-in',''));
const shownKey='ajoy.promo.trial.lastShown',sessionKey='ajoy.promo.trial.seen',started=performance.now();
let storageAvailable=true,lastShown=0,sessionSeen=false,opening=false,closing=false;
if(isDiscovery){
  try{lastShown=Number(localStorage.getItem(shownKey))||0;sessionSeen=sessionStorage.getItem(sessionKey)==='1';}
  catch{storageAvailable=false;}
  setTimeout(tryNudge,PROMO_DELAY+50);
  window.addEventListener('scroll',tryNudge,{passive:true});
  document.addEventListener('visibilitychange',tryNudge);
  document.addEventListener('ajoy-account-open',closeNudge);
  window.addEventListener('storage',event=>{if(event.key===shownKey){lastShown=Number(event.newValue)||0;closeNudge();}});
}
function tryNudge(){
  try{if(sessionStorage.getItem('ajoy.discovery.nudge')==='1'||Date.now()-Number(localStorage.getItem('ajoy.guest.lastShown')||0)<7*864e5)return;}catch{return;}
  if(!isDiscovery||!storageAvailable||opening||nudge)return;
  const focused=document.activeElement;
  if(!canShowTrialNudge({now:Date.now(),lastShown,sessionSeen,elapsed:performance.now()-started,scrolled:scrollY>=Math.min(300,innerHeight*.35),available:!!billing,signedIn:!!getAccountSession(),busy:!!document.querySelector('dialog[open]')||!!focused?.closest('input,textarea,select,[contenteditable="true"]'),visible:document.visibilityState==='visible',viewportHeight:innerHeight}))return;
  // Shared across pages, tabs and visits. If storage fails, skip automatic display.
  try{lastShown=Date.now();localStorage.setItem(shownKey,String(lastShown));sessionStorage.setItem(sessionKey,'1');sessionSeen=true;}catch{return;}
  opening=true;
  nudge=document.createElement('aside');nudge.className='trial-nudge';
  nudge.setAttribute('role','region');nudge.setAttribute('aria-labelledby','trial-nudge-title');
  nudge.innerHTML='<button type="button" class="offer-close" aria-label="Dismiss free trial offer">×</button><div class="nudge-art" aria-hidden="true"><span class="nudge-orbit"></span><div class="nudge-pass"><span>WRAPLINE / ONLINE</span><b>2<span>days</span></b><small>FREE TRIAL</small></div><span class="nudge-tool nudge-tool-one">IK / FK</span><span class="nudge-tool nudge-tool-two">EXPORT</span></div><div class="nudge-copy"><p class="offer-eyebrow">13 MAYA TOOLS. ONE FREE TRIAL.</p><h2 id="trial-nudge-title">Your next project.<br><em>Try it free for 2 days.</em></h2><p>All 13 Maya tools. Your own scenes. See what fits your workflow.</p><a class="btn btn-blue" href="'+('checkout.html?'+new URLSearchParams({plan:'online',billing,offer:'trial'}))+'">Explore my free trial <svg class="offer-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 18L18 6M6 6h12v12"/></svg></a><p class="nudge-terms">Eligible customers only. Verified email and PayPal approval required. Renews into a paid subscription after 2 days unless cancelled.</p><button class="offer-later" type="button">Maybe later</button></div>';
  const native=typeof nudge.showPopover==='function';
  if(native)nudge.setAttribute('popover','auto');
  document.body.append(nudge);
  nudge.querySelector('.offer-close').addEventListener('click',closeNudge);
  nudge.querySelector('.offer-later').addEventListener('click',closeNudge);
  nudge.addEventListener('toggle',event=>{if(event.newState==='closed')nudge.hidden=true;});
  if(native)nudge.showPopover();else nudge.hidden=false;
  nudge.setAttribute('data-offer-in','');opening=false;
  // No focus stealing, backdrop, focus trap or scroll lock for marketing.
  document.addEventListener('keydown',event=>{if(event.key==='Escape')closeNudge();});
  document.addEventListener('pointerdown',event=>{if(nudge&&!nudge.contains(event.target))closeNudge();},{capture:true});
  document.addEventListener('focusin',event=>{if(!nudge.contains(event.target)&&event.target.closest('input,textarea,select'))closeNudge();});
  const accountObserver=new MutationObserver(()=>{if(document.querySelector('dialog[open]'))closeNudge();});
  accountObserver.observe(document.body,{attributes:true,attributeFilter:['open'],subtree:true});
}
async function closeNudge(){
  if(!nudge||nudge.hidden||closing)return;
  closing=true;nudge.setAttribute('data-closing','');
  const focused=nudge.contains(document.activeElement);
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches){
    await new Promise(requestAnimationFrame);
    await Promise.race([Promise.allSettled(nudge.getAnimations().map(a=>a.finished)),new Promise(r=>setTimeout(r,300))]);
  }
  const returnFocus=focused&&nudge.contains(document.activeElement)&&!document.querySelector('dialog[open]');
  if(typeof nudge.hidePopover==='function'&&nudge.matches(':popover-open'))nudge.hidePopover();
  nudge.hidden=true;closing=false;
  if(returnFocus)document.querySelector('.trial-banner,.tool-copy [data-trial-cta]')?.focus({preventScroll:true});
}
if(document.querySelector('[data-trial-cta]')){
  onAccountChange(render);render();
  loadTrialConfig().then(async value=>{config=value;country=/^[A-Z]{2}$/.test(config?.country||'')?config.country:(await detectGeo())||cachedGeo();settled=true;render();}).catch(()=>{settled=true;render();});
}
