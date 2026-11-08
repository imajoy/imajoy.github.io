/* Remembers where you clicked so the next page can open from that point (see css/motion.css). */
(function () {
  var K = 'ajoy-vt', root = document.documentElement;
  function save(x, y) { try { sessionStorage.setItem(K, x + ',' + y); } catch (e) {} }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a || a.target || a.hasAttribute('download') || e.defaultPrevented) return;
    save(e.clientX || innerWidth / 2, e.clientY || innerHeight * .6);
  }, true);
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    var a = document.activeElement; if (!a || a.tagName !== 'A') return;
    var r = a.getBoundingClientRect(); save(r.left + r.width / 2, r.top + r.height / 2);
  }, true);
  addEventListener('pagereveal', function (e) {
    if (!e.viewTransition) return;
    var xy = null; try { xy = sessionStorage.getItem(K); } catch (x) {}
    var p = (xy || '').split(',');
    if (p.length === 2) { root.style.setProperty('--vx', p[0] + 'px'); root.style.setProperty('--vy', p[1] + 'px'); }
    var nav = window.navigation && navigation.activation;
    if (nav && nav.navigationType === 'traverse') root.dataset.vt = 'back';
    e.viewTransition.finished.finally(function () { delete root.dataset.vt; });
  });
})();

/* Pages without their own scroll reveal (download, licence and so on): content eases in as it arrives. Home and pages with scroll-fx keep theirs. */
(function () {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
  addEventListener('load', function () {
    var root = document.documentElement;
    if (root.classList.contains('sfx') || document.querySelector('main.home')) return;
    var els = [].slice.call(document.querySelectorAll('main > section > .wrap > *, main > .wrap > *, main > section > *:not(.wrap)'))
      .filter(function (el) { return !el.closest('.reveal,[data-r],[data-policy-reveal],dialog,.coffee,[hidden]') && el.getBoundingClientRect().top > innerHeight * .9; });
    if (!els.length) return;
    root.classList.add('rv-js');
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('rv-in'); io.unobserve(e.target); } }); }, { rootMargin: '0px 0px -8% 0px', threshold: 0 });
    /* very tall blocks (long legal text) are never hidden: a fractional threshold could never be met on a phone */
    els.forEach(function (el) { if (el.getBoundingClientRect().height > innerHeight * .8) return; el.classList.add('rv'); io.observe(el); });
  });
})();

/* Fallback for browsers that cannot animate between documents: fade the page out, then go. */
(function () {
  if ('PageRevealEvent' in window || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var root = document.documentElement; root.classList.add('vt-fb');
  addEventListener('pageshow', function (e) { root.classList.remove('vt-leave'); });
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target || a.hasAttribute('download')) return;
    var u; try { u = new URL(a.href, location.href); } catch (x) { return; }
    if (u.origin !== location.origin || (u.pathname === location.pathname && u.search === location.search) || !/\.html$|\/$/.test(u.pathname)) return;
    e.preventDefault(); root.classList.add('vt-leave');
    setTimeout(function () { location.href = u.href; }, 250);
  });
})();
