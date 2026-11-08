/* Invoices for subscriptions. One invoice email is sent to the buyer for every new subscription payment
   (the first payment and each renewal), from PayPal or Razorpay. Donations never get one.
   Called from paymentRecord_() in Payments.gs, which only reports a payment as new once, so nobody is emailed twice.
   Optional script properties (Project Settings > Script properties):
     INVOICE_SELLER_NAME     name printed on the invoice (default "Ajoy Tools")
     INVOICE_SELLER_DETAILS  extra lines such as address or tax number; separate lines with | */
var INVOICES_SHEET_ = 'Invoices';
var INVOICE_HEADERS_ = ['Invoice no.', 'Date', 'Buyer email', 'Plan', 'Billing', 'Licenses', 'Amount', 'Currency', 'Provider', 'Mode', 'Payment ID', 'Subscription ID', 'Order ID', 'Billed to', 'Company', 'Billing address'];

function invoiceMoney_(amount, currency) {
  var n = Number(amount) || 0, fixed = n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (currency === 'INR' ? '₹' : currency === 'USD' ? '$' : currency + ' ') + fixed;
}
function invoiceNumber_(sheet, date) {
  var prefix = 'WL-' + Utilities.formatDate(date, 'Asia/Calcutta', 'yyyyMM') + '-', last = sheet.getLastRow(), next = 1;
  if (last >= 2) {
    var m = /-(\d+)$/.exec(String(sheet.getRange(last, 1, 1, 1).getValues()[0][0]));
    if (m) next = Number(m[1]) + 1;
  }
  return prefix + ('0000' + next).slice(-4);
}
function invoiceSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), sheet = ss.getSheetByName(INVOICES_SHEET_);
  if (!sheet) {
    sheet = ss.insertSheet(INVOICES_SHEET_);
    sheet.appendRow(INVOICE_HEADERS_);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, INVOICE_HEADERS_.length).setBackground('#1a2959').setFontColor('#ffffff').setFontWeight('bold');
    sheet.setTabColor('#4a90e2');
  } else if (sheet.getLastColumn() < INVOICE_HEADERS_.length) {
    // older sheet: add the newer columns (Order ID, billing details) without touching existing rows
    sheet.getRange(1, 1, 1, INVOICE_HEADERS_.length).setValues([INVOICE_HEADERS_]).setBackground('#1a2959').setFontColor('#ffffff').setFontWeight('bold');
  }
  return sheet;
}

/* Short, readable order reference shown to the buyer and on the invoice: ORD- plus the first 8 characters of the checkout ID. */
function orderRef_(checkoutId) {
  var id = String(checkoutId || '').replace(/[^a-f0-9]/gi, '');
  return id.length >= 8 ? 'ORD-' + id.slice(0, 8).toUpperCase() : '';
}
/* Finds the checkout an invoice belongs to (PayPal "Checkouts" tab or Razorpay records) by subscription ID.
   Returns {checkoutId, name, company, address, city, region, postal}; empty strings when nothing is known. */
