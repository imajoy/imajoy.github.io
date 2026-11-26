/* Windows / Mac choice for the Wrapline Free and Wrapline Pro downloads.
   Windows downloads as before. Mac is being built, so choosing it shows "coming soon" instead of starting a download. */
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

  function el(tag, cls, html) { var n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; }

  function build(product) {
    var wrap = el('div', 'pc-wrap'), bar = el('div', 'pc'), soon = el('div', 'pc-soon');
    bar.setAttribute('role', 'radiogroup'); bar.setAttribute('aria-label', 'Choose your computer');
    var thumb = el('i', 'pc-thumb'); thumb.setAttribute('aria-hidden', 'true'); bar.appendChild(thumb);
    ['win', 'mac'].forEach(function (k) {
      var b = el('button', 'pc-opt', SVG[k] + '<span>' + (k === 'win' ? 'Windows' : 'Mac') + '</span>' + (k === 'mac' ? '<em>Soon</em>' : ''));
      b.type = 'button'; b.setAttribute('role', 'radio'); b.dataset.os = k;
      b.addEventListener('click', function () { set(k, true); });
      bar.appendChild(b);
    });
    soon.setAttribute('role', 'status'); soon.hidden = true;
    soon.innerHTML = '<span class="pc-soon-ico" aria-hidden="true">' + SVG.mac + '</span><div><b>' + product + ' for Mac is coming soon</b>' +
      '<p>We are building the Mac version right now. The Windows version is ready to download today.</p>' +
      '<button type="button" class="pc-soon-go">Get the Windows version</button></div>';
    soon.querySelector('.pc-soon-go').addEventListener('click', function () { set('win', true); });
    wrap.append(bar, soon);
    var g = { wrap: wrap, bar: bar, soon: soon, product: product };
    groups.push(g); return g;
  }

  function paint() {
    groups.forEach(function (g) {
      g.bar.dataset.os = os;
      [].forEach.call(g.bar.querySelectorAll('.pc-opt'), function (b) { b.setAttribute('aria-checked', String(b.dataset.os === os)); b.tabIndex = b.dataset.os === os ? 0 : -1; });
      if (os !== 'mac') g.soon.hidden = true;
    });
    document.documentElement.dataset.os = os;
    var tag = document.querySelector('.download-file small');
    if (tag) { if (!tag.dataset.win) tag.dataset.win = tag.textContent; tag.textContent = os === 'mac' ? 'Mac · Coming soon · Wrapline Pro' : tag.dataset.win; }
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
    /* Mac chosen: any download button shows "coming soon" instead of downloading. Capture phase, so it runs before the download code. */
    document.addEventListener('click', function (e) {
      if (os !== 'mac') return;
      var t = e.target.closest && e.target.closest('[data-free-download],#dl-start,#dl-again');
      if (!t) return;
      e.preventDefault(); e.stopImmediatePropagation();
      var box = t.closest('.hero-copy,.ft-get-cta,.p-idle,.p-done') || document;
      var mine = groups.filter(function (g) { return box.contains(g.wrap); })[0] || groups[0];
      if (mine) { mine.soon.hidden = false; mine.soon.classList.remove('is-in'); void mine.soon.offsetWidth; mine.soon.classList.add('is-in'); }
    }, true);
    /* arrow keys move between Windows and Mac, like a normal radio group */
    document.addEventListener('keydown', function (e) {
      var b = e.target.closest && e.target.closest('.pc-opt'); if (!b || !/^Arrow(Left|Right|Up|Down)$/.test(e.key)) return;
      e.preventDefault(); set(b.dataset.os === 'win' ? 'mac' : 'win', true);
      var g = groups.filter(function (x) { return x.bar.contains(b); })[0]; if (g) g.bar.querySelector('.pc-opt[aria-checked=true]').focus();
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
