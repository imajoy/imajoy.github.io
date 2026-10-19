import { Base64URL } from './base64url.js';
function isAuthenticatorAssertionResponse(value) {
    if (typeof value !== 'object') {
        return false;
    }
    if (value?.authenticatorData === undefined ||
        typeof value?.authenticatorData !== 'object') {
        return false;
    }
    return true;
}
function isAuthenticatorAttestationResponse(value) {
    if (typeof value !== 'object') {
        return false;
    }
    if (value?.attestationObject === undefined ||
        typeof value?.attestationObject !== 'object') {
        return false;
    }
    return true;
}
/**
 * Polyfill `PublicKeyCredential.parseCreationOptionsFromJSON`
 *
 * See https://w3c.github.io/webauthn/#sctn-parseCreationOptionsFromJSON
 */
export function parseCreationOptionsFromJSON(options) {
    const user = {
        ...options.user,
        id: Base64URL.decode(options.user.id),
    };
    const challenge = Base64URL.decode(options.challenge);
    const excludeCredentials = options.excludeCredentials?.map((cred) => {
        return {
            ...cred,
            id: Base64URL.decode(cred.id),
            transports: cred.transports,
        };
    }) ?? [];
    const toReturn = {
        ...options,
        user,
        challenge,
        excludeCredentials,
    };
    return toReturn;
}
/**
 * Polyfill `PublicKeyCredential.parseRequestOptionsFromJSON`
 *
 * See https://w3c.github.io/webauthn/#sctn-parseRequestOptionsFromJSON
 */
export function parseRequestOptionsFromJSON(options) {
    const challenge = Base64URL.decode(options.challenge);
    const allowCredentials = options.allowCredentials?.map((cred) => {
        return {
            ...cred,
            id: Base64URL.decode(cred.id),
            transports: cred.transports,
        };
    }) ?? [];
    const toReturn = {
        ...options,
        allowCredentials,
        challenge,
    };
    return toReturn;
}
/**
 * Polyfill `PublicKeyCredential.prototype.toJSON`
 *
 * See https://w3c.github.io/webauthn/#dom-publickeycredential-tojson
 */
export function toJSON() {
    try {
        const id = this.id;
        const rawId = Base64URL.encode(this.rawId);
        const authenticatorAttachment = this.authenticatorAttachment;
        const clientExtensionResults = {};
        const type = this.type;
        // This is authentication.
        if (isAuthenticatorAssertionResponse(this.response)) {
            return {
                id,
                rawId,
                response: {
                    authenticatorData: Base64URL.encode(this.response.authenticatorData),
                    clientDataJSON: Base64URL.encode(this.response.clientDataJSON),
                    signature: Base64URL.encode(this.response.signature),
                    userHandle: this.response.userHandle
                        ? Base64URL.encode(this.response.userHandle)
                        : undefined,
                },
                authenticatorAttachment,
                clientExtensionResults,
                type,
            };
        }
        if (isAuthenticatorAttestationResponse(this.response)) {
            // This is registration.
            return {
                id,
                rawId,
                response: {
                    clientDataJSON: Base64URL.encode(this.response.clientDataJSON),
                    attestationObject: Base64URL.encode(this.response.attestationObject),
                    transports: this.response?.getTransports() || [],
                },
                authenticatorAttachment,
                clientExtensionResults,
                type,
            };
        }
        throw new Error('Unexpected object.');
    }
    catch (error) {
        console.error(error);
        throw error;
    }
}
/**
 * Make sure at least PublicKeyCredential is defined before trying to polyfill anything on it
 */
if (globalThis.PublicKeyCredential) {
    // @ts-ignore: We're polyfilling this, so ignore whether TS knows about this or not
    if (!PublicKeyCredential.parseCreationOptionsFromJSON) {
        Object.defineProperty(PublicKeyCredential, 'parseCreationOptionsFromJSON', {
            value: parseCreationOptionsFromJSON,
        });
    }
    // @ts-ignore: We're polyfilling this, so ignore whether TS knows about this or not
    if (!PublicKeyCredential.parseRequestOptionsFromJSON) {
        Object.defineProperty(PublicKeyCredential, 'parseRequestOptionsFromJSON', {
            value: parseRequestOptionsFromJSON,
        });
    }
    // @ts-ignore: We're polyfilling this, so ignore whether TS knows about this or not
    if (!PublicKeyCredential.prototype.toJSON) {
        Object.defineProperty(PublicKeyCredential.prototype, 'toJSON', {
            value: toJSON,
        });
    }
}
