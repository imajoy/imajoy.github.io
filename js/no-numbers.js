/* Site-wide: no decorative index numbers (01, 02, 03 ...). Removes numeric label elements and "01 / " prefixes.
   Real content such as "4 days", "10 tools" and prices is untouched. Runs once early and again when the page adds content. */
(()=>{
  const SKIP='SCRIPT,STYLE,SVG,INPUT,TEXTAREA,CODE,PRE,SELECT,OPTION,[data-keep-number]';
  const lone=/^0?[1-9]$/,pref=/^\s*0[1-9]\s*\/\s*/,policy=/^0[1-9] \/ [A-Z ]+$/;
  function clean(root){
    const out=[];
    const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode:n=>n.parentElement&&!n.parentElement.closest(SKIP)?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT});
    let n;while((n=w.nextNode())){
      const t=n.nodeValue.trim(),p=n.parentElement;if(!t)continue;
      if(/^0[1-9]$/.test(t)&&p.childElementCount===0&&p.parentElement&&p.parentElement.textContent.trim()!==t)out.push(p);
      else if(policy.test(t)&&p.childElementCount===0)out.push(p);
      else if(pref.test(n.nodeValue)&&n.nodeValue.replace(pref,'').trim())n.nodeValue=n.nodeValue.replace(pref,'');
    }
    out.forEach(e=>e.remove());
  }
  let q=0;const run=()=>{q=0;clean(document.body)};
  const kick=()=>{if(!q)q=requestAnimationFrame(run)};
  run();
  new MutationObserver(kick).observe(document.body,{childList:true,subtree:true});
})();
