/* Home timeline: scroll scrubs a graph-editor curve (a ball rides it, with tangent handles) and a Maya-style time bar. */
(function () {
  var defs = [['.s-hero', 'Start'], ['#tools', 'Tools'], ['#compare', 'Plans'], ['.maker-previews', 'Preview'], ['#about', 'About'], ['#contact', 'Contact']];
  var secs = defs.map(function (d) { return { el: document.querySelector(d[0]), name: d[1] }; }).filter(function (s) { return s.el; });
  var n = secs.length; if (n < 3) return;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches, NS = 'http://www.w3.org/2000/svg', FR = 240;
  document.documentElement.classList.add('tl-on');
  var svg = document.createElementNS(NS, 'svg'); svg.setAttribute('class', 'tl-curve'); svg.setAttribute('aria-hidden', 'true');
  function mk(t, c) { var e = document.createElementNS(NS, t); if (c) e.setAttribute('class', c); svg.appendChild(e); return e; }
  var base = mk('path', 'base'), drawn = mk('path', 'drawn'), keys = [], h1 = mk('line', 'hd'), h2 = mk('line', 'hd'), hp1 = mk('circle', 'hdp'), hp2 = mk('circle', 'hdp'), ball = mk('circle', 'ball');
  for (var i = 0; i < n; i++) { var k = mk('rect', 'key'); k.setAttribute('width', 11); k.setAttribute('height', 11); k.setAttribute('rx', 2); keys.push(k); }
  hp1.setAttribute('r', 3.2); hp2.setAttribute('r', 3.2); ball.setAttribute('r', 6);
  document.body.prepend(svg);
  var bar = document.createElement('div'); bar.className = 'tl-bar'; bar.setAttribute('role', 'group'); bar.setAttribute('aria-label', 'Page timeline');
  bar.innerHTML = '<span class="tl-mono tl-name"></span><div class="tl-track"><i class="tl-head"></i></div><span class="tl-mono tl-end"></span>';
  document.body.append(bar);
  var track = bar.querySelector('.tl-track'), head = bar.querySelector('.tl-head'), nm = bar.querySelector('.tl-name'), en = bar.querySelector('.tl-end'), kb = [];
  secs.forEach(function (s, j) { var b = document.createElement('button'); b.type = 'button'; b.setAttribute('aria-label', 'Go to ' + s.name); b.style.left = (j / (n - 1) * 100) + '%'; b.addEventListener('click', function (e) { e.stopPropagation(); s.el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }); }); track.appendChild(b); kb.push(b); });
  var W = 0, H = 0, pts = [], L = 1, shown = 0, goal = 0, raf = 0;
  function build() {
    W = innerWidth; H = innerHeight; svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    var ys = [.28, .72, .3, .74, .32, .6];
    pts = secs.map(function (s, j) { return [W * (.07 + .86 * j / (n - 1)), H * ys[j % ys.length]]; });
    var d = 'M' + pts[0][0] + ' ' + pts[0][1];
    for (var j = 0; j < n - 1; j++) { var a = pts[j], b = pts[j + 1], dx = (b[0] - a[0]) * .5; d += ' C' + (a[0] + dx) + ' ' + a[1] + ' ' + (b[0] - dx) + ' ' + b[1] + ' ' + b[0] + ' ' + b[1]; }
    base.setAttribute('d', d); drawn.setAttribute('d', d); L = drawn.getTotalLength(); drawn.style.strokeDasharray = L;
    keys.forEach(function (k, j) { k.setAttribute('x', pts[j][0] - 5.5); k.setAttribute('y', pts[j][1] - 5.5); k.setAttribute('transform', 'rotate(45 ' + pts[j][0] + ' ' + pts[j][1] + ')'); });
  }
  function target() {
    var y = scrollY + innerHeight * .45, tops = secs.map(function (s) { return s.el.getBoundingClientRect().top + scrollY; }), j = 0;
    for (var q = 0; q < n; q++) if (y >= tops[q]) j = q;
    var nxt = j < n - 1 ? tops[j + 1] : document.documentElement.scrollHeight, f = Math.max(0, Math.min(1, (y - tops[j]) / Math.max(1, nxt - tops[j])));
    secs.forEach(function (s, q) { if (tops[q] - scrollY < innerHeight * .82) s.el.classList.add('tl-seen'); });
    return Math.min(1, (j + (j < n - 1 ? f : 0)) / (n - 1));
  }
  function paint() {
    var p = shown, len = p * L, pt = drawn.getPointAtLength(len), a = drawn.getPointAtLength(Math.max(0, len - 2)), b = drawn.getPointAtLength(Math.min(L, len + 2));
    var tx = b.x - a.x, ty = b.y - a.y, m = Math.hypot(tx, ty) || 1; tx /= m; ty /= m;
    drawn.style.strokeDashoffset = L - len; ball.setAttribute('cx', pt.x); ball.setAttribute('cy', pt.y);
    var hl = 46, x1 = pt.x - tx * hl, y1 = pt.y - ty * hl, x2 = pt.x + tx * hl, y2 = pt.y + ty * hl;
    h1.setAttribute('x1', pt.x); h1.setAttribute('y1', pt.y); h1.setAttribute('x2', x1); h1.setAttribute('y2', y1); h2.setAttribute('x1', pt.x); h2.setAttribute('y1', pt.y); h2.setAttribute('x2', x2); h2.setAttribute('y2', y2);
    hp1.setAttribute('cx', x1); hp1.setAttribute('cy', y1); hp2.setAttribute('cx', x2); hp2.setAttribute('cy', y2);
    var cur = Math.round(p * (n - 1) - .001); if (cur < 0) cur = 0;
    keys.forEach(function (k, j) { var on = p >= j / (n - 1) - .002; k.classList.toggle('hit', on); kb[j].classList.toggle('hit', on); });
    head.style.left = (p * 100) + '%'; var fr = Math.round(p * (FR - 1)) + 1;
    nm.textContent = secs[Math.max(0, Math.min(n - 1, Math.round(p * (n - 1))))].name; en.textContent = 'f ' + String(fr).padStart(4, '0') + ' / ' + FR;
    bar.classList.toggle('on', scrollY > innerHeight * .35);
  }
  function loop() { raf = 0; goal = target(); shown += (goal - shown) * (reduce ? 1 : .12); if (Math.abs(goal - shown) < .0004) shown = goal; paint(); if (shown !== goal) raf = requestAnimationFrame(loop); }
  function kick() { if (!raf) raf = requestAnimationFrame(loop); }
  function scrub(e) { var r = track.getBoundingClientRect(), f = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), pos = f * (n - 1), j = Math.min(n - 2, Math.floor(pos)), t = pos - j, a = secs[j].el.getBoundingClientRect().top + scrollY, b = secs[j + 1].el.getBoundingClientRect().top + scrollY; scrollTo(0, a + (b - a) * t - innerHeight * .45 + 1); }
  var drag = false; track.addEventListener('pointerdown', function (e) { drag = true; track.setPointerCapture(e.pointerId); scrub(e); }); track.addEventListener('pointermove', function (e) { if (drag) scrub(e); }); track.addEventListener('pointerup', function () { drag = false; });
  addEventListener('scroll', kick, { passive: true }); addEventListener('resize', function () { build(); kick(); });
  build(); shown = goal = target(); paint();
})();
