/* Checkout and payment pages: when a discount is applied (a coupon, or the returning-customer reward) a calm banner sits at the
   top of the order summary and a short celebration appears once. Everything is session-only: it is forgotten when the tab closes
   and cleared as soon as a purchase completes. The banner follows the order summary rows, so it never shows a discount the price
   does not include, and it disappears when the discount is removed. */
(function () {
  var SEEN = 'ajoy.offer-seen', GONE = 'ajoy.offer-dismissed';
  function read(k) { try { return JSON.parse(sessionStorage.getItem(k) || '[]'); } catch (e) { return []; } }
  function write(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function clear() { try { sessionStorage.removeItem(SEEN); sessionStorage.removeItem(GONE); } catch (e) {} }
  function $(id) { return document.getElementById(id); }
  var reduce = matchMedia('(prefers-reduced-motion: reduce)');
  var side = document.querySelector('.order-summary');
  if (!side) return;

  document.addEventListener('ajoy:payment-complete', function () { clear(); remove(); });

  var banner = null, toast = null, toastTimer = 0, last = '';

  function current() {
    var row = $('coupon-summary-row'), lo = $('loyalty-summary-row'), code, msg, m, p;
    if (row && !row.hidden) {
      code = (document.querySelector('.sum-coupon input') || $('coupon-code') || {}).value || '';
      code = code.trim().toUpperCase();
      msg = ($('coupon-status') ? $('coupon-status').textContent : '') + ' ' + (document.querySelector('.sum-coupon-msg') ? document.querySelector('.sum-coupon-msg').textContent : '');
      m = msg.match(/(\d{1,3})\s*%/);
      return { key: 'coupon:' + (code || 'applied'), title: code ? code + ' applied' : 'Coupon applied', line: m ? m[1] + '% off is included in your total.' : 'The discount is included in your total.' };
    }
    if (lo && !lo.hidden) {
      p = (($('loyalty-percent') || {}).textContent || '').replace(/\D/g, '');
      return { key: 'loyalty:' + (p || 'reward'), title: (p ? p + '% ' : '') + 'returning-customer reward applied', line: 'A one-time thank-you, already taken off your total.' };
    }
    return null;
  }

  function icon(kind) {
    return kind === 'x'
      ? '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false"><path d="M3.5 3.5l9 9m0-9l-9 9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>'
      : '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><path d="M4 12.5l5 5L20 6.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }

  function remove() {
    if (banner) { banner.remove(); banner = null; }
    hideToast(true);
    last = '';
  }

  function showBanner(o) {
    if (read(GONE).indexOf(o.key) > -1) { if (banner) { banner.remove(); banner = null; } return; }
    if (!banner) {
      banner = document.createElement('div');
      banner.className = 'offer-banner';
      banner.setAttribute('role', 'status');
      side.insertBefore(banner, side.firstChild);
    }
    banner.innerHTML = '<span class="ob-badge">' + icon('ok') + '</span><span class="ob-text"><b></b><small></small></span><button type="button" class="ob-x" aria-label="Dismiss this message">' + icon('x') + '</button>';
    banner.querySelector('b').textContent = o.title;
    banner.querySelector('small').textContent = o.line;
    banner.querySelector('.ob-x').addEventListener('click', function () {
      var g = read(GONE); g.push(o.key); write(GONE, g);
      banner.remove(); banner = null;
    });
  }

  function hideToast(now) {
    clearTimeout(toastTimer);
    if (!toast) return;
    var t = toast; toast = null;
    if (now || reduce.matches) { t.remove(); return; }
    t.classList.add('out');
    setTimeout(function () { t.remove(); }, 380);
  }

  function celebrate(o) {
    hideToast(true);
    toast = document.createElement('div');
    toast.className = 'offer-toast';
    toast.setAttribute('role', 'status');
    toast.innerHTML = '<div class="ot-burst" aria-hidden="true"></div><span class="ot-badge">' + icon('ok') + '</span><span class="ot-text"><b></b><small></small></span><button type="button" class="ot-x" aria-label="Close">' + icon('x') + '</button>';
    toast.querySelector('b').textContent = o.title;
    toast.querySelector('small').textContent = o.line;
    toast.querySelector('.ot-x').addEventListener('click', function () { hideToast(); });
    document.body.appendChild(toast);
    if (!reduce.matches) {
      var burst = toast.querySelector('.ot-burst'), cols = ['#2F6BFF', '#E8B04B', '#2FB67C', '#F26B5B', '#8E7CFF'], i, s, a, d;
      for (i = 0; i < 16; i++) {
        s = document.createElement('i'); a = (i / 16) * Math.PI * 2 + (i % 2 ? .2 : 0); d = 54 + (i % 4) * 14;
        s.style.setProperty('--dx', Math.round(Math.cos(a) * d) + 'px');
        s.style.setProperty('--dy', Math.round(Math.sin(a) * d) + 'px');
        s.style.setProperty('--r', (i * 47 % 180 - 90) + 'deg');
        s.style.background = cols[i % cols.length];
        s.style.animationDelay = (i % 5) * 18 + 'ms';
        burst.appendChild(s);
      }
    }
    requestAnimationFrame(function () { if (toast) toast.classList.add('in'); });
    toastTimer = setTimeout(function () { hideToast(); }, 6500);
    toast.addEventListener('mouseenter', function () { clearTimeout(toastTimer); });
    toast.addEventListener('mouseleave', function () { toastTimer = setTimeout(function () { hideToast(); }, 2500); });
    toast.addEventListener('focusin', function () { clearTimeout(toastTimer); });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && toast && !document.querySelector('dialog[open]')) hideToast();
  });

  function sync() {
    var o = current();
    if (!o) { if (banner || last) remove(); return; }
    showBanner(o);
    if (o.key !== last) {
      last = o.key;
      var seen = read(SEEN);
      if (seen.indexOf(o.key) < 0) { seen.push(o.key); write(SEEN, seen); celebrate(o); }
    }
  }

  var t = 0;
  function later() { clearTimeout(t); t = setTimeout(sync, 160); }
  var obs = new MutationObserver(later);
  ['coupon-summary-row', 'loyalty-summary-row', 'loyalty-percent', 'coupon-status'].forEach(function (id) {
    var n = $(id); if (n) obs.observe(n, { attributes: true, childList: true, characterData: true, subtree: true });
  });
  var box = document.querySelector('.sum-coupon');
  if (box) obs.observe(box, { attributes: true, childList: true, characterData: true, subtree: true });
  /* the coupon box on the billing page is built after load */
  new MutationObserver(function () {
    var b = document.querySelector('.sum-coupon');
    if (b && !b.__ob) { b.__ob = 1; obs.observe(b, { attributes: true, childList: true, characterData: true, subtree: true }); later(); }
  }).observe(side, { childList: true, subtree: true });
  document.addEventListener('ajoy:quote-rendered', later);
  later();
})();
