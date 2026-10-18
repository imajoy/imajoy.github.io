/* Reading-first motion: no hidden terms, looping artwork or scroll hijacking. */
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const panels = [...document.querySelectorAll('[data-policy-reveal]')];
const sections = [...document.querySelectorAll('.policy-section')];
const links = [...document.querySelectorAll('.policy-index nav a')];
const header = document.querySelector('.site-header');
let reveal, frame = 0, scrollAnimation = 0, destination = null, highlight;
// main.js enables site-wide smooth scrolling; legal anchors use a bounded duration.
document.documentElement.style.scrollBehavior = 'auto';

function show(panel, animate = false) {
  if (!animate) panel.setAttribute('data-policy-settled', '');
  panel.setAttribute('data-policy-visible', '');
  reveal?.unobserve(panel);
}
panels.forEach(panel => panel.addEventListener('animationend', event => {
  if (event.target === panel) panel.setAttribute('data-policy-settled', '');
}));
if (!motion.matches && 'IntersectionObserver' in window) {
  reveal = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) show(entry.target, true);
  }, { threshold: 0, rootMargin: '0px 0px 16px 0px' });
  panels.forEach(panel => reveal.observe(panel));
}

function trackReading() {
  frame = 0;
  header?.toggleAttribute('data-policy-compact', scrollY > 80);
  let current = sections[0];
  for (const section of sections) {
    if (section.getBoundingClientRect().top <= 140) current = section;
  }
  if (scrollY + innerHeight >= document.documentElement.scrollHeight - 2) current = sections.at(-1);
  for (const link of links) {
    if (new URL(link.href).hash === '#' + current?.id) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  }
}
window.addEventListener('scroll', () => {
  if (!frame) frame = requestAnimationFrame(trackReading);
}, { passive: true });
window.addEventListener('resize', trackReading, { passive: true });
trackReading();

function hashTarget(hash) {
  try { return document.getElementById(decodeURIComponent(hash.slice(1))); }
  catch { return null; }
}
function indicate(target) {
  const panel = target.closest('[data-policy-reveal]');
  if (panel) show(panel);
  highlight?.cancel();
  if (!motion.matches && target.matches('.policy-section') && target.animate) {
    highlight = target.animate([
      { backgroundColor: '#3d8bff0a' }, { backgroundColor: 'transparent' }
    ], { duration: 600, easing: 'ease-out' });
  }
  trackReading();
}
function focusTarget(target) {
  const heading = target.querySelector('h2') || target;
  if (!heading.hasAttribute('tabindex')) {
    heading.setAttribute('tabindex', '-1');
    heading.addEventListener('blur', () => heading.removeAttribute('tabindex'), { once: true });
  }
  heading.focus({ preventScroll: true });
}
function cancelScroll() {
  cancelAnimationFrame(scrollAnimation);
  scrollAnimation = 0;
  destination = null;
}
function navigate(target) {
  cancelScroll();
  destination = target;
  const start = scrollY;
  const margin = parseFloat(getComputedStyle(target).scrollMarginTop) || 112;
  const end = Math.max(0, Math.min(start + target.getBoundingClientRect().top - margin,
    document.documentElement.scrollHeight - innerHeight));
  const finish = () => {
    scrollAnimation = 0;
    destination = null;
    window.scrollTo({ top: end, behavior: 'instant' });
    focusTarget(target);
    indicate(target);
  };
  if (motion.matches || Math.abs(end - start) < 1) { finish(); return; }
  const began = performance.now();
  const step = now => {
    const progress = Math.min(1, (now - began) / 320);
    window.scrollTo({ top: start + (end - start) * (1 - (1 - progress) ** 3), behavior: 'instant' });
    if (progress < 1) scrollAnimation = requestAnimationFrame(step);
    else finish();
  };
  scrollAnimation = requestAnimationFrame(step);
}
// Full URLs preserve working section links when JavaScript is unavailable.
document.addEventListener('click', event => {
  const link = event.target.closest('a[href]');
  if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.download || (link.target && link.target !== '_self')) return;
  const url = new URL(link.href);
  if (url.origin !== location.origin || url.pathname !== location.pathname || url.search !== location.search || !url.hash) return;
  const target = hashTarget(url.hash);
  if (!target || !(target.matches('.policy-section') || target.id === 'policy-content')) return;
  event.preventDefault();
  if (location.hash !== url.hash) history.pushState(null, '', url.hash);
  navigate(target);
});
// User navigation always interrupts an in-progress anchor scroll.
window.addEventListener('wheel', cancelScroll, { passive: true });
window.addEventListener('touchstart', cancelScroll, { passive: true });
window.addEventListener('keydown', event => {
  if (['Escape', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) cancelScroll();
});
window.addEventListener('popstate', cancelScroll);
window.addEventListener('hashchange', () => {
  cancelScroll();
  const target = hashTarget(location.hash);
  if (target) indicate(target);
});
if (location.hash) {
  const target = hashTarget(location.hash);
  if (target) indicate(target);
}
document.addEventListener('focusin', event => {
  const panel = event.target.closest('[data-policy-reveal]');
  if (panel) show(panel);
});
motion.addEventListener('change', () => {
  if (!motion.matches) return;
  const target = destination;
  cancelScroll();
  highlight?.cancel();
  reveal?.disconnect();
  if (target) navigate(target);
});
