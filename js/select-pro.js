/* Custom dropdowns for the billing form. The real <select> stays in the page (hidden over the button), so the
   form's own scripts keep working: they read and set .value, add options, toggle disabled and listen for "change". */
(()=>{
const valueProto=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value');
const chev='<svg class="sp-chev" viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M5 8l5 5 5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const mag='<svg class="sp-mag" viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><circle cx="9" cy="9" r="5.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M13.5 13.5L17 17" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
let uid=0;
function enhance(sel){
  if(sel.dataset.sp)return;sel.dataset.sp='1';
  const id='sp'+(++uid);
  const wrap=document.createElement('div');wrap.className='sp';
  sel.parentNode.insertBefore(wrap,sel);wrap.appendChild(sel);
  sel.classList.add('sp-native');sel.tabIndex=-1;sel.setAttribute('aria-hidden','true');
  const btn=document.createElement('button');btn.type='button';btn.className='sp-btn';
  btn.setAttribute('aria-haspopup','listbox');btn.setAttribute('aria-expanded','false');btn.setAttribute('aria-controls',id+'-list');
  const lab=sel.labels&&sel.labels[0];if(lab){if(!lab.id)lab.id=id+'-lab';btn.setAttribute('aria-labelledby',lab.id+' '+id+'-val');}
  const val=document.createElement('span');val.className='sp-val';val.id=id+'-val';
  btn.append(val);btn.insertAdjacentHTML('beforeend',chev);
  const pop=document.createElement('div');pop.className='sp-pop';pop.hidden=true;
  const searchable=sel.options.length>9;
  let search=null;
  if(searchable){const s=document.createElement('div');s.className='sp-search';s.innerHTML=mag;search=document.createElement('input');
    search.type='search';search.placeholder='Search…';search.autocomplete='off';search.setAttribute('aria-label','Search');s.append(search);pop.append(s);}
  const list=document.createElement('div');list.className='sp-list';list.id=id+'-list';list.setAttribute('role','listbox');list.tabIndex=-1;
  pop.append(list);wrap.append(btn,pop);
  let items=[],active=-1,open=false;
  const text=o=>o?o.textContent.trim():'';
  function build(){
    list.textContent='';items=[];
    for(const o of sel.options){
      if(o.value==='')continue;
      const el=document.createElement('div');el.className='sp-opt';el.setAttribute('role','option');el.id=id+'-o'+items.length;
      el.dataset.v=o.value;el.textContent=text(o);el.insertAdjacentHTML('beforeend','<svg class="sp-tick" viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M4.5 10.5l3.5 3.5 7.5-8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>');
      list.append(el);items.push(el);
    }
    refresh();
  }
  function refresh(){
    const cur=valueProto.get.call(sel),o=sel.selectedOptions[0];
    const empty=!cur;
    val.textContent=empty?(text(sel.options[0])||'Select'):text(o);
    btn.classList.toggle('sp-empty',empty);
    for(const el of items){const on=el.dataset.v===cur;el.classList.toggle('sel',on);el.setAttribute('aria-selected',on?'true':'false');}
    btn.disabled=sel.disabled;wrap.classList.toggle('sp-off',sel.disabled);
  }
  Object.defineProperty(sel,'value',{configurable:true,get(){return valueProto.get.call(sel)},set(v){valueProto.set.call(sel,v);refresh();}});
  new MutationObserver(m=>{if(m.some(x=>x.type==='childList'))build();else refresh();}).observe(sel,{childList:true,attributes:true,attributeFilter:['disabled']});
  sel.addEventListener('change',refresh);
  sel.addEventListener('focus',()=>btn.focus());
  sel.addEventListener('invalid',()=>wrap.classList.add('sp-bad'));
  function visible(){return items.filter(e=>!e.hidden)}
  function setActive(i,scroll=true){
    const v=visible();if(!v.length)return;
    i=Math.max(0,Math.min(v.length-1,i));
    for(const e of items)e.classList.remove('act');
    v[i].classList.add('act');active=i;
    (search||list).setAttribute('aria-activedescendant',v[i].id);
    if(scroll){const t=v[i].offsetTop,b=t+v[i].offsetHeight;if(t<list.scrollTop)list.scrollTop=t-4;else if(b>list.scrollTop+list.clientHeight)list.scrollTop=b-list.clientHeight+4;}
  }
  function openPop(){
    if(open||btn.disabled)return;open=true;
    if(search){search.value='';for(const e of items)e.hidden=false;}
    pop.hidden=false;
    const r=btn.getBoundingClientRect(),room=innerHeight-r.bottom,need=Math.min(360,pop.offsetHeight||360)+16;
    wrap.classList.toggle('sp-up',room<need&&r.top>room);
    btn.setAttribute('aria-expanded','true');wrap.classList.add('sp-open');
    requestAnimationFrame(()=>pop.classList.add('open'));
    const cur=valueProto.get.call(sel),i=visible().findIndex(e=>e.dataset.v===cur);
    setActive(i<0?0:i,false);
    const s=visible()[active<0?0:active];if(s)list.scrollTop=Math.max(0,s.offsetTop-list.clientHeight/2+s.offsetHeight/2);
    (search||list).focus({preventScroll:true});
  }
  function closePop(refocus){
    if(!open)return;open=false;pop.classList.remove('open');btn.setAttribute('aria-expanded','false');wrap.classList.remove('sp-open');
    setTimeout(()=>{if(!open)pop.hidden=true;},200);
    if(refocus)btn.focus({preventScroll:true});
  }
  function choose(el){
    valueProto.set.call(sel,el.dataset.v);wrap.classList.remove('sp-bad');refresh();
    sel.dispatchEvent(new Event('input',{bubbles:true}));sel.dispatchEvent(new Event('change',{bubbles:true}));closePop(true);
  }
  btn.addEventListener('click',()=>open?closePop(true):openPop());
  btn.addEventListener('keydown',e=>{if(['ArrowDown','ArrowUp','Enter',' '].includes(e.key)){e.preventDefault();openPop();}});
  list.addEventListener('pointerdown',e=>e.preventDefault());
  list.addEventListener('click',e=>{const el=e.target.closest('.sp-opt');if(el)choose(el);});
  list.addEventListener('pointermove',e=>{const el=e.target.closest('.sp-opt');if(el&&!el.classList.contains('act')){const v=visible();setActive(v.indexOf(el),false);}});
  const keys=e=>{
    const v=visible();
    if(e.key==='ArrowDown'){e.preventDefault();setActive(active+1);}
    else if(e.key==='ArrowUp'){e.preventDefault();setActive(active-1);}
    else if(e.key==='Home'&&!search){e.preventDefault();setActive(0);}
    else if(e.key==='End'&&!search){e.preventDefault();setActive(v.length-1);}
    else if(e.key==='Enter'){e.preventDefault();if(v[active])choose(v[active]);}
    else if(e.key==='Escape'){e.preventDefault();closePop(true);}
    else if(e.key==='Tab'){closePop(false);}
    else if(!search&&e.key.length===1){const k=e.key.toLowerCase(),i=v.findIndex(x=>x.textContent.trim().toLowerCase().startsWith(k));if(i>=0)setActive(i);}
  };
  list.addEventListener('keydown',keys);
  if(search){search.addEventListener('keydown',keys);
    search.addEventListener('input',()=>{const q=search.value.trim().toLowerCase();for(const e of items)e.hidden=!!q&&!e.textContent.toLowerCase().includes(q);list.scrollTop=0;setActive(0,false);
      list.classList.toggle('sp-none',!visible().length);});}
  document.addEventListener('pointerdown',e=>{if(open&&!wrap.contains(e.target))closePop(false);});
  build();
}
document.querySelectorAll('.checkout-form .form-field > select').forEach(enhance);
})();
