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

## Activate the contact form

The new `/contact.html` form uses the **same private spreadsheet and existing web app URL** as account sign-in. Text-only messages need no new secret and do not send verification or marketing emails. Optional attachments use the private GitHub setup below.

1. Open your existing spreadsheet → **Extensions → Apps Script**.
2. Replace the contents of **Code.gs** with this repository’s updated [Code.gs](Code.gs). Keep **Commerce.gs**, **Loyalty.gs**, all Script properties and the existing deployment.
3. Choose **Deploy → Manage deployments → pencil/Edit → Version: New version → Deploy**. Keep **Execute as: Me** and access **Anyone**. A GitHub push alone does not publish Apps Script.
4. Open your site’s **Contact** page and send one test message. The **Contacts** tab is created automatically in the same spreadsheet. Confirm the row contains your message and the reference shown on the page. Reply manually to the address in the Email column and update Status as needed.

Columns: Received at, Reference, Name, Email, Topic, Message, Status, Privacy consent, Private attachment, Attachment name, Attachment type, Attachment bytes. Keep this spreadsheet private; do not publish it or share a public edit link. Contact submissions do not create an account or enrol visitors in marketing. The website confirms success only after the service returns a saved-message reference. Until you redeploy, visitors receive an honest retry message and their form text stays intact.

The endpoint validates field lengths, topics and consent, rejects the hidden spam field, escapes spreadsheet formulas and limits submissions (three attempts per email per hour, 200 site-wide per UTC day). Retries with the same request ID reuse a receipt for six hours. This is basic abuse protection, not a claim of a verified human identity.


## Activate private contact attachments

The selected repository is **`imajoy/Ajoy-Tools-Contact-Details`**, separate from the public website. Files go to **`contact-details/<request-id>/attachment.<extension>`**; the Contacts row contains the private file link. The website does not receive a GitHub token or a public download URL.

1. In GitHub create **Ajoy-Tools-Contact-Details** under **imajoy**, choose **Private**, and keep it private. If you already created it, use that repository’s exact `owner/name` below. A README is optional; the first successful attachment can initialise an empty repository.
2. In GitHub → **Settings → Developer settings → Personal access tokens → Fine-grained tokens**, generate a token limited to this repository. Grant **Repository permissions → Contents: Read and write**; Metadata read access is included automatically. Choose an expiry and renew the token before it expires. Do not use the public website repo or grant access to every repo.
3. In your existing Apps Script project → **Project settings → Script properties**, add:

   | Name | Value |
   | --- | --- |
   | `CONTACT_GITHUB_REPO` | `imajoy/Ajoy-Tools-Contact-Details` |
   | `CONTACT_GITHUB_TOKEN` | Your fine-grained token, entered only in this private setting |

4. Replace **Code.gs** with the updated repository file. Keep **Commerce.gs**, **Loyalty.gs**, other properties and the same web app URL. **Deploy → Manage deployments → Edit → New version → Deploy**.
5. As a guest, send a small PNG from `/contact.html`. Check its Contacts row and private GitHub link while signed into your GitHub account. Repeat with a short MP4 if needed. Sending a message must not create an Accounts row or send an OTP.

The form accepts one optional PNG, JPEG, GIF, MP4 or MOV, **5 MB maximum per file** (5 × 1,024 × 1,024 bytes). Both client and server check the extension, size, MIME type and file signature. Files are uploaded only after Send, not when selected. The server rechecks repository privacy before every upload and refuses public repositories. Uploads release the shared script lock while calling GitHub so they do not block registration and commerce. Messages without attachments continue to work if attachment storage is unconfigured. Failed uploads keep the draft and selection in the browser and never receive a false success confirmation.

GitHub retains file versions in Git history. Deleting a current file alone does not erase older versions; use GitHub’s supported history-cleanup procedures when a deletion request requires it, and review provider backup retention. Keep the contact spreadsheet and repository private.

## Unified Register / Login and two-minute codes

Deploy the latest Code.gs to activate automatic email detection (`intent: auto`) for the single Register / Login entry. Existing addresses sign in after email ownership verification; unknown addresses receive a registration code and are created only when it is verified. Both use a server-enforced two-minute deadline and single-use codes. Resending replaces the old code; the existing hourly send and wrong-attempt limits remain. Signed session tokens still restore an existing verified session without requesting a new code. Entering a registered email alone never grants access to subscriptions or checkout.

Update Code.gs, preserve the other files/properties and web app URL, then Deploy → Manage deployments → Edit → New version → Deploy. GitHub publication does not deploy Apps Script. Older deployments retain their previous ten-minute code lifetime until updated; the compatible frontend shows that older lifetime rather than falsely claiming a two-minute server deadline.
