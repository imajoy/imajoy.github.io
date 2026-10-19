/* Begin after the DOM and two painted frames, including cold/hard reloads. */
(function () {
  'use strict';
  var root = document.documentElement;
  var motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (motion.matches) return;
  var started = false;
  var finished = false;
  root.classList.add('pill-pending');

  function finish() {
    finished = true;
    root.classList.remove('pill-pending', 'pill-entering');
  }
  function start() {
    if (started || finished || document.visibilityState === 'hidden') return;
    if (motion.matches || !document.querySelector('.pillbar')) { finish(); return; }
    started = true;
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        // Leave the compact pill visible briefly before it unfolds.
        setTimeout(function () {
          if (finished) return;
          if (document.visibilityState === 'hidden') { started = false; return; }
          root.classList.replace('pill-pending', 'pill-entering');
          setTimeout(finish, 1900);
        }, 160);
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
