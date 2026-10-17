/* Checkout extras: license pass follows the pointer, total rolls when it changes. */
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const paused = () => reduce.matches || document.documentElement.hasAttribute('data-ui-paused');
const host = document.querySelector('.license-preview');
if (host && matchMedia('(hover: hover) and (pointer: fine)').matches) {
  let raf = 0;
  const set = (rx, ry) => { host.style.setProperty('--rx', rx.toFixed(2) + 'deg'); host.style.setProperty('--ry', ry.toFixed(2) + 'deg'); };
  document.addEventListener('pointermove', e => {
    if (paused() || raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const r = host.getBoundingClientRect();
      const x = (e.clientX - (r.left + r.width / 2)) / Math.max(r.width, 1);
      const y = (e.clientY - (r.top + r.height / 2)) / Math.max(r.height, 1);
      set(Math.max(-1, Math.min(1, x)) * 10, Math.max(-1, Math.min(1, y)) * -8);
    });
  }, { passive: true });
  document.addEventListener('pointerleave', () => set(0, 0));
}
const total = document.querySelector('#summary-total');
if (total) {
  new MutationObserver(() => {
    if (paused()) return;
    total.classList.remove('tick'); void total.offsetWidth; total.classList.add('tick');
  }).observe(total, { childList: true, characterData: true, subtree: true });
}
