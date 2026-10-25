/* Display guidance only. Checkout still verifies trial eligibility on the server. */
export function subscriptionPromotion(session,now=Date.now()){
 if(!session)return {kind:'new'};
 if(!Array.isArray(session.subscriptions))return {kind:'unknown'};
 const subscriptions=session.subscriptions;
 const live=subscriptions.filter(s=>s.status!=='UNKNOWN'&&Date.parse(s.endsAt)>now);
 const current=live.find(s=>!s.trial)||live[0];
 if(current)return {kind:current.trial?'trial':'paid',subscription:current};
 if(subscriptions.some(s=>s.status==='UNKNOWN'))return {kind:'unknown'};
 return {kind:subscriptions.length?'past':'new'};
}
