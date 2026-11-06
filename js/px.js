/* Home product scene: one Wrapline window travels between slots in the page; the glow behind takes the colour of the tool on screen. */
(function () {
  if (innerWidth < 900) { addEventListener('resize', function () { if (innerWidth >= 900 && !built) build(); }); }
  var built = false, reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var TOOLS = [
    { n: 'IK / FK Snap', h: 210, tag: 'FREE', rows: [['FK wrist', 'L_FK_wrist_CTRL'], ['IK wrist', 'L_IK_wrist_CTRL'], ['Elbow axis', 'Y']], btn: 'IK → FK', bar: 1 },
    { n: 'FBX Exporter', h: 28, tag: 'PRO', rows: [['Shot', 'SH_010'], ['Rigs', '3 selected']], tg: 'Bake every frame', btn: 'Export FBX', bar: 1 },
    { n: 'Drag & Drop', h: 150, tag: 'PRO', files: [['cam.fbx', 'Import'], ['crowd.abc', 'Reference'], ['props.ma', 'Add to Bucket']], btn: 'Confirm', bar: 1 },
    { n: 'Playblast', h: 340, tag: 'PRO', rows: [['Camera', 'SH_010_cam'], ['Size', 'HD 1080p'], ['Format', 'mp4 · H.264']], btn: 'Export Playblast', bar: 1 },
    { n: 'Rivet', h: 262, tag: 'PRO', rows: [['Selection', '2 edges'], ['Created', 'rivet_loc1']], btn: 'Rivet' }
  ];
  function pane(t) {
    var b = '';
    if (t.rows) b += t.rows.map(function (r) { return '<div class="px-row"><span>' + r[0] + '</span><span class="px-field">' + r[1] + '</span></div>'; }).join('');
    if (t.files) b += t.files.map(function (f) { return '<div class="px-file"><span>' + f[0] + '</span><b>' + f[1] + '</b></div>'; }).join('');
    if (t.tg) b += '<div class="px-row"><span>' + t.tg + '</span><span class="px-tg"></span></div>';
    b += '<div class="px-btn">' + t.btn + '</div>' + (t.bar ? '<div class="px-bar"><i></i></div>' : '');
    return '<div class="px-pane" style="--ph:' + t.h + '">' + b + '</div>';
  }
  function build() {
    if (built || innerWidth < 900) return;
    var heroShelf = document.querySelector('.s-shelf'), slots = [].slice.call(document.querySelectorAll('.px-slot')); if (!heroShelf || !slots.length) return;
    built = true; document.documentElement.classList.add('px-on');
    var bg = document.createElement('div'); bg.className = 'px-bg'; bg.setAttribute('aria-hidden', 'true'); bg.innerHTML = '<i></i><i></i><i></i>'; document.body.prepend(bg);
    var win = document.createElement('div'); win.className = 'px-win'; win.setAttribute('aria-hidden', 'true');
    win.innerHTML = '<div class="px-in"><div class="px-top"><i></i><i></i><i></i><b></b><span></span></div>' + TOOLS.map(pane).join('') + '<div class="px-dots">' + TOOLS.map(function () { return '<i></i>'; }).join('') + '</div></div>';
    document.body.append(win);
    var panes = [].slice.call(win.querySelectorAll('.px-pane')), dots = [].slice.call(win.querySelectorAll('.px-dots i')), ttl = win.querySelector('.px-top b'), tag = win.querySelector('.px-top span'), inner = win.querySelector('.px-in'), cur = -1, timer;
    function show(i) {
      if (i === cur) return; if (cur >= 0) { panes[cur].classList.remove('on'); panes[cur].classList.add('out'); (function (p) { setTimeout(function () { p.classList.remove('out'); }, 700); })(panes[cur]); }
      cur = i; panes[i].classList.add('on'); dots.forEach(function (d, n) { d.classList.toggle('on', n === i); }); ttl.textContent = TOOLS[i].n; tag.textContent = TOOLS[i].tag;
      document.documentElement.style.setProperty('--ph', TOOLS[i].h); bg.style.setProperty('--ph', TOOLS[i].h);
    }
    show(0); if (!reduce) timer = setInterval(function () { if (!document.hidden) show((cur + 1) % TOOLS.length); }, 4600);
    var pos = [], W0 = 380, H0 = 250;
    function measure() {
      var sy = scrollY; pos = [heroShelf].concat(slots.filter(function (s) { return s.dataset.px; })).map(function (el, k) {
        var r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + sy + r.height / 2, s: k === 0 ? Math.min(1.35, r.width * .9 / W0) : Math.min(1, r.width / W0) };
      });
      pos.sort(function (a, b) { return a.y - b.y; });
    }
    var st = { x: 0, y: 0, s: 1, o: 1 }, first = true, px = 0, py = 0, tx = 0, ty = 0, raf = 0;
    function sm(a, b, x) { x = Math.max(0, Math.min(1, (x - a) / (b - a))); return x * x * (3 - 2 * x); }
    function target() {
      var c = scrollY + innerHeight * .5, i = 0; for (var k = 0; k < pos.length; k++) if (c >= pos[k].y) i = k;
      var a = pos[i], b = pos[Math.min(pos.length - 1, i + 1)], t = a === b ? 0 : Math.max(0, Math.min(1, (c - a.y) / (b.y - a.y))), e = sm(0, 1, t);
      var o = a === b ? 1 - sm(innerHeight * .08, innerHeight * .3, c - a.y) : Math.max(1 - sm(.06, .26, t), sm(.74, .94, t));
      if (c < pos[0].y) o = 1;
      return { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e, s: a.s + (b.s - a.s) * e, o: o };
    }
    function frame() {
      raf = 0; var g = target(), k = reduce || first ? 1 : .14; first = false;
      st.x += (g.x - st.x) * k; st.y += (g.y - st.y) * k; st.s += (g.s - st.s) * k; st.o += (g.o - st.o) * k; px += (tx - px) * .08; py += (ty - py) * .08;
      win.style.transform = 'translate3d(' + (st.x - W0 / 2).toFixed(1) + 'px,' + (st.y - H0 / 2).toFixed(1) + 'px,0) scale(' + st.s.toFixed(3) + ')'; win.style.opacity = st.o.toFixed(3);
      inner.style.setProperty('--ry', (px * 10 - 5 + Math.sin(scrollY * .004) * 3).toFixed(2) + 'deg'); inner.style.setProperty('--rx', (-py * 8).toFixed(2) + 'deg');
      if (Math.abs(g.x - st.x) + Math.abs(g.y - st.y) + Math.abs(g.s - st.s) > .3 || Math.abs(tx - px) + Math.abs(ty - py) > .002) raf = requestAnimationFrame(frame);
    }
    function kick() { if (!raf) raf = requestAnimationFrame(frame); }
    function remeasure() { measure(); kick(); }
    addEventListener('scroll', kick, { passive: true }); addEventListener('resize', function () { if (innerWidth < 900) return; remeasure(); });
    addEventListener('pointermove', function (e) { tx = e.clientX / innerWidth - .5; ty = e.clientY / innerHeight - .5; kick(); });
    new ResizeObserver(remeasure).observe(document.body); addEventListener('load', remeasure); if (document.fonts && document.fonts.ready) document.fonts.ready.then(remeasure);
    measure(); frame();
  }
  if (innerWidth >= 900) build();
})();
