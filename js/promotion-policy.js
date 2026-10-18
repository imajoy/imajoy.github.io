/* Display rules only. Trial eligibility is always enforced by the commerce server. */
export const PROMO_DELAY = 12000;
export const PROMO_COOLDOWN = 7 * 86400000;
export function canShowTrialNudge({now,lastShown=0,sessionSeen=false,elapsed=0,scrolled=false,available=false,signedIn=false,busy=false,visible=true,viewportHeight=0}) {
  return Boolean(available && !signedIn && !sessionSeen && !busy && visible && viewportHeight >= 720 && scrolled && elapsed >= PROMO_DELAY && (!lastShown || now - lastShown >= PROMO_COOLDOWN));
}
