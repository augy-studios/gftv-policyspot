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
        email,
        password
    } = req.body || {};
    if (!email || !password) return err(res, 'Email and password required');
    const supabase = getSupabaseClient();
    const {
        data: user,
        error
    } = await supabase
        .from('gftvhello_users')
        .select('*')
        .eq('email', email.toLowerCase())
        .single();
    if (error || !user) return err(res, 'Invalid credentials', 401);
    if (!user.is_approved) return err(res, 'Account pending approval', 403);
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return err(res, 'Invalid credentials', 401);
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