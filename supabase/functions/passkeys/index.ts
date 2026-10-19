// Pinned verification library; never replace WebAuthn verification with client-supplied claims.
import * as webauthn from 'npm:@simplewebauthn/server@14.0.3';
import {createPasskeyHandler} from './handler.js';
Deno.serve(createPasskeyHandler(webauthn,{env:(key:string)=>Deno.env.get(key)}));
