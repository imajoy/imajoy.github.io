/* One plain black-and-white invoice, used for the confirmation page and for every saved invoice. Pure DOM (no HTML strings).
   Printing clones just the paper into its own print root, so the page prints exactly one A4 sheet (see css/thank-you-v3.css). */
const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e;};
const reduce=()=>matchMedia('(prefers-reduced-motion:reduce)').matches;
/* "Nov 09, 2026 to Dec 09, 2026" for a monthly or yearly invoice. */
export function invoicePeriod(iso,billing){
 const t=Date.parse(iso);if(!Number.isFinite(t))return '';
 const a=new Date(t),b=new Date(t);if(/year/i.test(billing||''))b.setFullYear(b.getFullYear()+1);else b.setMonth(b.getMonth()+1);
 const f=d=>d.toLocaleDateString(undefined,{dateStyle:'medium'});return f(a)+' to '+f(b);
}
export function printDocs(docs){
 const papers=docs.map(d=>d.querySelector('.iv-paper')).filter(Boolean);if(!papers.length)return;
 document.getElementById('iv-print')?.remove();
 const root=el('div');root.id='iv-print';
 papers.forEach(paper=>{const copy=paper.cloneNode(true);copy.classList.add('is-print');root.append(copy);});
 document.body.append(root);
 const title=document.title,num=papers.length===1?papers[0].dataset.number:'';
 document.title=num?'Invoice '+num+' · Wrapline':'Wrapline invoices';
 document.body.classList.add('iv-printing');
 const done=()=>{document.body.classList.remove('iv-printing');root.remove();document.title=title;removeEventListener('afterprint',done);};
 addEventListener('afterprint',done);
 requestAnimationFrame(()=>requestAnimationFrame(()=>window.print()));
}
export function printDoc(doc){printDocs([doc]);}
/* o: {kind:'Invoice'|'Receipt', number, date, statusText, statusKind:'paid'|'free', test, email, provider, reference,
       orderId (short ORD-… ref), orderFull (full checkout ID), billed:{name,lines:[...]}, title, sub, seats, money(v)->string, total:number|null, coupon, totalLabel, note, seller} */
