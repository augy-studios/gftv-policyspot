// api/auth/login.js - Signs a user in with their username and password.
// If the user has two-factor authentication turned on, a short-lived
// "challenge token" is returned instead and the browser must then call
// api/auth/totp-verify.js with the 6-digit code.
const {
    getSupabaseClient
} = require('../../lib/supabase');
const {
    sendSuccess,
    sendError,
    handleOptions
} = require('../../lib/response');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const TEN_MINUTES_IN_MILLISECONDS = 10 * 60 * 1000;
const THIRTY_DAYS_IN_MILLISECONDS = 30 * 24 * 60 * 60 * 1000;

/**
 * Stores a new two-factor challenge for the user and sends it back to the
 * browser so it can ask the user for their authenticator code.
 */
async function sendTwoFactorChallenge(supabase, response, userId) {
    const challengeToken = crypto.randomBytes(32).toString('hex');
    const challengeExpiresAt = new Date(Date.now() + TEN_MINUTES_IN_MILLISECONDS).toISOString();
    await supabase.from('gftvhello_totp_challenges').insert({
        token: challengeToken,
        user_id: userId,
        expires_at: challengeExpiresAt,
    });
    return sendSuccess(response, { totp_required: true, challenge_token: challengeToken });
}

module.exports = async (request, response) => {
    if (handleOptions(request, response)) {
        return;
    }
    if (request.method !== 'POST') {
        return sendError(response, 'Method not allowed', 405);
    }
    const {
        username,
        password,
        device_token: deviceToken,
    } = request.body || {};
    if (!username || !password) {
        return sendError(response, 'Username and password required');
    }
    const supabase = getSupabaseClient();
    const {
        data: user,
        error
    } = await supabase
        .from('gftvhello_users')
        .select('*')
        .eq('username', username.toLowerCase())
        .single();
    if (error || !user) {
        return sendError(response, 'Invalid credentials', 401);
    }
    if (!user.is_approved) {
        return sendError(response, 'Account pending approval', 403);
    }
    const passwordIsCorrect = await bcrypt.compare(password, user.password_hash);
    if (!passwordIsCorrect) {
        return sendError(response, 'Invalid credentials', 401);
    }

    // If 2FA is enabled, check for a trusted device before requiring the code
    if (user.totp_secret) {
        if (!deviceToken) {
            // No device token was sent, so the code is always required
            return sendTwoFactorChallenge(supabase, response, user.id);
        }

        const { data: trustedDevice } = await supabase
            .from('gftvhello_trusted_devices')
            .select('id, expires_at')
            .eq('device_token', deviceToken)
            .eq('user_id', user.id)
            .single();

        const deviceIsStillTrusted = trustedDevice && new Date(trustedDevice.expires_at) > new Date();
        if (!deviceIsStillTrusted) {
            // Stale or invalid token: clean it up and require 2FA
            if (trustedDevice) {
                await supabase.from('gftvhello_trusted_devices').delete().eq('id', trustedDevice.id);
            }
            return sendTwoFactorChallenge(supabase, response, user.id);
        }
        // Trusted device: carry on and create the session below
    }

    const sessionToken = crypto.randomBytes(48).toString('hex');
    const sessionExpiresAt = new Date(Date.now() + THIRTY_DAYS_IN_MILLISECONDS).toISOString();
    await supabase.from('gftvhello_sessions').insert({
        user_id: user.id,
        token: sessionToken,
        expires_at: sessionExpiresAt
    });
    // Remove the secret fields so they are never sent to the browser
    const {
        password_hash: removedPasswordHash,
        totp_secret: removedTotpSecret,
        ...safeUser
    } = user;
    return sendSuccess(response, {
        token: sessionToken,
        user: safeUser
    });
};
