/* Automatic day / night theme.
   Night (dark) runs from 6 pm to 6 am and day (light) from 6 am to 6 pm, by the visitor's own clock, so every country
   gets its own sunset-ish switch with no location lookup. The theme is chosen before the page paints (this file loads
   in the head, so there is no flash), and a page left open changes by itself at 6 am / 6 pm.
   A visitor who presses the sun/moon button keeps their choice until the next 6 am / 6 pm change, then the clock takes
   over again. Nothing is sent anywhere; the choice is kept in this browser only. */
(function () {
  var root = document.documentElement, HOLD = 'ajoy-theme-hold', timer = 0;
  function isNight(d) { var h = d.getHours(); return h >= 18 || h < 6; }
  function byClock() { return isNight(new Date()) ? 'dark' : 'light'; }
  /* the next moment the clock flips: 6 am if it is before 6 am, 6 pm if before 6 pm, otherwise 6 am tomorrow */
  function nextFlip() {
    var d = new Date(), n = new Date(d.getTime()), h = d.getHours();
    n.setMinutes(0, 0, 0);
    if (h < 6) n.setHours(6); else if (h < 18) n.setHours(18); else { n.setDate(n.getDate() + 1); n.setHours(6); }
    return n.getTime();
  }
  function held() {
    try {
      var h = JSON.parse(localStorage.getItem(HOLD) || 'null');
      if (h && (h.t === 'dark' || h.t === 'light') && h.u > Date.now()) return h.t;
    } catch (e) {}
    return null;
  }
  function wanted() { return held() || byClock(); }
  function paint(t) {
    root.setAttribute('data-theme', t);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t === 'dark' ? '#080C18' : '#E9EDF3');
    var btn = document.getElementById('theme');
    if (btn) btn.setAttribute('aria-label', t === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
  }
  /* a gentle colour fade when the clock changes the theme while the page is open */
  function refresh() {
    var t = wanted();
    if (root.getAttribute('data-theme') !== t) {
      root.classList.add('theme-fx'); paint(t);
      setTimeout(function () { root.classList.remove('theme-fx'); }, 460);
    }
    schedule();
  }
  function schedule() {
    clearTimeout(timer);
    var wait = Math.max(1000, Math.min(nextFlip() - Date.now() + 500, 2147483000));
    timer = setTimeout(refresh, wait);
  }
  paint(wanted());
  document.addEventListener('DOMContentLoaded', function () { paint(root.getAttribute('data-theme')); });
  /* a sleeping tab or laptop wakes up late: check again when the page comes back */
  document.addEventListener('visibilitychange', function () { if (!document.hidden) refresh(); });
  schedule();
  window.AjoyTheme = {
    /* called by the sun/moon button: keep this choice until the next 6 am / 6 pm flip */
    hold: function (t) { try { localStorage.setItem(HOLD, JSON.stringify({ t: t, u: nextFlip() })); } catch (e) {} schedule(); },
    byClock: byClock
  };
})();
