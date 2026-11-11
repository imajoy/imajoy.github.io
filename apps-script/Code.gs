/* Wrapline Pro: one Google Apps Script for the website.
   1) Verified email registration and account sessions use the "Accounts" tab.
   2) Commerce.gs privately manages checkout/trial eligibility and protected downloads.
      Orders: after a verified PayPal subscription, logs it in the "Orders" tab,
      emails the buyer a confirmation and emails you a "send the license" reminder.
   Contact messages are stored privately in the "Contacts" tab.
   3) setupPlans(): run once to create the regional standard and trial PayPal plans.
   Secrets live ONLY in Project Settings > Script properties:
      PAYPAL_MODE = sandbox (or live)
      PAYPAL_CLIENT_ID, PAYPAL_SECRET   (the matching pair for that mode)
   Never paste the PayPal Secret into this file. */
var SHEET_NAME = 'Sheet1';
var ORDERS_SHEET = 'Orders';
/* Optional Script properties: OWNER_EMAIL = where YOUR order reminders go (default: the Google account that owns this script);
   REPLY_TO = the address buyers see and can reply to (default: OWNER_EMAIL, or the script owner's account). */
function ownerEmail_() { return props_().getProperty('OWNER_EMAIL') || Session.getEffectiveUser().getEmail(); }
/* Automatic emails nobody should answer (sign-in codes, welcome). They show as "Wrapline <noreply@wrapline.in>" when that address is
   set up as a "Send mail as" address on the account (Gmail > Settings > Accounts); the sender is the script property SEND_FROM
   (default noreply@wrapline.in). If it is not set up, or sending that way fails, the email goes out normally from the account's own
   address so a sign-in code is never lost. Google's special no-reply mode is not used: Gmail rejected it on a new domain. */
function sendFromAddress_() { return String(props_().getProperty('SEND_FROM') || 'noreply@wrapline.in').trim().toLowerCase(); }
function sendNoReply_(message) {
  var from = sendFromAddress_();
  try {
    if (from && GmailApp.getAliases().map(function (a) { return String(a).toLowerCase(); }).indexOf(from) >= 0) {
      var o = { from: from, name: message.name || 'Wrapline' };
      if (message.htmlBody) o.htmlBody = message.htmlBody;
      if (message.replyTo) o.replyTo = message.replyTo; if (message.attachments) o.attachments = message.attachments;
      GmailApp.sendEmail(message.to, message.subject, message.body || '', o);
      return;
    }
  } catch (err) { /* fall back to the normal way below */ }
  MailApp.sendEmail(message);
}
/* Run this ONCE in the editor (Run button) after updating the script: it asks you to allow sending as noreply@wrapline.in. */
function authorizeSendAs() {
  var aliases = GmailApp.getAliases();
  Logger.log('Send-as addresses: ' + aliases.join(', ') + (aliases.indexOf(sendFromAddress_()) >= 0 ? '  -> ' + sendFromAddress_() + ' is ready.' : '  -> ' + sendFromAddress_() + ' is NOT set up yet in Gmail.'));
}
/* Gmail filters cannot label mail you SEND, so the copies of customer emails (codes, welcome, confirmations) are labelled here.
   Run installSentLabeler once; after that it runs by itself every hour. Labels sit under "Wrapline" like the filter labels. */
function labelSentMail() {
  var rules = [
    ['Wrapline/Codes', 'subject:"sign-in code"'],
    ['Wrapline/Welcome', 'subject:"Welcome to Wrapline"'],
    ['Wrapline/Razorpay Payments', '(subject:"subscription is confirmed" OR subject:"order is confirmed" OR subject:"Pro invoice")'],
    ['Wrapline/Trials', 'subject:"trial request"']
  ];
  rules.forEach(function (rule) {
    try {
      var label = GmailApp.getUserLabelByName(rule[0]);
      if (!label) return;
      var threads = GmailApp.search('in:sent newer_than:2d -label:"' + rule[0] + '" ' + rule[1], 0, 100);
      if (threads.length) label.addToThreads(threads);
    } catch (err) {}
  });
}
function installSentLabeler() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'labelSentMail') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('labelSentMail').timeBased().everyHours(1).create();
  labelSentMail();
  Logger.log('Sent mail will be labelled every hour.');
}
/* One clean look for every mail YOU receive (orders, trials, cancellations, coffees, contact messages): logo, a coloured headline,
   the details as a tidy table, and any instructions in a highlighted box. Built from the plain text, which is still sent as the fallback. */
