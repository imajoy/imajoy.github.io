(function () {
  'use strict';

  /* ------------------------------------------------------------------
     CHECKOUT LINKS
     Paste your payment links between the quotes. While a link is empty,
     the button opens an email to you instead.
     ------------------------------------------------------------------ */
  var CHECKOUT = {
    online:  { monthly: '', yearly: '' },
    offline: { monthly: '', yearly: '' }
  };
  var CONTACT = 'contactmy3dart@gmail.com';

  /* Prices in US dollars, per computer. Yearly is 20% off 12 months. */
  var PRICES = {
    online:  { monthly: 39, yearly: 374 },
    offline: { monthly: 79, yearly: 758 }
  };

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var year = $('#year');
  if (year) year.textContent = new Date().getFullYear();

  /* ---------- header ---------- */
  var header = $('#header');
  function onScroll(y) { if (header) header.classList.toggle('stuck', y > 24); }

  /* ---------- smooth scrolling ---------- */
  var lenis = null;
  if (window.Lenis && !reduce) {
    try {
      lenis = new window.Lenis({ duration: 1.1, easing: function (t) { return 1 - Math.pow(1 - t, 3); }, smoothWheel: true });
      lenis.on('scroll', function (e) { onScroll(e.scroll); });
      (function raf(t) { lenis.raf(t); requestAnimationFrame(raf); })(performance.now());
    } catch (err) { lenis = null; }
  }
  if (!lenis) {
    window.addEventListener('scroll', function () { onScroll(window.scrollY); }, { passive: true });
    document.documentElement.style.scrollBehavior = reduce ? 'auto' : 'smooth';
  }
  onScroll(window.scrollY);

  $$('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href');
      var target = id.length > 1 ? $(id) : null;
      if (!target) return;
      e.preventDefault();
      if (lenis) lenis.scrollTo(target, { offset: -72, duration: 1.4 });
      else window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - 72, behavior: reduce ? 'auto' : 'smooth' });
      history.replaceState(null, '', id);
    });
  });

  /* ---------- pricing toggle ---------- */
  var toggle = $('.toggle');
  if (toggle) {
    var billing = 'monthly';
    var plansEl = $('.plans');

    function money(n) { return '$' + n.toLocaleString('en-US'); }

    function render() {
      ['online', 'offline'].forEach(function (plan) {
        var p = PRICES[plan];
        var yearly = billing === 'yearly';
        var amt = $('[data-amt="' + plan + '"]');
        var note = $('[data-note="' + plan + '"]');
        var per = amt.parentNode.querySelector('[data-per]');
        amt.textContent = money(yearly ? p.yearly : p.monthly);
        per.textContent = yearly ? 'per computer, per year' : 'per computer, per month';
        note.textContent = yearly
          ? 'About ' + money(Math.round(p.yearly / 12)) + ' a month. You save ' + money(p.monthly * 12 - p.yearly) + ' a year.'
          : 'Billed monthly. Cancel any time.';
        var buy = $('[data-buy="' + plan + '"]');
        var link = CHECKOUT[plan][billing];
        var label = plan === 'online' ? 'Online' : 'Offline';
        if (link) {
          buy.href = link;
          buy.target = '_blank';
          buy.rel = 'noopener';
        } else {
          buy.removeAttribute('target');
          buy.href = 'mailto:' + CONTACT + '?subject=' +
            encodeURIComponent('Ajoy Tools ' + label + ' subscription (' + billing + ')');
        }
      });
    }

    $$('button', toggle).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var next = btn.getAttribute('data-bill');
        if (next === billing) return;
        billing = next;
        toggle.setAttribute('data-state', billing);
        $$('button', toggle).forEach(function (b) {
          var on = b === btn;
          b.classList.toggle('on', on);
          b.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        if (reduce) { render(); return; }
        plansEl.classList.add('swap');
        setTimeout(function () { render(); plansEl.classList.remove('swap'); }, 180);
      });
    });
    render();
  }

  /* ---------- 3D rotate gizmo ---------- */
  var canvas = $('#rig');
  if (!canvas || !window.THREE) return;
  var THREE = window.THREE, renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  } catch (err) { canvas.style.display = 'none'; return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  camera.position.set(0, 1.5, 10.5);
  camera.lookAt(0, 0.1, 0);

  var RED = 0xE5636F, GREEN = 0x5BC98A, BLUE = 0x3D8BFF;
  var rig = new THREE.Group();
  scene.add(rig);

  function ring(radius, color, rx, ry) {
    var m = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.017, 8, 160), new THREE.MeshBasicMaterial({ color: color }));
    m.rotation.x = rx; m.rotation.y = ry;
    return m;
  }
  rig.add(ring(2, RED, 0, Math.PI / 2));    /* X: ring in the YZ plane */
  rig.add(ring(2, GREEN, Math.PI / 2, 0));  /* Y: ring in the XZ plane */
  rig.add(ring(2, BLUE, 0, 0));             /* Z: ring in the XY plane */

  /* soft sphere: hides the back half of the rings, which gives real depth */
  rig.add(new THREE.Mesh(
    new THREE.SphereGeometry(1.96, 40, 28),
    new THREE.MeshBasicMaterial({ color: 0x101114, transparent: true, opacity: 0.86 })
  ));

  /* translate arrows along each axis */
  function arrow(color, axis) {
    var g = new THREE.Group();
    var mat = new THREE.MeshBasicMaterial({ color: color });
    var shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 1.3, 8), mat);
    shaft.position.y = 2.65;
    var tip = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.24, 14), mat);
    tip.position.y = 3.42;
    g.add(shaft); g.add(tip);
    if (axis === 'x') g.rotation.z = -Math.PI / 2;
    if (axis === 'z') g.rotation.x = Math.PI / 2;
    return g;
  }
  rig.add(arrow(RED, 'x'), arrow(GREEN, 'y'), arrow(BLUE, 'z'));

  var dot = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), new THREE.MeshBasicMaterial({ color: 0xE7E9ED }));
  rig.add(dot);

  /* viewport floor */
  var grid = new THREE.GridHelper(18, 36, 0x2A2C32, 0x1C1E23);
  grid.position.y = -3.4;
  scene.add(grid);

  var tx = 0, ty = 0, cx = 0, cy = 0, visible = true, wide = true;
  window.addEventListener('pointermove', function (e) {
    tx = (e.clientX / window.innerWidth - 0.5);
    ty = (e.clientY / window.innerHeight - 0.5);
  }, { passive: true });

  function resize() {
    var w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    wide = w > 960;
    camera.updateProjectionMatrix();
    rig.position.set(wide ? 3.6 : 0, wide ? 0.2 : 1.1, 0);
    rig.scale.setScalar(wide ? 1 : 0.7);
    grid.position.x = rig.position.x * 0.6;
  }
  window.addEventListener('resize', resize);
  resize();

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) { visible = es[0].isIntersecting; }).observe(canvas);
  }

  var spin = 0.5, last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    var dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!visible || document.hidden) return;
    if (!reduce) spin += dt * 0.22;
    cx += (tx - cx) * Math.min(1, dt * 4);
    cy += (ty - cy) * Math.min(1, dt * 4);
    rig.rotation.y = spin + cx * 0.9;
    rig.rotation.x = 0.42 + cy * 0.5;
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);
})();
