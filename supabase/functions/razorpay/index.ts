import {createRazorpayHandler} from './handler.js';
Deno.serve(createRazorpayHandler({env:(key:string)=>Deno.env.get(key)}));
