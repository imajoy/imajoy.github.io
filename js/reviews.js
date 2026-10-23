/* Public tool reviews: anyone can read, a signed-in account can post one review per tool (edit or remove later).
   Data lives in the private Sheet; the email is never sent back to the page. Text is always rendered as text. */
import {getAccountSession,onAccountChange,openAccount} from './account-session.js?v=20261023-p5';

const section=document.querySelector('[data-reviews]');
if(section){
 const tool=section.dataset.tool,toolName=section.dataset.toolName||'this tool';
 const badge=document.querySelector('[data-rating-badge]');
 const $=s=>section.querySelector(s);
 const summary=$('.rv-summary'),list=$('.rv-list'),more=$('.rv-more'),writeBtn=$('.rv-write'),form=$('.rv-form'),status=$('.rv-status');
 const stars=[...form.querySelectorAll('input[name=rating]')],ratingText=form.querySelector('.rv-rating-text'),nameInput=form.elements.name,textInput=form.elements.text,counter=form.querySelector('.rv-count');
 const submit=form.querySelector('[type=submit]'),submitLabel=submit.querySelector('.send-label'),removeBtn=form.querySelector('.rv-remove'),cancelBtn=form.querySelector('.rv-cancel');
 const words=['','Poor','Fair','Good','Very good','Excellent'];
 const CACHE='ajoy.reviews.'+tool,NAME='ajoy.review.name';
 const reduce=matchMedia('(prefers-reduced-motion: reduce)');
 let data=null,shown=5,pendingWrite=false,busy=false,loadedOnce=false;

 const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;};
 const starRow=(value,cls='rv-stars')=>{const wrap=el('span',cls);wrap.setAttribute('role','img');wrap.setAttribute('aria-label',`${value} out of 5 stars`);
  for(let i=1;i<=5;i++){const s=el('i');const fill=Math.max(0,Math.min(1,value-(i-1)));s.style.setProperty('--fill',Math.round(fill*100)+'%');wrap.append(s);}return wrap;};
 const ago=iso=>{const d=new Date(iso),s=(Date.now()-d)/1000;if(!isFinite(s))return '';
  const units=[[31536000,'year'],[2592000,'month'],[604800,'week'],[86400,'day'],[3600,'hour'],[60,'minute']];
  for(const [n,u] of units)if(s>=n){const v=Math.floor(s/n);return `${v} ${u}${v>1?'s':''} ago`;}return 'just now';};
 const hue=text=>{let h=0;for(const c of text)h=(h*31+c.charCodeAt(0))%360;return h;};
 const initials=name=>name.split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0].toUpperCase()).join('')||'?';
 const plural=(n,w)=>`${n} ${w}${n===1?'':'s'}`;

 function countUp(node,to,decimals){
  if(reduce.matches||!to){node.textContent=to.toFixed(decimals);return;}
  const start=performance.now(),dur=900;const step=now=>{const p=Math.min(1,(now-start)/dur),e=1-Math.pow(1-p,3);node.textContent=(to*e).toFixed(decimals);if(p<1)requestAnimationFrame(step);};requestAnimationFrame(step);
 }

 function renderBadge(){
  if(!badge||!data)return;
  if(!data.count){badge.hidden=true;return;}
  badge.replaceChildren(starRow(data.average,'rv-stars rv-stars-sm'),el('b','',data.average.toFixed(1)),el('span','',plural(data.count,'review')));
  badge.setAttribute('aria-label',`Rated ${data.average.toFixed(1)} out of 5 from ${plural(data.count,'review')}. Read the reviews`);
  badge.hidden=false;badge.classList.add('is-new');
 }

 function renderSummary(){
  const box=summary.querySelector('.rv-score');box.replaceChildren();
  if(!data.count){
   box.append(el('b','rv-empty-title','No reviews yet'),el('p','rv-empty-text',`Used ${toolName}? Be the first to rate it.`));
   summary.querySelector('.rv-bars').replaceChildren();summary.dataset.empty='true';return;
  }
  delete summary.dataset.empty;
  const avg=el('b','rv-average','0.0');box.append(avg,starRow(data.average,'rv-stars rv-stars-lg'),el('span','rv-total',plural(data.count,'review')));
  countUp(avg,data.average,1);
  const bars=summary.querySelector('.rv-bars');bars.replaceChildren();
  for(let r=5;r>=1;r--){const n=data.distribution[r-1],row=el('div','rv-bar');row.style.setProperty('--w',(data.count?n/data.count*100:0)+'%');row.style.setProperty('--d',(5-r)*70+'ms');
   const track=el('span','rv-track');track.append(el('i'));row.append(el('span','rv-bar-label',r+'★'),track,el('span','rv-bar-n',String(n)));row.setAttribute('aria-label',`${r} stars: ${plural(n,'review')}`);bars.append(row);}
 }

 function reviewCard(r,index,own){
  const card=el('article','rv-card'+(own?' is-mine':''));card.style.setProperty('--i',index%5);
  const head=el('header','rv-card-head'),avatar=el('span','rv-avatar',initials(r.name));avatar.style.setProperty('--h',hue(r.name));avatar.setAttribute('aria-hidden','true');
  const who=el('div','rv-who');who.append(el('b','',r.name));
  const meta=el('span','rv-meta');meta.append(starRow(r.rating,'rv-stars rv-stars-sm'),el('time','',ago(r.date)));meta.querySelector('time').dateTime=r.date;who.append(meta);
  head.append(avatar,who);if(own)head.append(el('span','rv-you',r.hidden?'Your review · hidden':'Your review'));
  card.append(head,el('p','rv-text',r.text));
  if(own&&r.hidden)card.append(el('p','rv-hidden-note','The maker has hidden this review from the page. Only you can see it.'));
  return card;
 }

 function renderList(){
  list.replaceChildren();const mine=data.mine;
  if(mine)list.append(reviewCard(mine,0,true));
  const others=data.reviews.filter(r=>!(mine&&r.id===mine.id));
  others.slice(0,shown).forEach((r,i)=>list.append(reviewCard(r,i+1,false)));
  more.hidden=others.length<=shown;more.textContent=`Show more reviews (${others.length-shown} more)`;
  writeBtn.querySelector('.send-label').textContent=mine?'Edit your review':'Write a review';
  section.dataset.state='ready';
 }

 function render(){renderBadge();renderSummary();renderList();}

 async function request(body){
  const endpoint=window.AJOY_CONFIG?.sheetUrl;if(!endpoint)throw Error('unavailable');
  const session=getAccountSession();
  const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({type:'reviews',tool,...body,...(session?{accountToken:session.token}:{})}),signal:AbortSignal.timeout(30000)});
  const result=await response.json();if(!response.ok||!result.ok)throw Error(result.error||'unavailable');return result;
 }

 async function load(){
  try{const raw=sessionStorage.getItem(CACHE);if(raw&&!loadedOnce){const cached=JSON.parse(raw);if(Date.now()-cached.at<300000&&!getAccountSession()){data=cached.data;render();}}}catch{}
  try{data=await request({op:'list'});loadedOnce=true;try{if(!getAccountSession())sessionStorage.setItem(CACHE,JSON.stringify({at:Date.now(),data}));}catch{}render();
   if(pendingWrite&&getAccountSession()){pendingWrite=false;openForm();}}
  catch{if(!data){section.dataset.state='error';summary.querySelector('.rv-score').replaceChildren(el('b','rv-empty-title','Reviews are unavailable'),el('p','rv-empty-text','Please try again in a moment.'));}}
 }

 /* ---------- writing ---------- */
 const setRating=value=>{stars.forEach(s=>s.checked=Number(s.value)===value);ratingText.textContent=value?words[value]:'Choose a rating';form.dataset.rating=String(value||0);};
 const updateCount=()=>{const n=textInput.value.trim().length;counter.textContent=`${n} / 1500`;counter.dataset.low=String(n>0&&n<10);};
 function openForm(){
  const mine=data?.mine;form.hidden=false;section.dataset.writing='true';
  setRating(mine?.rating||0);textInput.value=mine?.text||'';
  let saved='';try{saved=localStorage.getItem(NAME)||'';}catch{}
  nameInput.value=mine?.name||saved||'';updateCount();
  removeBtn.hidden=!mine;submitLabel.textContent=mine?'Update review':'Post review';submit.dataset.state='idle';status.textContent='';delete status.dataset.error;
  form.classList.remove('is-open');void form.offsetWidth;form.classList.add('is-open');
  (stars.find(s=>s.checked)||stars[4]).focus({preventScroll:true});form.scrollIntoView({behavior:reduce.matches?'auto':'smooth',block:'center'});
 }
 function closeForm(){form.hidden=true;delete section.dataset.writing;writeBtn.focus({preventScroll:true});}

 writeBtn.addEventListener('click',()=>{
  if(!getAccountSession()){pendingWrite=true;openAccount({intent:'signin',purpose:'review'});return;}
  if(!data){pendingWrite=true;load();return;}
  openForm();
 });
 cancelBtn.addEventListener('click',closeForm);
 more.addEventListener('click',()=>{shown+=5;renderList();});
 stars.forEach(s=>s.addEventListener('change',()=>{setRating(Number(s.value));const label=s.closest('label');label.classList.remove('pop');void label.offsetWidth;label.classList.add('pop');}));
 form.querySelector('.rv-star-input').addEventListener('mouseover',e=>{const l=e.target.closest('label');if(l)form.dataset.hover=l.dataset.value;});
 form.querySelector('.rv-star-input').addEventListener('mouseleave',()=>delete form.dataset.hover);
 textInput.addEventListener('input',updateCount);

 const setSend=(state,text)=>{submit.dataset.state=state;if(text){submitLabel.textContent=text;submitLabel.classList.remove('is-new');void submitLabel.offsetWidth;submitLabel.classList.add('is-new');}};
 const errors={signin:'Please sign in again to post your review.',invalid:'Please choose a rating, write at least 10 characters and a name of 2–40 characters (no links).',limit:'You’ve made a lot of changes today. Please try again tomorrow.',busy:'The review service is busy. Please try again in a moment.'};

 async function send(op){
  if(busy)return;const rating=Number(form.dataset.rating||0);
  if(op==='save'){
   if(!rating){status.textContent='Choose a star rating first.';status.dataset.error='true';form.querySelector('.rv-star-input').classList.remove('shake');void form.offsetWidth;form.querySelector('.rv-star-input').classList.add('shake');return;}
   if(!form.reportValidity())return;
  }
  busy=true;form.setAttribute('aria-busy','true');status.textContent='';delete status.dataset.error;
  setSend('sending',op==='delete'?'Removing…':'Posting…');
  try{
   const body=op==='save'?{op,rating,text:textInput.value.trim(),name:nameInput.value.trim()}:{op};
   data=await request(body);try{sessionStorage.removeItem(CACHE);if(op==='save')localStorage.setItem(NAME,nameInput.value.trim());}catch{}
   setSend('sent',op==='delete'?'Removed':'Posted');
   setTimeout(()=>{closeForm();shown=5;render();const first=list.querySelector('.rv-card');if(first&&op==='save'){first.classList.add('is-fresh');}},reduce.matches?0:900);
  }catch(error){
   if(error.message==='signin'){pendingWrite=true;openAccount({intent:'signin',purpose:'review'});}
   setSend('error','Try again');status.textContent=errors[error.message]||'Your review could not be saved. Your text is still here—please try again.';status.dataset.error='true';
  }finally{busy=false;form.removeAttribute('aria-busy');}
 }
 form.addEventListener('submit',e=>{e.preventDefault();send('save');});
 removeBtn.addEventListener('click',()=>{if(confirmRemove())send('delete');});
 function confirmRemove(){if(removeBtn.dataset.confirm==='true'){delete removeBtn.dataset.confirm;removeBtn.textContent='Remove my review';return true;}
  removeBtn.dataset.confirm='true';removeBtn.textContent='Click again to remove';setTimeout(()=>{delete removeBtn.dataset.confirm;removeBtn.textContent='Remove my review';},3500);return false;}

 onAccountChange(()=>{if(loadedOnce)load();});

 /* Load after the page has settled so reviews never slow the first paint. */
 const start=()=>('requestIdleCallback'in window?requestIdleCallback(load,{timeout:2500}):setTimeout(load,300));
 if(document.readyState==='complete')start();else addEventListener('load',start,{once:true});
 section.dataset.state='loading';
}
