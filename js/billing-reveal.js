/* Smoothly opens City/State once the postal code is verified, and the studio/company block when its box is ticked. */
(()=>{
const form=document.querySelector('#billing-form');if(!form)return;
const E=form.elements,area=document.querySelector('#area-fields'),comp=document.querySelector('#company-fields');
if(!area||!comp||!E.companyOn)return;
const set=(el,open)=>{if(open){el.inert=false;requestAnimationFrame(()=>requestAnimationFrame(()=>el.classList.add('open')));}else{el.classList.remove('open');el.inert=true;}};
const required=on=>{for(const n of ['company','companyAddress','companyPostal'])E[n].required=on;};
window.WraplineBilling={openArea:()=>set(area,true)};
E.companyOn.addEventListener('change',()=>{const on=E.companyOn.checked;required(on);set(comp,on);if(on)setTimeout(()=>E.company.focus({preventScroll:true}),350);});
document.addEventListener('wrapline:postal-found',()=>set(area,true));
/* a saved draft (or the browser restoring the form) already has values: open straight away, no animation needed */
const init=()=>{
  if(E.city.value||E.region.value){area.classList.add('open');area.inert=false;}
  if(E.companyOn.checked){required(true);comp.classList.add('open');comp.inert=false;}
};
init();addEventListener('pageshow',init);
})();
