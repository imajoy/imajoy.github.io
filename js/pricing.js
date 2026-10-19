import {indiaContact} from './india-availability.js?v=20261018-a1';
import {getQuote,previewPrice,money,apiBase,suggestedCountry} from './commerce.js?v=20261018-g5';
import {detectGeo,cachedGeo} from './geo.js?v=20261018-h8';
import {loadTrialConfig,trialPlanId,TRIAL_DAYS} from './trial.js?v=20261018-j3';
import {localFormatter} from './fx.js?v=20261018-h8';
const toggle=document.querySelector('.toggle');
let billing='monthly',revision=0,animatePricing=false;
function chooseBilling(value){
 if(billing===value)return;
 animatePricing=true;billing=value;toggle.dataset.state=billing;
 for(const button of toggle.querySelectorAll('button')){const selected=button.dataset.bill===billing;button.classList.toggle('on',selected);button.setAttribute('aria-pressed',String(selected));}
 for(const button of document.querySelectorAll('button[data-choose-yearly]')){button.disabled=billing==='yearly';button.textContent=billing==='yearly'?'Yearly savings selected ✓':'Choose yearly · save 20% ↗';}
 render();
}
function animate(element){if(animatePricing&&!matchMedia('(prefers-reduced-motion: reduce)').matches)element.animate([{opacity:.5},{opacity:1}],{duration:200,easing:'ease-out'});}
async function render(){
 const current=++revision,status=document.querySelector('#pricing-status');
 const inIndia=suggestedCountry()==='IN';
 const notice=document.querySelector('#india-availability');
 notice.hidden=!inIndia;
 notice.querySelector('a').href=indiaContact();
 document.querySelector('.plan-trial-kicker').textContent=inIndia?'Regional availability below':'2-day free trial on eligible Online plans';
 await Promise.all(['online','offline'].map(async plan=>{
  const amount=document.querySelector(`[data-amt="${plan}"]`),buy=document.querySelector(`[data-buy="${plan}"]`),note=document.querySelector(`[data-note="${plan}"]`),offer=document.querySelector(`[data-annual="${plan}"]`),comparison=document.querySelector(`[data-compare="${plan}"]`),yearlyLink=document.querySelector(`[data-card-yearly="${plan}"]`);
  buy.href=inIndia&&!buy.classList.contains('is-owned')?'#india-availability':`checkout.html?${new URLSearchParams({plan,billing,v:'20261018-r19'})}`;amount.textContent='—';offer.hidden=true;comparison.hidden=true;yearlyLink.hidden=true;
  try{
   const quote=apiBase?await getQuote(plan,billing):previewPrice(plan,billing);
   if(current!==revision)return;
   const lf=quote.currency==='USD'?await localFormatter(cachedGeo()):null;
   if(current!==revision)return;
   const show=c=>lf?lf(c):money(c,quote.currency);
   amount.textContent=show(quote.unitAmount);animate(amount);
   amount.closest('.price').querySelector('[data-per]').textContent=`per computer, per ${billing==='yearly'?'year':'month'}`;
   const trial=plan==='online'&&trialPlanId(tcfg,'online',billing,suggestedCountry());
   note.textContent=trial?TRIAL_DAYS+'-day free trial, then billed '+(billing==='yearly'?'annually':'monthly')+'. Cancel any time.':(billing==='yearly'?'Billed annually. ':'Billed monthly. ');
   if(!buy.classList.contains('is-owned')){
    buy.textContent=inIndia?'Ask about '+(plan==='online'?'Online':'Offline')+' in India':trial?'Start '+TRIAL_DAYS+'-day free trial':'Subscribe now';
    if(inIndia)buy.href='#india-availability';
   }
   if(inIndia)note.textContent='Indicative INR price. See regional availability above.';
   yearlyLink.hidden=billing!=='monthly';
   if(billing==='yearly'&&quote.annualSavings>0){
    offer.hidden=false;comparison.hidden=false;comparison.querySelector('.annual-original').textContent=show(quote.compareAtUnitAmount);
    offer.querySelector('.annual-saving').textContent='Save '+show(quote.annualSavings)+' per year';
    offer.querySelector('.annual-equivalent').textContent=show(quote.unitAmount/12)+' per month, billed yearly';animate(offer);
   }
   status.textContent=quote.preview?(quote.currency==='INR'?'Indicative INR prices. Check regional availability below.':'Prices shown in US dollars for your region. Your country is confirmed at checkout.'):'';
  }catch{if(current!==revision)return;amount.textContent='See checkout';offer.hidden=true;note.textContent='Confirm pricing on the billing page.';status.textContent='Pricing is temporarily unavailable.';}
 }));
 if(current===revision)animatePricing=false;
}
for(const button of toggle.querySelectorAll('button'))button.addEventListener('click',()=>{
 chooseBilling(button.dataset.bill);
});
for(const control of document.querySelectorAll('[data-choose-yearly]'))control.addEventListener('click',()=>chooseBilling('yearly'));
for(const control of document.querySelectorAll('[data-card-yearly]'))control.addEventListener('click',()=>{
 chooseBilling('yearly');toggle.querySelector('[data-bill="yearly"]').focus({preventScroll:true});
});
let tcfg=null;
loadTrialConfig().then(c=>{tcfg=c;if(c)render();});
const knewGeo=cachedGeo();
render();
detectGeo().then(c=>{if(c&&c!==knewGeo)render();});
