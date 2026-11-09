/* ---------- Saved billing details and preferred payment method ----------
   The site calls {type:'account', step:'profile-get' | 'profile-set' | 'profile-clear', token}.
   Only the verified session's own email is ever read or written; the browser never names an email.
   Country is NOT stored: it always comes from the server's own connection check.
   Rows live in the private "Profiles" tab and are removed when the account is deleted (see AccountDeletion.gs). */
var PROFILE_SHEET_ = 'Profiles';
var PROFILE_PAYMENT_ = ['razorpay', 'paypal'];
function profileSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), sheet = ss.getSheetByName(PROFILE_SHEET_);
  if (!sheet) {
    sheet = ss.insertSheet(PROFILE_SHEET_);
    sheet.appendRow(['Email', 'Updated', 'Details (JSON)']);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, 3).setBackground('#1a2959').setFontColor('#ffffff').setFontWeight('bold');
    sheet.setTabColor('#7a8cc2');
  }
  return sheet;
}
function profileClean_(input) {
  var p = input && typeof input === 'object' ? input : {}, text = function (v, n) { return clip_(String(v == null ? '' : v), n).replace(/[\u0000-\u001f\u007f]+/g, ' ').trim(); };
  var multi = function (v, n) { return clip_(String(v == null ? '' : v), n).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]+/g, ' ').trim(); };
  var out = { name: text(p.name, 120), address: multi(p.address, 400), postal: text(p.postal, 24), city: text(p.city, 100), region: text(p.region, 100),
    companyOn: p.companyOn === true, company: text(p.company, 160), companyAddress: multi(p.companyAddress, 400), companyPostal: text(p.companyPostal, 24),
    payment: PROFILE_PAYMENT_.indexOf(p.payment) >= 0 ? p.payment : '' };
  if (!out.companyOn) { out.company = ''; out.companyAddress = ''; out.companyPostal = ''; }
  return out;
}
function profileRowIndex_(sheet, email) {
  var last = sheet.getLastRow();
  if (last < 2) return 0;
  var emails = sheet.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < emails.length; i++) if (String(emails[i][0]).trim().toLowerCase() === email) return i + 2;
  return 0;
}
function profileRead_(email) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PROFILE_SHEET_);
  if (!sheet) return null;
  var row = profileRowIndex_(sheet, email);
  if (!row) return null;
  try { return profileClean_(JSON.parse(String(sheet.getRange(row, 3, 1, 1).getValues()[0][0] || 'null'))); } catch (e) { return null; }
}
function profileWrite_(email, details) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return false;
  try {
    var sheet = profileSheet_(), row = profileRowIndex_(sheet, email), values = [[email, new Date(), JSON.stringify(details)]];
    if (row) sheet.getRange(row, 1, 1, 3).setValues(values); else sheet.appendRow(values[0]);
    return true;
  } finally { lock.releaseLock(); }
}
function profileDelete_(email) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return false;
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PROFILE_SHEET_);
    var row = sheet ? profileRowIndex_(sheet, email) : 0;
    if (row) sheet.deleteRow(row);
    return true;
  } finally { lock.releaseLock(); }
}
function handleProfile_(d, step) {
  var who = readSession_(d.token);
  if (!who || who.sub) return { ok: false, error: 'expired' };
  if (!registeredEmail_(who.email)) return { ok: false, error: 'not_registered' };
  if (step === 'profile-get') return { ok: true, profile: profileRead_(who.email) };
  if (step === 'profile-clear') return profileDelete_(who.email) ? { ok: true, profile: null } : { ok: false, error: 'busy' };
  var current = profileRead_(who.email) || profileClean_({}), next = profileClean_(Object.assign({}, current, d.profile && typeof d.profile === 'object' ? d.profile : {}));
  return profileWrite_(who.email, next) ? { ok: true, profile: next } : { ok: false, error: 'busy' };
}
