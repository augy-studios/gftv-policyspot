// api/auth/totp-verify.js
const { getSupabaseClient } = require('../../lib/supabase');
const { ok, err, handleOptions } = require('../../lib/response');
const { verifyTotp } = require('../../lib/totp');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

module.exports = async (req, res) => {
    if (handleOptions(req, res)) return;
    if (req.method !== 'POST') return err(res, 'Method not allowed', 405);

    const { challenge_token, code, trust_device } = req.body || {};
    if (!challenge_token || !code) return err(res, 'challenge_token and code are required');

    const supabase = getSupabaseClient();

    // Validate the challenge
    const { data: challenge, error: cErr } = await supabase
        .from('gftvhello_totp_challenges')
        .select('*')
        .eq('token', challenge_token)
        .single();

    if (cErr || !challenge) return err(res, 'Invalid or expired challenge', 401);
    if (new Date(challenge.expires_at) < new Date()) {
        await supabase.from('gftvhello_totp_challenges').delete().eq('token', challenge_token);
        return err(res, 'Challenge expired, please log in again', 401);
    }

    const { data: user } = await supabase
        .from('gftvhello_users')
        .select('*')
        .eq('id', challenge.user_id)
        .single();

    if (!user) return err(res, 'User not found', 401);

    let verified = false;
    let usedBackupCodeId = null;

    const trimmedCode = String(code).trim().replace(/\s/g, '');

    // Try TOTP first if the code looks like a 6-digit pin
    if (/^\d{6}$/.test(trimmedCode) && user.totp_secret) {
        verified = verifyTotp(user.totp_secret, trimmedCode);
    }

    // If not verified, try backup codes
    if (!verified) {
        const { data: backupCodes } = await supabase
            .from('gftvhello_backup_codes')
            .select('id, code_hash')
            .eq('user_id', user.id);

        if (backupCodes) {
            for (const bc of backupCodes) {
                const match = await bcrypt.compare(trimmedCode, bc.code_hash);
                if (match) {
                    verified = true;
                    usedBackupCodeId = bc.id;
                    break;
                }
            }
        }
    }

    if (!verified) return err(res, 'Invalid code', 401);

    // Consume the challenge
    await supabase.from('gftvhello_totp_challenges').delete().eq('token', challenge_token);

    // Consume the backup code if one was used
    if (usedBackupCodeId) {
        await supabase.from('gftvhello_backup_codes').delete().eq('id', usedBackupCodeId);
    }

    // Create session
    const session_token = crypto.randomBytes(48).toString('hex');
    const expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await supabase.from('gftvhello_sessions').insert({
        user_id: user.id,
        token: session_token,
        expires_at,
    });

    // Optionally create a trusted device token
    let device_token = null;
    if (trust_device) {
        device_token = crypto.randomBytes(48).toString('hex');
        const device_expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        await supabase.from('gftvhello_trusted_devices').insert({
            user_id: user.id,
            device_token,
            expires_at: device_expires,
        });
    }

    const { password_hash, totp_secret, ...safeUser } = user;
    return ok(res, { token: session_token, user: safeUser, device_token });
};
