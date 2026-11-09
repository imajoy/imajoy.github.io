/* Language window: opened from the profile menu. Search, list, current language ticked, English first by default. */
const L=()=>window.AjoyLang;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const calm=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
let dlg=null,restore=null;
function ensureCss(){if(document.querySelector('link[data-lang-css]'))return;const l=document.createElement('link');l.rel='stylesheet';l.href='css/language.css?v=lg2';l.dataset.langCss='';document.head.append(l);}
function draw(){
 const api=L();if(!api)return;const cur=api.current();
 dlg.innerHTML='<div class="lng-box"><button class="lng-x" type="button" aria-label="Close" data-x>×</button><h2 id="lng-title">Select a language</h2>'+
  '<p class="lng-note">Wrapline will be shown in this language on this device.</p>'+
  '<label class="lng-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg><input type="search" placeholder="Search for a language" aria-label="Search for a language" autocomplete="off" spellcheck="false"></label>'+
  '<ul class="lng-list notranslate" translate="no" role="listbox" aria-label="Languages">'+api.list.map((l,i)=>'<li role="option" aria-selected="'+(l[0]===cur)+'" data-code="'+esc(l[0])+'" data-q="'+esc((l[1]+' '+l[2]+' '+l[0]).toLowerCase())+'" style="--i:'+Math.min(i,14)+'" tabindex="-1"><span class="lng-badge">'+esc(l[3])+'</span><span class="lng-name"><b>'+esc(l[1])+'</b><small>'+esc(l[2])+'</small></span><svg class="lng-tick" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg></li>').join('')+'</ul>'+
  (api.supported?'':'<p class="lng-here">This page stays in English for your security. Your language applies on the other pages.</p>')+'<p class="lng-empty" hidden>No language found.</p><p class="lng-msg" role="status" aria-live="polite"></p></div>';
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
export function openLanguage(){
 ensureCss();
 if(!dlg){dlg=document.createElement('dialog');dlg.className='lng-dlg';dlg.setAttribute('aria-labelledby','lng-title');document.body.append(dlg);
  dlg.addEventListener('cancel',e=>{e.preventDefault();close();});dlg.addEventListener('click',e=>{if(e.target===dlg)close();});}
 restore=document.activeElement;const {list,input}=draw()||{};if(!list)return;
 if(!dlg.open)dlg.showModal();
 requestAnimationFrame(()=>{list.querySelector('[aria-selected=true]')?.scrollIntoView({block:'center'});input.focus({preventScroll:true});});
}
export const currentLabel=()=>{const a=L();return a?a.entry()[1]:'English';};
