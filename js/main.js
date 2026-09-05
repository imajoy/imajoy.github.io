const root=document.documentElement;
const reduceMotion=window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* theme */
const themeBtn=document.getElementById("theme");
const saved=localStorage.getItem("ajoy-theme");
if(saved==="light") root.classList.add("light");
themeBtn.addEventListener("click",()=>{
  root.classList.toggle("light");
  localStorage.setItem("ajoy-theme",root.classList.contains("light")?"light":"dark");
});

/* mobile nav */
const menuBtn=document.getElementById("menuBtn");
const mobileNav=document.getElementById("mobileNav");
menuBtn.addEventListener("click",()=>{
  const open=mobileNav.classList.toggle("open");
  menuBtn.setAttribute("aria-expanded",open);
});
mobileNav.querySelectorAll("a").forEach(a=>a.addEventListener("click",()=>{
  mobileNav.classList.remove("open");
  menuBtn.setAttribute("aria-expanded","false");
}));

/* year */
document.getElementById("year").textContent=new Date().getFullYear();

/* hero entrance — single orchestrated moment */
requestAnimationFrame(()=>document.body.classList.add("ready"));

/* scroll progress */
const bar=document.getElementById("progress");
let ticking=false;
window.addEventListener("scroll",()=>{
  if(ticking)return;
  ticking=true;
  requestAnimationFrame(()=>{
    const h=document.documentElement;
    const pct=(h.scrollTop)/((h.scrollHeight-h.clientHeight)||1)*100;
    bar.style.width=pct+"%";
    ticking=false;
  });
});

/* tool graph line draws in once */
const toolList=document.getElementById("toolList");
if(toolList){
  const io=new IntersectionObserver((entries)=>{
    entries.forEach(e=>{
      if(e.isIntersecting){toolList.classList.add("show");io.disconnect();}
    });
  },{threshold:.2});
  io.observe(toolList);
}

/* frame counter — cosmetic HUD readout */
if(!reduceMotion){
  let frame=182;
  const el=document.getElementById("frameCount");
  setInterval(()=>{
    frame=(frame+1)%2400;
    if(el) el.textContent=String(frame).padStart(4,"0");
  },1400);
}

/* card cursor-spotlight */
if(!reduceMotion){
  document.querySelectorAll(".tool-card").forEach(card=>{
    card.addEventListener("mousemove",(e)=>{
      const r=card.getBoundingClientRect();
      card.style.setProperty("--mx",(e.clientX-r.left)+"px");
      card.style.setProperty("--my",(e.clientY-r.top)+"px");
    });
  });

  /* magnetic buttons */
  document.querySelectorAll(".magnetic").forEach(btn=>{
    btn.addEventListener("mousemove",(e)=>{
      const r=btn.getBoundingClientRect();
      const x=(e.clientX-r.left-r.width/2)*.25;
      const y=(e.clientY-r.top-r.height/2)*.4;
      btn.style.transform=`translate(${x}px,${y}px)`;
    });
    btn.addEventListener("mouseleave",()=>{btn.style.transform="";});
  });
}

/* pause inline preview clips when off-screen, save bandwidth/battery */
const previewVideos=document.querySelectorAll(".tool-visual video");
if(previewVideos.length){
  const vio=new IntersectionObserver((entries)=>{
    entries.forEach(e=>{
      const v=e.target;
      if(e.isIntersecting) v.play().catch(()=>{});
      else v.pause();
    });
  },{threshold:.25});
  previewVideos.forEach(v=>vio.observe(v));
}

/* video guide modal — reusable for any future [data-video-trigger] */
const videoModal=document.getElementById("videoModal");
const modalPlayer=document.getElementById("videoModalPlayer");
const modalCaption=document.getElementById("videoModalCaption");
function openVideoModal(src,poster,caption){
  modalPlayer.src=src;
  if(poster) modalPlayer.poster=poster;
  modalCaption.innerHTML=caption?`<b>▸</b> ${caption}`:"";
  videoModal.classList.add("open");
  videoModal.setAttribute("aria-hidden","false");
  document.body.style.overflow="hidden";
  modalPlayer.currentTime=0;
  modalPlayer.play().catch(()=>{});
}
function closeVideoModal(){
  videoModal.classList.remove("open");
  videoModal.setAttribute("aria-hidden","true");
  document.body.style.overflow="";
  modalPlayer.pause();
  modalPlayer.removeAttribute("src");
  modalPlayer.load();
}
document.querySelectorAll("[data-video-trigger]").forEach(btn=>{
  btn.addEventListener("click",()=>openVideoModal(btn.dataset.video,btn.dataset.poster,btn.dataset.caption));
});
videoModal.querySelectorAll("[data-close]").forEach(el=>el.addEventListener("click",closeVideoModal));
document.getElementById("videoModalClose").addEventListener("click",closeVideoModal);
document.addEventListener("keydown",(e)=>{
  if(e.key==="Escape" && videoModal.classList.contains("open")) closeVideoModal();
});

/* tool filter — switch between All / Maya / Blender without scrolling */
const filterBtns=document.querySelectorAll(".filter-btn");
const toolGroups=document.querySelectorAll(".tool-group[data-platform]");
filterBtns.forEach(btn=>{
  btn.addEventListener("click",()=>{
    filterBtns.forEach(b=>{b.classList.remove("active");b.setAttribute("aria-selected","false");});
    btn.classList.add("active");
    btn.setAttribute("aria-selected","true");
    const choice=btn.dataset.filter;
    toolGroups.forEach(group=>{
      const show=choice==="all" || group.dataset.platform===choice;
      group.classList.toggle("is-hidden",!show);
    });
  });
});