function ownerHtml_(subject, body) {
  var text = String(body || ''), subj = String(subject || '');
  var tone = /^\[TEST\]/.test(subj) ? ['#8a6d00', '#fff7d6'] : /CHECK|stopped|cancelled/i.test(subj) ? ['#b3261e', '#fdeceb'] : /coffee|converted|New order|license/i.test(subj) ? ['#0a7a4b', '#e7f6ee'] : ['#2a64e8', '#eaf0fe'];
  var link = function (t) { return esc_(t).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#2a64e8">$1</a>'); };
  var rows = '', notes = '', paras = '';
  text.split(/\n{2,}/).forEach(function (block) {
    var lines = block.split('\n').filter(function (l) { return l.trim(); });
    if (!lines.length) return;
    var plain = [];
    lines.forEach(function (l) {
      if (/^[A-Za-z][^:\n]{1,40}: .+/.test(l) && !/^(Mark |Verify |Create |Reply |It is also|Promise|If the buyer|FREE TRIAL|PRICE CHECK|Someone asked|If you)/.test(l)) {
        var i = l.indexOf(': '); rows += '<tr><td style="padding:9px 14px 9px 0;width:130px;color:#6b7390;font-size:14px;white-space:nowrap;vertical-align:top;border-top:1px solid #eef0f6">' + esc_(l.slice(0, i)) + '</td><td style="padding:9px 0;font-size:15px;color:#14182a;border-top:1px solid #eef0f6">' + link(l.slice(i + 2)) + '</td></tr>';
      } else plain.push(l);
    });
    if (!plain.length) return;
    if (/^(Mark |Verify |Create |Reply |It is also|Promise|If the buyer|FREE TRIAL|PRICE CHECK|Your access)/.test(plain[0])) {
      notes += '<div style="background:' + tone[1] + ';border-radius:12px;padding:14px 16px;margin:0 0 14px;font-size:14px;line-height:1.55;color:#2b3149">' + plain.map(link).join('<br>') + '</div>';
    } else {
      paras += '<p style="font-size:16px;line-height:1.55;margin:0 0 16px;color:#2b3149">' + plain.map(link).join('<br>') + '</p>';
    }
  });
  return '<div style="background:#f3f4f8;margin:0;padding:28px 12px;font-family:Arial,Helvetica,sans-serif;color:#14182a"><div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:18px;padding:26px 26px 20px">' +
    '<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 20px"><tr><td style="width:30px;height:30px"><img src="https://wrapline.in/assets/apple-touch-icon.png" width="30" height="30" alt="W" style="display:block;border:0;border-radius:8px"></td>' +
    '<td style="padding-left:10px;font-size:16px;font-weight:700;letter-spacing:.2px;color:#14182a">WRAPLINE</td></tr></table>' +
    '<div style="display:inline-block;background:' + tone[1] + ';color:' + tone[0] + ';border-radius:999px;padding:5px 12px;font-size:12px;font-weight:700;letter-spacing:.4px;margin:0 0 12px">' + esc_(/^\[TEST\]/.test(subj) ? 'TEST' : /CHECK|stopped|cancelled/i.test(subj) ? 'NEEDS A LOOK' : 'NEW') + '</div>' +
    '<h1 style="font-size:22px;line-height:1.3;margin:0 0 18px;font-weight:700;color:#14182a">' + esc_(subj.replace(/^\[TEST\]\s*/, '')) + '</h1>' + paras +
    (rows ? '<table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;margin:0 0 18px">' + rows + '</table>' : '') + notes +
    '<p style="font-size:12px;line-height:1.5;color:#8a90a8;margin:6px 0 0">Automatic message from your Wrapline site. It is filed under Wrapline in Gmail.</p></div></div>';
}
function ownerMail_(message) { message.htmlBody = ownerHtml_(message.subject, message.body); MailApp.sendEmail(message); }
/* Branded HTML for the sign-in / registration code email (plain-text body is still sent as a fallback). */
function codeEmailHtml_(code, minutes, support) {
  var spaced = String(code).split('').join('&#8202;&nbsp;');
  return '<div style="background:#ffffff;margin:0;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;color:#14182a">' +
    '<div style="max-width:560px;margin:0 auto">' +
    '<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 28px"><tr>' +
      '<td style="width:34px;height:34px"><img src="https://wrapline.in/assets/apple-touch-icon.png" width="34" height="34" alt="W" style="display:block;border:0;border-radius:9px;background:#2a64e8;color:#ffffff;font-weight:700;font-size:19px;text-align:center;line-height:34px"></td>' +
      '<td style="padding-left:11px;font-size:19px;font-weight:700;letter-spacing:.2px;color:#14182a">WRAPLINE</td></tr></table>' +
    '<h1 style="font-size:28px;line-height:1.2;margin:0 0 22px;font-weight:700;color:#14182a">Here is your verification code:</h1>' +
    '<div style="border:1px solid #e3e6ef;border-radius:16px;padding:26px 28px;margin:0 0 26px">' +
      '<span style="font-size:38px;line-height:1;font-weight:700;letter-spacing:6px;color:#2a64e8;font-family:Arial,Helvetica,sans-serif">' + code + '</span></div>' +
    '<p style="font-size:16px;line-height:1.5;margin:0 0 14px;color:#2b3149">Please make sure you never share this code with anyone.</p>' +
    '<p style="font-size:14px;line-height:1.5;margin:0 0 28px;color:#6b7390"><b>Note:</b> The code will expire in ' + minutes + ' minutes.</p>' +
    '<div style="background:#f3f4f8;border-radius:14px;padding:18px 20px;font-size:15px;line-height:1.55;color:#2b3149;margin:0 0 30px">' +
      '<b>Didn\'t try to sign in?</b> You can safely ignore this email. If you keep receiving codes, write to ' + support + '.</div>' +
    '<div style="border-top:1px solid #e3e6ef;padding-top:20px;font-size:12px;line-height:1.6;color:#8a91a8">' +
      'You received this email because someone entered your address on the Wrapline sign-in page. This is an automatic message; please do not reply to it.<br><br>' +
      '&copy; ' + new Date().getFullYear() + ' AJOY &middot; Wrapline for Maya</div>' +
    '</div></div>';
}
function replyTo_() { return props_().getProperty('REPLY_TO') || ownerEmail_(); }

function props_() { return PropertiesService.getScriptProperties(); }
function mode_() { return props_().getProperty('PAYPAL_MODE') === 'live' ? 'live' : 'sandbox'; }
function base_() { return mode_() === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com'; }

function doPost(e) {
  var out = ContentService.createTextOutput();
  try {
    var raw = (e && e.postData && e.postData.contents) || '';
    var data = {};
    try { data = JSON.parse(raw); } catch (err) { data = { email: (e && e.parameter && e.parameter.email) || '' }; }
    if (data.type === 'contact') { out.setMimeType(ContentService.MimeType.JSON); return out.setContent(JSON.stringify(handleContact_(data.contact || {}))); }
    if (data.type === 'commerce') { out.setMimeType(ContentService.MimeType.JSON); return out.setContent(JSON.stringify(handleCommerceEnvelope_(data))); }
    if (data.type === 'order') { out.setMimeType(ContentService.MimeType.JSON); return out.setContent(JSON.stringify({ r: 'secure_checkout_required' })); }
    if (data.type === 'trial') return out.setContent('secure_checkout_required');
    if (data.type === 'reviews') { out.setMimeType(ContentService.MimeType.JSON); return out.setContent(JSON.stringify(handleReviews_(data))); }
    if (data.type === 'donation') { out.setMimeType(ContentService.MimeType.JSON); return out.setContent(JSON.stringify(handleDonation_(data))); }
    if (data.type === 'account') { out.setMimeType(ContentService.MimeType.JSON); return out.setContent(JSON.stringify(handleAccount_(data))); }
    return out.setContent(saveLead_(String(data.email || '')));
  } catch (err) {
    return out.setContent('error');
  }
}

function doGet() { return ContentService.createTextOutput('Wrapline Pro service is running.'); }

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
/* True when this PayPal plan is one of the 4-day-trial plans (Basic only). */
function isTrialPlan_(planId) {
  var saved = props_().getProperty('PLANS_' + mode_());
  if (!saved || !planId) return false;
  var tiers = (JSON.parse(saved).tiers) || {};
  for (var t in tiers) { var o = tiers[t].onlineTrial || {}; if (o.monthly === planId || o.yearly === planId) return true; }
  var historic=rewardPlanInfo_(planId);
  return !!(historic&&historic.trial);
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
    sheet.appendRow([new Date(), subId, status, mode_(), email, clip_(d.name, 80), clip_(d.country, 2), clip_(d.plan, 10) + (trial ? ' (4-day trial)' : ''), clip_(d.billing, 10), Number(d.seats) || 1, clip_(d.company, 80), planId, detected, payer, flags.length ? 'CHECK' : 'ok', '', ''].map(safeSheetCell_));
    var orderRow = sheet.getLastRow();

    var test = mode_() !== 'live';
    var planText = 'Wrapline Pro ' + planLabel_(d.plan) + ' · ' + (d.billing === 'yearly' ? 'Yearly' : 'Monthly') + ' · ' + (Number(d.seats) || 1) + ' license(s)' + (trial ? ' · 4-day free trial, then billed automatically' : '');
    var tag = test ? '[TEST] ' : '';
    var owner = ownerEmail_();

    /* You always get a reminder, even if the order could not be verified. */
    try { ownerMail_({
      to: owner, name: 'Wrapline Pro orders',
      subject: tag + (flags.length && verified ? 'CHECK PRICE, then send the license key' : verified ? 'New order: send the license key' : 'CHECK THIS ORDER (' + status + ')'),
      body: 'Plan: ' + planText + '\nSubscription ID: ' + subId + '\nPayPal status: ' + status + '\nBuyer email (form): ' + email + '\nPayPal email: ' + paypalEmail +
        '\nName: ' + clip_(d.name, 80) + '\nBilling country: ' + clip_(d.country, 2) + '\nConnection country: ' + (detected || 'unknown') + '\nPayPal buyer country: ' + (payer || 'not reported (check the payment in PayPal > Activity)') + '\nCompany: ' + clip_(d.company, 80) +
        (flags.length ? '\n\nPRICE CHECK NEEDED BEFORE YOU SEND THE KEY:\n- ' + flags.join('\n- ') + '\nIf the buyer is not in the region of the price they paid, cancel the subscription in PayPal or ask them to subscribe again at the right price.' : '') + (trial ? '\n\nFREE TRIAL: send a license that works for the trial. The first payment is taken automatically after 4 days unless the buyer cancels in PayPal.' : '') + '\n\nPromise made to the buyer: license key within 12 hours.\nMark "License sent?" in the Orders tab when done.'
    }); emailLog.push('owner: sent'); } catch (err) { emailLog.push('owner FAILED: ' + String(err).slice(0, 120)); }

    /* The buyer only gets a confirmation when PayPal confirms the subscription. */
    if (verified && validEmail) {
      var name = clip_(d.name, 80) || 'there';
      var html = '<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#14182a">' +
        '<h2 style="margin:0 0 12px">Thank you, ' + esc_(name) + '.</h2>' +
        '<p>Your Wrapline Pro subscription is confirmed.</p>' +
        '<table style="border-collapse:collapse;width:100%;margin:14px 0"><tr><td style="padding:8px 0;color:#667">Plan</td><td style="text-align:right"><b>' + esc_(planText) + '</b></td></tr>' +
        '<tr><td style="padding:8px 0;color:#667;border-top:1px solid #e3e6ee">Subscription ID</td><td style="text-align:right;border-top:1px solid #e3e6ee"><b>' + esc_(subId) + '</b></td></tr></table>' +
        (trial ? '<p><b>Your 4-day free trial has started.</b> Your first payment is taken automatically when it ends, unless you cancel before then in PayPal. You can cancel any time.</p>' : '') +
        '<p><b>Your license key will arrive within 12 hours</b> at this email address.</p>' +
        '<p>Questions? Reply to this email or write to ' + replyTo_() + '.</p>' +
        '<p style="color:#667;font-size:13px">Wrapline Pro: production tools for Maya.</p></div>';
      try { MailApp.sendEmail({ to: email, name: 'Wrapline Pro', replyTo: replyTo_(), subject: tag + 'Your Wrapline Pro order is confirmed', htmlBody: html,
        body: 'Thank you. Your Wrapline Pro subscription is confirmed.\nPlan: ' + planText + '\nSubscription ID: ' + subId + '\nYour license key will arrive within 12 hours at this email address.\nQuestions? ' + replyTo_() }); emailLog.push('buyer: sent'); } catch (err) { emailLog.push('buyer FAILED: ' + String(err).slice(0, 120)); }
    } else { emailLog.push('buyer: skipped (' + (verified ? 'bad email' : 'not verified') + ')'); }
    sheet.getRange(orderRow, 17).setValue(emailLog.join(' | '));
    return verified ? 'ok' : 'unverified';
  } finally { lock.releaseLock(); }
}

/* ---------- 2a) subscriber account (sign in with an emailed code) ----------
   The site calls this with {type:'account', step:'code'|'verify'|'status', ...}.
   step 'code'   : detects registration for intent auto and emails a two-minute verification code.
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
var SESSION_MS_ = 30 * 24 * 3600 * 1000;
/* One mailbox, one identity: name+tag@gmail.com and n.a.me@gmail.com are the same inbox as name@gmail.com. Used for trial and coupon limits. */
function canonEmail_(email) {
  var e = String(email || '').trim().toLowerCase(), at = e.lastIndexOf('@');
  if (at < 1) return e;
  var local = e.slice(0, at), domain = e.slice(at + 1);
  if (domain === 'googlemail.com') domain = 'gmail.com';
  var plus = local.indexOf('+'); if (plus > 0) local = local.slice(0, plus);
  if (domain === 'gmail.com') local = local.replace(/\./g, '');
  return local + '@' + domain;
}
/* Fixed-window counter: returns false once `limit` hits were made inside `ttlSec` seconds. */
function bump_(cache, key, limit, ttlSec) {
  var now = Date.now(), o = null;
  try { o = JSON.parse(cache.get(key) || 'null'); } catch (err) { o = null; }
  if (!o || now - o.s > ttlSec * 1000) o = { n: 0, s: now };
  if (o.n >= limit) return false;
  o.n++; cache.put(key, JSON.stringify(o), Math.max(1, Math.ceil(ttlSec - (now - o.s) / 1000)));
  return true;
}
/* Constant-time comparison so a signature cannot be guessed one character at a time. */
function safeEq_(a, b) { a = String(a); b = String(b); if (a.length !== b.length) return false; var r = 0; for (var i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; }
/* Sign-out and account deletion revoke every token issued before that moment. Entries older than a token's life are dropped. */
function revocationKey_(email) { return sign_('revoke:' + email).slice(0, 22); }
function revokedBefore_(email) {
  try { return Number(JSON.parse(props_().getProperty('SESSION_REVOKED') || '{}')[revocationKey_(email)] || 0); } catch (err) { return 0; }
}
function revokeSessions_(email, lockHeld) {
  var lock = lockHeld ? null : LockService.getScriptLock(); if (lock) lock.waitLock(10000);
  try {
    var map; try { map = JSON.parse(props_().getProperty('SESSION_REVOKED') || '{}'); } catch (err) { map = {}; }
    var now = Date.now();
    Object.keys(map).forEach(function (k) { if (now - Number(map[k]) > SESSION_MS_ + 86400000) delete map[k]; });
    map[revocationKey_(email)] = now;
    props_().setProperty('SESSION_REVOKED', JSON.stringify(map));
  } finally { if (lock) lock.releaseLock(); }
}
function makeSession_(email, onlySub) {
  var exp = Date.now() + SESSION_MS_, body = b64u_(Utilities.newBlob(email + '|' + exp + (onlySub ? '|' + onlySub : '')).getBytes());
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
    if (!safeEq_(sign_(body), tok.slice(i + 1))) return null;
    var padded = body + '==='.slice(0, (4 - body.length % 4) % 4);
    var txt = Utilities.newBlob(Utilities.base64DecodeWebSafe(padded)).getDataAsString().split('|');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(txt[0]) || !Number.isFinite(Number(txt[1])) || Number(txt[1]) <= Date.now()) return null;
    if (Number(txt[1]) - SESSION_MS_ <= revokedBefore_(txt[0])) return null;
    return { email: txt[0], sub: txt[2] || '', expiresAt: Number(txt[1]) };
  } catch (err) { return null; }
}

