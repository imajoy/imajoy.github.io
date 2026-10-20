# Registered checkout, downloads and one-time trials

The website now separates `checkout.html` (billing, offers and one Continue to payment action) from `payment.html` (enabled, country-filtered gateways). A short-lived, tab-local draft carries form details; it contains no session token or authoritative price. Country, account, availability, trial and discount checks still run before payment. Legacy PayPal returns to checkout.html are forwarded to the payment page for confirmation. This page separation needs a website publish only.

For locked server-detected billing countries, the verified testing-account exception and optional VPN/proxy checks, follow [BILLING-NETWORK.md](BILLING-NETWORK.md). This also replaces manual country selection during Sandbox testing.

To add Razorpay without changing Live PayPal, see [RAZORPAY.md](RAZORPAY.md). Razorpay is separately enabled and hidden until configured; the existing PayPal trial/promotional flow remains separate.

The website requires email verification before subscribing or requesting the setup. Records remain in the owner's Google Sheet. Supabase supplies the trusted network boundary, signs private installer downloads and forwards signed commerce requests to Apps Script. PayPal handles payment information; the application never receives a full card number or security code.

This is **not activated by a GitHub push**. Both server deployments and the private installer must be configured. The new frontend intentionally has no browser-created subscription or public installer fallback.

## 1. Preserve and upload the original installer

Create a **private** Supabase Storage bucket, for example `installers`, with no public/anonymous read policy. Upload the original `AjoyTools_Setup.py` unchanged. Its SHA-256 is `6a9efeaf69790f4a329286de2595adc40e114875b87b183477764be430ff5b76`.

The installer has been removed from the currently served GitHub Pages tree. For this task, an unchanged copy was preserved outside the checkout at `/workspace/ajoy-private-installer/AjoyTools_Setup.py`. If needed, recover it locally from the previous commit using `git show 0668165:downloads/AjoyTools_Setup.py > /tmp/AjoyTools_Setup.py`. Do not put it back in the published tree.

Old copies remain in public Git history, browser caches or other people's downloads. Registration protects the current website's delivery flow; it cannot recall already distributed copies. Using the tools still requires a license.

## 2. Update the existing Apps Script web app

In the existing Sheet's **Extensions → Apps Script**, update `Code.gs`, `Commerce.gs` and `Loyalty.gs` from `apps-script/`. Keep existing PayPal properties and the same web app URL. Do not run `setupPlans()` again if the existing plans are already configured.

Set these private **Script properties**:

- `COMMERCE_SECRET`: a newly generated random secret of at least 32 bytes, shared only with the Supabase commerce function. Never put it in the repository or browser.
- `TRIAL_IDENTITY_SECRET`: a separate random secret of at least 32 bytes, also shared with the commerce function. Keep it stable: existing email/browser/IP/payer hashes depend on it. Rotating the request-signing secret does not change these hashes. Changing this identity secret requires a deliberate history migration; do not reset trial history by rotating it casually.
- `PAYPAL_WEBHOOK_ID`: the ID of the webhook created in step 4, for the same sandbox/live mode as `PAYPAL_MODE` and the site's client ID.
- `COMMERCE_ENFORCE_FROM`: a fixed ISO date/time when this enforcement starts, for example the actual activation time. Preserve it on later deployments. Existing subscriptions before this time are not cancelled merely because they predate checkout records.
- `COMMERCE_ENABLED=false` until setup and sandbox validation are complete.

Deploy with **Deploy → Manage deployments → Edit → New version → Deploy**. Preserve the existing execution/access settings and URL. Anonymous visitors can request registration codes; only a verified code creates a row in `Accounts`. The original download contact list is not proof of registration. Existing `Orders` emails can still sign in and get an account row after verifying their code.

## 3. Deploy the Supabase functions

Deploy `commerce`, the updated `paypal-config`, and the updated `storefront` if that older function is deployed; retain existing `activate` and other functions. The legacy storefront download route now returns 410 and cannot bypass registration, even with a supplied download token. `verify_jwt=false` is intentional: the commerce function validates the site's signed account sessions through Apps Script. Supabase JWTs are not this authentication system.

Configure private function settings:

