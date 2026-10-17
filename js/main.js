(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  $('#year').textContent = new Date().getFullYear();

  /* scroll progress + nav state */
  var bar = $('#progress'), nav = $('#nav');
  function onScroll() {
    var h = document.documentElement;
    var p = h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight);
    bar.style.width = (p * 100) + '%';
    nav.classList.toggle('scrolled', h.scrollTop > 30);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* reveal on scroll */
  var revs = $$('.reveal');
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    revs.forEach(function (el) { io.observe(el); });
  } else {
    revs.forEach(function (el) { el.classList.add('in'); });
  }

  /* count up */
  $$('[data-count]').forEach(function (el) {
    var to = +el.dataset.count;
    if (reduce) { el.textContent = to; return; }
    var t0 = null;
    function step(t) {
      if (t0 === null) t0 = t;
      var p = Math.min(1, (t - t0) / 1400);
      el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    }
    setTimeout(function () { requestAnimationFrame(step); }, 500);
  });

  /* filters */
  var cards = $$('.card');
  $$('.chip').forEach(function (chip) {
    chip.addEventListener('click', function () {
      $$('.chip').forEach(function (c) { c.classList.remove('active'); c.setAttribute('aria-selected', 'false'); });
      chip.classList.add('active'); chip.setAttribute('aria-selected', 'true');
      var f = chip.dataset.f, i = 0;
      cards.forEach(function (card) {
        var show = f === 'all' || card.dataset.c.split(' ').indexOf(f) > -1;
        card.classList.toggle('hide', !show);
        card.classList.remove('pop');
        if (show) {
          void card.offsetWidth;
          card.style.animationDelay = (i++ * 45) + 'ms';
          card.classList.add('pop');
        }
      });
    });
  });

  /* 3D tilt + spotlight */
  function tilt(el, max) {
    var raf = 0;
    el.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      var r = el.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(function () {
        el.style.transform = 'rotateX(' + ((0.5 - y) * max) + 'deg) rotateY(' + ((x - 0.5) * max) + 'deg) translateZ(10px)';
        el.style.setProperty('--mx', (x * 100) + '%');
        el.style.setProperty('--my', (y * 100) + '%');
      });
    });
    el.addEventListener('pointerleave', function () {
      cancelAnimationFrame(raf);
      el.style.transform = '';
    });
  }
  if (!reduce && fine) {
    $$('.card').forEach(function (c) { tilt(c, 14); });
    $$('.ed').forEach(function (c) { tilt(c, 8); });
    $$('.final').forEach(function (c) { tilt(c, 3); });

    /* magnetic buttons */
    $$('.magnetic').forEach(function (b) {
      b.addEventListener('pointermove', function (e) {
        var r = b.getBoundingClientRect();
        b.style.transform = 'translate(' + ((e.clientX - r.left - r.width / 2) * 0.18) + 'px,' + ((e.clientY - r.top - r.height / 2) * 0.3) + 'px)';
      });
      b.addEventListener('pointerleave', function () { b.style.transform = ''; });
    });

    /* cursor glow */
    var glow = $('#glow'), gx = 0, gy = 0;
    window.addEventListener('pointermove', function (e) {
      gx = e.clientX; gy = e.clientY;
      glow.style.opacity = 1;
      glow.style.transform = 'translate(' + gx + 'px,' + gy + 'px)';
    }, { passive: true });
  }

  /* hero 3D scene */
  var canvas = $('#scene');
  if (!window.THREE || reduce) { canvas.style.display = 'none'; return; }
  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
  } catch (err) { canvas.style.display = 'none'; return; }

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0, 11);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  scene.add(new THREE.AmbientLight(0x6b7a99, 0.9));
  var l1 = new THREE.PointLight(0x3d8bff, 2.2, 40); l1.position.set(6, 5, 8); scene.add(l1);
  var l2 = new THREE.PointLight(0x48d1c9, 2.0, 40); l2.position.set(-7, -4, 6); scene.add(l2);

  var group = new THREE.Group();
  scene.add(group);

  var core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.7, 1),
    new THREE.MeshStandardMaterial({ color: 0x1f2a44, metalness: 0.75, roughness: 0.22, flatShading: true })
  );
  group.add(core);
  var wire = new THREE.Mesh(
    new THREE.IcosahedronGeometry(2.05, 1),
    new THREE.MeshBasicMaterial({ color: 0x48d1c9, wireframe: true, transparent: true, opacity: 0.35 })
  );
  group.add(wire);

  var rings = [];
  [[3.2, 0x3d8bff, 0.5], [4.1, 0x48d1c9, -0.8], [5.0, 0x3d8bff, 1.2]].forEach(function (c, i) {
    var m = new THREE.Mesh(
      new THREE.TorusGeometry(c[0], 0.028, 12, 160),
      new THREE.MeshBasicMaterial({ color: c[1], transparent: true, opacity: 0.55 - i * 0.12 })
    );
    m.rotation.x = Math.PI / 2 + c[2] * 0.4;
    m.rotation.y = c[2] * 0.3;
    m.userData.s = 0.002 + i * 0.0012;
    group.add(m); rings.push(m);
  });

  var shapes = [];
  var geos = [new THREE.OctahedronGeometry(0.34), new THREE.TetrahedronGeometry(0.4), new THREE.BoxGeometry(0.42, 0.42, 0.42)];
  for (var i = 0; i < 16; i++) {
    var a = (i / 16) * Math.PI * 2, rad = 3.4 + Math.random() * 2.4;
    var s = new THREE.Mesh(geos[i % 3], new THREE.MeshStandardMaterial({
      color: i % 2 ? 0x3d8bff : 0x48d1c9, metalness: 0.6, roughness: 0.25, flatShading: true
    }));
    s.position.set(Math.cos(a) * rad, (Math.random() - 0.5) * 4.6, Math.sin(a) * rad * 0.7);
    s.userData = { a: a, rad: rad, y: s.position.y, sp: 0.1 + Math.random() * 0.25, rot: 0.01 + Math.random() * 0.02, ph: Math.random() * 6 };
    group.add(s); shapes.push(s);
  }

  var mouse = { x: 0, y: 0 }, cur = { x: 0, y: 0 }, scrollY = 0, visible = true;
  window.addEventListener('pointermove', function (e) {
    mouse.x = (e.clientX / innerWidth - 0.5) * 2;
    mouse.y = (e.clientY / innerHeight - 0.5) * 2;
  }, { passive: true });
  window.addEventListener('scroll', function () { scrollY = window.scrollY; }, { passive: true });
  new IntersectionObserver(function (es) { visible = es[0].isIntersecting; }).observe($('.hero'));

  function resize() {
    var w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    var wide = w > 820;
    group.position.x = wide ? 3.6 : 0;
    group.position.y = wide ? 0 : 3.2;
    group.scale.setScalar(wide ? 1 : 0.62);
  }
  window.addEventListener('resize', resize);
  resize();

  var clock = new THREE.Clock();
  (function loop() {
    requestAnimationFrame(loop);
    if (!visible || document.hidden) return;
    var t = clock.getElapsedTime();
    cur.x += (mouse.x - cur.x) * 0.05;
    cur.y += (mouse.y - cur.y) * 0.05;
    core.rotation.x = t * 0.25; core.rotation.y = t * 0.35;
    wire.rotation.x = -t * 0.15; wire.rotation.y = -t * 0.2;
    rings.forEach(function (r, i) { r.rotation.z += r.userData.s * (i % 2 ? -1 : 1); });
    shapes.forEach(function (s) {
      var d = s.userData;
      d.a += d.sp * 0.004;
      s.position.x = Math.cos(d.a) * d.rad;
      s.position.z = Math.sin(d.a) * d.rad * 0.7;
      s.position.y = d.y + Math.sin(t * 0.8 + d.ph) * 0.25;
      s.rotation.x += d.rot; s.rotation.y += d.rot * 1.3;
    });
    group.rotation.y = cur.x * 0.45 + t * 0.05;
    group.rotation.x = cur.y * 0.25 + scrollY * 0.0006;
    group.position.z = -scrollY * 0.004;
    renderer.render(scene, camera);
  })();
})();