/* Six digits from the platform's secure random UUID source (Math.random is predictable). */
function secureCode_() { var n = parseInt(Utilities.getUuid().replace(/-/g, '').slice(0, 12), 16); return String(100000 + (n % 900000)); }
function hashCode_(email, code) { return b64u_(Utilities.computeHmacSha256Signature(email + ':' + code, sessionSecret_())); }
function ordersFor_(email, onlySub) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ORDERS_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 12).getValues(), out = [];
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (sheetEmail_(r[4]) === email && /^I-/.test(String(r[1])) && r[3] === mode_()) if (!onlySub || String(r[1]) === onlySub) out.push({ id: String(r[1]), plan: String(r[7]).split(' ')[0], billing: String(r[8]), seats: Number(r[9]) || 1, at: r[0] instanceof Date ? r[0] : new Date(r[0]), trialPlan: String(r[7]).indexOf('trial') >= 0 });
  }
  return out;
}
function addPeriod_(d, billing) { var x = new Date(d.getTime()); if (billing === 'yearly') x.setFullYear(x.getFullYear() + 1); else x.setMonth(x.getMonth() + 1); return x; }
function subscriptionsFor_(email, onlySub) {
  var list = ordersFor_(email, onlySub).slice(-5).reverse(), t = token_(), out = [];
  list.forEach(function (o) {
    var item = { plan: o.plan, billing: o.billing, seats: o.seats, status: 'UNKNOWN', endsAt: '', renews: false, trial: false, provider: 'paypal', ref: o.id };
    if (t) {
      var r = UrlFetchApp.fetch(base_() + '/v1/billing/subscriptions/' + encodeURIComponent(o.id), { muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + t } });
      if (r.getResponseCode() === 200) {
        var s = JSON.parse(r.getContentText()), b = s.billing_info || {};
        item.status = s.status || 'UNKNOWN';
        var next = b.next_billing_time ? new Date(b.next_billing_time) : null;
        var last = b.last_payment && b.last_payment.time ? new Date(b.last_payment.time) : (s.start_time ? new Date(s.start_time) : null);
        if (item.status === 'ACTIVE' && next) { item.endsAt = next.toISOString(); item.renews = true; item.trial = !!o.trialPlan && o.at && (Date.now() - o.at.getTime()) < 4 * 86400000 + 3600000 * 6; }
        else {
          // A trial cancelled before its first payment ends when the trial would have ended.
          var paid = b.last_payment && b.last_payment.amount && Number(b.last_payment.amount.value) > 0;
          var started = s.start_time ? new Date(s.start_time) : o.at;
          if (o.trialPlan && !paid && started) { item.endsAt = new Date(started.getTime() + 4 * 86400000).toISOString(); item.trial = true; }
          else if (last) item.endsAt = addPeriod_(last, o.billing).toISOString();
        }
      }
    }
    item._orderTime=o.at.getTime();
    out.push(item);
  });
  if(typeof razorpaySubscriptions_==='function')out=out.concat(razorpaySubscriptions_(email,onlySub));
  return out.sort(function(a,b){return (b._orderTime||0)-(a._orderTime||0);}).slice(0,5).map(function(item){delete item._orderTime;return item;});
}
/* Subscriber-initiated cancellation: stops future charges, access continues until the paid (or trial) period ends. */
function cancelSubscription_(who, provider, ref) {
  try {
    if (provider === 'razorpay' && /^[-a-f0-9]{36}$/i.test(ref) && typeof razorpayStopRenewal_ === 'function') {
      var stopped = razorpayStopRenewal_(ref, who);
      return { ok: true, cancelled: true, endsAt: stopped.endsAt || '' };
    }
    if (provider !== 'paypal' || !/^I-[A-Z0-9]{6,40}$/.test(ref)) return { ok: false, error: 'invalid', message: 'This subscription could not be found.' };
    if (!ordersFor_(who.email).some(function (o) { return o.id === ref; })) return { ok: false, error: 'invalid', message: 'This subscription does not belong to your account.' };
    var t = token_();
    if (!t) return { ok: false, error: 'unavailable', message: 'PayPal could not be reached. Please try again shortly.' };
    var current = UrlFetchApp.fetch(base_() + '/v1/billing/subscriptions/' + encodeURIComponent(ref), { muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + t } });
    var status = current.getResponseCode() === 200 ? JSON.parse(current.getContentText()).status : '';
    if (status === 'ACTIVE' || status === 'SUSPENDED') {
      var r = UrlFetchApp.fetch(base_() + '/v1/billing/subscriptions/' + encodeURIComponent(ref) + '/cancel', { method: 'post', contentType: 'application/json', muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + t }, payload: JSON.stringify({ reason: 'Cancelled by the subscriber from their Wrapline Pro account.' }) });
      if (r.getResponseCode() !== 204 && r.getResponseCode() !== 200) return { ok: false, error: 'unavailable', message: 'PayPal did not accept the cancellation. Please try again or cancel in your PayPal account.' };
    }
    var item = subscriptionsFor_(who.email, ref).filter(function (x) { return x.ref === ref; })[0] || {};
    try { ownerMail_({ to: ownerEmail_(), name: 'Wrapline Pro orders', subject: 'Subscription cancelled: ' + ref, body: who.email + ' cancelled their Wrapline Pro PayPal subscription ' + ref + '. Access continues until ' + (item.endsAt ? new Date(item.endsAt).toDateString() : 'the end of the paid period') + '.' }); } catch (e) {}
    return { ok: true, cancelled: true, endsAt: item.endsAt || '' };
  } catch (e) {
    return { ok: false, error: e && e.code ? e.code : 'unavailable', message: e && e.code && e.message ? e.message : 'The subscription could not be cancelled. Please try again.' };
  }
}
/* Accounts are created only after a registration email code has been verified. */
function safeSheetCell_(value) { return typeof value === 'string' && /^[=+@-]/.test(value) ? "'" + value : value; }
function registeredEmail_(email) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Accounts');
  if (sheet && sheet.getLastRow() > 1) {
    var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 3).getValues();
    if (rows.some(function(r) { return sheetEmail_(r[0]) === email && !!r[1]; })) return true;
  }
  if (ordersFor_(email).length > 0) return true;
  // A Razorpay buyer counts as registered too (their purchase is kept on the RazorpayCheckouts tab, not Orders).
  if (typeof razorpayRows_ === 'function') {
    try { if (razorpayRows_().some(function(r) { return sheetEmail_(r.email) === email && r.accepted; })) return true; } catch (e) {}
  }
  return false;
}
/* An email as stored in a Sheet cell, made comparable: no spaces or invisible characters, no leading ' (added to
   stop formulas), lower case. */
