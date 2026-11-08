/* The billing details typed at checkout. billingParts() adds them to the checkout request so the invoice can show them;
   a copy stays in this tab (sessionStorage, 2 hours) so the confirmation page can print the same details on its receipt. */
const KEY='ajoy.receipt-billing',MAX={address:160,city:80,region:80,postal:20};
const field=(form,name,max)=>String(form.elements[name]?.value||'').trim().slice(0,max);
export function billingParts(form){
 const parts={};for(const [name,max] of Object.entries(MAX))parts[name]=field(form,name,max);
 try{sessionStorage.setItem(KEY,JSON.stringify({at:Date.now(),name:field(form,'name',80),company:field(form,'company',80),...parts}));}catch{}
 return parts;
}
export function readReceiptBilling(){
 try{const v=JSON.parse(sessionStorage.getItem(KEY)||'null');if(!v||!(Date.now()-v.at<7200000))return null;
  const t=(x,n)=>typeof x==='string'?x.slice(0,n):'';
  return {name:t(v.name,80),company:t(v.company,80),address:t(v.address,160),city:t(v.city,80),region:t(v.region,80),postal:t(v.postal,20)};}catch{return null;}
}
/* Address lines for display: street, then "city, region postal". */
export function billingLines(b){
 if(!b)return [];const area=[b.city,[b.region,b.postal].filter(Boolean).join(' ')].filter(Boolean).join(', ');
 return [b.company,b.address,area].filter(Boolean);
}
