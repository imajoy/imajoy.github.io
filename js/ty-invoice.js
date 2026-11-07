/* One real-looking invoice document, used for the confirmation page and for every saved invoice. Pure DOM (no HTML strings). */
const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e;};
export function printDoc(doc){
 document.body.classList.add('ty-printing');doc.classList.add('ty-doc-live');
 const done=()=>{document.body.classList.remove('ty-printing');doc.classList.remove('ty-doc-live');removeEventListener('afterprint',done);};
 addEventListener('afterprint',done);window.print();
}
/* o: {kind:'Invoice'|'Receipt', number, date, statusText, statusKind:'paid'|'free', test, email, provider, reference,
       title, sub, seats, money(v)->string, total:number|null, coupon, totalLabel, note} */
export function buildInvoiceDoc(o){
 const doc=el('article','ty-doc'),m=o.money,known=typeof o.total==='number'&&Number.isFinite(o.total);
 const top=el('header','ty-doc-top'),brand=el('div','ty-doc-brand'),logo=document.createElement('img');
 logo.src='assets/logo-mark.svg';logo.alt='';logo.width=38;logo.height=38;
 const who=el('div');who.append(el('b',null,'Ajoy Tools'),el('small',null,'Wrapline Pro · Maya tools'),el('small',null,'imajoy.github.io'));
 brand.append(logo,who);
 const ttl=el('div','ty-doc-title');ttl.append(el('h2',null,o.kind));
 if(o.number)ttl.append(el('p','ty-doc-no',o.number+(o.test?' · TEST':'')));
 const chip=el('span','ty-doc-status',o.statusText);chip.dataset.kind=o.statusKind||'paid';ttl.append(chip);
 top.append(brand,ttl);
 const meta=el('dl','ty-doc-meta');
 for(const [k,v] of [['Billed to',o.email||'Your account'],[o.kind+' date',o.date],[o.statusKind==='free'?'Provider':'Paid with',[o.provider,o.reference].filter(Boolean).join(' · ')||'—']]){const d=el('div');d.append(el('dt',null,k),el('dd',null,v));meta.append(d);}
 const table=el('table','ty-doc-table'),head=el('thead'),hr=el('tr');
 for(const [t,c] of [['Description',''],['Licenses','ty-doc-qty'],['Rate','ty-doc-rate'],['Amount','ty-doc-amt']])hr.append(el('th',c,t));
 head.append(hr);
 const body=el('tbody'),row=el('tr'),d1=el('td','ty-doc-desc');d1.append(el('b',null,o.title));if(o.sub)d1.append(el('small',null,o.sub));
 const unit=known&&o.seats>0?m(o.total/o.seats):'—';
 row.append(d1,el('td','ty-doc-qty',String(o.seats)),el('td','ty-doc-rate',unit),el('td','ty-doc-amt',known?m(o.total):'On invoice'));
 body.append(row);table.append(head,body);
 const tot=el('dl','ty-doc-totals');
 const line=(k,v,cls)=>{const d=el('div',cls);d.append(el('dt',null,k),el('dd',null,v));tot.append(d);};
 if(known)line('Subtotal',m(o.total));
 if(o.coupon)line('Coupon','Code '+o.coupon+' applied');
 line(o.totalLabel,known?m(o.total):'On invoice','ty-doc-grand');
 doc.append(top,meta,table,tot);
 if(o.note)doc.append(el('p','ty-doc-note',o.note));
 const foot=el('p','ty-doc-foot');foot.append('Thank you for choosing Ajoy Tools. Questions about this document? ');
 const a=el('a',null,'Contact support');a.href='contact.html';foot.append(a,'.');doc.append(foot);
 return doc;
}
