# Ajoy storefront: deployment and activation

The public homepage is unchanged. This prepares `/next/` and a **new** Supabase Edge Function named `storefront`. Do not modify or replace the existing `activate` function used by the Maya installer.

## Current status

- The starting website layout and original 3D hero are restored. The billing page, automatic display pricing, and download page run as static files; the experimental motion video files are retained for future use.
- No merchant account exists. Payments are deliberately disabled. Billing details are not submitted, stored, logged, or placed in URLs. `/checkout` returns 503 and creates no order or charge.
- `next/js/site-config.js` has an empty `apiBase` until the new function is deployed. Static prices are estimates, not charge authorization. The full regional catalog is server-side; browser estimates are limited fallbacks.
- Human verification fails closed until Turnstile and private installer storage are configured. There is no fake checkbox, timeout-based pass, or unverified download fallback.

## Deploy using your existing Supabase project

1. Authenticate the Supabase CLI with your own account and link the existing project. Do not put access tokens in repository files. Merge `[functions.storefront] verify_jwt = false` from `config.toml` into the existing project's config; preserve its other function sections.
2. Create a Cloudflare Turnstile widget for `imajoy.github.io`. Configure the following via Supabase's secure function environment settings:
   - `TURNSTILE_SITE_KEY`: public widget key.
   - `TURNSTILE_SECRET_KEY`: server-only verification secret.
   - `TURNSTILE_HOSTNAME=imajoy.github.io`.
   - `ALLOWED_ORIGINS=https://imajoy.github.io` (comma-separated exact origins if adding your own development origin).
   - `DEFAULT_COUNTRY=US` (only used if approximate IP lookup fails).
   - `QUOTE_SIGNING_SECRET`: random server-only signing secret of at least 32 bytes.
   - `INSTALLER_BUCKET=installers`, `INSTALLER_OBJECT=AjoyTools_Setup.py`.
   Supabase normally supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to Edge Functions automatically. Confirm their presence; never expose the service role in frontend config.
3. Create a **private** Storage bucket `installers`, and upload the existing `next/downloads/AjoyTools_Setup.py` unchanged. Permit only server access; no anonymous read policy. The backend generates a 60-second URL only after validating Turnstile's success, action, and hostname.
4. Deploy `supabase functions deploy storefront --project-ref YOUR_PROJECT_REF`. Existing `activate` and other functions must be left unchanged.
5. Set `next/js/site-config.js`'s `apiBase` to `https://YOUR_PROJECT_REF.supabase.co/functions/v1/storefront`. This URL is public configuration, not a secret.
6. Test real Turnstile on the permitted hostname, its failed/expired states, the private signed installer download, and the tab-close fallback. The UI cannot reliably confirm that a browser saved a file: it reports handoff only.

### Existing public installer URLs

Normal `/next/` download links now open verification. **The installer remains publicly accessible at its existing GitHub Pages URLs and in Git history.** The public homepage also links to it. A private copy and signed link do not retroactively protect those public files. Enforcing exclusive download access requires a separate migration of public-build links and removal of publicly served copies; it cannot undo existing public distribution. This change deliberately leaves the public build and installer bytes unchanged.

## Pricing

Server catalog: `functions/_shared/catalog.js`. Prices are per computer. Online monthly tiers are INR 899 (IN/PK/BD/NP/LK), 1299 (selected middle markets), and 1999 (other markets). Annual billing gives 20% off twelve monthly charges; the lowest-region Online annual total is INR 8,630.40 (INR 719.20/month), above the INR 699 floor. Offline is provisionally 2× Online, matching the existing two-plan relationship; confirm this business rule before accepting money.

Local currencies use explicit **reference conversion factors**, not live FX. Review the factors before merchant activation. Approximate IP country uses `api.country.is` (IP is disclosed to that geolocation service); billing country confirms the quote. IP location is an estimate and may be affected by VPNs. Do not trust a browser amount, a user-provided country, or forwarding headers as final payment authorization. All displayed subtotals exclude tax. Do not advertise a tax-inclusive total before the payment processor computes it.

## Merchant activation — requires an account

Choose and establish a supported merchant account first. A separate provider integration must implement:

- Server-side quote signature/expiry validation, current catalog lookup, seat limits, and comparison with billing/payment country. Reprice and obtain consent if these change. Never accept a client amount or currency as authoritative.
- Hosted recurring subscription checkout (not raw card fields) with the correct billing interval, country/currency eligibility, taxes/GST, company/tax-ID fields, cancellation policy, and invoice.
- Server-verified Turnstile and strict allowed-origin checks on checkout creation, idempotency, and rate limits. Configure Supabase edge/WAF limits for quote/download endpoints as well.
- Signature-verified payment webhooks, durable idempotent order storage, and license provisioning via your existing backend. A redirect is not payment confirmation. Keep service-role credentials and provider secrets server-side.
- A status endpoint that verifies the order before showing success and a clear refund/cancellation policy.

Only after provider sandbox end-to-end validation should `/config` advertise `paymentsEnabled: true` and `/checkout` return a hosted URL. Frontend supports this response contract; the current backend never enables it. No account, live charges, tax rates, private bucket, Turnstile keys, or license provisioning were invented during implementation.

## Validation

`node --test tests/*.test.mjs` exercises regional price bounds, forged amounts, seats, CORS, disabled checkout, and successful/failed/expired/incorrect-host human checks with mocked external services. Browser tests must distinguish mocked success flows from a real Supabase/Turnstile deployment.

## Coupon validation

`POST /coupon` calculates the order on the server and checks a hashed coupon allowlist from the server-only `COUPONS_JSON` setting. It validates expiry, plan, billing, countries, optional computer count limit, and the minimum price. One coupon can apply to a new quote; it is revalidated when the selection changes. There is no public coupon-generation or administration endpoint, and no active codes or registry are bundled in the frontend. Invalid or unavailable validation never produces a pretend discount.

The future merchant integration must revalidate the coupon and current pricing before creating checkout, and include verified discounts in payment/invoice data. Usage-count or one-time-use campaigns require an atomic database redemption ledger; the current allowlist does not promise usage caps. Deploy the updated storefront function before activating codes.
