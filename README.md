# Wrapline by Ajoy Tools

Website for **Wrapline** (a product of **Ajoy Tools**): 13 animation and pipeline tools for Autodesk Maya 2023 and newer.

https://imajoy.github.io/

Built with HTML, CSS, JavaScript and Three.js, hosted on GitHub Pages.

See LICENSE. Wrapline is proprietary software by Ajoy Tools. All rights reserved.

SEO metadata and sitemap checks: `node scripts/check-seo.mjs`. See [SEO.md](SEO.md) for Search Console submission, structured-data limits and community discovery guidance.

The tool-card motion and looping four-step setup illustration are preserved product features. See [AGENTS.md](AGENTS.md) for their requirements and the optional Playwright browser check: `node scripts/check-protected-animations.mjs <local-site-url>`.

## Site layout

- `index.html` is the **Ajoy Tools** home page (the maker). It lists every product; to add one, copy the Wrapline `<article class="s-card">` in the Tools section and add the product to the `ItemList` in the page's structured data.
- `wrapline.html` is the **Wrapline** product page (Maya, Windows), with its tool guides (`tool-*.html`), download, checkout, license and privacy pages.
