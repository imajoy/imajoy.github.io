/* Tool explainer player: a short, looping "video" of a tool working inside a Maya window.
   Data per tool lives in js/tool-explainers.js (steps, panel UI, scene art, cursor script).
   - one clock drives everything, so pause/resume and chapter jumps stay in sync
   - plays only while on screen and while the tab is visible
   - reduced motion: no autoplay; chapter buttons show each step's finished state
   - without JavaScript the page keeps the plain step list from the markup */
import XP from './tool-explainers.js';

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const W = 640, H = 400, HOLD = 1800;
const GRID = '<path d="M-40 342L150 190H490L680 342M60 262H580M10 300H630M250 190L180 342M320 190V342M390 190L460 342M-10 342L110 190M530 190L650 342" fill="none" stroke="rgba(150,175,255,.16)" stroke-width="1"/>';
const PRO = [['IK', 200], ['AB', 150], ['AU', 320], ['FB', 25], ['HK', 270], ['PB', 0], ['RB', 175], ['RV', 240], ['RI', 340], ['DD', 48]];
const FREE = [['IK', 200], ['MS', 280], ['UV', 40], ['LP', 150]];
const ARROW = '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M5 3l14 8-6 1.8L9.8 19z" fill="#fff" stroke="#0b0d14" stroke-width="1.4" stroke-linejoin="round"/></svg>';

