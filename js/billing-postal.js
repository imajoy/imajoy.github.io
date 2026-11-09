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
    let geo=cachedGeo();if(!geo)geo=await detectGeo();
    if(id!==run)return;
    /* the code's own shape decides where to look; the detected country goes first when it fits */
    const digits=/^\d+$/.test(code)?code.length:0;
    const byShape=digits===6?['IN','SG']:digits===5?['US','DE','FR','ES','IT','MX']:digits===4?['AU','NZ','BE','CH','AT']:/^[A-Za-z]\d[A-Za-z] ?\d[A-Za-z]\d$/.test(code)?['CA']:/^[A-Za-z]{1,2}\d[A-Za-z\d]? ?\d[A-Za-z]{2}$/.test(code)?['GB']:geo?[geo]:[];
    const order=[...(geo&&byShape.includes(geo)?[geo]:[]),...byShape.filter(c=>c!==geo)];
    if(!order.length){lock(false);say('Enter your city and state.','');return;}
    let f=null,down=false,cc='';
    for(const c of order){const r=await lookup(c,code);if(id!==run||postal.value.trim()!==code)return;if(r===null){down=true;continue;}if(!r.bad){f=r;cc=c;break;}}
    if(!f&&down){lock(false);say('Could not look up the postal code right now. Enter your city and state.','');return;}
    if(!f){clear();
      /* an Indian PIN that does not exist is a typo; any other unknown code (a country the free service does not cover) opens City and State so the customer can still save */
      if(geo==='IN'&&digits===6){lock(true);say('We couldn’t find PIN code '+code+' in India. Please check it.','err');return;}
      lock(false);say('We couldn’t verify that postal code. Check it, or enter your city and state yourself.','');return;}
    city.value=f.city;region.value=f.region;lock(true);
    city.dispatchEvent(new Event('input',{bubbles:true}));region.dispatchEvent(new Event('input',{bubbles:true}));
    say('Detected: '+[f.city,f.region].filter(Boolean).join(', '),'ok');
  }
  postal.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(go,450);});
  /* a saved profile is shown as it is; the fields stay locked */
  return {recheck:()=>{lock(true);say('');}};
}
