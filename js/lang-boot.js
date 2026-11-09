/* Site language. English is the default. A visitor can pick another language from the profile menu; the page is then
   translated automatically (Google's page translator, loaded only when a non-English language is chosen) and the choice is
   remembered on this device. Nothing is loaded for English. Brand names, prices, codes and invoices are never translated.
   Exposes window.AjoyLang { list, current(), set(code), onChange(fn) } for the language window in the profile menu. */
(function () {
  var KEY = 'ajoy-lang', root = document.documentElement, listeners = [];
  /* [google code, native name, English name, badge] */
  var LIST = [
    ['en', 'English', 'English', 'EN'], ['id', 'Bahasa Indonesia', 'Indonesian', 'ID'], ['ms', 'Bahasa Melayu', 'Malay', 'MS'],
    ['de', 'Deutsch', 'German', 'DE'], ['es', 'Español', 'Spanish', 'ES'], ['fil', 'Filipino', 'Filipino', 'PH'],
    ['fr', 'Français', 'French', 'FR'], ['hr', 'Hrvatski', 'Croatian', 'HR'], ['it', 'Italiano', 'Italian', 'IT'],
    ['lt', 'Lietuvių', 'Lithuanian', 'LT'], ['lv', 'Latviešu', 'Latvian', 'LV'], ['hu', 'Magyar', 'Hungarian', 'HU'],
    ['nl', 'Nederlands', 'Dutch', 'NL'], ['no', 'Norsk', 'Norwegian', 'NO'], ['pl', 'Polski', 'Polish', 'PL'],
    ['pt', 'Português', 'Portuguese', 'PT'], ['ro', 'Română', 'Romanian', 'RO'], ['sk', 'Slovenčina', 'Slovak', 'SK'],
    ['sl', 'Slovenščina', 'Slovenian', 'SL'], ['fi', 'Suomi', 'Finnish', 'FI'], ['sv', 'Svenska', 'Swedish', 'SV'],
    ['vi', 'Tiếng Việt', 'Vietnamese', 'VI'], ['tr', 'Türkçe', 'Turkish', 'TR'], ['cs', 'Čeština', 'Czech', 'CS'],
    ['da', 'Dansk', 'Danish', 'DA'], ['el', 'Ελληνικά', 'Greek', 'EL'], ['bg', 'Български', 'Bulgarian', 'BG'],
    ['ru', 'Русский', 'Russian', 'RU'], ['sr', 'Српски', 'Serbian', 'SR'], ['uk', 'Українська', 'Ukrainian', 'UK'],
    ['hi', 'हिन्दी', 'Hindi', 'HI'], ['bn', 'বাংলা', 'Bengali', 'BN'], ['ta', 'தமிழ்', 'Tamil', 'TA'],
    ['te', 'తెలుగు', 'Telugu', 'TE'], ['mr', 'मराठी', 'Marathi', 'MR'], ['gu', 'ગુજરાતી', 'Gujarati', 'GU'],
    ['kn', 'ಕನ್ನಡ', 'Kannada', 'KN'], ['ml', 'മലയാളം', 'Malayalam', 'ML'], ['pa', 'ਪੰਜਾਬੀ', 'Punjabi', 'PA'],
    ['th', 'ไทย', 'Thai', 'TH'], ['ko', '한국어', 'Korean', 'KO'], ['ja', '日本語', 'Japanese', 'JA'],
    ['zh-CN', '简体中文', 'Chinese (Simplified)', 'ZH'], ['zh-TW', '繁體中文', 'Chinese (Traditional)', 'TW']
  ];
  var CODES = LIST.map(function (l) { return l[0]; });
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
    try { document.querySelectorAll('code,pre,kbd,samp,.notranslate,#iv-print,.iv-paper,[data-price],.brand,.logo,.wordmark').forEach(function (e) { e.setAttribute('translate', 'no'); e.classList.add('notranslate'); }); } catch (e) {}
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
      '@media(prefers-reduced-motion:reduce){html[data-lang-busy] body,body{transition:none}#lang-bar{animation:none!important}}';
    document.head.appendChild(s);
    var b = document.createElement('div'); b.id = 'lang-bar'; b.setAttribute('aria-hidden', 'true'); document.body.appendChild(b);
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
    root.lang = code === 'en' ? 'en' : code;
    if (prev === code) return Promise.resolve(true);
    /* English with nothing translated yet: nothing to do */
    if (code === 'en' && !/translated-(ltr|rtl)/.test(root.className) && !loading) { listeners.forEach(function (f) { f(code); }); return Promise.resolve(true); }
    if (!document.getElementById('lang-style') && code !== 'en') style();
    busy(true); listeners.forEach(function (f) { f(code); });
    return apply(code).then(function () { busy(false); return true; }, function () {
      /* translator could not load (offline, blocked): go back to English quietly */
      cur = prev; try { localStorage.setItem(KEY, prev); } catch (e) {} cookie(prev); busy(false); listeners.forEach(function (f) { f(prev); }); return false;
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
    if (CAN && cur !== 'en') { cookie(cur); root.lang = cur; style(); busy(true); apply(cur).then(function () { busy(false); }, function () { busy(false); cur = 'en'; try { localStorage.setItem(KEY, 'en'); } catch (e) {} cookie('en'); }); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
