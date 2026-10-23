/* Wrapline reviews on the landing page: one average across all thirteen tools, each tool's own score,
   and the latest written reviews. Read-only; reviews are written on each tool's page. Text is always rendered as text. */
const section=document.querySelector('[data-wrapline-reviews]');
const chip=document.querySelector('[data-wrapline-rating]');
const TOOLS=[['advanced-ik-fk-switch','Advanced IK FK Switch'],['alembic-exporter','Alembic Exporter'],['audio-exporter','Audio Exporter'],
 ['fbx-exporter','FBX Exporter'],['hotkey-manager','Hotkey Manager'],['ik-fk-snap','IK / FK Snap'],['layer-prefix-remover','Layer Prefix Remover'],
 ['multi-swapper','Multi Swapper'],['playblast','Playblast'],['rebake-ik-space','Rebake IK Space'],['revert-to-last-saved','Revert to Last Saved'],
 ['rivet','Rivet'],['udim-preview','UDIM Preview']];
const NAMES=Object.fromEntries(TOOLS);
const CACHE='ajoy.reviews.all';
const reduce=matchMedia('(prefers-reduced-motion: reduce)');

const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;};
const starRow=(value,cls='rv-stars')=>{const wrap=el('span',cls);wrap.setAttribute('role','img');wrap.setAttribute('aria-label',`${value} out of 5 stars`);
 for(let i=1;i<=5;i++){const s=el('i');s.style.setProperty('--fill',Math.round(Math.max(0,Math.min(1,value-(i-1)))*100)+'%');wrap.append(s);}return wrap;};
const plural=(n,w)=>`${n} ${w}${n===1?'':'s'}`;
const hue=text=>{let h=0;for(const c of text)h=(h*31+c.charCodeAt(0))%360;return h;};
const initials=(name='')=>name.split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0].toUpperCase()).join('')||'?';
const ago=iso=>{const s=(Date.now()-new Date(iso))/1000;if(!isFinite(s))return '';
 for(const [n,u] of [[31536000,'year'],[2592000,'month'],[604800,'week'],[86400,'day'],[3600,'hour'],[60,'minute']])if(s>=n){const v=Math.floor(s/n);return `${v} ${u}${v>1?'s':''} ago`;}return 'just now';};

async function post(tool){
 const endpoint=window.AJOY_CONFIG?.sheetUrl;if(!endpoint)throw Error('unavailable');
 const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({type:'reviews',tool,op:'list'}),signal:AbortSignal.timeout(30000)});
 const result=await response.json();if(!response.ok||!result.ok)throw Error(result.error||'unavailable');return result;
}

/* Until the Apps Script with the combined summary is deployed, add up each tool's public list instead. */
async function combine(){
 const lists=await Promise.all(TOOLS.map(([tool])=>post(tool).catch(()=>null)));
 if(lists.every(l=>!l))throw Error('unavailable');
 const distribution=[0,0,0,0,0],reviews=[];let count=0,total=0;
 const tools=TOOLS.map(([tool],i)=>{const l=lists[i];if(!l)return {tool,count:0,average:0};
  l.distribution.forEach((n,r)=>{distribution[r]+=n;total+=n*(r+1);});count+=l.count;
  l.reviews.forEach(r=>reviews.push({...r,tool}));return {tool,count:l.count,average:l.average};});
 reviews.sort((a,b)=>a.date<b.date?1:-1);
 return {count,average:count?Math.round(total/count*10)/10:0,distribution,tools,reviews:reviews.filter(r=>r.text).slice(0,6)};
}

async function fetchAll(){
 try{return await post('all');}catch(error){if(error.message==='invalid')return combine();throw error;}
}

function countUp(node,to){
 if(reduce.matches||!to){node.textContent=to.toFixed(1);return;}
 const start=performance.now();const step=now=>{const p=Math.min(1,(now-start)/900);node.textContent=(to*(1-Math.pow(1-p,3))).toFixed(1);if(p<1)requestAnimationFrame(step);};requestAnimationFrame(step);
}

