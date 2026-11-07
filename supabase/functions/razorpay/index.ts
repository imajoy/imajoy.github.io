import {createRazorpayHandler} from './handler.js';
import {assertConfig, guard} from '../_shared/guard.js';
import {ORIGIN_LIST, RAZORPAY_LIMITS, RAZORPAY_REQUIRED} from '../_shared/policy.js';
const env=(key:string)=>Deno.env.get(key);
assertConfig('razorpay',env,RAZORPAY_REQUIRED);
Deno.serve(guard(createRazorpayHandler({env}),{name:'razorpay',limits:RAZORPAY_LIMITS,origins:()=>ORIGIN_LIST(env)}));