- The same `COMMERCE_SECRET` and `TRIAL_IDENTITY_SECRET` as Apps Script.
- `SHEET_WEB_APP_URL`: the existing Apps Script `/exec` URL configured in `js/site-config.js`.
- `ALLOWED_ORIGINS=https://imajoy.github.io` (add only exact development origins actually needed).
- `INSTALLER_BUCKET=installers`, `INSTALLER_OBJECT=Wrapline_Setup.py` (the toolkit was renamed from Ajoy Tools to Wrapline; the old `AjoyTools_Setup.py` copy may stay in the bucket for older links).
- `COMMERCE_ENABLED=false` initially.
- Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; confirm that they are available only on the server.

### Establish a trustworthy client IP

`COMMERCE_CLIENT_IP_HEADER` must be either `cf-connecting-ip` or `x-real-ip`, **only after verifying that your actual ingress strips and overwrites that header with the network client's IP**. Do not trust a caller-provided forwarding header. The implementation deliberately does not fall back to the first value of arbitrary `X-Forwarded-For`.

Test the deployed route with normal and spoofed headers and confirm the ingress behavior before enabling trials. If neither supported header can be established as trustworthy in your Supabase deployment, keep this setting unset and the trial disabled until a trusted ingress supplies one. Do not set a header name just to make the eligibility UI green. The server cannot verify location for checkout without this network configuration. Downloads and email registration do not require IP eligibility.

An owner diagnostic is provided to make that check reviewable. From the repository folder, deploy the temporary, read-only probe and run the local checker:

```sh
npx supabase@latest functions deploy network-check --project-ref wsadhewcmpdhojgqzstw --use-api --no-verify-jwt
node scripts/check-commerce-network.mjs
```

On Windows PowerShell, use `npx.cmd` in place of `npx`. The probe returns the two candidate IP headers, the caller's forwarding chain for diagnosis, and a request nonce; it has no account/payment/storage logic or environment access. The local checker compares them with independent dual-stack, IPv4 and IPv6 lookups at `api64.ipify.org`, `api.ipify.org` and `api6.ipify.org`, then makes seven requests containing forged forwarding headers. Its tables contain address families and comparison results without printing addresses. The forwarding-chain table is observational only: the commerce gateway still does not trust that chain. Known Cloudflare cross-zone Worker marker addresses cannot qualify as client identity. IPv4-mapped IPv6 forms are normalized for comparison. Missing headers, public-IP mismatches, changed values, failed requests and stale responses cannot yield a passing candidate. VPNs or different routes can still produce an inconclusive mismatch. Updating this diagnostic requires deploying the latest `network-check/handler.js` as well as updating the local checker.

The checker prints separate per-request HTTP results and candidate-header results. A blocked normal request stops further probes. A rejected forged-header request is reported as inconclusive, not treated as proof that the header was rewritten. HTTP 403 is not automatically diagnosed as a JWT problem. The checker does **not** set `COMMERCE_CLIENT_IP_HEADER`. A passing candidate is deployment evidence to review alongside the provider's ingress guarantees, not proof of every possible ingress path. Keep the header unset if neither passes or the provider behavior remains uncertain. After reviewing the results, remove the temporary function:

```sh
npx supabase@latest functions delete network-check --project-ref wsadhewcmpdhojgqzstw
```

The server hashes the observed IP and browser identifier before forwarding them. Raw addresses are not stored in trial records. Location lookup tries country.is and then GeoJS using only the configured, verified ingress IP header. The display-only browser lookup also falls back between those providers when the edge cannot determine a country. The server, not a browser-supplied country or price, chooses its configured PayPal plan. Public `paypal-config` now returns plan availability flags rather than actual plan IDs.

## 4. Configure and validate PayPal webhooks

Create a PayPal webhook on the same REST app and mode:

`https://wsadhewcmpdhojgqzstw.supabase.co/functions/v1/commerce/paypal-webhook`

Subscribe to subscription activation/update/cancellation/suspension/expiration and payment sale completion/refund/reversal events. Save its ID in Apps Script. Apps Script verifies each event through PayPal's signature-verification endpoint before processing it. A browser approval callback alone never grants access.

Run `backfillTrialHistory()` from the Apps Script editor **before enabling the new flow**, in each applicable mode. It imports historical trial emails and server-verified payer IDs from the existing `Orders` tab into `Checkouts`. Resolve failed lookups rather than ignoring them. Orders missing from the Sheet must be reconciled from PayPal's verified history before claiming comprehensive enforcement of past trials. Old browser/IP identifiers cannot be reconstructed.

