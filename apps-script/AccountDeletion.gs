/* ---------- Account and data deletion ----------
   The site calls {type:'account', step:'erase', token, code}. The person must hold a valid session AND type a fresh
   emailed code (request it first with step 'code'), so a stolen token alone cannot delete an account.
   Refuses while a subscription is active or still has paid access left.
   Removes the person's rows from Accounts, Trials, Contacts, Reviews and Passkeys, and anonymizes their rows in every
   other tab (orders, payments, invoices, donations): the email becomes "deleted-xxxxxxxx" and name, company, address
   and message cells are blanked, while dates and amounts stay for tax and accounting records.
   Contact attachments stored in the private GitHub repository must be removed there (see apps-script/README.md). */
var ERASE_DELETE_TABS_ = ['Accounts', 'Trials', 'Contacts', 'Reviews', 'Passkeys'];
var ERASE_PII_HEADER_ = /(^|[^a-z])(name|billed to|buyer details|company|address|city|region|state|postal|zip|phone|message|street|ip address)([^a-z]|$)/i;
function eraseAlias_(email) { return 'deleted-' + b64u_(Utilities.computeHmacSha256Signature('erase:' + email, sessionSecret_())).replace(/[^A-Za-z0-9]/g, '').slice(0, 8).toLowerCase(); }
function eraseHasAccess_(email) {
  var subs = subscriptionsFor_(email, '');
  for (var i = 0; i < subs.length; i++) {
    var s = subs[i], ends = s.endsAt ? new Date(s.endsAt).getTime() : 0;
    if (s.status === 'ACTIVE' || s.renews || ends > Date.now()) return true;
  }
  return false;
}
/* Order records keep their details as JSON text (name, company, address, city, region, postal). Blank those fields and swap the email for the alias. */
var ERASE_JSON_KEYS_ = /^(name|company|address|city|region|postal|zip|phone|buyer)$/i;
function eraseJson_(text, lower, alias) {
  var obj; try { obj = JSON.parse(text); } catch (e) { return text; }
  var walk = function (v) {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') { var o = {}; Object.keys(v).forEach(function (k) { o[k] = ERASE_JSON_KEYS_.test(k) ? (typeof v[k] === 'object' && v[k] ? walk(v[k]) : '') : walk(v[k]); }); return o; }
    if (typeof v === 'string' && v.toLowerCase().indexOf(lower) >= 0) return v.split(new RegExp(lower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig')).join(alias);
    return v;
  };
  return JSON.stringify(walk(obj));
}
function erasePersonalData_(email) {
  var lower = email.toLowerCase(), alias = eraseAlias_(email), ss = SpreadsheetApp.getActiveSpreadsheet(), sheets = ss.getSheets(), removed = 0, anonymized = 0;
  sheets.forEach(function (sheet) {
    var last = sheet.getLastRow(), cols = sheet.getLastColumn();
    if (last < 2 || cols < 1) return;
    var name = sheet.getName(), del = ERASE_DELETE_TABS_.indexOf(name) >= 0;
    var values = sheet.getRange(1, 1, last, cols).getValues(), headers = values[0];
    for (var r = last - 1; r >= 1; r--) {
      var row = values[r], hit = false;
      for (var c = 0; c < row.length; c++) if (typeof row[c] === 'string' && row[c].toLowerCase().indexOf(lower) >= 0) { hit = true; break; }
      if (!hit) continue;
      if (del) { sheet.deleteRow(r + 1); removed++; continue; }
      var next = row.map(function (cell, c) {
        if (typeof cell !== 'string') return cell;
        if (cell.charAt(0) === '{') return eraseJson_(cell, lower, alias);
        if (cell.toLowerCase().indexOf(lower) >= 0) return cell.split(new RegExp(lower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig')).join(alias);
        return ERASE_PII_HEADER_.test(String(headers[c] || '')) ? '' : cell;
      });
      sheet.getRange(r + 1, 1, 1, next.length).setValues([next]); anonymized++;
    }
  });
  return { removed: removed, anonymized: anonymized };
}
function handleErase_(d) {
  var who = readSession_(d.token);
  if (!who || who.sub) return { ok: false, error: 'expired' };
  var email = who.email;
  if (!registeredEmail_(email)) return { ok: false, error: 'not_registered' };
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return { ok: false, error: 'busy' };
  try {
    var cache = CacheService.getScriptCache(), tk = 'tries:' + email, tries = Number(cache.get(tk) || 0);
    if (tries >= 5) return { ok: false, error: 'limit' };
    cache.put(tk, String(tries + 1), 600);
    var record; try { record = JSON.parse(cache.get('code:' + email) || 'null'); } catch (err) {}
    var got = String(d.code || '').trim();
    if (!record || !Number.isFinite(record.expiresAt) || record.expiresAt <= Date.now()) { cache.remove('code:' + email); return { ok: false, error: 'code_expired' }; }
    if (!/^\d{6}$/.test(got) || record.hash !== hashCode_(email, got)) return { ok: false, error: 'code' };
    cache.remove('code:' + email); cache.remove('intent:' + email);
    if (eraseHasAccess_(email)) return { ok: false, error: 'active_subscription' };
    var result = erasePersonalData_(email);
    revokeSessions_(email, true);
    try { sendNoReply_({ to: email, name: 'Wrapline Pro (no-reply)', subject: 'Your Wrapline Pro account was deleted', body: 'Your account and personal data were deleted as you asked. Payment records that must be kept for accounting are anonymized.\n\nIf this was not you, contact ' + replyTo_() + '.' }); } catch (err) {}
    return { ok: true, removed: result.removed, anonymized: result.anonymized };
  } finally { lock.releaseLock(); }
}
