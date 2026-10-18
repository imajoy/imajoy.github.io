import test from 'node:test';
import assert from 'node:assert/strict';
import {canShowTrialNudge,PROMO_COOLDOWN} from '../js/promotion-policy.js';
const now=Date.UTC(2026,9,18),ready={now,elapsed:12001,scrolled:true,available:true,viewportHeight:900};
test('A trial popup waits for reading and scrolling and needs a confirmed offer',()=>{
 assert.equal(canShowTrialNudge(ready),true);
 for(const change of [{elapsed:11999},{scrolled:false},{available:false},{visible:false},{busy:true},{signedIn:true},{viewportHeight:640}])assert.equal(canShowTrialNudge({...ready,...change}),false);
});
test('Trial marketing respects dismissals across pages and visits for seven days',()=>{
 assert.equal(canShowTrialNudge({...ready,sessionSeen:true}),false);
 assert.equal(canShowTrialNudge({...ready,lastShown:now-1000}),false);
 assert.equal(canShowTrialNudge({...ready,lastShown:now-PROMO_COOLDOWN+1}),false);
 assert.equal(canShowTrialNudge({...ready,lastShown:now-PROMO_COOLDOWN}),true);
 assert.equal(canShowTrialNudge({...ready,lastShown:now+86400000}),false);
});
