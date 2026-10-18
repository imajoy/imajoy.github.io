/* Staggers tool rows and rolls the price numbers (count up/down) when the billing toggle changes. */
if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
  document.querySelectorAll('.tile .tl').forEach(ul => [...ul.children].forEach((li, i) => li.style.setProperty('--i', i)));
  const num = t => { const m = /[\d,]+(?:\.\d+)?/.exec(t); return m ? { v: parseFloat(m[0].replace(/,/g, '')), s: t, m } : null; };
  document.querySelectorAll('[data-amt]').forEach(el => {
    let last = num(el.textContent), busy = false;
    new MutationObserver(() => {
      if (busy) return;
      const now = num(el.textContent);
      if (!now || !last || now.v === last.v || now.s.replace(/[\d,.]+/, '#') !== last.s.replace(/[\d,.]+/, '#')) { last = now || last; return; }
      const from = last.v, to = now.v, end = el.textContent, t0 = performance.now(), dec = /\./.test(now.m[0]) ? 2 : 0;
      last = now; busy = true;
      const fmt = n => end.replace(now.m[0], n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }));
      const step = t => {
        const k = Math.min(1, (t - t0) / 600), e = 1 - Math.pow(1 - k, 3);
        el.textContent = k < 1 ? fmt(from + (to - from) * e) : end;
        if (k < 1) requestAnimationFrame(step); else busy = false;
      };
      requestAnimationFrame(step);
    }).observe(el, { childList: true, characterData: true, subtree: true });
  });
}
