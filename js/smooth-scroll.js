/* Every page: a soft load-in for the first block of content. Off with reduced motion. No libraries. */
(function () {
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;
  var root = document.documentElement;

  /* ---- load-in: first section's children rise one after another (skips anything that already has its own animation) ---- */
  function intro() {
    var main = document.querySelector('main'); if (!main || main.classList.contains('home') || !main.animate) return;
    var first = main.querySelector(':scope > section, :scope > .wrap, :scope > div') || main;
    var box = first.querySelector(':scope > .wrap') || first;
    var kids = [].slice.call(box.children).filter(function (el) {
      return !el.hasAttribute('data-r') && !el.classList.contains('reveal') && !el.hidden && getComputedStyle(el).animationName === 'none';
    }).slice(0, 7);
    kids.forEach(function (el, i) {
      el.animate([{ opacity: 0, translate: '0 26px' }, { opacity: 1, translate: '0 0' }], { duration: 900, delay: 80 + i * 90, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', intro); else intro();

  /* Scrolling itself is left to the browser: its own wheel/touch scrolling runs on the compositor and stays smooth even when
     the page is busy. (A script-driven wheel smoother ran on the main thread and stuttered whenever anything else painted.) */
})();
