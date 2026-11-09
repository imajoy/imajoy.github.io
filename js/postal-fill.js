/* Postal code -> City and State. Only the postal code goes to a public lookup service (never name, email or address).
   Never overwrites text the customer typed. When a code is verified for the country, City/State open and are filled. */
(()=>{
const form=document.querySelector('#billing-form');if(!form)return;
const E=form.elements,country=E.country;
if(!E.postal||!E.city||!E.region)return;
const clean=s=>String(s||'').replace(/\s+/g,' ').trim().slice(0,80);
async function lookup(cc,code){
  const ctl=new AbortController(),t=setTimeout(()=>ctl.abort(),6000);
  try{
    if(cc==='IN'){
      if(!/^\d{6}$/.test(code))return {bad:true};
      const r=await fetch('https://api.postalpincode.in/pincode/'+code,{signal:ctl.signal});if(!r.ok)return null;
      const po=(await r.json())?.[0]?.PostOffice?.[0];return po?{city:clean(po.District||po.Block||po.Name),region:clean(po.State)}:{bad:true};
    }
    let q=code.replace(/\s+/g,'');
    if(cc==='GB')q=code.trim().split(/\s+/)[0];else if(cc==='CA')q=q.slice(0,3);
    if(q.length<3||!/^[A-Za-z0-9-]+$/.test(q))return null;
    const r=await fetch('https://api.zippopotam.us/'+cc.toLowerCase()+'/'+encodeURIComponent(q),{signal:ctl.signal});
    if(r.status===404)return {bad:true};if(!r.ok)return null;
    const p=(await r.json())?.places?.[0];return p?{city:clean(p['place name']),region:clean(p.state)}:{bad:true};
  }catch{return null;}finally{clearTimeout(t);}
}
function bind(postal,city,region,hint,onFound){
  let run=0,timer;
  const free=el=>!el.value.trim()||el.dataset.auto==='1';
  for(const el of [city,region])el.addEventListener('input',e=>{if(e.isTrusted)delete el.dataset.auto;});
  const put=(el,v)=>{if(!v||!free(el))return false;el.value=v;el.dataset.auto='1';el.dispatchEvent(new Event('input',{bubbles:true}));return true;};
  function say(text,kind,manual){
    if(!hint)return;hint.className='form-hint postal-hint'+(kind?' '+kind:'');hint.textContent=text;hint.hidden=!text;
    if(text){void hint.offsetWidth;hint.classList.add('pop');}
    if(manual){const b=document.createElement('button');b.type='button';b.className='text-link';b.textContent='enter city and state yourself';b.onclick=()=>{window.WraplineBilling?.openArea();say('');};hint.append(b);}
  }
  async function go(){
    const id=++run,cc=(country?.value||'').toUpperCase(),code=postal.value.trim();
    if(!/^[A-Z]{2}$/.test(cc)||code.length<3){say('');return;}
    const found=await lookup(cc,code);
    if(id!==run||postal.value.trim()!==code)return;
    if(!found){say('');return;}                       /* service unreachable: stay quiet */
    if(found.bad){say(onFound?'We couldn’t verify that postal code for your country. Check it, or ':'','',!!onFound);return;}
    put(city,found.city);put(region,found.region);
    if(onFound)onFound(found);
    say(onFound&&(found.city||found.region)?'Verified: '+[found.city,found.region].filter(Boolean).join(', ')+'. You can edit it.':'','ok');
  }
  const later=()=>{clearTimeout(timer);timer=setTimeout(go,450);};
  postal.addEventListener('input',later);country?.addEventListener('change',later);
}
bind(E.postal,E.city,E.region,document.querySelector('#postal-hint'),()=>document.dispatchEvent(new CustomEvent('wrapline:postal-found')));
if(E.companyPostal&&E.companyCity&&E.companyRegion)bind(E.companyPostal,E.companyCity,E.companyRegion,null,null);
})();
