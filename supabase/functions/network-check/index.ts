import {handleNetworkCheck} from './handler.js';
import {guard} from '../_shared/guard.js';
import {PUBLIC_LIMITS} from '../_shared/policy.js';
/* Owner diagnostic. Off unless NETWORK_CHECK_ENABLED=true is set for the short time it is needed; otherwise it answers 404. */
const open=Deno.env.get('NETWORK_CHECK_ENABLED')==='true';
Deno.serve(guard((request: Request) => open?handleNetworkCheck(request):new Response('{"error":"Not found."}',{status:404,headers:{'Content-Type':'application/json'}}),{name:'network-check',limits:PUBLIC_LIMITS}));
