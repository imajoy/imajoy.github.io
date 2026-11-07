import { handleRequest } from './handler.js';
import {guard} from '../_shared/guard.js';
import {ORIGIN_LIST, STOREFRONT_LIMITS} from '../_shared/policy.js';
const env=(key:string)=>Deno.env.get(key);
Deno.serve(guard((request: Request) => handleRequest(request),{name:'storefront',limits:STOREFRONT_LIMITS,origins:()=>ORIGIN_LIST(env)}));
