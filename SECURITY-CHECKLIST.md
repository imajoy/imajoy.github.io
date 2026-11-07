# Pre-deploy security checklist

Run before every release: `node --test tests/*.test.mjs`, `node scripts/check-secrets.mjs`, `node scripts/apply-csp.mjs --check`.

- **Inline scripts:** if you edit any inline `<script>` in a page, run `node scripts/apply-csp.mjs` (it refreshes the hash list in each page's Content-Security-Policy).
- **Edge Functions:** commerce, razorpay and maya-status refuse to start when COMMERCE_SECRET, TRIAL_IDENTITY_SECRET (commerce), SHEET_WEB_APP_URL (and SUPABASE_SERVICE_ROLE_KEY for maya-status) are missing or too weak. Every function adds security headers, rate limits by address (10 checkouts/min, 60 other calls/min), and returns a correlation ID with errors. Details go to the function log only.
- **Diagnostic function:** network-check answers 404 unless NETWORK_CHECK_ENABLED=true is set for a short test.
- **Allowed origins:** ALLOWED_ORIGINS (default https://imajoy.github.io). No function allows `*`.
- **Limits you should know:** the in-memory rate limit is per function instance, not global. The `activate` and `passkeys` functions are deployed but not in this repository, so they were not changed.
