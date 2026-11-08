/* Begin after the DOM and two painted frames, including cold/hard reloads. */
(function () {
  'use strict';
  var root = document.documentElement;
  if (root.dataset.makerMotion === 'skip') return;
  var motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (motion.matches) return;
  /* Moving between pages of the site, the pill bar travels with the page (view transition), so it only drops in on a first visit or a reload. */
  var navType = '';
  try { navType = (performance.getEntriesByType('navigation')[0] || {}).type || ''; } catch (e) {}
  var inSite = false;
  try { inSite = !!document.referrer && new URL(document.referrer).origin === location.origin; } catch (e) {}
  if ('PageRevealEvent' in window && inSite && navType !== 'reload') return;
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
    if (motion.matches || !document.querySelector('.pillbar')) { finish(); return; }
    started = true;
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        // The page settles first: on pages with a hero, wait for its own entrance to get going, then a short beat before the drop.
        var t0 = Date.now(), hero = !!document.querySelector('.hv-shell');
        (function wait() {
          if (finished) return;
          if (hero && !root.classList.contains('hv-go') && Date.now() - t0 < 2800) { setTimeout(wait, 60); return; }
          setTimeout(fire, hero ? 900 : 350);
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
    if (event.target.closest('.pillbar')) finish();
  });
  motion.addEventListener('change', function () { if (motion.matches) finish(); });
  // A stalled asset must not leave navigation waiting indefinitely.
  document.addEventListener('DOMContentLoaded', start, { once: true });
  window.addEventListener('pageshow', function (event) { if (event.persisted) finish(); });
  if (document.readyState !== 'loading') start();
})();
