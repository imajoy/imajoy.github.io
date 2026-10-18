/* Ajoy Tools: one Google Apps Script for the website.
   1) Download page: saves emails into the "Sheet1" tab (overwrite repeats).
   2) Orders: after a PayPal subscription, checks it with PayPal, logs it in the "Orders" tab,
      emails the buyer a confirmation and emails you a "send the license" reminder.
   3) setupPlans(): run once to create the 12 regional PayPal plans.
   Secrets live ONLY in Project Settings > Script properties:
      PAYPAL_MODE = sandbox (or live)
      PAYPAL_CLIENT_ID, PAYPAL_SECRET   (the matching pair for that mode)
   Never paste the PayPal Secret into this file. */
var SHEET_NAME = 'Sheet1';
var ORDERS_SHEET = 'Orders';
var OWNER_REPLY = 'contactmy3dart@gmail.com';

function props_() { return PropertiesService.getScriptProperties(); }
function mode_() { return props_().getProperty('PAYPAL_MODE') === 'live' ? 'live' : 'sandbox'; }
function base_() { return mode_() === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com'; }

function doPost(e) {
  var out = ContentService.createTextOutput();
  try {
    var raw = (e && e.postData && e.postData.contents) || '';
    var data = {};
    try { data = JSON.parse(raw); } catch (err) { data = { email: (e && e.parameter && e.parameter.email) || '' }; }
    if (data.type === 'order') return out.setContent(handleOrder_(data));
    return out.setContent(saveLead_(String(data.email || '')));
  } catch (err) {
    return out.setContent('error');
  }
}

function doGet() { return ContentService.createTextOutput('Ajoy Tools service is running.'); }

/* ---------- 1) download-page emails ---------- */
function saveLead_(email) {
  email = email.trim().toLowerCase();
  var ok = email.length <= 120 && /^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.(com|in)$/.test(email);
  if (!ok) return 'invalid';
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    var last = sheet.getLastRow(), now = new Date(), row = 0;
    if (last >= 2) {
      var emails = sheet.getRange(2, 2, last - 1, 1).getValues();
      for (var i = 0; i < emails.length; i++) {
        if (String(emails[i][0]).trim().toLowerCase() === email) { row = i + 2; break; }
      }
    }
    if (row) sheet.getRange(row, 1, 1, 2).setValues([[now, email]]);
    else sheet.appendRow([now, email]);
  } finally { lock.releaseLock(); }
  return 'ok';
}

