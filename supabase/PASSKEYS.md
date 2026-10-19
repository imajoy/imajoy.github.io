# Activate passkey sign-in

Passkeys use the existing verified accounts and private Google Sheet. The browser creates a credential with its device/password manager; Supabase verifies the signature with pinned `@simplewebauthn/server@14.0.3`. No biometric data or private keys reach Ajoy Tools. Email codes remain available for registration, recovery and devices without passkeys.

## 1. Update the existing Apps Script deployment

In your existing spreadsheet → Extensions → Apps Script:

1. Add a **Script** file named **Passkeys** and paste [Passkeys.gs](../apps-script/Passkeys.gs).
2. Update **Commerce.gs** from [Commerce.gs](../apps-script/Commerce.gs). Keep **Code.gs**, **Loyalty.gs**, all Script properties and the existing web app URL. Use the latest Code.gs if you have not deployed the two-minute email-code update yet.
3. Deploy → Manage deployments → Edit → New version → Deploy. Retain Execute as Me / access Anyone.

The private **Passkeys** tab is created only after a verified passkey is saved. Keep it private. It holds public verification keys, opaque credential/account identifiers, names, counters and security/usage metadata. It never stores private keys, device PINs or biometrics. Removal revokes the credential; it leaves a security record.

## 2. Deploy the Supabase function

From the updated repository in PowerShell:

```powershell
npx.cmd supabase@latest functions deploy passkeys --project-ref wsadhewcmpdhojgqzstw --use-api --no-verify-jwt
```

The function reuses the existing project secrets **COMMERCE_SECRET** and **SHEET_WEB_APP_URL**. They must match the existing Apps Script project. No new secret, database migration, merchant setup or plan creation is required. Passkey sign-in also works while paid commerce is paused. `verify_jwt=false` is intentional: the function verifies WebAuthn and the site's signed account sessions, rather than Supabase Auth JWTs.

The RP ID is fixed to **imajoy.github.io** and the exact expected browser origin is **https://imajoy.github.io**. Passkeys cannot be tested on an unrelated preview domain. The function rejects other origins and user verification is required. A future custom-domain migration needs a deliberate passkey migration/re-enrollment plan.

The website probes `/passkeys/config`; controls stay hidden if either deployment is missing, the browser is unsupported, or the service cannot be reached. Email-code login keeps working. After both deployments, reload the site.

## 3. Try it

1. Sign in with your email code, open your account, and choose **Add a passkey**. Use your device's fingerprint, face, PIN or password manager. Registration and removal require a sign-in from the last ten minutes; an older remembered session first asks you to verify your email again.
2. Rename the passkey so you can recognize it. Up to five active passkeys can be registered per account.
3. Sign out. Open **Register / Login → Use a passkey** and approve the device prompt. You should sign in without an email code.
4. Cancel a prompt and confirm the email form still works. Remove the passkey and confirm that it no longer grants access. Email-code recovery remains available.

## Update an already-working deployment for faster verification

Replace only **Passkeys.gs** with the latest repository version, then **Deploy → Manage deployments → Edit → New version → Deploy**, keeping the same web app URL and properties. Run the Supabase `passkeys` deployment command above from the latest repository. Refresh the website afterwards. Existing passkeys stay valid; users do not need to enroll again.

This combines challenge consumption and credential lookup into one signed Apps Script request, reducing post-prompt verification from three sequential Apps Script requests to two. Registration verification also uses two instead of three. Signature verification, one-use/two-minute challenges, required user verification, counter updates and final account/revocation checks remain enforced. The Supabase function remains compatible with older Apps Script versions, using the separate lookup until Apps Script is updated. Google Apps Script startup and network latency can still affect total sign-in time; no fixed production speed improvement is guaranteed.

## Verification

`node --test tests/*.test.mjs` tests signed-RPC boundaries, recent-session requirements, owner-only management, one-use/expired challenges, counters and revocation. It never sends real email.

The browser integration uses native WebAuthn and a Chromium virtual authenticator with the real verifier. It checks code-free sign-in, real signature verification, wrong origin/RP/account/UV/signature rejection, replay, expiry, removal, JSON API polyfills and email fallback. All accounts/Sheet records are local test fixtures:

```sh
NPM_CONFIG_CACHE=/tmp/npm-cache npm install --prefix /tmp/ajoy-passkey-deps --ignore-scripts --no-audit --no-fund @simplewebauthn/server@14.0.3
PASSKEY_SERVER_MODULE=/tmp/ajoy-passkey-deps/node_modules/@simplewebauthn/server/esm/index.js PLAYWRIGHT_MODULE=/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright CHROMIUM_PATH=/usr/bin/chromium XDG_CONFIG_HOME=/tmp/ajoy-ui node scripts/check-passkeys.mjs http://localhost:8798/
```

Run the site's Python static server on that port first. Local browser success does not prove that production Apps Script/Supabase were deployed, or that a particular user's physical authenticator is available.
