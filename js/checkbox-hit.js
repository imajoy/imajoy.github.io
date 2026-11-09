/* Desktop (mouse): a checkbox toggles only when its box (and a few pixels around it) is clicked, not the text beside it.
   Phones and tablets keep the whole row tappable. Links inside the text still work. */
(()=>{
const fine=matchMedia('(hover: hover) and (pointer: fine)');
document.addEventListener('click',e=>{
  if(!fine.matches||!e.isTrusted)return;
  const t=e.target;if(!(t instanceof Element))return;
  const label=t.closest('label');if(!label)return;
  const box=label.control&&label.control.type==='checkbox'?label.control:label.querySelector('input[type=checkbox]');
  if(!box||t===box||t.closest('a,button'))return;
  const r=box.getBoundingClientRect(),pad=8;
  if(e.clientX>=r.left-pad&&e.clientX<=r.right+pad&&e.clientY>=r.top-pad&&e.clientY<=r.bottom+pad)return;
  e.preventDefault();
},true);
})();
