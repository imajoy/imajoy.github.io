/* Loading, in two short steps. 1) the Wrapline logo while the page's files arrive. 2) a grey outline of the page while its content settles. Then the real page. */
(()=>{const s=document.getElementById('pg-skel');if(!s)return;
document.documentElement.classList.add('pg-wait');
const LOGO_MIN=450,PH_MIN=350,t0=performance.now(),hold=s.hasAttribute('data-hold');
/* the grey outline, drawn per kind of page and kept under the logo until the logo lifts */
const B=(w,h,r,x)=>'<span class="sk-bar'+(x?' '+x:'')+'" style="--w:'+w+';--h:'+h+(r?';--r:'+r:'')+'"></span>';
const C=(h,w,r,inner,p)=>'<div class="sk-card" style="--h:'+h+(w?';--w:'+w:'')+(r?';--r:'+r:'')+(p?';--p:'+p:'')+'">'+(inner||'')+'</div>';
const R=(x,st)=>'<div class="sk-row"'+(st?' style="'+st+'"':'')+'>'+x+'</div>';
const nav='<div class="sk-nav">'+B('36px','36px','50%')+B('118px','16px')+'<span class="sk-links">'+B('44px','12px').repeat(4)+'</span>'+B('108px','38px','999px','sk-push')+'</div>';
const W=x=>'<div class="sk-wrap">'+x+'</div>';
const LAYOUT={
 hero:()=>nav+W('<div class="sk-col sk-hero">'+B('150px','14px')+B('min(640px,80%)','56px','16px')+B('min(480px,62%)','56px','16px')+B('min(520px,70%)','16px')+B('min(400px,56%)','16px')+R(B('172px','54px','999px')+B('150px','54px','999px'),'margin-top:10px')+'</div><div class="sk-cards3">'+C('240px').repeat(3)+'</div>'),
 tool:()=>nav+W('<div class="sk-tool"><div class="sk-two"><div class="sk-col">'+B('120px','14px')+B('min(420px,90%)','48px','14px')+B('90%','16px')+B('78%','16px')+B('60%','16px')+R(B('160px','50px','999px')+B('130px','50px','999px'),'margin-top:8px')+'</div>'+C('min(380px,42vh)','100%','24px')+'</div></div>'),
 contact:()=>nav+W('<div style="margin:120px auto 0;width:min(1020px,100% - 28px)">'+C('min(520px,calc(100vh - 150px))','100%','28px','<div class="sk-row" style="gap:36px;height:100%;align-items:stretch">'+B('34%','100%','20px','sk-hide-m')+'<span class="sk-col" style="flex:1">'+B('180px','14px')+B('120px','30px')+B('100%','48px','14px')+B('100%','48px','14px')+B('100%','48px','14px')+B('100%','120px','14px')+B('140px','46px','999px')+'</span></div>','26px')+'</div>'),
 pay:()=>'<div class="sk-top">'+R(B('36px','36px','50%')+B('110px','16px'))+R(B('90px','14px')+B('90px','14px')+B('90px','14px'))+'</div>'+W('<div class="sk-commerce"><div class="sk-grid"><div class="sk-col">'+B('220px','34px','12px')+B('min(360px,80%)','14px')+C('92px')+C('92px')+C('92px')+'</div><div class="sk-col">'+C('380px','100%','24px')+'</div></div></div>'),
 center:()=>nav+W('<div class="sk-col sk-center">'+B('72px','72px','50%')+B('min(420px,80%)','40px','12px')+B('min(480px,86%)','16px')+B('min(380px,70%)','16px')+C('180px','min(560px,92%)','24px')+B('180px','52px','999px')+'</div>'),
 support:()=>nav+W('<div class="sk-support"><div class="sk-col">'+B('260px','44px','12px')+B('min(420px,80%)','16px')+'</div><div class="sk-cards3" style="width:100%;margin-top:28px">'+C('180px').repeat(3)+'</div>'+C('220px','100%','24px').replace('class="sk-card"','class="sk-card" data-m="1"')+'</div>'),
 policy:()=>nav+W('<div class="sk-col" style="width:min(780px,100% - 40px);margin:130px auto 0;gap:14px">'+B('280px','44px','12px')+B('160px','14px')+['100%','96%','92%','100%','88%','70%','100%','94%','80%','64%'].map(w=>B(w,'14px')).join('')+'</div>'),
 notfound:()=>nav+W('<div class="sk-col sk-center">'+B('min(300px,70%)','110px','20px')+B('min(420px,80%)','18px')+B('170px','52px','999px')+'</div>'),
 account:()=>nav+W('<div class="sk-support"><div class="sk-row" style="gap:16px">'+B('56px','56px','18px')+'<div class="sk-col">'+B('240px','22px')+B('160px','12px')+'</div></div><div class="sk-col" style="margin-top:26px;gap:20px">'+C('230px','100%','24px','<div class="sk-col">'+B('180px','18px')+B('100%','44px','12px')+B('100%','44px','12px')+B('100%','44px','12px')+'</div>')+C('260px','100%','24px','<div class="sk-col">'+B('150px','18px')+B('100%','44px','12px')+B('100%','44px','12px')+B('100%','44px','12px')+'</div>')+'</div></div>')
};
const ph=document.createElement('div');ph.className='pg-skel pg-ph';ph.id='pg-ph';ph.setAttribute('aria-hidden','true');ph.dataset.t=s.dataset.t||'hero';ph.innerHTML=(LAYOUT[s.dataset.t]||LAYOUT.hero)();s.after(ph);
/* the real outline of this page (drawn from the page itself by scripts/build-outlines.mjs); the kind-of-page outline above shows until it arrives */
let logoGone=false,over=false,tLogo=0;
const PHV='ph1',nm=s.dataset.p;
if(nm){window.__phLoad=(n,h)=>{if(n===nm&&!over)ph.innerHTML=h;};const sc=document.createElement('script');sc.src='js/ph/'+nm+'.js?v='+PHV;sc.async=true;document.head.append(sc);}
/* step 1 ends: the logo fades out and the grey outline is what shows */
const lift=()=>{if(logoGone)return;logoGone=true;tLogo=performance.now();s.classList.add('done');setTimeout(()=>s.remove(),600);};
/* step 2 ends: the real page appears (the outline always shows for a moment so the change never flashes) */
const reveal=()=>{if(over)return;over=true;ph.classList.add('done');document.documentElement.classList.remove('pg-wait');document.documentElement.classList.add('pg-ready');document.dispatchEvent(new Event('ajoy:page-shown'));setTimeout(()=>ph.remove(),600);};
const finish=()=>{if(over)return;lift();setTimeout(()=>requestAnimationFrame(reveal),Math.max(0,PH_MIN-(performance.now()-tLogo)));};
const fonts=()=>document.fonts?.ready||Promise.resolve();
/* the logo lifts as soon as the files and fonts are in (never sooner than a short minimum so the mark is seen) */
const filesIn=()=>fonts().then(()=>setTimeout(lift,Math.max(0,LOGO_MIN-(performance.now()-t0))));
if(document.readyState==='complete')filesIn();else addEventListener('load',filesIn,{once:true});
/* wait until the page stops changing (nothing added or rewritten for a moment), so it is never shown half built */
const settle=(quiet,cap)=>{let t;const mo=new MutationObserver(l=>{if(!l.some(m=>!(m.target.closest&&m.target.closest('.xp-fill,.xp-cur,.xp-canvas'))))return;clearTimeout(t);t=setTimeout(fin,quiet);});const fin=()=>{mo.disconnect();clearTimeout(t);clearTimeout(c);finish();};const c=setTimeout(fin,cap);mo.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true});t=setTimeout(fin,quiet);};
if(hold){
 /* a page marked data-hold keeps its outline until it says its own data is in (ajoy:page-ready) */
 const ready=()=>fonts().then(()=>settle(320,2500));
 if(document.documentElement.dataset.pageReady)ready();else document.addEventListener('ajoy:page-ready',ready,{once:true});
 setTimeout(finish,10000);return;}
/* every other page: ready once its files, fonts and every server request it started have answered */
let open=0;const native=window.fetch;
if(native){window.fetch=function(...a){if(over)return native.apply(this,a);open++;const p=native.apply(this,a);const end=()=>{open=Math.max(0,open-1);};p.then(end,end);return p;};}
const go=()=>fonts().then(()=>{const t=performance.now();const poll=()=>{if(open>0&&performance.now()-t<3500){setTimeout(poll,80);return;}finish();};setTimeout(poll,120);});
if(document.readyState==='complete')go();else addEventListener('load',go,{once:true});setTimeout(finish,9000);})();
