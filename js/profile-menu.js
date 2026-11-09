/* Profile menu for signed-in visitors: my plan, saved billing details, appearance (light / dark / auto), sign out.
   Loaded by account.js, so every page with the account button gets it. Signed-out visitors see nothing here. */
import {getAccountSession,clearAccountSession,onAccountChange,accountRequest} from './account-session.js?v=20261023-p7';
import {loadProfile,cachedProfile,saveProfile,clearProfile,emptyProfile,hasBilling} from './profile-store.js?v=pm1';
const cfg=window.AJOY_CONFIG||{};
if(cfg.accountOpen&&cfg.sheetUrl)setTimeout(setup,0);
function setup(){
 const anchor=document.querySelector('.acct-btn');if(!anchor||!anchor.parentElement)return;
 const link=document.createElement('link');link.rel='stylesheet';link.href='css/profile.css?v=pm1';document.head.append(link);
 document.documentElement.dataset.profileReady='';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const calm=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
 const ic={
  plan:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5z"/><path d="M4 7.5 12 12l8-4.5M12 12v9"/></svg>',
  bill:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18M7 15h4"/></svg>',
  out:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M15 8l4 4-4 4M19 12H9"/></svg>',
  sun:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4l1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4m11.4-11.4l1.4-1.4"/></svg>',
  moon:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>',
  auto:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17a8.5 8.5 0 0 0 0-17z" fill="currentColor" stroke="none"/></svg>'
 };
 const wrap=document.createElement('div');wrap.className='pf';wrap.hidden=true;
 wrap.innerHTML='<button class="pf-btn" type="button" aria-haspopup="menu" aria-expanded="false" aria-controls="pf-menu" aria-label="Profile and settings"><span class="pf-av" aria-hidden="true"></span></button>';
 anchor.after(wrap);
 const btn=wrap.querySelector('.pf-btn'),av=wrap.querySelector('.pf-av');
 const menu=document.createElement('div');menu.className='pf-menu';menu.id='pf-menu';menu.setAttribute('role','menu');menu.hidden=true;document.body.append(menu);
 let profile=null;
 const initial=()=>{const s=getAccountSession();return ((profile?.name||s?.email||'?').trim()[0]||'?').toUpperCase();};
 const summary=p=>{if(!hasBilling(p))return 'Not saved yet';const bits=[p.name,[p.postal].filter(Boolean).join(' ')].filter(Boolean);return bits.join(' · ')||'Saved';};
 function themeMode(){return window.AjoyTheme?.mode?.()||'auto';}
 function build(){
  const s=getAccountSession();if(!s)return;
  const mode=themeMode(),idx={light:0,dark:1,auto:2}[mode];
  menu.innerHTML='<div class="pf-head" style="--i:0"><span class="pf-av pf-av-lg" aria-hidden="true">'+esc(initial())+'</span><div><b>'+esc(profile?.name||'Your account')+'</b><small>'+esc(s.email)+'</small></div></div>'+
   '<button class="pf-item" type="button" role="menuitem" data-go="plan" style="--i:1">'+ic.plan+'<span><b>My plan</b><small>Subscription, renewals and invoices</small></span></button>'+
   '<button class="pf-item" type="button" role="menuitem" data-go="billing" style="--i:2">'+ic.bill+'<span><b>Billing details</b><small>'+esc(summary(profile))+'</small></span></button>'+
   '<div class="pf-theme" style="--i:3"><span class="pf-label">Appearance</span><div class="pf-seg" role="radiogroup" aria-label="Appearance" style="--at:'+idx+'"><i aria-hidden="true"></i>'+
    [['light','Light',ic.sun],['dark','Dark',ic.moon],['auto','Auto',ic.auto]].map(([v,t,i])=>'<button type="button" role="radio" aria-checked="'+(mode===v)+'" data-theme-set="'+v+'">'+i+'<span>'+t+'</span></button>').join('')+'</div></div>'+
   '<button class="pf-item pf-out" type="button" role="menuitem" data-go="out" style="--i:4">'+ic.out+'<span><b>Sign out</b></span></button>';
 }
 function paintBtn(){const s=getAccountSession();wrap.hidden=!s;if(!s){close(true);return;}av.textContent=initial();btn.title=s.email;}
 function place(){const r=btn.getBoundingClientRect();const w=Math.min(318,innerWidth-24),left=Math.min(Math.max(12,r.right-w),innerWidth-w-12);menu.style.top=Math.round(r.bottom+10)+'px';menu.style.right='auto';menu.style.left=Math.round(left)+'px';menu.style.transformOrigin=Math.round(r.left+r.width/2-left)+'px -6px';}
 let closing=0;
 function open(){
  if(!getAccountSession())return;clearTimeout(closing);build();place();menu.hidden=false;btn.setAttribute('aria-expanded','true');
  requestAnimationFrame(()=>{menu.dataset.open='';});
  loadProfile().then(p=>{if(p!==undefined){profile=p;if(!menu.hidden){const keep=document.activeElement?.dataset?.go||document.activeElement?.dataset?.themeSet;build();paintBtn();if(keep)menu.querySelector('[data-go="'+keep+'"],[data-theme-set="'+keep+'"]')?.focus({preventScroll:true});}}});
  setTimeout(()=>menu.querySelector('.pf-item')?.focus({preventScroll:true}),30);
 }
 function close(instant){
  if(menu.hidden&&!instant)return;btn.setAttribute('aria-expanded','false');delete menu.dataset.open;
  clearTimeout(closing);closing=setTimeout(()=>{menu.hidden=true;},instant||calm()?0:200);
 }
 btn.addEventListener('click',()=>{menu.hidden||menu.dataset.open===undefined?open():close();});
 document.addEventListener('pointerdown',e=>{if(!menu.hidden&&!menu.contains(e.target)&&!wrap.contains(e.target))close();});
 document.addEventListener('keydown',e=>{
  if(menu.hidden)return;
  if(e.key==='Escape'){close();btn.focus();}
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){const items=[...menu.querySelectorAll('.pf-item')],i=items.indexOf(document.activeElement);if(items.length){e.preventDefault();items[(i+(e.key==='ArrowDown'?1:-1)+items.length)%items.length].focus();}}
 });
 addEventListener('resize',()=>{if(!menu.hidden)place();});
 addEventListener('scroll',()=>{if(!menu.hidden)close();},{passive:true});
 menu.addEventListener('click',e=>{
  const t=e.target.closest('[data-theme-set]');
  if(t){const v=t.dataset.themeSet;window.AjoyTheme?.pin?.(v);const seg=menu.querySelector('.pf-seg');seg.style.setProperty('--at',{light:0,dark:1,auto:2}[v]);seg.querySelectorAll('button').forEach(b=>b.setAttribute('aria-checked',String(b===t)));return;}
  const g=e.target.closest('[data-go]');if(!g)return;
  const go=g.dataset.go;
  if(go==='plan'){close();window.dispatchEvent(new CustomEvent('ajoy-account-open',{detail:{}}));}
  else if(go==='billing'){close();openEditor();}
  else if(go==='out'){close();const leaving=getAccountSession()?.token;if(leaving)accountRequest({step:'logout',token:leaving},8000).catch(()=>{});clearAccountSession();}
 });
 /* ---- billing details editor ---- */
 let dlg=null;
 function openEditor(){
  if(!dlg){
   dlg=document.createElement('dialog');dlg.className='pf-dlg';dlg.setAttribute('aria-labelledby','pf-dlg-title');document.body.append(dlg);
   dlg.addEventListener('cancel',e=>{e.preventDefault();closeEditor();});
   dlg.addEventListener('click',e=>{if(e.target===dlg)closeEditor();});
  }
  drawEditor(profile||cachedProfile()||emptyProfile());
  if(!dlg.open)dlg.showModal();
  loadProfile({fresh:true}).then(p=>{if(p!==undefined&&dlg.open&&!dlg.dataset.dirty){profile=p;drawEditor(p||emptyProfile());paintBtn();}});
 }
 function closeEditor(){if(!dlg||!dlg.open)return;dlg.dataset.closing='';const done=()=>{dlg.close();delete dlg.dataset.closing;delete dlg.dataset.dirty;};if(calm())done();else setTimeout(done,220);}
 function drawEditor(p){
  const f=(id,label,val,extra='')=>'<div class="pf-field"><label for="pf-'+id+'">'+label+'</label>'+(extra==='area'?'<textarea id="pf-'+id+'" name="'+id+'" rows="2" maxlength="400">'+esc(val)+'</textarea>':'<input id="pf-'+id+'" name="'+id+'" value="'+esc(val)+'" maxlength="'+(id==='postal'||id==='companyPostal'?24:160)+'" autocomplete="off">')+'</div>';
  dlg.innerHTML='<form class="pf-form" novalidate><button class="pf-x" type="button" aria-label="Close" data-x>×</button><h2 id="pf-dlg-title">Billing details</h2><p class="pf-note">Saved to your account and filled in for you at checkout. Your billing country is detected automatically, so it is not saved here.</p>'+
   f('name','Full name',p.name)+f('address','Billing address',p.address,'area')+'<div class="pf-row">'+f('postal','Postal code',p.postal)+f('city','City',p.city)+'</div>'+f('region','State or region',p.region)+
   '<label class="pf-check"><input type="checkbox" name="companyOn"'+(p.companyOn?' checked':'')+'><span>I\'m buying for a studio or company</span></label>'+
   '<div class="pf-co" data-open="'+p.companyOn+'"><div>'+f('company','Company name',p.company)+f('companyAddress','Company address',p.companyAddress,'area')+f('companyPostal','Company postal code',p.companyPostal)+'</div></div>'+
   '<fieldset class="pf-pay"><legend>Preferred payment method</legend>'+[['','No preference'],['razorpay','Razorpay'],['paypal','PayPal']].map(([v,t])=>'<label><input type="radio" name="payment" value="'+v+'"'+((p.payment||'')===v?' checked':'')+'><span>'+t+'</span></label>').join('')+'</fieldset>'+
   '<p class="pf-msg" role="status" aria-live="polite"></p><div class="pf-actions"><button class="pf-save" type="submit">Save details</button><button class="pf-clear" type="button" data-clear'+(hasBilling(p)||p.payment?'':' hidden')+'>Remove saved details</button></div></form>';
  const form=dlg.querySelector('form'),msg=form.querySelector('.pf-msg'),co=form.querySelector('.pf-co');
  form.addEventListener('input',()=>{dlg.dataset.dirty='';});
  form.elements.companyOn.addEventListener('change',e=>{co.dataset.open=String(e.target.checked);});
  form.querySelector('[data-x]').onclick=closeEditor;
  const say=(t,kind)=>{msg.textContent=t;msg.dataset.kind=kind||'';};
  form.addEventListener('submit',async e=>{
   e.preventDefault();const E=form.elements,on=E.companyOn.checked,sv=form.querySelector('.pf-save');
   sv.disabled=true;sv.textContent='Saving…';say('');
   try{profile=await saveProfile({name:E.name.value,address:E.address.value,postal:E.postal.value,city:E.city.value,region:E.region.value,companyOn:on,company:on?E.company.value:'',companyAddress:on?E.companyAddress.value:'',companyPostal:on?E.companyPostal.value:'',payment:E.payment.value});
    delete dlg.dataset.dirty;paintBtn();say('Saved. You will not need to type these again.','ok');sv.textContent='Saved ✓';setTimeout(()=>{if(dlg.open)closeEditor();},900);}
   catch(error){say(error.message,'error');sv.disabled=false;sv.textContent='Save details';}
  });
  const cl=form.querySelector('[data-clear]');let armed=false;
  cl.onclick=async()=>{
   if(!armed){armed=true;cl.textContent='Tap again to remove for good';setTimeout(()=>{armed=false;cl.textContent='Remove saved details';},4000);return;}
   cl.disabled=true;try{await clearProfile();profile=null;delete dlg.dataset.dirty;paintBtn();drawEditor(emptyProfile());dlg.querySelector('.pf-msg').textContent='Removed.';}catch(error){say(error.message,'error');cl.disabled=false;}
  };
 }
 onAccountChange(()=>{profile=cachedProfile()||null;paintBtn();if(!menu.hidden)build();if(getAccountSession())loadProfile().then(p=>{if(p!==undefined){profile=p;paintBtn();}});});
 profile=cachedProfile()||null;paintBtn();if(getAccountSession())loadProfile().then(p=>{if(p!==undefined){profile=p;paintBtn();}});
}
