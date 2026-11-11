/* Automatic day / night theme.
   Night (dark) runs from 6 pm to 6 am and day (light) from 6 am to 6 pm, by the visitor's own clock, so every country
   gets its own sunset-ish switch with no location lookup. The theme is chosen before the page paints (this file loads
   in the head, so there is no flash), and a page left open changes by itself at 6 am / 6 pm.
   A visitor who presses the sun/moon button keeps their choice until the next 6 am / 6 pm change, then the clock takes
   over again. Nothing is sent anywhere; the choice is kept in this browser only.
   Welcome shift (laptops and tablets; phones skip it and open straight in the right theme): on the first page of a visit the page opens in the OTHER theme (light at night, dark by day) and, once
   it has loaded and settled, glows over into the right one with the same soft bloom as the sun/moon button. It plays
   once per visit (not on every page), and never with "reduce motion" on or after a manual choice. */
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
  /* a lasting choice made in the profile menu (Light / Dark); "Auto" removes it and the 6 am / 6 pm clock takes over */
  function pinned() { try { var t = localStorage.getItem('ajoy-theme-pin'); return t === 'dark' || t === 'light' ? t : null; } catch (e) { return null; } }
  function wanted() { return pinned() || held() || byClock(); }
  function paint(t) {
    root.setAttribute('data-theme', t);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t === 'dark' ? '#080C18' : '#E9EDF3');
    var btn = document.getElementById('theme');
    if (btn) btn.setAttribute('aria-label', t === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
  }
  /* the soft bloom: a glow in the middle widens until the new theme fills the screen (browsers without View Transitions
     get a short colour fade instead) */
  function shift(next, after) {
    var calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
    function fade() {
      root.classList.add('theme-fx'); paint(next);
      setTimeout(function () { root.classList.remove('theme-fx'); if (after) after(); }, 460);
    }
    if (!document.startViewTransition || calm) { fade(); return; }
    root.classList.add('theme-vt');
    var vt;
    try { vt = document.startViewTransition(function () { paint(next); }); }
    catch (err) { root.classList.remove('theme-vt'); fade(); return; }
    vt.ready.then(function () {
      var big = Math.ceil(Math.hypot(innerWidth, innerHeight) * 2.5) + 'px', o = { duration: 1100, easing: 'cubic-bezier(.45,.05,.25,1)', fill: 'both' };
      /* mask and opacity only: a full-page blur filter here made the first seconds of a visit stutter */
      root.animate({ maskSize: ['40px 40px', big + ' ' + big], webkitMaskSize: ['40px 40px', big + ' ' + big] },
        Object.assign({ pseudoElement: '::view-transition-new(root)' }, o));
      root.animate({ opacity: [1, .6] },
        Object.assign({ pseudoElement: '::view-transition-old(root)' }, o, { easing: 'ease-in-out' }));
    }).catch(function () {});
    vt.finished.then(function () {}, function () {}).then(function () { root.classList.remove('theme-vt'); if (after) after(); });
  }
  /* the clock changes the theme while the page is open */
  function refresh() {
    var t = wanted();
    if (root.getAttribute('data-theme') !== t) shift(t);
    schedule();
  }
  function schedule() {
    clearTimeout(timer);
    var wait = Math.max(1000, Math.min(nextFlip() - Date.now() + 500, 2147483000));
    timer = setTimeout(refresh, wait);
  }
  var target = wanted(), intro = false;
  try {
    intro = !pinned() && !held() && !sessionStorage.getItem('ajoy-theme-intro') && !matchMedia('(prefers-reduced-motion: reduce)').matches &&
      !matchMedia('(hover:none) and (pointer:coarse) and (max-width:767px)').matches; /* phones open straight in the right theme: no light/dark flash while loading */
    if (intro) sessionStorage.setItem('ajoy-theme-intro', '1');
  } catch (e) { intro = false; }
  /* first page of a visit: open in the opposite theme, then shift once the page has settled */
  paint(intro ? (target === 'dark' ? 'light' : 'dark') : target);
  if (intro) {
    var go = function () {
      if (held()) return;                           /* the visitor already chose with the button */
      var now = wanted();
      if (root.getAttribute('data-theme') !== now) shift(now);
    };
    var settle = function () { setTimeout(function () { if (document.hidden) { document.addEventListener('visibilitychange', function once() { if (!document.hidden) { document.removeEventListener('visibilitychange', once); setTimeout(go, 600); } }); } else go(); }, 1300); };
    if (document.readyState === 'complete') settle(); else window.addEventListener('load', settle, { once: true });
  }
  document.addEventListener('DOMContentLoaded', function () { paint(root.getAttribute('data-theme')); });
  /* a sleeping tab or laptop wakes up late: check again when the page comes back */
  document.addEventListener('visibilitychange', function () { if (!document.hidden) refresh(); });
  schedule();
  window.AjoyTheme = {
    /* called by the sun/moon button: keep this choice until the next 6 am / 6 pm flip */
    hold: function (t) { try { localStorage.setItem(HOLD, JSON.stringify({ t: t, u: nextFlip() })); } catch (e) {} schedule(); },
    byClock: byClock,
    /* profile menu: 'light' | 'dark' keeps that theme on this browser; 'auto' goes back to the clock */
    pin: function (t) {
      try { if (t === 'light' || t === 'dark') localStorage.setItem('ajoy-theme-pin', t); else { localStorage.removeItem('ajoy-theme-pin'); localStorage.removeItem(HOLD); } } catch (e) {}
      var w = wanted(); if (root.getAttribute('data-theme') !== w) shift(w); schedule();
    },
    mode: function () { return pinned() || 'auto'; },
    shift: shift
  };
})();
