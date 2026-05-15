const crypto = require('crypto');

function base32Decode(str) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const s = str.toUpperCase().replace(/=+$/, '').replace(/\s/g, '');
    let bits = 0, value = 0;
    const output = [];
    for (const char of s) {
        const idx = alphabet.indexOf(char);
        if (idx === -1) continue;
        value = (value << 5) | idx;
        bits += 5;
        if (bits >= 8) {
            output.push((value >>> (bits - 8)) & 0xff);
            bits -= 8;
        }
    }
    return Buffer.from(output);
}

function hotp(key, counter) {
    const buf = Buffer.alloc(8);
    buf.writeBigInt64BE(BigInt(counter));
    const hmac = crypto.createHmac('sha1', key).update(buf).digest();
    const offset = hmac[19] & 0xf;
    const code = ((hmac[offset] & 0x7f) << 24) |
                 ((hmac[offset + 1] & 0xff) << 16) |
                 ((hmac[offset + 2] & 0xff) << 8) |
                 (hmac[offset + 3] & 0xff);
    return String(code % 1_000_000).padStart(6, '0');
}

// Verifies a 6-digit TOTP code against a base32 secret, ±1 time step for clock skew.
function verifyTotp(secret, token) {
    const key = base32Decode(secret);
    const step = Math.floor(Date.now() / 1000 / 30);
    const candidate = String(token).replace(/\s/g, '');
    for (let i = -1; i <= 1; i++) {
        if (hotp(key, step + i) === candidate) return true;
    }
    return false;
}

module.exports = { verifyTotp };
