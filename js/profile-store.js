/* Saved billing details and preferred payment method for the signed-in account.
   The server reads and writes only the verified session's own record. Country is never saved (the server detects it).
   A short sessionStorage copy makes the next page instant; the server copy is always the one that counts. */
import {getAccountSession,accountRequest} from './account-session.js?v=20261023-p7';
const KEY=email=>'ajoy.profile:'+email,TTL=600000;
const EMPTY={name:'',address:'',postal:'',city:'',region:'',companyOn:false,company:'',companyAddress:'',companyPostal:'',payment:'',photo:''};
export const emptyProfile=()=>({...EMPTY});
const norm=p=>p&&typeof p==='object'?{...EMPTY,...Object.fromEntries(Object.keys(EMPTY).filter(k=>k in p).map(k=>[k,k==='companyOn'?p[k]===true:typeof p[k]==='string'?p[k]:'']))}:null;
const remember=(email,profile)=>{try{profile===undefined?sessionStorage.removeItem(KEY(email)):sessionStorage.setItem(KEY(email),JSON.stringify({at:Date.now(),profile}));}catch{}};
/* undefined = not loaded yet, null = nothing saved, object = saved details */
export function cachedProfile(){
 const s=getAccountSession();if(!s)return undefined;
 try{const v=JSON.parse(sessionStorage.getItem(KEY(s.email))||'null');if(v&&Date.now()-v.at<TTL)return v.profile===null?null:norm(v.profile);}catch{}
 return undefined;
}
let inflight=null;
export async function loadProfile({fresh=false}={}){
 const s=getAccountSession();if(!s||s.limited)return undefined;
 if(!fresh){const c=cachedProfile();if(c!==undefined)return c;}
 if(inflight&&inflight.token===s.token)return inflight.promise;
 const promise=(async()=>{
  try{const r=await accountRequest({step:'profile-get',token:s.token});
   if(r&&r.ok){const p=norm(r.profile);remember(s.email,p);return p;}
  }catch{}
  return undefined;
 })().finally(()=>{inflight=null;});
 inflight={token:s.token,promise};return promise;
}
export async function saveProfile(patch){
 const s=getAccountSession();if(!s||s.limited)throw new Error('Sign in to save your details.');
 const r=await accountRequest({step:'profile-set',token:s.token,profile:patch});
 if(!r||!r.ok)throw new Error(r&&r.error==='expired'?'Your session expired. Sign in again.':'Your details could not be saved right now.');
 const p=norm(r.profile);remember(s.email,p);document.dispatchEvent(new CustomEvent('ajoy:profile-saved',{detail:p}));return p;
}
/* Removes billing details and the payment preference. A profile picture is kept: it is not a billing detail. */
export async function clearProfile(){
 const s=getAccountSession();if(!s)return;
 const cur=await loadProfile();
 if(cur&&cur.photo){
  const r=await accountRequest({step:'profile-set',token:s.token,profile:{...EMPTY,photo:cur.photo}});
  if(!r||!r.ok)throw new Error('Your saved details could not be removed right now.');
  const p=norm(r.profile);remember(s.email,p);document.dispatchEvent(new CustomEvent('ajoy:profile-saved',{detail:p}));return;
 }
 const r=await accountRequest({step:'profile-clear',token:s.token});
 if(!r||!r.ok)throw new Error('Your saved details could not be removed right now.');
 remember(s.email,null);document.dispatchEvent(new CustomEvent('ajoy:profile-saved',{detail:null}));
}
export const hasBilling=p=>!!p&&!!(p.name||p.address||p.postal);
