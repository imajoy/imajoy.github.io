(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------- theme ---------- */
  var themeBtn = $('#theme');
  function syncTheme() {
    var dark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (themeBtn) themeBtn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#080C18' : '#E9EDF3');
  }
  syncTheme();
  if (themeBtn) themeBtn.addEventListener('click', function () {
    var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('ajoy-theme', next); } catch (e) {}
    syncTheme();
  });

  var year = $('#year');
  if (year) year.textContent = new Date().getFullYear();

  /* ---------- smooth scrolling ---------- */
  document.documentElement.style.scrollBehavior = reduce ? 'auto' : 'smooth';

  $$('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href');
      var target = id.length > 1 ? $(id) : null;
      if (!target) return;
      e.preventDefault();
      window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - 20, behavior: reduce ? 'auto' : 'smooth' });
      history.replaceState(null, '', id);
    });
  });

  /* ---------- reveal on scroll (once) ---------- */
  var revs = $$('.reveal');
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    revs.forEach(function (el, i) {
      el.style.transitionDelay = (i % 2) * 90 + 'ms';
      io.observe(el);
      el.addEventListener('transitionend', function clr(e) { if (e.propertyName === 'opacity') { el.style.transitionDelay = ''; el.removeEventListener('transitionend', clr); } });
    });
  } else {
    revs.forEach(function (el) { el.classList.add('in'); });
  }

  /* ---------- headings: words rise in ---------- */
  if (!reduce && 'IntersectionObserver' in window) {
    var hio = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); hio.unobserve(e.target); } });
    }, { threshold: 0.25 });
    $$('.block h2, .frame-inner h2').forEach(function (h) {
      var n = 0;
      (function walk(node) {
        Array.prototype.slice.call(node.childNodes).forEach(function (c) {
          if (c.nodeType === 3) {
            var frag = document.createDocumentFragment();
            c.nodeValue.split(/(\s+)/).forEach(function (part) {
              if (!part) return;
              if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
              var w = document.createElement('span'); w.className = 'w';
              var i = document.createElement('span'); i.style.setProperty('--i', n++); i.textContent = part;
              w.appendChild(i); frag.appendChild(w);
            });
            node.replaceChild(frag, c);
          } else if (c.nodeType === 1) walk(c);
        });
      })(h);
      hio.observe(h);
    });
  }

  /* ---------- scroll progress + active nav link ---------- */
  var bar = $('#progress'), ticking = false;
  function prog() {
    ticking = false;
    var max = document.documentElement.scrollHeight - window.innerHeight;
    if (bar) bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, window.scrollY / max) : 0) + ')';
  }
  window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(prog); } }, { passive: true });
  prog();
  var navLinks = $$('.nav a');
  if (navLinks.length && 'IntersectionObserver' in window) {
    var nio = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        navLinks.forEach(function (a) { a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id); });
      });
    }, { rootMargin: '-40% 0px -55% 0px' });
    ['tools', 'install', 'pricing', 'faq'].forEach(function (id) { var el = document.getElementById(id); if (el) nio.observe(el); });
  }

  /* ---------- install sequence ---------- */
  var ist = $('#stage-install'), motionPaused = reduce;
  if (ist) {
    var steps = $$('#steps li'), codeEl = $('#code'), ph = $('#ph'), wcOn = $('#wc-on'), wcOff = $('#wc-off');
    var goEl = $('#go'), fc1 = $('#fc1'), fc2 = $('#fc2'), conf = $('#confetti');
    var CODE = 'ACME-4821-7K2Q-9XMD-31PL', timers = [], cur = 0, running = false, seen = false;
    for (var k = 0; k < 18; k++) {
      var d = document.createElement('i');
      var ang = (k / 18) * Math.PI * 2, dist = 90 + (k % 3) * 40;
      d.style.setProperty('--x', Math.round(Math.cos(ang) * dist) + 'px');
      d.style.setProperty('--y', Math.round(Math.sin(ang) * dist - 30) + 'px');
      d.style.setProperty('--r', (k * 47) + 'deg');
      d.style.background = ['#3D8BFF', '#FF7A5C', '#2FB5AE', '#8DBBFF'][k % 4];
      conf.appendChild(d);
    }
    var later = function (fn, ms) { timers.push(setTimeout(fn, ms)); };
    var clearAll = function () { timers.forEach(clearTimeout); timers = []; };
    function mark(n) {
      ist.setAttribute('data-step', n);
      steps.forEach(function (li, i) { li.classList.toggle('active', i === n); li.classList.toggle('done', i < n); });
    }
    function resetWindow() {
      codeEl.textContent = ''; ph.style.display = '';
      wcOn.classList.remove('on'); wcOff.classList.remove('on');
      goEl.textContent = 'Install';
      fc1.classList.remove('show'); fc2.classList.remove('show'); conf.classList.remove('go');
    }
    function finalState() {
      mark(3); codeEl.textContent = CODE; ph.style.display = 'none';
      wcOff.classList.add('on'); fc1.classList.add('show'); fc2.classList.add('show'); goEl.textContent = 'Done';
    }
    function play(n) {
      clearAll(); cur = n; mark(n);
      if (n === 0) { resetWindow(); later(function () { play(1); }, 3400); }
      else if (n === 1) { later(function () { play(2); }, 2600); }
      else if (n === 2) {
        resetWindow(); wcOn.classList.add('on');
        later(function () { wcOn.classList.remove('on'); wcOff.classList.add('on'); }, 900);
        later(function () {
          ph.style.display = 'none';
          var i = 0;
          (function type() {
            codeEl.textContent = CODE.slice(0, ++i);
            if (i < CODE.length) timers.push(setTimeout(type, 70));
            else later(function () { fc1.classList.add('show'); }, 250);
          })();
        }, 1500);
        later(function () { play(3); }, 4600);
      } else {
        if (!codeEl.textContent) { codeEl.textContent = CODE; ph.style.display = 'none'; wcOff.classList.add('on'); }
        fc1.classList.add('show');
        goEl.textContent = 'Installing';
        later(function () {
          goEl.textContent = 'Done'; fc2.classList.add('show');
          conf.classList.remove('go'); void conf.offsetWidth; conf.classList.add('go');
        }, 2900);
        later(function () { fc1.classList.remove('show'); fc2.classList.remove('show'); }, 6200);
        later(function () { play(0); }, 6700);
      }
    }
    steps.forEach(function (li) {
      li.addEventListener('click', function () { if (reduce) { finalState(); return; } running = true; play(parseInt(li.getAttribute('data-go'), 10)); });
    });
    if (reduce || !('IntersectionObserver' in window)) finalState();
    else new IntersectionObserver(function (es) {
      var on = es[0].isIntersecting;
      if (on && !running && !motionPaused) { running = true; play(seen ? cur : 0); seen = true; }
      else if (!on && running) { running = false; clearAll(); }
    }, { threshold: 0.35 }).observe(ist);
    document.addEventListener('ajoy:motion', function (event) {
      motionPaused = event.detail.paused;
      if (motionPaused) { clearAll(); running = false; finalState(); }
      else if (!reduce && ist.getBoundingClientRect().top < window.innerHeight && ist.getBoundingClientRect().bottom > 0) { running = true; play(0); }
    });
  }

  /* ---------- gentle 3D tilt (smoothed, no CSS transitions) ---------- */
  var tilts = [];
  if (fine && !reduce) {
    $$('.tilt').forEach(function (el) {
      var max = parseFloat(el.getAttribute('data-tilt')) || 10;
      var host = el.parentNode;
      var st = { el: el, max: max, tx: 0, ty: 0, cx: 0, cy: 0, active: false, base: el.classList.contains('lcard') ? [-14, 8] : [-10, 4] };
      host.addEventListener('pointermove', function (e) {
        var r = host.getBoundingClientRect();
        st.tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
        st.ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
        st.active = true;
      });
      host.addEventListener('pointerleave', function () { st.tx = 0; st.ty = 0; });
      tilts.push(st);
    });
    (function loop() {
      requestAnimationFrame(loop);
      tilts.forEach(function (s) {
        if (!s.active) return;
        s.cx += (s.tx - s.cx) * 0.08;
        s.cy += (s.ty - s.cy) * 0.08;
        s.el.style.transform = 'perspective(1400px) rotateY(' + (s.base[0] + s.cx * s.max) + 'deg) rotateX(' + (s.base[1] - s.cy * s.max * 0.7) + 'deg)';
        if (Math.abs(s.cx - s.tx) < 0.001 && Math.abs(s.cy - s.ty) < 0.001 && s.tx === 0 && s.ty === 0) s.active = false;
      });
    })();
  }

})();
