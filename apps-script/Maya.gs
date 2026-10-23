/* Wrapline in Maya: Basic plan access by registered email.
   Called only by the Supabase "activate" function through the signed commerce envelope (action "maya_access"),
   never directly by the browser or by Maya. Read-only: it never creates accounts, rows or charges.

   Answer:
     {ok:true, registered:false}                                  email has no account on the website
     {ok:true, registered:true, entitled:false, reason:'no_plan'}   account, but no Basic plan
     {ok:true, registered:true, entitled:false, reason:'trial_ended' | 'subscription_ended', endedAt}
     {ok:true, registered:true, entitled:true, trial, endsAt, renews, seats}
     {ok:false, error:'unavailable'}                               PayPal/Razorpay could not be asked: decide nothing

   Access rules (Basic = stored plan key 'online'):
     - a running subscription (trial or paid, PayPal or Razorpay) gives access;
     - a cancelled one keeps access until its trial or paid period ends;
     - after that the answer is trial_ended (it never got past the trial) or subscription_ended. */
var MAYA_CACHE_SECONDS_ = 300;  // the same email asked again within 5 minutes gets the saved answer (fast Maya start)

function mayaAccess_(d) {
  var email = String(d.email || '').trim().toLowerCase();
  if (email.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { ok: true, registered: false };
  var cache = CacheService.getScriptCache(), key = 'maya:' + mode_() + ':' + email;
  if (!d.fresh) {
    var hit = cache.get(key);
    if (hit) { try { return JSON.parse(hit); } catch (e) {} }
  }
  var answer = mayaAccessNow_(email);
  if (answer.ok) { try { cache.put(key, JSON.stringify(answer), MAYA_CACHE_SECONDS_); } catch (e) {} }
  return answer;
}

function mayaAccessNow_(email) {
  if (!registeredEmail_(email)) return { ok: true, registered: false };
  var all = subscriptionsFor_(email) || [];
  var basic = all.filter(function (s) { return s.plan !== 'offline'; });
  if (!basic.length) return { ok: true, registered: true, entitled: false, reason: 'no_plan', premium: all.length > 0 };
  var now = Date.now(), live = [], unknown = false, latest = basic[0];  // newest first
  basic.forEach(function (s) {
    var ends = s.endsAt ? Date.parse(s.endsAt) : NaN;
    if (s.status === 'UNKNOWN') { unknown = true; return; }
    // Ended or stopped subscriptions keep access only until their period ends. A Razorpay 'EXPIRED' means access
    // was taken away (refund), and an unfinished PayPal checkout (APPROVAL_PENDING/APPROVED) never gives access.
    var stopped = s.status === 'CANCELLED' || s.status === 'SUSPENDED' || (s.status === 'EXPIRED' && s.provider !== 'razorpay');
    if (s.status === 'ACTIVE' || (stopped && Number.isFinite(ends) && ends > now)) live.push(s);
  });
  if (live.length) {
    var seats = live.reduce(function (n, s) { return n + (Number(s.seats) || 1); }, 0);
    var ends = live.map(function (s) { return s.endsAt ? Date.parse(s.endsAt) : 0; }).filter(Number.isFinite);
    return { ok: true, registered: true, entitled: true, trial: live.every(function (s) { return !!s.trial; }),
             renews: live.some(function (s) { return !!s.renews; }), seats: Math.min(Math.max(seats, 1), 100),
             endsAt: ends.length ? new Date(Math.max.apply(null, ends)).toISOString() : '' };
  }
  if (unknown) return { ok: false, error: 'unavailable', message: 'The subscription could not be checked right now.' };
  if (latest.status === 'APPROVAL_PENDING' || latest.status === 'APPROVED') return { ok: true, registered: true, entitled: false, reason: 'no_plan', premium: false };
  return { ok: true, registered: true, entitled: false, reason: mayaWasTrialOnly_(latest) ? 'trial_ended' : 'subscription_ended', endedAt: latest.endsAt || '' };
}

/* True when this subscription never went past its free trial (no payment was ever taken). */
function mayaWasTrialOnly_(s) {
  if (s.provider === 'razorpay' && typeof razorpayRows_ === 'function') {
    try {
      var r = razorpayRows_().filter(function (x) { return x.id === s.ref; })[0];
      if (r) return r.price && r.price.offer === 'trial' && !r.convertedAt;
    } catch (e) {}
  }
  return !!s.trial;
}

/* Run from the Apps Script editor to see what Maya would be told for an email (no cache, nothing is changed). */
function testMayaAccess() {
  var EMAIL = '';  // put the email to test between the quotes
  Logger.log(JSON.stringify(mayaAccess_({ email: EMAIL || Session.getEffectiveUser().getEmail(), fresh: true })));
}