function sheetEmail_(value) {
  return String(value == null ? '' : value).replace(/[\s\u200b-\u200d\u2060\ufeff]/g, '').replace(/^'/, '').toLowerCase();
}
function registerAccount_(email) {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), sheet = ss.getSheetByName('Accounts');
  if (!sheet) { sheet = ss.insertSheet('Accounts'); sheet.appendRow(['Email', 'Verified at', 'Account ID']); sheet.setFrozenRows(1); }
  var rows = sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 3).getValues() : [];
  var existing = rows.filter(function(r) { return sheetEmail_(r[0]) === email && !!r[1]; })[0];
  if (!existing) { sheet.appendRow([email, new Date(), Utilities.getUuid()].map(safeSheetCell_)); return true; }
  return false;
}
/* Sent once, the first time an address is verified (never on later sign-ins). A failure here must never block the sign-in. */
function welcomeEmailHtml_(support) {
  var site = 'https://wrapline.in';
  return '<div style="background:#ffffff;margin:0;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;color:#14182a">' +
    '<div style="max-width:560px;margin:0 auto">' +
    '<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 28px"><tr>' +
      '<td style="width:34px;height:34px"><img src="https://wrapline.in/assets/apple-touch-icon.png" width="34" height="34" alt="W" style="display:block;border:0;border-radius:9px;background:#2a64e8;color:#ffffff;font-weight:700;font-size:19px;text-align:center;line-height:34px"></td>' +
      '<td style="padding-left:11px;font-size:19px;font-weight:700;letter-spacing:.2px;color:#14182a">WRAPLINE</td></tr></table>' +
    '<h1 style="font-size:28px;line-height:1.2;margin:0 0 16px;font-weight:700;color:#14182a">Thanks for registering.</h1>' +
    '<p style="font-size:16px;line-height:1.6;margin:0 0 22px;color:#2b3149">Your Wrapline account is ready. You can sign in any time with just your email and a one-time code. There is no password to remember.</p>' +
    '<div style="background:#f3f4f8;border-radius:14px;padding:18px 20px;font-size:15px;line-height:1.6;color:#2b3149;margin:0 0 26px">' +
      '<b>Where to start</b><br>' +
      '<a href="' + site + '/wrapline-free" style="color:#2a64e8">Download Wrapline Free</a> for everyday Maya tools.<br>' +
      '<a href="' + site + '/wrapline" style="color:#2a64e8">See Wrapline Pro</a> for the full pipeline kit, with a free trial.</div>' +
    '<p style="font-size:15px;line-height:1.6;margin:0 0 28px;color:#2b3149">Questions? Write to <a href="mailto:' + support + '" style="color:#2a64e8">' + support + '</a> and a real person will answer.</p>' +
    '<div style="border-top:1px solid #e3e6ef;padding-top:20px;font-size:12px;line-height:1.6;color:#8a91a8">' +
      'You received this once because you registered at wrapline.in. This is an automatic message; please do not reply to it.<br><br>' +
      '&copy; ' + new Date().getFullYear() + ' AJOY &middot; Wrapline for Maya</div>' +
    '</div></div>';
}
function sendWelcome_(email) {
  try {
    sendNoReply_({ to: email, name: 'Wrapline (no-reply)', subject: 'Welcome to Wrapline',
      htmlBody: welcomeEmailHtml_(replyTo_()),
      body: 'Thanks for registering. Your Wrapline account is ready. Sign in any time with your email and a one-time code.\n\nWrapline Free: https://wrapline.in/wrapline-free\nWrapline Pro: https://wrapline.in/wrapline\n\nQuestions? Write to ' + replyTo_() + '.\n\nThis is an automatic message from Wrapline. Please do not reply to it.' });
  } catch (err) { /* the sign-in must still succeed */ }
}
function handleAccount_(d) {
  var email = clip_(d.email, 120).trim().toLowerCase();
  var step = String(d.step || '');
  if (step === 'history') {
    var viewer = readSession_(d.token);
    if (!viewer) return { ok: false, error: 'expired' };
    if (!registeredEmail_(viewer.email)) return { ok: false, error: 'not_registered' };
    try { if (typeof invoiceBackfill_ === 'function' && !viewer.sub) invoiceBackfill_(viewer.email); } catch (e) { Logger.log('Invoice backfill: ' + e.message); }
    return { ok: true, email: viewer.email, subscriptions: subscriptionsFor_(viewer.email, viewer.sub), invoices: invoiceArchive_(viewer) };
  }
  if (step === 'logout') {
    var leaving = readSession_(d.token);
    if (leaving) revokeSessions_(leaving.email);
    return { ok: true };
  }
  if (step === 'status' || step === 'identity') {
    var who = readSession_(d.token);
    if (!who) return { ok: false, error: 'expired' };
    if (!registeredEmail_(who.email)) return { ok: false, error: 'not_registered' };
    var account = { ok: true, email: who.email, limited: !!who.sub, expiresAt: who.expiresAt, premiumYearlyUsed: false, yearlyOfferUsed: { online: false, offline: false } };
    var flags = yearlyUsedFlags_(who.email); account.premiumYearlyUsed = flags.offline; account.yearlyOfferUsed = flags;
    if (step === 'status') account.subscriptions = subscriptionsFor_(who.email, who.sub);
    return account;
  }
  if (step === 'profile-get' || step === 'profile-set' || step === 'profile-clear') return handleProfile_(d, step);
  if (step === 'erase') return handleErase_(d);
  if (step === 'cancel') {
    var owner = readSession_(d.token);
    if (!owner) return { ok: false, error: 'expired' };
    return cancelSubscription_(owner, String(d.provider || ''), String(d.ref || ''));
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { ok: false, error: 'email' };
  if (step !== 'code' && step !== 'verify') return { ok: false, error: 'step' };
  // New sign-ups need a reputable mailbox. Anyone who already bought from you can still sign in with the address they used.
  if (step === 'code' && !emailDomainAllowed_(email) && (isDisposableEmail_(email) || !registeredEmail_(email))) return { ok: false, error: 'email_domain' };
  // Serialize code requests and consumption so a code can be used only once.
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return { ok: false, error: 'busy' };
  try {
    var cache = CacheService.getScriptCache();
    if (step === 'code') {
      var key = 'sends:' + email, n = Number(cache.get(key) || 0);
      if (n >= 5) return { ok: false, error: 'limit' };
      cache.put(key, String(n + 1), 3600);
      // Legacy sign-in-only requests still reject unknown emails; unified requests register only after verification.
      var registered = registeredEmail_(email);
      // Mass sign-ups must not use up the mail quota that real customers need to receive their codes: only NEW addresses are capped.
      if (!registered) {
        var quota = (typeof MailApp !== 'undefined' && MailApp.getRemainingDailyQuota) ? MailApp.getRemainingDailyQuota() : 999;
        if (quota < 25 || !bump_(cache, 'sends-new', 20, 600)) return { ok: false, error: 'busy' };
      }
      var intent = !registered && ['register','auto'].indexOf(d.intent)>=0 ? 'register' : 'signin';
      if (!registered && intent !== 'register') return { ok: false, error: 'not_registered', registrationAvailable: true };
      cache.put('intent:' + email, intent, 120);
      var code = secureCode_();
      var expiresAt=Date.now()+120000;
      cache.put('code:' + email, JSON.stringify({hash:hashCode_(email,code),expiresAt:expiresAt}), 120); cache.remove('tries:' + email);
      try { sendNoReply_({ to: email, name: 'Wrapline (no-reply)', subject: 'Your Wrapline sign-in code: ' + code,
        htmlBody: codeEmailHtml_(code, 2, replyTo_()),
        body: 'Your sign-in code is ' + code + '\n\nIt expires in 2 minutes. If you did not ask for it, you can ignore this email.\n\nThis is an automatic message from Wrapline. Please do not reply to it. For help, write to ' + replyTo_() + '.' }); }
      catch (err) { cache.remove('code:' + email); return { ok: false, error: 'mail' }; }
      return { ok: true, registered: registered, intent: intent, expiresAt:expiresAt, expiresIn:Math.max(0,Math.ceil((expiresAt-Date.now())/1000)) };
    }
    var tk = 'tries:' + email, tries = Number(cache.get(tk) || 0);
    if (tries >= 5) return { ok: false, error: 'limit' };
    cache.put(tk, String(tries + 1), 600);
    var packed=cache.get('code:' + email), record;try{record=JSON.parse(packed||'null');}catch(error){}
    var got=String(d.code || '').trim();
    if(!record||!Number.isFinite(record.expiresAt)||record.expiresAt<=Date.now()){cache.remove('code:' + email);cache.remove('intent:' + email);return {ok:false,error:'code_expired'};}
    if(!/^\d{6}$/.test(got)||record.hash!==hashCode_(email,got))return {ok:false,error:'code'};
    var intent = cache.get('intent:' + email);
    cache.remove('code:' + email); cache.remove('intent:' + email);
    if (!registeredEmail_(email) && intent !== 'register') return { ok: false, error: 'not_registered' };
    var firstTime = registerAccount_(email);
    if (firstTime) sendWelcome_(email);
    var token = makeSession_(email), identity = readSession_(token), flags2 = yearlyUsedFlags_(email);
    return { ok: true, email: email, token: token, expiresAt: identity.expiresAt, subscriptions: null, premiumYearlyUsed: flags2.offline, yearlyOfferUsed: flags2 };
  } finally { lock.releaseLock(); }
}

/* ---------- 2b) free trial requests ----------
   Logs the request in the "Trials" tab, emails you to create a trial code, and emails the visitor a receipt.
   Trial length comes from the Script property TRIAL_DAYS (default 4). Keep it the same as trialDays in js/site-config.js. */
function handleTrial_(d) {
  if (d.website) return 'ok'; /* hidden field filled in: a bot */
  var email = clip_(d.email, 120).trim().toLowerCase();
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email)) return 'invalid';
  var name = clip_(d.name, 80);
  var days = Number(props_().getProperty('TRIAL_DAYS')) || 4;
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
      ownerMail_({ to: ownerEmail_(), name: 'Wrapline Pro trials', subject: 'Trial request: send a ' + days + '-day code to ' + email,
        body: 'Someone asked for a free trial.\n\nEmail: ' + email + '\nName: ' + (name || '-') + '\nTrial length promised: ' + days + ' days\n\nCreate a ' + days + '-day trial code the way you usually create access codes and email it to them. They were told it arrives within 12 hours.\nMark "Code sent?" in the Trials tab when done.' });
      log.push('owner: sent');
    } catch (err) { log.push('owner FAILED: ' + String(err).slice(0, 120)); }
    try {
      MailApp.sendEmail({ to: email, name: 'Wrapline Pro', replyTo: replyTo_(), subject: 'We received your Wrapline Pro trial request',
        body: 'Hi ' + (name || 'there') + ',\n\nThanks for asking to try Wrapline Pro. Your ' + days + '-day trial code will arrive at this email address within 12 hours.\n\nQuestions? Reply to this email or write to ' + replyTo_() + '.\n\nWrapline Pro: production tools for Maya.' });
      log.push('visitor: sent');
    } catch (err) { log.push('visitor FAILED: ' + String(err).slice(0, 120)); }
    sheet.getRange(row, 6).setValue(log.join(' | '));
    return 'ok';
  } finally { lock.releaseLock(); }
}

