# Current account checkout and download flow

See [COMMERCE.md](COMMERCE.md) for the active registration, server-managed PayPal checkout, one-time trial ledger and private downloads. The public installer was removed from the served tree; upload the preserved original to private storage. The storefront notes below describe the earlier, separate pricing/coupon service and must not be treated as activation instructions for the new PayPal flow.

# Legacy storefront pricing and coupon service

The remaining notes describe the separate `storefront` quote/coupon/loyalty service, not the active Apps Script account and PayPal flow. `apiBase` remains empty. Its checkout stays disabled. Its old download route is permanently closed; deploy the updated function if an older version is running. Private downloads belong only to the authenticated `commerce` gateway described in [COMMERCE.md](COMMERCE.md).

Do not replace the existing Maya `activate` function. Storage setup, trial history, trusted network configuration and PayPal deployment instructions are all in [COMMERCE.md](COMMERCE.md).

## Pricing

Server catalog: `functions/_shared/catalog.js`. Prices are per computer. Online monthly tiers are INR 899 (IN/PK/BD/NP/LK), 1299 (selected middle markets), and 1999 (other markets). Annual billing gives 20% off twelve monthly charges; the lowest-region Online annual total is INR 8,630.40 (INR 719.20/month), above the INR 699 floor. Offline is provisionally 2× Online, matching the existing two-plan relationship; confirm this business rule before accepting money.

The owner expressly permits the **one-time yearly loyalty renewal** to go below the normal floor: an additional 10% off INR 8,630.40 is INR 7,767.36 before tax (INR 647.28/month equivalent). This is a loyalty exception, not a change to base catalog or coupon price-floor validation.

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

`node --test tests/*.test.mjs` exercises regional price bounds, forged amounts, seats, CORS, disabled checkout, and rejection of the legacy download route even with a human-check token. Authenticated downloads and account registration are covered by the commerce tests with mocked external services. Browser tests must distinguish mocked success flows from a real Supabase/Turnstile deployment.

## Coupon validation

`POST /coupon` calculates the order on the server and checks a hashed coupon allowlist from the server-only `COUPONS_JSON` setting. It validates expiry, plan, billing, countries, optional computer count limit, and the minimum price. One coupon can apply to a new quote; it is revalidated when the selection changes. There is no public coupon-generation or administration endpoint, and no active codes or registry are bundled in the frontend. Invalid or unavailable validation never produces a pretend discount.

The future merchant integration must revalidate the coupon and current pricing before creating checkout, and include verified discounts in payment/invoice data. Usage-count or one-time-use campaigns require an atomic database redemption ledger; the current allowlist does not promise usage caps. Deploy the updated storefront function before activating codes.

## Returning subscriber rewards

Rules live in `functions/_shared/loyalty.js`; private storage is in `migrations/202610170001_storefront_payment_history.sql`.

| Billing | Previous eligible paid periods | Reward on this payment |
| --- | --- | --- |
| Monthly | 0 | None |
| Monthly | 1 | 5%, once |
| Monthly | 2 | 5%, once |
| Monthly | 3 or more | None |
| Yearly | 0 | Standard 20% yearly saving only |
| Yearly | 1 | Extra 10% after the standard yearly saving, once (28% total versus twelve monthly payments) |
| Yearly | 2 or more | Standard yearly saving only |

Monthly and yearly histories are counted separately. Computers/seats do not advance tiers. Only confirmed, positive, full paid billing periods qualify: not a typed billing address, an attempted checkout, a client-provided count, a proration, a failed payment, a refund or a dispute. Duplicate invoices for one period count once. An already consumed reward stays consumed after a refund. There is no higher reward after these steps and no stacking with coupons: the better validated offer wins.

### Activation checklist

This implementation is **not activated** by pushing GitHub Pages. `apiBase` remains empty, no merchant is configured, and no historical payments have been imported. Do not advertise that an actual discount has been awarded until a server quote confirms it.

The checkout hides optional returning-subscriber verification until `/config` confirms `loyalty.enabled: true`. It stays hidden with no JavaScript, an unset API URL, a disabled service, or a failed configuration request. Hiding the controls does not activate verification: the server deployment and Auth setup below are still required.

