/* Wrapline is a light-mode site. This file used to switch day and night themes; it now only makes sure every page is light,
   clears any theme choice an earlier version saved in this browser, and keeps the old AjoyTheme name alive (doing nothing)
   so older scripts that still call it cannot fail. */
(function () {
  var root = document.documentElement;
  function light() {
    if (root.getAttribute('data-theme') !== 'light') root.setAttribute('data-theme', 'light');
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', '#E9EDF3');
  }
  light();
  try { ['ajoy-theme', 'ajoy-theme-pin', 'ajoy-theme-hold'].forEach(function (k) { localStorage.removeItem(k); }); sessionStorage.removeItem('ajoy-theme-intro'); } catch (e) {}
  document.addEventListener('DOMContentLoaded', light);
  var noop = function () {};
  window.AjoyTheme = { hold: noop, pin: noop, shift: function (t, after) { light(); if (after) after(); }, byClock: function () { return 'light'; }, mode: function () { return 'light'; } };
})();
