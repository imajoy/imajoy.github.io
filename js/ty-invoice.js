/* One modern ticket-style invoice, used for the confirmation page and for every saved invoice. Pure DOM (no HTML strings).
   Entrance is started by .is-in (added once the invoice is on screen) and only moves transform/opacity. */
const NS='http://www.w3.org/2000/svg';
const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e;};
const reduce=()=>matchMedia('(prefers-reduced-motion:reduce)').matches;
export function printDoc(doc){
 document.body.classList.add('ty-printing');doc.classList.add('ty-doc-live');
 const done=()=>{document.body.classList.remove('ty-printing');doc.classList.remove('ty-doc-live');removeEventListener('afterprint',done);};
 addEventListener('afterprint',done);window.print();
}
/* deterministic barcode from the invoice number */
function barcode(seed){
 let h=2166136261;for(const c of String(seed||'WRAPLINE')){h^=c.charCodeAt(0);h=Math.imul(h,16777619)>>>0;}
 const svg=document.createElementNS(NS,'svg');svg.setAttribute('class','ty-doc-bars');svg.setAttribute('viewBox','0 0 220 38');svg.setAttribute('preserveAspectRatio','none');svg.setAttribute('aria-hidden','true');
 let x=0,i=0;while(x<216){h=Math.imul(h^(h>>>13),1274126177)>>>0;const w=1+(h%3),gap=1+((h>>>4)%3);const r=document.createElementNS(NS,'rect');r.setAttribute('x',x);r.setAttribute('y',0);r.setAttribute('width',w);r.setAttribute('height',38);r.style.setProperty('--i',String(i++));svg.append(r);x+=w+gap;}
 return svg;
}
function countUp(node,value,money){
 if(reduce()||!(value>0)){node.textContent=money(value);return;}
 const t0=performance.now(),dur=1300;node.textContent=money(0);
 const step=n=>{const k=Math.min(1,(n-t0)/dur);node.textContent=money(value*(1-Math.pow(1-k,4)));if(k<1)requestAnimationFrame(step);else node.textContent=money(value);};
 requestAnimationFrame(step);
}
/* o: {kind:'Invoice'|'Receipt', number, date, statusText, statusKind:'paid'|'free', test, email, provider, reference,
       title, sub, seats, money(v)->string, total:number|null, coupon, totalLabel, note} */
export function buildInvoiceDoc(o){
 const wrap=el('div','ty-doc-wrap'),doc=el('article','ty-doc'),m=o.money,known=typeof o.total==='number'&&Number.isFinite(o.total);
 /* header: the dark "pass" side */
 const head=el('header','ty-doc-head'),bar=el('div','ty-doc-bar'),brand=el('div','ty-doc-brand'),logo=document.createElement('img');
 logo.src='assets/logo-mark.svg';logo.alt='';logo.width=34;logo.height=34;
 const bn=el('div');bn.append(el('b',null,'Ajoy Tools'),el('small',null,'Wrapline Pro'));brand.append(logo,bn);
 const tag=el('div','ty-doc-tag');tag.append(el('span',null,o.kind));if(o.number)tag.append(el('b',null,o.number+(o.test?' · TEST':'')));
 bar.append(brand,tag);
 const hero=el('div','ty-doc-hero');
 hero.append(el('small',null,o.totalLabel));
 const amt=el('p','ty-doc-amount',known?m(o.total):'On invoice');if(!known)amt.classList.add('is-text');hero.append(amt);
 const chip=el('span','ty-doc-status',o.statusText);chip.dataset.kind=o.statusKind||'paid';hero.append(chip);
 head.append(bar,hero);
 /* body: the paper side */
 const body=el('div','ty-doc-body');
 const meta=el('dl','ty-doc-meta');
 for(const [k,v] of [['Billed to',o.email||'Your account'],[o.kind+' date',o.date],[o.statusKind==='free'?'Provider':'Paid with',o.provider||'—'],['Reference',o.reference||(o.number||'—')]]){const d=el('div','ty-doc-cell');d.append(el('dt',null,k),el('dd',null,v));meta.append(d);}
 const items=el('div','ty-doc-items');
 const lab=el('div','ty-doc-row ty-doc-labels');lab.append(el('span',null,'Item'),el('span','ty-doc-qty','Licenses'),el('span','ty-doc-amt','Amount'));
 const row=el('div','ty-doc-row ty-doc-item'),d1=el('div','ty-doc-desc'),ic=el('i','ty-doc-ic'),ds=el('div');
 ic.setAttribute('aria-hidden','true');ic.innerHTML='<svg viewBox="0 0 24 24"><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/></svg>';
 ds.append(el('b',null,o.title));if(o.sub)ds.append(el('small',null,o.sub));d1.append(ic,ds);
 row.append(d1,el('span','ty-doc-qty',String(o.seats)),el('span','ty-doc-amt',known?m(o.total):'On invoice'));
 items.append(lab,row);
 const tot=el('dl','ty-doc-totals');
 const line=(k,v,cls)=>{const d=el('div',cls);d.append(el('dt',null,k),el('dd',null,v));tot.append(d);};
 if(known&&o.seats>0)line('Rate',m(o.total/o.seats)+' × '+o.seats);
 if(o.coupon)line('Coupon','Code '+o.coupon+' applied');
 line(o.totalLabel,known?m(o.total):'On invoice','ty-doc-grand');
 body.append(meta,items,tot);
 if(o.note)body.append(el('p','ty-doc-note',o.note));
 const foot=el('footer','ty-doc-foot'),code=el('div','ty-doc-code');code.append(barcode(o.number||o.email||o.date),el('small',null,o.number||'WRAPLINE PRO'));
 const thanks=el('p','ty-doc-thanks');thanks.append('Questions about this document? ');const a=el('a',null,'Contact support');a.href='contact.html';thanks.append(a,'.');
 foot.append(code,thanks);body.append(foot);
 const stamp=el('span','ty-doc-stamp',o.statusKind==='free'?(/trial/i.test(o.statusText)?'Trial':'Confirmed'):'Paid');stamp.setAttribute('aria-hidden','true');
 doc.append(head,body,stamp);wrap.append(doc);
 /* start the entrance when it is actually on screen */
 const go=()=>{if(doc.classList.contains('is-in'))return;doc.classList.add('is-in');if(known)countUp(amt,o.total,m);};
 if('IntersectionObserver' in window&&!reduce()){const io=new IntersectionObserver(es=>{if(es[0].isIntersecting){go();io.disconnect();}},{threshold:.18});queueMicrotask(()=>io.observe(doc));}
 else{doc.classList.add('is-in');}
 wrap.go=go;
 return wrap;
}
