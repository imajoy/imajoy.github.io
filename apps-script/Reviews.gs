/* ---------- Public tool reviews ----------
   Anyone can read the visible reviews of a tool. Writing needs a signed-in account (verified email).
   One review per account per tool: posting again updates it. Reviews appear at once; set Status to
   "Hidden" in the Reviews tab to take one down (the page updates within about five minutes). */
var REVIEWS_SHEET = 'Reviews';
var REVIEW_HEADERS_ = ['Date', 'Tool', 'Rating', 'Review', 'Name shown', 'Account email (private)', 'Status', 'Review ID', 'Updated'];
var REVIEW_TOOLS_ = ['advanced-ik-fk-switch', 'alembic-exporter', 'audio-exporter', 'fbx-exporter', 'hotkey-manager', 'ik-fk-snap',
  'layer-prefix-remover', 'multi-swapper', 'playblast', 'rebake-ik-space', 'revert-to-last-saved', 'rivet', 'udim-preview'];

function reviewsSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), sheet = ss.getSheetByName(REVIEWS_SHEET);
  if (sheet) return sheet;
  sheet = ss.insertSheet(REVIEWS_SHEET);
  sheet.getRange(1, 1, 1, REVIEW_HEADERS_.length).setValues([REVIEW_HEADERS_]);
  try { styleReviewsSheet_(sheet); } catch (e) {} /* styling must never block a review */
  return sheet;
}

/* Navy header, striped rows, a Visible/Hidden dropdown and a short guide, like the other tabs. */
function styleReviewsSheet_(sheet) {
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, REVIEW_HEADERS_.length).setFontWeight('bold').setFontColor('#ffffff').setVerticalAlignment('middle');
  try { sheet.getRange(1, 1, sheet.getMaxRows(), REVIEW_HEADERS_.length).applyRowBanding(SpreadsheetApp.BandingTheme.BLUE, true, false)
    .setHeaderRowColor('#192859').setFirstRowColor('#ffffff').setSecondRowColor('#f4f6fa'); } catch (e) {}
  sheet.setRowHeight(1, 42);
  [140, 170, 70, 420, 150, 220, 100, 280, 140].forEach(function (w, i) { sheet.setColumnWidth(i + 1, w); });
  sheet.getRange(2, 4, sheet.getMaxRows() - 1, 1).setWrap(true);
  sheet.getRange(2, 1, sheet.getMaxRows() - 1, REVIEW_HEADERS_.length).setVerticalAlignment('top');
  sheet.getRange(2, 7, sheet.getMaxRows() - 1, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['Visible', 'Hidden'], true).build());
  var rules = sheet.getConditionalFormatRules();
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Hidden').setBackground('#fde8e6').setFontColor('#8a2d23').setRanges([sheet.getRange('G2:G')]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Visible').setBackground('#e3f5ec').setFontColor('#1b7958').setRanges([sheet.getRange('G2:G')]).build());
  sheet.setConditionalFormatRules(rules);
  sheet.setHiddenGridlines(true);
  sheet.setTabColor('#f2b705');
  sheet.getRange('K1').setValue('How to use this tab').setFontWeight('bold').setFontColor('#ffffff').setBackground('#192859');
  sheet.getRange('K2:K6').setValues([['Reviews appear on the tool page as soon as they are posted.'], ['To take one down, set Status to Hidden. The site updates within about 5 minutes.'],
    ['The account email is private and never shown on the site.'], ['A reviewer can edit or remove their own review; editing keeps your Hidden choice.'], ['Do not type in columns A–I by hand except Status.']]).setWrap(true);
  sheet.setColumnWidth(11, 360);
}

/* Run once from the editor to create and style the tab (also created automatically on the first review). */
function setupReviews() { reviewsSheet_(); Logger.log('Reviews tab is ready.'); }

function reviewTool_(tool) { tool = String(tool || ''); return REVIEW_TOOLS_.indexOf(tool) >= 0 ? tool : ''; }
function reviewCacheKey_(tool) { return 'rv1:' + tool; }

