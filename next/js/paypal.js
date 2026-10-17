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
        say((test ? 'Test payment approved. ' : 'Thank you. ') + 'Subscription ID: ' + data.subscriptionID + '. Your license details will be sent to your email.', false);
        box.classList.add('paypal-done');
      },
      onCancel: () => say('Payment cancelled. Nothing was charged.', false),
      onError: err => say('PayPal reported a problem' + (err && err.message ? ': ' + String(err.message).slice(0, 140) : '') + '. Nothing was charged.', true)
    }).render('#paypal-buttons').catch(() => say('PayPal buttons could not be shown. Please refresh.', true));
  };
  document.head.appendChild(script);
}