/* ---------- 3) one-time plan creation ----------
   Run setupPlans from the editor (select it, click Run). It creates 18 USD plans:
   3 regional tiers x Basic/Premium x Monthly/Yearly, plus 6 Basic trial plans, and writes the result to a "Plans" tab.
   Copy the single JSON cell from that tab into the Supabase secret PAYPAL_PLANS. */
var PRICE_VERSION = '2026-10-23-v4';
var LEGACY_PRICES = {
  high: { online: { monthly: 22, yearly: 211 }, offline: { monthly: 44, yearly: 422 } },
  mid: { online: { monthly: 14, yearly: 134 }, offline: { monthly: 28, yearly: 269 } },
  low: { online: { monthly: 9, yearly: 86 }, offline: { monthly: 18, yearly: 173 } }
};
var PRICES = {
  high: { online: { monthly: 29.99, yearly: 305.90, full: 359.88 }, offline: { monthly: 49.92, yearly: 479.20, full: 599.00 } },
  mid:  { online: { monthly: 16.59, yearly: 169.15, full: 199.00 }, offline: { monthly: 39.09, yearly: 375.20, full: 469.00 } },
  low:  { online: { monthly: 7.99, yearly: 81.50, full: 95.88 }, offline: { monthly: 19.09, yearly: 183.20, full: 229.00 } }
};

/* Customer-facing plan names. The stored plan keys stay 'online' and 'offline'. */
function planLabel_(plan) { return plan === 'offline' ? 'Premium' : 'Basic'; }
/* The yearly saving (15% Basic, 20% Premium) is for an account's first yearly subscription of that plan only.
   Any approved yearly order of that plan (PayPal or Razorpay) in the current mode uses it up, even if later cancelled. */
