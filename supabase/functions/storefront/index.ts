import { handleRequest } from './handler.js';
Deno.serve((request: Request) => handleRequest(request));
