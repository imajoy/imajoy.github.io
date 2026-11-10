/* Wrapline Pro: smooth scroll-linked 3D depth. Sections tilt back as they enter and settle flat at mid-screen,
   cards drift in depth. Uses the separate `rotate`/`translate` properties so it never fights the reveal animations.
   One rAF loop with easing (lerp), only while scrolling; off for reduced motion and touch/phones. */
(()=>{
  if(!document.body.classList.contains('pro-page'))return;
  if(matchMedia('(prefers-reduced-motion:reduce)').matches||!matchMedia('(min-width:900px) and (pointer:fine)').matches)return;
  const secs=[...document.querySelectorAll('#workflows,#trial,#tools,#install,#reviews,#pricing,#faq')];
  const items=[];
  secs.forEach(s=>{
    const w=s.querySelector(':scope > .wrap')||s;
    s.style.perspective='1600px';s.style.perspectiveOrigin='50% 40%';
    items.push({el:w,sec:s,k:1,cur:0,tz:0});
    if(s.id==='tools')s.querySelectorAll('.tile').forEach((t,i)=>items.push({el:t,sec:s,k:.55,cur:0,tz:1,d:(i%3-1)}));
    if(s.id==='pricing')s.querySelectorAll('.plan,.price-card,.pcard').forEach((t,i)=>items.push({el:t,sec:s,k:.5,cur:0,tz:1,d:(i%3-1)}));
  });
  const vis=new Set();
  const io=new IntersectionObserver(es=>es.forEach(e=>{e.isIntersecting?vis.add(e.target):vis.delete(e.target);kick()}),{rootMargin:'20% 0px'});
  secs.forEach(s=>io.observe(s));
  let raf=0,idle=0;
  const ease=t=>t*t*(3-2*t);
  function frame(){
    raf=0;const vh=innerHeight;let moving=false;
    for(const it of items){
      if(!vis.has(it.sec))continue;
      const r=it.sec.getBoundingClientRect();
      // 0 when the section is centred, -1 entering from below, +1 leaving above
      const c=((r.top+Math.min(r.height,vh)/2)-vh/2)/vh;
      const n=Math.max(-1,Math.min(1,c*1.4));
      const target=ease(Math.abs(n))*Math.sign(n);
      it.cur+=(target-it.cur)*.12;
      if(Math.abs(target-it.cur)>.0006)moving=true;
      const a=it.cur*7*it.k;
      if(it.tz){
        it.el.style.rotate=`1 0 0 ${a.toFixed(3)}deg`;
        it.el.style.translate=`0 0 ${(-Math.abs(it.cur)*50*(1+(it.d||0)*.3)).toFixed(2)}px`;
      }else{
        it.el.style.rotate=`1 0 0 ${a.toFixed(3)}deg`;
        it.el.style.translate=`0 0 ${(-Math.abs(it.cur)*70).toFixed(2)}px`;
      }
    }
    if(moving)raf=requestAnimationFrame(frame);
  }
  function kick(){if(!raf)raf=requestAnimationFrame(frame)}
  addEventListener('scroll',kick,{passive:true});addEventListener('resize',kick);
  kick();
})();
