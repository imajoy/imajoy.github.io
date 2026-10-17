/* Public configuration only. Never place secret keys here.
   Set apiBase to the deployed Supabase storefront function URL when ready. */
window.AJOY_CONFIG = Object.freeze({
  apiBase: '',
  /* Download-page email list. Leave leadsUrl empty to store nothing.
     Set it to https://YOUR_PROJECT.supabase.co and leadsKey to the PUBLISHABLE (anon) key after the
     download_leads table exists. Never put a secret or service-role key here. */
  leadsUrl: '',
  leadsKey: '',
  // Example: https://YOUR_PROJECT.supabase.co/functions/v1/storefront
});
