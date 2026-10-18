# Deploy registration, protected checkout and one-time trials

The site stores account and order records in your existing Google Sheet. New emails can register by verification code before buying or downloading; they do not need an existing subscription. Existing subscribers keep email-code sign-in. Accounts are created only after the correct code is verified.

Deploy **all three files: `Code.gs`, `Commerce.gs` and `Loyalty.gs`** in the existing Apps Script project, preserving the current web app URL. In Apps Script choose **Deploy → Manage deployments → Edit → New version → Deploy**. A GitHub push does not update this deployment.

The full activation instructions, private settings, installer upload, PayPal webhook, historical import, sandbox checks and known device/card limits are in [supabase/COMMERCE.md](../supabase/COMMERCE.md). Complete them before enabling `COMMERCE_ENABLED` in Apps Script and Supabase. Do not run `setupPlans()` again just to deploy this update.

The new tabs are `Accounts` (verified emails) and `Checkouts` (reservations and consumed-trial records). Existing `Orders`, `Plans` and contact tabs remain. An existing contact-list email must still verify before registration. Do not delete used-trial records: cancellations and refunds do not reset trial eligibility.

The old public `order` and manual `trial` endpoints no longer create records or grant access. Checkout is created on the server, bound to the verified email and confirmed through PayPal. An already approved subscription ID is not proof that a visitor owns its account.

No secret keys belong in repository files or chat. Set them in Apps Script properties and Supabase's private function settings. Do not publish the Sheet or deploy another web app URL unless you also deliberately update the site's configuration.

## Returning subscriber rewards

The active PayPal checkout now uses `Loyalty.gs`, not the separate Supabase storefront loyalty tables. No new secret or `setupPlans()` run is needed. Deploy all three Apps Script files above and deploy the updated Supabase `commerce` function. Keep the existing web app URL and current properties.

See [reward activation and checks](../supabase/COMMERCE.md#returning-subscriber-rewards) for the exact command and rules. Until the updated servers are deployed, checkout explicitly says no loyalty reward is applied and retains standard payments.