function invoiceOrder_(subscriptionId, email, checkoutId) {
  var out = { checkoutId: checkoutId || '', name: '', company: '', address: '', city: '', region: '', postal: '' };
  var sub = String(subscriptionId || ''), mail = String(email || '').trim().toLowerCase();
  if (!sub && !checkoutId) return out;
  var take = function (b, id) {
    b = b || {};
    out.checkoutId = out.checkoutId || id || '';
    ['name', 'company', 'address', 'city', 'region', 'postal'].forEach(function (k) { out[k] = String(b[k] || '').slice(0, 160); });
  };
  try {
    if (typeof commerceRows_ === 'function') {
      var hit = commerceRows_().filter(function (r) { return (checkoutId && r[0] === checkoutId) || (sub && String(r[11]) === sub); })
        .filter(function (r) { return !mail || String(r[2]).trim().toLowerCase() === mail; })[0];
      if (hit) { var b = {}; try { b = JSON.parse(hit[19] || '{}'); } catch (e) {} take(b, hit[0]); return out; }
    }
    if (typeof razorpayRows_ === 'function') {
      var rec = razorpayRows_().filter(function (r) { return r && ((checkoutId && r.id === checkoutId) || (sub && r.subscriptionId === sub)); })
        .filter(function (r) { return !mail || String(r.email || '').trim().toLowerCase() === mail; })[0];
      if (rec) take(rec, rec.id);
    }
  } catch (e) { Logger.log('Invoice order lookup failed'); }
  return out;
}
function invoiceAddress_(o) {
  var area = [o.city, [o.region, o.postal].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  return [o.address, area].filter(Boolean);
}

/* p is the payment as recorded in the Payments tab. Returns the invoice number, or '' when nothing was sent. */
function invoiceSend_(p) {
  if (!p || !p.paymentId || !p.email || p.status === 'Refunded' || !isFinite(Number(p.amount)) || Number(p.amount) < 0) return '';
  var sheet = invoiceSheet_(), last = sheet.getLastRow();
  if (last >= 2 && sheet.getRange(2, 11, last - 1, 1).getValues().some(function (r) { return String(r[0]) === String(p.paymentId); })) return '';
  var date = p.date instanceof Date ? p.date : new Date(), number = invoiceNumber_(sheet, date);
  var order = invoiceOrder_(p.subscriptionId, p.email, p.checkoutId), orderRef = orderRef_(order.checkoutId), addr = invoiceAddress_(order);
  var plan = 'Wrapline Pro ' + planLabel_(p.plan === 'offline' || /premium/i.test(p.plan) ? 'offline' : 'online') + ' · ' + (/year/i.test(p.billing) ? 'Yearly' : 'Monthly') + (Number(p.seats) > 1 ? ' · ' + Number(p.seats) + ' licenses' : '');
  var test = String(p.mode).toLowerCase() === 'test', tag = test ? '[TEST] ' : '';
  var props = props_(), seller = props.getProperty('INVOICE_SELLER_NAME') || 'Ajoy Tools', extra = (props.getProperty('INVOICE_SELLER_DETAILS') || '').split('|').map(function (s) { return s.trim(); }).filter(Boolean);
  var when = Utilities.formatDate(date, 'Asia/Calcutta', 'd MMM yyyy'), total = invoiceMoney_(p.amount, p.currency || 'INR');
  var zero = !(Number(p.amount) > 0), row = function (a, b, strong) { return '<tr><td style="padding:10px 0;color:#667;border-top:1px solid #e3e6ee">' + esc_(a) + '</td><td style="padding:10px 0;text-align:right;border-top:1px solid #e3e6ee">' + (strong ? '<b>' + esc_(b) + '</b>' : esc_(b)) + '</td></tr>'; };
  var html = '<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#14182a">' +
    '<table style="width:100%"><tr><td><h2 style="margin:0">Invoice</h2><div style="color:#667;font-size:13px">' + esc_(number) + '</div></td><td style="text-align:right;font-size:13px;color:#667">' + esc_(when) + '</td></tr></table>' +
    '<p style="margin:18px 0 4px"><b>' + esc_(seller) + '</b><br><span style="color:#667;font-size:13px">Wrapline Pro, production tools for Maya' + extra.map(function (l) { return '<br>' + esc_(l); }).join('') + '</span></p>' +
    '<p style="margin:14px 0 4px;color:#667;font-size:13px">Billed to</p><p style="margin:0">' + (order.name ? '<b>' + esc_(order.name) + '</b><br>' : '') + (order.company ? esc_(order.company) + '<br>' : '') + addr.map(function (l) { return esc_(l) + '<br>'; }).join('') + '<span style="color:#445">' + esc_(p.email) + '</span></p>' +
    '<table style="border-collapse:collapse;width:100%;margin:18px 0 6px">' + row('Item', plan, false) + row(zero ? 'Provider' : 'Paid with', p.provider + (test ? ' (test)' : ''), false) + (orderRef ? row('Order ID', orderRef + ' (' + order.checkoutId + ')', false) : '') + row(zero ? 'Reference' : 'Payment ID', String(p.paymentId), false) +
    (p.subscriptionId ? row('Subscription', String(p.subscriptionId), false) : '') + (p.note ? row('Reason', p.note, false) : '') + row(zero ? 'Total due' : 'Total paid', total, true) + '</table>' +
    (zero ? '<p style="margin:0 0 6px;color:#667;font-size:13px">No payment was due on this order. This invoice is your record of it.</p>' : '') +
    '<p style="color:#667;font-size:13px">Thank you for subscribing. Keep this email as your receipt. Questions? Reply to this email or write to ' + esc_(replyTo_()) + '.</p></div>';
  var text = 'Invoice ' + number + ' (' + when + ')\n' + seller + (extra.length ? '\n' + extra.join('\n') : '') + '\n\nBilled to: ' + [order.name, order.company].filter(Boolean).concat(addr).concat([p.email]).join(', ') + (orderRef ? '\nOrder ID: ' + orderRef + ' (' + order.checkoutId + ')' : '') + '\nItem: ' + plan + '\nPaid with: ' + p.provider + '\nPayment ID: ' + p.paymentId + '\n' + (zero ? 'Total due: ' : 'Total paid: ') + total + (zero ? '\nNo payment was due on this order.' : '') + '\n\nQuestions? ' + replyTo_();
  if (!p.silent) MailApp.sendEmail({ to: String(p.email), name: 'Wrapline Pro by Ajoy Tools', replyTo: replyTo_(), subject: tag + 'Your Wrapline Pro invoice ' + number, htmlBody: html, body: text });
  sheet.appendRow([number, date, p.email, plan, paymentTitle_(p.billing), Number(p.seats) || 1, Number(p.amount), p.currency || '', p.provider, test ? 'Test' : 'Live', String(p.paymentId), String(p.subscriptionId || ''), orderRef ? orderRef + ' | ' + order.checkoutId : '', order.name, order.company, addr.join(', ')].map(safeSheetCell_));
  return number;
}

/* Read-only history. The signed account token, never a browser email, selects rows. */
function invoiceArchive_(who) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(INVOICES_SHEET_);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var allowedSub = who.sub || '';
  if (allowedSub && /^[-a-f0-9]{36}$/i.test(allowedSub)) {
    var checkout = typeof razorpayFind_ === 'function' ? razorpayFind_(allowedSub) : null;
    allowedSub = checkout && checkout.email === who.email ? checkout.subscriptionId : '';
    if (!allowedSub) return [];
  }
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, INVOICE_HEADERS_.length).getValues()
    .filter(function (r) { return String(r[2]).trim().toLowerCase() === who.email && (!allowedSub || String(r[11]) === allowedSub); })
    .slice(-200).reverse().map(function (r) {
      var date = r[1] instanceof Date ? r[1] : new Date(r[1]);
      return { number: String(r[0]), date: isNaN(date.getTime()) ? '' : date.toISOString(), plan: String(r[3]), seller: props_().getProperty('INVOICE_SELLER_NAME') || 'Ajoy Tools', billing: String(r[4]), seats: Number(r[5]) || 1, amount: Number(r[6]) || 0, currency: String(r[7]), provider: String(r[8]), mode: String(r[9]), paymentId: String(r[10]), subscriptionId: String(r[11]), orderId: String(r[12] || ''), billedTo: String(r[13] || ''), company: String(r[14] || ''), address: String(r[15] || '') };
    });
}