function readReviews_(tool) {
  var cache = CacheService.getScriptCache(), hit = cache.get(reviewCacheKey_(tool));
  if (hit) return JSON.parse(hit);
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(REVIEWS_SHEET), list = [], dist = [0, 0, 0, 0, 0];
  if (sheet && sheet.getLastRow() > 1) {
    var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, REVIEW_HEADERS_.length).getValues();
    rows.forEach(function (r) {
      var rating = Number(r[2]);
      if (String(r[1]) !== tool || String(r[6]) !== 'Visible' || !(rating >= 1 && rating <= 5)) return;
      dist[rating - 1]++;
      var updated = r[8] instanceof Date ? r[8] : (r[0] instanceof Date ? r[0] : new Date(r[0]));
      list.push({ id: String(r[7]), rating: rating, text: String(r[3]).replace(/^'/, ''), name: String(r[4]).replace(/^'/, ''), date: updated.toISOString() });
    });
  }
  list.sort(function (a, b) { return a.date < b.date ? 1 : -1; });
  var count = list.length, total = list.reduce(function (s, r) { return s + r.rating; }, 0);
  var data = { tool: tool, count: count, average: count ? Math.round(total / count * 10) / 10 : 0, distribution: dist, reviews: list.slice(0, 60) };
  try { cache.put(reviewCacheKey_(tool), JSON.stringify(data), 300); } catch (e) {}
  return data;
}

/* The signed-in reviewer's own review for this tool (shown to them even when hidden). */
function myReview_(tool, email) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(REVIEWS_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return null;
  var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, REVIEW_HEADERS_.length).getValues();
  for (var i = 0; i < rows.length; i++) if (String(rows[i][1]) === tool && String(rows[i][5]).toLowerCase() === email)
    return { row: i + 2, id: String(rows[i][7]), date: (rows[i][8] instanceof Date ? rows[i][8] : new Date(rows[i][0] || Date.now())).toISOString(), rating: Number(rows[i][2]), text: String(rows[i][3]).replace(/^'/, ''), name: String(rows[i][4]).replace(/^'/, ''), hidden: String(rows[i][6]) === 'Hidden' };
  return null;
}

function handleReviews_(d) {
  try {
    var tool = reviewTool_(d.tool);
    if (!tool) return { ok: false, error: 'invalid' };
    var op = String(d.op || 'list');
    var who = d.accountToken ? readSession_(d.accountToken) : null;
    if (op === 'list') {
      var out = readReviews_(tool); out.ok = true;
      if (who) { var mine = myReview_(tool, who.email.toLowerCase()); out.mine = mine ? { id: mine.id, date: mine.date, rating: mine.rating, text: mine.text, name: mine.name, hidden: mine.hidden } : null; out.signedIn = true; }
      return out;
    }
    if (!who) return { ok: false, error: 'signin' };
    var email = who.email.toLowerCase();
    var lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) return { ok: false, error: 'busy' };
    try {
      var cache = CacheService.getScriptCache(), limitKey = 'rv-limit:' + sign_('review:' + email), used = Number(cache.get(limitKey) || 0);
      if (used >= 20) return { ok: false, error: 'limit' };
      var sheet = reviewsSheet_(), existing = myReview_(tool, email);
      if (op === 'delete') {
        if (existing) sheet.deleteRow(existing.row);
      } else if (op === 'save') {
        var rating = Number(d.rating), text = String(d.text || '').replace(/\s+\n/g, '\n').trim(), name = String(d.name || '').replace(/\s+/g, ' ').trim();
        if (!(rating >= 1 && rating <= 5 && Math.round(rating) === rating) || text.length < 10 || text.length > 1500 || name.length < 2 || name.length > 40 || /https?:\/\/|www\./i.test(name)) return { ok: false, error: 'invalid' };
        var now = new Date();
        if (existing) {
          sheet.getRange(existing.row, 3, 1, 3).setValues([[rating, safeSheetCell_(text), safeSheetCell_(name)]]);
          sheet.getRange(existing.row, 9).setValue(now);
        } else {
          sheet.appendRow([now, tool, rating, safeSheetCell_(text), safeSheetCell_(name), email, 'Visible', 'RV-' + Utilities.getUuid(), now]);
        }
      } else return { ok: false, error: 'invalid' };
      cache.put(limitKey, String(used + 1), 86400);
      cache.remove(reviewCacheKey_(tool));
    } finally { lock.releaseLock(); }
    var fresh = readReviews_(tool), mineNow = myReview_(tool, email);
    fresh.ok = true; fresh.signedIn = true;
    fresh.mine = mineNow ? { id: mineNow.id, date: mineNow.date, rating: mineNow.rating, text: mineNow.text, name: mineNow.name, hidden: mineNow.hidden } : null;
    return fresh;
  } catch (err) { return { ok: false, error: 'unavailable' }; }
}
