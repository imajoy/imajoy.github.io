/* Depth for the home page: hero stage that follows the pointer, tilt+glare cards, scroll-driven perspective,
   count-up numbers, magnetic buttons. One rAF loop, only transform/translate/opacity writes, runs only when needed. */
(function () {
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = matchMedia('(hover:hover) and (pointer:fine)').matches;
  var home = document.querySelector('main.home'); if (!home) return;
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };

  /* count-up when numbers appear */
  var counters = [].slice.call(home.querySelectorAll('.h-facts dt, .h-num'));
  counters.forEach(function (el) { var t = el.firstChild; if (!t || t.nodeType !== 3) return; var m = t.nodeValue.match(/^(\d+)$/); if (m) el._n = +m[1], el._t = t; });
  if (!reduce && 'IntersectionObserver' in window) {
    var cio = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return; cio.unobserve(e.target); var el = e.target, n = el._n, t0 = performance.now();
        (function step(now) { var k = clamp((now - t0) / 1100, 0, 1), v = 1 - Math.pow(1 - k, 4); el._t.nodeValue = Math.round(n * v); if (k < 1) requestAnimationFrame(step); })(t0);
      });
    }, { threshold: .6 });
    counters.forEach(function (el) { if (el._n) cio.observe(el); });
  }
  if (reduce) return;

  if (!fine) return;

  /* tilt + glare on cards */
  home.querySelectorAll('[data-tilt]').forEach(function (el) {
    var f = 0, ex = 0, ey = 0;
    el.addEventListener('pointermove', function (e) {
      ex = e.clientX; ey = e.clientY; if (f) return;
      f = requestAnimationFrame(function () {
        f = 0; var b = el.getBoundingClientRect(), x = (ex - b.left) / b.width, y = (ey - b.top) / b.height;
        el.classList.add('tilting'); el.style.setProperty('--ry', ((x - .5) * 12).toFixed(2) + 'deg'); el.style.setProperty('--rx', ((.5 - y) * 10).toFixed(2) + 'deg');
        el.style.setProperty('--gx', (x * 100).toFixed(1) + '%'); el.style.setProperty('--gy', (y * 100).toFixed(1) + '%'); el.style.setProperty('--ga', '1');
      });
    });
    el.addEventListener('pointerleave', function () { cancelAnimationFrame(f); f = 0; el.classList.remove('tilting'); el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); el.style.setProperty('--ga', '0'); });
  });

  /* hero stage: follows the pointer, sways on its own when you are not touching it */
  var stage = home.querySelector('[data-stage]'), hero = home.querySelector('.h-hero');
  if (stage && hero) {
    var demo = stage.querySelector('.h-demo'), tiles = [].slice.call(stage.querySelectorAll('.h-tile')), orbs = [].slice.call(hero.querySelectorAll('.h-orb'));
    var tx = 0, ty = 0, cx = 0, cy = 0, hot = false, vis = true, run = 0;
    hero.addEventListener('pointermove', function (e) { var b = hero.getBoundingClientRect(); tx = (e.clientX - b.left) / b.width - .5; ty = (e.clientY - b.top) / b.height - .5; hot = true; wake(); });
    hero.addEventListener('pointerleave', function () { hot = false; wake(); });
    stage.addEventListener('pointermove', function (e) { var b = demo.getBoundingClientRect(); demo.style.setProperty('--gx', ((e.clientX - b.left) / b.width * 100).toFixed(1) + '%'); demo.style.setProperty('--gy', ((e.clientY - b.top) / b.height * 100).toFixed(1) + '%'); demo.style.setProperty('--ga', '1'); });
    stage.addEventListener('pointerleave', function () { demo.style.setProperty('--ga', '0'); });
    new IntersectionObserver(function (es) { vis = es[0].isIntersecting; if (vis && !run) run = requestAnimationFrame(loop); }).observe(hero);
    function wake() { if (vis && !run) run = requestAnimationFrame(loop); }
    function loop() {
      run = 0; if (!vis || document.hidden) return;
      var gx = hot ? tx : 0, gy = hot ? ty : 0;
      cx += (gx - cx) * .08; cy += (gy - cy) * .08;
      var ry = (cx * 14).toFixed(2) + 'deg', rx = (-cy * 11).toFixed(2) + 'deg';
      demo.style.setProperty('--ry', ry); demo.style.setProperty('--rx', rx);
      tiles.forEach(function (el) { el.style.setProperty('--ry', ry); el.style.setProperty('--rx', rx); });
      if (orbs[0]) orbs[0].style.translate = (cx * -60).toFixed(1) + 'px ' + (cy * -40).toFixed(1) + 'px';
      if (orbs[1]) orbs[1].style.translate = (cx * 70).toFixed(1) + 'px ' + (cy * 50).toFixed(1) + 'px';
      if (Math.abs(cx - gx) + Math.abs(cy - gy) > .002) run = requestAnimationFrame(loop);
    }
  }

  /* magnetic buttons */
  home.querySelectorAll('.btn').forEach(function (b) {
    var f = 0, ex = 0, ey = 0;
    b.addEventListener('pointermove', function (e) {
      ex = e.clientX; ey = e.clientY; if (f) return;
      f = requestAnimationFrame(function () { f = 0; var r = b.getBoundingClientRect(); b.style.translate = ((ex - r.left - r.width / 2) * .16).toFixed(1) + 'px ' + (((ey - r.top - r.height / 2) * .22) - 2).toFixed(1) + 'px'; });
    });
    b.addEventListener('pointerleave', function () { cancelAnimationFrame(f); f = 0; b.style.translate = ''; });
  });
})();
