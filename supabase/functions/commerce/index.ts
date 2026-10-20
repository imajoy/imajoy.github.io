import {handleCommerceRequest} from './handler.js';
import {createBillingNetworkLookup} from '../_shared/billing-network.js';
const env=(key:string)=>Deno.env.get(key),networkOf=createBillingNetworkLookup(fetch,env);
Deno.serve((request: Request) => handleCommerceRequest(request,env,fetch,networkOf));
