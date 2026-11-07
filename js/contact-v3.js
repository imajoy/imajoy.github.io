/* Contact: the glass cube leans toward the pointer. Fine pointers only. */
(function () {
  var scene = document.querySelector('.cv-scene'), layout = document.querySelector('.contact-layout');
  if (!scene || !layout || !matchMedia('(hover:hover) and (pointer:fine)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var f = 0, px = 0, py = 0;
  window.addEventListener('pointermove', function (e) {
    px = e.clientX / innerWidth - .5; py = e.clientY / innerHeight - .5; if (f) return;
    f = requestAnimationFrame(function () { f = 0; scene.style.setProperty('--tx', (px * 40).toFixed(1) + 'deg'); scene.style.setProperty('--ty', (-py * 30).toFixed(1) + 'deg'); });
  }, { passive: true });
})();
