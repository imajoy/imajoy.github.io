/* Subscriber sign-in: email -> 6-digit code -> shows the plan, time left and a renew button.
   Works only when accountOpen is true in site-config.js and the newest apps-script/Code.gs is deployed.
   No IP tracking: a visitor proves who they are with their email. The session is kept in this browser for 30 days. */
const cfg = window.AJOY_CONFIG || {};
const KEY = 'ajoy.acct';
const url = cfg.sheetUrl;
if (cfg.accountOpen && url) init();

function init() {
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } };
  const save = v => { try { v ? localStorage.setItem(KEY, JSON.stringify(v)) : localStorage.removeItem(KEY); } catch (e) { /* private mode */ } };
  const call = async body => {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ type: 'account', ...body }), signal: AbortSignal.timeout(20000) });
    return r.json();
  };
  const daysLeft = iso => Math.max(0, Math.ceil((new Date(iso) - Date.now()) / 864e5));
  const fmtDate = iso => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  const label = p => (p === 'offline' ? 'Offline' : 'Online');
  /* one line per subscription: state, text */
  const describe = s => {
    const left = s.endsAt ? daysLeft(s.endsAt) : null;
    const live = s.endsAt && new Date(s.endsAt) > Date.now();
    if (s.status === 'ACTIVE' && live) return { state: 'active', text: left + (left === 1 ? ' day' : ' days') + ' left · renews ' + fmtDate(s.endsAt), short: left + 'd left' };
    if (live) return { state: 'ending', text: 'Ends ' + fmtDate(s.endsAt) + ' (' + left + (left === 1 ? ' day' : ' days') + ' left) · not renewing', short: left + 'd left' };
    return { state: 'ended', text: 'Ended' + (s.endsAt ? ' ' + fmtDate(s.endsAt) : '') + ' · renew to keep using Ajoy Tools', short: 'Renew' };
  };

  /* ---------- modal ---------- */
  const dlg = document.createElement('dialog');
  dlg.className = 'acct-dlg';
  dlg.innerHTML = '<form method="dialog" class="acct-x"><button aria-label="Close">×</button></form><div class="acct-body"></div>';
  document.body.appendChild(dlg);
  const body = dlg.querySelector('.acct-body');
  const open = () => { render(); if (!dlg.open) dlg.showModal(); };
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });

  let session = load(), subs = null, email = '', msg = '', busy = false, step = 'email';
  const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function render() {
    if (session && subs) {
      body.innerHTML = '<p class="eyebrow">Your subscription</p><h2>' + esc(session.email) + '</h2>' +
        (subs.length ? subs.map(s => { const d = describe(s); return '<div class="acct-sub" data-state="' + d.state + '"><b>Ajoy Tools ' + label(s.plan) + '</b><span>' + (s.billing === 'yearly' ? 'Yearly' : 'Monthly') + ' · ' + s.seats + (s.seats === 1 ? ' license' : ' licenses') + '</span><p>' + esc(d.text) + '</p>' +
          (d.state !== 'active' ? '<a class="btn btn-dark btn-sm" href="checkout.html?plan=' + esc(s.plan) + '&billing=' + esc(s.billing) + '">Renew</a>' : '') + '</div>'; }).join('') : '<p class="acct-note">No subscription found for this email.</p>') +
        '<p class="acct-note">Need help? Email contactmy3dart@gmail.com.</p><button class="acct-link" data-out>Sign out</button>';
      body.querySelector('[data-out]').onclick = () => { save(null); session = null; subs = null; step = 'email'; dlg.close(); refresh(); };
      return;
    }
    if (step === 'email') {
      body.innerHTML = '<p class="eyebrow">Subscriber sign in</p><h2>See your plan and time left.</h2><p class="acct-note">Enter the email you subscribed with. We will send a 6-digit code.</p>' +
        '<form class="acct-form"><input type="email" required autocomplete="email" placeholder="you@example.com" value="' + esc(email) + '"><button class="btn btn-dark" type="submit">Send code</button></form><p class="acct-msg">' + esc(msg) + '</p>';
      body.querySelector('form').onsubmit = async e => {
        e.preventDefault(); if (busy) return;
        email = body.querySelector('input').value.trim().toLowerCase(); busy = true; msg = 'Sending…'; body.querySelector('.acct-msg').textContent = msg;
        try {
          const r = await call({ step: 'code', email });
          msg = r.ok ? '' : r.error === 'limit' ? 'Too many tries. Please wait an hour.' : r.error === 'email' ? 'That does not look like an email address.' : 'Could not send the email. Please try again.';
          if (r.ok) step = 'code';
        } catch (err) { msg = 'Could not reach the service. Please try again.'; }
        busy = false; render();
      };
    } else {
      body.innerHTML = '<p class="eyebrow">Check your email</p><h2>Enter your code.</h2><p class="acct-note">If ' + esc(email) + ' has a subscription, a code is on its way. It works for 10 minutes.</p>' +
        '<form class="acct-form"><input inputmode="numeric" maxlength="6" required autocomplete="one-time-code" placeholder="123456"><button class="btn btn-dark" type="submit">Sign in</button></form><p class="acct-msg">' + esc(msg) + '</p><button class="acct-link" data-back>Use a different email</button>';
      body.querySelector('[data-back]').onclick = () => { step = 'email'; msg = ''; render(); };
      body.querySelector('form').onsubmit = async e => {
        e.preventDefault(); if (busy) return; busy = true; body.querySelector('.acct-msg').textContent = 'Checking…';
        try {
          const r = await call({ step: 'verify', email, code: body.querySelector('input').value });
          if (r.ok) { session = { token: r.token, email: r.email }; subs = r.subscriptions; save(session); msg = ''; refresh(); }
          else msg = r.error === 'limit' ? 'Too many wrong codes. Please wait 10 minutes.' : 'That code is not right or has expired.';
        } catch (err) { msg = 'Could not reach the service. Please try again.'; }
        busy = false; render();
      };
    }
  }

  /* ---------- page: nav button, plan cards ---------- */
  const nav = document.querySelector('.site-header .btn-sm');
  const btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'acct-btn'; btn.textContent = 'Sign in';
  if (nav) nav.before(btn);
  btn.addEventListener('click', open);

  function refresh() {
    const active = subs && subs.map(s => ({ s, d: describe(s) }));
    const best = active && active.find(x => x.d.state !== 'ended') || (active && active[0]);
    btn.textContent = !session ? 'Sign in' : best ? label(best.s.plan) + ' · ' + best.d.short : 'Account';
    btn.dataset.state = best ? best.d.state : '';
    for (const plan of ['online', 'offline']) {
      const a = document.querySelector('[data-buy="' + plan + '"]'); if (!a) continue;
      const mine = active && active.find(x => x.s.plan === plan && x.d.state !== 'ended') || (active && active.find(x => x.s.plan === plan));
      if (!a.dataset.orig) a.dataset.orig = a.textContent;
      if (!mine) { a.textContent = a.dataset.orig; a.classList.remove('is-owned'); continue; }
      a.classList.add('is-owned');
      a.textContent = mine.d.state === 'ended' ? 'Renew ' + label(plan) : mine.d.state === 'ending' ? 'Renew · ' + mine.d.short : 'Your plan · ' + mine.d.short;
    }
  }
  async function status() {
    if (!session) return;
    try {
      const r = await call({ step: 'status', token: session.token });
      if (r.ok) { subs = r.subscriptions; } else if (r.error === 'expired') { save(null); session = null; subs = null; }
    } catch (e) { /* offline: leave the button as it is */ }
    refresh();
  }
  /* owned plan buttons open the account view instead of the checkout (unless it is time to renew) */
  document.addEventListener('click', e => {
    const a = e.target.closest('.is-owned'); if (!a) return;
    if (/Your plan/.test(a.textContent)) { e.preventDefault(); open(); }
  });
  refresh();
  status();
}
