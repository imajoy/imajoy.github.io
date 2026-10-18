/* Keep native details as the no-JS fallback; measure only during interaction. */
const faq = document.querySelector('[data-faq-motion]');
if (faq && typeof Element.prototype.animate === 'function') {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const easing = 'cubic-bezier(.2,.8,.2,1)';
  const states = [];
  const entrances = new Set();

  for (const details of faq.querySelectorAll('details')) {
    const summary = details.querySelector('summary');
    const answer = document.createElement('div');
    answer.className = 'faq-answer';
    answer.append(...[...details.childNodes].filter(node => node !== summary));
    details.append(answer);
    const state = { details, summary, answer, expanded: details.open, animation: null, text: [] };
    states.push(state);

    const sync = () => {
      details.dataset.expanded = String(state.expanded);
      summary.setAttribute('aria-expanded', String(state.expanded));
      answer.inert = !state.expanded;
    };
    const settle = () => {
      state.animation?.cancel();
      state.animation = null;
      state.text.forEach(animation => animation.cancel());
      state.text = [];
      details.open = state.expanded;
      sync();
    };
    state.settle = settle;
    sync();

    summary.addEventListener('click', event => {
      event.preventDefault();
      // Read the rendered size before cancelling a partially completed animation.
      const from = details.open ? answer.getBoundingClientRect().height : 0;
      const textFrom = [...answer.children].map(child => {
        const style = getComputedStyle(child);
        return { opacity: style.opacity, transform: style.transform };
      });
      state.animation?.cancel();
      state.text.forEach(animation => animation.cancel());
      state.expanded = !state.expanded;
      sync();
      if (reducedMotion.matches) { settle(); return; }
      details.open = true;
      const to = state.expanded ? answer.scrollHeight : 0;
      state.animation = answer.animate(
        [{ height: `${from}px` }, { height: `${to}px` }],
        { duration: 260, easing }
      );
      state.text = [...answer.children].map((child, index) => child.animate([
        from ? textFrom[index] : { opacity: 0, transform: 'translateY(-6px)' },
        { opacity: state.expanded ? 1 : 0, transform: state.expanded ? 'translateY(0)' : 'translateY(-4px)' }
      ], { duration: state.expanded ? 220 : 180, delay: state.expanded ? Math.min(index * 30, 40) : 0, easing, fill: 'both' }));
      state.animation.onfinish = settle;
    });

    // Preserve external/native toggles (for example browser find-in-page).
    details.addEventListener('toggle', () => {
      if (!state.animation) { state.expanded = details.open; sync(); }
    });
  }

  // Wait until the first row is visible, then cascade once. Rows stay available
  // before this point, including when scripts or IntersectionObserver are absent.
  let observer;
  if (!reducedMotion.matches && 'IntersectionObserver' in window) {
    observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      if (reducedMotion.matches || faq.contains(document.activeElement)) return;
      states.forEach(({ details }, index) => {
        const animation = details.animate([
          { opacity: 0, transform: 'translateY(10px)' },
          { opacity: 1, transform: 'translateY(0)' }
        ], { duration: 250, delay: index * 50, easing, fill: 'backwards' });
        entrances.add(animation);
        animation.onfinish = () => entrances.delete(animation);
      });
    }, { threshold: 0.1 });
    observer.observe(states[0].details);
  }
  faq.addEventListener('focusin', () => {
    observer?.disconnect();
    entrances.forEach(animation => animation.cancel());
    entrances.clear();
  });
  // A resize must never leave a wrapped answer clipped at its previous height.
  window.addEventListener('resize', () => states.forEach(state => state.settle()), { passive: true });
  reducedMotion.addEventListener('change', () => {
    if (!reducedMotion.matches) return;
    observer?.disconnect();
    entrances.forEach(animation => animation.cancel());
    entrances.clear();
    states.forEach(state => state.settle());
  });
}