function premiumYearlyUsed_(email) { return yearlyOfferUsed_(email, 'offline'); }
/* Both plans' yearly-saving flags from one pass over the Orders tab and the Razorpay records (this used to be three passes). */
function yearlyUsedFlags_(email) {
  email = String(email || '').trim().toLowerCase();
  var out = { online: false, offline: false };
  if (!email) return out;
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ORDERS_SHEET);
  if (sheet && sheet.getLastRow() > 1) {
    var modes = [mode_(), 'razorpay_' + (typeof razorpayMode_ === 'function' ? razorpayMode_() : 'test')];
    sheet.getRange(2, 1, sheet.getLastRow() - 1, 12).getValues().forEach(function (r) {
      var plan = String(r[7]).split(' ')[0];
      if (String(r[4]).trim().toLowerCase() === email && modes.indexOf(String(r[3])) >= 0 && plan in out && String(r[8]) === 'yearly' && String(r[2]) !== 'NOT_FOUND') out[plan] = true;
    });
  }
  if (typeof razorpayRows_ === 'function') razorpayRows_().forEach(function (r) {
    if (r.mode === razorpayMode_() && r.email === email && r.accepted && r.price && r.price.billing === 'yearly' && r.price.plan in out) out[r.price.plan] = true;
  });
  return out;
}
function yearlyOfferUsed_(email, plan) { return !!yearlyUsedFlags_(email)[plan]; }

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
  if (result.priceVersion !== PRICE_VERSION) {
    archivePayPalCatalog_(result);
    result = { productId: result.productId, tiers: {}, priceVersion: PRICE_VERSION, prices: PRICES };
    props_().setProperty(key, JSON.stringify(result));
  }
  var productId = result.productId;
  if (!productId) {
    productId = paypalPost_('/v1/catalogs/products', { name: 'Wrapline Pro', description: 'Production tools for Maya.', type: 'DIGITAL', category: 'SOFTWARE', home_url: 'https://wrapline.in/' }, t, 'ajoy-product-' + mode_()).id;
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
          name: 'Wrapline Pro ' + planLabel_(kind) + ' ' + period + ' (' + tier + ')',
          description: 'Wrapline Pro ' + planLabel_(kind) + ' license, billed ' + period + '.',
          status: 'ACTIVE',
          billing_cycles: [{ frequency: { interval_unit: period === 'yearly' ? 'YEAR' : 'MONTH', interval_count: 1 }, tenure_type: 'REGULAR', sequence: 1, total_cycles: 0,
            pricing_scheme: { fixed_price: { value: String(PRICES[tier][kind][period]), currency_code: 'USD' } } }],
          payment_preferences: { auto_bill_outstanding: true, setup_fee_failure_action: 'CONTINUE', payment_failure_threshold: 3 },
          quantity_supported: true
        }, t, 'ajoy-plan-' + PRICE_VERSION + '-' + mode_() + '-' + tier + '-' + kind + '-' + period);
        result.tiers[tier][kind][period] = plan.id;
        props_().setProperty(key, JSON.stringify(result));
      });
    });
  });
  /* Basic plans with a 4-day free trial. The buyer approves in PayPal now and is first charged after the trial. */
  ['high', 'mid', 'low'].forEach(function (tier) {
    result.tiers[tier].onlineTrial = result.tiers[tier].onlineTrial || {};
    ['monthly', 'yearly'].forEach(function (period) {
      if (result.tiers[tier].onlineTrial[period]) return;
      var plan = paypalPost_('/v1/billing/plans', {
        product_id: productId,
        name: 'Wrapline Pro Basic ' + period + ' with 4-day trial (' + tier + ')',
        description: 'Wrapline Pro Basic license, 4-day free trial, then billed ' + period + '.',
        status: 'ACTIVE',
        billing_cycles: [
          { frequency: { interval_unit: 'DAY', interval_count: 4 }, tenure_type: 'TRIAL', sequence: 1, total_cycles: 1,
            pricing_scheme: { fixed_price: { value: '0', currency_code: 'USD' } } },
          { frequency: { interval_unit: period === 'yearly' ? 'YEAR' : 'MONTH', interval_count: 1 }, tenure_type: 'REGULAR', sequence: 2, total_cycles: 0,
            pricing_scheme: { fixed_price: { value: String(PRICES[tier].online[period]), currency_code: 'USD' } } }
        ],
        payment_preferences: { auto_bill_outstanding: true, setup_fee_failure_action: 'CONTINUE', payment_failure_threshold: 3 },
        quantity_supported: true
      }, t, 'ajoy-plan-' + PRICE_VERSION + '-' + mode_() + '-' + tier + '-onlinetrial-' + period);
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
        rows.push([labels[tier], planLabel_(kind), period === 'yearly' ? 'Yearly' : 'Monthly', PRICES[tier][kind][period], result.tiers[tier][kind][period]]);
      });
    });
  });
  ['high', 'mid', 'low'].forEach(function (tier) {
    ['monthly', 'yearly'].forEach(function (period) {
      rows.push([labels[tier], 'Basic + 4-day trial', period === 'yearly' ? 'Yearly' : 'Monthly', PRICES[tier].online[period], result.tiers[tier].onlineTrial[period]]);
    });
  });
  var json = JSON.stringify({ tiers: result.tiers });
  sh.getRange(1, 1).setValue('Wrapline Pro: PayPal plans').setFontWeight('bold').setFontSize(16);
  sh.getRange(2, 1).setValue('Mode: ' + mode_() + '. Created by the setupPlans script. Prices are USD per computer.').setFontStyle('italic').setFontColor('#666673');
  sh.getRange(4, 1, 1, 5).setValues([['Price level', 'Plan', 'Billing', 'Price (USD)', 'PayPal plan ID']]).setBackground('#1a2959').setFontColor('#ffffff').setFontWeight('bold').setVerticalAlignment('middle');
  sh.getRange(5, 1, rows.length, 5).setValues(rows);
  [5, 13, 21].forEach(function (r) { sh.getRange(r, 1, Math.min(4, rows.length + 5 - r), 5).setBackground('#edf5ff'); });
  var n = rows.length, jr = 5 + n + 1;
  sh.getRange(4, 4, n + 1, 1).setHorizontalAlignment('right');
  sh.getRange(5, 4, n, 1).setNumberFormat('$#,##0.00');
  sh.getRange(5, 5, n, 1).setFontFamily('Roboto Mono').setFontSize(10);
  sh.getRange(jr, 1).setValue('Copy the cell below into Supabase > Edge Functions > Secrets > PAYPAL_PLANS.').setFontStyle('italic').setFontColor('#666673');
  sh.getRange(jr + 1, 1).setValue(json).setFontFamily('Roboto Mono').setFontSize(9).setBackground('#f5f5f5').setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP);
  [330, 90, 90, 100, 260].forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
  sh.setRowHeight(4, 32); sh.setFrozenRows(4); sh.setHiddenGridlines(true); sh.setTabColor('#1a2959');
  Logger.log(json);
}

/* Run this once from the editor (select testEmail, click Run) to check that email sending is allowed.
   You should receive "Wrapline Pro test email" within a minute. */
function testEmail() {
  var to = ownerEmail_();
  MailApp.sendEmail({ to: to, subject: 'Wrapline Pro test email', body: 'If you can read this, the order emails can be sent. Remaining daily email quota: ' + MailApp.getRemainingDailyQuota() });
  Logger.log('Test email sent to the owner address [REDACTED].');
}

/* Run once after renaming the toolkit (Ajoy Tools -> Wrapline Pro): renames every PayPal plan this
   script created (standard, trial, reward and coupon plans) so buyers see "Wrapline Pro" in PayPal.
   Prices, IDs and existing subscriptions are not changed. Safe to run again. */
function renamePayPalPlans() {
  var t = token_();
  if (!t) throw new Error('PayPal is not connected. Check the Script properties.');
  var ids = {}, catalog = JSON.parse(props_().getProperty('PLANS_' + mode_()) || '{}'), tiers = catalog.tiers || {};
  for (var tier in tiers) for (var kind in tiers[tier]) for (var period in tiers[tier][kind]) ids[tiers[tier][kind][period]] = true;
  var extra = JSON.parse(props_().getProperty('LOYALTY_PLANS_' + mode_()) || '{}');
  for (var k in extra) if (extra[k] && extra[k].id) ids[extra[k].id] = true;
  var renamed = 0, skipped = 0;
  Object.keys(ids).forEach(function (id) {
    var get = UrlFetchApp.fetch(base_() + '/v1/billing/plans/' + encodeURIComponent(id), { muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + t } });
    if (get.getResponseCode() !== 200) { Logger.log('Could not read ' + id); skipped++; return; }
    var plan = JSON.parse(get.getContentText()), ops = [];
    var name = String(plan.name || ''), description = String(plan.description || '');
    if (/Ajoy Tools/.test(name)) ops.push({ op: 'replace', path: '/name', value: name.replace(/Ajoy Tools/g, 'Wrapline Pro').slice(0, 127) });
    if (/Ajoy Tools/.test(description)) ops.push({ op: 'replace', path: '/description', value: description.replace(/Ajoy Tools/g, 'Wrapline Pro').slice(0, 127) });
    if (!ops.length) { skipped++; return; }
    var r = UrlFetchApp.fetch(base_() + '/v1/billing/plans/' + encodeURIComponent(id), { method: 'patch', contentType: 'application/json', muteHttpExceptions: true, payload: JSON.stringify(ops), headers: { Authorization: 'Bearer ' + t } });
    if (r.getResponseCode() === 204 || r.getResponseCode() === 200) { renamed++; Logger.log('Renamed ' + id + ': ' + ops[0].value); }
    else Logger.log('Could not rename ' + id + ' (' + r.getResponseCode() + '): ' + r.getContentText().slice(0, 200));
  });
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Plans');
  if (sheet && /Ajoy Tools/.test(String(sheet.getRange(1, 1).getValue()))) sheet.getRange(1, 1).setValue('Wrapline Pro: PayPal plans');
  Logger.log('Done (' + mode_() + '): ' + renamed + ' plan(s) renamed, ' + skipped + ' already fine or skipped.');
}

