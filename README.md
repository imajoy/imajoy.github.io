# Wrapline

Animation and pipeline tools for Autodesk Maya (2023–2026, Windows), by AJOY.

**Website:** https://imajoy.github.io/

Wrapline is proprietary software. All rights reserved. The license terms are on the website: [License](https://imajoy.github.io/license.html) and [Privacy](https://imajoy.github.io/privacy.html).

## For the maintainer

- No secret is stored in this repository. Real values live only in Supabase (function secrets) and Apps Script (script properties). `.env.example` lists the variable names; `.env` is git-ignored.
- Before every push run `node scripts/check-secrets.mjs`. Full pre-deploy list: [SECURITY-CHECKLIST.md](SECURITY-CHECKLIST.md).
- If a secret was ever pasted into a file, chat or email, treat it as leaked and replace it with a new one.
- Other notes: [SEO.md](SEO.md), [AGENTS.md](AGENTS.md), [PRIVACY-DATA-MAP.md](PRIVACY-DATA-MAP.md).