export function buildInvoiceDoc(o){
 const wrap=el('div','iv-wrap'),paper=el('article','iv-paper'),m=o.money,known=typeof o.total==='number'&&Number.isFinite(o.total);
 const seller=o.seller||'AJOY',kind=(o.kind||'Invoice').toUpperCase(),dash='—';
 if(o.number)paper.dataset.number=o.number;
 const price=v=>known?m(v):'As invoiced';
 const cc=o.currency&&/^[A-Z]{3}$/.test(o.currency)?' ('+o.currency+')':'';
 /* header: brand and seller on the left, the document's key facts on the right */
 const top=el('header','iv-top'),from=el('div','iv-from'),brand=el('div','iv-brand');
 const NS='http://www.w3.org/2000/svg',svg=document.createElementNS(NS,'svg');svg.setAttribute('viewBox','0 0 32 32');svg.setAttribute('width','30');svg.setAttribute('height','30');svg.setAttribute('aria-hidden','true');
 const node=(t,at)=>{const n=document.createElementNS(NS,t);for(const k in at)n.setAttribute(k,at[k]);return n;};
 svg.append(node('rect',{width:32,height:32,rx:8,fill:'#3D8BFF'}),node('path',{d:'M7.5 23.5C15 23.5 17 8.5 24.5 8.5',fill:'none',stroke:'#fff','stroke-width':2.2,'stroke-linecap':'round'}),node('path',{d:'M7.5 20.3l3.2 3.2-3.2 3.2-3.2-3.2z',fill:'#fff'}),node('path',{d:'M24.5 5.3l3.2 3.2-3.2 3.2-3.2-3.2z',fill:'#fff'}));
 brand.append(svg,el('b',null,'WRAPLINE'));
 from.append(brand,el('span','iv-sel',seller),el('span',null,'Production tools for Autodesk Maya'),el('span',null,'wrapline.in'),el('span',null,'Support: wrapline.in/contact'));
 const ttl=el('div','iv-title');ttl.append(el('h3',null,kind));
 const facts=el('dl','iv-facts');
 const fact=(k,v)=>{if(!v)return;const r=el('div');r.append(el('dt',null,k),el('dd',null,v));facts.append(r);};
 fact('Invoice number',o.number?o.number+(o.test?' (TEST)':''):'');fact('Date issued',o.date);
 if(known)fact('Amount',m(o.total)+cc);
 fact('Next billing',o.nextBilling);fact('Order',o.orderId);fact('Paid with',o.provider);fact('Reference',o.reference);
 const paidTxt=o.statusKind==='paid'?'PAID':/trial/i.test(o.statusText||'')?'TRIAL ACTIVE':/payment done/i.test(o.statusText||'')?'PAYMENT DONE':'CONFIRMED';
 const paid=el('p','iv-paid',paidTxt);paid.dataset.kind=o.statusKind==='paid'?'paid':'free';
 ttl.append(facts,paid);
 top.append(from,ttl);
 /* billed to */
 const parties=el('div','iv-parties'),pt=el('div');
 pt.append(el('h4',null,'Billed to'));
 const bn=o.billed?.name;
 pt.append(el('b',null,bn||o.email||'Your account'));
 for(const l of o.billed?.lines||[])pt.append(el('span',null,l));
 pt.append(el('span',null,bn?(o.email||''):'Wrapline account holder'));
 if(o.orderFull)pt.append(el('small',null,'Checkout ID '+o.orderFull));
 parties.append(pt);
 /* line items */
 const table=el('table','iv-table'),cap=el('caption',null,'Items');cap.className='iv-sr';
 const thead=el('thead'),hr=el('tr');
 for(const [t,c] of [['Description','d'],['Price','u'],['Discount','x'],['Amount'+cc,'a']]){const th=el('th',c,t);th.scope='col';hr.append(th);}
 thead.append(hr);
 const tbody=el('tbody'),tr=el('tr'),d=el('td','d');
 d.append(el('b',null,o.title));if(o.sub)d.append(el('span',null,o.sub+' · '+o.seats+(o.seats===1?' license':' licenses')));if(o.period)d.append(el('small',null,o.period));
 tr.append(d,el('td','u',known&&o.seats>0?m(o.total/o.seats)+' × '+o.seats:price()),el('td','x',o.coupon?'Code '+o.coupon:'—'),el('td','a',known?m(o.total):'As invoiced'));
 for(const [td,l] of [[tr.children[1],'Price'],[tr.children[2],'Discount'],[tr.children[3],'Amount'+cc]]){td.dataset.label=l;if(/^[—-]$/.test(td.textContent.trim()))td.dataset.empty='';}
 tbody.append(tr);table.append(cap,thead,tbody);
 /* totals */
 const tot=el('dl','iv-totals');
 const line=(k,v,cls)=>{const r=el('div',cls);r.append(el('dt',null,k),el('dd',null,v));tot.append(r);};
 line('Total',known?m(o.total):'As invoiced','iv-grand');
 line('Paid',known?'('+m(o.statusKind==='paid'?o.total:0)+')':'—');
 line('Balance due'+cc,known?m(0):'—','iv-due');
 const below=el('div','iv-below'),notes=el('div','iv-notes');
 notes.append(el('p',null,o.note||'Thank you for choosing Wrapline.'));
 notes.append(el('p',null,'Amounts are in the currency you were charged. You can manage or stop automatic renewal at any time from your account.'));
 below.append(notes,tot);
 const foot=el('footer','iv-foot');
 foot.append(el('span',null,'This is a computer-generated document and is valid without a signature.'),el('span',null,seller+' · wrapline.in'));
 paper.append(top,parties,table,below,foot);
 /* The page is fed out of a slim slot, like a receipt leaving a printer; the small light is blue while it prints and green when it is done. */
 const slot=el('div','iv-slot'),feed=el('div','iv-feed');slot.setAttribute('aria-hidden','true');slot.append(el('i'));feed.append(paper);
 wrap.append(slot,feed);
 let started=false;
 const done=()=>wrap.classList.add('is-done');
 const go=()=>{if(started)return;started=true;paper.classList.add('is-in');wrap.classList.add('is-in');if(reduce())done();else{paper.addEventListener('animationend',e=>{if(e.target===paper)done();});setTimeout(done,2600);}};
 if('IntersectionObserver' in window&&!reduce()){const io=new IntersectionObserver(es=>{if(es[0].isIntersecting){go();io.disconnect();}},{threshold:.05});queueMicrotask(()=>io.observe(wrap));}
 else go();
 wrap.go=go;
 return wrap;
}
