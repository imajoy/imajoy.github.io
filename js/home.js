/* Home page behaviour: reveals, hero camera push, viewport frame counter, Outliner -> Attribute Editor, time slider, slate.
   Everything reads layout once per frame at most and only writes transform/opacity-driving CSS variables. */
(function () {
  /* intro curtain: lifts after about a second (first visit of the session), hero then starts */
  var rt = document.documentElement;
  if (rt.classList.contains('h-pre')) { setTimeout(function () { rt.classList.add('h-pre-out'); rt.classList.remove('h-pre'); setTimeout(function () { rt.classList.remove('h-pre-out'); }, 1000); }, 1250); }
  var root = document.documentElement, reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var home = document.querySelector('main.home'); if (!home) return;
  if (!reduce && 'IntersectionObserver' in window) root.classList.add('h-js');

  /* section headings arrive word by word */
  (function () {
    var n = 0;
    function split(node) {
      [].slice.call(node.childNodes).forEach(function (c) {
        if (c.nodeType === 3) {
          var f = document.createDocumentFragment();
          c.nodeValue.split(/(\s+)/).forEach(function (t) {
            if (!t) return; if (/^\s+$/.test(t)) { f.appendChild(document.createTextNode(' ')); return; }
            var w = document.createElement('span'), i = document.createElement('span'); w.className = 'w'; i.textContent = t; i.style.setProperty('--i', n++); w.appendChild(i); f.appendChild(w);
          });
          c.parentNode.replaceChild(f, c);
        } else if (c.nodeType === 1 && !c.classList.contains('w')) split(c);
      });
    }
    if (!reduce) home.querySelectorAll('.h-head h2, .h-head-c h2, .h-setup h2, .h-credits h2').forEach(function (h) { n = 0; h.setAttribute('aria-label', h.textContent); split(h); });
  })();

  /* reveals (once), slate replays every time it comes back */
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -10% 0px', threshold: .12 });
    home.querySelectorAll('[data-r]').forEach(function (el) { if (!el.classList.contains('w-card')) io.observe(el); });
    var card = home.querySelector('.w-card'), take = home.querySelector('.sl-take'), n = 1;
    if (card) new IntersectionObserver(function (es) {
      var e = es[0];
      if (e.isIntersecting) { card.classList.add('in'); }
      else if (card.classList.contains('in') && e.boundingClientRect.top > 0) { card.classList.remove('in'); n++; if (take) take.textContent = n; }
    }, { threshold: .35 }).observe(card);
    var slider = home.querySelector('.t-slider');
    if (slider && !reduce) new IntersectionObserver(function (es) { slider.classList.toggle('play', es[0].isIntersecting); }).observe(slider);
  }

  /* hero: camera push on scroll + frame counter in the HUD */
  var hero = home.querySelector('.h-hero'), frameEl = home.querySelector('.g-frame');
  if (hero && !reduce) {
    var raf = 0, lastP = -1, heroVis = true, hH = hero.offsetHeight;
    var hc = hero.querySelector('.h-copy'), hd = hero.querySelector('.h-stage'), hg = hero.querySelector('.h-gate');
    var setP = function (p) {
      if (hc) { hc.style.translate = '0 ' + (-46 * p).toFixed(1) + 'px'; hc.style.opacity = (1 - p * .7).toFixed(3); }
      if (hd) hd.style.translate = '0 ' + (-22 * p).toFixed(1) + 'px';
      if (hg) { hg.style.transform = 'scale(' + (1 - p * .05).toFixed(4) + ')'; hg.style.opacity = (1 - p * .9).toFixed(3); }
    };
    var onScroll = function () { if (!raf) raf = requestAnimationFrame(apply); };
    var apply = function () {
      raf = 0; var y = window.scrollY; if (y > hH) { if (lastP !== 1) { lastP = 1; setP(1); } return; }
      var p = Math.round(Math.min(1, Math.max(0, y / (hH * .85))) * 1000) / 1000;
      if (p !== lastP) { lastP = p; setP(p); }
    };
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', function () { hH = hero.offsetHeight; onScroll(); });
    new IntersectionObserver(function (es) { heroVis = es[0].isIntersecting; }).observe(hero);
    if (frameEl) {
      var f0 = performance.now(), shown = 0;
      setInterval(function () {
        if (!heroVis || document.hidden) return;
        var f = 1001 + Math.floor((performance.now() - f0) / 1000 * 24) % 240;
        if (f !== shown) { shown = f; frameEl.textContent = f; }
      }, 1000 / 24);
    }
    apply();
  }

  var mq = home.querySelector('.n-marq');
  if (mq && 'IntersectionObserver' in window) new IntersectionObserver(function (es) { mq.classList.toggle('on', es[0].isIntersecting); }).observe(mq); else if (mq) mq.classList.add('on');

  /* Outliner -> Attribute Editor */
  var rows = [].slice.call(home.querySelectorAll('.o-row')), ae = home.querySelector('.o-ae');
  if (rows.length && ae) {
    var box = ae.querySelector('.o-ae-in'), q = function (s) { return ae.querySelector(s); }, cur = null, tm;
    var pick = function (row, first) {
      if (row === cur) return; if (cur) cur.classList.remove('sel'); cur = row; row.classList.add('sel');
      var name = row.querySelector('.o-name').textContent, kit = row.dataset.kit, h = row.style.getPropertyValue('--h');
      box.classList.remove('draw'); if (!first && !reduce) box.classList.add('sw');
      ae.style.setProperty('--h', h);
      q('.o-ae-node').textContent = (kit === 'Wrapline' ? 'wrapline' : 'wrapline_pro') + ':' + name.replace(/[^A-Za-z0-9]+/g, '_').replace(/_$/, '');
      q('.o-ae-ico').textContent = row.querySelector('.o-ico').textContent;
      q('.o-ae-kit').textContent = kit; q('.o-ae-name').textContent = name;
      q('.a-kit').textContent = kit; q('.a-cat').textContent = row.dataset.cat; q('.a-plan').textContent = row.dataset.plan;
      q('.o-ae-desc').textContent = row.querySelector('.o-desc').textContent;
      var go = q('.o-ae-go'); go.href = row.getAttribute('href'); go.firstChild.nodeValue = 'Open the ' + name + ' guide ';
      window.__shelfKey = row.getAttribute('href').replace(/^tool-|\.html$/g, ''); if (window.__shelfSet) window.__shelfSet(window.__shelfKey);
      clearTimeout(tm);
      requestAnimationFrame(function () { box.classList.remove('sw'); if (!reduce) { void box.offsetWidth; box.classList.add('draw'); } });
    };
    rows.forEach(function (r) { r.addEventListener('pointerenter', function () { pick(r); }); r.addEventListener('focus', function () { pick(r); }); });
    var start = rows.filter(function (r) { return /drag-drop/.test(r.getAttribute('href')); })[0] || rows[0];
    pick(start, true); ae.classList.add('ready'); var app = ae.closest('.o-app'); if (app) app.classList.add('ready');
  }
})();
