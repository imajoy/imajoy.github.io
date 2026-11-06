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
