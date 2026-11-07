import {handleCommerceRequest} from './handler.js';
import {createBillingNetworkLookup} from '../_shared/billing-network.js';
import {assertConfig, guard} from '../_shared/guard.js';
import {COMMERCE_LIMITS, COMMERCE_REQUIRED, ORIGIN_LIST} from '../_shared/policy.js';
const env=(key:string)=>Deno.env.get(key),networkOf=createBillingNetworkLookup(fetch,env);
assertConfig('commerce',env,COMMERCE_REQUIRED);
Deno.serve(guard((request: Request) => handleCommerceRequest(request,env,fetch,networkOf),{name:'commerce',limits:COMMERCE_LIMITS,origins:()=>ORIGIN_LIST(env)}));
