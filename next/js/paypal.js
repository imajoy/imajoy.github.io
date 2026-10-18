/* PayPal subscription buttons for the checkout page.
   Runs only when AJOY_CONFIG.paypal is set. Uses the public Client ID and plan IDs; no secrets. */
const url = window.AJOY_CONFIG && window.AJOY_CONFIG.paypalConfigUrl;
const form = document.querySelector('#billing-form');
const pay = document.querySelector('#pay');
let cfg = null;
if (url && form && pay) {
  try {
    const r = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (r.ok) cfg = await r.json();
  } catch (e) { cfg = null; }
}
if (cfg && cfg.clientId && cfg.plans && form && pay) {
  const test = cfg.mode !== 'live';
  const box = document.createElement('div');
  box.className = 'paypal-box';
  box.innerHTML =
    (test ? '<p class="paypal-test"><b>Test mode.</b> No real money moves. Pay with your PayPal sandbox buyer account. Test prices are in ' + cfg.currency + '.</p>' : '') +
    '<p class="paypal-note" id="paypal-note" role="status"></p><div id="paypal-buttons"></div>';
  pay.replaceWith(box);
  const note = box.querySelector('#paypal-note');
  const say = (t, bad) => { note.textContent = t; note.dataset.bad = bad ? '1' : '0'; };
  const avail = document.querySelector('#availability');
  if (avail) avail.textContent = test ? 'Test mode: review your billing details, then subscribe with PayPal. No real money moves.' : 'Review your billing details, then subscribe securely with PayPal.';
  const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function showDone(subId) {
    const c = choice();
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
      (email ? '<div><dt>License details to</dt><dd>' + esc(email) + '</dd></div>' : '') +
      '<div><dt>Subscription ID</dt><dd>' + esc(subId) + '</dd></div></dl>' +
      '<p class="pd-note">' + (test ? 'This was a test, so nothing was charged. ' : '') + 'Keep your subscription ID for any support question. Your license details will be sent to your email by Ajoy.</p>' +
      '<div class="pd-actions"><a class="btn btn-blue" href="index.html">Back to Ajoy Tools</a><a class="btn" href="index.html#install">How to install</a></div>';
    if (grid) { grid.hidden = true; grid.before(card); } else { form.before(card); }
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  const choice = () => ({ plan: form.elements.plan.value, billing: form.elements.billing.value, seats: Math.max(1, Math.min(100, parseInt(form.elements.seats.value, 10) || 1)) });

  const script = document.createElement('script');
  script.src = 'https://www.paypal.com/sdk/js?client-id=' + encodeURIComponent(cfg.clientId) + '&vault=true&intent=subscription&currency=' + encodeURIComponent(cfg.currency);
  script.onerror = () => say('PayPal could not load. Check your connection or disable content blockers, then refresh.', true);
  script.onload = () => {
    if (!window.paypal || !window.paypal.Buttons) { say('PayPal could not start. Please refresh.', true); return; }
    window.paypal.Buttons({
      style: { layout: 'vertical', shape: 'pill', color: 'blue', label: 'subscribe', height: 46 },
      onClick: (data, actions) => {
        if (!form.reportValidity()) { say('Please complete the billing details above first.', true); return actions.reject(); }
        say('');
        return actions.resolve();
      },
      createSubscription: (data, actions) => {
        const c = choice();
        const planId = cfg.plans && cfg.plans[c.plan] && cfg.plans[c.plan][c.billing];
        if (!planId) throw new Error('This plan is not available yet.');
        const email = (form.elements.email && form.elements.email.value || '').trim();
        const req = {
          plan_id: planId,
          custom_id: [c.plan, c.billing, c.seats].join('|'),
          application_context: { brand_name: 'Ajoy Tools', shipping_preference: 'NO_SHIPPING', user_action: 'SUBSCRIBE_NOW' }
        };
        if (c.seats > 1) req.quantity = String(c.seats);
        if (/^\S+@\S+\.\S+$/.test(email)) req.subscriber = { email_address: email };
        return actions.subscription.create(req);
      },
      onApprove: data => {
        say('');
        showDone(data.subscriptionID);
      },
      onCancel: () => say('Payment cancelled. Nothing was charged.', false),
      onError: err => say('PayPal reported a problem' + (err && err.message ? ': ' + String(err.message).slice(0, 140) : '') + '. Nothing was charged.', true)
    }).render('#paypal-buttons').catch(() => say('PayPal buttons could not be shown. Please refresh.', true));
  };
  document.head.appendChild(script);
}
