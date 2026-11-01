import {handleMayaStatus} from './handler.js';
Deno.serve((request: Request) => handleMayaStatus(request,(key: string) => Deno.env.get(key)));