1. Review and apply the new migration in the existing Supabase project. It creates only `storefront_` objects, leaving the Maya activation service alone. The new ledger has row-level security and no grants to `anon` or `authenticated`; only the server service role can link/read/write it.
2. Configure Supabase Auth email OTP, your email sender/SMTP and email rate limits. Configure **both signup and magic-link email templates** to include `{{ .Token }}` so the user receives a code. This flow can create a passwordless customer account on first verification. Set the OTP length to 6–10 digits and suitable expiry/attempt limits.
3. Enable **Turnstile CAPTCHA protection in Supabase Auth**, with a widget permitted on your website domain. Auth verifies the token when `/auth/v1/otp` is requested; do not also consume the same token with the download-verification function. Set `AUTH_TURNSTILE_SITE_KEY` to that public widget key. Apply edge/WAF limits to the storefront, and Auth's CAPTCHA/SMTP limits before enabling this publicly.
4. Confirm `SUPABASE_ANON_KEY` is the project's **public anon/publishable key**, never a secret or service-role key. Supabase normally supplies it to Edge Functions. The service rejects secret-role keys for its public auth config. Keep `SUPABASE_SERVICE_ROLE_KEY` and `QUOTE_SIGNING_SECRET` server-only.
5. Import old subscriptions from verified paid invoices/receipts, not unverified billing-form entries. Required ledger fields include provider, stable customer ID, invoice ID, billing period, period start, paid timestamp, amount in currency minor units, currency, payment status, verified source, unique event reference and event timestamp. Set `qualifying_period=true` only for a full subscription billing period; its default is false to avoid treating top-ups or prorations as renewals. Use `verification_source='verified-import'` for owner-checked receipts. Do not fabricate legacy records. Repeated imports must update the same provider/invoice row.
6. `customer_email_hash` is lowercase hexadecimal SHA-256 of the receipt email after trimming whitespace and lowercasing. Use `emailHash` from `functions/_shared/customer.js` in a private import script. Do not remove plus tags or dots or guess that different emails belong to the same person. Leave `customer_user_id` null for a verified historical import if no account exists yet; the authenticated `/customer` POST can bind it on the first matching email verification. Already bound rows cannot be claimed by another account with the same email later. Historical discounts already used must have the appropriate `loyalty_reward` recorded and linked to the correct verified account.
7. Deploy the updated `storefront` function. After Auth, CAPTCHA, schema, imports and rate limits are verified, set `LOYALTY_ENABLED=true`. Configure `js/site-config.js` with the storefront URL. This flag **does not enable payments**.
8. Test real email delivery, wrong/expired codes, verified old and new customers, email changes, quantity/country changes, unavailable history, refunds, duplicate invoices and all renewal steps. Current browser/HTTP tests use mocked Auth and payment records; they are not proof of a real deployment.

The browser sends an OTP request directly to Supabase Auth only after the user requests verification and passes its human check. Tokens stay in memory, not local storage or URLs. A successful Auth response is independently checked by the storefront's `/auth/v1/user` request before `/customer` binds imports. Each authenticated quote reads the private ledger again. Names, postal addresses, IPs, card details and client claims never establish eligibility. An expired/unconfirmed/anonymous identity cannot access loyalty history.

### Required merchant/webhook work before charging

The payment endpoint still returns 503. A future merchant adapter must recompute the complete quote and verify its signature, expiry, catalog, customer identity, current history and country before opening checkout. A signed display quote alone must not authorise a charge.

For automatic renewals, link the verified customer account to the stable provider customer/subscription ID when the subscription is established. Apply the one-time reward to the upcoming second/third monthly or second annual invoice before it is charged; no repeated browser visit or email challenge is needed for an already linked recurring subscription. Implement this with the selected provider’s renewal/invoice lifecycle, not a successful-payment redirect.

Use a transaction/advisory lock per customer plus durable idempotency/reservation records to reserve a one-time reward before creating a provider checkout. Do not permit two payable checkouts to consume the same reward; cancel/reconcile a previous provider session before releasing its reservation. Handle invoice renewal dates, current paid counts and late/out-of-order provider events. **These checkout reservations and provider webhooks are not implemented while no merchant is selected.**

Only a signature-verified webhook (or an owner-verified legacy import) may write payment history. Bind the verified provider customer/account, canonical billing period and amount; set `qualifying_period` only for eligible full recurring invoices. Store the reward code on the actual successful invoice (`monthly_second`, `monthly_third`, or `yearly_return`), never on a quote or failed attempt. Database uniqueness prevents reusing a consumed code for the same account. Update the original invoice for partial/full refunds or disputes. Fetch/reconcile current provider invoice state so delayed events cannot turn refunded invoices back into eligible payments. Keep the reward marker after a refund. Never accept this history from a browser or a payment return URL.

### Additional validation

`node --test tests/*.test.mjs` includes identity, one-time reward, floor-exception, best-offer and history-failure tests.

The PostgreSQL migration and RLS test uses a pinned embedded database installed outside the checkout:

```sh
npm install --prefix /tmp/ajoy-ledger-test --ignore-scripts --no-audit --no-fund @electric-sql/pglite@0.5.10
PGLITE_TEST_MODULE=/tmp/ajoy-ledger-test/node_modules/@electric-sql/pglite/dist/index.js node --test tests/database/loyalty.test.mjs
```
