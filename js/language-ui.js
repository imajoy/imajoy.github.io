/* Language window: opened from the profile menu. Search, list, current language ticked, English first by default. */
const L=()=>window.AjoyLang;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const calm=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
let dlg=null,restore=null;
/* the window is shown only after its stylesheet has loaded, so it never flashes unstyled in a corner on the first open */
let cssReady=null;
function ensureCss(){
 if(cssReady)return cssReady;
 let l=document.querySelector('link[data-lang-css]');
 cssReady=new Promise(res=>{
  const done=()=>res();
  if(!l){l=document.createElement('link');l.rel='stylesheet';l.href='/css/language.css?v=lg6';l.dataset.langCss='';l.addEventListener('load',done,{once:true});l.addEventListener('error',done,{once:true});document.head.append(l);}
  else if(l.sheet)done();else{l.addEventListener('load',done,{once:true});l.addEventListener('error',done,{once:true});}
  setTimeout(done,2500);
 });
 return cssReady;
}
function draw(){
 const api=L();if(!api)return;const cur=api.current();
 dlg.innerHTML='<div class="lng-box"><button class="lng-x" type="button" aria-label="Close" data-x>×</button><h2 id="lng-title">Select a language</h2>'+
  '<p class="lng-note">Wrapline will be shown in this language on this device.</p>'+
  '<label class="lng-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg><input type="search" placeholder="Search for a language" aria-label="Search for a language" autocomplete="off" spellcheck="false"></label>'+
  '<ul class="lng-list notranslate" translate="no" role="listbox" aria-label="Languages">'+api.list.map((l,i)=>'<li role="option" aria-selected="'+(l[0]===cur)+'" data-code="'+esc(l[0])+'" data-q="'+esc((l[1]+' '+l[2]+' '+l[0]).toLowerCase())+'" style="--i:'+Math.min(i,14)+'" tabindex="-1"><span class="lng-badge"><img src="/img/flags/'+esc(l[3])+'.png" alt="" width="36" height="36" decoding="async" draggable="false"></span><span class="lng-name"><b>'+esc(l[1])+'</b><small>'+esc(l[2])+'</small></span><svg class="lng-tick" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg></li>').join('')+'</ul>'+
  '<p class="lng-empty" hidden>No language found.</p><p class="lng-msg" role="status" aria-live="polite"></p></div>';
 const list=dlg.querySelector('.lng-list'),input=dlg.querySelector('input'),empty=dlg.querySelector('.lng-empty'),msg=dlg.querySelector('.lng-msg');
 const rows=()=>[...list.children];
 input.addEventListener('input',()=>{const q=input.value.trim().toLowerCase();let n=0;rows().forEach(r=>{const show=!q||r.dataset.q.includes(q);r.hidden=!show;if(show)n++;});empty.hidden=n>0;});
 dlg.querySelector('[data-x]').onclick=close;
 async function choose(li){
  const code=li.dataset.code;if(code===L().current()){close();return;}
  rows().forEach(r=>r.setAttribute('aria-selected',String(r===li)));li.dataset.pending='';msg.textContent='';
  const ok=await L().set(code);delete li.dataset.pending;
  if(ok){close();}else{rows().forEach(r=>r.setAttribute('aria-selected',String(r.dataset.code===L().current())));msg.textContent='Could not load that language right now. Please try again.';}
 }
 list.addEventListener('click',e=>{const li=e.target.closest('li');if(li)choose(li);});
 dlg.addEventListener('keydown',e=>{
  const vis=rows().filter(r=>!r.hidden),i=vis.indexOf(document.activeElement);
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();const n=e.key==='ArrowDown'?i+1:i-1;if(n<0){input.focus();}else if(vis[Math.min(n,vis.length-1)])vis[Math.min(n,vis.length-1)].focus();}
  else if(e.key==='Enter'&&document.activeElement.matches('li')){e.preventDefault();choose(document.activeElement);}
  else if(e.key==='Enter'&&document.activeElement===input){const f=vis[0];if(f){e.preventDefault();choose(f);}}
 });
 return {list,input};
}
function close(){
 if(!dlg||!dlg.open)return;dlg.dataset.closing='';
 const done=()=>{dlg.close();delete dlg.dataset.closing;if(restore)restore.focus?.({preventScroll:true});};
 if(calm())done();else setTimeout(done,220);
}
function warn(){
 dlg.innerHTML='<div class="lng-box lng-warn"><h2 id="lng-title">Language is not available here</h2>'+
  '<p class="lng-note">For your security, checkout and payment pages always stay in English. Your language applies on the other pages.</p><button class="lng-ok" type="button" data-x>Got it</button></div>';
 dlg.querySelectorAll('[data-x]').forEach(b=>b.onclick=close);
 return dlg.querySelector('.lng-ok');
}
export function openLanguage(){ensureCss().then(show);}
function show(){
 if(!dlg){dlg=document.createElement('dialog');dlg.className='lng-dlg';dlg.tabIndex=-1;dlg.setAttribute('aria-labelledby','lng-title');document.body.append(dlg);
  dlg.addEventListener('cancel',e=>{e.preventDefault();close();});dlg.addEventListener('click',e=>{if(e.target===dlg)close();});}
 restore=document.activeElement;
 if(L()&&!L().supported&&/^\/(checkout|payment)(\.html)?\/?$/.test(location.pathname)){const ok=warn();if(!dlg.open)dlg.showModal();requestAnimationFrame(()=>ok.focus({preventScroll:true}));return;}
 const {list,input}=draw()||{};if(!list)return;
 if(!dlg.open)dlg.showModal();
 /* no jumping: position the list before it is painted, and only open the keyboard on devices that have one built in */
 list.querySelector('[aria-selected=true]')?.scrollIntoView({block:'center',behavior:'instant'});
 if(matchMedia('(hover:hover) and (pointer:fine)').matches)input.focus({preventScroll:true});else dlg.focus({preventScroll:true});
}
export const currentLabel=()=>{const a=L();return a?a.entry()[1]:'English';};
