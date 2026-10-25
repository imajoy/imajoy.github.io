/* Clear, contextual offers. Promotions never authorize a trial or change a paid selection. */
import {loadTrialConfig,trialPlanId} from './trial.js?v=20261023-p5';
import {detectGeo,cachedGeo} from './geo.js?v=20261019-geo1';
import {availability,closedMessage,YEARLY_PERCENT,yearlyOfferUsed} from './regions.js?v=20261023-p7';
import {getAccountSession,onAccountChange,openAccount} from './account-session.js?v=20261023-p7';
import {canShowTrialNudge,PROMO_DELAY} from './promotion-policy.js?v=20261019-contact1';
import {loadRazorpayConfig,razorpayAvailable} from './razorpay-config.js?v=20261021-fast2';
import {subscriptionPromotion} from './subscription-promotion.js?v=20261025-cta1';
const isHome=Boolean(document.querySelector('.trial-showcase'));
const home=isHome?'#trial':'wrapline.html#trial';
/* Trial buttons open the pricing section (never the billing page directly); the plan card there starts checkout. */
const pricingHref=isHome?'#pricing':'wrapline.html#pricing';
const isDiscovery=Boolean(document.querySelector('.tool-page'));
let config=null,country=cachedGeo(),settled=false,billing='',nudge=null,razorpayConfig=null;
const memberLabel=kind=>kind==='trial'?'Manage my trial':kind==='paid'?'Manage my subscription':kind==='past'?'Explore plans':'View my account';
const accountHref='wrapline.html#register';
function render(){
  const member=subscriptionPromotion(getAccountSession()),subscribed=member.kind!=='new',manage=subscribed&&member.kind!=='past',inIndia=country==='IN',known=/^[A-Z]{2}$/.test(country);
  const summary=document.querySelector('.hero-trial-summary');
  if(summary)summary.hidden=subscribed&&(member.kind!=='trial'||!member.subscription.renews);
  const indiaOpen=inIndia&&razorpayAvailable(razorpayConfig,'IN');
  // Razorpay offers the same 4-day trial where it is the payment option.
  const region=known?availability(country,config?.closedCountries||[]):null;
  // Where PayPal is not offered (India, or no PayPal support), the trial runs through Razorpay.
  const rzpTrial=known&&!!razorpayConfig?.trial&&razorpayAvailable(razorpayConfig,country)&&(inIndia||!region?.open||!trialPlanId(config,'online','monthly',country));
  billing=rzpTrial?'monthly':known&&region?.open&&trialPlanId(config,'online','monthly',country)?'monthly':known&&region?.open&&trialPlanId(config,'online','yearly',country)?'yearly':'';
  const reviewOnly=region&&!region.open&&!razorpayAvailable(razorpayConfig,country);
  const billingPage='checkout.html?plan=online&billing=monthly';
  const fallback=region&&!region.open?billingPage:pricingHref;
  for(const link of document.querySelectorAll('[data-trial-cta]')){
    link.href=manage?accountHref:subscribed||billing?pricingHref:fallback;
    link.toggleAttribute('data-manage-subscription',manage);
    // Keep the word trial when configuration/location cannot be confirmed.
    link.textContent=subscribed?memberLabel(member.kind):billing?'Start my 4-day free trial':region&&!region.open?'Review billing':'Explore the 4-day free trial';
    link.toggleAttribute('data-region-unavailable',Boolean(region&&!region.open&&!subscribed));
    if(reviewOnly&&!subscribed){link.href=billingPage;link.textContent='Review billing';link.removeAttribute('data-region-unavailable');}
    link.dataset.trialReady=String(Boolean(billing&&!subscribed));
    if(indiaOpen&&!rzpTrial&&!subscribed){link.href=pricingHref;link.textContent='Explore paid plans';link.removeAttribute('data-region-unavailable');}
    if(rzpTrial&&!subscribed){link.removeAttribute('data-region-unavailable');}
  }
  const mobileTrial=document.querySelector('.m-cta a:not(.primary)');
  if(mobileTrial){
   mobileTrial.toggleAttribute('data-manage-subscription',manage);
   mobileTrial.href=manage?accountHref:subscribed?'#pricing':reviewOnly?billingPage:'#trial';mobileTrial.textContent=subscribed?(member.kind==='past'?'Explore plans':'My account'):reviewOnly?'Review billing':'4-day trial';
   // Never show two identical "View plans" buttons side by side.
   mobileTrial.style.display=(indiaOpen&&!rzpTrial&&!subscribed)?'none':'';
  }
  for(const teaser of document.querySelectorAll('[data-trial-teaser]')){
    if(!teaser.dataset.originalCopy)teaser.dataset.originalCopy=teaser.textContent;
    teaser.textContent=isHome?teaser.dataset.originalCopy:reviewOnly&&!subscribed?'Review your plan and billing details. Payment options appear when available for your country.':teaser.dataset.originalCopy;
    if(rzpTrial&&!subscribed)teaser.textContent='Try the full Basic toolkit free for 4 days. Approve with '+(inIndia?'UPI or card':'your card')+' through Razorpay; nothing is charged today.';
    else if(indiaOpen&&!subscribed)teaser.textContent='Paid subscriptions are available with Razorpay in India.';
  }
  const memberMessage=member.kind==='trial'?'Your trial is already active. Manage it or download Wrapline to get started.':member.kind==='paid'?'Your subscription is active. Manage your plan or keep creating with Wrapline.':member.kind==='past'?'Welcome back. Explore paid plans to continue using Wrapline.':'Check your account for your latest subscription details.';
  if(subscribed)for(const teaser of document.querySelectorAll('[data-trial-teaser]'))teaser.textContent=memberMessage;
  const message=subscribed?memberMessage:rzpTrial?'For eligible customers. Verify your email and approve with Razorpay. Nothing is charged today; paid billing starts after 4 days unless you cancel.':billing?'For eligible customers. Verify your email and approve in PayPal. Paid billing follows the 4-day trial unless cancelled.':reviewOnly?'You can review your billing details. Payment options will appear when available for your country.':region&&!region.open?closedMessage[region.reason]:settled?'Trial availability is confirmed at checkout. Verified registration and PayPal approval are required.':'Checking trial availability. Verified registration and PayPal approval are required.';
  for(const notice of document.querySelectorAll('[data-trial-status]')){notice.hidden=!subscribed&&isHome&&inIndia&&!indiaOpen;notice.textContent=indiaOpen&&!rzpTrial&&!subscribed?'Paid subscriptions are available with Razorpay.':!subscribed&&isHome&&inIndia&&!indiaOpen?'':message;}
  const banner=document.querySelector('.trial-banner');
  if(banner){
    const parts=[banner.querySelector('.trial-banner-seal b'),banner.querySelector('.trial-banner-seal small'),banner.querySelector('.offer-eyebrow'),banner.querySelector('strong'),banner.querySelector('.trial-banner-copy > span:last-child')];
    if(!banner._guest)banner._guest={copy:parts.map(el=>el.textContent),href:banner.getAttribute('href'),label:banner.getAttribute('aria-label')};
    const copy=subscribed?[['past','unknown'].includes(member.kind)?'13':'✓',member.kind==='trial'?'TRIAL':member.kind==='paid'?'ACTIVE':'TOOLS',member.kind==='trial'?'YOUR TRIAL IS ACTIVE':member.kind==='paid'?'YOUR WRAPLINE SUBSCRIPTION':'WELCOME BACK',memberLabel(member.kind),memberMessage]:banner._guest.copy;
    parts.forEach((el,i)=>{el.textContent=copy[i];});
    banner.href=subscribed?(manage?accountHref:pricingHref):banner._guest.href;
    banner.setAttribute('aria-label',subscribed?memberLabel(member.kind):banner._guest.label);
    banner.toggleAttribute('data-manage-subscription',manage);
  }
  if(getAccountSession())closeNudge();
  tryNudge();
}
document.addEventListener('click',event=>{
 const link=event.target.closest('[data-manage-subscription]');
 if(!link||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
 event.preventDefault();openAccount();
});
// Choose the visible interval without replacing the form's pricing or payment code.
const form=document.querySelector('#billing-form');
if(form){
  const control=document.querySelector('[data-offer-yearly]');
  const sync=()=>{
    const yearly=form.elements.billing.value==='yearly';
    // The yearly saving is for an account's first yearly subscription of each plan (Basic 15%, Premium 20%).
    const plan=form.elements.plan.value,pct=YEARLY_PERCENT[plan]||15,name=plan==='offline'?'Premium':'Basic',spent=yearlyOfferUsed(plan),aside=document.querySelector('.offer-checkout');
    if(aside)aside.hidden=spent;
    const stamp=document.querySelector('.offer-stamp');if(stamp)stamp.firstChild.textContent=pct;
    const pick=document.querySelector('#choose-yearly');if(pick)pick.textContent='Switch to yearly · save '+pct+'%';
    document.querySelector('[data-offer-heading]').textContent=yearly?'Your first '+name+' year includes '+pct+'% savings.':'Save '+pct+'% on your first '+name+' year.';
    document.querySelector('[data-offer-copy]').textContent=yearly?'Compared with 12 standard monthly payments. Review the annual total below.':'Same 13 tools. A lower price than paying monthly for a year.';
    control.hidden=yearly;
  };
  control?.addEventListener('click',()=>{form.elements.billing.value='yearly';form.elements.billing.dispatchEvent(new Event('change',{bubbles:true}));});
  form.elements.billing.addEventListener('change',sync);form.elements.plan.addEventListener('change',sync);onAccountChange(sync);sync();
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
  nudge.innerHTML='<button type="button" class="offer-close" aria-label="Dismiss free trial offer">×</button><div class="nudge-art" aria-hidden="true"><span class="nudge-orbit"></span><div class="nudge-pass"><span>WRAPLINE / BASIC</span><b>4<span>days</span></b><small>FREE TRIAL</small></div><span class="nudge-tool nudge-tool-one">IK / FK</span><span class="nudge-tool nudge-tool-two">EXPORT</span></div><div class="nudge-copy"><p class="offer-eyebrow">13 MAYA TOOLS. ONE FREE TRIAL.</p><h2 id="trial-nudge-title">Your next project.<br><em>Try it free for 4 days.</em></h2><p>All 13 Maya tools. Your own scenes. See what fits your workflow.</p><a class="btn btn-blue" href="'+pricingHref+'">Explore my free trial <svg class="offer-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 18L18 6M6 6h12v12"/></svg></a><p class="nudge-terms">Eligible customers only. Verified email and PayPal approval required. Renews into a paid subscription after 4 days unless cancelled.</p><button class="offer-later" type="button">Maybe later</button></div>';
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
  loadRazorpayConfig().then(value=>{razorpayConfig=value;if(value?.enabled)render();});
  loadTrialConfig().then(async value=>{config=value;country=/^[A-Z]{2}$/.test(config?.country||'')?config.country:(await detectGeo())||cachedGeo();settled=true;render();}).catch(()=>{settled=true;render();});
}