/* ---------- 2) orders ---------- */
/* Keep these lists the same as js/regions.js. Used only to spot buyers who paid a cheaper regional price. */
var LOW_ = 'PK BD NP LK EG NG KE GH ET TZ UG ZM ZW SN CM MM KH LA AF'.split(' ');
var MID_ = 'ID PH VN BR MX ZA TR TH MY CO AR CL PE UA RS KZ GE AM AZ MA TN DZ JO LB EC DO CR PA GT CN UZ MN JM'.split(' ');
var CLOSED_ = 'IN AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE GB NO IS LI RU BY IR KP SY CU'.split(' ');
var RANK_ = { low: 0, mid: 1, high: 2 };
function tierFor_(c) { return LOW_.indexOf(c) >= 0 ? 'low' : MID_.indexOf(c) >= 0 ? 'mid' : 'high'; }
function planTier_(planId) {
  var saved = props_().getProperty('PLANS_' + mode_());
  if (!saved || !planId) return '';
  var tiers = (JSON.parse(saved).tiers) || {};
  for (var t in tiers) for (var k in tiers[t]) for (var p in tiers[t][k]) if (tiers[t][k][p] === planId) return t;
  return '';
}
/* Best effort: PayPal does not always tell us the buyer's country right after approval. */
function payerCountry_(s, t, subId) {
  try {
    var a = s.subscriber && s.subscriber.shipping_address && s.subscriber.shipping_address.address;
    if (a && a.country_code) return String(a.country_code).toUpperCase();
    var now = new Date(), from = new Date(now.getTime() - 2 * 86400000), to = new Date(now.getTime() + 86400000);
    var r = UrlFetchApp.fetch(base_() + '/v1/billing/subscriptions/' + encodeURIComponent(subId) + '/transactions?start_time=' + from.toISOString() + '&end_time=' + to.toISOString(),
      { muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + t } });
    if (r.getResponseCode() === 200) {
      var tx = (JSON.parse(r.getContentText()).transactions || [])[0] || {};
      var pi = tx.payer_info || {};
      var cc = pi.country_code || (pi.address && pi.address.country_code) || '';
      if (cc) return String(cc).toUpperCase();
    }
  } catch (err) { /* unknown */ }
  return '';
}
/* Returns a list of plain-language warnings (empty when everything lines up). */
function priceFlags_(paidTier, chosen, detected, payer) {
  var flags = [];
  if (!paidTier) paidTier = tierFor_(chosen);
  [['connection', detected], ['PayPal account', payer]].forEach(function (x) {
    var c = x[1];
    if (!c) return;
    if (CLOSED_.indexOf(c) >= 0) flags.push('The ' + x[0] + ' country is ' + c + ', a region that is closed for now.');
    else if (RANK_[tierFor_(c)] > RANK_[paidTier]) flags.push('The ' + x[0] + ' country is ' + c + ' (' + tierFor_(c) + ' price) but the plan paid is the ' + paidTier + ' price.');
  });
  return flags;
}
function token_() {
  var p = props_(), id = p.getProperty('PAYPAL_CLIENT_ID'), secret = p.getProperty('PAYPAL_SECRET');
  if (!id || !secret) return '';
  var r = UrlFetchApp.fetch(base_() + '/v1/oauth2/token', {
    method: 'post', payload: 'grant_type=client_credentials', muteHttpExceptions: true,
    headers: { Authorization: 'Basic ' + Utilities.base64Encode(id + ':' + secret) }
  });
  if (r.getResponseCode() !== 200) return '';
  return JSON.parse(r.getContentText()).access_token || '';
}

