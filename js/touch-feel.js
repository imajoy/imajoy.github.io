/* Touch feel for phones and tablets (laptops and desktops have their own hover effects and are never touched by this file):
   1. tap feedback: buttons, links and cards press in softly when touched and spring back,
   2. cards and figures glide in, one after another, as you scroll down to them,
   3. big images get a scroll-linked settle (css/touch-feel.css).
   Content is never hidden by this script: everything is fully visible if it does not run. Off with reduced motion. */
(function () {
  if (!matchMedia('(hover:none) and (pointer:coarse)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!Element.prototype.animate) return;
  var EASE = 'cubic-bezier(.22,1,.36,1)', SPRING = 'cubic-bezier(.34,1.45,.64,1)';
  var path = location.pathname.replace(/\.html$/, '').replace(/\/$/, '');
  var money = /\/(checkout|payment)$/.test(path); /* payment pages stay calm: no reveals, no drift */
  var SKIP = '.reveal,[data-r],[data-policy-reveal],[data-sfx],.sfx-w,#tools,#stage-install,dialog,header,footer,nav,form,[hidden],.iv-wrap,.pmx-menu,.lng-dlg,.coffee';

  /* ---- 1. tap feedback ---- */
  var press = null, hold = null, timer = 0;
  function target(n) {
    var el = n && n.closest && n.closest('a[href],button,summary,[role=button],[data-tap]');
    if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true') return null;
    var cs = getComputedStyle(el); if (cs.display === 'inline' && !el.className) return null;
    var r = el.getBoundingClientRect(); if (r.height > innerHeight * .7 || r.width < 24) return null;
    return el;
  }
  function release() {
    clearTimeout(timer);
    if (!press) return;
    var el = press; press = null;
    if (hold) { hold.cancel(); hold = null; }
    el.animate([{ scale: .965 }, { scale: 1 }], { duration: 420, easing: SPRING });
  }
  document.addEventListener('pointerdown', function (e) {
    if (e.pointerType !== 'touch') return;
    release();
    var el = target(e.target); if (!el) return;
    /* a short pause so a finger that is only starting to scroll does not make everything flinch */
    timer = setTimeout(function () {
      press = el; hold = el.animate([{ scale: 1 }, { scale: .965 }], { duration: 160, easing: EASE, fill: 'forwards' });
    }, 55);
  }, { passive: true });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (t) { document.addEventListener(t, release, { passive: true, capture: true }); });
  addEventListener('scroll', release, { passive: true });

  /* ---- 4. a light tick under the finger on buttons and tabs (Android; other devices ignore it) ---- */
  if (navigator.vibrate) document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('.btn,.bc-nav a,.policy-index a,.pmx-item,[role=tab]');
    if (t && !t.disabled) { try { navigator.vibrate(7); } catch (x) {} }
  }, { passive: true });

  /* ---- 5. pop-ups: pull the top of a window down to dismiss it (phones only; payment pages excluded) ---- */
  if (!money && matchMedia('(max-width:767px)').matches) (function () {
    var dlg = null, y0 = 0, dy = 0, t0 = 0, drag = false;
    document.addEventListener('touchstart', function (e) {
      dlg = null; if (e.touches.length !== 1) return;
      var t = e.touches[0], n = e.target;
      if (!n.closest || n.closest('input,textarea,select,[contenteditable]')) return;
      var d = n.closest('dialog[open]'); if (!d || d.matches('.guest-prompt,.trial-nudge')) return;
      if (t.clientY - d.getBoundingClientRect().top > 64) return;
      dlg = d; y0 = t.clientY; dy = 0; t0 = e.timeStamp; drag = false;
    }, { passive: true });
    document.addEventListener('touchmove', function (e) {
      if (!dlg) return;
      var d = e.touches[0].clientY - y0;
      if (!drag) { if (d > 10) drag = true; else if (d < -10) { dlg = null; return; } else return; }
      if (e.cancelable) e.preventDefault();
      dy = Math.max(0, d); dlg.style.transition = 'none'; dlg.style.translate = '0 ' + (dy < 160 ? dy : 160 + (dy - 160) * .35) + 'px';
    }, { passive: false });
    function end(e) {
      if (!dlg) return;
      var d = dlg; dlg = null;
      if (!drag) return;
      d.style.transition = '';
      var fast = dy / Math.max(1, e.timeStamp - t0) > .6;
      if (dy > 110 || (fast && dy > 40)) {
        var ev = new Event('cancel', { cancelable: true }); d.dispatchEvent(ev);
        if (!ev.defaultPrevented) { d.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: EASE, fill: 'forwards' }).onfinish = function () { d.close(); d.style.translate = ''; }; }
        else setTimeout(function () { d.style.translate = ''; }, 420);
      } else {
        var from = d.style.translate || '0 0';
        d.animate([{ translate: from }, { translate: '0 0' }], { duration: 380, easing: SPRING });
        d.style.translate = '';
      }
    }
    document.addEventListener('touchend', end, { passive: true });
    document.addEventListener('touchcancel', end, { passive: true });
  })();

  if (money || !('IntersectionObserver' in window)) return;

  function ready() {
    var main = document.querySelector('main'); if (!main) return;
    var below = function (el) { return el.getBoundingClientRect().top > innerHeight * .92; };
    var ok = function (el) { return !el.closest(SKIP) && getComputedStyle(el).animationName === 'none'; };

    /* ---- 3. scroll-linked settle for large images ---- */
    if (window.CSS && CSS.supports && CSS.supports('animation-timeline: view()')) {
      [].slice.call(main.querySelectorAll('img,video,picture')).forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.width < 200 || r.height < 100 || !ok(el) || el.closest('a,button,.avatar,[class*=avatar],[class*=logo],[class*=flag]')) return;
        el.classList.add('tf-drift');
      });
    }

    /* ---- 2. cards and figures glide in as they are reached ---- */
    var cards = [].slice.call(main.querySelectorAll('[class*=card]:not([class*=cards]),[class*=tile],.plan,figure,details,.faq-item,[class*=step]:not([class*=steps]),.policy-section,.chipl,.sp-chip'))
      .filter(function (el) { return !el.classList.contains('tf-drift') && ok(el) && below(el) && el.getBoundingClientRect().width > 120; });
    if (!cards.length) return;
    var queue = [], flushing = 0;
    function flush() {
      flushing = 0; var batch = queue.splice(0);
      batch.forEach(function (el, i) {
        el.animate([{ opacity: 0, translate: '0 30px' }, { opacity: 1, translate: '0 0' }], { duration: 800, delay: Math.min(i, 4) * 80, easing: EASE, fill: 'backwards' });
      });
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { io.unobserve(en.target); queue.push(en.target); } });
      if (queue.length && !flushing) flushing = requestAnimationFrame(flush);
    }, { rootMargin: '0px 0px -6% 0px', threshold: .08 });
    cards.forEach(function (el) { io.observe(el); });
  }
  if (document.readyState === 'complete') ready(); else addEventListener('load', ready);
})();
