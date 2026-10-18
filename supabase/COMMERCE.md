# Registered checkout, downloads and one-time trials

The website requires email verification before subscribing or requesting the setup. Records remain in the owner's Google Sheet. Supabase supplies the trusted network boundary, signs private installer downloads and forwards signed commerce requests to Apps Script. PayPal handles payment information; the application never receives a full card number or security code.

This is **not activated by a GitHub push**. Both server deployments and the private installer must be configured. The new frontend intentionally has no browser-created subscription or public installer fallback.

## 1. Preserve and upload the original installer

Create a **private** Supabase Storage bucket, for example `installers`, with no public/anonymous read policy. Upload the original `AjoyTools_Setup.py` unchanged. Its SHA-256 is `6a9efeaf69790f4a329286de2595adc40e114875b87b183477764be430ff5b76`.

The installer has been removed from the currently served GitHub Pages tree. For this task, an unchanged copy was preserved outside the checkout at `/workspace/ajoy-private-installer/AjoyTools_Setup.py`. If needed, recover it locally from the previous commit using `git show 0668165:downloads/AjoyTools_Setup.py > /tmp/AjoyTools_Setup.py`. Do not put it back in the published tree.

Old copies remain in public Git history, browser caches or other people's downloads. Registration protects the current website's delivery flow; it cannot recall already distributed copies. Using the tools still requires a license.

## 2. Update the existing Apps Script web app

In the existing Sheet's **Extensions → Apps Script**, update `Code.gs` and add `Commerce.gs` from `apps-script/`. Keep existing PayPal properties and the same web app URL. Do not run `setupPlans()` again if the existing plans are already configured.

Set these private **Script properties**:

- `COMMERCE_SECRET`: a newly generated random secret of at least 32 bytes, shared only with the Supabase commerce function. Never put it in the repository or browser.
- `TRIAL_IDENTITY_SECRET`: a separate random secret of at least 32 bytes, also shared with the commerce function. Keep it stable: existing email/browser/IP/payer hashes depend on it. Rotating the request-signing secret does not change these hashes. Changing this identity secret requires a deliberate history migration; do not reset trial history by rotating it casually.
- `PAYPAL_WEBHOOK_ID`: the ID of the webhook created in step 4, for the same sandbox/live mode as `PAYPAL_MODE` and the site's client ID.
- `COMMERCE_ENFORCE_FROM`: a fixed ISO date/time when this enforcement starts, for example the actual activation time. Preserve it on later deployments. Existing subscriptions before this time are not cancelled merely because they predate checkout records.
- `COMMERCE_ENABLED=false` until setup and sandbox validation are complete.

Deploy with **Deploy → Manage deployments → Edit → New version → Deploy**. Preserve the existing execution/access settings and URL. Anonymous visitors can request registration codes; only a verified code creates a row in `Accounts`. The original download contact list is not proof of registration. Existing `Orders` emails can still sign in and get an account row after verifying their code.

## 3. Deploy the Supabase functions

Deploy `commerce`, the updated `paypal-config`, and the updated `storefront` if that older function is deployed; retain existing `activate` and other functions. The legacy storefront download route now returns 410 and cannot bypass registration, even with a valid CAPTCHA token. `verify_jwt=false` is intentional: the commerce function validates the site's signed account sessions through Apps Script. Supabase JWTs are not this authentication system.

Configure private function settings:

- The same `COMMERCE_SECRET` and `TRIAL_IDENTITY_SECRET` as Apps Script.
- `SHEET_WEB_APP_URL`: the existing Apps Script `/exec` URL configured in `js/site-config.js`.
- `ALLOWED_ORIGINS=https://imajoy.github.io` (add only exact development origins actually needed).
- `INSTALLER_BUCKET=installers`, `INSTALLER_OBJECT=AjoyTools_Setup.py`.
- `COMMERCE_ENABLED=false` initially.
- Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; confirm that they are available only on the server.

### Establish a trustworthy client IP

`COMMERCE_CLIENT_IP_HEADER` must be either `cf-connecting-ip` or `x-real-ip`, **only after verifying that your actual ingress strips and overwrites that header with the network client's IP**. Do not trust a caller-provided forwarding header. The implementation deliberately does not fall back to the first value of arbitrary `X-Forwarded-For`.

Test the deployed route with normal and spoofed headers and confirm the ingress behavior before enabling trials. If neither supported header can be established as trustworthy in your Supabase deployment, keep this setting unset and the trial disabled until a trusted ingress supplies one. Do not set a header name just to make the eligibility UI green. The server cannot verify location for checkout without this network configuration. Downloads and email registration do not require IP eligibility.

The server hashes the observed IP and browser identifier before forwarding them. Raw addresses are not stored in trial records. Location lookup uses the same `api.country.is` provider already used by the site. The server, not a browser-supplied country or price, chooses its configured PayPal plan. Public `paypal-config` now returns plan availability flags rather than actual plan IDs.

## 4. Configure and validate PayPal webhooks

Create a PayPal webhook on the same REST app and mode:

`https://wsadhewcmpdhojgqzstw.supabase.co/functions/v1/commerce/paypal-webhook`

Subscribe to subscription activation/update/cancellation/suspension/expiration and payment sale completion/refund/reversal events. Save its ID in Apps Script. Apps Script verifies each event through PayPal's signature-verification endpoint before processing it. A browser approval callback alone never grants access.

Run `backfillTrialHistory()` from the Apps Script editor **before enabling the new flow**, in each applicable mode. It imports historical trial emails and server-verified payer IDs from the existing `Orders` tab into `Checkouts`. Resolve failed lookups rather than ignoring them. Orders missing from the Sheet must be reconciled from PayPal's verified history before claiming comprehensive enforcement of past trials. Old browser/IP identifiers cannot be reconstructed.

Use sandbox accounts to test all of these before switching live:

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
