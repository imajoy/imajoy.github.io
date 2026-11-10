/* Landing v7: giant tool-name band under the hero. Markup only. */
(function(){var h=document.querySelector('.home .h-hero');if(!h||document.querySelector('.hb-band'))return;
 var w=['IK / FK','Playblast','Rivet','FBX','Alembic','Snap','Rebake','Hotkeys','Audio','Revert'],s='';
 for(var r=0;r<2;r++)w.forEach(function(x,i){s+='<span class="'+(i%2?'o':'f')+'">'+x+'</span><em></em>';});
 var b=document.createElement('div');b.className='hb-band';b.setAttribute('aria-hidden','true');b.innerHTML='<div class="hb-track">'+s+'</div>';
 h.parentNode.insertBefore(b,h.nextSibling);})();
