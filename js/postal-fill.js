/* Postal code -> City and State. Only the postal code is sent to a public lookup service (no name, email or address).
   Never overwrites something the customer typed; if nothing is found, nothing happens. */
(()=>{
const form=document.querySelector('#billing-form');if(!form)return;
const postal=form.elements.postal,city=form.elements.city,region=form.elements.region,country=form.elements.country;
if(!postal||!city||!region)return;
const hint=document.createElement('p');hint.className='form-hint postal-hint';hint.setAttribute('aria-live','polite');hint.hidden=true;postal.after(hint);
let run=0,timer;
const clean=s=>String(s||'').replace(/\s+/g,' ').trim().slice(0,80);
const free=el=>!el.value.trim()||el.dataset.auto==='1';
for(const el of [city,region])el.addEventListener('input',e=>{if(e.isTrusted)delete el.dataset.auto;});
function put(el,value){if(!value||!free(el))return false;el.value=value;el.dataset.auto='1';el.dispatchEvent(new Event('input',{bubbles:true}));return true;}
function say(text){hint.textContent=text;hint.hidden=!text;if(text){hint.classList.remove('pop');void hint.offsetWidth;hint.classList.add('pop');}}
async function lookup(cc,code){
  const ctl=new AbortController(),t=setTimeout(()=>ctl.abort(),6000);
  try{
    if(cc==='IN'){
      if(!/^\d{6}$/.test(code))return null;
      const r=await fetch('https://api.postalpincode.in/pincode/'+code,{signal:ctl.signal});if(!r.ok)return null;
      const po=(await r.json())?.[0]?.PostOffice?.[0];return po?{city:clean(po.District||po.Block||po.Name),region:clean(po.State)}:null;
    }
    let q=code.replace(/\s+/g,'');
    if(cc==='GB')q=code.trim().split(/\s+/)[0];else if(cc==='CA')q=q.slice(0,3);
    if(q.length<3||!/^[A-Za-z0-9-]+$/.test(q))return null;
    const r=await fetch('https://api.zippopotam.us/'+cc.toLowerCase()+'/'+encodeURIComponent(q),{signal:ctl.signal});if(!r.ok)return null;
    const p=(await r.json())?.places?.[0];return p?{city:clean(p['place name']),region:clean(p.state)}:null;
  }catch{return null;}finally{clearTimeout(t);}
}
async function go(){
  const id=++run,cc=(country?.value||'').toUpperCase(),code=postal.value.trim();
  if(!/^[A-Z]{2}$/.test(cc)||code.length<3){say('');return;}
  const found=await lookup(cc,code);
  if(id!==run||postal.value.trim()!==code)return;
  if(!found||!found.city&&!found.region){say('');return;}
  const a=put(city,found.city),b=put(region,found.region);
  say(a||b?'Filled in '+[found.city,found.region].filter(Boolean).join(', ')+' from your postal code. You can edit it.':'');
}
const later=()=>{clearTimeout(timer);timer=setTimeout(go,450);};
postal.addEventListener('input',later);
country?.addEventListener('change',later);
})();