Use sandbox accounts to test all of these before switching live:

If the owner is in India or another closed sales region, use the optional private Supabase secret `COMMERCE_SANDBOX_COUNTRY=US` to simulate a supported market for Sandbox checkout. Both Supabase's `PAYPAL_MODE` and Apps Script's `PAYPAL_MODE` must explicitly be `sandbox`. Deploy the latest `commerce` function and `Commerce.gs` before using it. On the checkout page, select **United States** as the simulated billing country and use a US **Sandbox Personal** buyer account. The page remains marked as test mode. The real IP/browser hashes still enforce trial restrictions; only the pricing/availability country is simulated. The ledger records both the observed network country and simulated country in Buyer details. Browser-supplied test-country claims are ignored. The gateway ignores this setting in Live mode, and Apps Script rejects any Sandbox override arriving at a Live merchant. Remove the test-country secret before production activation. This does not open Indian domestic payments or add an Indian payment provider.

1. Register a new email, verify the code, and download the private installer.
2. Approve a first Online trial. It records one consumed trial and one order. Closing the browser must not skip the webhook check.
3. Repeat with the same email, browser or public IP: a trial must be rejected before subscription creation. Standard paid checkout requires its own explicit selection.
4. Use a different verified email, browser and IP but the same PayPal payer account: approval must be rejected, the new trial subscription cancelled, and no trial license issued.
5. Repeat webhook delivery, simultaneous checkout attempts, lost responses and delayed approval. They must not grant another trial or duplicate order email.
6. Confirm that no unsigned/unmanaged trial gets a license. A verified activation webhook cancels a trial created outside the managed checkout after `COMMERCE_ENFORCE_FROM`.
7. Check cancellation failures and provider outages. Keep blocked trials blocked and reconcile retries; do not issue a license from a client success screen.

Then set `COMMERCE_ENABLED=true` in both places. Keep live/sandbox plans, credentials, webhook IDs and public client ID consistent. The website already points to the `commerce` function URL. Run an actual end-to-end check after deployment; local mocks are not deployment evidence.

## Enforcement and limits

- `Accounts` contains verified registrations. `Checkouts` is the durable reservation/used-trial ledger, including keyed email/browser/IP/payer hashes and provider IDs. `Orders` retains the existing verified subscription/order records and owner email workflow. Keep all tabs private.
- A script lock serializes trial reservation and consumption. Same-owner retries reuse their reserved checkout. PayPal receives the checkout ID as its idempotency key and `custom_id`. Plan, quantity and checkout ownership are checked against PayPal's actual response.
- Reservations last 30 minutes. A late trial approval is cancelled before access is issued. An accepted trial remains consumed after cancellation/refund. Do not delete accepted ledger rows to tidy the Sheet.
- The verified payer ID is learned after PayPal approval. Conflicting payers are cancelled before trial access is issued; they are not silently moved onto a paid plan. Missing payer identity cannot qualify for a trial. New users sharing an already-used public IP will also share its trial limit, as requested.
- Browser storage is a resettable browser identifier, not an unchangeable hardware ID. IP addresses can be shared or change. PayPal exposes payer-account identity, **not a universal card fingerprint across different PayPal accounts**. This system cannot guarantee one physical card/device/person across all networks and accounts. Stronger card-level restrictions require a processor-supported fingerprint or fraud service; do not invent matches from card last-four digits.
- Full card numbers and security codes never enter the site or Sheet. These checks use service records and hashes, not a hidden device fingerprint.

## Local validation

`node --test tests/*.test.mjs` covers registration, email-code ownership, private request signatures/replay, reservation conflicts, email/browser/IP reuse, PayPal payer reuse, idempotency, webhook verification, historical import, and protected downloads with mocked Google/PayPal services. The checks send no emails, create no real subscriptions and make no charges. They cannot establish real ingress behavior, SMTP delivery, storage permissions or merchant deployment readiness.

## Returning subscriber rewards

The active checkout uses Google Sheets accounts and PayPal payment records. The older Supabase `storefront` loyalty implementation is separate; enabling it does not connect rewards to this PayPal checkout.

To activate this update on the already configured system:

1. From the updated local repository, deploy the gateway first in PowerShell. This keeps the current checkout compatible during the update:

   ```powershell
   npx.cmd supabase@latest functions deploy commerce --project-ref wsadhewcmpdhojgqzstw --use-api --no-verify-jwt
   ```

