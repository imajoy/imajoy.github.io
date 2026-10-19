/* User-approved motion: keep alongside the four-step installer loop. */
const tools=document.querySelector('.home-page #tools');
if(tools&&'IntersectionObserver'in window){
 const preference=matchMedia('(prefers-reduced-motion: reduce)');
 const rows=[...tools.querySelectorAll('.tl li')],seen=new WeakSet(),entrances=new Map();
 const cards=new IntersectionObserver(entries=>{
  for(const entry of entries)entry.target.toggleAttribute('data-tool-active',entry.isIntersecting&&!document.hidden);
 },{threshold:0});
 const reveal=new IntersectionObserver(entries=>{
  for(const entry of entries){
   if(!entry.isIntersecting||preference.matches||document.hidden)continue;
   const row=entry.target;
   if(seen.has(row))continue;
   seen.add(row);reveal.unobserve(row);
   if(!row.animate||row.contains(document.activeElement))continue;
   const index=[...row.parentElement.children].indexOf(row);
   const animation=row.animate([{opacity:.6,transform:'translateY(8px)'},{opacity:1,transform:'none'}],{
    duration:280,delay:index*45,easing:'cubic-bezier(.22,1,.36,1)',fill:'backwards'
   });
   animation.id='tool-row-entry';entrances.set(row,animation);
   animation.finished.then(()=>entrances.delete(row),()=>entrances.delete(row));
  }
 },{threshold:0,rootMargin:'0px 0px 12px 0px'});
 const cancelEntrances=()=>{for(const animation of entrances.values())animation.cancel();entrances.clear();};
 const observe=()=>{
  reveal.disconnect();
  if(!preference.matches&&!document.hidden)rows.forEach(row=>{if(!seen.has(row))reveal.observe(row);});
 };
 const syncCards=()=>{
  for(const card of tools.querySelectorAll('.tile')){
   const bounds=card.getBoundingClientRect();
   card.toggleAttribute('data-tool-active',!document.hidden&&bounds.bottom>0&&bounds.top<innerHeight);
  }
 };
 tools.querySelectorAll('.tile').forEach(card=>cards.observe(card));observe();
 preference.addEventListener('change',()=>{cancelEntrances();observe();});
 document.addEventListener('visibilitychange',()=>{cancelEntrances();syncCards();observe();});
 tools.addEventListener('focusin',event=>{entrances.get(event.target.closest('.tl li'))?.cancel();});
}
