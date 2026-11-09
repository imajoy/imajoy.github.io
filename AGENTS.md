# Preserve approved product motion

The user explicitly asked to retain these two homepage animations:

- The Export, Animation, Rigging and Scene cards in `#tools`: brief staggered row entrances, gently floating icons, and hover/focus feedback. All 10 Wrapline Pro names (the four free tools live on wrapline-free.html), descriptions, icons and guide links must stay visible and usable.
- The four-step installer illustration in `#stage-install`: download, drag into Maya, type the example access code, install, show success, and repeat automatically while visible.

Treat these as required product behavior during design, performance, cleanup and SEO work. Do not remove them as decorative clutter or disable them with broad homepage motion overrides unless the user explicitly requests that change. Preserve reduced-motion support and offscreen/background pausing. Never make tool text depend on JavaScript adding a reveal class; missing scripts must leave the content visible.

Relevant files: `js/tool-card-motion.js`, `css/tool-card-motion.css`, the install sequence in `js/main.js`, `css/landing-motion.css`, and their includes in `wrapline.html`.

When changing these files or shared motion rules, run `node scripts/check-protected-animations.mjs <local-site-url>` with Playwright and Chromium available. It verifies visible tool content, tool motion, the complete installer loop, and reduced-motion behavior. Optional `PLAYWRIGHT_MODULE` and `CHROMIUM_PATH` environment variables can select existing installations. Run `node scripts/check-seo.mjs` after editing page markup. A local static server can be started with `python3 -m http.server 8793 --bind 127.0.0.1` from this checkout; use an existing checkout and do not create a worktree for setup.

## Product terminology

**Wrapline** is the brand and the umbrella for everything on the site. Under it: **Wrapline Free** (the free Maya toolkit: IK / FK Snap, Multi Swapper, UDIM Preview, Layer Prefix Remover; page wrapline-free.html; free for everyone, all rights reserved, donations via support.html) and **Wrapline Pro** (the paid Maya toolkit, wrapline.html, 10 tools). **Wrapline for Blender** is planned and shown as "coming soon". The name "Ajoy Tools" is retired from the public site. The legal owner stays visible only as "AJOY" / "Made by Ajoy Pal" in footers and the License, Privacy and invoices. The installer is `Wrapline_Setup.py`.

Wrapline **FBX Exporter** and **Alembic Exporter** are AJOY's scripts. Their dependencies, **fbxmaya** and **AbcExport**, are Maya's built-in plug-ins. Explain that the Maya plug-ins can be enabled in the Plug-in Manager without a separate download; do not describe AJOY's exporter scripts as bundled with Maya. FFmpeg is a separate download used by **Audio Exporter**.
