/* Demo clips, real quotes, trial request form and the phone shortcut bar. Each part runs only when its markup exists. */
const cfg = window.AJOY_CONFIG || {};
const mediaPreference = matchMedia('(prefers-reduced-motion: reduce)');
const reduce = mediaPreference.matches;
const getJson = async path => { try { const r = await fetch(path, { cache: 'no-cache' }); return r.ok ? await r.json() : null; } catch (e) { return null; } };
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n; };
const slugOk = s => /^[a-z0-9-]{1,60}$/.test(String(s || ''));

const trialSection = document.querySelector('#trial');
if (trialSection && cfg.trialOpen) trialSection.hidden = false;
document.querySelectorAll('[data-trial-days]').forEach(n => { n.textContent = String(cfg.trialDays || 2); });

/* ---- demo clips: assets/demos/index.json lists clips that exist, e.g. [{"slug":"ik-fk-snap","title":"IK / FK Snap","caption":"Snap a pose in one click"}] ---- */
(async () => {
  const slot = document.querySelector('[data-demo]');
  const home = document.querySelector('#demos');
  if (!slot && !home) return;
  const list = await getJson('assets/demos/index.json');
  if (!Array.isArray(list)) return;
  const clips = list.filter(d => d && slugOk(d.slug));
  if (!clips.length) return;
  const visibleVideos = new Set();
  const updateVideo = v => {
    v.controls = mediaPreference.matches;
    if (visibleVideos.has(v) && !mediaPreference.matches && !document.hidden) v.play().catch(() => { v.controls = true; });
    else v.pause();
  };
  mediaPreference.addEventListener('change', () => visibleVideos.forEach(updateVideo));
  document.addEventListener('visibilitychange', () => visibleVideos.forEach(updateVideo));
  const watcher = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    for (const e of entries) {
      const v = e.target;
      if (e.isIntersecting) { visibleVideos.add(v); if (!v.src) v.src = v.dataset.src; }
      else visibleVideos.delete(v);
      updateVideo(v);
    }
  }, { threshold: .4 }) : null;
  const card = d => {
    const fig = el('figure', 'demo-card');
    const v = el('video');
    v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'none'; v.setAttribute('aria-label', (d.title || 'Tool') + ' demonstration');
    v.width = 960; v.height = 540; v.setAttribute('loading', 'lazy');
    v.style.aspectRatio = '16 / 9'; v.style.objectFit = 'contain';
    v.dataset.src = 'assets/demos/' + d.slug + '.mp4';
    if (reduce) v.controls = true;
    fig.appendChild(v);
    const cap = el('figcaption'); cap.appendChild(el('b', '', d.title || ''));
    if (d.caption) cap.appendChild(el('span', '', d.caption));
    fig.appendChild(cap);
    if (watcher) watcher.observe(v); else { v.src = v.dataset.src; v.controls = true; }
    return fig;
  };
  if (slot) {
    const m = location.pathname.match(/tool-([a-z0-9-]+)\.html/);
    const d = m && clips.find(c => c.slug === m[1]);
    if (d) { slot.appendChild(card(d)); slot.hidden = false; }
  }
  if (home) {
    const grid = home.querySelector('.demo-grid');
    clips.forEach(d => grid.appendChild(card(d)));
    home.hidden = false;
  }
})();

/* ---- real quotes: data/testimonials.json, only real, permitted quotes: [{"quote":"...","name":"...","role":"..."}] ---- */
(async () => {
  const box = document.querySelector('#voices');
  if (!box) return;
  const list = await getJson('data/testimonials.json');
  if (!Array.isArray(list) || !list.length) return;
  const grid = box.querySelector('.voices-grid');
  list.filter(q => q && q.approved === true && q.quote && q.name).slice(0, 6).forEach(q => {
    const f = el('figure', 'voice');
    f.appendChild(el('blockquote', '', String(q.quote).slice(0, 400)));
    const c = el('figcaption'); c.appendChild(el('b', '', String(q.name).slice(0, 80)));
    if (q.role) c.appendChild(document.createTextNode(', ' + String(q.role).slice(0, 80)));
    if (q.project) c.appendChild(el('span', 'voice-project', String(q.project).slice(0, 160)));
    if (q.sourceUrl) {
      try {
        const source = new URL(q.sourceUrl);
        if (source.protocol === 'https:') {
          const link = el('a', 'voice-source', 'View original review');
          link.href = source.href; link.rel = 'noopener noreferrer'; c.appendChild(link);
        }
      } catch { /* A malformed source must not prevent an approved quote appearing. */ }
    }
    f.appendChild(c); grid.appendChild(f);
  });
  if (grid.children.length) box.hidden = false;
})();

/* ---- trial request ---- */
(() => {
  const card = document.querySelector('#trial-card');
  const form = document.querySelector('#trial-form');
  if (!card || !form) return;
  const msg = form.querySelector('.trial-msg');
  const say = (t, bad) => { msg.textContent = t; msg.dataset.bad = bad ? '1' : '0'; };
  let sent = '';
  try { sent = localStorage.getItem('ajoy.trial') || ''; } catch (e) { sent = ''; }
  const finish = email => {
    card.dataset.state = 'done';
    const who = card.querySelector('[data-trial-email]'); if (who) who.textContent = email;
  };
  if (sent) finish(sent);
  form.addEventListener('submit', ev => {
    ev.preventDefault();
    const email = form.elements.email.value.trim().toLowerCase();
    const name = form.elements.name.value.trim().slice(0, 80);
    if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email) || email.length > 120) { say('Enter a valid email address.', true); form.elements.email.focus(); return; }
    if (form.elements.website.value) { finish(email); return; } /* hidden field: bots fill it */
    if (!cfg.sheetUrl) { say('Trial requests are not open yet. Please email contactmy3dart@gmail.com.', true); return; }
    const btn = form.querySelector('button[type=submit]'); btn.disabled = true; say('Sending…');
    try {
      fetch(cfg.sheetUrl, { method: 'POST', mode: 'no-cors', keepalive: true, headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ type: 'trial', email, name }) })
        .then(() => { try { localStorage.setItem('ajoy.trial', email); } catch (e) { /* ok */ } finish(email); })
        .catch(() => { btn.disabled = false; say('Could not send. Check your connection and try again.', true); });
    } catch (e) { btn.disabled = false; say('Could not send. Please try again.', true); }
  });
})();

/* ---- phone shortcut bar: Free trial / View plans, hidden while those sections are on screen ---- */
(() => {
  const plans = document.querySelector('#pricing');
  if (!plans || !matchMedia('(max-width:680px)').matches || !('IntersectionObserver' in window)) return;
  const bar = el('div', 'm-cta');
  const p = el('a', 'primary', 'View plans'); p.href = '#pricing';
  if (cfg.trialOpen || document.querySelector('.trial-showcase')) { const t = el('a', '', '2-day trial'); t.href = '#trial'; bar.append(t); }
  bar.append(p); document.body.appendChild(bar);
  const hero = document.querySelector('.hero');
  const seen = new Set();
  let pastHero = false;
  const update = () => bar.classList.toggle('on', pastHero && seen.size === 0);
  const io = new IntersectionObserver(es => { es.forEach(e => e.isIntersecting ? seen.add(e.target) : seen.delete(e.target)); update(); });
  document.querySelectorAll('#trial,#pricing,.closing,.site-footer').forEach(n => io.observe(n));
  if (hero) new IntersectionObserver(es => { pastHero = !es[0].isIntersecting; update(); }, { threshold: .15 }).observe(hero);
})();
