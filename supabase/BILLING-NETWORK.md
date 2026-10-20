# Server billing country and VPN checks

The country field is filled from the server and locked for ordinary visitors. Only a **verified full account session** for `contactmy3dart@gmail.com` can select a different country after activation. Typing that email or editing browser storage does not grant the exception. The exception bypasses network checks only; provider country restrictions, trial limits and payment verification still apply.

## Activation status

Publishing the website does **not** activate VPN blocking. This feature needs the updated Apps Script, three updated Edge Functions, a verified ingress IP header and a private reputation API key. Until the public server configuration advertises activation, the website uses its server-detected country without claiming to check VPNs. Existing payment configuration is preserved.

## 1. Get a reputation API key

Create an account at [ProxyCheck.io](https://proxycheck.io/) and obtain an API key. Check their current request quota and pricing. The integration uses their v2 API with VPN detection enabled. Never put the key in GitHub, browser JavaScript, a screenshot or chat.

This integration has automated fixture coverage, but the actual service response and your account quota must be checked during activation. VPN/proxy detection is probabilistic: it can miss connections and incorrectly flag others. It does not establish residence or stop every regional-pricing workaround.

## 2. Update Apps Script

In your existing Apps Script project, update `Commerce.gs` and `Razorpay.gs`, and add the new `Billing.gs` from this repository. Keep the existing `Code.gs`, `Loyalty.gs`, `Passkeys.gs` and other modules.

In **Project settings → Script properties**, add:

| Name | Initial value |
| --- | --- |
| `BILLING_POLICY_ENABLED` | `false` |

Deploy a new version through **Deploy → Manage deployments → Edit → New version → Deploy**, preserving the existing web-app URL.

## 3. Add Supabase secrets

In **Supabase → Edge Functions → Secrets**, save:

| Name | Value |
| --- | --- |
| `BILLING_POLICY_ENABLED` | `false` initially |
| `BILLING_VPN_API_KEY` | Your private ProxyCheck.io API key |

Keep your existing `COMMERCE_CLIENT_IP_HEADER` only if the deployment ingress has been verified to overwrite it with the visitor's actual IP. Supported values are `cf-connecting-ip` or `x-real-ip`. Do not trust browser-supplied `X-Forwarded-For`, guess the header, or reuse an inconclusive network-check result. Missing/untrusted IPs cannot safely be used for this feature. Do not duplicate account session signing secrets into Supabase.

## 4. Deploy the updated functions

From your updated local repository in PowerShell, run each command:

```powershell
npx.cmd supabase@latest functions deploy commerce --project-ref wsadhewcmpdhojgqzstw --use-api --no-verify-jwt
npx.cmd supabase@latest functions deploy paypal-config --project-ref wsadhewcmpdhojgqzstw --use-api --no-verify-jwt
npx.cmd supabase@latest functions deploy razorpay --project-ref wsadhewcmpdhojgqzstw --use-api --no-verify-jwt
```

The existing signed account and private RPC checks remain required; disabling gateway JWT verification does not give anonymous users payment access. Deploying Razorpay does not activate the payment provider.

## 5. Enable and verify

After all deployments are complete, change the Apps Script property `BILLING_POLICY_ENABLED` to `true`, then immediately change the Supabase secret of the same name to `true`. Billing may briefly pause between these changes because missing network verification fails closed. Choose a quiet period. Do not enable one side and leave the other unconfigured.

Check in a fresh browser session:

- Logged out or an ordinary verified account, VPN off: detected country is filled and cannot be edited. Confirm it matches the actual public connection country.
- VPN on: a connection classified by ProxyCheck.io as VPN/proxy blocks the billing form and asks you to turn it off and retry. An undetected VPN cannot be guaranteed to block.
- Retry with VPN off: billing returns after a fresh successful check. A valid result may be cached for up to 60 seconds per public IP.
- Sign in as `contactmy3dart@gmail.com`: country editing works and a flagged connection does not block testing. Signing out restores the restriction.
- Use an ordinary account and attempt a modified request with another country: server rejects it, even if both countries share the same price tier.
- Missing key, quota, timeout or failed lookup: billing stays blocked with a **network-check unavailable** message; it does not falsely claim the user uses a VPN.
- Registration, login, downloads, contact, payment confirmations and payment webhooks remain available. Existing subscriptions can still reconcile.

Do not perform a real charge just to test the gate. Validate provider checkout separately using your established test process. If protection fails after activation, pause new checkout and correct the configuration; do not silently treat failed checks as clear.

Only the connection IP is sent to ProxyCheck.io. The signed billing request to Apps Script contains the country and reputation status, not the raw IP or API key. Existing trial identity hashing is unchanged. The privacy notice discloses the optional processor and provides a support route for incorrect classifications.
