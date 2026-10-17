/* Download flow: Download -> email (Gmail, Yahoo, Hotmail) -> automatic download -> plans in 3 seconds.
   The email is validated here. It is only sent to the owner's list when leadsUrl is set in site-config.js. */
const root = document.querySelector('#dl');
const form = document.querySelector('#dl-form');
const input = document.querySelector('#dl-email');
const hint = document.querySelector('#dl-hint');
const countEl = document.querySelector('#dl-count');
const statusEl = document.querySelector('#dl-status');
const title = document.querySelector('#dl-title');
const sub = document.querySelector('#dl-sub');
const FILE = 'downloads/AjoyTools_Setup.py';
const NEXT = 'index.html#pricing';
const ALLOWED = ['gmail.com', 'yahoo.com', 'hotmail.com'];
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
let timers = [], busy = false;

const later = (fn, ms) => timers.push(setTimeout(fn, ms));
const state = s => root.setAttribute('data-state', s);

function check(value) {
  const v = value.trim().toLowerCase();
  if (!v) return 'Enter your email address.';
  if (v.length > 120 || !/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(v)) return 'That does not look like an email address.';
  if (!ALLOWED.includes(v.split('@')[1])) return 'Use a Gmail, Yahoo or Hotmail address.';
  return '';
}
function fail(text) {
  hint.textContent = text;
  root.setAttribute('data-invalid', '');
  input.setAttribute('aria-invalid', 'true');
  form.classList.remove('shake'); void form.offsetWidth; form.classList.add('shake');
}
function clearFail() {
  root.removeAttribute('data-invalid');
  input.removeAttribute('aria-invalid');
  hint.textContent = 'Use a Gmail, Yahoo or Hotmail address.';
}
/* Optional: add the email to the owner's list. Never blocks the download. */
function saveLead(email) {
  const c = window.AJOY_CONFIG || {};
  if (!c.leadsUrl || !c.leadsKey) return;
  try {
    fetch(c.leadsUrl.replace(/\/$/, '') + '/rest/v1/download_leads?on_conflict=email', {
      method: 'POST', keepalive: true, signal: AbortSignal.timeout(8000),
      headers: { apikey: c.leadsKey, Authorization: 'Bearer ' + c.leadsKey, 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=minimal' },
      body: JSON.stringify({ email: email.trim().toLowerCase(), source: 'download-page' })
    }).catch(() => {});
  } catch (e) { /* ignore */ }
}
function saveFile() {
  const a = document.createElement('a');
  a.href = FILE; a.download = 'AjoyTools_Setup.py';
  document.body.append(a); a.click(); a.remove();
}
function run() {
  if (busy) return; busy = true;
  state('working');
  title.textContent = 'Packing your installer.';
  sub.textContent = 'One moment. Your download starts by itself.';
  const t = reduce ? 600 : 2600;
  statusEl.textContent = 'Packing your installer…';
  later(() => { statusEl.textContent = 'Starting your download…'; }, t * .62);
  later(() => {
    saveFile();
    state('done');
    title.textContent = 'You have it.';
    sub.textContent = 'Check your Downloads folder.';
    let n = 3; countEl.textContent = String(n);
    const tick = setInterval(() => { n -= 1; if (n > 0) countEl.textContent = String(n); }, 1000);
    timers.push(tick);
    later(() => { clearInterval(tick); location.href = NEXT; }, 3000);
  }, t);
}
document.querySelector('#dl-start').addEventListener('click', () => {
  state('email'); title.textContent = 'Almost there.'; sub.textContent = 'Enter your email and the download starts by itself.';
  setTimeout(() => input.focus({ preventScroll: true }), 350);
});
document.querySelector('#dl-back').addEventListener('click', () => {
  clearFail(); state('idle'); title.textContent = 'Get the setup file.'; sub.textContent = 'It is free. Installing the tools needs a code from an active subscription.';
});
input.addEventListener('input', clearFail);
form.addEventListener('submit', e => {
  e.preventDefault();
  const problem = check(input.value);
  if (problem) { fail(problem); input.focus(); return; }
  clearFail(); saveLead(input.value); run();
});
document.querySelector('#dl-go').addEventListener('click', () => { timers.forEach(t => { clearTimeout(t); clearInterval(t); }); });
document.querySelector('#dl-again').addEventListener('click', () => { /* keep the countdown running */ });
