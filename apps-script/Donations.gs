/* "Buy me a coffee" donations: any amount, one-time.
   Outside India people give in US dollars through PayPal; in India they can give in rupees (INR) through Razorpay.
   Nothing here trusts the browser: PayPal orders are re-read from PayPal and Razorpay payments are checked with
   the signature and then read from Razorpay before a row is written to the "Donations" tab.
   The site calls this with {type:'donation', step:'config'|'rzp-order'|'rzp-verify'|'paypal-verify', ...}.
   Script property DONATIONS_ENABLED = false turns donations off (default: on). */
var DONATION_LIMITS_ = { USD: { min: 1, max: 2000 }, INR: { min: 20, max: 150000 } };
var DONATIONS_SHEET_ = 'Donations';

function donationsOn_() { return String(props_().getProperty('DONATIONS_ENABLED') || 'true').toLowerCase() !== 'false'; }
function donationRazorpayKeys_() {
  var p = props_(), key = p.getProperty('RAZORPAY_KEY_ID') || '', secret = p.getProperty('RAZORPAY_KEY_SECRET') || '';
  return key.indexOf('rzp_' + razorpayMode_() + '_') === 0 && secret.length >= 16 ? { key: key, secret: secret } : null;
}
function donationAmount_(value, currency) {
  var n = Number(value), lim = DONATION_LIMITS_[currency];
  if (!lim || !isFinite(n) || Math.round(n * 100) !== n * 100 && Math.abs(Math.round(n * 100) - n * 100) > 1e-6) throw commerceError_('amount', 'Enter an amount with at most two decimals.');
  if (n < lim.min || n > lim.max) throw commerceError_('amount', 'Please give between ' + lim.min + ' and ' + lim.max + ' ' + currency + '.');
  return Math.round(n * 100); // minor units (cents / paise)
}
function donationText_(value, n) { return clip_(value, n).replace(/[<>]/g, '').trim(); }
function donationRate_(key, limit, seconds) {
  var cache = CacheService.getScriptCache(), used = Number(cache.get(key) || 0);
  if (used >= limit) throw commerceError_('limit', 'Too many attempts. Please try again in a little while.');
  cache.put(key, String(used + 1), seconds);
}

function handleDonation_(d) {
  try {
    if (!donationsOn_()) return { ok: false, error: 'closed', message: 'Donations are paused right now. Thank you for thinking of it!' };
    var step = String(d.step || '');
    if (step === 'config') return { ok: true, inr: !!donationRazorpayKeys_(), limits: DONATION_LIMITS_ };
    if (step === 'rzp-order') return donationRazorpayOrder_(d);
    if (step === 'rzp-verify') return donationRazorpayVerify_(d);
    if (step === 'paypal-verify') return donationPayPalVerify_(d);
    return { ok: false, error: 'step' };
  } catch (err) {
    var code = (err && err.code) || 'unavailable';
    var friendly = ['amount', 'limit', 'closed', 'verify', 'mode'].indexOf(code) >= 0 ? err.message : 'We could not complete that just now. If you were charged, please contact support with the time of payment.';
    return { ok: false, error: code, message: friendly };
  }
}

