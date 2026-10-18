import {handleNetworkCheck} from './handler.js';
Deno.serve((request: Request) => handleNetworkCheck(request));
