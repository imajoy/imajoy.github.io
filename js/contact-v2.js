/* Contact page: topic cards fill the "What can we help with?" menu; a soft light follows the pointer on the form card. */
(function () {
  var sel = document.getElementById('contact-topic'), btns = [].slice.call(document.querySelectorAll('.c-topic'));
  function mark() { btns.forEach(function (b) { b.setAttribute('aria-pressed', sel && sel.value === b.dataset.topic ? 'true' : 'false'); }); }
  if (sel && btns.length) {
    btns.forEach(function (b) {
      b.addEventListener('click', function () {
        sel.value = sel.value === b.dataset.topic ? 'general' : b.dataset.topic;
        sel.dispatchEvent(new Event('change', { bubbles: true })); mark();
        var m = document.getElementById('contact-name'); if (m && !m.value) m.focus({ preventScroll: matchMedia('(min-width:801px)').matches });
      });
    });
    sel.addEventListener('change', mark); mark();
  }
  var form = document.getElementById('contact-form');
  if (form && matchMedia('(hover:hover) and (pointer:fine)').matches && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var f = 0, ex = 0, ey = 0;
    form.addEventListener('pointermove', function (e) {
      ex = e.clientX; ey = e.clientY; if (f) return;
      f = requestAnimationFrame(function () { f = 0; var r = form.getBoundingClientRect(); form.style.setProperty('--mx', (ex - r.left) + 'px'); form.style.setProperty('--my', (ey - r.top) + 'px'); form.classList.add('lit'); });
    });
    form.addEventListener('pointerleave', function () { cancelAnimationFrame(f); f = 0; form.classList.remove('lit'); });
  }
})();
