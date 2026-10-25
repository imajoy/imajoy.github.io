/* User-confirmed setup progress, never proof of activation or subscription access. */
import {getAccountSession} from './account-session.js?v=20261023-p7';
export function mountSetupProgress(basic){
 const session=getAccountSession();
 if(!session)return;
 const rows=['ty-step-key','ty-step-install','ty-step-start'].map(id=>document.getElementById(id));
 const labels=basic?['I downloaded the setup file','I installed Wrapline in Maya','I signed in to Wrapline in Maya']:['I received my license key','I installed Wrapline in Maya','I activated Wrapline in Maya'];
 const key='ajoy.setup.'+encodeURIComponent(session.email)+'.'+(basic?'basic':'premium');
 let completed=0,storageOK=true;
 try{const saved=JSON.parse(localStorage.getItem(key)||'null');if(saved?.version===1&&Number.isInteger(saved.completed)&&saved.completed>=0&&saved.completed<=3)completed=saved.completed;}catch{storageOK=false;}
 let note=document.getElementById('ty-setup-note');
 if(!note){note=document.createElement('p');note.id='ty-setup-note';note.className='ty-setup-note';document.querySelector('.ty-timeline').after(note);}
 const inputs=rows.map((row,index)=>{
  row.querySelector('.ty-step-confirm')?.remove();
  const label=document.createElement('label'),input=document.createElement('input'),text=document.createElement('span');
  label.className='ty-step-confirm';input.type='checkbox';input.id='ty-setup-'+index;label.htmlFor=input.id;text.textContent=labels[index];
  label.append(input,text);row.querySelector('div').append(label);
  input.addEventListener('change',()=>{
   completed=input.checked?index+1:index;
   try{localStorage.setItem(key,JSON.stringify({version:1,completed}));storageOK=true;}catch{storageOK=false;}
   sync();
  });
  return input;
 });
 function sync(){
  rows.forEach((row,index)=>{inputs[index].checked=index<completed;row.dataset.step=index<completed?'done':index===completed?'current':'';});
  document.querySelector('.ty-next-title').textContent=completed===3?'Setup complete':'Your setup checklist';
  note.textContent='Mark the steps you’ve completed. '+(storageOK?'Saved in this browser; installation isn’t detected automatically.':'Progress cannot be saved in this browser.');
 }
 sync();
}
