/* Ajoy Tools: one Google Apps Script for the website.
   1) Verified email registration and account sessions use the "Accounts" tab.
   2) Commerce.gs privately manages checkout/trial eligibility and protected downloads.
      Orders: after a verified PayPal subscription, logs it in the "Orders" tab,
      emails the buyer a confirmation and emails you a "send the license" reminder.
   3) setupPlans(): run once to create the regional standard and trial PayPal plans.
   Secrets live ONLY in Project Settings > Script properties:
      PAYPAL_MODE = sandbox (or live)
      PAYPAL_CLIENT_ID, PAYPAL_SECRET   (the matching pair for that mode)
   Never paste the PayPal Secret into this file. */
var SHEET_NAME = 'Sheet1';
var ORDERS_SHEET = 'Orders';
var DEFAULT_REPLY = 'contactmy3dart@gmail.com';
/* Optional Script properties: OWNER_EMAIL = where YOUR order reminders go (default: the Google account that owns this script);
   REPLY_TO = the address buyers see and can reply to (default below). */
function ownerEmail_() { return props_().getProperty('OWNER_EMAIL') || Session.getEffectiveUser().getEmail(); }
function replyTo_() { return props_().getProperty('REPLY_TO') || DEFAULT_REPLY; }

function props_() { return PropertiesService.getScriptProperties(); }
function mode_() { return props_().getProperty('PAYPAL_MODE') === 'live' ? 'live' : 'sandbox'; }
function base_() { return mode_() === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com'; }

function doPost(e) {
  var out = ContentService.createTextOutput();
  try {
    var raw = (e && e.postData && e.postData.contents) || '';
    var data = {};
    try { data = JSON.parse(raw); } catch (err) { data = { email: (e && e.parameter && e.parameter.email) || '' }; }
    if (data.type === 'commerce') { out.setMimeType(ContentService.MimeType.JSON); return out.setContent(JSON.stringify(handleCommerceEnvelope_(data))); }
    if (data.type === 'order') { out.setMimeType(ContentService.MimeType.JSON); return out.setContent(JSON.stringify({ r: 'secure_checkout_required' })); }
    if (data.type === 'trial') return out.setContent('secure_checkout_required');
    if (data.type === 'account') { out.setMimeType(ContentService.MimeType.JSON); return out.setContent(JSON.stringify(handleAccount_(data))); }
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
  var reward=rewardPlanInfo_(planId);
  return reward?reward.tier:'';
}
/* True when this PayPal plan is one of the 2-day-trial plans (Online only). */
function isTrialPlan_(planId) {
  var saved = props_().getProperty('PLANS_' + mode_());
  if (!saved || !planId) return false;
  var tiers = (JSON.parse(saved).tiers) || {};
  for (var t in tiers) { var o = tiers[t].onlineTrial || {}; if (o.monthly === planId || o.yearly === planId) return true; }
  return false;
}
/* Has this email (or PayPal email) been in the Orders tab before? Used to spot repeat free trials. */
function seenBefore_(sheet, emails, subId) {
  var last = sheet.getLastRow();
  if (last < 2) return false;
  var rows = sheet.getRange(2, 1, last - 1, 5).getValues();
  for (var i = 0; i < rows.length; i++) {
    if (rows[i][1] === subId) continue;
    var e = String(rows[i][4]).trim().toLowerCase();
    if (e && emails.indexOf(e) >= 0) return true;
  }
  return false;
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
  // Reuse the PayPal access token (valid for hours) instead of logging in again for every call.
  var cache = CacheService.getScriptCache(), key = 'pp:' + mode_() + ':' + id.slice(-12);
  var saved = cache.get(key); if (saved) return saved;
  var r = UrlFetchApp.fetch(base_() + '/v1/oauth2/token', {
    method: 'post', payload: 'grant_type=client_credentials', muteHttpExceptions: true,
    headers: { Authorization: 'Basic ' + Utilities.base64Encode(id + ':' + secret) }
  });
  if (r.getResponseCode() !== 200) return '';
  var data = JSON.parse(r.getContentText()), token = data.access_token || '';
  if (token) cache.put(key, token, Math.max(60, Math.min(21600, (Number(data.expires_in) || 3600) - 300)));
  return token;
}

function esc_(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function clip_(s, n) { return String(s == null ? '' : s).replace(/[\r\n]+/g, ' ').slice(0, n); }

/* A subscription ID is not proof of identity. Only an existing verified session
   can remain signed in after an order; new buyers verify their email with a code. */
function orderReply_(result, d) {
  var out = { r: String(result) };
  if (result !== 'ok' && result !== 'duplicate') return out;
  var email = clip_(d.email, 120).trim().toLowerCase();
  if (d.accountToken) {
    var who = readSession_(d.accountToken);
    if (!who) return { r: 'account_expired' };
    out.token = d.accountToken; out.email = who.email; out.expiresAt = who.expiresAt; out.limited = !!who.sub;
  } else {
    out.email = email; out.requiresVerification = true;
  }
  return out;
}

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
    var trial = isTrialPlan_(planId);
    var detected = clip_(d.detectedCountry, 2).toUpperCase();
    var emailLog = [];
    var flags = priceFlags_(planTier_(planId), clip_(d.country, 2).toUpperCase(), detected, payer);
    if (detected && detected !== clip_(d.country, 2).toUpperCase() && flags.length === 0) flags.push('Billing country (' + clip_(d.country, 2) + ') differs from the connection country (' + detected + '), but the price is not lower.');
    if (trial && [email, String(paypalEmail).toLowerCase()].filter(Boolean).some(function(e){return commerceHistoricalTrial_(e);})) flags.push('REPEAT FREE TRIAL: this email already has an earlier order. Consider cancelling this subscription in PayPal.');
    sheet.appendRow([new Date(), subId, status, mode_(), email, clip_(d.name, 80), clip_(d.country, 2), clip_(d.plan, 10) + (trial ? ' (2-day trial)' : ''), clip_(d.billing, 10), Number(d.seats) || 1, clip_(d.company, 80), planId, detected, payer, flags.length ? 'CHECK' : 'ok', '', ''].map(safeSheetCell_));
    var orderRow = sheet.getLastRow();

    var test = mode_() !== 'live';
    var planText = 'Ajoy Tools ' + (d.plan === 'offline' ? 'Offline' : 'Online') + ' · ' + (d.billing === 'yearly' ? 'Yearly' : 'Monthly') + ' · ' + (Number(d.seats) || 1) + ' license(s)' + (trial ? ' · 2-day free trial, then billed automatically' : '');
    var tag = test ? '[TEST] ' : '';
    var owner = ownerEmail_();

    /* You always get a reminder, even if the order could not be verified. */
    try { MailApp.sendEmail({
      to: owner, name: 'Ajoy Tools orders',
      subject: tag + (flags.length && verified ? 'CHECK PRICE, then send the license key' : verified ? 'New order: send the license key' : 'CHECK THIS ORDER (' + status + ')'),
      body: 'Plan: ' + planText + '\nSubscription ID: ' + subId + '\nPayPal status: ' + status + '\nBuyer email (form): ' + email + '\nPayPal email: ' + paypalEmail +
        '\nName: ' + clip_(d.name, 80) + '\nBilling country: ' + clip_(d.country, 2) + '\nConnection country: ' + (detected || 'unknown') + '\nPayPal buyer country: ' + (payer || 'not reported (check the payment in PayPal > Activity)') + '\nCompany: ' + clip_(d.company, 80) +
        (flags.length ? '\n\nPRICE CHECK NEEDED BEFORE YOU SEND THE KEY:\n- ' + flags.join('\n- ') + '\nIf the buyer is not in the region of the price they paid, cancel the subscription in PayPal or ask them to subscribe again at the right price.' : '') + (trial ? '\n\nFREE TRIAL: send a license that works for the trial. The first payment is taken automatically after 2 days unless the buyer cancels in PayPal.' : '') + '\n\nPromise made to the buyer: license key within 12 hours.\nMark "License sent?" in the Orders tab when done.'
    }); emailLog.push('owner: sent'); } catch (err) { emailLog.push('owner FAILED: ' + String(err).slice(0, 120)); }

    /* The buyer only gets a confirmation when PayPal confirms the subscription. */
    if (verified && validEmail) {
      var name = clip_(d.name, 80) || 'there';
      var html = '<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#14182a">' +
        '<h2 style="margin:0 0 12px">Thank you, ' + esc_(name) + '.</h2>' +
        '<p>Your Ajoy Tools subscription is confirmed.</p>' +
        '<table style="border-collapse:collapse;width:100%;margin:14px 0"><tr><td style="padding:8px 0;color:#667">Plan</td><td style="text-align:right"><b>' + esc_(planText) + '</b></td></tr>' +
        '<tr><td style="padding:8px 0;color:#667;border-top:1px solid #e3e6ee">Subscription ID</td><td style="text-align:right;border-top:1px solid #e3e6ee"><b>' + esc_(subId) + '</b></td></tr></table>' +
        (trial ? '<p><b>Your 2-day free trial has started.</b> Your first payment is taken automatically when it ends, unless you cancel before then in PayPal. You can cancel any time.</p>' : '') +
        '<p><b>Your license key will arrive within 12 hours</b> at this email address.</p>' +
        '<p>Questions? Reply to this email or write to ' + replyTo_() + '.</p>' +
        '<p style="color:#667;font-size:13px">Ajoy Tools: production tools for Maya.</p></div>';
      try { MailApp.sendEmail({ to: email, name: 'Ajoy Tools', replyTo: replyTo_(), subject: tag + 'Your Ajoy Tools order is confirmed', htmlBody: html,
        body: 'Thank you. Your Ajoy Tools subscription is confirmed.\nPlan: ' + planText + '\nSubscription ID: ' + subId + '\nYour license key will arrive within 12 hours at this email address.\nQuestions? ' + replyTo_() }); emailLog.push('buyer: sent'); } catch (err) { emailLog.push('buyer FAILED: ' + String(err).slice(0, 120)); }
    } else { emailLog.push('buyer: skipped (' + (verified ? 'bad email' : 'not verified') + ')'); }
    sheet.getRange(orderRow, 17).setValue(emailLog.join(' | '));
    return verified ? 'ok' : 'unverified';
  } finally { lock.releaseLock(); }
}

/* ---------- 2a) subscriber account (sign in with an emailed code) ----------
   The site calls this with {type:'account', step:'code'|'verify'|'status', ...}.
   step 'code'   : emails a 6-digit code for a registered email or an explicit registration request.
   step 'verify' : checks the code and returns a session token (valid 30 days), without waiting for PayPal.
   step 'identity': verifies a saved token and returns its canonical email, without calling PayPal.
   step 'status' : checks the token and returns the subscription details again.
   Time left and status always come live from PayPal. Nothing here uses IP addresses. */
function sessionSecret_() {
  var p = props_(), k = p.getProperty('SESSION_SECRET');
  if (!k) { k = Utilities.getUuid() + Utilities.getUuid(); p.setProperty('SESSION_SECRET', k); }
  return k;
}
function b64u_(bytes) { return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/, ''); }
function sign_(text) { return b64u_(Utilities.computeHmacSha256Signature(text, sessionSecret_())); }
function makeSession_(email, onlySub) {
  var exp = Date.now() + 30 * 24 * 3600 * 1000, body = b64u_(Utilities.newBlob(email + '|' + exp + (onlySub ? '|' + onlySub : '')).getBytes());
  return body + '.' + sign_(body);
}
/* Returns {email, sub} ('sub' only for a sign-in that is limited to one subscription) or null. */
function readSession_(tok) {
  try {
    tok = String(tok || '');
    if (tok.length > 4096) return null;
    var i = tok.indexOf('.');
    if (i < 1) return null;
    var body = tok.slice(0, i);
    if (sign_(body) !== tok.slice(i + 1)) return null;
    var padded = body + '==='.slice(0, (4 - body.length % 4) % 4);
    var txt = Utilities.newBlob(Utilities.base64DecodeWebSafe(padded)).getDataAsString().split('|');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(txt[0]) || !Number.isFinite(Number(txt[1])) || Number(txt[1]) <= Date.now()) return null;
    return { email: txt[0], sub: txt[2] || '', expiresAt: Number(txt[1]) };
  } catch (err) { return null; }
}