/* Orders that cost nothing today (the 4-day trial, a 100% coupon) still get a numbered invoice, so every customer has a record. */
function invoiceSendFree_(record, reason) {
  if (!record || !record.email || !record.price) return '';
  return invoiceSend_({ date: new Date(), email: record.email, provider: 'Razorpay', mode: record.mode, plan: record.price.plan, billing: record.price.billing, seats: record.price.seats,
    amount: 0, currency: record.price.currency || 'INR', status: 'Paid', paymentId: 'free_' + record.id, subscriptionId: record.subscriptionId, note: reason || 'No payment due', checkoutId: record.id });
}

/* Self-healing history. When an account opens its invoices, any order that never got one (older purchases, trials whose
   small card check was refunded, 100% coupons) gets a numbered invoice now. These catch-up invoices are saved silently:
   nobody is emailed about an old order. Safe to repeat; each order is invoiced once, and the work runs at most every 10 minutes per account. */
function invoiceBackfill_(email) {
  email = String(email || '').trim().toLowerCase();
  if (!email) return 0;
  var cache = null, key = 'ib:' + email;
  try { cache = CacheService.getScriptCache(); if (cache.get(key)) return 0; } catch (e) {}
  var lock = LockService.getScriptLock(), made = 0;
  if (!lock.tryLock(8000)) return 0;
  try {
    // 1) paid payments recorded in the Payments tab that have no invoice yet
    if (typeof paymentRows_ === 'function') {
      paymentRows_().forEach(function (r) {
        if (String(r[1]).trim().toLowerCase() !== email || String(r[9]) !== 'Paid' || !r[12] || !(Number(r[7]) > 0)) return;
        if (/donat|coffee/i.test(String(r[4]) + String(r[15]))) return;
        var date = r[0] instanceof Date ? r[0] : new Date(r[0]);
        if (invoiceSend_({ silent: true, date: isNaN(date.getTime()) ? new Date() : date, email: email, provider: r[2], mode: String(r[3]).toLowerCase(), plan: r[4], billing: r[5], seats: r[6], amount: Number(r[7]), currency: r[8], status: 'Paid', paymentId: r[12], subscriptionId: r[13] })) made++;
      });
    }
    // 2) accepted Razorpay orders that cost nothing today (trial or 100% coupon) and have no invoice yet
    if (typeof razorpayRows_ === 'function') {
      razorpayRows_().forEach(function (rec) {
        if (!rec || !rec.accepted || String(rec.email || '').toLowerCase() !== email || !rec.price) return;
        var date = new Date(Number(rec.createdAt) || Date.now());
        var reason = rec.trial || (rec.price && rec.price.offer === 'trial') ? 'Free trial' : (rec.price.discount && rec.price.discount.coupon ? 'Coupon' : '');
        if (!reason) return;
        if (invoiceSend_({ silent: true, date: date, email: email, provider: 'Razorpay', mode: rec.mode, plan: rec.price.plan, billing: rec.price.billing, seats: rec.price.seats, amount: 0, currency: rec.price.currency || 'INR', status: 'Paid', paymentId: 'free_' + rec.id, subscriptionId: rec.subscriptionId, note: reason })) made++;
      });
    }
  } finally { lock.releaseLock(); }
  try { if (cache) cache.put(key, '1', 600); } catch (e) {}
  return made;
}
