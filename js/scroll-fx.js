/* Site-wide scroll motion ("focus in"): section headings arrive word by word out of a soft blur, eyebrows slide in,
   and cards unfold upward in a short stagger as they enter the screen. Hero shelves drift with a gentle parallax.
   Content is only hidden after this script has marked it, so pages without JavaScript stay fully readable.
   Off for reduced motion. Elements that already have their own reveal (.reveal, [data-policy-reveal]) are left alone. */
(()=>{
 const reduce=matchMedia('(prefers-reduced-motion: reduce)');
 if(reduce.matches||!('IntersectionObserver' in window))return;
 const root=document.documentElement;root.classList.add('sfx');
 const skip=el=>el.closest('.reveal,[data-policy-reveal],dialog,.coffee,.faq,.workflow-panel,.trial-showcase,.hero,.tool-hero,.s-hero,.ft-hero,.commerce-header,.site-header,#tools .tile,[hidden]');
 const marked=[];
 // headings: split into words (inline elements such as <em> move as one word)
 for(const h of document.querySelectorAll('main h2')){
  if(skip(h)||h.dataset.sfx)continue;
  let i=0;const parts=[];
  for(const node of [...h.childNodes]){
   if(node.nodeType===3){
    const bits=node.textContent.split(/(\s+)/);const frag=document.createDocumentFragment();
    for(const bit of bits){if(!bit)continue;if(/^\s+$/.test(bit)){frag.append(bit);continue;}const w=document.createElement('span');w.className='sfx-w';w.style.setProperty('--i',i++);w.textContent=bit;frag.append(w);}
    parts.push([node,frag]);
   }else if(node.nodeType===1&&node.tagName!=='BR'){node.classList.add('sfx-w');node.style.setProperty('--i',i++);}
  }
  for(const [node,frag] of parts)node.replaceWith(frag);
  h.dataset.sfx='head';marked.push(h);
 }
 for(const e of document.querySelectorAll('main .s-eyebrow,main .eyebrow')){if(skip(e)||e.dataset.sfx)continue;e.dataset.sfx='eyebrow';marked.push(e);}
 const CARDS='.s-card,.s-cmp,.mp-card,.s-point,.s-contact-card,.ft-card,.ft-steps li,.free-pro,.ft-coffee-card,.ft-rights li,.tool-free,.rights-note,.guide-notes,.sp-card,.contact-card,.chipl';
 const groups=new Map();
 for(const c of document.querySelectorAll(CARDS)){
  if(skip(c)||c.dataset.sfx)continue;
  const n=groups.get(c.parentElement)||0;groups.set(c.parentElement,n+1);
  c.style.setProperty('--sfx-d',Math.min(n,8)*(c.classList.contains('chipl')?35:90)+'ms');
  c.dataset.sfx='card';marked.push(c);
 }
 const done=el=>{el.classList.add('sfx-in');
  // hand control back to the element's own hover/transition styles once the entrance has played
  if(el.dataset.sfx==='card')setTimeout(()=>{el.removeAttribute('data-sfx');el.classList.remove('sfx-in');el.style.removeProperty('--sfx-d');},1500);};
 const io=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting){io.unobserve(e.target);done(e.target);}},{rootMargin:'0px 0px -8% 0px',threshold:.12});
 marked.forEach(el=>io.observe(el));
 // safety: never leave anything hidden (e.g. printed pages or anchors far down the page)
 addEventListener('beforeprint',()=>marked.forEach(done));
 setTimeout(()=>{if(document.visibilityState==='hidden')marked.forEach(done);},4000);
 // gentle parallax for decorative hero pieces
 const drift=[...document.querySelectorAll('[data-sfx-parallax]')];
 if(drift.length){let ticking=false;const run=()=>{ticking=false;const y=scrollY;for(const el of drift){const s=parseFloat(el.dataset.sfxParallax)||-.06;el.style.translate=`0 ${(y*s).toFixed(1)}px`;}};
  addEventListener('scroll',()=>{if(!ticking){ticking=true;requestAnimationFrame(run);}},{passive:true});run();}
})();
