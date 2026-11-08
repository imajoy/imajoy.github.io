# Current account checkout and download flow

See [COMMERCE.md](COMMERCE.md) for the active registration, server-managed PayPal checkout, one-time trial ledger and private downloads. The public installer was removed from the served tree; upload the preserved original to private storage.

Functions in this project: `commerce`, `razorpay`, `paypal-config`, `maya-status`, `network-check` and `activate` (Wrapline Pro licence check for Maya). The old `storefront` pricing/loyalty service and the `passkeys` function were removed; delete them in Supabase (Edge Functions) if they are still listed there.

Storage setup, trial history, trusted network configuration and PayPal deployment instructions are all in [COMMERCE.md](COMMERCE.md).

`node --test tests/*.test.mjs` runs the test suite.
