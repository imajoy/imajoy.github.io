/* Account information tab: profile picture, name, email, billing-address summary and account deletion.
   The name is the same one used on invoices; the picture is a small square JPEG saved with the account. */
import {getAccountSession,clearAccountSession,accountRequest,onAccountChange} from './account-session.js?v=20261023-p7';
import {loadProfile,saveProfile,hasBilling} from './profile-store.js?v=pm2';
const $=s=>document.querySelector(s);
const av=$('#ai-av');if(!av)throw new Error('no account panel');
let profile=null;
const say=(el,text,kind)=>{el.textContent=text||'';if(kind)el.dataset.kind=kind;else delete el.dataset.kind;};
const initial=()=>((profile?.name||getAccountSession()?.email||'?').trim()[0]||'?').toUpperCase();
export function paintAvatar(node,p,letter){
 if(p&&p.photo){node.style.backgroundImage='url("'+p.photo+'")';node.dataset.photo='';node.textContent='';}
 else{node.style.backgroundImage='';delete node.dataset.photo;node.textContent=letter;}
}
function paint(){
 const s=getAccountSession();if(!s)return;
 paintAvatar(av,profile,initial());
 $('#ai-remove').hidden=!(profile&&profile.photo);
 $('#ai-name').textContent=profile?.name||'Not set';$('#ai-name').dataset.empty=String(!profile?.name);
 $('#ai-email').textContent=s.email;
 const addr=profile&&hasBilling(profile)?[profile.address,[profile.city,profile.postal].filter(Boolean).join(' '),profile.region].filter(Boolean).join(', '):'';
 $('#ai-addr').textContent=addr||'Not saved yet';$('#ai-addr').dataset.empty=String(!addr);
}
function refresh(){loadProfile().then(p=>{if(p!==undefined){profile=p;paint();}});}
refresh();paint();
onAccountChange(()=>{profile=null;paint();refresh();});
document.addEventListener('ajoy:profile-saved',e=>{profile=e.detail;paint();});

/* name */
const row=$('#ai-name-row'),form=$('#ai-name-form'),input=$('#ai-name-input'),nmsg=$('#ai-name-msg');
function editName(on){row.hidden=on;form.hidden=!on;if(on){input.value=profile?.name||'';input.focus();input.select();}else $('#ai-name-edit').focus({preventScroll:true});}
$('#ai-name-edit').addEventListener('click',()=>{say(nmsg,'');editName(true);});
form.querySelector('[data-cancel]').addEventListener('click',()=>editName(false));
form.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();editName(false);}});
form.addEventListener('submit',async e=>{
 e.preventDefault();const b=form.querySelector('[type=submit]'),v=input.value.trim();
 if(!v){say(nmsg,'Please enter your name.','error');return;}
 b.disabled=true;say(nmsg,'Saving…');
 try{profile=await saveProfile({name:v});paint();editName(false);say(nmsg,'Saved. This name will appear on your invoices.','ok');}
 catch(err){say(nmsg,err.message||'Could not save. Please try again.','error');}
 finally{b.disabled=false;}
});

/* picture: centre-crop to a square, shrink to 192px and keep the JPEG under the server limit */
const pmsg=$('#ai-photo-msg'),file=$('#ai-file');
async function shrink(f){
 const bmp=await createImageBitmap(f);
 const side=Math.min(bmp.width,bmp.height),c=document.createElement('canvas');c.width=c.height=192;
 const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,192,192);g.imageSmoothingQuality='high';
 g.drawImage(bmp,(bmp.width-side)/2,(bmp.height-side)/2,side,side,0,0,192,192);bmp.close?.();
 for(const q of [.86,.78,.7,.6,.5]){const u=c.toDataURL('image/jpeg',q);if(u.length<=30000)return u;}
 throw new Error('That picture is too detailed. Try a simpler one.');
}
file.addEventListener('change',async()=>{
 const f=file.files&&file.files[0];file.value='';if(!f)return;
 if(!/^image\/(png|jpe?g|webp)$/.test(f.type)){say(pmsg,'Please choose a PNG, JPG or WebP picture.','error');return;}
 if(f.size>12*1024*1024){say(pmsg,'That file is too large. Choose one under 12 MB.','error');return;}
 say(pmsg,'Saving…');av.dataset.busy='';
 try{
  const photo=await shrink(f),saved=await saveProfile({photo});
  if(!saved.photo)throw new Error('Pictures are not enabled on the server yet. Please try again soon.');
  profile=saved;paint();say(pmsg,'Picture updated.','ok');
 }catch(err){say(pmsg,err.message||'Could not use that picture.','error');}
 finally{delete av.dataset.busy;}
});
$('#ai-remove').addEventListener('click',async()=>{
 say(pmsg,'Removing…');
 try{profile=await saveProfile({photo:''});paint();say(pmsg,'Picture removed.','ok');}catch{say(pmsg,'Could not remove. Please try again.','error');}
});

/* delete: opens the same emailed-code flow the sign-in window already has */
$('#ai-delete').addEventListener('click',()=>window.dispatchEvent(new CustomEvent('ajoy-account-erase')));

/* sign out / switch account: end this session on the server, then (for switch) open the sign-in window for another email */
function leave(){const t=getAccountSession()?.token;if(t)accountRequest({step:'logout',token:t},8000).catch(()=>{});clearAccountSession();}
$('#ai-out').addEventListener('click',leave);
$('#ai-switch').addEventListener('click',()=>{leave();setTimeout(()=>window.dispatchEvent(new CustomEvent('ajoy-account-open',{detail:{}})),60);});
