# Activate Razorpay beside Live PayPal

GitHub publication does not activate a merchant account or deploy the server. PayPal keeps its existing settings. Razorpay stays hidden until explicitly enabled and configured.

Visitors in any country can open the billing page and review the displayed plan and form. If no configured provider supports the selection, both payment controls stay hidden and the page offers local billing review only. Review does not submit personal details, create a subscription or reserve a payment. This does not change provider-country restrictions or activate Razorpay.

## Scope and pricing

- Paid recurring Online/Offline subscriptions, monthly/yearly, 1–100 licenses. All Razorpay charges are **INR**, including approved international buyers. PayPal remains USD.
- India: Online ₹899/month or ₹8,630.40/year; Offline ₹1,798/month or ₹17,260.80/year, per license. Other approved countries use regional Online monthly prices ₹899/₹1,399/₹1,999; Offline is twice that. Annual pricing is twelve months less 20%. Review the amounts in `razorpayPrice_` before creating Live plans.
- Razorpay subscriptions authorize up to 100 monthly or 10 annual charges, then stop. Review the schedule on hosted checkout. Owner license delivery remains manual with confirmation/reminder emails; Maya's activation service is unchanged.
- The **2-day trial, coupons and returning-subscriber promotional schedules remain PayPal-only**. Razorpay offers paid plans with the yearly saving, without pretending to redeem PayPal promotions. Razorpay receipts do not advance PayPal loyalty rewards.
- The server requires a matching plan, quantity, checkout note, INR invoice and captured payment before recording paid access. Subscription activation or browser approval alone is not a receipt. No card details enter the website or Sheet.

## 1. Confirm account capabilities

In Razorpay confirm KYC/Live activation and **Subscriptions**, including the recurring methods you plan to accept. An active payments account alone does not prove recurring-payment eligibility. Use Test mode first.

For international buyers, separately confirm **International Payments for Subscriptions**, INR charging and allowed buyer countries for your particular business. General card/currency support is insufficient. Until confirmed, keep the allowlist **IN only**. Existing tax/restricted-country closures remain enforced even where a provider can technically process payments.

## 2. Apps Script

In the existing private Sheet → Extensions → Apps Script:

1. Add a Script file named **Razorpay**, copying [Razorpay.gs](../apps-script/Razorpay.gs).
2. Replace **Code.gs** and **Commerce.gs** with the repository versions. Preserve **Loyalty.gs**, **Passkeys.gs**, existing properties and the web app URL.
3. In Project Settings → Script properties add:

| Property | Initial value |
| --- | --- |
| `RAZORPAY_ENABLED` | `false` |
| `RAZORPAY_MODE` | `test` |
| `RAZORPAY_KEY_ID` | Matching `rzp_test_…` key ID |
| `RAZORPAY_KEY_SECRET` | Its private key secret |
| `RAZORPAY_WEBHOOK_SECRET` | Separate random webhook secret, at least 16 characters |
| `RAZORPAY_ALLOWED_COUNTRIES` | `IN` |

Never paste keys into code, chat or screenshots. Keep **PAYPAL_MODE=live**, all PayPal settings and existing signing secrets unchanged. **COMMERCE_ENABLED=true** stays enabled on your working system; **RAZORPAY_ENABLED=false** gates only the new provider.

4. Run **setupRazorpayPlans** once. It creates 16 plans and privately saves `RAZORPAY_PLANS_test`. It creates no customer subscription, sends no email and charges no one. If interrupted, rerun it; saved plan IDs are reused.
5. Deploy → Manage deployments → Edit → New version → Deploy. Retain Execute as Me / access Anyone / the same URL.

## 3. Supabase

From the latest repository, PowerShell:

```powershell
npx.cmd supabase@latest functions deploy razorpay --project-ref wsadhewcmpdhojgqzstw --use-api --no-verify-jwt
```

The new gateway reuses `COMMERCE_SECRET`, `SHEET_WEB_APP_URL`, `ALLOWED_ORIGINS`, `COMMERCE_ENABLED` and the verified `COMMERCE_CLIENT_IP_HEADER`. Razorpay credentials stay in Apps Script. Set Supabase **RAZORPAY_MODE=test**. Existing PayPal functions need no redeployment for this addition.