function esc_(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function clip_(s, n) { return String(s == null ? '' : s).replace(/[\r\n]+/g, ' ').slice(0, n); }

function handleOrder_(d) {
  var subId = String(d.subscriptionId || '');
  if (!/^I-[A-Z0-9]{6,40}$/.test(subId)) return 'invalid';
  var email = clip_(d.email, 120).trim().toLowerCase();
  var validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);

  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(ORDERS_SHEET);
    if (!sheet) {
      sheet = ss.insertSheet(ORDERS_SHEET);
      sheet.appendRow(['Time', 'Subscription ID', 'PayPal status', 'Mode', 'Buyer email', 'Name', 'Billing country', 'Plan', 'Billing', 'Licenses', 'Company', 'PayPal plan ID', 'Detected country', 'PayPal country', 'Price check', 'License sent? (you fill)', 'Email status']);
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, 17).setBackground('#1a2959').setFontColor('#ffffff').setFontWeight('bold').setVerticalAlignment('middle');
      sheet.setRowHeight(1, 32);
      sheet.getRange(2, 1, 998, 1).setNumberFormat('dd mmm yyyy, hh:mm');
      [150, 230, 110, 70, 220, 150, 100, 70, 80, 70, 150, 230, 110, 110, 90, 150, 260].forEach(function (w, i) { sheet.setColumnWidth(i + 1, w); });
      sheet.setTabColor('#c0392b');
    }
    var last = sheet.getLastRow();
    if (last >= 2) {
      var ids = sheet.getRange(2, 2, last - 1, 1).getValues();
      for (var i = 0; i < ids.length; i++) if (ids[i][0] === subId) return 'duplicate';
    }
    var status = 'UNVERIFIED', planId = '', paypalEmail = '', payer = '';
    var t = token_();
    if (t) {
      var r = UrlFetchApp.fetch(base_() + '/v1/billing/subscriptions/' + encodeURIComponent(subId), {
        muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + t }
      });
      if (r.getResponseCode() === 200) {
        var s = JSON.parse(r.getContentText());
        status = s.status || 'UNKNOWN'; planId = s.plan_id || '';
        paypalEmail = (s.subscriber && s.subscriber.email_address) || '';
        payer = payerCountry_(s, t, subId);
      } else { status = 'NOT_FOUND'; }
    }
    var verified = status === 'ACTIVE' || status === 'APPROVED';
    var detected = clip_(d.detectedCountry, 2).toUpperCase();
    var emailLog = [];
    var flags = priceFlags_(planTier_(planId), clip_(d.country, 2).toUpperCase(), detected, payer);
    if (detected && detected !== clip_(d.country, 2).toUpperCase() && flags.length === 0) flags.push('Billing country (' + clip_(d.country, 2) + ') differs from the connection country (' + detected + '), but the price is not lower.');
    sheet.appendRow([new Date(), subId, status, mode_(), email, clip_(d.name, 80), clip_(d.country, 2), clip_(d.plan, 10), clip_(d.billing, 10), Number(d.seats) || 1, clip_(d.company, 80), planId, detected, payer, flags.length ? 'CHECK' : 'ok', '', '']);
    var orderRow = sheet.getLastRow();

    var test = mode_() !== 'live';
    var planText = 'Ajoy Tools ' + (d.plan === 'offline' ? 'Offline' : 'Online') + ' · ' + (d.billing === 'yearly' ? 'Yearly' : 'Monthly') + ' · ' + (Number(d.seats) || 1) + ' license(s)';
    var tag = test ? '[TEST] ' : '';
    var owner = Session.getEffectiveUser().getEmail();

    /* You always get a reminder, even if the order could not be verified. */
    try { MailApp.sendEmail({
      to: owner, name: 'Ajoy Tools orders',
      subject: tag + (flags.length && verified ? 'CHECK PRICE, then send the license key' : verified ? 'New order: send the license key' : 'CHECK THIS ORDER (' + status + ')'),
      body: 'Plan: ' + planText + '\nSubscription ID: ' + subId + '\nPayPal status: ' + status + '\nBuyer email (form): ' + email + '\nPayPal email: ' + paypalEmail +
        '\nName: ' + clip_(d.name, 80) + '\nBilling country: ' + clip_(d.country, 2) + '\nConnection country: ' + (detected || 'unknown') + '\nPayPal buyer country: ' + (payer || 'not reported (check the payment in PayPal > Activity)') + '\nCompany: ' + clip_(d.company, 80) +
        (flags.length ? '\n\nPRICE CHECK NEEDED BEFORE YOU SEND THE KEY:\n- ' + flags.join('\n- ') + '\nIf the buyer is not in the region of the price they paid, cancel the subscription in PayPal or ask them to subscribe again at the right price.' : '') + '\n\nPromise made to the buyer: license key within 12 hours.\nMark "License sent?" in the Orders tab when done.'
    }); emailLog.push('owner: sent'); } catch (err) { emailLog.push('owner FAILED: ' + String(err).slice(0, 120)); }

    /* The buyer only gets a confirmation when PayPal confirms the subscription. */
    if (verified && validEmail) {
      var name = clip_(d.name, 80) || 'there';
      var html = '<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#14182a">' +
        '<h2 style="margin:0 0 12px">Thank you, ' + esc_(name) + '.</h2>' +
        '<p>Your Ajoy Tools subscription is confirmed.</p>' +
        '<table style="border-collapse:collapse;width:100%;margin:14px 0"><tr><td style="padding:8px 0;color:#667">Plan</td><td style="text-align:right"><b>' + esc_(planText) + '</b></td></tr>' +
        '<tr><td style="padding:8px 0;color:#667;border-top:1px solid #e3e6ee">Subscription ID</td><td style="text-align:right;border-top:1px solid #e3e6ee"><b>' + esc_(subId) + '</b></td></tr></table>' +
        '<p><b>Your license key will arrive within 12 hours</b> at this email address.</p>' +
        '<p>Questions? Reply to this email or write to ' + OWNER_REPLY + '.</p>' +
        '<p style="color:#667;font-size:13px">Ajoy Tools: production tools for Maya.</p></div>';
      try { MailApp.sendEmail({ to: email, name: 'Ajoy Tools', replyTo: OWNER_REPLY, subject: tag + 'Your Ajoy Tools order is confirmed', htmlBody: html,
        body: 'Thank you. Your Ajoy Tools subscription is confirmed.\nPlan: ' + planText + '\nSubscription ID: ' + subId + '\nYour license key will arrive within 12 hours at this email address.\nQuestions? ' + OWNER_REPLY }); emailLog.push('buyer: sent'); } catch (err) { emailLog.push('buyer FAILED: ' + String(err).slice(0, 120)); }
    } else { emailLog.push('buyer: skipped (' + (verified ? 'bad email' : 'not verified') + ')'); }
    sheet.getRange(orderRow, 17).setValue(emailLog.join(' | '));
    return verified ? 'ok' : 'unverified';
  } finally { lock.releaseLock(); }
}

