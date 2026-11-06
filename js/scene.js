/* Home scene: one fixed canvas behind the page. The shape, position and energy follow the section in view. */
(function () {
  var cv = document.createElement('canvas'); cv.className = 'sc-canvas'; cv.setAttribute('aria-hidden', 'true');
  var ctx = cv.getContext('2d'); if (!ctx) return;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches, small = matchMedia('(max-width:720px)').matches;
  var secs = [
    ['.s-hero', 'Start', 0, .7, .46, .9, .9],
    ['#tools', 'Tools', 2, .5, .42, 1.05, .32],
    ['#compare', 'Compare', 1, .88, .35, .8, .4],
    ['.maker-previews', 'Preview', 3, .1, .5, .8, .4],
    ['#about', 'About', 1, .8, .5, .85, .55],
    ['#contact', 'Contact', 0, .5, .45, 1.05, .8]
  ].map(function (c) { return { el: document.querySelector(c[0]), name: c[1], shape: c[2], x: c[3], y: c[4], k: c[5], a: c[6] }; }).filter(function (c) { return c.el; });
  if (!secs.length) return;
  document.documentElement.classList.add('sc-on'); document.body.prepend(cv);
  var N = small ? 650 : 1200, TAU = Math.PI * 2, shapes = [], seed = 11;
  function r() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
  function make(fn) { var a = new Float32Array(N * 6); for (var i = 0; i < N; i++) a.set(fn(i, i / N), i * 6); return a; }
  shapes.push(make(function (i, u) { var t = u * TAU * 3, R = 1 + (i % 3) * .06, c = Math.cos(t), s = Math.sin(t), L = .26 + r() * .34; return [R * c, R * s, (r() - .5) * .2, c * L, s * L, (r() - .5) * .22]; }));
  shapes.push(make(function (i, u) { var y = 1 - u, rad = Math.sqrt(Math.max(0, 1 - y * y)), th = i * 2.399963, x = Math.cos(th) * rad, z = Math.sin(th) * rad, L = .18 + r() * .2; return [x * .95, -y * .95 + .1, z * .95, x * L, -y * L, z * L]; }));
  shapes.push(make(function (i) { var g = Math.ceil(Math.sqrt(N)), x = ((i % g) / g - .5) * 3, z = (((i / g) | 0) / g - .5) * 3, y = Math.sin(x * 2.2) * Math.cos(z * 2) * .38; return [x, y, z, 0, .22 + (y + .4) * .45, 0]; }));
  shapes.push(make(function (i, u) { var t = u * TAU * 2.2, k = i % 2 ? 1 : -1, R = .85 + .12 * Math.sin(t * 3), x = Math.cos(t) * R, z = Math.sin(t) * R, y = (u - .5) * 2.2 * k * .8; return [x, y, z, -Math.sin(t) * .3, .05, Math.cos(t) * .3]; }));
  var delay = new Float32Array(N), i; for (i = 0; i < N; i++) delay[i] = r();
  var W = 0, H = 0, dpr = 1, st = { sh: 0, x: .72, y: .46, k: 1, a: 1 }, tg = { sh: 0, x: .72, y: .46, k: 1, a: 1 }, cur = 0, burst = 0, px = 0, py = 0, tx = 0, ty = 0, raf = 0, run = true, scrollV = 0, lastY = scrollY;
  function size() { dpr = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight; cv.width = W * dpr | 0; cv.height = H * dpr | 0; }
  function ease(x) { return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
  function pick() {
    var mid = innerHeight * .5, best = 0, bd = 1e9;
    secs.forEach(function (s, n) { var b = s.el.getBoundingClientRect(), d = mid < b.top ? b.top - mid : mid > b.bottom ? mid - b.bottom : 0; if (d < bd) { bd = d; best = n; } if (b.top < innerHeight * .8) s.el.classList.add('sc-seen'); });
    if (best !== cur) { cur = best; burst = 1; setRail(); }
    var s = secs[cur]; tg.sh = s.shape; tg.x = small ? .5 : s.x; tg.y = small ? .3 : s.y; tg.k = s.k; tg.a = s.a * (small ? .55 : 1);
  }
  function dark() { return document.documentElement.dataset.theme === 'dark'; }
  function draw(time) {
    ['sh', 'x', 'y', 'k', 'a'].forEach(function (k) { st[k] += (tg[k] - st[k]) * (k === 'sh' ? .035 : .06); });
    burst *= .965; scrollV *= .9; px += (tx - px) * .05; py += (ty - py) * .05;
    var f = Math.max(0, Math.min(2.999, st.sh)), a = Math.floor(f), m = f - a, A = shapes[a], B = shapes[Math.min(3, a + 1)];
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    var yaw = time * .00014 + scrollY * .0008 + px * .5, pit = -.42 + py * .22 + Math.sin(scrollY * .0017) * .1, cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pit), sp = Math.sin(pit);
    var sc = Math.min(W, H * 1.5) * .34 * st.k, cx = W * st.x, cyy = H * st.y, cam = 3.4, lenK = 1 + burst * .7 + Math.min(.5, scrollV * .02);
    var bk = [[], [], [], []];
    for (i = 0; i < N; i++) {
      var k = i * 6, e = ease(Math.max(0, Math.min(1, m * 1.6 - delay[i] * .6)));
      var x = A[k] + (B[k] - A[k]) * e, y = A[k + 1] + (B[k + 1] - A[k + 1]) * e, z = A[k + 2] + (B[k + 2] - A[k + 2]) * e;
      var dx = (A[k + 3] + (B[k + 3] - A[k + 3]) * e) * lenK, dy = (A[k + 4] + (B[k + 4] - A[k + 4]) * e) * lenK, dz = (A[k + 5] + (B[k + 5] - A[k + 5]) * e) * lenK;
      var X = x * cy - z * sy, Z = x * sy + z * cy, Y = y * cp - Z * sp, Z2 = y * sp + Z * cp;
      var xb = x + dx, yb = y + dy, zb = z + dz, X2 = xb * cy - zb * sy, Zb = xb * sy + zb * cy, Y2 = yb * cp - Zb * sp, Z3 = yb * sp + Zb * cp;
      var s1 = cam / (cam + Z2), s2 = cam / (cam + Z3), d = Math.max(0, Math.min(3, ((Z2 + 1.3) / 2.6 * 4) | 0));
      bk[3 - d].push(cx + X * sc * s1, cyy + Y * sc * s1, cx + X2 * sc * s2, cyy + Y2 * sc * s2);
    }
    var dk = dark(), base = st.a * (dk ? 1 : .8);
    ctx.lineCap = 'round'; ctx.globalCompositeOperation = dk ? 'lighter' : 'source-over';
    for (var b = 0; b < 4; b++) {
      var arr = bk[b], al = (.1 + b * .17) * base * (1 + burst * .5); ctx.lineWidth = .7 + b * .35;
      ctx.strokeStyle = dk ? 'rgba(255,' + (150 + b * 22) + ',' + (60 + b * 12) + ',' + al + ')' : 'rgba(' + (205 - b * 8) + ',' + (110 + b * 8) + ',' + (20 + b * 6) + ',' + al * .9 + ')';
      ctx.beginPath(); for (var j = 0; j < arr.length; j += 4) { ctx.moveTo(arr[j], arr[j + 1]); ctx.lineTo(arr[j + 2], arr[j + 3]); } ctx.stroke();
      ctx.fillStyle = dk ? 'rgba(190,215,255,' + al * .9 + ')' : 'rgba(42,100,232,' + al * .9 + ')';
      ctx.beginPath(); for (j = 0; j < arr.length; j += 4) { ctx.moveTo(arr[j] + 1, arr[j + 1]); ctx.arc(arr[j], arr[j + 1], .9 + b * .25, 0, TAU); } ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  var rail = document.createElement('nav'); rail.className = 'sc-rail'; rail.setAttribute('aria-label', 'Sections');
  secs.forEach(function (s, n) { var b = document.createElement('button'); b.type = 'button'; b.innerHTML = '<span>0' + (n + 1) + ' · ' + s.name + '</span><i></i>'; b.addEventListener('click', function () { s.el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }); }); rail.append(b); });
  document.body.append(rail);
  function setRail() { [].forEach.call(rail.children, function (b, n) { b.classList.toggle('on', n === cur); }); }
  function loop(t) { raf = 0; if (!run) return; pick(); draw(t); raf = requestAnimationFrame(loop); }
  size(); addEventListener('resize', function () { size(); pick(); });
  if (reduce) { secs.forEach(function (s) { s.el.classList.add('sc-seen'); }); pick(); st.sh = tg.sh; st.x = tg.x; st.y = tg.y; st.k = tg.k; st.a = tg.a; draw(0); setRail(); addEventListener('scroll', function () { pick(); st.sh = tg.sh; st.x = tg.x; st.y = tg.y; st.k = tg.k; st.a = tg.a; draw(0); }, { passive: true }); return; }
  addEventListener('scroll', function () { scrollV = Math.min(30, scrollV + Math.abs(scrollY - lastY)); lastY = scrollY; }, { passive: true });
  addEventListener('pointermove', function (e) { tx = e.clientX / innerWidth - .5; ty = e.clientY / innerHeight - .5; });
  document.addEventListener('visibilitychange', function () { run = !document.hidden; if (run && !raf) raf = requestAnimationFrame(loop); });
  pick(); setRail(); raf = requestAnimationFrame(loop);
})();
