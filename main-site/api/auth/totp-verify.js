// api/auth/totp-verify.js - Second step of a two-factor login.
// Accepts the challenge token from api/auth/login.js together with either a
// 6-digit authenticator code or a single-use backup code, and creates a session.
const { getSupabaseClient } = require('../../lib/supabase');
const { sendSuccess, sendError, handleOptions } = require('../../lib/response');
const { verifyTotp } = require('../../lib/totp');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const THIRTY_DAYS_IN_MILLISECONDS = 30 * 24 * 60 * 60 * 1000;

module.exports = async (request, response) => {
    if (handleOptions(request, response)) {
        return;
    }
    if (request.method !== 'POST') {
        return sendError(response, 'Method not allowed', 405);
    }

    const {
        challenge_token: challengeToken,
        code,
        trust_device: trustDevice
    } = request.body || {};
    if (!challengeToken || !code) {
        return sendError(response, 'challenge_token and code are required');
    }

    const supabase = getSupabaseClient();

    // Validate the challenge
    const { data: challenge, error: challengeError } = await supabase
        .from('gftvhello_totp_challenges')
        .select('*')
        .eq('token', challengeToken)
        .single();

    if (challengeError || !challenge) {
        return sendError(response, 'Invalid or expired challenge', 401);
    }
    if (new Date(challenge.expires_at) < new Date()) {
        await supabase.from('gftvhello_totp_challenges').delete().eq('token', challengeToken);
        return sendError(response, 'Challenge expired, please log in again', 401);
    }

    const { data: user } = await supabase
        .from('gftvhello_users')
        .select('*')
        .eq('id', challenge.user_id)
        .single();

    if (!user) {
        return sendError(response, 'User not found', 401);
    }

    let codeIsVerified = false;
    let usedBackupCodeId = null;

    const trimmedCode = String(code).trim().replace(/\s/g, '');

    // Try TOTP first if the code looks like a 6-digit pin
    if (/^\d{6}$/.test(trimmedCode) && user.totp_secret) {
        codeIsVerified = verifyTotp(user.totp_secret, trimmedCode);
    }

    // If not verified, try backup codes
    if (!codeIsVerified) {
        const { data: backupCodes } = await supabase
            .from('gftvhello_backup_codes')
            .select('id, code_hash')
            .eq('user_id', user.id);

        if (backupCodes) {
            for (const backupCode of backupCodes) {
                const backupCodeMatches = await bcrypt.compare(trimmedCode, backupCode.code_hash);
                if (backupCodeMatches) {
                    codeIsVerified = true;
                    usedBackupCodeId = backupCode.id;
                    break;
                }
            }
        }
    }

    if (!codeIsVerified) {
        return sendError(response, 'Invalid code', 401);
    }

    // Consume the challenge
    await supabase.from('gftvhello_totp_challenges').delete().eq('token', challengeToken);

    // Consume the backup code if one was used
    if (usedBackupCodeId) {
        await supabase.from('gftvhello_backup_codes').delete().eq('id', usedBackupCodeId);
    }

    // Create session
    const sessionToken = crypto.randomBytes(48).toString('hex');
    const sessionExpiresAt = new Date(Date.now() + THIRTY_DAYS_IN_MILLISECONDS).toISOString();
    await supabase.from('gftvhello_sessions').insert({
        user_id: user.id,
        token: sessionToken,
        expires_at: sessionExpiresAt,
    });

    // Optionally create a trusted device token so 2FA is skipped next time
    let deviceToken = null;
    if (trustDevice) {
        deviceToken = crypto.randomBytes(48).toString('hex');
        const deviceExpiresAt = new Date(Date.now() + THIRTY_DAYS_IN_MILLISECONDS).toISOString();
        await supabase.from('gftvhello_trusted_devices').insert({
            user_id: user.id,
            device_token: deviceToken,
            expires_at: deviceExpiresAt,
        });
    }

    // Remove the secret fields so they are never sent to the browser
    const {
        password_hash: removedPasswordHash,
        totp_secret: removedTotpSecret,
        ...safeUser
    } = user;
    return sendSuccess(response, { token: sessionToken, user: safeUser, device_token: deviceToken });
};
