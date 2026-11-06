/* Home scroll stage: a pinned frame that opens up while a particle field morphs through four shapes.
   Scroll drives everything; no scroll = still frame. Reduced motion or no JS: a plain, readable block. */
(function () {
  var root = document.querySelector('.hs'); if (!root) return;
  var cv = root.querySelector('canvas'), ctx = cv.getContext('2d'); if (!ctx) return;
  var frame = root.querySelector('.hs-frame'), items = [].slice.call(root.querySelectorAll('.hs-item')), dots = [].slice.call(root.querySelectorAll('.hs-dots i'));
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches, small = matchMedia('(max-width:720px)').matches;
  var N = small ? 700 : 1300, F = 4, TAU = Math.PI * 2, shapes = [];
  function rnd(a) { return (Math.random() - .5) * a; }
  var seed = 7; function r() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
  function make(fn) { var a = new Float32Array(N * 6); for (var i = 0; i < N; i++) { var o = fn(i, i / N); a.set(o, i * 6); } return a; }
  shapes.push(make(function (i, u) { var t = u * TAU * 3, ring = i % 3, R = 1 + ring * .06; var c = Math.cos(t), s = Math.sin(t), L = .26 + r() * .34; return [R * c, R * s, (r() - .5) * .2, c * L, s * L, (r() - .5) * .22]; }));
  shapes.push(make(function (i, u) { var y = 1 - u * 1.0, rad = Math.sqrt(Math.max(0, 1 - y * y)), th = i * 2.399963; var x = Math.cos(th) * rad, z = Math.sin(th) * rad, L = .18 + r() * .2; return [x * .95, -y * .95 + .1, z * .95, x * L, -y * L, z * L]; }));
  shapes.push(make(function (i, u) { var g = Math.ceil(Math.sqrt(N)), gx = i % g, gz = (i / g) | 0, x = (gx / g - .5) * 2.8, z = (gz / g - .5) * 2.8, y = Math.sin(x * 2.2) * Math.cos(z * 2) * .38; return [x, y, z, 0, .22 + (y + .4) * .45, 0]; }));
  shapes.push(make(function (i, u) { var t = u * TAU * 2.2, k = i % 2 ? 1 : -1, R = .85 + .12 * Math.sin(t * 3), x = Math.cos(t) * R, z = Math.sin(t) * R, y = (u - .5) * 2.2 * k * .8; var tx = -Math.sin(t) * .3, tz = Math.cos(t) * .3; return [x, y, z, tx, .05, tz]; }));
  var delay = new Float32Array(N); for (i = 0; i < N; i++) delay[i] = r();
  var i, cur = new Float32Array(N * 6), W = 0, H = 0, dpr = 1, p = reduce ? 0 : 0, sp = 0, px = 0, py = 0, tx = 0, ty = 0, vis = false, raf = 0, t0 = performance.now();
  function size() { var b = frame.getBoundingClientRect(); dpr = Math.min(2, devicePixelRatio || 1); W = Math.max(1, b.width); H = Math.max(1, b.height); cv.width = W * dpr | 0; cv.height = H * dpr | 0; }
  function ease(x) { return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
  function draw(time) {
    sp += (p - sp) * .09;
    var f = Math.min(F - 1, Math.max(0, sp * (F - 1) * 1.0001)), a = Math.min(F - 2, Math.floor(f)), m = f - a, A = shapes[a], B = shapes[a + 1];
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    px += (tx - px) * .06; py += (ty - py) * .06;
    var yaw = time * .00016 + sp * 1.6 + px * .5, pit = -.42 + py * .25 + Math.sin(sp * 3.1) * .12, cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pit), spn = Math.sin(pit);
    var sc = Math.min(W, H * 1.4) * .34, cx = W * (W > 720 ? .66 : .5), cyy = H * (W > 720 ? .5 : .38), cam = 3.4;
    var buckets = [[], [], [], []];
    for (i = 0; i < N; i++) {
      var k = i * 6, e = ease(Math.max(0, Math.min(1, m * 1.7 - delay[i] * .7)));
      var x = A[k] + (B[k] - A[k]) * e, y = A[k + 1] + (B[k + 1] - A[k + 1]) * e, z = A[k + 2] + (B[k + 2] - A[k + 2]) * e;
      var dx = A[k + 3] + (B[k + 3] - A[k + 3]) * e, dy = A[k + 4] + (B[k + 4] - A[k + 4]) * e, dz = A[k + 5] + (B[k + 5] - A[k + 5]) * e;
      var X = x * cy - z * sy, Z = x * sy + z * cy, Y = y * cp - Z * spn, Z2 = y * spn + Z * cp;
      var X2 = (x + dx) * cy - (z + dz) * sy, Zb = (x + dx) * sy + (z + dz) * cy, Y2 = (y + dy) * cp - Zb * spn, Z3 = (y + dy) * spn + Zb * cp;
      var s1 = cam / (cam + Z2), s2 = cam / (cam + Z3);
      var d = Math.max(0, Math.min(3, ((Z2 + 1.3) / 2.6 * 4) | 0));
      buckets[3 - d].push(cx + X * sc * s1, cyy + Y * sc * s1, cx + X2 * sc * s2, cyy + Y2 * sc * s2);
    }
    ctx.lineCap = 'round'; ctx.globalCompositeOperation = 'lighter';
    for (var bI = 0; bI < 4; bI++) {
      var arr = buckets[bI], al = .1 + bI * .17; ctx.lineWidth = .7 + bI * .35; ctx.strokeStyle = 'rgba(255,' + (150 + bI * 22) + ',' + (60 + bI * 12) + ',' + al + ')'; ctx.beginPath();
      for (var j = 0; j < arr.length; j += 4) { ctx.moveTo(arr[j], arr[j + 1]); ctx.lineTo(arr[j + 2], arr[j + 3]); }
      ctx.stroke();
      ctx.fillStyle = 'rgba(190,215,255,' + (al * .9) + ')'; ctx.beginPath();
      for (j = 0; j < arr.length; j += 4) { ctx.moveTo(arr[j] + 1, arr[j + 1]); ctx.arc(arr[j], arr[j + 1], .9 + bI * .25, 0, TAU); }
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  function ui() {
    var idx = Math.min(F - 1, Math.round(sp * (F - 1)));
    items.forEach(function (el, n) { el.classList.toggle('on', n === idx); });
    dots.forEach(function (d, n) { d.style.setProperty('--f', Math.max(0, Math.min(1, sp * (F - 1) - n + 1)).toFixed(2)); });
  }
  function loop(time) { raf = 0; if (!vis) return; draw(time); ui(); raf = requestAnimationFrame(loop); }
  function scroll() {
    var b = root.getBoundingClientRect(), total = root.offsetHeight - innerHeight;
    var prog = Math.max(0, Math.min(1, -b.top / Math.max(1, total)));
    p = Math.max(0, Math.min(1, (prog - .1) / .8));
    var open = Math.max(0, Math.min(1, 1 - (-b.top) / (innerHeight * .8) * -1)), enter = Math.max(0, Math.min(1, (innerHeight - b.top) / innerHeight));
    var g = Math.min(1, prog / .14) * Math.min(1, enter);
    root.style.setProperty('--w', (small ? 92 : 86) + (100 - (small ? 92 : 86)) * g);
    root.style.setProperty('--r', 34 * (1 - g));
  }
  function start() { if (!raf && vis) raf = requestAnimationFrame(loop); }
  size(); new ResizeObserver(function () { size(); if (!vis || reduce) { draw(0); ui(); } }).observe(frame);
  if (reduce) { items.forEach(function (el) { el.classList.add('on'); }); draw(0); return; }
  root.classList.add('hs-pin'); size();
  addEventListener('scroll', scroll, { passive: true }); addEventListener('resize', scroll); scroll();
  root.addEventListener('pointermove', function (e) { var b = frame.getBoundingClientRect(); tx = (e.clientX - b.left) / b.width - .5; ty = (e.clientY - b.top) / b.height - .5; });
  new IntersectionObserver(function (es) { vis = es[0].isIntersecting; start(); }, { rootMargin: '100px' }).observe(root);
  dots.forEach(function (d, n) { d.style.cursor = 'pointer'; d.addEventListener('click', function () { var total = root.offsetHeight - innerHeight, top = root.getBoundingClientRect().top + scrollY; scrollTo({ top: top + total * (.1 + .8 * n / (F - 1)), behavior: 'smooth' }); }); });
  draw(0); ui();
})();
