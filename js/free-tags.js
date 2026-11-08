/* Wrapline free page: the hanging tool tags.
   Each tag is lowered on a rope, hangs and sways, then leaves. Every round it is random which leave how:
   1 or 2 of the four BREAK their rope (it strains, snaps, and the tag falls under gravity, tumbling out of sight), the others zip straight up
   (a small dip first, then a fast snap with a stretch and motion blur). After a short rest each one comes back down.
   Only transform / opacity are animated, plus a blur on the small tag itself, so it stays smooth. */
(function () {
  'use strict';
  var stk = document.querySelector('.ft-stk');
  if (!stk || matchMedia('(prefers-reduced-motion: reduce)').matches || !stk.animate) return;
  var chips = [].slice.call(stk.children), N = chips.length;
  if (!N) return;
  var rnd = function (a, b) { return a + Math.random() * (b - a); };
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var plans = {};
  /* round n: pick which 1 or 2 tags break their rope */
  function breaking(n) {
    if (!plans[n]) {
      var ix = []; for (var i = 0; i < N; i++) ix.push(i);
      ix.sort(function () { return Math.random() - .5; });
      plans[n] = ix.slice(0, Math.random() < .5 ? 1 : 2);
    }
    return plans[n];
  }
  function build(chip) {
    var face = document.createElement('b'), rope = document.createElement('b'), bridle = document.createElement('b');
    face.className = 'ft-face'; rope.className = 'ft-rope'; bridle.className = 'ft-bridle';
    while (chip.firstChild) face.appendChild(chip.firstChild);
    chip.appendChild(rope); chip.appendChild(bridle); chip.appendChild(face);
    return { chip: chip, face: face, rope: rope, anims: [] };
  }
  function visible(t) { return t.chip.offsetParent !== null && getComputedStyle(stk).display !== 'none'; }
  /* every animation is remembered so it can be cancelled for certain (a finished, filling animation is not always listed by getAnimations) */
  function A(t, el, kf, o) { var a = el.animate(kf, o); t.anims.push(a); return a; }
  function reset(t) {
    t.anims.forEach(function (a) { try { a.cancel(); } catch (e) {} }); t.anims = [];
    t.face.style.filter = ''; t.rope.style.opacity = '';
    [t.chip, t.face, t.rope].forEach(function (e) { e.getAnimations().forEach(function (a) { if (a.animationName === undefined || a.constructor.name !== 'CSSAnimation') a.cancel(); }); });
    t.chip.style.animationPlayState = 'running';
  }
  function cur(t) { return getComputedStyle(t.chip).translate; }  /* "0px 6.2px" or "none" */
  function curY(t) { var v = cur(t); if (!v || v === 'none') return 0; var p = v.split(' '); return parseFloat(p[1]) || 0; }

  function enter(t) {
    reset(t);
    /* lowered on its rope: it drops, the rope stretches and the tag dips low, then springs back up and settles in a few shrinking bounces */
    var a = A(t,t.chip,[
      { translate: '0 -62vh', scale: '1 1.05', opacity: 0, easing: 'cubic-bezier(.3,.55,.4,1)' },
      { opacity: 1, offset: .08 },
      { translate: '0 34px', scale: '.985 1.045', opacity: 1, offset: .44, easing: 'ease-in-out' },
      { translate: '0 -15px', scale: '1.01 .99', offset: .6, easing: 'ease-in-out' },
      { translate: '0 9px', scale: '.995 1.01', offset: .74, easing: 'ease-in-out' },
      { translate: '0 -4px', scale: '1 1', offset: .85, easing: 'ease-in-out' },
      { translate: '0 1.5px', offset: .94, easing: 'ease-in-out' },
      { translate: '0 0', scale: '1 1', opacity: 1 }
    ], { duration: 2400, fill: 'forwards' });
    return a.finished;
  }
  function hang(t, ms) {
    var a = A(t,t.chip,[
      { translate: '0 0' }, { translate: '0 7px', offset: .28 }, { translate: '0 -4px', offset: .56 }, { translate: '0 6px', offset: .8 }, { translate: '0 0' }
    ], { duration: 5200, iterations: Infinity, easing: 'ease-in-out', fill: 'both' });
    return sleep(ms).then(function () { return a; });
  }
  /* zip straight up: anticipation dip, fast stretched snap, motion blur */
  function goUp(t, hang_) {
    var y = curY(t), start = y + 'px';
    hang_.cancel();
    var a = A(t,t.chip,[
      { translate: '0 ' + start, scale: '1 1', opacity: 1, easing: 'cubic-bezier(.4,0,.6,1)' },
      { translate: '0 ' + (y + 14) + 'px', scale: '1.03 .94', opacity: 1, offset: .22, easing: 'cubic-bezier(.55,0,.9,.4)' },
      { translate: '0 -38vh', scale: '.97 1.2', opacity: 1, offset: .62, easing: 'cubic-bezier(.3,0,1,1)' },
      { translate: '0 -66vh', scale: '.95 1.32', opacity: 0 }
    ], { duration: 760, fill: 'forwards' });
    A(t,t.face,[
      { filter: 'blur(0px)' }, { filter: 'blur(0px)', offset: .22 }, { filter: 'blur(5px)', offset: .62 }, { filter: 'blur(9px)' }
    ], { duration: 760, fill: 'forwards' });
    return a.finished;
  }
  /* the rope gives way: it creaks and sags under strain, then snaps. The rope recoils upward, the tag jolts and falls with real
     gravity (slow at first, faster and faster), turning as it goes with a bit of sideways drift, and fades into the dark below. */
  function snap(t, hang_) {
    var y = curY(t), dir = Math.random() < .5 ? -1 : 1, strain = rnd(380, 620), drift = dir * rnd(14, 46), spin = dir * rnd(130, 240);
    hang_.cancel();
    t.chip.style.animationPlayState = 'paused';
    /* strain: the tag sags a few pixels and trembles a little, the rope flickers as its strands go */
    var sag = A(t,t.chip,[
      { translate: '0 ' + y + 'px', easing: 'ease-in' },
      { translate: '0 ' + (y + 5) + 'px', offset: .45, easing: 'linear' },
      { translate: '-.8px ' + (y + 7) + 'px', offset: .6, easing: 'linear' },
      { translate: '.8px ' + (y + 8) + 'px', offset: .75, easing: 'linear' },
      { translate: '0 ' + (y + 10) + 'px' }
    ], { duration: strain, fill: 'forwards' });
    A(t,t.rope,[{ opacity: 1 }, { opacity: .8, offset: .55 }, { opacity: 1, offset: .7 }, { opacity: .7, offset: .85 }, { opacity: 1 }], { duration: strain, fill: 'forwards' });
    return sag.finished.then(function () {
      var y0 = y + 10;
      /* the loose rope whips back up out of sight */
      A(t,t.rope,[
        { translate: '0 0', rotate: '0deg', opacity: 1 }, { translate: '0 -26vh', rotate: (-dir * 7) + 'deg', opacity: .95, offset: .5 }, { translate: '0 -52vh', rotate: (dir * 4) + 'deg', opacity: 0 }
      ], { duration: 520, easing: 'cubic-bezier(.12,.7,.3,1)', fill: 'forwards' });
      /* the tag turns slowly at first, then faster as it falls */
      A(t,t.face,[
        { rotate: '0deg' }, { rotate: (dir * 9) + 'deg', offset: .16, easing: 'ease-in' }, { rotate: spin + 'deg' }
      ], { duration: 1350, easing: 'cubic-bezier(.45,0,.85,.7)', fill: 'forwards' });
      /* released: a tiny upward jerk as the tension lets go, then it falls and speeds up */
      var fall = A(t,t.chip,[
        { translate: '0 ' + y0 + 'px', easing: 'cubic-bezier(.2,.6,.4,1)' },
        { translate: (drift * .08) + 'px ' + (y0 - 9) + 'px', offset: .07, easing: 'cubic-bezier(.5,0,.95,.55)' },
        { translate: drift + 'px 92vh' }
      ], { duration: 1350, fill: 'forwards' });
      /* it stays visible while it drops, then dims out gradually, well before the content below */
      A(t,t.chip,[{ opacity: 1 }, { opacity: 1, offset: .4 }, { opacity: 0, offset: .85 }, { opacity: 0 }], { duration: 1350, easing: 'linear', fill: 'forwards' });
      return fall.finished;
    });
  }
  async function loop(t, ix, delay) {
    var n = 0;
    await sleep(delay);
    for (;;) {
      if (!visible(t)) { await sleep(1500); continue; }
      await enter(t);
      var h = await hang(t, rnd(4200, 7800));
      var breaks = breaking(n).indexOf(ix) > -1; n++;
      if (breaks) await snap(t, h); else await goUp(t, h);
      t.chip.style.opacity = '0';
      await sleep(rnd(900, 2200));
    }
  }
  function start() {
    var ts = chips.map(build);
    /* IK / FK Snap (first tag) arrives first, the others follow close behind */
    var delays = [250, 800, 1350, 1900];
    ts.forEach(function (t, i) { loop(t, i, delays[i] || 2000 + i * 400); });
  }
  if (document.documentElement.classList.contains('fr-go')) start();
  else {
    var mo = new MutationObserver(function () { if (document.documentElement.classList.contains('fr-go')) { mo.disconnect(); start(); } });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    setTimeout(function () { mo.disconnect(); if (!stk.querySelector('.ft-face')) start(); }, 6000);
  }
})();
