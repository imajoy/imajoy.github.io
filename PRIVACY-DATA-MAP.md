# Personal data map (audit of 2026-11-08)

Static site on GitHub Pages. No analytics, error-tracking, advertising or AI services are used anywhere. No passwords exist: people sign in with a 6-digit emailed code (and optional passkeys).

## 1. What is collected, where it goes, where it is stored

| Data | Collected at | Travels to | Stored in | Retention / deletion |
|---|---|---|---|---|
| Email | Sign-in, checkout, contact, review, download | Apps Script (HTTPS) | Google Sheet: `Accounts`, `Orders`, `Payments`, `Reviews`, `Contacts`, `Trials`, `Passkeys`, invoices | **Self-service delete** (Account > Delete my account and data) |
| Name, company, city, region, postal code | Checkout / invoices, contact, review nickname | Apps Script; PayPal or Razorpay only if they ask for it | Same Sheet tabs (`Orders`, invoices, `Contacts`, `Reviews`) | Blanked on delete; payment amounts and dates kept for accounting |
| Contact message and optional attachment | Contact form | Apps Script, then a **private** GitHub repository | `Contacts` tab and private GitHub repo | Row deleted on account deletion; files in GitHub history need manual removal (apps-script/README.md) |
| Payment details (card, bank, UPI) | Only on PayPal / Razorpay pages | Never reach this site | PayPal / Razorpay | Their policies. This site keeps only ids, amounts, status, country |
| IP address | Every request to the Supabase functions | Hashed with a secret key (`ipHash`) for trial-abuse checks. Optionally sent to proxycheck.io if VPN checks are turned on (off by default). country.is / GeoJS get it for country lookup. | Only the hash is stored | Not reversible |
| Country | Checkout, price display | Supabase edge function | Orders tab (country code) | Kept with the order |
| Browser id (random UUID) | First checkout | Supabase function (hashed for trial checks) | Browser `localStorage` (`ajoy.browser`) | Cleared on account deletion |
| Session token (embeds email, 30 days, signed) | Sign-in | Sent only to the Apps Script endpoint | Browser `localStorage` (`ajoy.acct`) | Sign out, or account deletion, clears it and the server then rejects it |
| Billing draft (name, address while checking out) | Checkout page | Not sent until submitted | Browser `sessionStorage`, 30 minutes, cleared after payment | Cleared on tab close |
| Receipt copy (name, company, address) | Checkout page | Not sent anywhere | Browser `sessionStorage`, 2 hours, same tab only (`js/receipt-billing.js`) | Cleared on tab close |
| Billing address on the order and invoice | Checkout request to the commerce / razorpay functions, then Apps Script | Checkouts / RazorpayCheckouts (JSON) and Invoices tab; printed on the invoice email | Kept for accounting; blanked by account deletion (`eraseJson_`, `Billed to`, `Company`, `Billing address` columns) | Order ID (ORD-xxxxxxxx) stays: random, not personal |
| Theme, promo-seen flags | Site | Nowhere | `localStorage` | No personal data |
| Device info | Not collected | | | |
| Date of birth, phone number, passwords | Not collected | | | |

## 2. Third parties and exactly what they receive

| Service | Data sent | Why |
|---|---|---|
| PayPal | What PayPal itself collects at checkout; the site passes the plan id | Subscriptions and coffee donations |
| Razorpay | Email and name (prefill), plan, quantity | India / international subscriptions |
| Google Apps Script and Sheets | Everything in section 1 except payment details | Accounts and orders backend |
| GitHub (private repo) | Contact form content and attachments | Support inbox |
| country.is, GeoJS | The visitor's IP address (country lookup, only when the edge lookup fails) | Local pricing |
| proxycheck.io | IP address (only if `BILLING_VPN_ENABLED=true`) | VPN check |
| exchangerate-api / open.er-api | Nothing personal (currency codes only) | Price estimates |

## 3. What was fixed in this audit
- Added **Delete my account and data** (button in the account dialog, `step:'erase'` in `apps-script/AccountDeletion.gs`). It needs a valid session **and** a fresh emailed code, auto-submits on the 6th digit, refuses while a subscription is active or has access left, deletes rows in `Accounts`, `Trials`, `Contacts`, `Reviews`, `Passkeys`, anonymizes every other tab, clears local storage and emails a confirmation. Covered by `tests/account-deletion.test.mjs`.
- Removed the owner email from an Apps Script log line.
- Privacy page now describes self-service deletion.

## 4. Known limits (decide if you want more)
- The session token (which contains the email) lives in `localStorage` so the 30-day sign-in survives restarts. A static site cannot set an httpOnly cookie for another domain. A strict Content-Security-Policy would reduce XSS risk further but needs testing against the PayPal and Razorpay scripts.
- Sign-in codes come from Apps Script's secure random source; single-use, 2 minutes, 5 tries, rate-limited. Sign out and account deletion revoke the session token on the server.
- Trial and coupon limits treat `name+tag@` and Gmail dots as one mailbox.
- If you ever turn on `BILLING_VPN_ENABLED`, add proxycheck.io back to privacy.html first (it was removed because it is off).
- Messages sent to the private GitHub repo stay in its git history until you rewrite history.
