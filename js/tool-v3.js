/* Tool pages v3: numbered section labels (Pro pages), added once on load. No scroll work here. */
(()=>{
  const b=document.body;
  if(b.classList.contains('tv-free')){const t=document.querySelector('.tool-copy h1 .ln>span');if(t&&!t.querySelector('.hl')){const m=document.createElement('span');m.className='hl';m.textContent=t.textContent;t.replaceChildren(m);}return;}
  if(!b.classList.contains('tv-pro'))return;
  const spots=[['.guide-intro','What it does'],['.guide-workflow','How you use it'],['.guide-notes','Before you start'],['.rv-head','Reviews'],['.tool-more .wrap','More tools']];
  let n=0;
  for(const [sel,name] of spots){
    const el=document.querySelector(sel);if(!el)continue;
    const lab=document.createElement('div');lab.className='tv-lab';lab.setAttribute('aria-hidden','true');
    lab.innerHTML='<b>'+String(++n).padStart(2,'0')+'</b><i></i><span>'+name+'</span>';
    sel==='.tool-more .wrap'?el.prepend(lab):el.before(lab);
  }
})();
