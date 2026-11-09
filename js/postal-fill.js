/* Postal code -> City and State. Only the postal code goes to a public lookup service (never name, email or address).
   Never overwrites text the customer typed. When a code is verified for the country, City/State open and are filled. */
(()=>{
const form=document.querySelector('#billing-form');if(!form)return;
const E=form.elements,country=E.country;
if(!E.postal||!E.city||!E.region)return;
/* Known postal formats: [pattern, what it is called, example]. Countries not listed are only checked by the lookup. */
const FORMATS={IN:[/^\d{6}$/,'6-digit PIN code','700016'],US:[/^\d{5}(-\d{4})?$/,'ZIP code','90210'],GB:[/^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/i,'postcode','SW1A 1AA'],CA:[/^[A-Z]\d[A-Z] ?\d[A-Z]\d$/i,'postal code','K1A 0B1'],
DE:[/^\d{5}$/,'5-digit postal code','10115'],FR:[/^\d{5}$/,'5-digit postal code','75001'],ES:[/^\d{5}$/,'5-digit postal code','28001'],IT:[/^\d{5}$/,'5-digit postal code','00100'],MX:[/^\d{5}$/,'5-digit postal code','01000'],
AU:[/^\d{4}$/,'4-digit postcode','2000'],NZ:[/^\d{4}$/,'4-digit postcode','6011'],NL:[/^\d{4} ?[A-Z]{2}$/i,'postal code','1012 AB'],BE:[/^\d{4}$/,'4-digit postal code','1000'],CH:[/^\d{4}$/,'4-digit postal code','8001'],AT:[/^\d{4}$/,'4-digit postal code','1010'],
SG:[/^\d{6}$/,'6-digit postal code','018956'],JP:[/^\d{3}-?\d{4}$/,'postal code','100-0001'],BR:[/^\d{5}-?\d{3}$/,'CEP','01001-000'],ZA:[/^\d{4}$/,'4-digit postal code','0001'],ID:[/^\d{5}$/,'5-digit postal code','10110'],
BD:[/^\d{4}$/,'4-digit postal code','1207'],LK:[/^\d{5}$/,'5-digit postal code','00100'],NP:[/^\d{5}$/,'5-digit postal code','44600'],PK:[/^\d{5}$/,'5-digit postal code','44000'],PH:[/^\d{4}$/,'4-digit ZIP code','1000'],MY:[/^\d{5}$/,'5-digit postcode','50000'],TH:[/^\d{5}$/,'5-digit postal code','10110'],KR:[/^\d{5}$/,'5-digit postal code','04524'],SE:[/^\d{3} ?\d{2}$/,'postal code','111 22'],PL:[/^\d{2}-?\d{3}$/,'postal code','00-001']};
const countryName=cc=>{try{return new Intl.DisplayNames(['en'],{type:'region'}).of(cc)||cc;}catch{return cc;}};
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
function bind(postal,city,region,hint,onFound,onReset){
  let run=0,timer;
  const free=el=>!el.value.trim()||el.dataset.auto==='1';
  for(const el of [city,region])el.addEventListener('input',e=>{if(e.isTrusted)delete el.dataset.auto;});
  const put=(el,v)=>{if(!v||!free(el))return false;el.value=v;el.dataset.auto='1';el.dispatchEvent(new Event('input',{bubbles:true}));return true;};
  function say(text,kind,manual){
    postal.toggleAttribute('data-unverified',!!text&&kind!=='ok');
    if(!hint)return;hint.className='form-hint postal-hint'+(kind?' '+kind:'');hint.textContent=text;hint.hidden=!text;
    if(text){void hint.offsetWidth;hint.classList.add('pop');}
    if(manual){const b=document.createElement('button');b.type='button';b.className='text-link';b.textContent='enter city and state yourself';b.onclick=()=>{window.WraplineBilling?.openArea();say('');};hint.append(b);}
  }
  /* Code removed or not valid: take back what was filled automatically (typed text stays) and let the caller close City/State. */
  const mark=msg=>{postal.setCustomValidity(msg||'');if(msg)postal.setAttribute('aria-invalid','true');else postal.removeAttribute('aria-invalid');};
  function reset(){mark('');for(const el of [city,region])if(el.dataset.auto==='1'){el.value='';delete el.dataset.auto;el.dispatchEvent(new Event('input',{bubbles:true}));}if(onReset)onReset();}
  async function go(){
    const id=++run,cc=(country?.value||'').toUpperCase(),code=postal.value.trim();
    if(!/^[A-Z]{2}$/.test(cc)||!code){say('');reset();return;}
    const fmt=FORMATS[cc];
    if(fmt&&!fmt[0].test(code)){reset();const m='Enter a valid '+fmt[1]+' for '+countryName(cc)+', for example '+fmt[2]+'.';mark(m);say(m,'err');return;}
    mark('');
    if(code.length<3){say('');reset();return;}
    const found=await lookup(cc,code);
    if(id!==run||postal.value.trim()!==code)return;
    if(!found){say('');return;}                       /* service unreachable: stay quiet */
    if(found.bad){reset();
      if(cc==='IN'){const m='We couldn’t find PIN code '+code+' in India. Please check it.';mark(m);say(m,'err');return;}
      say(onFound?'We couldn’t verify that postal code for '+countryName(cc)+'. Check it, or ':'','',!!onFound);return;}
    put(city,found.city);put(region,found.region);
    if(onFound)onFound(found);mark('');postal.setAttribute('data-verified','');
    say(onFound&&(found.city||found.region)?'Verified: '+[found.city,found.region].filter(Boolean).join(', ')+'. You can edit it.':'','ok');
  }
  postal.addEventListener('input',()=>postal.removeAttribute('data-verified'));
  const later=()=>{clearTimeout(timer);if(!postal.value.trim()){run++;say('');reset();return;}timer=setTimeout(go,450);};
  postal.addEventListener('input',later);country?.addEventListener('change',later);
}
bind(E.postal,E.city,E.region,document.querySelector('#postal-hint'),()=>document.dispatchEvent(new CustomEvent('wrapline:postal-found')),()=>document.dispatchEvent(new CustomEvent('wrapline:postal-reset')));
if(E.companyPostal&&E.companyCity&&E.companyRegion)bind(E.companyPostal,E.companyCity,E.companyRegion,document.querySelector('#company-postal-hint'),null,null);
})();
