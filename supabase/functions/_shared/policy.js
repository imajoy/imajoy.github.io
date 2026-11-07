/* Limits and required settings per function, in one place so they can be tested. */
export const ORIGIN_LIST = (env) => (env('ALLOWED_ORIGINS') || 'https://imajoy.github.io').split(',').map((s) => s.trim()).filter(Boolean);
const MIN = 60000;
const secret = (name) => ({ name, min: 32 });
const scriptUrl = { name: 'SHEET_WEB_APP_URL', pattern: /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/ };
export const COMMERCE_REQUIRED = [secret('COMMERCE_SECRET'), secret('TRIAL_IDENTITY_SECRET'), scriptUrl];
export const RAZORPAY_REQUIRED = [secret('COMMERCE_SECRET'), scriptUrl];
export const MAYA_REQUIRED = [secret('COMMERCE_SECRET'), scriptUrl, { name: 'SUPABASE_SERVICE_ROLE_KEY' }];
/* Webhooks are signature checked and come from the payment providers, so they are not limited by address. */
const notWebhook = (path) => path !== 'webhook' && path !== 'paypal-webhook';
export const COMMERCE_LIMITS = [
  { match: (p) => ['checkout', 'confirm', 'download', 'rewards'].includes(p), limit: 10, windowMs: MIN },
  { match: (p) => notWebhook(p), limit: 60, windowMs: MIN },
];
export const RAZORPAY_LIMITS = [
  { match: (p) => ['checkout', 'confirm', 'cancel', 'stop'].includes(p), limit: 10, windowMs: MIN },
  { match: (p) => notWebhook(p), limit: 60, windowMs: MIN },
];
export const STOREFRONT_LIMITS = [{ match: () => true, limit: 60, windowMs: MIN }];
export const MAYA_LIMITS = [{ match: () => true, limit: 20, windowMs: MIN }];
export const PUBLIC_LIMITS = [{ match: () => true, limit: 60, windowMs: MIN }];
