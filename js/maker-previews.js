/* Animate only visible previews; no timers or frame-by-frame JavaScript. */
(function () {
  var cards = document.querySelectorAll('.mp-card');
  if (!cards.length) return;
  var preference = matchMedia('(prefers-reduced-motion: reduce)');
  var visible = new Set();
  function sync() {
    cards.forEach(function (card) {
      card.toggleAttribute('data-preview-paused', document.hidden || preference.matches || !visible.has(card));
    });
  }
  if ('IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) visible.add(entry.target);
        else visible.delete(entry.target);
      });
      sync();
    }, { threshold: 0.05 });
    cards.forEach(function (card) { observer.observe(card); });
  }
  document.addEventListener('visibilitychange', sync);
  preference.addEventListener('change', sync);
  sync();
})();
