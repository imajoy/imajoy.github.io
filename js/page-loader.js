/* Full-screen Wrapline logo loader (the same one every page uses): used while a page finishes loading after payment, and before leaving checkout. */
(()=>{
const html='<div class="pl"><svg class="pl-mark" viewBox="0 0 32 32" width="72" height="72"><rect class="pl-tile" width="32" height="32" rx="8" fill="#3D8BFF"/><path class="pl-line" d="M7.5 23.5C15 23.5 17 8.5 24.5 8.5" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/><path class="pl-d1" d="M7.5 20.3l3.2 3.2-3.2 3.2-3.2-3.2z" fill="#fff"/><path class="pl-d2" d="M24.5 5.3l3.2 3.2-3.2 3.2-3.2-3.2z" fill="#fff"/></svg><span class="pl-word">Wrapline</span><span class="pl-bar"><i></i></span></div>';
function make(){const d=document.createElement('div');d.className='pg-ring';d.setAttribute('role','status');d.setAttribute('aria-label','Loading');d.innerHTML=html;return d;}
let el=document.getElementById('pg-ring');
function hide(){if(!el)return;const e=el;el=null;e.classList.add('done');setTimeout(()=>e.remove(),500);}
window.WraplineLoader={
 show(){if(el)return;el=make();document.body.appendChild(el);requestAnimationFrame(()=>el&&el.classList.add('on'));},
 hide
};
if(el){const start=performance.now(),wait=()=>setTimeout(hide,Math.max(0,700-(performance.now()-start)));
 if(document.readyState==='complete')wait();else addEventListener('load',wait,{once:true});setTimeout(hide,8000);}
})();
