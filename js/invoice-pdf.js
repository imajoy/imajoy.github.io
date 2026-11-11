/* Saves invoices as real PDF files (no print dialog). The text is read from the same invoice paper the customer sees,
   so the PDF always matches the screen. pdf-lib is loaded only when a download is clicked. */
let lib;
function load(){
  if(window.PDFLib)return Promise.resolve(window.PDFLib);
  return lib||(lib=new Promise((res,rej)=>{const s=document.createElement('script');s.src='js/vendor/pdf-lib.min.js?v=1';s.onload=()=>res(window.PDFLib);s.onerror=()=>{lib=null;rej(new Error('pdf'));};document.head.append(s);}));
}
const T=n=>(n?.textContent||'').replace(/\s+/g,' ').trim();
/* the standard PDF fonts cannot draw the rupee sign, so it is drawn by hand; anything else outside Latin-1 becomes a plain look-alike */
const plain=s=>String(s).replace(/[\u2018\u2019]/g,"'").replace(/[\u201c\u201d]/g,'"').replace(/\u00a0/g,' ').replace(/[\u2013\u2014]/g,'-').replace(/[^\x20-\x7e\u00a0-\u00ff\u20ac\u2022\u20b9]/g,'?');
export async function invoicesToPdf(docs){
  const {PDFDocument,StandardFonts,rgb,LineCapStyle}=await load();
  const pdf=await PDFDocument.create(),reg=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink=rgb(.08,.09,.16),mute=rgb(.4,.43,.5),line=rgb(.86,.88,.92),blue=rgb(.24,.55,1);
  const W=595.28,H=841.89,M=48;
  const width=(t,f,s)=>{let w=0;for(const part of plain(t).split('\u20b9')){w+=f.widthOfTextAtSize(part.replace(/\u20b9/g,''),s);}return w+(plain(t).split('\u20b9').length-1)*s*.62;};
  for(const doc of docs){
    const paper=doc.querySelector('.iv-paper');if(!paper)continue;
    const page=pdf.addPage([W,H]);let y=H-M;
    const text=(t,x,yy,{f=reg,s=10,c=ink,right=false}={})=>{
      const str=plain(t),w=width(str,f,s);let cx=right?x-w:x;
      const parts=str.split('\u20b9');
      parts.forEach((p,i)=>{
        if(p){page.drawText(p,{x:cx,y:yy,size:s,font:f,color:c});cx+=f.widthOfTextAtSize(p,s);}
        if(i<parts.length-1){ /* hand-drawn rupee sign */
          const g=s*.62,h=s*.7,x0=cx+g*.06,top=yy+h,w=Math.max(.7,s*.075);
          const bar=yy2=>page.drawLine({start:{x:x0,y:yy2},end:{x:x0+g*.86,y:yy2},thickness:w,color:c});
          bar(top);bar(top-h*.21);
          /* bowl: leaves the top bar, curves round and returns on the left; then the diagonal leg */
          page.drawSvgPath('M0 0 H'+(g*.3)+' C'+(g*.9)+' 0 '+(g*.9)+' '+(h*.5)+' '+(g*.3)+' '+(h*.5)+' H0',{x:x0,y:top,borderColor:c,borderWidth:w,borderLineCap:LineCapStyle.Butt});
          page.drawLine({start:{x:x0+g*.08,y:top-h*.5},end:{x:x0+g*.7,y:yy},thickness:w,color:c});
          cx+=g;
        }
      });
    };
    const wrap=(t,f,s,max)=>{const out=[];let cur='';for(const w of plain(t).split(' ')){const n=cur?cur+' '+w:w;if(width(n,f,s)>max&&cur){out.push(cur);cur=w;}else cur=n;}if(cur)out.push(cur);return out;};
    const rule=yy=>page.drawLine({start:{x:M,y:yy},end:{x:W-M,y:yy},thickness:.7,color:line});
    /* header: brand + seller (left), title and key facts (right) */
    /* the real Wrapline mark (assets/logo-mark.svg), scaled from its 32-unit box to 24pt */
    const mk={x:M,y:y+4,scale:.75};
    page.drawSvgPath('M8 0H24Q32 0 32 8V24Q32 32 24 32H8Q0 32 0 24V8Q0 0 8 0Z',{...mk,color:blue,borderWidth:0});
    page.drawSvgPath('M7.5 23.5C15 23.5 17 8.5 24.5 8.5',{...mk,borderColor:rgb(1,1,1),borderWidth:1.7,borderLineCap:LineCapStyle.Round});
    page.drawSvgPath('M7.5 20.3l3.2 3.2-3.2 3.2-3.2-3.2z',{...mk,color:rgb(1,1,1),borderWidth:0});
    page.drawSvgPath('M24.5 5.3l3.2 3.2-3.2 3.2-3.2-3.2z',{...mk,color:rgb(1,1,1),borderWidth:0});
    text('WRAPLINE',M+34,y-9,{f:bold,s:13});
    let ly=y-38;
    [...paper.querySelectorAll('.iv-from>span')].forEach((s,i)=>{text(T(s),M,ly,{f:i?reg:bold,s:9,c:i?mute:ink});ly-=12;});
    text(T(paper.querySelector('.iv-title h3')),W-M,y-6,{f:bold,s:22,right:true});
    /* key facts: labels line up in one column, values line up on the right edge */
    let ry=y-34;const lx=W-M-210;
    [...paper.querySelectorAll('.iv-facts>div')].forEach(r=>{const k=T(r.querySelector('dt')),v=T(r.querySelector('dd'));text(k,lx,ry,{s:8.5,c:mute});text(v,W-M,ry,{f:bold,s:9.5,right:true});ry-=17;});
    /* status as a small pill */
    const stamp=T(paper.querySelector('.iv-paid'));
    if(stamp){const good=/PAID|DONE|ACTIVE|CONFIRMED/.test(stamp),col=good?rgb(.11,.6,.42):mute,sw=width(stamp,bold,8.5)+22,ph=20,px=W-M-sw,py=ry-11;
      page.drawSvgPath('M10 0H'+(sw-10)+'Q'+sw+' 0 '+sw+' 10Q'+sw+' '+ph+' '+(sw-10)+' '+ph+'H10Q0 '+ph+' 0 10Q0 0 10 0Z',{x:px,y:py+ph,color:good?rgb(.91,.97,.94):rgb(.95,.96,.97),borderColor:col,borderWidth:.7});
      text(stamp,px+11,py+6.5,{f:bold,s:8.5,c:col});ry=py-10;}
    y=Math.min(ly,ry)-18;rule(y);y-=24;
    /* billed to */
    text('BILLED TO',M,y,{f:bold,s:8,c:mute});y-=14;
    [...paper.querySelectorAll('.iv-parties>div>*')].filter(n=>n.tagName!=='H4').forEach((n,i)=>{
      for(const l of wrap(T(n),n.tagName==='B'?bold:reg,n.tagName==='SMALL'?8:10,W-2*M)){text(l,M,y,{f:n.tagName==='B'?bold:reg,s:n.tagName==='SMALL'?8:10,c:n.tagName==='SPAN'||n.tagName==='SMALL'?mute:ink});y-=13;}
    });
    y-=12;
    /* items */
    const cols=[...paper.querySelectorAll('.iv-table thead th')].map(T),x=[M,W-M-250,W-M-150,W-M];
    page.drawRectangle({x:M,y:y-12,width:W-2*M,height:26,color:rgb(.955,.965,.985)});
    cols.forEach((c,i)=>text(c.toUpperCase(),i===3?x[3]-8:x[i]+(i?0:8),y-3,{f:bold,s:8,c:mute,right:i===3}));
    y-=24;y-=8;
    const cells=[...paper.querySelectorAll('.iv-table tbody tr:first-child td')];
    const desc=[...cells[0].children].map(T);let dy=y;
    desc.forEach((d,i)=>{for(const l of wrap(d,i?reg:bold,i?9:10,x[1]-M-22)){text(l,M+8,dy,{f:i?reg:bold,s:i?9:10,c:i?mute:ink});dy-=14;}});
    text(T(cells[1]),x[1],y,{s:9.5});text(T(cells[2]),x[2],y,{s:9.5});text(T(cells[3]),x[3]-8,y,{f:bold,s:10,right:true});
    y=dy-8;rule(y);y-=26;
    /* totals */
    [...paper.querySelectorAll('.iv-totals>div')].forEach(r=>{const big=r.classList.contains('iv-grand');if(big){page.drawLine({start:{x:W-M-170,y:y+15},end:{x:W-M,y:y+15},thickness:.7,color:line});y-=4;}text(T(r.querySelector('dt')),W-M-170,y,{f:big?bold:reg,s:big?12:9.5,c:big?ink:mute});text(T(r.querySelector('dd')),W-M,y,{f:big?bold:reg,s:big?13:9.5,right:true});y-=big?24:18;});
    y-=10;
    /* notes */
    [...paper.querySelectorAll('.iv-notes p')].forEach(p=>{for(const l of wrap(T(p),reg,9,W-2*M)){text(l,M,y,{s:9,c:mute});y-=12;}y-=4;});
    /* footer */
    rule(M+30);
    [...paper.querySelectorAll('.iv-foot span')].forEach((s,i)=>text(T(s),i?W-M:M,M+14,{s:8,c:mute,right:!!i}));
  }
  return pdf.save();
}
export async function downloadInvoices(docs,name){
  const bytes=await invoicesToPdf(docs);
  const url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));
  const a=document.createElement('a');a.href=url;a.download=(name||'Wrapline-invoice')+'.pdf';document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),4000);
}