class Player {
  constructor(fig, list) {
    this.fig = fig; this.list = list; this.li = 0; fig.__player = this; this.hero = !!fig.closest('.h-hero');
    this.shell(); this.load(list[0]);
    this.playing = false; this.visible = false;
    if (reduce) { this.seekEnd(this.steps.length - 1); }
    else {
      new IntersectionObserver(es => { this.visible = es[0].isIntersecting; this.sync(); }, { threshold: .12 }).observe(this.root);
      document.addEventListener('visibilitychange', () => this.sync());
      if (this.hero) window.addEventListener('shelf-change', () => { if (this.list.length > 1 && this.keyOf(this.cfg) === window.__shelfKey) { this.advance(); this.seek(0); this.clock = 0; } });
    }
  }
  keyOf(cfg) { return Object.keys(XP).find(k => XP[k] === cfg); }
  /* next tool in the loop, never the one the shelf is showing right now */
  advance() { for (let n = 0; n < this.list.length; n++) { this.li = (this.li + 1) % this.list.length; if (!this.hero || this.keyOf(this.list[this.li]) !== window.__shelfKey) break; } this.load(this.list[this.li]); }
  /* scroll-driven hero: show tool i now and stay on it (no auto-advance while manual) */
  jump(i) { if (i === this.li && this.cfg === this.list[i]) return; this.li = i; this.load(this.list[i]); this.seek(0); this.clock = 0; this.chips.forEach(c => this.prog(c, 0)); this.sync(); }
  setTool(cfg) { if (this.cfg === cfg) return; this.list = [cfg]; this.li = 0; this.load(cfg); this.seek(0); this.clock = 0; this.sync(); }
  load(cfg) {
    this.cfg = cfg; if (this.hero) window.__heroKey = this.keyOf(cfg); this.announce = true; this.steps = cfg.steps; this.acts = []; this.starts = []; let t = 0;
    this.steps.forEach((s, i) => { this.starts.push(t); (s.a || []).forEach(a => this.acts.push({ t: t + a[0], a: a.slice(1), i })); t += s.d; });
    this.total = t; this.acts.sort((x, y) => x.t - y.t);
    this.render(); this.reset(); this.clock = null;
  }
  shell() {
    const root = document.createElement('div'); root.className = 'xp'; root.setAttribute('role', 'group');
    this.fig.querySelector('.xp-fallback')?.remove();
    const head = this.fig.querySelector('.visual-heading'), cap = this.fig.querySelector('figcaption');
    if (this.fig.hasAttribute('data-shelf')) this.fig.append(root); else (head || this.fig).after(root); this.head = head;
    /* no play/pause button: the demo always runs on its own */
    if (cap && !this.fig.hasAttribute('data-keep-caption')) cap.textContent = 'Animated demo · based on the Wrapline Pro guide';
    this.root = root;
    const fit = () => { if (!this.frame) return; const s = this.frame.clientWidth / W; this.s = s; this.canvas.style.transform = `scale(${s})`; };
    this.fit = fit; new ResizeObserver(fit).observe(root);
  }
  render() {
    const c = this.cfg, grp = c.group === 'free' ? FREE : PRO, ix = c.ix, root = this.root;
    const shelf = grp.map(([a, h], i) => `<span class="xp-sh${i === ix ? ' me' : ''}" style="--h:${h}"${i === ix ? ' data-k="sh"' : ''}>${a}</span>`).join('');
    const p = c.panel;
    root.setAttribute('aria-label', `${c.title}: animated walkthrough in ${this.steps.length} steps`);
    if (this.head && this.fig.dataset.label) this.head.querySelector('span').textContent = this.fig.dataset.label + ' · ' + c.title.toUpperCase();
    root.innerHTML = `
      <div class="xp-frame"><div class="xp-canvas" aria-hidden="true">
        <div class="xp-top"><i></i><i></i><i></i><b data-k="ttl">Autodesk Maya 2026 &nbsp;·&nbsp; ${c.file || 'shot_010_anim.ma'}</b><span>${c.menu || 'File &nbsp; Edit &nbsp; Create &nbsp; Windows &nbsp; Wrapline'}</span></div>
        <div class="xp-shelf">${shelf}</div>
        <div class="xp-vp"><svg class="xp-scene" viewBox="0 0 ${W} 342" width="${W}" height="342">${GRID}${c.scene || ''}</svg>
          <div class="xp-panel" style="left:${p.x}px;top:${p.y}px;width:${p.w}px"><div class="xp-ph"><i></i>${c.title}</div><div class="xp-pb"${p.h ? ` style="height:${p.h}px"` : ''}>${p.html}</div></div>
          <div class="xp-toast"></div></div>
        <div class="xp-cur">${ARROW}</div>
      </div></div>
      <div class="xp-cap" aria-live="polite"><b></b><p></p></div>
      <div class="xp-steps" style="--n:${this.steps.length}">${this.steps.map((s, i) => `<button type="button" class="xp-step" data-i="${i}"><small>0${i + 1}</small><span>${s.t}</span><i class="xp-fill"></i></button>`).join('')}</div>`;
    this.frame = root.querySelector('.xp-frame'); if (this.announce) { this.announce = false; const st = this.fig.closest('.pro-stage'); if (st) { this.frame.classList.add('ps-in'); st.dispatchEvent(new CustomEvent('xp-tool', { detail: { ix: this.cfg.ix, title: this.cfg.title } })); } } this.canvas = root.querySelector('.xp-canvas'); this.vp = root.querySelector('.xp-vp');
    this.panel = root.querySelector('.xp-panel'); this.pb = root.querySelector('.xp-pb'); this.scene = root.querySelector('.xp-scene'); this.cur = root.querySelector('.xp-cur'); this.toastEl = root.querySelector('.xp-toast');
    this.capB = root.querySelector('.xp-cap b'); this.capP = root.querySelector('.xp-cap p'); this.chips = [...root.querySelectorAll('.xp-step')];
    this.init = { pb: this.pb.innerHTML, scene: this.scene.innerHTML, ttl: root.querySelector('[data-k=ttl]').innerHTML };
    this.chips.forEach(b => b.addEventListener('click', () => { this.user = false; this.seek(+b.dataset.i); this.sync(); }));
    this.fit();
  }
  q(k) { return this.root.querySelector(`[data-k="${k}"]`); }
  qa(k) { return [...this.root.querySelectorAll(`[data-k="${k}"]`)]; }
  reset() {
    this.pb.innerHTML = this.init.pb; this.scene.innerHTML = this.init.scene; this.q('ttl').innerHTML = this.init.ttl;
    this.panel.classList.remove('vis'); this.toastEl.classList.remove('vis'); this.tweens = []; this.idx = 0; this.chap = -1;
    const start = this.cfg.cursor || [440, 290]; this.moveCursor(start[0], start[1], true);
  }
  instant(fn) { this.canvas.classList.add('xp-now'); fn(); void this.canvas.offsetWidth; this.canvas.classList.remove('xp-now'); }
  moveCursor(x, y, now) { if (now) this.instant(() => { this.cur.style.transform = `translate(${x}px,${y}px)`; }); else this.cur.style.transform = `translate(${x}px,${y}px)`; this.cx = x; this.cy = y; }
  center(el) { const cr = this.canvas.getBoundingClientRect(), r = el.getBoundingClientRect(), s = this.s || 1; return [(r.left - cr.left + r.width * .5) / s, (r.top - cr.top + r.height * .55) / s]; }
  run(a, now, at) {
    const [cmd, k, v, d] = a, el = k && cmd !== 'toast' && cmd !== 'panel' ? this.q(k) : null;
    switch (cmd) {
      case 'mv': if (el) { const [x, y] = this.center(el); this.moveCursor(x - 3, y - 4, now); } break;
      case 'clk': if (!now) { this.cur.classList.add('down'); setTimeout(() => this.cur.classList.remove('down'), 190); const rip = document.createElement('span'); rip.className = 'xp-rip'; rip.style.left = this.cx + 'px'; rip.style.top = this.cy + 'px'; this.canvas.append(rip); setTimeout(() => rip.remove(), 700); if (el) { el.classList.add('hit'); setTimeout(() => el.classList.remove('hit'), 260); } } break;
      case 'on': this.qa(k).forEach(e => e.classList.add('on')); break;
      case 'off': this.qa(k).forEach(e => e.classList.remove('on')); break;
      case 'pick': if (el) { el.parentElement.querySelectorAll(':scope > .on').forEach(e => e.classList.remove('on')); el.classList.add('on'); } break;
      case 'set': this.qa(k).forEach(e => { const t = e.querySelector('.t') || e; t.textContent = v; e.classList.add('has'); }); break;
      case 'css': this.qa(k).forEach(e => e.style.setProperty(v, d)); break;
      case 'show': this.qa(k).forEach(e => e.classList.add('vis')); break;
      case 'hide': this.qa(k).forEach(e => e.classList.remove('vis')); break;
      case 'panel': this.panel.classList.toggle('vis', k !== 'hide'); break;
      case 'page': if (el) { el.parentElement.querySelectorAll(':scope > .xp-pg.on').forEach(e => e.classList.remove('on')); el.classList.add('on'); } break;
      case 'focus': this.root.querySelectorAll('.xp-in.focus').forEach(e => e.classList.remove('focus')); if (el) el.classList.add('focus'); break;
      case 'blur': this.root.querySelectorAll('.xp-in.focus').forEach(e => e.classList.remove('focus')); break;
      case 'toast': this.toastEl.textContent = k; this.toastEl.classList.add('vis'); break;
      case 'untoast': this.toastEl.classList.remove('vis'); break;
      case 'type': if (el) { const t = el.querySelector('.t'); el.classList.add('has'); if (now) t.textContent = v; else { let shown = -1; this.tweens.push({ t0: at, d: d || 900, f: p => { const n = Math.round(v.length * p); if (n !== shown) { shown = n; t.textContent = v.slice(0, n); } } }); } } break;
      case 'fill': if (el) { const i = el.querySelector('i'); el.classList.add('vis'); if (now) i.style.transform = 'scaleX(1)'; else this.tweens.push({ t0: at, d: v || 1200, f: p => { i.style.transform = 'scaleX(' + p.toFixed(3) + ')'; } }); } break;
    }
  }
  seek(i) {
    const to = this.starts[i]; this.reset();
    this.instant(() => { while (this.idx < this.acts.length && this.acts[this.idx].t < to) this.run(this.acts[this.idx++].a, true); });
    this.clock = to; this.show(i);
  }
  seekEnd(i) { this.reset(); const to = this.starts[i] + this.steps[i].d; this.instant(() => { while (this.idx < this.acts.length && this.acts[this.idx].t < to) this.run(this.acts[this.idx++].a, true); }); this.clock = to; this.show(i, true); this.chips.forEach((c, n) => this.prog(c, n <= i ? 1 : 0)); }
  show(i, still) {
    if (i === this.chap) return; this.chap = i; const s = this.steps[i];
    this.chips.forEach((c, n) => c.classList.toggle('on', n === i));
    const swap = () => { this.capB.textContent = s.t; this.capP.textContent = s.c; this.capB.parentElement.classList.remove('sw'); };
    if (still || !this.capB.textContent) swap(); else { this.capB.parentElement.classList.add('sw'); setTimeout(swap, 180); }
  }
  /* step progress: a transform on the little bar (never a width), written only when it actually changes, so the page is not re-laid-out every frame */
  prog(c, p) { const v = Math.round(p * 500) / 500; if (c.__p === v) return; c.__p = v; (c.__f || (c.__f = c.querySelector('.xp-fill'))).style.transform = 'scaleX(' + v + ')'; }
  sync() {
    const want = !reduce && this.visible && !document.hidden && !this.user;
    this.btn && (this.btn.classList.toggle('paused', !want && this.user), this.btn.setAttribute('aria-label', this.user ? 'Play the demo' : 'Pause the demo'));
    if (want && !this.playing) { this.playing = true; if (this.clock == null) this.seek(0); this.last = performance.now(); requestAnimationFrame(t => this.tick(t)); }
    else if (!want) this.playing = false;
  }
  tick(now) {
    if (!this.playing) return;
    const dt = Math.min(80, now - this.last); this.last = now; this.clock += dt;
    while (this.idx < this.acts.length && this.acts[this.idx].t <= this.clock) { const a = this.acts[this.idx++]; this.run(a.a, false, a.t); }
    this.tweens = this.tweens.filter(w => { const p = Math.min(1, (this.clock - w.t0) / w.d); w.f(p); return p < 1; });
    let ci = 0; for (let n = 0; n < this.starts.length; n++) if (this.clock >= this.starts[n]) ci = n;
    this.show(Math.min(ci, this.steps.length - 1));
    this.chips.forEach((c, n) => this.prog(c, Math.max(0, Math.min(1, (this.clock - this.starts[n]) / this.steps[n].d))));
    if (this.clock >= this.total + HOLD) { if (this.list.length > 1 && !this.manual) this.advance(); this.seek(0); this.clock = 0; this.chips.forEach(c => this.prog(c, 0)); }
    requestAnimationFrame(t => this.tick(t));
  }
}

/* lazy start: a player is only built when its figure is near the screen, and the hero one waits for an idle moment so first paint stays light */
const whenNear = (el, fn, margin) => { let done = false; const go = () => { if (!done) { done = true; fn(); } };
  if (!('IntersectionObserver' in window)) return go();
  const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); go(); } }, { rootMargin: margin || '400px 0px' }); io.observe(el); };
const idle = fn => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 700 }) : setTimeout(fn, 200));
document.querySelectorAll('[data-shelf]').forEach(fig => { let pl = null, want = null; window.__shelfSet = k => { if (!XP[k]) return; if (pl) pl.setTool(XP[k]); else want = k; };
  whenNear(fig, () => idle(() => { pl = new Player(fig, [XP[want || window.__shelfKey] || XP['drag-drop']]); }), '500px 0px'); });
document.querySelectorAll('[data-explainer]').forEach(fig => { const list = fig.dataset.explainer.split(',').map(k => XP[k.trim()]).filter(Boolean); if (!list.length) return;
  const hero = !!fig.closest('.h-hero'); whenNear(fig, () => (hero ? idle : (f => f()))(() => new Player(fig, list)), hero ? '0px' : '500px 0px'); });
