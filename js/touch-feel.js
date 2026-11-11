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
