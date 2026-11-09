/* Full-screen logo + ring loader: used while a page finishes loading after payment, and before leaving checkout. */
(()=>{
const html='<div class="ring-wrap"><svg class="ring" viewBox="0 0 100 100" aria-hidden="true"><circle class="ring-track" cx="50" cy="50" r="48"/><circle class="ring-arc" cx="50" cy="50" r="48"/></svg><img src="assets/logo-mark.svg" alt="" width="40" height="40"></div>';
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
