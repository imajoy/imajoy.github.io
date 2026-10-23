/* Public configuration only. Never place secret keys here.
   Set apiBase to the deployed Supabase storefront function URL when ready. */
window.AJOY_CONFIG = Object.freeze({
  apiBase: '',
  commerceUrl: 'https://wsadhewcmpdhojgqzstw.supabase.co/functions/v1/commerce',
  razorpayUrl: 'https://wsadhewcmpdhojgqzstw.supabase.co/functions/v1/razorpay',
  /* Length of the PayPal trial shown on the site. Licenses are issued after server approval. */
  trialDays: 4,
  /* Old trial-code request form (replaced by the 4-day PayPal trial on the Basic plan). Keep false. */
  trialOpen: false,
  /* Subscriber sign-in (plan and time left). Turn on (true) only after the newest apps-script/Code.gs is deployed. */
  accountOpen: true,
  passkeysUrl: 'https://wsadhewcmpdhojgqzstw.supabase.co/functions/v1/passkeys',
  /* Email registration and account sessions (Google Sheets / Apps Script).
     This is a public address, not a secret. */
  sheetUrl: 'https://script.google.com/macros/s/AKfycbz2Y9PbQsXraKgcNjc_gnyNKs6Qbe7RyDlB2wjhfPSyHhwgGpb_d_EzkFGSxEGipgDJ/exec',
  /* PayPal client ID, mode and plan availability are served by paypal-config.
     Actual plan IDs and merchant credentials remain on the server. */
  paypalConfigUrl: 'https://wsadhewcmpdhojgqzstw.supabase.co/functions/v1/paypal-config',
  // Example: https://YOUR_PROJECT.supabase.co/functions/v1/storefront
});
