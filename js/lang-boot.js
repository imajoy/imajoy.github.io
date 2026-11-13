/* Site language. English is the default. A visitor can pick another language from the profile menu; the page is then
   translated automatically (Google's page translator, loaded only when a non-English language is chosen) and the choice is
   remembered on this device. Nothing is loaded for English. Brand names, prices, codes and invoices are never translated.
   Exposes window.AjoyLang { list, current(), set(code), onChange(fn) } for the language window in the profile menu. */
(function () {
  var KEY = 'ajoy-lang', root = document.documentElement, listeners = [];
  /* [google code, native name, English name, flag file in img/flags] */
  var LIST = [
    ['en', 'English', 'English', 'gb'], ['id', 'Bahasa Indonesia', 'Indonesian', 'id'], ['ms', 'Bahasa Melayu', 'Malay', 'my'],
    ['de', 'Deutsch', 'German', 'de'], ['es', 'Español', 'Spanish', 'es'], ['fil', 'Filipino', 'Filipino', 'ph'],
    ['fr', 'Français', 'French', 'fr'], ['hr', 'Hrvatski', 'Croatian', 'hr'], ['it', 'Italiano', 'Italian', 'it'],
    ['lt', 'Lietuvių', 'Lithuanian', 'lt'], ['lv', 'Latviešu', 'Latvian', 'lv'], ['hu', 'Magyar', 'Hungarian', 'hu'],
    ['nl', 'Nederlands', 'Dutch', 'nl'], ['no', 'Norsk', 'Norwegian', 'no'], ['pl', 'Polski', 'Polish', 'pl'],
    ['pt', 'Português', 'Portuguese', 'br'], ['ro', 'Română', 'Romanian', 'ro'], ['sk', 'Slovenčina', 'Slovak', 'sk'],
    ['sl', 'Slovenščina', 'Slovenian', 'si'], ['fi', 'Suomi', 'Finnish', 'fi'], ['sv', 'Svenska', 'Swedish', 'se'],
    ['vi', 'Tiếng Việt', 'Vietnamese', 'vn'], ['tr', 'Türkçe', 'Turkish', 'tr'], ['cs', 'Čeština', 'Czech', 'cz'],
    ['da', 'Dansk', 'Danish', 'dk'], ['el', 'Ελληνικά', 'Greek', 'gr'], ['bg', 'Български', 'Bulgarian', 'bg'],
    ['ru', 'Русский', 'Russian', 'ru'], ['sr', 'Српски', 'Serbian', 'rs'], ['uk', 'Українська', 'Ukrainian', 'ua'],
    ['hi', 'हिन्दी', 'Hindi', 'in'], ['bn', 'বাংলা', 'Bengali', 'bd'], ['ta', 'தமிழ்', 'Tamil', 'in'],
    ['te', 'తెలుగు', 'Telugu', 'in'], ['mr', 'मराठी', 'Marathi', 'in'], ['gu', 'ગુજરાતી', 'Gujarati', 'in'],
    ['kn', 'ಕನ್ನಡ', 'Kannada', 'in'], ['ml', 'മലയാളം', 'Malayalam', 'in'], ['pa', 'ਪੰਜਾਬੀ', 'Punjabi', 'in'],
    ['th', 'ไทย', 'Thai', 'th'], ['ko', '한국어', 'Korean', 'kr'], ['ja', '日本語', 'Japanese', 'jp'],
    ['zh-CN', '简体中文', 'Chinese (Simplified)', 'cn'], ['zh-TW', '繁體中文', 'Chinese (Traditional)', 'tw']
  ];
  var CODES = LIST.map(function (l) { return l[0]; });
  var LATIN = 'en id ms de es fil fr hr it lt lv hu nl no pl pt ro sk sl fi sv tr cs da'.split(' ');
  function script(code) { if (code === 'en') root.removeAttribute('data-script'); else root.setAttribute('data-script', LATIN.indexOf(code) > -1 ? 'latin' : 'complex'); }
  function stored() { try { var v = localStorage.getItem(KEY); return CODES.indexOf(v) > -1 ? v : 'en'; } catch (e) { return 'en'; } }
  var cur = stored(), loading = null;
  /* only pages that opt in (<meta name="ajoy-translate">) may run the translator; the others stay English and keep the saved choice */
  var CAN = !!document.querySelector('meta[name="ajoy-translate"][content="on"]');
  function cookie(code) {
    var v = code === 'en' ? '' : '/en/' + code;
    document.cookie = 'googtrans=' + v + ';path=/;max-age=' + (code === 'en' ? 0 : 31536000) + ';SameSite=Lax';
  }
  /* things that must stay exactly as written, in every language */
  function protect() {
    try { document.querySelectorAll('code,pre,kbd,samp,select,option,textarea,.notranslate,#iv-print,.iv-paper,[data-price],.brand,.logo,.wordmark,.fp-word').forEach(function (e) { e.setAttribute('translate', 'no'); e.classList.add('notranslate'); }); } catch (e) {}
    brandNames(document.body);
  }
  /* product names stay in English in every language ("Wrapline Free" must never become "free wrap line") */
  var BRAND = /\bWrapline(?:\s+(?:Free|Pro)(?:\s+(?:Basic|Premium))?)?\b/g;
  function brandNames(root) {
    if (!root || !document.createTreeWalker) return;
    try {
      var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: function (n) {
        var p = n.parentElement; if (!p || !/Wrapline/.test(n.nodeValue)) return NodeFilter.FILTER_REJECT;
        if (p.closest('script,style,textarea,select,option,title,button,.btn,.lx-btn,[data-bm],.fp-stub,.notranslate,[translate=no]')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT; } });
      var list = []; while (w.nextNode()) list.push(w.currentNode);
      list.forEach(function (n) {
        var t = n.nodeValue, frag = document.createDocumentFragment(), last = 0; BRAND.lastIndex = 0; var m;
        while ((m = BRAND.exec(t))) { if (m.index > last) frag.appendChild(document.createTextNode(t.slice(last, m.index))); var sp = document.createElement('span'); sp.className = 'notranslate'; sp.setAttribute('translate', 'no'); sp.textContent = m[0]; frag.appendChild(sp); last = m.index + m[0].length; }
        if (last < t.length) frag.appendChild(document.createTextNode(t.slice(last)));
        /* inside a flex or grid box every loose piece becomes its own column, so the whole sentence goes into one wrapper to stay together */
        var pd = ''; try { pd = getComputedStyle(n.parentNode).display; } catch (e) {}
        if (/flex|grid/.test(pd)) { var wrap = document.createElement('span'); wrap.appendChild(frag); frag = wrap; }
        n.parentNode.replaceChild(frag, n);
      });
    } catch (e) {}
  }
  function style() {
    if (document.getElementById('lang-style')) return;
    var s = document.createElement('style'); s.id = 'lang-style';
    s.textContent = 'body{top:0!important;position:static!important}.skiptranslate iframe,iframe.skiptranslate,.goog-te-banner-frame,#goog-gt-tt,.goog-te-balloon-frame,.goog-tooltip,.goog-te-spinner-pos{display:none!important;visibility:hidden!important}' +
      '.goog-text-highlight{background:none!important;box-shadow:none!important}font{background:none!important;box-shadow:none!important}' +
      '#gt-host{position:absolute;left:-9999px;top:0;width:1px;height:1px;overflow:hidden}' +
      'html[data-lang-busy] body{opacity:.55;transition:opacity .35s ease}body{transition:opacity .45s ease}' +
      '#lang-bar{position:fixed;z-index:2147483600;left:0;top:0;height:3px;width:100%;transform-origin:0 50%;transform:scaleX(0);opacity:0;background:linear-gradient(90deg,#639cff,#2a64e8);pointer-events:none}' +
      'html[data-lang-busy] #lang-bar{opacity:1;animation:lang-bar 1.8s cubic-bezier(.22,1,.36,1) forwards}@keyframes lang-bar{to{transform:scaleX(.92)}}' +

      /* translated text: the design's tight tracking, low line height and clipped reveal lines are made for English */
      'html[data-script=complex] body *:not(svg):not(svg *){letter-spacing:0!important;word-spacing:normal!important;text-transform:none!important}' +
      /* only the line height changes for every heading; a heading that is large in the English design is scaled down by the script below (class lang-big), so small card titles keep their designed size */
      'html[data-script=complex] h1{line-height:1.32!important}' +
      'html[data-script=complex] h2{line-height:1.35!important}' +
      'html[data-script=complex] .lang-big{font-size:var(--lfs)!important}' +
      'html[data-script=complex] h3,html[data-script=complex] h4{line-height:1.4!important}' +
      'html[data-script=complex] p,html[data-script=complex] li,html[data-script=complex] .sub{line-height:1.75!important}' +
      'html[data-script=complex] .ln,html[data-script=complex] .h-line,html[data-script=complex] .lx-line,html[data-script=complex] .pp-words .pw,html[data-script=complex] .tx-h .tx-w{overflow:visible!important;padding:0!important;margin:0!important}' +
      'html[data-script=complex] h1 em,html[data-script=complex] h2 em{padding:.08em .04em!important}' +
      'html[data-script=latin] h1{line-height:1.08!important}html[data-script=latin] .ln{padding-bottom:.18em!important}' +
      'html[data-script] h1,html[data-script] h2{overflow-wrap:anywhere}' +
      '@media(prefers-reduced-motion:reduce){html[data-lang-busy] body,body{transition:none}#lang-bar{animation:none!important}}';
    document.head.appendChild(s);
    var b = document.createElement('div'); b.id = 'lang-bar'; b.setAttribute('aria-hidden', 'true'); document.body.appendChild(b);
  }
  /* After translation: the translator drops the space beside protected names, dates and links, so a sentence runs together
     ("...রাখুনWrapline Proআপনার..."). The missing space is put back, and large headings are scaled for the script. */
  var spaced = [], mendTimer = 0, watching = false, NOSP = /[\u3040-\u30ff\u3400-\u9fff\u0e00-\u0e7f]/;
  function lastCh(n) { var t = n.textContent || ''; return t.charAt(t.length - 1); }
  function firstCh(n) { return (n.textContent || '').charAt(0); }
  function missing(a, b) {
    var x = lastCh(a), y = firstCh(b);
    if (!x || !y || /[\s\u00a0([{\u00ab\u201c\u2018'"\/\u2013\u2014-]/.test(x) || /[\s\u00a0)\]}\u00bb\u201d\u2019'".,;:!?%\u0964\u0965\u3001\u3002\uff0c\uff01\uff1f\uff09\u2026\/\u2013\u2014|\u00b7-]/.test(y)) return false;
    return !(NOSP.test(x) || NOSP.test(y));
  }
  function inline(n) {
    if (n.nodeType === 3) return !!n.nodeValue.trim();
    if (n.nodeType !== 1 || n.tagName === 'BR' || n.__ls) return false;
    return /^inline/.test(getComputedStyle(n).display);
  }
  function mend() {
    if (cur === 'en' || !document.body) return;
    var all = document.body.querySelectorAll('span,a,strong,b,em,i,u,time,code,small,mark,abbr,sup,sub,kbd,label,bdi'), i, e, p, prev, next, s;
    for (i = 0; i < all.length; i++) {
      e = all[i]; p = e.parentNode;
      if (!p || p.nodeType !== 1 || e.closest('#gt-host,script,style,svg,textarea,select,.lng-list')) continue;
      if (!e.classList.contains('notranslate') && !e.querySelector('font') && !p.querySelector(':scope>font')) continue;
      prev = e.previousSibling; next = e.nextSibling;
      if (prev && !prev.__ls && missing(prev, e) && inline(prev) && inline(e) && !/flex|grid/.test(getComputedStyle(p).display)) { s = document.createTextNode(' '); s.__ls = 1; spaced.push(s); p.insertBefore(s, e); }
      if (next && !next.__ls && missing(e, next) && inline(next) && inline(e) && !/flex|grid/.test(getComputedStyle(p).display)) { s = document.createTextNode(' '); s.__ls = 1; spaced.push(s); p.insertBefore(s, next); }
    }
  }
  function sizeHeads() {
    var hs = document.querySelectorAll('h1,h2,h3'), i, h, fs, list = [], on = cur !== 'en' && root.getAttribute('data-script') === 'complex';
    for (i = 0; i < hs.length; i++) { hs[i].classList.remove('lang-big'); hs[i].style.removeProperty('--lfs'); }
    if (!on) return;
    for (i = 0; i < hs.length; i++) { h = hs[i]; if (!h.offsetWidth) continue; fs = parseFloat(getComputedStyle(h).fontSize); if (fs > 40) list.push([h, fs]); }
    list.forEach(function (r) { r[0].style.setProperty('--lfs', Math.max(24, Math.round(r[1] * .8)) + 'px'); r[0].classList.add('lang-big'); });
  }
  function tidy() { mend(); sizeHeads(); }
  function later() { clearTimeout(mendTimer); mendTimer = setTimeout(tidy, 300); }
  function undo() {
    spaced.forEach(function (n) { if (n.parentNode) n.parentNode.removeChild(n); }); spaced = [];
    [].forEach.call(document.querySelectorAll('.lang-big'), function (h) { h.classList.remove('lang-big'); h.style.removeProperty('--lfs'); });
  }
  function watch() {
    if (watching || !window.MutationObserver) return; watching = true;
    new MutationObserver(function (list) {
      if (cur === 'en') return;
      for (var i = 0; i < list.length; i++) { var a = list[i].addedNodes; for (var j = 0; j < a.length; j++) if (!a[j].__ls) return later(); }
    }).observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', function () { if (cur !== 'en') later(); });
  }
  function busy(on) { if (on) root.setAttribute('data-lang-busy', ''); else root.removeAttribute('data-lang-busy'); }
  function engine() {
    if (loading) return loading;
    loading = new Promise(function (ok, fail) {
      style(); protect();
      var host = document.createElement('div'); host.id = 'gt-host'; host.className = 'notranslate'; host.setAttribute('translate', 'no'); document.body.appendChild(host);
      window.googleTranslateElementInit = function () {
        try { new google.translate.TranslateElement({ pageLanguage: 'en', includedLanguages: CODES.join(','), autoDisplay: false }, 'gt-host'); } catch (e) { fail(e); return; }
        var t0 = Date.now();
        (function wait() { var c = document.querySelector('select.goog-te-combo'); if (c && c.options.length > 1) ok(c); else if (Date.now() - t0 > 12000) fail(new Error('timeout')); else setTimeout(wait, 80); })();
      };
      var sc = document.createElement('script'); sc.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit'; sc.async = true;
      sc.onerror = function () { fail(new Error('blocked')); }; document.head.appendChild(sc);
    });
    loading.catch(function () { loading = null; });
    return loading;
  }
  function apply(code) {
    return engine().then(function (combo) {
      var opt = [].some.call(combo.options, function (o) { return o.value === code; });
      if (!opt) throw new Error('unsupported');
      combo.value = code; combo.dispatchEvent(new Event('change'));
      return new Promise(function (done) {
        var t0 = Date.now();
        (function poll() {
          var translated = /translated-(ltr|rtl)/.test(root.className);
          if (code === 'en' ? !translated : translated) return setTimeout(done, 250);
          if (Date.now() - t0 > (code === 'en' ? 1200 : 7000)) return done();
          setTimeout(poll, 120);
        })();
      });
    });
  }
  function set(code) {
    if (CODES.indexOf(code) < 0) return Promise.resolve(false);
    var prev = cur; cur = code;
    try { localStorage.setItem(KEY, code); } catch (e) {}
    cookie(code);
    if (!CAN) { listeners.forEach(function (f) { f(code); }); return Promise.resolve(true); }
    root.lang = code === 'en' ? 'en' : code; script(code);
    if (prev === code) return Promise.resolve(true);
    /* English with nothing translated yet: nothing to do */
    if (code === 'en' && !/translated-(ltr|rtl)/.test(root.className) && !loading) { listeners.forEach(function (f) { f(code); }); return Promise.resolve(true); }
    if (!document.getElementById('lang-style') && code !== 'en') style();
    busy(true); listeners.forEach(function (f) { f(code); });
    return apply(code).then(function () { busy(false); if (code === 'en') undo(); else { watch(); later(); } return true; }, function () {
      /* translator could not load (offline, blocked): go back to English quietly */
      cur = prev; script(prev); root.lang = prev; try { localStorage.setItem(KEY, prev); } catch (e) {} cookie(prev); busy(false); listeners.forEach(function (f) { f(prev); }); return false;
    });
  }
  window.AjoyLang = {
    enabled: true, supported: CAN,
    list: LIST, current: function () { return cur; },
    entry: function (c) { return LIST.filter(function (l) { return l[0] === (c || cur); })[0] || LIST[0]; },
    set: set, onChange: function (f) { listeners.push(f); }
  };
  function boot() {
    protect();
    if (CAN && cur !== 'en') { cookie(cur); root.lang = cur; script(cur); style(); busy(true); apply(cur).then(function () { busy(false); watch(); later(); }, function () { busy(false); cur = 'en'; try { localStorage.setItem(KEY, 'en'); } catch (e) {} cookie('en'); }); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
