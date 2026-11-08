/* Light / dark switch for every page with the sun/moon button.
   Where the browser supports View Transitions, the new theme grows out of the button as a circle: the browser
   draws a still of the old page and of the new page and only the circle mask moves, so nothing re-lays out and nothing jitters.
   Without that support (or for people who turned animations off) it is a short colour fade. One shared script replaces the
   separate toggles in main.js and studio.js: this one runs first and stops the event. */
(function () {
  var root = document.documentElement, busy = false;
  var calm = matchMedia('(prefers-reduced-motion: reduce)');
  function apply(next) {
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('ajoy-theme', next); } catch (e) {}
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
    var r = btn.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    var radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    root.classList.add('theme-vt');
    if (calm.matches) root.classList.add('theme-soft');
    var vt;
    try { vt = document.startViewTransition(function () { apply(next); }); }
    catch (err) { root.classList.remove('theme-vt', 'theme-soft'); fade(next); return; }
    vt.ready.then(function () {
      if (calm.matches) return;
      root.animate(
        { clipPath: ['circle(0px at ' + x + 'px ' + y + 'px)', 'circle(' + radius + 'px at ' + x + 'px ' + y + 'px)'] },
        { duration: 700, easing: 'cubic-bezier(.65,0,.2,1)', pseudoElement: '::view-transition-new(root)' }
      );
    }).catch(function () {});
    vt.finished.then(function () {}, function () {}).then(function () {
      root.classList.remove('theme-vt', 'theme-soft'); busy = false;
    });
  }, true);
})();
