import test from 'node:test';
import assert from 'node:assert/strict';
import {canShowGuestPrompt,PROMO_COOLDOWN} from '../js/promotion-policy.js';
const now=Date.now();
test('guest account invitation uses a random sample, session cap and seven-day cooldown',()=>{
 const eligible={now,random:.1};assert.equal(canShowGuestPrompt(eligible),true);
 for(const override of [{random:.9},{random:.3},{signedIn:true},{sessionSeen:true},{busy:true},{visible:false},{lastShown:now-1000},{lastShown:now+1000}])assert.equal(canShowGuestPrompt({...eligible,...override}),false);
 assert.equal(canShowGuestPrompt({...eligible,lastShown:now-PROMO_COOLDOWN}),true);
});
