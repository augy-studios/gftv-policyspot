// api/auth/login.js
const {
    getSupabaseClient
} = require('../../lib/supabase');
const {
    ok,
    err,
    handleOptions
} = require('../../lib/response');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

module.exports = async (req, res) => {
    if (handleOptions(req, res)) return;
    if (req.method !== 'POST') return err(res, 'Method not allowed', 405);
    const {
        username,
        password,
        device_token,
    } = req.body || {};
    if (!username || !password) return err(res, 'Username and password required');
    const supabase = getSupabaseClient();
    const {
        data: user,
        error
    } = await supabase
        .from('gftvhello_users')
        .select('*')
        .eq('username', username.toLowerCase())
        .single();
    if (error || !user) return err(res, 'Invalid credentials', 401);
    if (!user.is_approved) return err(res, 'Account pending approval', 403);
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return err(res, 'Invalid credentials', 401);

    // If 2FA is enabled, check for a trusted device before requiring the code
    if (user.totp_secret) {
        if (device_token) {
            const { data: trusted } = await supabase
                .from('gftvhello_trusted_devices')
                .select('id, expires_at')
                .eq('device_token', device_token)
                .eq('user_id', user.id)
                .single();

            if (trusted && new Date(trusted.expires_at) > new Date()) {
                // Trusted device — fall through to create session below
            } else {
                // Stale/invalid token — clean it up and require 2FA
                if (trusted) {
                    await supabase.from('gftvhello_trusted_devices').delete().eq('id', trusted.id);
                }
                const challenge_token = crypto.randomBytes(32).toString('hex');
                const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString();
                await supabase.from('gftvhello_totp_challenges').insert({
                    token: challenge_token,
                    user_id: user.id,
                    expires_at,
                });
                return ok(res, { totp_required: true, challenge_token });
            }
        } else {
            // No device token — require 2FA
            const challenge_token = crypto.randomBytes(32).toString('hex');
            const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString();
            await supabase.from('gftvhello_totp_challenges').insert({
                token: challenge_token,
                user_id: user.id,
                expires_at,
            });
            return ok(res, { totp_required: true, challenge_token });
        }
    }

    const token = crypto.randomBytes(48).toString('hex');
    const expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await supabase.from('gftvhello_sessions').insert({
        user_id: user.id,
        token,
        expires_at
    });
    const {
        password_hash,
        totp_secret,
        ...safeUser
    } = user;
    return ok(res, {
        token,
        user: safeUser
    });
};