// lib/totp.js - Time-based one-time password (TOTP) checking for two-factor login.
// This follows RFC 6238 (TOTP) which is built on top of RFC 4226 (HOTP).
const crypto = require('crypto');

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const SECONDS_PER_TIME_STEP = 30;
const NUMBER_OF_CODE_DIGITS = 6;

/**
 * Converts a base32 text secret (the kind shown in authenticator app set-up)
 * into the raw bytes it represents. Unknown characters are skipped.
 */
function base32Decode(base32Text) {
    const cleanedText = base32Text.toUpperCase().replace(/=+$/, '').replace(/\s/g, '');
    // Each base32 character carries 5 bits. We collect bits in "bitBuffer"
    // and every time we have at least 8 of them we take out one whole byte.
    let bitCount = 0;
    let bitBuffer = 0;
    const outputBytes = [];
    for (const character of cleanedText) {
        const characterValue = BASE32_ALPHABET.indexOf(character);
        if (characterValue === -1) {
            continue;
        }
        bitBuffer = (bitBuffer << 5) | characterValue;
        bitCount += 5;
        if (bitCount >= 8) {
            outputBytes.push((bitBuffer >>> (bitCount - 8)) & 0xff);
            bitCount -= 8;
        }
    }
    return Buffer.from(outputBytes);
}

/**
 * Generates the 6-digit HMAC-based one-time password (HOTP) for the given
 * secret key bytes and counter value, returned as a zero-padded string.
 */
function generateHotpCode(secretKeyBytes, counter) {
    const counterBytes = Buffer.alloc(8);
    counterBytes.writeBigInt64BE(BigInt(counter));
    const hmacDigest = crypto.createHmac('sha1', secretKeyBytes).update(counterBytes).digest();
    // "Dynamic truncation": the last 4 bits of the digest pick where to read
    // 4 bytes from. The top bit is cleared so the number is always positive.
    const startOffset = hmacDigest[19] & 0xf;
    const fullNumber = ((hmacDigest[startOffset] & 0x7f) << 24) |
                       ((hmacDigest[startOffset + 1] & 0xff) << 16) |
                       ((hmacDigest[startOffset + 2] & 0xff) << 8) |
                       (hmacDigest[startOffset + 3] & 0xff);
    return String(fullNumber % 1_000_000).padStart(NUMBER_OF_CODE_DIGITS, '0');
}

/**
 * Verifies a 6-digit TOTP code against a base32 secret.
 * The code from the previous and next 30-second window are also accepted
 * so a small difference between the server clock and the phone clock is allowed.
 */
function verifyTotp(base32Secret, submittedCode) {
    const secretKeyBytes = base32Decode(base32Secret);
    const currentTimeStep = Math.floor(Date.now() / 1000 / SECONDS_PER_TIME_STEP);
    const cleanedCode = String(submittedCode).replace(/\s/g, '');
    for (let stepOffset = -1; stepOffset <= 1; stepOffset++) {
        if (generateHotpCode(secretKeyBytes, currentTimeStep + stepOffset) === cleanedCode) {
            return true;
        }
    }
    return false;
}

module.exports = { verifyTotp };