/* ---------- Contact form: private Contacts tab, no account or marketing enrolment ---------- */
function handleContact_(data) {
  var text = function(value) { return typeof value === 'string' ? value.trim() : ''; };
  var name=text(data.name),email=text(data.email).toLowerCase(),message=text(data.message),topic=text(data.topic),requestId=text(data.requestId);
  if (text(data.website)) return {ok:false,error:'invalid'};
  if (!name || name.length>80 || email.length>120 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || message.length<10 || message.length>4000 ||
      ['general','support','studio','billing','india','privacy','idea'].indexOf(topic)<0 || !/^[a-zA-Z0-9-]{20,80}$/.test(requestId) || data.consent!==true) return {ok:false,error:'invalid'};
  var lock=LockService.getScriptLock();
  if (!lock.tryLock(10000)) return {ok:false,error:'busy'};
  var held=true;
  try {
    var attachments;try{attachments=contactAttachments_(data);}catch(error){return {ok:false,error:'attachment_invalid'};}
    var cache=CacheService.getScriptCache(),who=sign_('contact:'+email),fingerprint=sign_('contact-body:'+JSON.stringify([name,email,topic,message,attachments.map(function(a){return a.sha;})])),saved=cache.get('contact-receipt:'+requestId);
    if (saved) { var receipt=JSON.parse(saved);return receipt.who===who&&receipt.fingerprint===fingerprint?{ok:true,reference:receipt.reference,attachmentSaved:!!receipt.attachmentSaved}:{ok:false,error:'invalid'}; }
    var key='contact-count:'+who,count=Number(cache.get(key)||0);
    // Per-email/hour and site/day limits reduce bulk abuse without emailing visitors.
    var day=new Date().toISOString().slice(0,10),p=props_(),daily=JSON.parse(p.getProperty('CONTACT_DAILY')||'{}');
    if (daily.day!==day)daily={day:day,count:0};
    if (count>=3 || daily.count>=200) return {ok:false,error:'limit'};
    // Reserve attempts before external uploads so failures cannot bypass quotas.
    daily.count++;p.setProperty('CONTACT_DAILY',JSON.stringify(daily));cache.put(key,String(count+1),3600);
    var attachmentURLs=[];
    // Without a GitHub token for private storage, the files are saved in a private Google Drive folder instead.
    var hasFiles=attachments.length>0,driveOnly=hasFiles&&!props_().getProperty('CONTACT_GITHUB_TOKEN');
    if(driveOnly){try{attachments.forEach(function(a,i){attachmentURLs.push(storeContactDrive_(a,requestId+(i?'-'+(i+1):'')));});}catch(error){return {ok:false,error:'attachment_unavailable'};}}
    if(hasFiles&&!driveOnly){
      // Large GitHub transfers must not hold the lock used by registration and commerce.
      lock.releaseLock();held=false;
      try{attachments.forEach(function(a,i){attachmentURLs.push(storeContactAttachment_(a,requestId+(i?'-'+(i+1):'')));});}catch(error){return {ok:false,error:'attachment_unavailable'};}
      if(!lock.tryLock(10000))return {ok:false,error:'busy'};held=true;
      saved=cache.get('contact-receipt:'+requestId);
      if(saved){var completed=JSON.parse(saved);return completed.fingerprint===fingerprint?{ok:true,reference:completed.reference,attachmentSaved:!!completed.attachmentSaved}:{ok:false,error:'invalid'};}
    }
    var ss=SpreadsheetApp.getActiveSpreadsheet(),sheet=ss.getSheetByName('Contacts');
    if (!sheet) {sheet=ss.insertSheet('Contacts');sheet.appendRow(['Received at','Reference','Name','Email','Topic','Message','Status','Privacy consent']);sheet.setFrozenRows(1);}
    sheet.getRange(1,9,1,4).setValues([['Private attachment','Attachment name','Attachment type','Attachment bytes']]);
    var reference='AJ-'+Utilities.getUuid();
    // Strip leading whitespace before formula escaping, including tabs and newlines.
    sheet.appendRow([new Date(),reference,name,email,topic,message,'New',true,attachmentURLs.join('\n'),attachments.map(function(a){return a.name;}).join(', '),attachments.map(function(a){return a.type;}).join(', '),hasFiles?attachments.reduce(function(n,a){return n+a.bytes.length;},0):''].map(safeSheetCell_));
    cache.put('contact-receipt:'+requestId,JSON.stringify({who:who,fingerprint:fingerprint,reference:reference,attachmentSaved:hasFiles}),21600);
    // A copy to your own support inbox (labelled "Wrapline/Contact" by the Gmail filter). Reply to it and the answer goes to the visitor. A mail problem never loses the message: it is already in the Contacts tab.
    try {
      var copy = { to: replyTo_(), name: 'Wrapline contact form', replyTo: email, subject: 'Contact form (' + topic + '): ' + name.replace(/[\r\n]+/g, ' '),
        body: 'From: ' + name + ' <' + email + '>\nTopic: ' + topic + '\nReference: ' + reference + attachmentURLs.map(function (u, i) { return '\nAttachment' + (attachmentURLs.length > 1 ? ' ' + (i + 1) : '') + ': ' + u; }).join('') + '\n\n' + message + '\n\nReply to this email to answer them directly.' };
      copy.htmlBody = ownerHtml_(copy.subject, copy.body);
      sendNoReply_(copy);
    } catch (mailError) {}
    return {ok:true,reference:reference,attachmentSaved:hasFiles};
  } catch (error) {return {ok:false,error:'unavailable'};}
  finally {if(held)lock.releaseLock();}
}

