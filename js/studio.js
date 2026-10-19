/* Ajoy Tools home page: theme switch, footer year and gentle section entrances. Content stays visible without this script. */
(function () {
  var root = document.documentElement, btn = document.getElementById('theme');
  function label() { if (btn) btn.setAttribute('aria-label', root.getAttribute('data-theme') === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'); }
  label();
  if (btn) btn.addEventListener('click', function () {
    var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('ajoy-theme', next); } catch (e) {}
    label();
  });
  var year = document.getElementById('year'); if (year) year.textContent = new Date().getFullYear();
  var shelf=document.querySelector('.s-shelf'),shelfVisible=false;
  if(shelf){
    var preference=matchMedia('(prefers-reduced-motion:reduce)');
    var syncShelf=function(){shelf.toggleAttribute('data-motion-paused',!shelfVisible||document.hidden||preference.matches);};
    if('IntersectionObserver'in window)new IntersectionObserver(function(entries){shelfVisible=entries[0].isIntersecting;syncShelf();}).observe(shelf);
    document.addEventListener('visibilitychange',syncShelf);preference.addEventListener('change',syncShelf);syncShelf();
  }
  if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var items = document.querySelectorAll('.s-head, .s-card, .s-point, .s-contact-card');
  root.classList.add('js-ready');
  var seen = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-in'); seen.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -8% 0px' });
  items.forEach(function (el, i) { el.classList.add('s-reveal'); el.style.transitionDelay = (i % 3) * 80 + 'ms'; seen.observe(el); });
})();
