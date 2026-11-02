/* "Vibe" scroll layer for the Ajoy Tools home page and the Wrapline Pro page (styles: css/vibe-scroll.css).
   - a gradient scroll-progress bar with a glowing head
   - tilted ribbons ([data-vibe-ribbon]) that drift on their own and speed up / flip direction with your scroll
   - a highlighter swipe under each section heading's <em> as it arrives
   - small emoji stickers that pop onto section eyebrows
   - a soft glow on cards that follows the pointer
   Everything is decorative: transforms and opacity only, paused off screen, and fully off for reduced motion.
   It never touches the protected Pro tool cards (#tools .tile) or the installer illustration (#stage-install). */
(()=>{
 const reduce=matchMedia('(prefers-reduced-motion: reduce)');
 if(reduce.matches)return;
 const root=document.documentElement;root.classList.add('vibe');
 const page=document.body.dataset.vibe||'ajoy';

 /* 1. progress bar */
 const bar=document.createElement('div');bar.className='vb-progress';bar.setAttribute('aria-hidden','true');bar.append(document.createElement('i'));document.body.append(bar);

 /* 2. ribbons */
 const ribbons=[...document.querySelectorAll('[data-vibe-ribbon]')].map(el=>{
  const track=el.querySelector('.vb-track');if(!track)return null;
  // repeat the phrase list until it is wide enough to loop without a gap
  const base=track.innerHTML;let guard=0;while(track.scrollWidth<innerWidth*2.2&&guard++<8)track.insertAdjacentHTML('beforeend',base);
  track.insertAdjacentHTML('beforeend',track.innerHTML);
  return {el,track,x:0,dir:Number(el.dataset.vibeRibbon)||1,visible:false};
 }).filter(Boolean);
 const ribbonIO=new IntersectionObserver(es=>{for(const e of es){const r=ribbons.find(r=>r.el===e.target);if(r)r.visible=e.isIntersecting;}kick();},{rootMargin:'100px 0px'});
 ribbons.forEach(r=>ribbonIO.observe(r.el));

 /* one animation loop for the progress bar and ribbons */
 let lastY=scrollY,velocity=0,lastT=performance.now(),flip=1,running=false;
 /* the loop only runs while a ribbon is on screen or the page is still settling after a scroll */
 function kick(){if(!running){running=true;lastT=performance.now();requestAnimationFrame(frame);}}
 addEventListener('scroll',kick,{passive:true});addEventListener('resize',kick,{passive:true});
 function frame(t){
  const dt=Math.min(64,t-lastT);lastT=t;
  const y=scrollY,max=Math.max(1,document.documentElement.scrollHeight-innerHeight);
  bar.style.setProperty('--p',(y/max).toFixed(4));
  const dy=y-lastY;lastY=y;
  velocity+=(dy-velocity)*.12;           // smoothed scroll speed
  if(Math.abs(dy)>2)flip=dy>0?1:-1;      // ribbons follow the scroll direction
  const boost=Math.min(14,Math.abs(velocity)*.35);
  for(const r of ribbons){
   if(!r.visible)continue;
   const half=r.track.scrollWidth/2||1;
   r.x-=(0.6+boost)*r.dir*flip*(dt/16.7);
   if(r.x<=-half)r.x+=half;if(r.x>0)r.x-=half;
   r.track.style.transform=`translate3d(${r.x.toFixed(2)}px,0,0) skewX(${(-velocity*.15).toFixed(2)}deg)`;
  }
  if(ribbons.some(r=>r.visible)||Math.abs(velocity)>.05)requestAnimationFrame(frame);else running=false;
 }
 kick();

 /* 3 + 4. highlighter swipe and stickers, played once as each part enters */
 const STICKERS=page==='pro'?['✨','⚡','🔥','💎','🎬','🚀','🏆','💛']:['✨','🫶','⚡','🔥','🎬','🚀','💜','👀'];
 const skip=el=>el.closest('#tools .tile,#stage-install,dialog,.coffee,[hidden]');
 const seen=new IntersectionObserver(es=>{for(const e of es)if(e.isIntersecting){seen.unobserve(e.target);e.target.classList.add('vb-on');}},{rootMargin:'0px 0px -12% 0px',threshold:.2});
 document.querySelectorAll('main h2 em').forEach(em=>{if(skip(em))return;em.classList.add('vb-hl');seen.observe(em);});
 let n=0;
 document.querySelectorAll('main .eyebrow,main .s-eyebrow').forEach(eb=>{
  if(skip(eb)||eb.closest('.hero,.s-hero,.trial-showcase')||eb.querySelector('.vb-sticker'))return;
  const s=document.createElement('span');s.className='vb-sticker';s.setAttribute('aria-hidden','true');s.textContent=STICKERS[n%STICKERS.length];
  s.style.setProperty('--tilt',(n%2?-1:1)*(8+(n*7)%10)+'deg');n++;
  eb.classList.add('vb-has-sticker');eb.append(s);seen.observe(eb);
 });

 /* 5. pointer glow on cards (mouse and pen only) */
 if(matchMedia('(hover: hover) and (pointer: fine)').matches){
  const CARDS='.s-card,.s-cmp,.s-point,.s-contact-card,.plan,.rv-summary,.mp-card';
  document.querySelectorAll(CARDS).forEach(card=>{
   if(skip(card))return;
   if(getComputedStyle(card).position==='static')card.style.position='relative';card.style.isolation='isolate';
   const glow=document.createElement('span');glow.className='vb-glow';glow.setAttribute('aria-hidden','true');card.append(glow);
   card.addEventListener('pointermove',e=>{const r=card.getBoundingClientRect();card.style.setProperty('--mx',(e.clientX-r.left)+'px');card.style.setProperty('--my',(e.clientY-r.top)+'px');},{passive:true});
  });
 }
})();