function render(data){
 if(chip){
  if(data.count){chip.replaceChildren(starRow(data.average,'rv-stars rv-stars-sm'),el('b','',data.average.toFixed(1)),el('span','',`Wrapline reviews · ${plural(data.count,'review')}`));
   chip.setAttribute('aria-label',`Wrapline is rated ${data.average.toFixed(1)} out of 5 from ${plural(data.count,'review')}. Read the reviews`);chip.hidden=false;}
  else chip.hidden=true;
 }
 if(!section)return;
 const score=section.querySelector('.rv-score'),bars=section.querySelector('.rv-bars'),summary=section.querySelector('.rv-summary');
 score.replaceChildren();bars.replaceChildren();
 if(!data.count){
  summary.dataset.empty='true';
  score.append(el('b','rv-empty-title','No reviews yet'),el('p','rv-empty-text','Used a Wrapline tool? Be the first to rate it on the tool’s page.'));
 }else{
  delete summary.dataset.empty;
  const avg=el('b','rv-average','0.0');score.append(avg,starRow(data.average,'rv-stars rv-stars-lg'),el('span','rv-total',`Average of ${plural(data.count,'review')} across all tools`));countUp(avg,data.average);
  for(let r=5;r>=1;r--){const n=data.distribution[r-1],row=el('div','rv-bar');row.style.setProperty('--w',n/data.count*100+'%');row.style.setProperty('--d',(5-r)*70+'ms');
   const track=el('span','rv-track');track.append(el('i'));row.append(el('span','rv-bar-label',r+'★'),track,el('span','rv-bar-n',String(n)));row.setAttribute('aria-label',`${r} stars: ${plural(n,'review')}`);bars.append(row);}
 }
 const list=section.querySelector('.wlr-tools');list.replaceChildren();
 const order=[...(data.tools||[])].filter(t=>NAMES[t.tool]).sort((a,b)=>(b.count>0)-(a.count>0)||b.average-a.average||b.count-a.count||NAMES[a.tool].localeCompare(NAMES[b.tool]));
 order.forEach((t,i)=>{const li=el('li','wlr-tool');li.style.setProperty('--i',i);
  const a=el('a','wlr-tool-link');a.href=`tool-${t.tool}.html#reviews`;a.append(el('b','',NAMES[t.tool]));
  if(t.count){const score=el('span','wlr-tool-score');score.append(starRow(t.average,'rv-stars rv-stars-sm'),el('strong','',t.average.toFixed(1)),el('span','',`(${t.count})`));a.append(score);
   a.setAttribute('aria-label',`${NAMES[t.tool]}: ${t.average.toFixed(1)} out of 5 from ${plural(t.count,'review')}`);}
  else{a.append(el('span','wlr-tool-none','Be the first to rate'));}
  li.append(a);list.append(li);});
 const quotes=section.querySelector('.wlr-quotes'),cards=quotes.querySelector('.rv-list');cards.replaceChildren();
 (data.reviews||[]).slice(0,3).forEach((r,i)=>{
  const card=el('article','rv-card');card.style.setProperty('--i',i);
  const head=el('header','rv-card-head'),avatar=el('span','rv-avatar',initials(r.name));avatar.style.setProperty('--h',hue(r.name||''));avatar.setAttribute('aria-hidden','true');
  const who=el('div','rv-who');who.append(el('b','',r.name));const meta=el('span','rv-meta');meta.append(starRow(r.rating,'rv-stars rv-stars-sm'),el('time','',ago(r.date)));meta.querySelector('time').dateTime=r.date;who.append(meta);
  head.append(avatar,who);if(NAMES[r.tool]){const tag=el('a','wlr-tag',NAMES[r.tool]);tag.href=`tool-${r.tool}.html#reviews`;head.append(tag);}
  card.append(head,el('p','rv-text',r.text));cards.append(card);});
 quotes.hidden=!cards.children.length;
 section.dataset.state='ready';section.hidden=false;
}

async function load(){
 try{const cached=JSON.parse(sessionStorage.getItem(CACHE)||'null');if(cached&&Date.now()-cached.at<300000){render(cached.data);return;}}catch{}
 try{const data=await fetchAll();try{sessionStorage.setItem(CACHE,JSON.stringify({at:Date.now(),data}));}catch{}render(data);}
 catch{/* Reviews are extra: when they cannot load, the section simply stays hidden. */}
}

if(section||chip){
 const start=()=>('requestIdleCallback'in window?requestIdleCallback(load,{timeout:2500}):setTimeout(load,300));
 if(document.readyState==='complete')start();else addEventListener('load',start,{once:true});
}
