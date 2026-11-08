/* Light / dark switch for every page with the sun/moon button.
   Where the browser supports View Transitions, the new theme blooms from a soft glow in the middle of the screen: the browser
   draws a still of the old page and of the new page and only the circle mask moves, so nothing re-lays out and nothing jitters.
   Without that support (or for people who turned animations off) it is a short colour fade. One shared script replaces the
   separate toggles in main.js and studio.js: this one runs first and stops the event. */
(function () {
  var root = document.documentElement, busy = false;
  var calm = matchMedia('(prefers-reduced-motion: reduce)');
  function apply(next) {
    root.setAttribute('data-theme', next);
    if (window.AjoyTheme) window.AjoyTheme.hold(next);
    var btn = document.getElementById('theme');
    if (btn) btn.setAttribute('aria-label', next === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', next === 'dark' ? '#080C18' : '#E9EDF3');
  }
  function fade(next) {
    root.classList.add('theme-fx');
    apply(next);
    setTimeout(function () { root.classList.remove('theme-fx'); busy = false; }, 460);
  }
  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('#theme');
    if (!btn) return;
    e.stopImmediatePropagation(); e.preventDefault();
    if (busy) return;
    busy = true;
    var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    if (!document.startViewTransition) { fade(next); return; }
    root.classList.add('theme-vt');
    if (calm.matches) root.classList.add('theme-soft');
    var vt;
    try { vt = document.startViewTransition(function () { apply(next); }); }
    catch (err) { root.classList.remove('theme-vt', 'theme-soft'); fade(next); return; }
    vt.ready.then(function () {
      if (calm.matches) return;
      /* a small glow in the middle slowly widens, its soft edge blurred, until the new theme fills the screen;
         the old page softens and dims a little as it gives way */
      var big = Math.ceil(Math.hypot(innerWidth, innerHeight) * 2.5) + 'px', o = { duration: 1500, easing: 'cubic-bezier(.45,.05,.25,1)', fill: 'both' };
      root.animate({ maskSize: ['40px 40px', big + ' ' + big], webkitMaskSize: ['40px 40px', big + ' ' + big], filter: ['blur(18px) brightness(1.25)', 'blur(0px) brightness(1)'] },
        Object.assign({ pseudoElement: '::view-transition-new(root)' }, o));
      root.animate({ filter: ['blur(0px)', 'blur(10px)'], opacity: [1, .55] },
        Object.assign({ pseudoElement: '::view-transition-old(root)' }, o, { easing: 'ease-in-out' }));
    }).catch(function () {});
    vt.finished.then(function () {}, function () {}).then(function () {
      root.classList.remove('theme-vt', 'theme-soft'); busy = false;
    });
  }, true);
})();