function hashCode_(email, code) { return b64u_(Utilities.computeHmacSha256Signature(email + ':' + code, sessionSecret_())); }
function ordersFor_(email, onlySub) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ORDERS_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 12).getValues(), out = [];
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (String(r[4]).trim().toLowerCase() === email && /^I-/.test(String(r[1])) && r[3] === mode_()) if (!onlySub || String(r[1]) === onlySub) out.push({ id: String(r[1]), plan: String(r[7]).split(' ')[0], billing: String(r[8]), seats: Number(r[9]) || 1, at: r[0] instanceof Date ? r[0] : new Date(r[0]), trialPlan: String(r[7]).indexOf('trial') >= 0 });
  }
  return out;
}
function addPeriod_(d, billing) { var x = new Date(d.getTime()); if (billing === 'yearly') x.setFullYear(x.getFullYear() + 1); else x.setMonth(x.getMonth() + 1); return x; }
function subscriptionsFor_(email, onlySub) {
  var list = ordersFor_(email, onlySub).slice(-5).reverse(), t = token_(), out = [];
  list.forEach(function (o) {
    var item = { plan: o.plan, billing: o.billing, seats: o.seats, status: 'UNKNOWN', endsAt: '', renews: false, trial: false };
    if (t) {
      var r = UrlFetchApp.fetch(base_() + '/v1/billing/subscriptions/' + encodeURIComponent(o.id), { muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + t } });
      if (r.getResponseCode() === 200) {
        var s = JSON.parse(r.getContentText()), b = s.billing_info || {};
        item.status = s.status || 'UNKNOWN';
        var next = b.next_billing_time ? new Date(b.next_billing_time) : null;
        var last = b.last_payment && b.last_payment.time ? new Date(b.last_payment.time) : (s.start_time ? new Date(s.start_time) : null);
        if (item.status === 'ACTIVE' && next) { item.endsAt = next.toISOString(); item.renews = true; item.trial = !!o.trialPlan && o.at && (Date.now() - o.at.getTime()) < 2 * 86400000 + 3600000 * 6; }
        else if (last) { item.endsAt = addPeriod_(last, o.billing).toISOString(); }
      }
    }
    out.push(item);
  });
  return out;
}
/* Accounts are created only after a registration email code has been verified. */
function safeSheetCell_(value) { return typeof value === 'string' && /^[=+@-]/.test(value) ? "'" + value : value; }
function registeredEmail_(email) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Accounts');
  if (sheet && sheet.getLastRow() > 1) {
    var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 3).getValues();
    if (rows.some(function(r) { return String(r[0]).toLowerCase() === email && !!r[1]; })) return true;
  }
  return ordersFor_(email).length > 0;
}
function registerAccount_(email) {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), sheet = ss.getSheetByName('Accounts');
  if (!sheet) { sheet = ss.insertSheet('Accounts'); sheet.appendRow(['Email', 'Verified at', 'Account ID']); sheet.setFrozenRows(1); }
  var rows = sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 3).getValues() : [];
  var existing = rows.filter(function(r) { return String(r[0]).toLowerCase() === email && !!r[1]; })[0];
  if (!existing) sheet.appendRow([email, new Date(), Utilities.getUuid()].map(safeSheetCell_));
}
function handleAccount_(d) {
  var email = clip_(d.email, 120).trim().toLowerCase();
  var step = String(d.step || '');
  if (step === 'status' || step === 'identity') {
    var who = readSession_(d.token);
    if (!who) return { ok: false, error: 'expired' };
    if (!registeredEmail_(who.email)) return { ok: false, error: 'not_registered' };
    var account = { ok: true, email: who.email, limited: !!who.sub, expiresAt: who.expiresAt };
    if (step === 'status') account.subscriptions = subscriptionsFor_(who.email, who.sub);
    return account;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { ok: false, error: 'email' };
  if (step !== 'code' && step !== 'verify') return { ok: false, error: 'step' };
  // Serialize code requests and consumption so a code can be used only once.
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return { ok: false, error: 'busy' };
  try {
    var cache = CacheService.getScriptCache();
    if (step === 'code') {
      var key = 'sends:' + email, n = Number(cache.get(key) || 0);
      if (n >= 5) return { ok: false, error: 'limit' };
      cache.put(key, String(n + 1), 3600);
      // Explicit owner policy: reject an unregistered address before generating or sending a code.
      var registered = registeredEmail_(email);
      var intent = d.intent === 'register' && !registered ? 'register' : 'signin';
      if (!registered && intent !== 'register') return { ok: false, error: 'not_registered', registrationAvailable: true };
      cache.put('intent:' + email, intent, 600);
      var code = String(Math.floor(100000 + Math.random() * 900000));
      cache.put('code:' + email, hashCode_(email, code), 600); cache.remove('tries:' + email);
      try { MailApp.sendEmail({ to: email, name: 'Ajoy Tools', replyTo: replyTo_(), subject: 'Your Ajoy Tools sign-in code: ' + code,
        body: 'Your sign-in code is ' + code + '\n\nIt works for 10 minutes. If you did not ask for it, you can ignore this email.\n\nAjoy Tools' }); }
      catch (err) { cache.remove('code:' + email); return { ok: false, error: 'mail' }; }
      return { ok: true, registered: registered, intent: intent };
    }
    var tk = 'tries:' + email, tries = Number(cache.get(tk) || 0);
    if (tries >= 5) return { ok: false, error: 'limit' };
    cache.put(tk, String(tries + 1), 600);
    var want = cache.get('code:' + email), got = String(d.code || '').trim();
    if (!want || !/^\d{6}$/.test(got) || want !== hashCode_(email, got)) return { ok: false, error: 'code' };
    var intent = cache.get('intent:' + email);
    cache.remove('code:' + email); cache.remove('intent:' + email);
    if (!registeredEmail_(email) && intent !== 'register') return { ok: false, error: 'not_registered' };
    registerAccount_(email);
    var token = makeSession_(email), identity = readSession_(token);
    return { ok: true, email: email, token: token, expiresAt: identity.expiresAt, subscriptions: null };
  } finally { lock.releaseLock(); }
}

/* ---------- 2b) free trial requests ----------
   Logs the request in the "Trials" tab, emails you to create a trial code, and emails the visitor a receipt.
   Trial length comes from the Script property TRIAL_DAYS (default 2). Keep it the same as trialDays in js/site-config.js. */
function handleTrial_(d) {
  if (d.website) return 'ok'; /* hidden field filled in: a bot */
  var email = clip_(d.email, 120).trim().toLowerCase();
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email)) return 'invalid';
  var name = clip_(d.name, 80);
  var days = Number(props_().getProperty('TRIAL_DAYS')) || 2;
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Trials');
    if (!sheet) {
      sheet = ss.insertSheet('Trials');
      sheet.appendRow(['Time', 'Email', 'Name', 'Trial days', 'Code sent? (you fill)', 'Email status']);
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, 6).setBackground('#1a2959').setFontColor('#ffffff').setFontWeight('bold').setVerticalAlignment('middle');
      sheet.setRowHeight(1, 32);
      sheet.getRange(2, 1, 998, 1).setNumberFormat('dd mmm yyyy, hh:mm');
      [150, 240, 140, 90, 160, 260].forEach(function (w, i) { sheet.setColumnWidth(i + 1, w); });
      sheet.setTabColor('#e67e22');
    }
    var last = sheet.getLastRow();
    if (last >= 2) {
      var emails = sheet.getRange(2, 2, last - 1, 1).getValues();
      for (var i = 0; i < emails.length; i++) if (String(emails[i][0]).trim().toLowerCase() === email) return 'duplicate';
    }
    sheet.appendRow([new Date(), email, name, days, '', '']);
    var row = sheet.getLastRow(), log = [];
    try {
      MailApp.sendEmail({ to: ownerEmail_(), name: 'Ajoy Tools trials', subject: 'Trial request: send a ' + days + '-day code to ' + email,
        body: 'Someone asked for a free trial.\n\nEmail: ' + email + '\nName: ' + (name || '-') + '\nTrial length promised: ' + days + ' days\n\nCreate a ' + days + '-day trial code the way you usually create access codes and email it to them. They were told it arrives within 12 hours.\nMark "Code sent?" in the Trials tab when done.' });
      log.push('owner: sent');
    } catch (err) { log.push('owner FAILED: ' + String(err).slice(0, 120)); }
    try {
      MailApp.sendEmail({ to: email, name: 'Ajoy Tools', replyTo: replyTo_(), subject: 'We received your Ajoy Tools trial request',
        body: 'Hi ' + (name || 'there') + ',\n\nThanks for asking to try Ajoy Tools. Your ' + days + '-day trial code will arrive at this email address within 12 hours.\n\nQuestions? Reply to this email or write to ' + replyTo_() + '.\n\nAjoy Tools: production tools for Maya.' });
      log.push('visitor: sent');
    } catch (err) { log.push('visitor FAILED: ' + String(err).slice(0, 120)); }
    sheet.getRange(row, 6).setValue(log.join(' | '));
    return 'ok';
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
  /* Online plans with a 2-day free trial. The buyer approves in PayPal now and is first charged after the trial. */
  ['high', 'mid', 'low'].forEach(function (tier) {
    result.tiers[tier].onlineTrial = result.tiers[tier].onlineTrial || {};
    ['monthly', 'yearly'].forEach(function (period) {
      if (result.tiers[tier].onlineTrial[period]) return;
      var plan = paypalPost_('/v1/billing/plans', {
        product_id: productId,
        name: 'Ajoy Tools online ' + period + ' with 2-day trial (' + tier + ')',
        description: 'Ajoy Tools online license, 2-day free trial, then billed ' + period + '.',
        status: 'ACTIVE',
        billing_cycles: [
          { frequency: { interval_unit: 'DAY', interval_count: 2 }, tenure_type: 'TRIAL', sequence: 1, total_cycles: 1,
            pricing_scheme: { fixed_price: { value: '0', currency_code: 'USD' } } },
          { frequency: { interval_unit: period === 'yearly' ? 'YEAR' : 'MONTH', interval_count: 1 }, tenure_type: 'REGULAR', sequence: 2, total_cycles: 0,
            pricing_scheme: { fixed_price: { value: String(PRICES[tier].online[period]), currency_code: 'USD' } } }
        ],
        payment_preferences: { auto_bill_outstanding: true, setup_fee_failure_action: 'CONTINUE', payment_failure_threshold: 3 },
        quantity_supported: true
      }, t, 'ajoy-plan-' + mode_() + '-' + tier + '-onlinetrial-' + period);
      result.tiers[tier].onlineTrial[period] = plan.id;
      props_().setProperty(key, JSON.stringify(result));
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
  ['high', 'mid', 'low'].forEach(function (tier) {
    ['monthly', 'yearly'].forEach(function (period) {
      rows.push([labels[tier], 'Online + 2-day trial', period === 'yearly' ? 'Yearly' : 'Monthly', PRICES[tier].online[period], result.tiers[tier].onlineTrial[period]]);
    });
  });
  var json = JSON.stringify({ tiers: result.tiers });
  sh.getRange(1, 1).setValue('Ajoy Tools: PayPal plans').setFontWeight('bold').setFontSize(16);
  sh.getRange(2, 1).setValue('Mode: ' + mode_() + '. Created by the setupPlans script. Prices are USD per computer.').setFontStyle('italic').setFontColor('#666673');
  sh.getRange(4, 1, 1, 5).setValues([['Price level', 'Plan', 'Billing', 'Price (USD)', 'PayPal plan ID']]).setBackground('#1a2959').setFontColor('#ffffff').setFontWeight('bold').setVerticalAlignment('middle');
  sh.getRange(5, 1, rows.length, 5).setValues(rows);
  [5, 13, 21].forEach(function (r) { sh.getRange(r, 1, Math.min(4, rows.length + 5 - r), 5).setBackground('#edf5ff'); });
  var n = rows.length, jr = 5 + n + 1;
  sh.getRange(4, 4, n + 1, 1).setHorizontalAlignment('right');
  sh.getRange(5, 4, n, 1).setNumberFormat('$#,##0');
  sh.getRange(5, 5, n, 1).setFontFamily('Roboto Mono').setFontSize(10);
  sh.getRange(jr, 1).setValue('Copy the cell below into Supabase > Edge Functions > Secrets > PAYPAL_PLANS.').setFontStyle('italic').setFontColor('#666673');
  sh.getRange(jr + 1, 1).setValue(json).setFontFamily('Roboto Mono').setFontSize(9).setBackground('#f5f5f5').setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP);
  [330, 90, 90, 100, 260].forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
  sh.setRowHeight(4, 32); sh.setFrozenRows(4); sh.setHiddenGridlines(true); sh.setTabColor('#1a2959');
  Logger.log(json);
}

/* Run this once from the editor (select testEmail, click Run) to check that email sending is allowed.
   You should receive "Ajoy Tools test email" within a minute. */
function testEmail() {
  var to = ownerEmail_();
  MailApp.sendEmail({ to: to, subject: 'Ajoy Tools test email', body: 'If you can read this, the order emails can be sent. Remaining daily email quota: ' + MailApp.getRemainingDailyQuota() });
  Logger.log('Sent to ' + to);
}
