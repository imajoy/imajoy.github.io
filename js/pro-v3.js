/* Wrapline Pro v3: section index labels, tool-name band, per-category colour. Markup only; no scroll listeners. */
(function(){
 if(!document.body.classList.contains('pro-page'))return;
 var main=document.getElementById('top');if(!main)return;
 var secs=[['workflows','Workflows'],['trial','Free trial'],['tools','The tools'],['install','Install'],['pricing','Licensing'],['faq','Questions']];
 var n=0;
 secs.forEach(function(s){
  var el=document.getElementById(s[0]);if(!el||el.hidden||el.querySelector('.p3-lab'))return;
  n++;var w=el.querySelector('.wrap')||el;
  var l=document.createElement('div');l.className='p3-lab';l.setAttribute('aria-hidden','true');
  l.innerHTML='<b>'+(n<10?'0':'')+n+'</b><i></i><span>'+s[1]+'</span>';
  w.insertBefore(l,w.firstChild);
 });
 var wf=document.getElementById('workflows');
 if(wf&&!document.querySelector('.p3-band')){
  var words=['Rivet','FBX','Alembic','IK / FK','Playblast','Rebake','Hotkeys','Audio','Drag & Drop','Revert'],h='';
  for(var r=0;r<2;r++)words.forEach(function(w,i){h+='<span class="'+(i%2?'o':'f')+'">'+w+'</span><em></em>';});
  var b=document.createElement('div');b.className='p3-band';b.setAttribute('aria-hidden','true');
  b.innerHTML='<div class="p3-track">'+h+'</div>';
  wf.parentNode.insertBefore(b,wf);
 }
 var hue={'t-export':28,'t-anim':212,'t-rig':168,'t-scene':286};
 document.querySelectorAll('#tools .tile').forEach(function(t,i){
  for(var k in hue)if(t.classList.contains(k))t.style.setProperty('--th',hue[k]);
  t.setAttribute('data-n',(i+1<10?'0':'')+(i+1));
  t.querySelectorAll('.tl li').forEach(function(li,j){li.style.setProperty('--j',j);});
 });
 /* keyboard/click focus follow: the whole row opens the tool */
 document.querySelectorAll('#tools .tl li').forEach(function(li){
  var a=li.querySelector('.tl-link');if(!a)return;
  li.addEventListener('click',function(e){if(e.target.closest('a'))return;a.click();});
 });
})();
