import {handleCommerceRequest} from './handler.js';
Deno.serve((request: Request) => handleCommerceRequest(request, (key: string) => Deno.env.get(key)));