/* ---- India: Razorpay in INR ---- */
function donationRazorpayOrder_(d) {
  var keys = donationRazorpayKeys_();
  if (!keys) throw commerceError_('unavailable', 'Rupee donations are not switched on yet.');
  donationRate_('don:orders', 60, 3600);
  var paise = donationAmount_(d.amount, 'INR');
  var order = razorpayApi_('/orders', 'post', {
    amount: paise, currency: 'INR', receipt: 'don_' + Utilities.getUuid().slice(0, 12),
    notes: { type: 'donation', name: donationText_(d.name, 40) }
  });
  return { ok: true, orderId: order.id, keyId: keys.key, amount: order.amount, currency: 'INR', mode: razorpayMode_() };
}
function donationHex_(bytes) { return bytes.map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join(''); }
function donationSame_(a, b) { a = String(a); b = String(b); if (a.length !== b.length) return false; var r = 0; for (var i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; }
function donationRazorpayVerify_(d) {
  var keys = donationRazorpayKeys_();
  if (!keys) throw commerceError_('unavailable', 'Rupee donations are not switched on yet.');
  var orderId = String(d.orderId || ''), paymentId = String(d.paymentId || ''), signature = String(d.signature || '');
  if (!/^order_[A-Za-z0-9]{8,40}$/.test(orderId) || !/^pay_[A-Za-z0-9]{8,40}$/.test(paymentId) || !/^[a-f0-9]{64}$/.test(signature)) throw commerceError_('verify', 'That payment could not be confirmed.');
  var expected = donationHex_(Utilities.computeHmacSha256Signature(orderId + '|' + paymentId, keys.secret));
  if (!donationSame_(expected, signature)) throw commerceError_('verify', 'That payment could not be confirmed.');
  var order = razorpayApi_('/orders/' + orderId, 'get'), payment = razorpayApi_('/payments/' + paymentId, 'get');
  if (!order.notes || order.notes.type !== 'donation' || payment.order_id !== orderId || payment.currency !== 'INR' || payment.amount !== order.amount) throw commerceError_('verify', 'That payment could not be confirmed.');
  if (payment.status === 'authorized') payment = razorpayApi_('/payments/' + paymentId + '/capture', 'post', { amount: payment.amount, currency: 'INR' });
  if (payment.status !== 'captured') throw commerceError_('verify', 'That payment has not completed yet.');
  var amount = payment.amount / 100, name = donationText_(d.name, 40) || donationText_(order.notes.name, 40);
  var fresh = donationRecord_({ provider: 'Razorpay', mode: razorpayMode_() === 'live' ? 'Live' : 'Test', amount: amount, currency: 'INR', name: name, message: donationText_(d.message, 200), email: payment.email || '', paymentId: paymentId, orderId: orderId });
  return { ok: true, amount: amount, currency: 'INR', name: name, firstTime: fresh };
}

/* ---- Everywhere: PayPal in USD ---- */
function donationPayPalVerify_(d) {
  var orderId = String(d.orderId || '');
  if (!/^[A-Z0-9]{10,24}$/.test(orderId)) throw commerceError_('verify', 'That payment could not be confirmed.');
  var t = token_();
  if (!t) throw commerceError_('unavailable', 'PayPal is not connected.');
  var response = UrlFetchApp.fetch(base_() + '/v2/checkout/orders/' + orderId, { method: 'get', muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + t } });
  if (response.getResponseCode() !== 200) throw commerceError_('verify', 'That payment could not be confirmed.');
  var order = JSON.parse(response.getContentText()), unit = (order.purchase_units || [])[0] || {};
  var capture = ((unit.payments || {}).captures || [])[0] || {};
  if (order.status !== 'COMPLETED' || capture.status !== 'COMPLETED' || !capture.amount || capture.amount.currency_code !== 'USD') throw commerceError_('verify', 'That payment has not completed yet.');
  if (String(unit.custom_id || '') !== 'coffee') throw commerceError_('verify', 'That payment could not be confirmed.');
  var amount = Number(capture.amount.value), payer = order.payer || {};
  if (!isFinite(amount) || amount < DONATION_LIMITS_.USD.min || amount > DONATION_LIMITS_.USD.max) throw commerceError_('verify', 'That payment could not be confirmed.');
  var name = donationText_(d.name, 40) || donationText_(((payer.name || {}).given_name) || '', 40);
  var fresh = donationRecord_({ provider: 'PayPal', mode: mode_() === 'live' ? 'Live' : 'Test', amount: amount, currency: 'USD', name: name, message: donationText_(d.message, 200), email: payer.email_address || '', paymentId: capture.id || '', orderId: orderId });
  return { ok: true, amount: amount, currency: 'USD', name: name, firstTime: fresh };
}

/* One row per payment in the "Donations" tab, plus a short email to you. Returns false when the payment was already recorded. */
function donationRecord_(r) {
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet(), sheet = ss.getSheetByName(DONATIONS_SHEET_);
    if (!sheet) {
      sheet = ss.insertSheet(DONATIONS_SHEET_);
      sheet.appendRow(['Date', 'Provider', 'Mode', 'Amount', 'Currency', 'Name', 'Message', 'Payer email', 'Payment ID', 'Order ID']);
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, 10).setBackground('#1a2959').setFontColor('#ffffff').setFontWeight('bold').setVerticalAlignment('middle');
      sheet.setRowHeight(1, 32);
      sheet.getRange(2, 1, 998, 1).setNumberFormat('dd mmm yyyy, hh:mm');
      sheet.getRange(2, 4, 998, 1).setNumberFormat('#,##0.00');
      [150, 90, 70, 90, 80, 150, 320, 220, 220, 220].forEach(function (w, i) { sheet.setColumnWidth(i + 1, w); });
      sheet.setTabColor('#f2994a');
    }
    var last = sheet.getLastRow();
    if (last >= 2 && sheet.getRange(2, 9, last - 1, 1).getValues().some(function (x) { return String(x[0]) === String(r.paymentId); })) return false;
    sheet.appendRow([new Date(), r.provider, r.mode, r.amount, r.currency, r.name, r.message, r.email, r.paymentId, r.orderId].map(safeSheetCell_));
    try {
      MailApp.sendEmail({ to: ownerEmail_(), name: 'Wrapline donations', subject: 'A coffee for you: ' + r.currency + ' ' + r.amount.toFixed(2) + (r.name ? ' from ' + r.name : ''),
        body: (r.mode === 'Test' ? '(Test payment)\n\n' : '') + (r.name || 'Someone') + ' bought you a coffee.\n\nAmount: ' + r.currency + ' ' + r.amount.toFixed(2) + ' via ' + r.provider + '\nMessage: ' + (r.message || '-') + '\nEmail: ' + (r.email || '-') + '\n\nIt is also in the Donations tab of your sheet.' });
    } catch (err) { /* the row is saved even if the email cannot be sent */ }
    return true;
  } finally { lock.releaseLock(); }
}
