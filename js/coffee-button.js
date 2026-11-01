/* Upgrades every <a data-coffee-btn> into the animated "Buy me a coffee" button (styles: css/coffee-btn.css).
   Without JavaScript the link still works as plain text. */
const calm=matchMedia('(prefers-reduced-motion: reduce)');
const MUG=`<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
 <defs><clipPath id="cfb-cup"><path d="M6 11h17v9a7 7 0 0 1-7 7h-3a7 7 0 0 1-7-7Z"/></clipPath></defs>
 <g class="cfb-steam"><path d="M11 8q-2-2 0-4"/><path d="M15 8q-2-2 0-4"/><path d="M19 8q-2-2 0-4"/></g>
 <path d="M23 13h1.5a3.5 3.5 0 0 1 0 7H23" fill="none" stroke="#E58A3E" stroke-width="2.2" stroke-linecap="round"/>
 <path d="M6 11h17v9a7 7 0 0 1-7 7h-3a7 7 0 0 1-7-7Z" fill="#FFF7EC"/>
 <g clip-path="url(#cfb-cup)"><rect class="cfb-fill" x="5" y="13" width="19" height="16" fill="#A8643A"/><path class="cfb-fill" d="M5 13.5q5 -1.6 9.5 0t9.5 0" fill="none" stroke="#D9A178" stroke-width="1.4"/></g>
 <path d="M6 11h17v9a7 7 0 0 1-7 7h-3a7 7 0 0 1-7-7Z" fill="none" stroke="#E58A3E" stroke-width="1.8" stroke-linejoin="round"/>
 <ellipse class="cfb-eye" cx="11.5" cy="18.5" rx="1" ry="1.3" fill="#3A1D05"/><ellipse class="cfb-eye" cx="17.5" cy="18.5" rx="1" ry="1.3" fill="#3A1D05"/>
 <path d="M13 21q1.5 1.4 3 0" fill="none" stroke="#3A1D05" stroke-width="1.1" stroke-linecap="round"/>
</svg>`;
const BITS=['♥','♥','●','♥','●'];
for(const link of document.querySelectorAll('a[data-coffee-btn]')){
 if(link.classList.contains('cfb'))continue;
 const text=(link.textContent||'').replace(/[☕\s]+/g,' ').trim()||'Buy me a coffee';
 link.className='cfb'+(link.dataset.coffeeBtn==='lg'?' cfb-lg':'');
 link.replaceChildren();
 const mug=document.createElement('span');mug.className='cfb-mug';mug.innerHTML=MUG;
 const label=document.createElement('span');label.className='cfb-label';label.textContent=text;
 link.append(mug,label);
 link.addEventListener('click',event=>{
  if(calm.matches||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  event.preventDefault();
  BITS.forEach((bit,i)=>{const s=document.createElement('span');s.className='cfb-pop';s.textContent=bit;s.setAttribute('aria-hidden','true');
   const angle=-150+i*28+Math.random()*10;s.style.setProperty('--x',(Math.cos(angle*Math.PI/180)*34).toFixed(0)+'px');s.style.setProperty('--y',(Math.sin(angle*Math.PI/180)*34-6).toFixed(0)+'px');
   s.style.setProperty('--r',(Math.random()*60-30).toFixed(0)+'deg');s.style.color=bit==='●'?'#A8643A':'#FF6F8E';s.style.animationDelay=(i*35)+'ms';link.append(s);setTimeout(()=>s.remove(),1100);});
  setTimeout(()=>{location.href=link.href;},420);
 });
}
