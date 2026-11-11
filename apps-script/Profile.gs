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
/* Profile picture: a small square JPEG sent as a data URL (the site shrinks it to about 192px first). Anything else is dropped. */
function profilePhoto_(v) {
  var s = String(v == null ? '' : v);
  return /^data:image\/jpeg;base64,[A-Za-z0-9+\/=]+$/.test(s) && s.length <= 40000 ? s : '';
}
/* The picture is also kept as a real file in the owner's private Drive: "Wrapline profile photos" / <account email> / profile-photo.jpg.
   The site asks for this in the background right after a picture is saved or removed (step profile-photo-sync). A new picture replaces the old file; removing it (or deleting the account) moves the file and the account's folder to the Drive bin. Drive trouble never blocks saving the profile. */
var PROFILE_PHOTO_ROOT_ = 'Wrapline profile photos';
function profilePhotoFolder_(email, create) {
  var roots = DriveApp.getFoldersByName(PROFILE_PHOTO_ROOT_), root = roots.hasNext() ? roots.next() : (create ? DriveApp.createFolder(PROFILE_PHOTO_ROOT_) : null);
  if (!root) return null;
  var own = root.getFoldersByName(email);
  return own.hasNext() ? own.next() : (create ? root.createFolder(email) : null);
}
function profilePhotoSave_(email, photo) {
  try {
    var folder = profilePhotoFolder_(email, true), old = folder.getFiles();
    while (old.hasNext()) old.next().setTrashed(true);
    folder.createFile(Utilities.newBlob(Utilities.base64Decode(photo.split(',')[1]), 'image/jpeg', 'profile-photo.jpg'));
  } catch (error) {}
}
function profilePhotoDrop_(email) {
  try {
    var folder = profilePhotoFolder_(email, false); if (!folder) return;
    var files = folder.getFiles(); while (files.hasNext()) files.next().setTrashed(true);
    folder.setTrashed(true);
  } catch (error) {}
}
function profileClean_(input) {
  var p = input && typeof input === 'object' ? input : {}, text = function (v, n) { return clip_(String(v == null ? '' : v), n).replace(/[\u0000-\u001f\u007f]+/g, ' ').trim(); };
  var multi = function (v, n) { return clip_(String(v == null ? '' : v), n).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]+/g, ' ').trim(); };
  var out = { name: text(p.name, 120), address: multi(p.address, 400), postal: text(p.postal, 24), city: text(p.city, 100), region: text(p.region, 100),
    companyOn: p.companyOn === true, company: text(p.company, 160), companyAddress: multi(p.companyAddress, 400), companyPostal: text(p.companyPostal, 24),
    payment: PROFILE_PAYMENT_.indexOf(p.payment) >= 0 ? p.payment : '',
    saveCard: p.saveCard === true,
    photo: profilePhoto_(p.photo) };
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
  if (step === 'profile-photo-sync') {
    /* Called by the site right after a picture is saved or removed (in the background, so the upload itself stays quick): files the saved picture in Drive, or removes the file. */
    var lock = LockService.getScriptLock(); if (!lock.tryLock(15000)) return { ok: false, error: 'busy' };
    try { var saved = profileRead_(who.email); if (saved && saved.photo) profilePhotoSave_(who.email, saved.photo); else profilePhotoDrop_(who.email); } finally { lock.releaseLock(); }
    return { ok: true };
  }
  if (step === 'profile-get') return { ok: true, profile: profileRead_(who.email) };
  if (step === 'profile-clear') { if (!profileDelete_(who.email)) return { ok: false, error: 'busy' }; profilePhotoDrop_(who.email); return { ok: true, profile: null }; }
  var current = profileRead_(who.email) || profileClean_({}), next = profileClean_(Object.assign({}, current, d.profile && typeof d.profile === 'object' ? d.profile : {}));
  if (!profileWrite_(who.email, next)) return { ok: false, error: 'busy' };
  return { ok: true, profile: next };
}
