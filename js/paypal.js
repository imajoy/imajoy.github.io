/* PayPal subscription buttons for the checkout page.
   Settings (Client ID, plan IDs, mode) come from the paypal-config function. No secrets are used here.
   Plans are picked by the buyer's region tier (see regions.js). */
import { tierFor, availability, closedMessage, countryCheck } from './regions.js?v=20261018-g5';
import { rememberGeo } from './geo.js?v=20261018-g5';

const url = window.AJOY_CONFIG && window.AJOY_CONFIG.paypalConfigUrl;
const orderUrl = window.AJOY_CONFIG && window.AJOY_CONFIG.sheetUrl;
const form = document.querySelector('#billing-form');
const pay = document.querySelector('#pay');
const HOME = 'index.html';
const REDIRECT_SECONDS = 5;
let cfg = null;
if (url && form && pay) {
  try {
    const r = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (r.ok) cfg = await r.json();
  } catch (e) { cfg = null; }
}

if (cfg && cfg.clientId && cfg.plans && form && pay) {
  const test = cfg.mode !== 'live';
  const detected = rememberGeo(cfg.country); /* where the buyer really connects from */
  const lockTo = test ? '' : detected; /* test mode: any country can be tried, so you can test from India */
  const extraClosed = Array.isArray(cfg.closedCountries) ? cfg.closedCountries : [];
  let names = null;
  try { names = new Intl.DisplayNames([navigator.language || 'en'], { type: 'region' }); } catch (e) { names = null; }
  const nameOf = c => { try { return (names && names.of(c)) || c; } catch (e) { return c; } };
  const sel = form.elements.country;
  /* Start on the detected country so the price matches where the buyer is. */
  if (detected && sel && sel.value !== detected && [...sel.options].some(o => o.value === detected)) {
    sel.value = detected; sel.dispatchEvent(new Event('change', { bubbles: true }));
  }
  const geoNote = document.createElement('p');
  geoNote.className = 'form-hint'; geoNote.id = 'geo-note'; geoNote.setAttribute('role', 'status'); geoNote.hidden = true;
  if (sel && sel.parentElement) sel.parentElement.appendChild(geoNote);
  const box = document.createElement('div');
  box.className = 'paypal-box';
  box.innerHTML =
    (test ? '<p class="paypal-test"><b>Test mode.</b> No real money moves. Pay with your PayPal sandbox buyer account.</p>' : '') +
    '<p class="paypal-closed" id="paypal-closed" hidden></p>' +
    '<p class="paypal-note" id="paypal-note" role="status"></p><div id="paypal-buttons"></div>' +
    '<p class="paypal-fine">Charged in US dollars by PayPal. Your bank may convert the amount. Your license key is sent within 12 hours.</p>';
  pay.replaceWith(box);
  const note = box.querySelector('#paypal-note');
  const closed = box.querySelector('#paypal-closed');
  const buttons = box.querySelector('#paypal-buttons');
  const say = (t, bad) => { note.textContent = t; note.dataset.bad = bad ? '1' : '0'; };
  const choice = () => ({
    plan: form.elements.plan.value, billing: form.elements.billing.value,
    seats: Math.max(1, Math.min(100, parseInt(form.elements.seats.value, 10) || 1)),
    country: form.elements.country.value
  });
  const planFor = c => {
    const p = cfg.plans;
    const t = p.tiers && p.tiers[tierFor(c.country)];
    const set = t || (p.tiers ? null : p); /* flat plans are the single-price test setup */
    return set && set[c.plan] && set[c.plan][c.billing];
  };
  const avail = document.querySelector('#availability');
  const syncRegion = () => {
    const c = choice(), a = availability(c.country, extraClosed), chk = countryCheck(c.country, lockTo);
    const ok = a.open && !!planFor(c) && chk.ok;
    closed.hidden = ok; buttons.hidden = !ok;
    box.querySelector('.paypal-fine').hidden = !ok;
    closed.textContent = !a.open ? closedMessage[a.reason]
      : !chk.ok && !availability(chk.detected, extraClosed).open ? closedMessage[availability(chk.detected, extraClosed).reason]
      : !chk.ok ? 'Your connection appears to be from ' + nameOf(chk.detected) + '. Please choose ' + nameOf(chk.detected) + ' as your billing country, or contact Ajoy if you are paying from another country.'
      : 'This plan is not available yet.';
    geoNote.hidden = !detected;
    geoNote.textContent = detected ? (test ? 'Test mode: you may try any country. Detected location: ' + nameOf(detected) + '.' : 'Your price follows your location (' + nameOf(detected) + ').') : '';
    if (avail) avail.textContent = ok
      ? (test ? 'Test mode: review your billing details, then subscribe with PayPal. No real money moves.' : 'Review your billing details, then subscribe securely with PayPal.')
      : closed.textContent;
  };
  for (const n of ['plan', 'billing', 'country']) form.elements[n].addEventListener('change', syncRegion);
  syncRegion();

  const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sendOrder = (subId, c) => {
    if (!orderUrl) return;
    const g = n => (form.elements[n] && form.elements[n].value || '').trim();
    try {
      fetch(orderUrl, { method: 'POST', mode: 'no-cors', keepalive: true, headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ type: 'order', subscriptionId: subId, email: g('email'), name: g('name'), country: c.country, plan: c.plan, billing: c.billing, seats: c.seats, company: g('company'), detectedCountry: detected }) });
    } catch (e) { /* the owner can still see the subscription in PayPal */ }
  };
  function showDone(subId) {
    const c = choice();
    sendOrder(subId, c);
    const email = (form.elements.email && form.elements.email.value || '').trim();
    const plan = (c.plan === 'offline' ? 'Offline' : 'Online') + ' · ' + (c.billing === 'yearly' ? 'Yearly' : 'Monthly') + ' · ' + c.seats + (c.seats === 1 ? ' license' : ' licenses');
    const steps = document.querySelectorAll('.checkout-progress span');
    if (steps.length > 1) { steps[0].removeAttribute('aria-current'); steps[0].classList.add('is-done'); steps[1].setAttribute('aria-current', 'step'); }
    if (avail) avail.hidden = true;
    const grid = document.querySelector('.checkout-grid');
    const card = document.createElement('section');
    card.className = 'pay-done';
    card.setAttribute('role', 'status');
    card.innerHTML =
      '<svg class="pd-check" viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="23"/><path d="M15 27l8 8 15-17"/></svg>' +
      '<p class="eyebrow">' + (test ? 'Test payment complete' : 'Payment complete') + '</p>' +
      '<h2>Thank you. Your subscription is confirmed.</h2>' +
      '<dl class="pd-list"><div><dt>Plan</dt><dd>Ajoy Tools ' + esc(plan) + '</dd></div>' +
      (email ? '<div><dt>License key sent to</dt><dd>' + esc(email) + '</dd></div>' : '') +
      '<div><dt>Subscription ID</dt><dd>' + esc(subId) + '</dd></div></dl>' +
      '<p class="pd-note"><b>Your license key arrives within 12 hours.</b> A confirmation email is on its way now. ' + (test ? 'This was a test, so nothing was charged. ' : '') + 'Keep your subscription ID for any support question.</p>' +
      '<div class="pd-bar" aria-hidden="true"><i></i></div>' +
      '<p class="pd-count">Taking you to the home page in <b id="pd-sec">' + REDIRECT_SECONDS + '</b> seconds. <a href="' + HOME + '">Go now</a></p>';
    card.style.setProperty('--redir', REDIRECT_SECONDS + 's');
    if (grid) { grid.hidden = true; grid.before(card); } else { form.before(card); }
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    let left = REDIRECT_SECONDS;
    const sec = card.querySelector('#pd-sec');
    const t = setInterval(() => { left -= 1; if (sec) sec.textContent = String(Math.max(left, 0)); if (left <= 0) { clearInterval(t); location.href = HOME; } }, 1000);
  }

  const script = document.createElement('script');
  script.src = 'https://www.paypal.com/sdk/js?client-id=' + encodeURIComponent(cfg.clientId) + '&vault=true&intent=subscription&currency=' + encodeURIComponent(cfg.currency || 'USD');
  script.onerror = () => say('PayPal could not load. Check your connection or disable content blockers, then refresh.', true);
  script.onload = () => {
    if (!window.paypal || !window.paypal.Buttons) { say('PayPal could not start. Please refresh.', true); return; }
    window.paypal.Buttons({
      style: { layout: 'vertical', shape: 'pill', color: 'blue', label: 'subscribe', height: 46 },
      onClick: (data, actions) => {
        const pick = choice();
        if (!availability(pick.country, extraClosed).open || !countryCheck(pick.country, lockTo).ok) return actions.reject();
        if (!form.reportValidity()) { say('Please complete the billing details above first.', true); return actions.reject(); }
        say('');
        return actions.resolve();
      },
      createSubscription: (data, actions) => {
        const c = choice();
        const planId = planFor(c);
        if (!planId) throw new Error('This plan is not available yet.');
        const email = (form.elements.email && form.elements.email.value || '').trim();
        const req = {
          plan_id: planId,
          custom_id: [c.plan, c.billing, c.seats, c.country, detected || '-'].join('|'),
          application_context: { brand_name: 'Ajoy Tools', shipping_preference: 'NO_SHIPPING', user_action: 'SUBSCRIBE_NOW' }
        };
        if (c.seats > 1) req.quantity = String(c.seats);
        if (/^\S+@\S+\.\S+$/.test(email)) req.subscriber = { email_address: email };
        return actions.subscription.create(req);
      },
      onApprove: data => { say(''); showDone(data.subscriptionID); },
      onCancel: () => say('Payment cancelled. Nothing was charged.', false),
      onError: err => say('PayPal reported a problem' + (err && err.message ? ': ' + String(err.message).slice(0, 140) : '') + '. Nothing was charged.', true)
    }).render('#paypal-buttons').catch(() => say('PayPal buttons could not be shown. Please refresh.', true));
  };
  document.head.appendChild(script);
}
