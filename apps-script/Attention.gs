/* "Needs attention": a plain list of purchases that may not have finished, so you can follow up with the buyer.
   Run it from the sheet menu (Ajoy Tools > Refresh "Needs attention") or from the Apps Script editor (run needsAttention).
   It rewrites one tab, "Needs attention", and never changes any order, payment or invoice.
   Three kinds of rows:
     Paid, no order      money was taken (Payments tab) but no accepted order exists for that subscription
     Checkout not done   a checkout was started more than 20 minutes ago and never completed
     Order, no invoice   an accepted order has no row in the Invoices tab
   Each row shows the Order ID the buyer sees on the thank-you page, so they can quote it and you can search for it. */
var ATTENTION_SHEET_ = 'Needs attention';
var ATTENTION_HEADERS_ = ['Problem', 'Order ID', 'Full checkout ID', 'Buyer email', 'Started', 'Provider', 'Plan', 'Subscription ID', 'Payment ID', 'What to do'];

function onOpen() {
  try { SpreadsheetApp.getUi().createMenu('Ajoy Tools').addItem('Refresh "Needs attention"', 'needsAttention').addToUi(); } catch (e) {}
}

function needsAttention() {
  var rows = [], cutoff = Date.now() - 20 * 60000, mode = mode_();
  var fmt = function (t) { var d = t instanceof Date ? t : new Date(t); return isNaN(d.getTime()) ? '' : Utilities.formatDate(d, 'Asia/Calcutta', 'd MMM yyyy HH:mm'); };
  var accepted = {}, orderedSubs = {};
  var add = function (problem, id, email, started, provider, plan, sub, pay, todo) {
    rows.push([problem, orderRef_(id), id || '', email || '', fmt(started), provider || '', plan || '', sub || '', pay || '', todo]);
  };
  try {
    commerceRows_().forEach(function (r) {
      if (r[1] !== mode) return;
      if (r[16] === 'yes') { accepted[r[0]] = true; if (r[11]) orderedSubs[r[11]] = true; return; }
      var started = r[13] instanceof Date ? r[13].getTime() : Number(new Date(r[13]));
      if (started > cutoff || /cancel|block|expired/i.test(String(r[12]))) return;
      add('Checkout not done', r[0], r[2], r[13], 'PayPal', r[7] + ' ' + r[8], r[11], '', 'Probably abandoned. If the buyer wrote to you, check PayPal for this subscription.');
    });
  } catch (e) { Logger.log('Attention: PayPal checkouts unreadable'); }
  try {
    razorpayRows_().forEach(function (rec) {
      if (!rec || rec.mode !== mode) return;
      if (rec.accepted) { accepted[rec.id] = true; if (rec.subscriptionId) orderedSubs[rec.subscriptionId] = true; return; }
      if ((Number(rec.createdAt) || 0) > cutoff || /cancel|block|expired|reset/i.test(String(rec.state))) return;
      add('Checkout not done', rec.id, rec.email, rec.createdAt, 'Razorpay', rec.price ? rec.price.plan + ' ' + rec.price.billing : '', rec.subscriptionId, '', 'Probably abandoned. If the buyer wrote to you, check Razorpay for this subscription.');
    });
  } catch (e) { Logger.log('Attention: Razorpay checkouts unreadable'); }
  try {
    paymentRows_().forEach(function (r) {
      if (String(r[9]) !== 'Paid' || !(Number(r[7]) > 0) || String(r[3]).toLowerCase() !== (mode === 'live' ? 'live' : 'test') || !r[12]) return;
      if (/donat|coffee/i.test(String(r[4]) + String(r[15]))) return;
      var sub = String(r[13] || '');
      if (sub && orderedSubs[sub]) return;
      var o = invoiceOrder_(sub, r[1], '');
      add('Paid, no order', o.checkoutId, r[1], r[0], r[2], r[4] + ' ' + r[5], sub, r[12], 'Money was taken but no accepted order is linked. Check the account, then grant access or refund.');
    });
  } catch (e) { Logger.log('Attention: payments unreadable'); }
  try {
    var inv = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(INVOICES_SHEET_), invoiced = {};
    if (inv && inv.getLastRow() > 1) inv.getRange(2, 12, inv.getLastRow() - 1, 1).getValues().forEach(function (r) { if (r[0]) invoiced[String(r[0])] = true; });
    razorpayRows_().forEach(function (rec) {
      if (rec && rec.accepted && rec.mode === mode && rec.subscriptionId && !invoiced[rec.subscriptionId])
        add('Order, no invoice', rec.id, rec.email, rec.createdAt, 'Razorpay', rec.price ? rec.price.plan + ' ' + rec.price.billing : '', rec.subscriptionId, '', 'Open the buyer\'s account Invoices page once, or reply with a manual invoice.');
    });
  } catch (e) { Logger.log('Attention: invoices unreadable'); }
  var ss = SpreadsheetApp.getActiveSpreadsheet(), sheet = ss.getSheetByName(ATTENTION_SHEET_) || ss.insertSheet(ATTENTION_SHEET_);
  sheet.clear();
  sheet.getRange(1, 1, 1, ATTENTION_HEADERS_.length).setValues([ATTENTION_HEADERS_]).setBackground('#8a1c1c').setFontColor('#ffffff').setFontWeight('bold');
  sheet.setFrozenRows(1); sheet.setTabColor('#d93025');
  if (rows.length) sheet.getRange(2, 1, rows.length, ATTENTION_HEADERS_.length).setValues(rows);
  else sheet.getRange(2, 1).setValue('Nothing needs attention right now.');
  return rows.length;
}
