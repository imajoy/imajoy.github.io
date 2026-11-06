/* Every page: (1) inertial wheel scrolling for mouse wheels (touchpads and touch keep their own native feel),
   (2) a soft load-in for the first block of content. Off with reduced motion. No libraries. */
(function () {
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;
  var root = document.documentElement;

  /* ---- load-in: first section's children rise one after another (skips anything that already has its own animation) ---- */
  function intro() {
    var main = document.querySelector('main'); if (!main || main.classList.contains('home') || !main.animate) return;
    var first = main.querySelector(':scope > section, :scope > .wrap, :scope > div') || main;
    var box = first.querySelector(':scope > .wrap') || first;
    var kids = [].slice.call(box.children).filter(function (el) {
      return !el.hasAttribute('data-r') && !el.classList.contains('reveal') && !el.hidden && getComputedStyle(el).animationName === 'none';
    }).slice(0, 7);
    kids.forEach(function (el, i) {
      el.animate([{ opacity: 0, translate: '0 26px' }, { opacity: 1, translate: '0 0' }], { duration: 900, delay: 80 + i * 90, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', intro); else intro();

  /* ---- inertial wheel scrolling ---- */
  if (!matchMedia('(hover:hover) and (pointer:fine)').matches) return;
  var cur = scrollY, target = scrollY, raf = 0, last = 0, set = scrollY, done = 0;
  var max = function () { return Math.max(0, root.scrollHeight - innerHeight); };
  function inScrollable(el) {
    while (el && el !== document.body && el !== root) {
      if (el.nodeType === 1) { var s = getComputedStyle(el); if (/(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 1) return true; }
      el = el.parentElement;
    }
    return false;
  }
  function wheelLike(e) { return e.deltaMode !== 0 || (!!e.wheelDeltaY && e.wheelDeltaY % 120 === 0); }
  addEventListener('wheel', function (e) {
    if (e.ctrlKey || e.defaultPrevented || e.deltaX && Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    if (getComputedStyle(document.body).overflow === 'hidden' || root.style.overflow === 'hidden' || inScrollable(e.target) || !wheelLike(e)) { if (!raf) cur = target = scrollY; return; }
    e.preventDefault();
    if (!raf) { cur = target = scrollY; }
    var d = e.deltaMode === 1 ? e.deltaY * 34 : e.deltaMode === 2 ? e.deltaY * innerHeight : e.deltaY;
    target = Math.min(max(), Math.max(0, target + d * 1.05));
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
  }, { passive: false });
  function tick(now) {
    var dt = Math.min(48, now - last); last = now;
    cur += (target - cur) * (1 - Math.exp(-dt / 95));
    if (Math.abs(target - cur) < .4) { cur = target; set = cur; scrollTo(0, cur); raf = 0; done = performance.now(); return; }
    set = cur; scrollTo(0, cur); raf = requestAnimationFrame(tick);
  }
  /* keyboard, scrollbar drags and in-page links move the page themselves: follow them */
  addEventListener('scroll', function () { if (raf || performance.now() - done < 140) return; cur = target = scrollY; }, { passive: true });
})();
