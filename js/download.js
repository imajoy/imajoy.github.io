/* Download flow: Download -> email (Gmail, Yahoo, Hotmail) -> automatic download -> plans in 3 seconds.
   The email is checked here, then saved to the owner's Google Sheet when sheetUrl is set in site-config.js. A failed save never stops the download. */
import {getAccountSession,verifyAccountSession,bindAccountEmail} from './account-session.js?v=20261018-l1';
const root = document.querySelector('#dl');
const form = document.querySelector('#dl-form');
const input = document.querySelector('#dl-email');
const hint = document.querySelector('#dl-hint');
bindAccountEmail(input, hint);
const countEl = document.querySelector('#dl-count');
const statusEl = document.querySelector('#dl-status');
const title = document.querySelector('#dl-title');
const sub = document.querySelector('#dl-sub');
const HINT = 'Gmail, Yahoo, Hotmail or any .com or .in address.';
const FILE = 'downloads/AjoyTools_Setup.py';
const NEXT = 'index.html#pricing';
const allowedDomain = domain => /(^|\.)(com|in)$/.test(domain);
const saved = !!(window.AJOY_CONFIG || {}).sheetUrl;
const fine = document.querySelector('.download-fine');
if (fine) fine.textContent = saved ? 'Your email address is saved to Ajoy\u2019s contact list so Ajoy can follow up about Ajoy Tools. See the privacy notice.' : 'Your email address is only checked in your browser. It is not sent anywhere or stored.';
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
let timers = [], busy = false;

const later = (fn, ms) => timers.push(setTimeout(fn, ms));
const state = s => root.setAttribute('data-state', s);

function check(value) {
  const v = value.trim().toLowerCase();
  if (!v) return 'Enter your email address.';
  if (v.length > 120 || !/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(v)) return 'That does not look like an email address.';
  if (getAccountSession()?.email !== v && !allowedDomain(v.split('@')[1])) return 'Use an email address ending in .com or .in, such as Gmail, Yahoo or Hotmail.';
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
  hint.textContent = getAccountSession() ? 'Using your signed-in email. Sign out to use a different email.' : HINT;
}
/* Adds (or refreshes) the email in the owner's Google Sheet. Never blocks the download. */
function saveLead(email) {
  const url = (window.AJOY_CONFIG || {}).sheetUrl;
  if (!url) return;
  try {
    fetch(url, { method: 'POST', mode: 'no-cors', keepalive: true, headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ email: email.trim().toLowerCase() }) }).catch(() => {});
  } catch (e) { /* the download goes ahead either way */ }
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
form.addEventListener('submit', async e => {
  e.preventDefault();
  if (busy) return;
  if (getAccountSession()) {
    busy = true;
    try { if (!await verifyAccountSession()) return; }
    catch (error) { fail(error.message); return; }
    finally { busy = false; }
  }
  const problem = check(input.value);
  if (problem) { fail(problem); input.focus(); return; }
  clearFail(); saveLead(input.value); run();
});
document.querySelector('#dl-go').addEventListener('click', () => { timers.forEach(t => { clearTimeout(t); clearInterval(t); }); });
document.querySelector('#dl-again').addEventListener('click', () => { /* keep the countdown running */ });
