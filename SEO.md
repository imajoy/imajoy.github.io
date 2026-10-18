# Search and sharing

The public site has 16 indexable pages: the homepage, 13 individual tool guides, Privacy and License. Each has a unique title and description, a self-referencing HTTPS canonical URL, matching Open Graph/Twitter metadata and static JSON-LD. Search engines receive this content in HTML without executing pricing or account JavaScript.

Run the dependency-free regression check after editing pages:

```sh
node scripts/check-seo.mjs
```

The check covers titles/descriptions, one main heading, canonical/social URL consistency, JSON-LD parsing and references, sitemap coverage, internal HTML links, and `noindex` on checkout, download, the 404 page and the old `/next/` redirect. Add a public page to `sitemap.xml` when creating it; give it matching metadata and schema. Update descriptions in visible metadata, Open Graph, Twitter and JSON-LD together.

## Structured data and honest claims

The homepage describes Ajoy Tools as a Windows `SoftwareApplication` requiring Autodesk Maya 2023 or newer. It lists all 13 tools, dependencies and the publisher. Individual guides have WebPage and BreadcrumbList markup. Audio Exporter and Advanced IK FK Switch descriptions mention their actual FFmpeg and Advanced Skeleton requirements.

There are no fabricated star ratings, review counts or studio endorsements. No fixed global offer is declared: country availability, regional pricing, billing interval, quantity and one-time rewards affect checkout, and Sandbox configuration does not establish Live purchase availability. SoftwareApplication markup without offers/ratings is descriptive; it does **not** promise eligibility for Google's software-app rich results. Do not insert `price: 0` for a paid toolkit merely because the installer is free or an eligible trial exists.

Social metadata currently uses a text summary; no new social preview image is included. Add a public, branded raster image and matching `og:image`/Twitter image metadata when an approved image is available. Do not imply videos or customer quotes exist while those content lists are empty.

## After GitHub Pages deploys

1. Confirm `https://imajoy.github.io/robots.txt` and `https://imajoy.github.io/sitemap.xml` return the published files. Public pages must return 200, and real unknown paths should return 404.
2. In Google Search Console, add/verify the URL-prefix property `https://imajoy.github.io/` using an ownership method available for your GitHub Pages account. Do not place private credentials in the repository. An HTML verification file or public verification meta token can be added when Search Console provides it.
3. Submit `https://imajoy.github.io/sitemap.xml`. Use URL Inspection on the homepage and priority tool guides; request indexing where appropriate. A sitemap helps discovery but does not guarantee indexing or ranking.
4. Check the deployed homepage in Google's Rich Results Test and Schema.org Validator. Valid JSON-LD alone does not establish rich-result eligibility. Check real mobile performance with PageSpeed Insights and use Search Console field data when enough visits exist; do not infer a measured SEO/Core Web Vitals score from source inspection.
5. Keep checkout and download routes out of the sitemap. Their HTML `noindex` tags remain readable because robots.txt does not disallow crawling them. Robots rules and noindex are not access controls; account and installer protection remains on the server.

## Earn community references

Start with original, useful material: a real Maya recording, an accurate workflow guide or a documented technical fix. Ask actual users for feedback and permission to publish their exact words and approved credits. Link to the relevant tool guide rather than always to the homepage.

Relevant places may include Maya/CG forums, TD blogs and r/Maya. Read each community's promotion rules, disclose that you make Ajoy Tools, and contribute a useful example. Do not buy links, invent endorsements, mass-post advertisements or promise backlink-driven ranking gains. No community posts or outreach messages are sent by this repository update.
