# Publish approved customer feedback

`testimonials.json` is intentionally empty until real customers approve publication. The homepage hides the entire reviews section when no approved entries exist. Never substitute invented customers, ratings, studio logos or placeholder quotes.

For each quote, obtain permission to publish the exact wording, name, role, optional studio/project credit and optional original-review link. Keep proof of permission privately; do not put private correspondence or customer email addresses here. This JSON is public.

An entry has these fields:

- `approved`: `true` only after permission is recorded.
- `quote`: the exact approved quote (up to 400 characters).
- `name`: the approved display name (up to 80 characters).
- `role`: optional approved job title or studio credit (up to 80 characters).
- `project`: optional approved project/workflow context (up to 160 characters).
- `sourceUrl`: optional public HTTPS link to the original review. Do not link to private messages or customer projects without permission.

Add real entries to the array in `testimonials.json` and push. Up to six approved entries appear automatically. No payment, account or private Sheet access is needed. Entries missing `approved: true`, a name or a quote remain unpublished.
