# Billing country and the testing-account exception

**VPN protection is disabled by default.** Country detection, locking and the verified testing-account exception work independently. No ProxyCheck.io account or API key is needed for these country features.

Only a verified full account session for **contactmy3dart@gmail.com** can edit the country. A typed email, cached account label or browser claim cannot authorize editing. Ordinary visitors see the detected country without a dropdown arrow. Provider availability, trial limits, subscription ownership and payment verification still apply to the tester.

## Deploy the country-edit fix

A GitHub push updates the website, but cannot update your private Apps Script or Supabase functions. The old public server does not advertise account-country permissions, so the old deployment leaves every account locked.

1. In your existing Apps Script project, replace **Billing.gs**, **Commerce.gs** and **Razorpay.gs** with their current repository versions. Add Billing.gs if missing. Keep Code.gs, Loyalty.gs, Passkeys.gs and all existing properties.
2. Choose **Deploy → Manage deployments → Edit → New version → Deploy**, keeping the same web-app URL.
3. From your updated local checkout, deploy these functions:

```powershell
npx.cmd supabase@latest functions deploy commerce --project-ref wsadhewcmpdhojgqzstw --use-api --no-verify-jwt
npx.cmd supabase@latest functions deploy paypal-config --project-ref wsadhewcmpdhojgqzstw --use-api --no-verify-jwt
npx.cmd supabase@latest functions deploy razorpay --project-ref wsadhewcmpdhojgqzstw --use-api --no-verify-jwt
```

4. Leave **BILLING_VPN_ENABLED** unset or set it to **false** in Supabase secrets. The old BILLING_POLICY_ENABLED setting is no longer needed to unlock the tester account. Do not enable VPN checks to fix country editing.
5. Hard-refresh checkout, then sign in as contactmy3dart@gmail.com. After the server confirms the account, the country dropdown becomes editable. Signing out locks it again. Subscription-status updates for the same session no longer restart location verification.

Your existing verified **COMMERCE_CLIENT_IP_HEADER** remains necessary to locate ordinary visitors. Supported values are cf-connecting-ip or x-real-ip only after verifying that your ingress overwrites the header with the actual visitor IP. Never use arbitrary X-Forwarded-For or guess a header to bypass a failed check. Unknown country blocks ordinary checkout; the verified tester may still choose one.

Deploy Apps Script before the Edge Functions. Updated signed gateways always supply the authoritative country context. Missing protection modules reject billing rather than silently bypassing country restrictions. Existing payment confirmations, webhooks, downloads, contact and registration do not use this billing gate. Deploying Razorpay does not activate that payment provider.

## Optional VPN protection — leave off for now

If requested later, create an account at [ProxyCheck.io](https://proxycheck.io/), review their quota/pricing and save its private key only as the Supabase secret **BILLING_VPN_API_KEY**. Enable **BILLING_VPN_ENABLED=true** only after validating the real service and trusted ingress configuration. The integration uses the v2 API with VPN detection enabled. Never share the key in chat, frontend code or GitHub.

When enabled, flagged VPN/proxy connections block new billing for ordinary accounts. Failed checks, timeouts, missing keys or quota failures block with a distinct unavailable message. The verified tester remains exempt. Valid reputation results are cached for at most 60 seconds. Detection is imperfect and cannot establish residence or catch every VPN; support must handle incorrect classifications.

Only the IP is sent to the reputation provider. The signed Apps Script request receives country and network-check status, not the raw IP or provider key. Existing trial identity hashing is unchanged. Automated tests use local fixtures and never create real charges or send real verification emails.
