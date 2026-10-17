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
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var year = $('#year');
  if (year) year.textContent = new Date().getFullYear();

  /* ---------- smooth scrolling ---------- */
  var lenis = null;
  if (window.Lenis && !reduce) {
    try {
      lenis = new window.Lenis({ duration: 1.1, easing: function (t) { return 1 - Math.pow(1 - t, 3); }, smoothWheel: true });
      (function raf(t) { lenis.raf(t); requestAnimationFrame(raf); })(performance.now());
    } catch (err) { lenis = null; }
  }
  if (!lenis) document.documentElement.style.scrollBehavior = reduce ? 'auto' : 'smooth';

  $$('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href');
      var target = id.length > 1 ? $(id) : null;
      if (!target) return;
      e.preventDefault();
      if (lenis) lenis.scrollTo(target, { offset: id === '#top' ? 0 : -20, duration: 1.4 });
      else window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - 20, behavior: reduce ? 'auto' : 'smooth' });
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
    revs.forEach(function (el, i) { el.style.transitionDelay = (i % 2) * 90 + 'ms'; io.observe(el); });
  } else {
    revs.forEach(function (el) { el.classList.add('in'); });
  }

  /* ---------- gentle 3D tilt (smoothed, no CSS transitions) ---------- */
  var tilts = [];
  if (fine && !reduce) {
    $$('.tilt').forEach(function (el) {
      var base = getComputedStyle(el).transform;
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

  /* ---------- pricing toggle ---------- */
  var toggle = $('.toggle');
  if (toggle) {
    var billing = 'monthly';
    var plansEl = $('.plans');
    var money = function (n) { return '$' + n.toLocaleString('en-US'); };

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
          buy.href = link; buy.target = '_blank'; buy.rel = 'noopener';
        } else {
          buy.removeAttribute('target');
          buy.href = 'mailto:' + CONTACT + '?subject=' + encodeURIComponent('Ajoy Tools ' + label + ' subscription (' + billing + ')');
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
})();