2. In **Extensions → Apps Script**, replace `Code.gs` and `Commerce.gs` with the repository copies. Add a script file named **Loyalty** and paste `apps-script/Loyalty.gs` into it. Save all three files.
3. Choose **Deploy → Manage deployments → Edit (pencil) → New version → Deploy**. Preserve the existing web app URL, properties and Sheet. Do not run `setupPlans()` again.
4. Reload checkout and sign in with an email that has a completed Sandbox payment recorded in Orders. The reward panel should say **Verified: 5% off** after one monthly payment, or **Verified: 10% off** after one annual payment. Review the reduced total in PayPal before approval. Sandbox transactions and Live transactions are isolated.

No new secrets, webhook types or history-import command are required. Matching Orders/Checkouts identify subscriptions; their positive completed payments are read back from PayPal. A row marked ACTIVE alone does not establish a payment. Missing, incomplete or unrecognised history stops reward checkout with a retry message; it never silently removes an advertised discount. Until the updated eligibility service advertises reward support, the frontend retains standard checkout and explicitly says no loyalty discount is applied.

Rules:

- Rewards follow the verified sign-in email across Online/Offline and quantities. One completed subscription payment counts once, regardless of the number of licenses. Free trials, pending/failed payments, refunds and prorated amounts do not advance the count. At most one full payment per subscription/calendar billing month or year qualifies. Refunds do not restore already-used rewards.
- A returning customer with one completed monthly payment gets 5% off the next two monthly payments in the newly approved subscription. A customer with two completed monthly payments gets 5% off the next payment. Standard pricing follows; the percentages never accumulate to 10%.
- After one completed annual payment, a new annual checkout gets an extra 10% off the current yearly catalog price for one payment. The next annual charge returns to that yearly catalog rate. Monthly payment history cannot invent an annual renewal.
- PayPal receives an introductory paid pricing phase with a fixed number of cycles followed by the standard unlimited regular phase. PayPal calls that paid introductory phase `TRIAL` internally; it is not the separate free two-day trial. The checkout stores the reward schedule in private Checkouts → Buyer details. Reward plans are created as needed and stored in private Script properties under `LOYALTY_PLANS_sandbox` or `LOYALTY_PLANS_live`.
- Existing previously approved PayPal subscriptions keep their agreed billing schedules. This update applies on a new checkout; it does not retrospectively change an existing subscription. Do not create overlapping subscriptions just to obtain a discount. To move an existing customer onto a reward schedule, arrange their replacement checkout and cancellation timing with them.
- A pending reward checkout is resumed on reload, rather than issuing another reward. A competing checkout cannot reserve the same benefit. If you abandon an approved subscription before payment, cancel it in PayPal before starting a replacement.
- Coupons are not combined with these rewards. Coupon codes are managed in the Sheet's **Coupons** tab (Code, Percent off, Payments discounted, Expires on, Plan, Billing, Max uses, Used, Active, Note). A valid coupon replaces any reward on that checkout, can be used once per verified account, never applies to the free trial, and is billed through the same discounted-then-standard PayPal plan mechanism. `Used` is updated automatically after a confirmed checkout.

Validate with separate Sandbox accounts/history: no previous paid period → no reward; one monthly paid period → 5% for payments 2 and 3; two → 5% for payment 3 only; three or more → no reward; one yearly paid period → 10% once; two or more yearly paid periods → no reward. Verify quantity totals, cancellation, duplicate requests and the standard-price phase in PayPal. Automated tests mock provider responses; an actual Sandbox approval of a generated reward plan is still required after deployment.

## Country lookup updates

Deploy updated lookup code after pulling this version:

```powershell
npx.cmd supabase@latest functions deploy paypal-config --project-ref wsadhewcmpdhojgqzstw --use-api --no-verify-jwt
npx.cmd supabase@latest functions deploy commerce --project-ref wsadhewcmpdhojgqzstw --use-api --no-verify-jwt
```

Leave `COMMERCE_CLIENT_IP_HEADER` unset unless the ingress checks above have verified it. An unknown edge country is intentional when the IP cannot be trusted; the browser can still estimate the visitor country directly with country.is or GeoJS for display. These estimates do not authorize payment or establish trial eligibility. Neither a chosen billing country nor a forged forwarding/country header supplies trusted server location.
