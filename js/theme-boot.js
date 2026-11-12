/* Theme for every page: light by default, dark only when the visitor picks Dark in the profile menu (Appearance).
   The choice is kept in this browser and applied before the page paints (this file loads in the head, so there is no flash).
   Switching plays a soft bloom from the middle of the screen.
   AUTO (follow the clock: dark 6 pm to 6 am) is switched off. Its code is kept below behind the AUTO flag, so it can be
   turned back on later by setting AUTO to true and un-hiding the Auto option in js/profile-menu.js. */
(function () {
  var root = document.documentElement, AUTO = false, timer = 0;
  function isNight(d) { var h = d.getHours(); return h >= 18 || h < 6; }
  function byClock() { return isNight(new Date()) ? 'dark' : 'light'; }
  function nextFlip() {
    var d = new Date(), n = new Date(d.getTime()), h = d.getHours();
    n.setMinutes(0, 0, 0);
    if (h < 6) n.setHours(6); else if (h < 18) n.setHours(18); else { n.setDate(n.getDate() + 1); n.setHours(6); }
    return n.getTime();
  }
  /* the lasting choice made in the profile menu */
  function pinned() { try { var t = localStorage.getItem('ajoy-theme-pin'); return t === 'dark' || t === 'light' ? t : null; } catch (e) { return null; } }
  function wanted() { return pinned() || (AUTO ? byClock() : 'light'); }
  function paint(t) {
    root.setAttribute('data-theme', t);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t === 'dark' ? '#080C18' : '#E9EDF3');
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
  /* only used when AUTO is on: the clock changes the theme while the page is open */
  function refresh() { var t = wanted(); if (root.getAttribute('data-theme') !== t) shift(t); schedule(); }
  function schedule() { clearTimeout(timer); if (!AUTO) return; timer = setTimeout(refresh, Math.max(1000, Math.min(nextFlip() - Date.now() + 500, 2147483000))); }
  paint(wanted());
  /* leftovers from the old sun/moon button and the old welcome effect are cleared */
  try { localStorage.removeItem('ajoy-theme'); localStorage.removeItem('ajoy-theme-hold'); sessionStorage.removeItem('ajoy-theme-intro'); } catch (e) {}
  document.addEventListener('DOMContentLoaded', function () { paint(root.getAttribute('data-theme')); });
  /* the same choice follows the visitor across open tabs */
  addEventListener('storage', function (e) { if (e.key === 'ajoy-theme-pin') { var t = wanted(); if (root.getAttribute('data-theme') !== t) paint(t); } });
  schedule();
  window.AjoyTheme = {
    hold: function () {},
    byClock: byClock,
    /* profile menu: 'light' | 'dark' keeps that theme on this browser. 'auto' is accepted only while AUTO is on; otherwise it means light. */
    pin: function (t) {
      try { if (t === 'dark' || t === 'light') localStorage.setItem('ajoy-theme-pin', t); else localStorage.removeItem('ajoy-theme-pin'); } catch (e) {}
      var w = wanted(); if (root.getAttribute('data-theme') !== w) shift(w); schedule();
    },
    mode: function () { return pinned() || (AUTO ? 'auto' : 'light'); },
    auto: AUTO,
    shift: shift
  };
})();
