/* Second step before signing out or switching account: a small confirmation window. Resolves true only when the visitor confirms. */
const STYLE=`
.cl-dlg{position:fixed;inset:0;margin:auto;height:fit-content;box-sizing:border-box;width:min(400px,calc(100vw - 28px));padding:26px 24px 22px;border:1px solid var(--line,#d3d9e4);border-radius:24px;background:var(--bg2,var(--card,#fff));color:var(--ink,#111);box-shadow:0 40px 90px -30px rgba(10,20,50,.45)}
html[data-theme=dark] .cl-dlg{background:linear-gradient(180deg,#10172f,#0b1124);box-shadow:0 50px 110px -30px #000}
.cl-dlg::backdrop{background:rgba(8,12,30,.6)}
.cl-dlg[open]{animation:cl-in .32s cubic-bezier(.22,1,.36,1) both}.cl-dlg[open]::backdrop{animation:cl-fade .32s ease both}
.cl-dlg.cl-out{animation:cl-out .22s cubic-bezier(.4,0,1,1) both;pointer-events:none}.cl-dlg.cl-out::backdrop{animation:cl-fadeout .22s ease both}
.cl-dlg h2{margin:0 0 8px;font-size:1.25rem;letter-spacing:-.02em}.cl-dlg p{margin:0 0 20px;font-size:.9375rem;line-height:1.55;color:var(--mute,#667085)}
.cl-act{display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap}
.cl-btn{font:inherit;font-weight:600;font-size:.9375rem;padding:11px 20px;border-radius:999px;border:1px solid var(--line,#d3d9e4);background:transparent;color:var(--ink,#111);cursor:pointer;transition:transform .2s,border-color .2s,background .2s}
.cl-btn:hover,.cl-btn:focus-visible{transform:translateY(-1px);border-color:var(--blue-d,#2A64E8)}
.cl-go{background:var(--ink,#111);color:var(--bg,#fff);border-color:var(--ink,#111)}
html[data-theme=dark] .cl-go{background:#fff;color:#0b1124;border-color:#fff}
@keyframes cl-in{from{opacity:0;transform:translate3d(0,16px,0) scale(.985)}to{opacity:1;transform:none}}
@keyframes cl-out{from{opacity:1;transform:none}to{opacity:0;transform:translate3d(0,12px,0) scale(.985)}}
@keyframes cl-fade{from{opacity:0}to{opacity:1}}@keyframes cl-fadeout{from{opacity:1}to{opacity:0}}
@media(prefers-reduced-motion:reduce){.cl-dlg[open],.cl-dlg[open]::backdrop,.cl-dlg.cl-out,.cl-dlg.cl-out::backdrop{animation:none}}`;
const COPY={
  out:{title:'Sign out of Wrapline?',text:'You will be signed out on this device. Your subscriptions and saved details stay in your account.',yes:'Sign out'},
  switch:{title:'Switch account?',text:'You will be signed out here, then asked to sign in with another email.',yes:'Switch account'}
};
export function confirmLeave(kind){
  const c=COPY[kind]||COPY.out;
  return new Promise(resolve=>{
    if(!document.getElementById('cl-style')){const st=document.createElement('style');st.id='cl-style';st.textContent=STYLE;document.head.append(st);}
    const d=document.createElement('dialog');d.className='cl-dlg';d.setAttribute('aria-labelledby','cl-t');
    d.innerHTML='<h2 id="cl-t"></h2><p></p><div class="cl-act"><button type="button" class="cl-btn" data-no>Cancel</button><button type="button" class="cl-btn cl-go" data-yes></button></div>';
    d.querySelector('h2').textContent=c.title;d.querySelector('p').textContent=c.text;d.querySelector('[data-yes]').textContent=c.yes;
    let result=false,closing=false;
    const finish=()=>{d.remove();resolve(result);};
    const close=ok=>{
      if(closing)return;closing=true;result=ok;
      if(matchMedia('(prefers-reduced-motion:reduce)').matches){d.close();return;}
      d.classList.add('cl-out');let done=false;const end=()=>{if(!done){done=true;d.close();}};
      d.addEventListener('animationend',end,{once:true});setTimeout(end,320);
    };
    d.addEventListener('close',finish);
    d.addEventListener('cancel',e=>{e.preventDefault();close(false);});
    d.addEventListener('click',e=>{if(e.target===d||e.target.closest('[data-no]'))close(false);else if(e.target.closest('[data-yes]'))close(true);});
    document.body.append(d);d.showModal();d.querySelector('[data-no]').focus();
  });
}
