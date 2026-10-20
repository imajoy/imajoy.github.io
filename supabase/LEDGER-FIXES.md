# Activate the payment-ledger fixes

Update `Payments.gs` and `Loyalty.gs` in the existing Apps Script project, save,
then deploy a new version of the existing web app while retaining its URL.
No plan regeneration or customer migration is needed for these two fixes.

- Ledger history now compares provider receipts with the original saved plan terms,
  license count and currency. Partial payments do not qualify as full periods.
  Historical prices and discounted introductory periods remain supported.
- Previously recorded ledger rows are checked by the new rules immediately; no
  destructive ledger reset or reimport is required. Old reward caches are bypassed.
- A cancelled or expired PayPal reward reservation is released after a targeted
  provider status check. Pending/active checkouts and provider failures remain blocked.
- Manual owner-entered payments retain the existing explicit reward override.

For the separate ₹1 Razorpay trial-check update, also copy the current `Razorpay.gs`
from this repository before deploying. Existing trial mandates retain the check
amount saved when created. The browser no longer assumes ₹1 when an older backend
omits `trialCheckPaise`; it asks the buyer to review the provider's exact amount.

After deployment, the public `/functions/v1/razorpay/config` response should contain
`trialCheckPaise: 100` for the default ₹1 check (or your configured value).
Razorpay remains in its configured mode. Switching Test to Live requires your own
matching live credentials and merchant activation; this update does not do that.

No real payments, refunds, emails, mode switches or customer cancellations are
needed to activate these ledger fixes. The regression suite uses local fixtures.
