# Activate the 23 October 2026 subscription catalog (v4)

Catalog `2026-10-23-v4` replaces v3. Free trial is now **4 days** (Online only).
Yearly billing is 20% off twelve monthly payments (the list price).
Follow the same four steps below (Apps Script files, `setupPlans()`, `setupRazorpayPlans()`,
new deployment). Also set the Script property `TRIAL_DAYS` to 4 if you ever set it by hand.

| Region / gateway | Online monthly | Online yearly | Offline monthly | Offline yearly |
| --- | ---: | ---: | ---: | ---: |
| High / PayPal USD | $29.99 | $287.90 | $49.92 | $479.20 |
| Mid / PayPal USD | $16.59 | $159.20 | $39.09 | $375.20 |
| Low / PayPal USD | $7.99 | $76.70 | $19.09 | $183.20 |
| India / Razorpay INR | ₹899.00 | ₹8,630.40 | ₹1,899.91 | ₹18,239.20 |

---

# Previous: 20 October 2026 subscription catalog (v3)

Website prices and authoritative server prices now use catalog `2026-10-20-v3`.
Online and Offline, monthly and yearly, increase by 2%, rounded to the currency's
minor unit. Local-currency estimates still use the same underlying USD or INR price.
The optional GST/tax ID input and the tax summary row have been removed.
No surcharge line or fee explanation is displayed.

The website deployment alone cannot change the private Apps Script or provider plans.
Complete these steps before considering the new payment prices activated:

1. Update `Code.gs`, `Commerce.gs`, `Loyalty.gs` and `Razorpay.gs` in the existing
   Apps Script project from this repository. Save all four together.
2. Check `PAYPAL_MODE` is the intended merchant mode, then run `setupPlans()`.
   It creates new standard and trial plans at the new prices, saves the active
   catalog, and archives previous plan IDs and prices for history verification.
   Copy the JSON cell in the **Plans** sheet into Supabase secret `PAYPAL_PLANS`.
3. For the currently configured Razorpay mode, run `setupRazorpayPlans()`.
   It creates new INR plans and replaces the active private catalog. It does not
   enable international countries, switch Test to Live, or create a customer
   subscription. Repeat only in other modes you actually use, with matching credentials.
4. Deploy a new version of the existing Apps Script web app (retain its URL).
   Refresh checkout and check both plans, both billing periods and a trial's
   renewal amount. Existing Supabase commerce/razorpay proxy functions need no
   redeploy for these Apps Script changes. If the optional legacy `storefront`
   function is enabled, redeploy it too because its separate quote catalog changed.

Both setup functions resume saved progress on rerun. Do not delete existing catalog
properties, history properties, checkout rows or order rows to force a rebuild.
New server checkouts refuse an outdated provider catalog rather than using old
plan IDs with a newly calculated price. If a setup run fails, rerun that function
before reopening new checkout.

Existing PayPal and Razorpay subscriptions retain their approved schedules and
prices. No provider price patch, subscriber migration, charge, cancellation or
customer email is performed by this catalog setup. Historical PayPal payments
continue to qualify at their original full-period amounts, and old trial plan IDs
remain recognized so the one-trial rule is preserved.

## Reference prices

| Region / gateway | Online monthly | Online yearly | Offline monthly | Offline yearly |
| --- | ---: | ---: | ---: | ---: |
| High / PayPal USD | $22.44 | $215.22 | $44.88 | $430.44 |
| Mid / PayPal USD | $14.28 | $136.68 | $28.56 | $274.38 |
| Low / PayPal USD | $9.18 | $87.72 | $18.36 | $176.46 |
| India / Razorpay INR | ₹916.98 | ₹8,803.01 | ₹1,833.96 | ₹17,606.02 |

The other Razorpay allowlisted regions use their existing INR tiers increased
by the same 2%; availability restrictions are unchanged.