/* Optional media never goes into the public website repository. */
/* Up to 5 files, 10 MB in total. The older single "attachment" field is still accepted. */
function contactAttachments_(data) {
  var list = Array.isArray(data.attachments) ? data.attachments : (data.attachment !== undefined && data.attachment !== null ? [data.attachment] : []);
  if (list.length > 5) throw Error('attachment');
  var total = 0, out = list.map(function (f) { var a = contactAttachment_(f); total += a.bytes.length; return a; });
  if (total > 10 * 1024 * 1024) throw Error('attachment');
  return out;
}
function contactAttachment_(file) {
  if(file===undefined||file===null)return null;
  if(typeof file!=='object'||Array.isArray(file)||typeof file.name!=='string'||file.name.length>180||/[\\/\x00-\x1f]/.test(file.name))throw Error('attachment');
  var ext=file.name.split('.').pop().toLowerCase(),types={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',mp4:'video/mp4',mov:'video/quicktime'};
  if(!types[ext]||file.type!==types[ext]||!Number.isInteger(file.size)||file.size<1||file.size>10*1024*1024||typeof file.base64!=='string'||file.base64.length>13981016||file.base64.length%4||!/^[A-Za-z0-9+/]*={0,2}$/.test(file.base64))throw Error('attachment');
  var bytes=Utilities.base64Decode(file.base64);if(bytes.length!==file.size)throw Error('attachment');
  var b=bytes.slice(0,32).map(function(n){return(n+256)%256;}),text=function(start,end){return String.fromCharCode.apply(null,b.slice(start,end));};
  var valid=ext==='png'?b.length>=8&&[137,80,78,71,13,10,26,10].every(function(n,i){return b[i]===n;}):ext==='jpg'||ext==='jpeg'?b[0]===255&&b[1]===216&&b[2]===255:ext==='gif'?['GIF87a','GIF89a'].indexOf(text(0,6))>=0:b.length>=12&&(text(4,8)==='ftyp'||ext==='mov'&&['moov','mdat','wide','free'].indexOf(text(4,8))>=0);
  if(!valid)throw Error('attachment');
  var header=Utilities.newBlob('blob '+bytes.length+'\0').getBytes(),sha=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_1,header.concat(bytes)).map(function(n){return('0'+((n+256)%256).toString(16)).slice(-2);}).join('');
  return {name:file.name,type:types[ext],extension:ext==='jpeg'?'jpg':ext,bytes:bytes,base64:Utilities.base64Encode(bytes),sha:sha};
}
/* Private Google Drive folder "Wrapline contact files" in your own Drive; nothing is shared publicly. Run authorizeDrive once after pasting. */
function storeContactDrive_(file,requestId) {
  var name='Wrapline contact files',folders=DriveApp.getFoldersByName(name),folder=folders.hasNext()?folders.next():DriveApp.createFolder(name);
  var stored=requestId+'-'+file.name,existing=folder.getFilesByName(stored);
  var saved=existing.hasNext()?existing.next():folder.createFile(Utilities.newBlob(file.bytes,file.type,stored));
  return saved.getUrl();
}
function authorizeDrive() {
  var name='Wrapline contact files',folders=DriveApp.getFoldersByName(name);
  if(!folders.hasNext())DriveApp.createFolder(name);
  Logger.log('Drive is ready: contact attachments are saved in the private folder "'+name+'".');
}
function storeContactAttachment_(file,requestId) {
  var repo=props_().getProperty('CONTACT_GITHUB_REPO')||'imajoy/Ajoy-Tools-Contact-Details',token=props_().getProperty('CONTACT_GITHUB_TOKEN');
  if(!token||!/^([A-Za-z0-9][A-Za-z0-9_.-]{0,99})\/([A-Za-z0-9][A-Za-z0-9_.-]{0,99})$/.test(repo))throw Error('storage');
  var headers={Authorization:'Bearer '+token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},base='https://api.github.com/repos/'+repo;
  function github(url,options){var response=UrlFetchApp.fetch(url,Object.assign({headers:headers,muteHttpExceptions:true},options||{}));var data;try{data=JSON.parse(response.getContentText());}catch(error){throw Error('storage');}return {status:response.getResponseCode(),data:data};}
  // Recheck every submission: a repository made public must stop accepting attachments.
  var metadata=github(base);if(metadata.status!==200||metadata.data.private!==true||metadata.data.full_name.toLowerCase()!==repo.toLowerCase())throw Error('storage');
  var path='contact-details/'+requestId+'/attachment.'+file.extension,url=base+'/contents/'+path,existing=github(url),stored;
  if(existing.status===200){if(existing.data.sha!==file.sha)throw Error('storage');stored=existing.data;}
  else {
    if(existing.status!==404&&!(existing.status===409&&metadata.data.size===0&&/repository is empty/i.test(existing.data.message||'')))throw Error('storage');
    var result=github(url,{method:'put',contentType:'application/json',payload:JSON.stringify({message:'Store private contact attachment',content:file.base64})});
    if(result.status!==201||result.data.content?.sha!==file.sha)throw Error('storage');stored=result.data.content;
  }
  if(typeof stored.html_url!=='string'||stored.html_url.indexOf('https://github.com/'+repo+'/blob/')!==0)throw Error('storage');
  return stored.html_url;
}

/* ---- Email policy: reputable mailbox providers only, never a throwaway inbox. Mirrors js/email-policy.js. ---- */
var REPUTABLE_DOMAINS_ = ["gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com", "msn.com", "passport.com", "icloud.com", "me.com", "mac.com", "proton.me", "protonmail.com", "protonmail.ch", "pm.me", "zoho.com", "zohomail.com", "zohomail.in", "zohomail.eu", "zohomail.com.au", "zohomail.sa", "zohomail.jp", "zohomail.cn", "zoho.eu", "zoho.in", "fastmail.com", "fastmail.fm", "fastmail.org", "gmx.com", "gmx.net", "gmx.us", "gmx.de", "gmx.co.uk", "mail.com", "aol.com", "yandex.com", "yandex.ru", "ya.ru", "tutanota.com", "tutanota.de", "tuta.io", "tutamail.com", "hey.com", "rediffmail.com", "rediff.com", "ymail.com", "rocketmail.com"];
var DISPOSABLE_DOMAINS_ = ["mailinator.com", "guerrillamail.com", "guerrillamail.net", "guerrillamail.org", "guerrillamail.biz", "guerrillamail.de", "grr.la", "sharklasers.com", "guerrillamailblock.com", "pokemail.net", "spam4.me", "10minutemail.com", "10minutemail.net", "10minemail.com", "20minutemail.com", "tempmail.com", "temp-mail.org", "temp-mail.io", "tempmail.net", "tempmail.dev", "tempmailo.com", "tempail.com", "tempr.email", "tempinbox.com", "temporarymail.com", "yopmail.com", "yopmail.net", "yopmail.fr", "cool.fr.nf", "jetable.fr.nf", "nospam.ze.tc", "nomail.xl.cx", "mega.zik.dj", "speed.1s.fr", "courriel.fr.nf", "moncourrier.fr.nf", "monemail.fr.nf", "monmail.fr.nf", "trashmail.com", "trashmail.net", "trashmail.de", "trashmail.io", "trash-mail.com", "getnada.com", "nada.email", "maildrop.cc", "dispostable.com", "throwawaymail.com", "throwaway.email", "fakeinbox.com", "fakemail.net", "fakemailgenerator.com", "mintemail.com", "mohmal.com", "emailondeck.com", "moakt.com", "moakt.cc", "tmpmail.org", "tmpmail.net", "burnermail.io", "spamgourmet.com", "mailnesia.com", "mytemp.email", "discard.email", "discardmail.com", "disposablemail.com", "disposable-email.ml", "dropmail.me", "33mail.com", "anonbox.net", "mailcatch.com", "mailforspam.com", "mailmoat.com", "mailnull.com", "mailsac.com", "mailtemp.info", "mail-temp.com", "minuteinbox.com", "inboxkitten.com", "instant-mail.de", "incognitomail.com", "harakirimail.com", "spambox.us", "spamex.com", "spamfree24.org", "spamhereplease.com", "tafmail.com", "teleworm.us", "rhyta.com", "dayrep.com", "einrot.com", "fleckens.hu", "gustr.com", "jourrapide.com", "superrito.com", "cuvox.de", "armyspy.com", "tmail.ws", "tmails.net", "emailfake.com", "email-fake.com", "fakeinbox.net", "luxusmail.org", "owlymail.com", "receiveee.com", "smailpro.com", "guerrillamail.info", "fexbox.org", "fexpost.com", "inbox.lv", "getairmail.com", "airmail.cc", "crazymailing.com", "wegwerfmail.de", "wegwerfmail.net", "wegwerfmail.org", "byom.de", "eelmail.com", "emltmp.com", "mailpoof.com", "mailbox.in.ua", "nowmymail.com", "sogetthis.com", "spambog.com", "spambog.de", "tempsky.com", "tmpeml.com", "vomoto.com", "yomail.info", "zetmail.com", "linshiyouxiang.net", "1secmail.com", "1secmail.net", "1secmail.org", "kzccv.com", "qiott.com", "wuuvo.com", "icznn.com", "ezztt.com", "vjuum.com", "laafd.com", "txcct.com", "esiix.com", "xojxe.com", "yoggm.com"];
function emailDomain_(email) { return String(email || '').trim().toLowerCase().split('@').pop(); }
function isDisposableEmail_(email) {
  var d = emailDomain_(email);
  return DISPOSABLE_DOMAINS_.some(function (x) { return d === x || d.slice(-(x.length + 1)) === '.' + x; });
}
function extraEmailDomains_() { return String(props_().getProperty('EXTRA_EMAIL_DOMAINS') || '').toLowerCase().split(/[\s,;]+/).filter(String); }
function emailDomainAllowed_(email) {
  var d = emailDomain_(email);
  if (isDisposableEmail_(email)) return false;
  return REPUTABLE_DOMAINS_.indexOf(d) >= 0 || /^(yahoo|hotmail|live|outlook)\.(com|co\.[a-z]{2}|com\.[a-z]{2}|[a-z]{2})$/.test(d) || extraEmailDomains_().indexOf(d) >= 0;
}
