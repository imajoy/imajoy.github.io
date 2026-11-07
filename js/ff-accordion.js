/* Phones and tablets: the 9 FFmpeg steps are grouped into 3 short parts you open one at a time. Laptops keep the full list. */
(function(){
 var list=document.querySelector('.ff-install-steps');if(!list)return;
 var lis=[].slice.call(list.children).filter(function(n){return n.tagName==='LI';});if(lis.length!==9)return;
 var mq=matchMedia('(max-width:1000px)');
 var defs=[{from:0,to:2,t:'Get FFmpeg',s:'Steps 1 to 3 · download and place the files'},{from:3,to:5,t:'Open the Windows setting',s:'Steps 4 to 6 · find your user Path'},{from:6,to:8,t:'Add it and check',s:'Steps 7 to 9 · add the folder and test'}];
 var open=0,heads=[];
 defs.forEach(function(d,g){
  var li=document.createElement('li');li.className='ff-group';
  var b=document.createElement('button');b.type='button';b.className='ff-group-btn';b.setAttribute('aria-expanded','false');
  b.innerHTML='<span class="ffg-n">'+(g+1)+'</span><span class="ffg-t"><b>'+d.t+'</b><small>'+d.s+'</small></span><svg class="ffg-c" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';
  li.appendChild(b);list.insertBefore(li,lis[d.from]);heads.push(li);
  b.addEventListener('click',function(){var was=open===g;open=was?-1:g;apply();if(!was){var first=lis[d.from].querySelector('[data-ff-install-step]');if(first&&!first.disabled)first.click();}});
 });
 function groupOf(i){return i<3?0:i<6?1:2;}
 function apply(){
  var on=mq.matches;list.classList.toggle('ff-acc',on);
  heads.forEach(function(h,g){h.firstChild.setAttribute('aria-expanded',on&&open===g?'true':'false');h.classList.toggle('is-open',on&&open===g);});
  lis.forEach(function(li,i){li.hidden=on&&groupOf(i)!==open;});
 }
 function current(){for(var i=0;i<lis.length;i++)if(lis[i].hasAttribute('data-current'))return i;return -1;}
 var mo=new MutationObserver(function(){var c=current();if(c>-1&&mq.matches&&groupOf(c)!==open&&!list.dataset.userOpen){open=groupOf(c);apply();}});
 lis.forEach(function(li){mo.observe(li,{attributes:true,attributeFilter:['data-current']});});
 heads.forEach(function(h){h.addEventListener('click',function(){list.dataset.userOpen='1';});});
 var c0=current();if(c0>-1)open=groupOf(c0);
 (mq.addEventListener?mq.addEventListener('change',apply):mq.addListener(apply));apply();
})();
