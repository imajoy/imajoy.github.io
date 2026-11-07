# Wrapline by Ajoy Tools

Website for **Wrapline** (a product of **Ajoy Tools**): 14 animation and pipeline tools for Autodesk Maya 2023–2026.

https://imajoy.github.io/

Built with HTML, CSS, JavaScript and Three.js, hosted on GitHub Pages.

See LICENSE. Wrapline is proprietary software by Ajoy Tools. All rights reserved.

SEO metadata and sitemap checks: `node scripts/check-seo.mjs`. See [SEO.md](SEO.md) for Search Console submission, structured-data limits and community discovery guidance.

The tool-card motion and looping four-step setup illustration are preserved product features. See [AGENTS.md](AGENTS.md) for their requirements and the optional Playwright browser check: `node scripts/check-protected-animations.mjs <local-site-url>`.

## Secrets and security (read before every deploy)

- **No secret lives in this repository.** Real values are stored only in Supabase (Edge Function secrets) and Apps Script (Script properties). `.env.example` lists every variable with placeholders. `.env` is git-ignored.
- The website is static, so the browser only receives public values from `js/site-config.js` (Supabase function URLs and the Apps Script web-app URL). The Supabase **service role key**, payment secrets, webhook secrets and signing secrets are server-side only and must never appear in `js/`, `*.html` or any file served to the browser.
- Every Supabase table has Row Level Security turned on, with no public policies. Keep it that way: new tables need `enable row level security` in their migration.
- Run `node scripts/check-secrets.mjs` before every push. It fails if a tracked file contains something that looks like a real credential.

> **WARNING: rotate anything that was ever hard-coded.** Git keeps history forever. If a secret was ever written into a file and committed (even if you later deleted it), the old value is still in the history and must be treated as leaked: revoke it and create a new one right away (PayPal secret, Razorpay key and webhook secrets, `COMMERCE_SECRET`, `TRIAL_IDENTITY_SECRET`, `SESSION_SECRET`, GitHub token, Supabase service role key). A scan of the full history on 2026-11-08 found no such values, but rotate any key that was ever pasted into chat, screenshots or email.

## Site layout

- `index.html` is the **Ajoy Tools** home page (the maker). It lists every product; to add one, copy the Wrapline `<article class="s-card">` in the Tools section and add the product to the `ItemList` in the page's structured data.
- `wrapline.html` is the **Wrapline** product page (Maya, Windows), with its tool guides (`tool-*.html`), download, checkout, license and privacy pages.
