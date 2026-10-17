/* Ajoy Tools: saves download-page emails into the "Subscribers" sheet.
   Column A = Timestamp, Column B = Email.
   New email  -> added as a new row.
   Known email -> the same row gets a new timestamp (overwritten, no duplicate). */
var SHEET_NAME = 'Sheet1';

function doPost(e) {
  var out = ContentService.createTextOutput();
  try {
    var raw = (e && e.postData && e.postData.contents) || '';
    var email = '';
    try { email = String(JSON.parse(raw).email || ''); } catch (err) { email = String((e && e.parameter && e.parameter.email) || ''); }
    email = email.trim().toLowerCase();
    var ok = email.length <= 120 && /^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.(com|in)$/.test(email);
    if (!ok) return out.setContent('invalid');

    var lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
      var last = sheet.getLastRow();
      var now = new Date();
      var row = 0;
      if (last >= 2) {
        var emails = sheet.getRange(2, 2, last - 1, 1).getValues();
        for (var i = 0; i < emails.length; i++) {
          if (String(emails[i][0]).trim().toLowerCase() === email) { row = i + 2; break; }
        }
      }
      if (row) sheet.getRange(row, 1, 1, 2).setValues([[now, email]]);
      else sheet.appendRow([now, email]);
    } finally { lock.releaseLock(); }
    return out.setContent('ok');
  } catch (err) {
    return out.setContent('error');
  }
}

function doGet() { return ContentService.createTextOutput('Ajoy Tools email list is running.'); }
