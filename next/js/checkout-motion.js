/* Checkout-only motion: unfold each panel, then lift its visible fields into place. */
(function () {
  'use strict';
  var root = document.documentElement;
  var motion = matchMedia('(prefers-reduced-motion: reduce)');
  if (motion.matches || !('IntersectionObserver' in window)) return;
  root.classList.add('checkout-motion');
  var observer;
  var started = false;
  var disabled = false;
  function disable() {
    disabled = true;
    root.classList.remove('checkout-motion');
    if (observer) observer.disconnect();
  }
  // If setup fails or an asset stalls, leave a fully usable form.
  var fallback = setTimeout(disable, 6000);
  function reveal(element) {
    element.setAttribute(element.matches('fieldset') ? 'data-panel-revealed' : 'data-field-revealed', '');
    observer.unobserve(element);
  }
  function start() {
    if (started || disabled || document.visibilityState === 'hidden') return;
    started = true;
    clearTimeout(fallback);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        if (disabled) return;
        observer = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) { if (entry.isIntersecting) reveal(entry.target); });
        }, { threshold: 0, rootMargin: '0px 0px 24px 0px' });
        document.querySelectorAll('.checkout-form fieldset').forEach(function (panel) {
          observer.observe(panel);
          panel.querySelectorAll('.form-field').forEach(function (field, index) {
            field.style.setProperty('--field-delay', (180 + index % 3 * 45) + 'ms');
            observer.observe(field);
          });
        });
      });
    });
  }
  window.addEventListener('load', start, { once: true });
  document.addEventListener('visibilitychange', function () {
    if (document.readyState === 'complete') start();
  });
  // Tabbing, autofocus and browser validation always take priority over decoration.
  document.addEventListener('focusin', function (event) {
    var panel = event.target.closest('.checkout-form fieldset');
    if (!panel) return;
    panel.setAttribute('data-panel-revealed', '');
    panel.setAttribute('data-motion-complete', '');
    panel.querySelectorAll('.form-field').forEach(function (field) {
      field.setAttribute('data-field-revealed', '');
    });
    if (observer) {
      observer.unobserve(panel);
      panel.querySelectorAll('.form-field').forEach(function (field) { observer.unobserve(field); });
    }
  });
  motion.addEventListener('change', function () { if (motion.matches) disable(); });
  window.addEventListener('pageshow', function (event) { if (event.persisted) disable(); });
  if (document.readyState === 'complete') start();
})();
