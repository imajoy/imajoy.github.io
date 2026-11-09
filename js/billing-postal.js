/* Profile > Billing details: the postal code fills City and State, and those two fields are locked (read-only).
   Only the postal code is sent to the public lookup service. If the service cannot be reached, the two fields open so the customer can type them. */
import {cachedGeo,detectGeo} from './geo.js?v=20261019-geo1';
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
export function bindPostal(form){
  const {postal,city,region}=form.elements;if(!postal||!city||!region)return;
  const hint=document.createElement('p');hint.className='bc-hint';hint.setAttribute('role','status');hint.hidden=true;
  postal.closest('.bc-row').after(hint);
  let run=0,timer,locked=true;
  const lock=on=>{locked=on;for(const el of [city,region]){el.readOnly=on;el.classList.toggle('bc-auto',on);}};
  const say=(t,k)=>{hint.textContent=t||'';hint.dataset.kind=k||'';hint.hidden=!t;};
  const clear=()=>{city.value='';region.value='';};
  lock(true);city.placeholder='Filled from postal code';region.placeholder='Filled from postal code';
  async function go(){
    const id=++run,code=postal.value.trim();
    if(!code){clear();lock(true);say('');return;}
    if(code.length<3){return;}
    let cc=cachedGeo();if(!cc)cc=await detectGeo();
    if(!cc&&/^\d{6}$/.test(code))cc='IN';
    if(id!==run)return;
    if(!cc){lock(false);say('Enter your city and state.','');return;}
    const f=await lookup(cc,code);
    if(id!==run||postal.value.trim()!==code)return;
    if(!f){lock(false);say('Could not look up the postal code right now. Enter your city and state.','');return;}
    if(f.bad){clear();lock(true);say(cc==='IN'?'We couldn’t find PIN code '+code+' in India. Please check it.':'We couldn’t verify that postal code. Please check it.','err');return;}
    city.value=f.city;region.value=f.region;lock(true);
    city.dispatchEvent(new Event('input',{bubbles:true}));region.dispatchEvent(new Event('input',{bubbles:true}));
    say('Detected: '+[f.city,f.region].filter(Boolean).join(', '),'ok');
  }
  postal.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(go,450);});
  /* a saved profile is shown as it is; the fields stay locked */
  return {recheck:()=>{lock(true);say('');}};
}
