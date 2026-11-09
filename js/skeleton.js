/* Removes the loading skeleton once the page has finished loading (it only appears if loading is slow). */
(()=>{const s=document.getElementById('pg-skel');if(!s)return;
const done=()=>{s.classList.add('done');setTimeout(()=>s.remove(),500);};
if(document.readyState==='complete')done();else{addEventListener('load',done,{once:true});setTimeout(done,9000);}})();
