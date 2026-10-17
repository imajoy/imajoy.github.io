import {getQuote,previewPrice,money,apiBase} from './commerce.js?v=20261017-r16';
const toggle=document.querySelector('.toggle');
let billing='monthly',revision=0;
function chooseBilling(value){
 if(billing===value)return;
 billing=value;toggle.dataset.state=billing;
 for(const button of toggle.querySelectorAll('button')){const selected=button.dataset.bill===billing;button.classList.toggle('on',selected);button.setAttribute('aria-pressed',String(selected));}
 for(const button of document.querySelectorAll('button[data-choose-yearly]')){button.disabled=billing==='yearly';button.textContent=billing==='yearly'?'Yearly savings selected ✓':'Choose yearly · save 20% ↗';}
 render();
}
function animate(element){if(!matchMedia('(prefers-reduced-motion: reduce)').matches)element.animate([{opacity:.2,translate:'0 8px'},{opacity:1,translate:'0 0'}],{duration:550,easing:'cubic-bezier(.22,1,.36,1)'});}
async function render(){
 const current=++revision,status=document.querySelector('#pricing-status');
 await Promise.all(['online','offline'].map(async plan=>{
  const amount=document.querySelector(`[data-amt="${plan}"]`),buy=document.querySelector(`[data-buy="${plan}"]`),note=document.querySelector(`[data-note="${plan}"]`),offer=document.querySelector(`[data-annual="${plan}"]`),comparison=document.querySelector(`[data-compare="${plan}"]`),yearlyLink=document.querySelector(`[data-card-yearly="${plan}"]`);
  buy.href=`checkout.html?${new URLSearchParams({plan,billing})}`;amount.textContent='—';offer.hidden=true;comparison.hidden=true;yearlyLink.hidden=true;
  try{
   const quote=apiBase?await getQuote(plan,billing):previewPrice(plan,billing);
   if(current!==revision)return;
   amount.textContent=money(quote.unitAmount,quote.currency);animate(amount);
   amount.closest('.price').querySelector('[data-per]').textContent=`per computer, per ${billing==='yearly'?'year':'month'}`;
   note.textContent=billing==='yearly'?'Billed annually. Prices exclude applicable taxes.':'Billed monthly. Prices exclude applicable taxes.';
   yearlyLink.hidden=billing!=='monthly';
   if(billing==='yearly'&&quote.annualSavings>0){
    offer.hidden=false;comparison.hidden=false;comparison.querySelector('.annual-original').textContent=money(quote.compareAtUnitAmount,quote.currency);
    offer.querySelector('.annual-saving').textContent='Save '+money(quote.annualSavings,quote.currency)+' per year';
    offer.querySelector('.annual-equivalent').textContent=money(quote.unitAmount/12,quote.currency)+' per month, billed yearly';animate(offer);
   }
   status.textContent=quote.preview?'Estimated price. Your billing details confirm the total at checkout.':'';
  }catch{if(current!==revision)return;amount.textContent='See checkout';offer.hidden=true;note.textContent='Confirm pricing on the billing page.';status.textContent='Pricing is temporarily unavailable.';}
 }));
}
for(const button of toggle.querySelectorAll('button'))button.addEventListener('click',()=>{
 chooseBilling(button.dataset.bill);
});
for(const control of document.querySelectorAll('[data-choose-yearly]'))control.addEventListener('click',()=>chooseBilling('yearly'));
for(const control of document.querySelectorAll('[data-card-yearly]'))control.addEventListener('click',()=>{
 chooseBilling('yearly');toggle.querySelector('[data-bill="yearly"]').focus({preventScroll:true});
});
render();
/* Only the main Install-section CTA opens the verified download page. */
for(const link of document.querySelectorAll('#download-setup'))link.addEventListener('click',event=>{
 if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||event.button!==0)return;
 const popup=window.open(link.href,'ajoy-download');if(popup){popup.opener=null;event.preventDefault();}
});
