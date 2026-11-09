/* The verified testing account (set on the server) can skip the identity/address fields while testing.
   Everyone else is unchanged. The server never relied on these boxes being filled. */
(()=>{
const form=document.querySelector('#billing-form');if(!form)return;
const root=document.documentElement,names=['name','address','postal'];
const els=names.map(n=>form.elements[n]).filter(Boolean);
if(!els.length)return;
const labels=new Map(els.map(el=>[el,document.querySelector('label[for="'+el.id+'"]')]));
const orig=new Map([...labels].map(([el,l])=>[el,l?l.textContent:'']));
const apply=()=>{
  const t=root.dataset.billingTester==='true';
  for(const el of els){
    const l=labels.get(el);
    el.required=!t&&true;
    if(l)l.textContent=t?orig.get(el).replace(/\s*\*\s*$/,''):orig.get(el);
  }
  /* company fields only count while the company box is ticked */
  if(form.elements.companyOn&&form.elements.companyOn.checked){for(const n of ['company','companyAddress','companyPostal'])if(form.elements[n])form.elements[n].required=!t;}
};
new MutationObserver(apply).observe(root,{attributes:true,attributeFilter:['data-billing-tester']});
apply();
})();
