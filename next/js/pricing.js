import {getQuote,previewPrice,money,apiBase} from './commerce.js';
const toggle=document.querySelector('.toggle');
let billing='monthly',revision=0;
async function render(){
 const current=++revision;
 const status=document.querySelector('#pricing-status');
 for(const plan of ['online','offline']){
  const amount=document.querySelector(`[data-amt="${plan}"]`);
  const buy=document.querySelector(`[data-buy="${plan}"]`);
  buy.href=`checkout.html?${new URLSearchParams({plan,billing})}`;
  amount.textContent='—';
  const note=document.querySelector(`[data-note="${plan}"]`);
  try{
   const quote=apiBase?await getQuote(plan,billing):previewPrice(plan,billing);
   if(current!==revision)return;
   amount.textContent=money(quote.unitAmount,quote.currency);
   amount.closest('.price').querySelector('[data-per]').textContent=`per computer, per ${billing==='yearly'?'year':'month'}`;
   note.textContent=billing==='yearly'?'Billed annually. Taxes calculated at checkout.':'Billed monthly. Prices exclude applicable taxes.';
   status.textContent=quote.preview?'Estimated price. Your billing details confirm the total at checkout.':'';
  }catch{
   if(current!==revision)return;
   amount.textContent='See checkout';note.textContent='Confirm pricing on the billing page.';status.textContent='Pricing is temporarily unavailable.';
  }
 }
}
for(const button of toggle.querySelectorAll('button'))button.addEventListener('click',()=>{
 billing=button.dataset.bill;toggle.dataset.state=billing;
 for(const b of toggle.querySelectorAll('button')){b.classList.toggle('on',b===button);b.setAttribute('aria-pressed',String(b===button));}
 render();
});
render();
/* Script-opened tabs can close themselves after a verified download. */
for(const link of document.querySelectorAll('#download-setup'))link.addEventListener('click',event=>{
 if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||event.button!==0)return;
 const popup=window.open(link.href,'ajoy-download');
 if(popup){popup.opener=null;event.preventDefault();}
});
