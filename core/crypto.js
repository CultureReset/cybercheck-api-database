/**
 * core/crypto — AES-256-GCM for credentials at rest.
 *
 * Replaces four near-identical copies that used to live in routes/stripe.js,
 * routes/square.js, routes/google-business.js and routes/fareharbor.js.
 *
 * Wire format is unchanged, so anything already stored still decrypts:
 *     <iv hex>:<auth tag hex>:<ciphertext hex>
 *
 * Key lookup walks `keys` in order and takes the first env var that is set.
 * The default order prefers the new neutral name but keeps STRIPE_KEY_ENCRYPTION_KEY
 * working, since three non-Stripe modules were keyed off it.
 */

const crypto = require('crypto');

const DEFAULT_KEYS = ['CREDENTIAL_ENCRYPTION_KEY', 'STRIPE_KEY_ENCRYPTION_KEY'];
const OAUTH_KEYS   = ['OAUTH_TOKEN_ENCRYPTION_KEY', 'CREDENTIAL_ENCRYPTION_KEY', 'STRIPE_KEY_ENCRYPTION_KEY'];

function resolveKey(keys) {
    for (const name of keys) {
        if (process.env[name]) return Buffer.from(process.env[name], 'hex');
    }
    return null;
}

/**
 * @param {string} plaintext
 * @param {object} [opts]
 * @param {string[]} [opts.keys]        env var names to try, in order
 * @param {boolean}  [opts.passthrough] return the input instead of throwing when no key is set
 */
function encrypt(plaintext, opts = {}) {
    const keys = opts.keys || DEFAULT_KEYS;
    const key  = resolveKey(keys);
    if (!key) {
        if (opts.passthrough) return plaintext;
        throw new Error(`${keys[0]} not set in environment`);
    }
    const iv     = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const enc    = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag    = cipher.getAuthTag();
    return iv.toString('hex') + ':' + tag.toString('hex') + ':' + enc.toString('hex');
}

/**
 * @param {string} stored  iv:tag:ciphertext
 * @param {object} [opts]  same shape as encrypt(); passthrough also swallows decode
 *                         failures and returns `stored` unchanged (for values that
 *                         were written before a key was configured)
 */
function decrypt(stored, opts = {}) {
    const keys = opts.keys || DEFAULT_KEYS;
    const key  = resolveKey(keys);
    if (!key) {
        if (opts.passthrough) return stored;
        throw new Error(`${keys[0]} not set in environment`);
    }
    try {
        const [ivHex, tagHex, encHex] = String(stored).split(':');
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
        decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
        return Buffer.concat([
            decipher.update(Buffer.from(encHex, 'hex')),
            decipher.final(),
        ]).toString('utf8');
    } catch (err) {
        if (opts.passthrough) return stored;
        throw err;
    }
}

// Named helpers matching the call sites they replace.
const encryptKey   = (v) => encrypt(v);
const decryptKey   = (v) => decrypt(v);
const encryptToken = (v) => encrypt(v, { keys: OAUTH_KEYS });
const decryptToken = (v) => decrypt(v, { keys: OAUTH_KEYS });

module.exports = {
    encrypt, decrypt,
    encryptKey, decryptKey,
    encryptToken, decryptToken,
    DEFAULT_KEYS, OAUTH_KEYS,
};
