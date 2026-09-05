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

/* subscribe — replace FORMSPREE_ENDPOINT below with your real Formspree form URL */
const FORMSPREE_ENDPOINT = "https://formspree.io/f/YOUR_FORM_ID";
const subscribeForm = document.getElementById("subscribeForm");
if (subscribeForm) {
  const subscribeBtn = document.getElementById("subscribeBtn");
  const subscribeEmail = document.getElementById("subscribeEmail");
  const subscribeNote = document.getElementById("subscribeNote");
  const subscribeError = document.getElementById("subscribeError");
  const subscribeSuccess = document.getElementById("subscribeSuccess");
  const subscribedEmailEl = document.getElementById("subscribedEmail");
  const STORAGE_KEY = "ajoy-subscribed-email";

  function burstParticles(originEl) {
    if (reduceMotion) return;
    const r = originEl.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const colors = ["var(--axis-x)", "var(--axis-y)", "var(--axis-z)", "var(--accent)"];
    for (let i = 0; i < 14; i++) {
      const p = document.createElement("span");
      p.className = "subscribe-particle";
      const angle = (Math.PI * 2 * i) / 14 + Math.random() * 0.4;
      const dist = 60 + Math.random() * 50;
      p.style.left = cx + "px";
      p.style.top = cy + "px";
      p.style.background = colors[i % colors.length];
      p.style.setProperty("--px", Math.cos(angle) * dist + "px");
      p.style.setProperty("--py", Math.sin(angle) * dist + "px");
      document.body.appendChild(p);
      p.addEventListener("animationend", () => p.remove());
    }
  }

  function showSubscribedState(email) {
    subscribeForm.hidden = true;
    subscribeNote.hidden = true;
    subscribeError.hidden = true;
    subscribedEmailEl.textContent = email ? `(${email})` : "";
    subscribeSuccess.hidden = false;
  }

  // returning visitor who already subscribed on this browser
  const savedEmail = localStorage.getItem(STORAGE_KEY);
  if (savedEmail) showSubscribedState(savedEmail);

  subscribeForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = subscribeEmail.value.trim();
    if (!email) return;

    subscribeError.hidden = true;
    subscribeBtn.classList.add("is-loading");
    subscribeBtn.disabled = true;

    try {
      const res = await fetch(FORMSPREE_ENDPOINT, {
        method: "POST",
        headers: { Accept: "application/json" },
        body: new FormData(subscribeForm),
      });
      if (!res.ok) throw new Error("request failed");

      subscribeBtn.classList.remove("is-loading");
      subscribeBtn.classList.add("is-done");
      burstParticles(subscribeBtn);
      localStorage.setItem(STORAGE_KEY, email);
      setTimeout(() => showSubscribedState(email), 550);
    } catch (err) {
      subscribeBtn.classList.remove("is-loading");
      subscribeBtn.disabled = false;
      subscribeError.hidden = false;
    }
  });
}
