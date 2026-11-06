/* Pill bar: eases away when you scroll down, eases back (with a soft blur) when you scroll up. Every page. */
(function () {
  var header = document.querySelector('.site-header');
  if (!header) return;
  var prev = Math.max(0, window.scrollY), travel = 0, pending = false;
  function show() { header.removeAttribute('data-scroll-hidden'); travel = 0; }
  function update() {
    pending = false;
    var max = document.documentElement.scrollHeight - window.innerHeight;
    var y = Math.max(0, Math.min(window.scrollY, max));
    var d = y - prev; prev = y;
    if (y < 80 || max - y < 4 || header.querySelector(':focus-visible, [aria-expanded="true"]')) { show(); return; }
    if (!d) return;
    if ((d > 0) !== (travel > 0)) travel = 0;
    travel += d;
    if (travel > 40) { header.setAttribute('data-scroll-hidden', ''); travel = 0; }
    else if (travel < -16) show();
  }
  window.addEventListener('scroll', function () { if (!pending) { pending = true; requestAnimationFrame(update); } }, { passive: true });
  header.addEventListener('focusin', show);
})();
