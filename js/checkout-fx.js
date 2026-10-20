import {paymentStep} from './checkout-steps.js?v=20261020-steps1';
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
/* Phone: follow the selected provider and hide while its payment controls are visible. */
if (matchMedia('(max-width: 800px)').matches) {
  const totalEl = document.querySelector('#summary-total');
  const bar = document.createElement('div');
  bar.className = 'm-total';
  bar.innerHTML = '<div><small>Total today</small><strong>—</strong></div><button type="button">Continue to pay</button>';
  document.body.append(bar);
  const strong = bar.querySelector('strong');
  const sync = () => { if (totalEl) strong.textContent = totalEl.textContent || '—'; };
  if (totalEl) new MutationObserver(sync).observe(totalEl, { childList: true, characterData: true, subtree: true });
  sync();
  let target = null, shown = false, atBottom = false;
  const apply = () => bar.classList.toggle('on', document.documentElement.dataset.billingBlocked!=='true' && shown && !atBottom && !document.querySelector('.pay-done,[data-payment-complete]'));
  const paymentTarget = () => !paymentStep?document.querySelector('.checkout-continue'):document.documentElement.dataset.paymentProvider==='review'?document.querySelector('.billing-review'):document.documentElement.dataset.paymentProvider==='razorpay'?document.querySelector('.razorpay-panel'):document.querySelector('.paypal-box');
  bar.querySelector('button').addEventListener('click', () => {
    (paymentTarget() || document.querySelector('.checkout-form')).scrollIntoView({ behavior: paused() ? 'auto' : 'smooth', block: 'center' });
  });
  const io = new IntersectionObserver(es => { for (const e of es) if(e.target===target)atBottom = e.isIntersecting; apply(); }, { threshold: 0.2 });
  const watch = () => {io.disconnect();target=paymentTarget();bar.querySelector('button').textContent=!paymentStep?'Continue to payment':document.documentElement.dataset.paymentProvider==='review'?'Review billing':'Continue to pay';atBottom=false;if(target)io.observe(target);apply();};
  document.addEventListener('ajoy:provider-change',watch);
  document.addEventListener('ajoy:billing-network',apply);
  document.addEventListener('ajoy:payment-complete',apply);
  watch();
  setTimeout(watch, 1500); setTimeout(watch, 4000);
  addEventListener('scroll', () => { shown = scrollY > 260; apply(); }, { passive: true });
}
