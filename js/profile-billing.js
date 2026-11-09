/* Billing step: fill the form from the saved account details (empty boxes only).
   Payment step: save what was entered on the billing step to the account, once, so next time it is already there. */
import {getAccountSession,onAccountChange} from './account-session.js?v=20261023-p7';
import {readBillingDraft,paymentStep} from './checkout-steps.js?v=20261109-co7';
import {loadProfile,cachedProfile,saveProfile,hasBilling} from './profile-store.js?v=pm2';
const form=document.querySelector('#billing-form');
if(form){
 const E=form.elements,set=(name,value)=>{const el=E[name];if(!el||typeof value!=='string'||!value||el.value.trim())return false;el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));return true;};
 let appliedFor='';
 function fill(p){
  const s=getAccountSession();if(paymentStep||!s||!hasBilling(p)||appliedFor===s.email)return;
  if(document.documentElement.dataset.billingBlocked==='true')return;
  appliedFor=s.email;
  set('name',p.name);set('address',p.address);set('postal',p.postal);
  if(p.companyOn&&E.companyOn&&!E.companyOn.checked){E.companyOn.checked=true;E.companyOn.dispatchEvent(new Event('change',{bubbles:true}));set('company',p.company);set('companyAddress',p.companyAddress);set('companyPostal',p.companyPostal);}
  /* City and state normally fill themselves once the postal code is verified; use the saved ones only if that did not happen. */
  setTimeout(()=>{set('city',p.city);set('region',p.region);},2200);
 }
 const run=()=>{if(paymentStep||!getAccountSession())return;const c=cachedProfile();if(c!==undefined){fill(c);return;}loadProfile().then(p=>{if(p)fill(p);});};
 document.addEventListener('ajoy:billing-network',run);onAccountChange(()=>{appliedFor='';run();});run();
 if(paymentStep){
  const keys=['name','address','postal','city','region','companyOn','company','companyAddress','companyPostal'];
  const fromDraft=d=>{const on=d.companyOn===true;return{name:d.name||'',address:(d.rAddress??(on?'':d.address))||'',postal:(d.rPostal??(on?'':d.postal))||'',city:(d.rCity??(on?'':d.city))||'',region:(d.rRegion??(on?'':d.region))||'',companyOn:on,company:on?(d.cName??d.company)||'':'',companyAddress:on?(d.cAddress??d.address)||'':'',companyPostal:on?(d.cPostal??d.postal)||'':''};};
  const save=()=>{
   const d=readBillingDraft();if(!d||!getAccountSession())return;
   const next=fromDraft(d);if(!next.name&&!next.address&&!next.postal)return;
   const known=cachedProfile();if(known&&keys.every(k=>known[k]===next[k]))return;
   saveProfile(next).catch(()=>{});
  };
  setTimeout(save,1200);
 }
}