/* ---------- 3) one-time plan creation ----------
   Run setupPlans from the editor (select it, click Run). It creates 12 USD plans:
   3 regional tiers x Online/Offline x Monthly/Yearly, and writes the result to a "Plans" tab.
   Copy the single JSON cell from that tab into the Supabase secret PAYPAL_PLANS. */
var PRICES = {
  high: { online: { monthly: 22, yearly: 211 }, offline: { monthly: 44, yearly: 422 } },
  mid:  { online: { monthly: 14, yearly: 134 }, offline: { monthly: 28, yearly: 269 } },
  low:  { online: { monthly: 9,  yearly: 86  }, offline: { monthly: 18, yearly: 173 } }
};

function paypalPost_(path, body, t, reqId) {
  var r = UrlFetchApp.fetch(base_() + path, {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true, payload: JSON.stringify(body),
    headers: { Authorization: 'Bearer ' + t, 'PayPal-Request-Id': reqId, Prefer: 'return=representation' }
  });
  var code = r.getResponseCode();
  if (code < 200 || code > 299) throw new Error(path + ' failed (' + code + '): ' + r.getContentText().slice(0, 300));
  return JSON.parse(r.getContentText());
}

function setupPlans() {
  var t = token_();
  if (!t) throw new Error('Add PAYPAL_CLIENT_ID, PAYPAL_SECRET and PAYPAL_MODE in Project Settings > Script properties first.');
  var key = 'PLANS_' + mode_(), saved = props_().getProperty(key);
  var result = saved ? JSON.parse(saved) : { tiers: {} };
  var productId = result.productId;
  if (!productId) {
    productId = paypalPost_('/v1/catalogs/products', { name: 'Ajoy Tools', description: 'Production tools for Maya.', type: 'DIGITAL', category: 'SOFTWARE', home_url: 'https://imajoy.github.io/' }, t, 'ajoy-product-' + mode_()).id;
    result.productId = productId;
  }
  ['high', 'mid', 'low'].forEach(function (tier) {
    result.tiers[tier] = result.tiers[tier] || {};
    ['online', 'offline'].forEach(function (kind) {
      result.tiers[tier][kind] = result.tiers[tier][kind] || {};
      ['monthly', 'yearly'].forEach(function (period) {
        if (result.tiers[tier][kind][period]) return;
        var plan = paypalPost_('/v1/billing/plans', {
          product_id: productId,
          name: 'Ajoy Tools ' + kind + ' ' + period + ' (' + tier + ')',
          description: 'Ajoy Tools ' + kind + ' license, billed ' + period + '.',
          status: 'ACTIVE',
          billing_cycles: [{ frequency: { interval_unit: period === 'yearly' ? 'YEAR' : 'MONTH', interval_count: 1 }, tenure_type: 'REGULAR', sequence: 1, total_cycles: 0,
            pricing_scheme: { fixed_price: { value: String(PRICES[tier][kind][period]), currency_code: 'USD' } } }],
          payment_preferences: { auto_bill_outstanding: true, setup_fee_failure_action: 'CONTINUE', payment_failure_threshold: 3 },
          quantity_supported: true
        }, t, 'ajoy-plan-' + mode_() + '-' + tier + '-' + kind + '-' + period);
        result.tiers[tier][kind][period] = plan.id;
        props_().setProperty(key, JSON.stringify(result));
      });
    });
  });
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('Plans') || ss.insertSheet('Plans');
  sh.clear();
  var labels = { high: 'High (US, Canada, Australia, Gulf...)', mid: 'Mid (Brazil, Mexico, Indonesia, Philippines...)', low: 'Low (Sri Lanka, Egypt, Nigeria, Kenya...)' };
  var rows = [];
  ['high', 'mid', 'low'].forEach(function (tier) {
    ['online', 'offline'].forEach(function (kind) {
      ['monthly', 'yearly'].forEach(function (period) {
        rows.push([labels[tier], kind === 'online' ? 'Online' : 'Offline', period === 'yearly' ? 'Yearly' : 'Monthly', PRICES[tier][kind][period], result.tiers[tier][kind][period]]);
      });
    });
  });
  var json = JSON.stringify({ tiers: result.tiers });
  sh.getRange(1, 1).setValue('Ajoy Tools: PayPal plans').setFontWeight('bold').setFontSize(16);
  sh.getRange(2, 1).setValue('Mode: ' + mode_() + '. Created by the setupPlans script. Prices are USD per computer.').setFontStyle('italic').setFontColor('#666673');
  sh.getRange(4, 1, 1, 5).setValues([['Price level', 'Plan', 'Billing', 'Price (USD)', 'PayPal plan ID']]).setBackground('#1a2959').setFontColor('#ffffff').setFontWeight('bold').setVerticalAlignment('middle');
  sh.getRange(5, 1, rows.length, 5).setValues(rows);
  [5, 13].forEach(function (r) { sh.getRange(r, 1, 4, 5).setBackground('#edf5ff'); });
  sh.getRange(4, 4, 13, 1).setHorizontalAlignment('right');
  sh.getRange(5, 4, 12, 1).setNumberFormat('$#,##0');
  sh.getRange(5, 5, 12, 1).setFontFamily('Roboto Mono').setFontSize(10);
  sh.getRange(18, 1).setValue('Copy the cell below into Supabase > Edge Functions > Secrets > PAYPAL_PLANS.').setFontStyle('italic').setFontColor('#666673');
  sh.getRange(19, 1).setValue(json).setFontFamily('Roboto Mono').setFontSize(9).setBackground('#f5f5f5').setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP);
  [330, 90, 90, 100, 260].forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
  sh.setRowHeight(4, 32); sh.setFrozenRows(4); sh.setHiddenGridlines(true); sh.setTabColor('#1a2959');
  Logger.log(json);
}

/* Run this once from the editor (select testEmail, click Run) to check that email sending is allowed.
   You should receive "Ajoy Tools test email" within a minute. */
function testEmail() {
  var to = Session.getEffectiveUser().getEmail();
  MailApp.sendEmail({ to: to, subject: 'Ajoy Tools test email', body: 'If you can read this, the order emails can be sent. Remaining daily email quota: ' + MailApp.getRemainingDailyQuota() });
  Logger.log('Sent to ' + to);
}
