/* Invoices for subscriptions. One invoice email is sent to the buyer for every new subscription payment
   (the first payment and each renewal), from PayPal or Razorpay. Donations never get one.
   Called from paymentRecord_() in Payments.gs, which only reports a payment as new once, so nobody is emailed twice.
   Optional script properties (Project Settings > Script properties):
     INVOICE_SELLER_NAME     name printed on the invoice (default "Ajoy Tools")
     INVOICE_SELLER_DETAILS  extra lines such as address or tax number; separate lines with | */
var INVOICES_SHEET_ = 'Invoices';
var INVOICE_HEADERS_ = ['Invoice no.', 'Date', 'Buyer email', 'Plan', 'Billing', 'Licenses', 'Amount', 'Currency', 'Provider', 'Mode', 'Payment ID', 'Subscription ID'];

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
  }
  return sheet;
}

/* p is the payment as recorded in the Payments tab. Returns the invoice number, or '' when nothing was sent. */
function invoiceSend_(p) {
  if (!p || !p.paymentId || !p.email || p.status === 'Refunded' || !(Number(p.amount) > 0)) return '';
  var sheet = invoiceSheet_(), last = sheet.getLastRow();
  if (last >= 2 && sheet.getRange(2, 11, last - 1, 1).getValues().some(function (r) { return String(r[0]) === String(p.paymentId); })) return '';
  var date = p.date instanceof Date ? p.date : new Date(), number = invoiceNumber_(sheet, date);
  var plan = 'Wrapline ' + planLabel_(p.plan === 'offline' || /premium/i.test(p.plan) ? 'offline' : 'online') + ' · ' + (/year/i.test(p.billing) ? 'Yearly' : 'Monthly') + (Number(p.seats) > 1 ? ' · ' + Number(p.seats) + ' licenses' : '');
  var test = String(p.mode).toLowerCase() === 'test', tag = test ? '[TEST] ' : '';
  var props = props_(), seller = props.getProperty('INVOICE_SELLER_NAME') || 'Ajoy Tools', extra = (props.getProperty('INVOICE_SELLER_DETAILS') || '').split('|').map(function (s) { return s.trim(); }).filter(Boolean);
  var when = Utilities.formatDate(date, 'Asia/Calcutta', 'd MMM yyyy'), total = invoiceMoney_(p.amount, p.currency || 'INR');
  var row = function (a, b, strong) { return '<tr><td style="padding:10px 0;color:#667;border-top:1px solid #e3e6ee">' + esc_(a) + '</td><td style="padding:10px 0;text-align:right;border-top:1px solid #e3e6ee">' + (strong ? '<b>' + esc_(b) + '</b>' : esc_(b)) + '</td></tr>'; };
  var html = '<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#14182a">' +
    '<table style="width:100%"><tr><td><h2 style="margin:0">Invoice</h2><div style="color:#667;font-size:13px">' + esc_(number) + '</div></td><td style="text-align:right;font-size:13px;color:#667">' + esc_(when) + '</td></tr></table>' +
    '<p style="margin:18px 0 4px"><b>' + esc_(seller) + '</b><br><span style="color:#667;font-size:13px">Wrapline, production tools for Maya' + extra.map(function (l) { return '<br>' + esc_(l); }).join('') + '</span></p>' +
    '<p style="margin:14px 0 4px;color:#667;font-size:13px">Billed to</p><p style="margin:0"><b>' + esc_(p.email) + '</b></p>' +
    '<table style="border-collapse:collapse;width:100%;margin:18px 0 6px">' + row('Item', plan, false) + row('Paid with', p.provider + (test ? ' (test payment)' : ''), false) + row('Payment ID', String(p.paymentId), false) +
    (p.subscriptionId ? row('Subscription', String(p.subscriptionId), false) : '') + row('Total paid', total, true) + '</table>' +
    '<p style="color:#667;font-size:13px">Thank you for subscribing. Keep this email as your receipt. Questions? Reply to this email or write to ' + esc_(replyTo_()) + '.</p></div>';
  var text = 'Invoice ' + number + ' (' + when + ')\n' + seller + (extra.length ? '\n' + extra.join('\n') : '') + '\n\nBilled to: ' + p.email + '\nItem: ' + plan + '\nPaid with: ' + p.provider + '\nPayment ID: ' + p.paymentId + '\nTotal paid: ' + total + '\n\nQuestions? ' + replyTo_();
  MailApp.sendEmail({ to: String(p.email), name: 'Wrapline by Ajoy Tools', replyTo: replyTo_(), subject: tag + 'Your Wrapline invoice ' + number, htmlBody: html, body: text });
  sheet.appendRow([number, date, p.email, plan, paymentTitle_(p.billing), Number(p.seats) || 1, Number(p.amount), p.currency || '', p.provider, test ? 'Test' : 'Live', String(p.paymentId), String(p.subscriptionId || '')].map(safeSheetCell_));
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
      return { number: String(r[0]), date: isNaN(date.getTime()) ? '' : date.toISOString(), plan: String(r[3]), seller: props_().getProperty('INVOICE_SELLER_NAME') || 'Ajoy Tools', billing: String(r[4]), seats: Number(r[5]) || 1, amount: Number(r[6]) || 0, currency: String(r[7]), provider: String(r[8]), mode: String(r[9]), paymentId: String(r[10]), subscriptionId: String(r[11]) };
    });
}
