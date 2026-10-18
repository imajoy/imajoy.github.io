# Deploy subscriber sign-in

GitHub Pages deploys the website files. It does **not** deploy `Code.gs` to Google Apps Script.

After updating the website, update the **existing** Apps Script deployment:

1. Open the Google Sheet used for your Ajoy Tools orders. Choose **Extensions → Apps Script**.
2. Replace the contents of `Code.gs` with this repository's `apps-script/Code.gs`, then save.
3. Choose **Deploy → Manage deployments**. Edit the existing web app deployment with the pencil button.
4. Under **Version**, choose **New version**, then **Deploy**. Preserve the existing execution/access settings and web app URL. Do not create another deployment or change the URL in `js/site-config.js`.
5. Test an email already in the `Orders` tab: enter email, receive the six-digit code, verify it, then reload. Test an unknown email: it must show **Email is not registered.** and must receive no code.

Keep existing Script properties, PayPal credentials, Orders/Plans/contact tabs and Supabase configuration unchanged. You do not need to run `setupPlans()` again for this update. No Supabase deployment is required for these sign-in changes.

## Behavior

- Registration means an email has an order in the `Orders` tab for the current PayPal mode. An email saved only in the download contact list is not a subscriber account.
- Code sending is limited to five requests per email per hour; code verification allows five attempts. A code lasts ten minutes and is consumed once under a script lock.
- Sign-in returns a signed 30-day session immediately after verifying the code. PayPal subscription details load separately. Reloads display the last confirmed summary immediately, marked as updating until refreshed. A cache is never payment authorization.
- `identity` validates the signed session and returns its canonical email without waiting for PayPal. Checkout and download email fields fill automatically and stay read-only while signed in. Sign out to change email. An expired session clears the account and unlocks the field; a network failure retains the saved display and offers retry.
- Orders carrying an account token use the email from its verified signature. A submitted email cannot override it. Invalid tokens stop order logging.
- A subscription ID and typed email cannot create a sign-in session. An already signed-in buyer keeps their existing session after checkout. A new buyer is offered email-code sign-in on returning home.

`node --test tests/account.test.mjs` checks the actual Apps Script functions using mocked Google services and PayPal responses. These tests send no emails and create no subscriptions. Browser checks likewise need mocked services or a controlled test account; passing local tests does not prove the deployed script or email delivery works.
