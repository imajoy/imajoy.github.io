/* Begin after the DOM and two painted frames, including cold/hard reloads. */
(function () {
  'use strict';
  var root = document.documentElement;
  if (root.dataset.makerMotion === 'skip') return;
  var motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (motion.matches) return;
  var started = false;
  var finished = false;
  root.classList.add('pill-pending');

  function finish() {
    /* anything held back until the pill bar is done (the hero's subscription/trial banner) is released here at the latest */
    if (root.classList.contains('pill-pending') || root.classList.contains('pill-entering')) root.classList.add('tb-reveal');
    finished = true;
    root.classList.remove('pill-pending', 'pill-entering');
  }
  function start() {
    if (started || finished || document.visibilityState === 'hidden') return;
    if (motion.matches || !document.querySelector('.pillbar, .commerce-header .wrap')) { finish(); return; }
    started = true;
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        // The page settles first: on pages with a hero, wait for its own entrance to get going, then a short beat before the drop.
        var t0 = Date.now(), hero = !!document.querySelector('.hv-shell');
        (function wait() {
          if (finished) return;
          /* never play behind the Wrapline loader or the home-page intro: the drop starts once the page itself is on screen */
          var cover = document.getElementById('pg-ph') || document.getElementById('lx-ph') || document.getElementById('pg-skel') || document.getElementById('lx-intro') || document.getElementById('pg-ring');
          var lifting = cover && (cover.classList.contains('done') || cover.classList.contains('out'));
          var covered = (cover && !lifting) || (!cover && root.classList.contains('lx-intro-on'));
          if (covered && Date.now() - t0 < 12000) { setTimeout(wait, 30); return; }
          if (hero && !root.classList.contains('hv-go') && Date.now() - t0 < 2800) { setTimeout(wait, 60); return; }
          /* start right as the cover lifts, so the drop is the first thing seen and never feels late */
          setTimeout(fire, cover && cover.id === 'lx-intro' ? 520 : cover ? 60 : hero ? 260 : 140);
        })();
        function fire() {
          if (finished) return;
          if (document.visibilityState === 'hidden') { started = false; return; }
          root.classList.replace('pill-pending', 'pill-entering');
          setTimeout(function () { if (!finished) root.classList.add('tb-reveal'); }, 2300);
          setTimeout(finish, 3200);
        }
      });
    });
  }
  window.addEventListener('load', start, { once: true });
  document.addEventListener('visibilitychange', function () {
    if (document.readyState !== 'loading') start();
  });
  document.addEventListener('focusin', function (event) {
    if (event.target.closest('.pillbar, .commerce-header .wrap')) finish();
  });
  motion.addEventListener('change', function () { if (motion.matches) finish(); });
  // A stalled asset must not leave navigation waiting indefinitely.
  document.addEventListener('DOMContentLoaded', start, { once: true });
  window.addEventListener('pageshow', function (event) { if (event.persisted) finish(); });
  if (document.readyState !== 'loading') start();
})();
