/* Public configuration only. Never place secret keys here.
   Set apiBase to the deployed Supabase storefront function URL when ready. */
window.AJOY_CONFIG = Object.freeze({
  apiBase: '',
  /* Download-page email list (Google Sheet). Paste the Apps Script web app URL here.
     Leave it empty to store nothing. It is a public address, not a secret. */
  sheetUrl: 'https://script.google.com/macros/s/AKfycbxAyrQQpvgXTD7WYS_5I1EVSfojM07O4oy3g6otATWgZzuwZ2e_YQ9qrcrVxW3r-vAjjQ/exec',
  // Example: https://YOUR_PROJECT.supabase.co/functions/v1/storefront
});
