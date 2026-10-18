/* Public configuration only. Never place secret keys here.
   Set apiBase to the deployed Supabase storefront function URL when ready. */
window.AJOY_CONFIG = Object.freeze({
  apiBase: '',
  /* Length of the free trial shown on the site. The owner creates the trial code by hand (see apps-script/Code.gs). */
  trialDays: 2,
  /* Turn on (true) only after the newest apps-script/Code.gs is deployed, otherwise trial requests would not be handled. */
  trialOpen: true,
  /* Subscriber sign-in (plan and time left). Turn on (true) only after the newest apps-script/Code.gs is deployed. */
  accountOpen: true,
  /* Download-page email list (Google Sheet). Paste the Apps Script web app URL here.
     Leave it empty to store nothing. It is a public address, not a secret. */
  sheetUrl: 'https://script.google.com/macros/s/AKfycbz2Y9PbQsXraKgcNjc_gnyNKs6Qbe7RyDlB2wjhfPSyHhwgGpb_d_EzkFGSxEGipgDJ/exec',
  /* PayPal settings (Client ID, plan IDs, mode) are not stored here. They are served by the paypal-config
     Supabase function from private secrets. Never put the PayPal Secret anywhere in this repo. */
  paypalConfigUrl: 'https://wsadhewcmpdhojgqzstw.supabase.co/functions/v1/paypal-config',
  // Example: https://YOUR_PROJECT.supabase.co/functions/v1/storefront
});
