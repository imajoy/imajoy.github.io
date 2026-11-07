import {handleMayaStatus} from './handler.js';
import {assertConfig, guard} from '../_shared/guard.js';
import {MAYA_LIMITS, MAYA_REQUIRED, ORIGIN_LIST} from '../_shared/policy.js';
const env=(key:string)=>Deno.env.get(key);
assertConfig('maya-status',env,MAYA_REQUIRED);
Deno.serve(guard((request: Request) => handleMayaStatus(request,env),{name:'maya-status',limits:MAYA_LIMITS,origins:()=>ORIGIN_LIST(env)}));
