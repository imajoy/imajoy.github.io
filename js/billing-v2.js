/* Billing page: on laptop/desktop the yearly offer sits directly under the "Your license" box (where the billing period is chosen).
   On phones it stays where it was. Moves one node; no scroll work. */
(()=>{
  const ad=document.querySelector('.offer-checkout'),lic=document.querySelector('.checkout-form .license-entry'),side=document.querySelector('.checkout-side');
  if(!ad||!lic||!side)return;
  const home=ad.nextSibling,mq=matchMedia('(min-width:801px)');
  const place=()=>{if(mq.matches){if(ad.previousElementSibling!==lic)lic.after(ad);}else if(ad.parentNode!==side)side.insertBefore(ad,home&&home.parentNode===side?home:null);};
  place();mq.addEventListener('change',place);
})();
