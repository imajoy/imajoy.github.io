/* Windows / Mac choice for the Wrapline Free and Wrapline Pro downloads.
   The choice is shared with the download code through window.wlOS() ('win' or 'mac'). */
(function () {
  'use strict';
  var KEY = 'wl-os', os = 'win', groups = [];
  var SVG = {
    win: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4.5" width="18" height="12" rx="2"/><path d="M9 20h6M12 16.5V20"/></svg>',
    mac: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="5" width="14" height="10" rx="1.6"/><path d="M3 18.5h18"/></svg>'
  };
  function detect() {
    var ua = navigator.userAgent || '', pf = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '';
    return /mac/i.test(pf) && !/iphone|ipad|ipod|android/i.test(ua) && !(navigator.maxTouchPoints > 1) ? 'mac' : 'win';
  }
  try { var saved = localStorage.getItem(KEY); os = saved === 'mac' || saved === 'win' ? saved : detect(); } catch (e) { os = detect(); }

  window.wlOS = function () { return os; };

  /* Text change: the old words ease out, the new words are set at that exact moment and ease in (opacity and a few
     pixels of travel only, so it runs on the compositor). The first paint is instant; quick switching just retargets. */
  function swapText(node, text) {
    node._want = text;
    if (!node.dataset.ready || !node.animate || matchMedia('(prefers-reduced-motion: reduce)').matches) { node.textContent = text; node.dataset.ready = '1'; return; }
    if (node.textContent === text && !node._out) return;
    if (node._out) return;
    if (node._in) { node._in.cancel(); node._in = null; }
    var out = node.animate([{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(-4px)' }], { duration: 160, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' });
    node._out = out;
    out.onfinish = function () {
      node._out = null; node.textContent = node._want;
      var back = node.animate([{ opacity: 0, transform: 'translateY(5px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 300, easing: 'cubic-bezier(.16,1,.3,1)' });
      back.onfinish = function () { out.cancel(); };
      node._in = back;
    };
  }

  function el(tag, cls, html) { var n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; }

  function build(product) {
    var wrap = el('div', 'pc-wrap'), bar = el('div', 'pc'), soon = el('div', 'pc-soon');
    bar.setAttribute('role', 'radiogroup'); bar.setAttribute('aria-label', 'Choose your computer');
    var thumb = el('i', 'pc-thumb'); thumb.setAttribute('aria-hidden', 'true'); bar.appendChild(thumb);
    ['win', 'mac'].forEach(function (k) {
      var b = el('button', 'pc-opt', SVG[k] + '<span>' + (k === 'win' ? 'Windows' : 'Mac') + '</span>' + (k === 'mac' ? '<em>Beta</em>' : '') );
      b.type = 'button'; b.setAttribute('role', 'radio'); b.dataset.os = k;
      b.addEventListener('click', function () { set(k, true); });
      bar.appendChild(b);
    });
    soon.setAttribute('role', 'status');
    soon.innerHTML = '<span class="pc-soon-ico" aria-hidden="true">' + SVG.mac + '</span><div><b>' + product + ' for Mac is in beta</b>' +
      '<p>It is new and still being tested on real Macs. If anything does not work, please tell us on the Support page.</p></div>';
    var drop = el('div', 'pc-drop'), dropIn = el('div', 'pc-drop-in');
    drop.setAttribute('aria-hidden', 'true'); dropIn.appendChild(soon); drop.appendChild(dropIn); wrap.append(bar, drop);
    var g = { wrap: wrap, bar: bar, soon: soon, drop: drop, product: product };
    groups.push(g); return g;
  }

  function paint() {
    groups.forEach(function (g) {
      g.bar.dataset.os = os;
      [].forEach.call(g.bar.querySelectorAll('.pc-opt'), function (b) { b.setAttribute('aria-checked', String(b.dataset.os === os)); b.tabIndex = b.dataset.os === os ? 0 : -1; });
      g.drop.classList.toggle('is-open', os === 'mac'); g.drop.setAttribute('aria-hidden', String(os !== 'mac'));
    });
    document.documentElement.dataset.os = os;
    var tag = document.querySelector('.download-file small');
    if (tag) {
      var line = (os === 'mac' ? 'macOS (beta)' : 'Windows') + ' · Autodesk Maya 2023–2026 · Wrapline Pro';
      swapText(tag, line);
    }
    var plat = document.getElementById('dl-platform');
    if (plat) {
      var ptxt = 'Autodesk Maya 2023, 2024, 2025 and 2026 on ' + (os === 'mac' ? 'macOS (macOS is in beta)' : 'Windows');
      swapText(plat, ptxt);
    }
    document.dispatchEvent(new CustomEvent('wl:os', { detail: os }));
  }
  function set(k, remember) {
    os = k; if (remember) { try { localStorage.setItem(KEY, k); } catch (e) {} }
    paint();
  }
  function init() {
    var free = document.querySelectorAll('[data-free-download-note]'), pro = document.getElementById('dl-start');
    [].forEach.call(free, function (note) { var g = build('Wrapline Free'); note.parentNode.insertBefore(g.wrap, note); g.wrap.dataset.near = 'free'; });
    if (pro && pro.parentNode) { var p = build('Wrapline Pro'); pro.parentNode.insertBefore(p.wrap, pro); }
    paint();
    /* arrow keys move between Windows and Mac, like a normal radio group */
    document.addEventListener('keydown', function (e) {
      var b = e.target.closest && e.target.closest('.pc-opt'); if (!b || !/^Arrow(Left|Right|Up|Down)$/.test(e.key)) return;
      e.preventDefault(); set(b.dataset.os === 'win' ? 'mac' : 'win', true);
      var g = groups.filter(function (x) { return x.bar.contains(b); })[0]; if (g) g.bar.querySelector('.pc-opt[aria-checked=true]').focus();
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
