/* Real Maya recordings inside the workflow showcase.
   - Panels that ship with a recording (data-clip) play it as a silent loop.
   - Panels with a diagram (Rivet, FBX Exporter) swap the diagram for their recording as soon as assets/demos/index.json lists it
     (slug = the panel id without "workflow-"). Until then the labelled illustration stays. Nothing is generated or faked. */
const showcase=document.querySelector('#workflows');
if(showcase){
 const reduce=matchMedia('(prefers-reduced-motion: reduce)');
 const videos=new Set();
 const canWebm=document.createElement('video').canPlayType('video/webm; codecs="vp9"')!=='';
 const update=v=>{
  const panel=v.closest('.workflow-panel');
  const on=videos.has(v)&&panel&&!panel.hidden&&!reduce.matches&&!document.hidden;
  if(on){const p=v.play();p&&p.catch(()=>{});}else v.pause();
 };
 const load=v=>{
  if(v.dataset.ready)return;v.dataset.ready='1';
  const src=document.createElement('source');
  const first=canWebm&&v.dataset.webm?[v.dataset.webm,'video/webm']:[v.dataset.mp4,'video/mp4'];
  src.src=first[0];src.type=first[1];v.appendChild(src);
  if(first[1]==='video/webm'&&v.dataset.mp4){const alt=document.createElement('source');alt.src=v.dataset.mp4;alt.type='video/mp4';v.appendChild(alt);}
  v.addEventListener('playing',()=>v.closest('.clip-frame')?.classList.add('is-playing'),{once:true});
  v.load();
 };
 const watcher='IntersectionObserver' in window?new IntersectionObserver(entries=>{
  for(const e of entries){const v=e.target;
   if(e.isIntersecting){videos.add(v);if(!reduce.matches)load(v);}else videos.delete(v);
   update(v);}
 },{threshold:.35,rootMargin:'120px 0px'}):null;
 const watch=v=>{if(watcher)watcher.observe(v);};
 showcase.querySelectorAll('video[data-clip]').forEach(watch);
 /* when the person switches panels, start the visible one and stop the others */
 const sync=()=>showcase.querySelectorAll('video[data-clip]').forEach(update);
 new MutationObserver(sync).observe(showcase,{subtree:true,attributes:true,attributeFilter:['hidden']});
 document.addEventListener('visibilitychange',sync);
 reduce.addEventListener('change',sync);
 /* diagram panels: use a real recording when one has been added */
 fetch('/assets/demos/index.json',{cache:'no-cache'}).then(r=>r.ok?r.json():[]).catch(()=>[]).then(list=>{
  if(!Array.isArray(list))return;
  const have=new Set(list.filter(d=>d&&/^[a-z0-9-]+$/.test(d.slug)).map(d=>d.slug));
  showcase.querySelectorAll('.workflow-panel:not(.workflow-clip)').forEach(panel=>{
   const slug=panel.id.replace(/^workflow-/,'');if(!have.has(slug))return;
   const fig=panel.querySelector('.tool-visual');if(!fig)return;
   const frame=document.createElement('div');frame.className='clip-frame';
   const v=document.createElement('video');
   v.setAttribute('data-clip','');v.dataset.mp4='/assets/demos/'+slug+'.mp4';
   v.muted=true;v.loop=true;v.playsInline=true;v.preload='none';v.width=960;v.height=540;v.setAttribute('aria-hidden','true');v.tabIndex=-1;
   frame.appendChild(v);
   fig.querySelector('.tool-diagram')?.replaceWith(frame);
   fig.querySelector('.workflow-beats')?.remove();
   fig.classList.add('clip-visual');fig.removeAttribute('data-tool-motion');fig.removeAttribute('data-phase');
   const h=fig.querySelector('.visual-heading span');if(h)h.textContent='RECORDED IN MAYA';
   const c=fig.querySelector('figcaption');if(c)c.textContent='Screen recording from Maya · '+(panel.querySelector('h3')?.textContent||'');
   panel.classList.add('workflow-clip');watch(v);
  });
 });
}
