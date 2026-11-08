/* One plain black-and-white invoice, used for the confirmation page and for every saved invoice. Pure DOM (no HTML strings).
   Printing clones just the paper into its own print root, so the page prints exactly one A4 sheet (see css/thank-you-v3.css). */
const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e;};
const reduce=()=>matchMedia('(prefers-reduced-motion:reduce)').matches;
export function printDoc(doc){
 const paper=doc.querySelector('.iv-paper');if(!paper)return;
 document.getElementById('iv-print')?.remove();
 const root=el('div');root.id='iv-print';const copy=paper.cloneNode(true);copy.classList.add('is-print');root.append(copy);document.body.append(root);
 const title=document.title,num=paper.dataset.number;if(num)document.title='Invoice '+num+' · Ajoy Tools';
 document.body.classList.add('iv-printing');
 const done=()=>{document.body.classList.remove('iv-printing');root.remove();document.title=title;removeEventListener('afterprint',done);};
 addEventListener('afterprint',done);
 requestAnimationFrame(()=>requestAnimationFrame(()=>window.print()));
}
/* o: {kind:'Invoice'|'Receipt', number, date, statusText, statusKind:'paid'|'free', test, email, provider, reference,
       orderId (short ORD-… ref), orderFull (full checkout ID), billed:{name,lines:[...]}, title, sub, seats, money(v)->string, total:number|null, coupon, totalLabel, note, seller} */
export function buildInvoiceDoc(o){
 const wrap=el('div','iv-wrap'),paper=el('article','iv-paper'),m=o.money,known=typeof o.total==='number'&&Number.isFinite(o.total);
 const seller=o.seller||'Ajoy Tools',kind=(o.kind||'Invoice').toUpperCase(),dash='—';
 if(o.number)paper.dataset.number=o.number;
 const price=v=>known?m(v):'As invoiced';
 /* top: seller left, document title right */
 const top=el('header','iv-top'),from=el('div','iv-from');
 from.append(el('b',null,seller),el('span',null,'Wrapline Pro · production tools for Autodesk Maya'),el('span',null,'imajoy.github.io'));
 const ttl=el('div','iv-title');ttl.append(el('h3',null,kind));
 if(o.number)ttl.append(el('span',null,'No. '+o.number+(o.test?' (TEST)':'')));
 top.append(from,ttl);
 /* meta strip */
 const meta=el('dl','iv-meta');
 const cell=(k,v)=>{const d=el('div');d.append(el('dt',null,k),el('dd',null,v));return d;};
 meta.append(cell('Date of issue',o.date||dash),cell('Payment status',o.statusText||dash),cell('Payment method',o.provider||dash),cell('Reference',o.reference||o.number||dash));
 /* order id: the number the buyer quotes if a payment ever needs to be traced */
 const order=o.orderId?el('p','iv-order'):null;
 if(order){order.append(el('span',null,'Order ID'),el('b',null,o.orderId));if(o.orderFull)order.append(el('small',null,o.orderFull));}
 /* parties */
 const parties=el('div','iv-parties');
 const pf=el('div'),pt=el('div');
 pf.append(el('h4',null,'From'),el('b',null,seller),el('span',null,'Maker of Wrapline Pro'),el('span',null,'Support: imajoy.github.io/contact.html'));
 pt.append(el('h4',null,'Billed to'));
 const bn=o.billed?.name;
 pt.append(el('b',null,bn||o.email||'Your account'));
 for(const l of o.billed?.lines||[])pt.append(el('span',null,l));
 pt.append(el('span',null,bn?(o.email||''):'Wrapline Pro account holder'));
 parties.append(pf,pt);
 /* line items */
 const table=el('table','iv-table'),cap=el('caption',null,'Items');cap.className='iv-sr';
 const thead=el('thead'),hr=el('tr');
 for(const [t,c] of [['#','n'],['Description','d'],['Licenses','q'],['Unit price','u'],['Amount','a']]){const th=el('th',c,t);th.scope='col';hr.append(th);}
 thead.append(hr);
 const tbody=el('tbody'),tr=el('tr'),d=el('td','d');
 d.append(el('b',null,o.title));if(o.sub)d.append(el('span',null,o.sub));
 tr.append(el('td','n','1'),d,el('td','q',String(o.seats)),el('td','u',known&&o.seats>0?m(o.total/o.seats):price()),el('td','a',known?m(o.total):'As invoiced'));
 tbody.append(tr);table.append(cap,thead,tbody);
 /* totals */
 const tot=el('dl','iv-totals');
 const line=(k,v,cls)=>{const r=el('div',cls);r.append(el('dt',null,k),el('dd',null,v));tot.append(r);};
 line('Subtotal',known?m(o.total):'—');
 if(o.coupon)line('Coupon','Code '+o.coupon);
 line(o.kind==='Receipt'?'Total':'Total','' + (known?m(o.total):'As invoiced'),'iv-grand');
 line(o.statusKind==='paid'?'Amount paid':'Amount paid',known?m(o.statusKind==='paid'?o.total:0):'—');
 line('Balance due',known?m(0):'—');
 const below=el('div','iv-below'),notes=el('div','iv-notes');
 notes.append(el('h4',null,'Notes'));
 notes.append(el('p',null,o.note||'Thank you for choosing Wrapline Pro.'));
 notes.append(el('p',null,'Amounts are shown in the currency charged. Manage or stop automatic renewal any time from Account on the Wrapline Pro page.'));
 below.append(notes,tot);
 const foot=el('footer','iv-foot');
 foot.append(el('span',null,'This is a computer-generated document and is valid without a signature.'),el('span',null,seller+' · imajoy.github.io'));
 const stamp=el('span','iv-stamp',o.statusKind==='paid'?'PAID':/trial/i.test(o.statusText||'')?'TRIAL':'CONFIRMED');stamp.setAttribute('aria-hidden','true');
 paper.append(top,meta,...(order?[order]:[]),parties,table,below,foot,stamp);
 wrap.append(paper);
 const go=()=>paper.classList.add('is-in');
 if('IntersectionObserver' in window&&!reduce()){const io=new IntersectionObserver(es=>{if(es[0].isIntersecting){go();io.disconnect();}},{threshold:.12});queueMicrotask(()=>io.observe(paper));}
 else go();
 wrap.go=go;
 return wrap;
}