Unknown or untrusted IP geography blocks checkout. Use [the existing network verification process](COMMERCE.md#establish-a-trustworthy-client-ip); never configure an arbitrary forwarding header to force eligibility. Billing country must match the trusted connection country. Browser estimates control display only.

For owner testing, optional Supabase **RAZORPAY_SANDBOX_COUNTRY=IN** is honored only when its `RAZORPAY_MODE=test`. Apps Script independently rejects simulation unless its own `RAZORPAY_MODE=test`. This does not change PayPal's Live country/mode.

## 4. Razorpay Test webhook

Use this URL in Razorpay's Test webhook settings:

```text
https://wsadhewcmpdhojgqzstw.supabase.co/functions/v1/razorpay/webhook
```

Use the exact same secret as Apps Script **RAZORPAY_WEBHOOK_SECRET**. Select:

- `subscription.authenticated`, `subscription.activated`, `subscription.charged`
- `subscription.pending`, `subscription.halted`, `subscription.cancelled`, `subscription.completed`
- `subscription.paused`, `subscription.resumed`
- `payment.captured`, `payment.failed`, `refund.processed`

These are Razorpay events, not PayPal `PAYMENT.SALE` events. The original webhook body is preserved for HMAC verification. Leave the PayPal webhook unchanged.

## 5. Enable and validate Test checkout

After Subscriptions is confirmed available, plans exist and the Test webhook is saved, set Apps Script **RAZORPAY_ENABLED=true**. Reload the website. Configuration checks matching-mode keys, webhook-secret presence and all plan IDs before showing the provider.

Use Razorpay's documented Test recurring methods to check:

1. India sees Razorpay with correct INR totals, yearly saving and license quantities. PayPal stays hidden for India. An approved country supporting both gets a picker with each provider's price/currency. Closed countries see neither new option nor a way around regional restrictions.
2. Authorized, pending or failed payments produce no order/license/email. Captured payments produce one order, receipt, buyer confirmation and owner license reminder.
3. Close the browser after paying; the signed webhook still records the order. Duplicate events/confirmation do not duplicate records or emails.
4. Check a renewal, cancellation and refund. Old invoices must not extend a new unpaid period. Refunding the current receipt removes its paid-through period.
5. Reload a pending checkout and check its status. If creation timed out, the server searches recent subscriptions by checkout note; unresolved cases stop with a support message instead of creating a duplicate. Reconcile those in Razorpay before starting another subscription.
6. Check account subscription time remaining, existing PayPal checkout, registration, passkeys and downloads.

Private tabs are created as needed: **RazorpayCheckouts** (checkout/subscription state) and **RazorpayPayments** (verified receipts). The initial order also goes into **Orders**, with mode `razorpay_test` or `razorpay_live`. Keep all tabs private and preserve their history.

Setting `RAZORPAY_ENABLED=false` hides the provider and blocks new quotes/checkouts. Already-approved subscriptions can still be confirmed and their webhooks processed while credentials and `COMMERCE_ENABLED=true` remain available; hiding a payment option does not cancel a customer's provider mandate.

## 6. Switch only Razorpay to Live

1. Briefly set Apps Script **RAZORPAY_ENABLED=false**; PayPal stays on.
2. Set Apps Script **RAZORPAY_MODE=live** and matching Live key ID/secret. Preserve Test plan IDs and history.
3. Run **setupRazorpayPlans**. It creates `RAZORPAY_PLANS_live`.
4. Create the same webhook in Razorpay Live mode; put its matching webhook secret in Apps Script. A PayPal webhook ID is not a Razorpay secret.
5. Set Supabase **RAZORPAY_MODE=live** and delete `RAZORPAY_SANDBOX_COUNTRY`. Leave **PAYPAL_MODE=live** unchanged.
6. Set Apps Script **RAZORPAY_ENABLED=true**, refresh, and verify the first legitimate consenting real purchase, captured invoice, signed webhook and emails. Local tests cannot establish merchant activation or live recurring-method eligibility.

For international rollout, add only countries confirmed for your business to **RAZORPAY_ALLOWED_COUNTRIES**, for example `IN,US,CA`, after validation. There is no blanket worldwide flag. Tax/restricted-country closures still win. Where both gates allow it, customers see Razorpay and PayPal.

## Development checks

`node --test tests/*.test.mjs` exercises signatures, mode/country/price gates, ownership, captured-payment checks, recovery/idempotency, webhook duplication, renewals/refunds and existing PayPal behavior.

```sh
PLAYWRIGHT_MODULE=/path/to/playwright CHROMIUM_PATH=/path/to/chromium node scripts/check-payment-providers.mjs http://localhost:8798/
```

The browser checks India, a market with both methods, closed countries and disabled-provider fallback on mobile/desktop in light/dark. These checks use local fixtures; no real emails, payments or subscriptions are created. The official Razorpay Node SDK 2.9.6 API type references were consulted; real Test-mode validation is still required.
